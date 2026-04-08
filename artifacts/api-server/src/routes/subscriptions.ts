import { Router, type IRouter } from "express";
import { db, driverSubscriptionsTable, driversTable, usersTable, settingsTable, ridesharesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { sendPushToUser } from "../push";
import crypto from "crypto";

const router: IRouter = Router();

async function getSetting(key: string, fallback: string): Promise<string> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  return row?.value ?? fallback;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function yookassaRequest(method: string, path: string, body?: object): Promise<any> {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secretKey) throw new Error("YooKassa не настроена");

  const credentials = Buffer.from(`${shopId}:${secretKey}`).toString("base64");
  const idempotenceKey = crypto.randomUUID();

  const res = await fetch(`https://api.yookassa.ru/v3${path}`, {
    method,
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
      "Idempotence-Key": idempotenceKey,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YooKassa error ${res.status}: ${text}`);
  }
  return res.json();
}

async function getOrCreateSubscription(driverId: number): Promise<typeof driverSubscriptionsTable.$inferSelect | null> {
  const [existing] = await db.select().from(driverSubscriptionsTable)
    .where(eq(driverSubscriptionsTable.driverId, driverId))
    .orderBy(desc(driverSubscriptionsTable.createdAt))
    .limit(1);

  if (existing) return existing;

  const now = new Date();
  const trialDays = parseInt(await getSetting("subscription_trial_days", "30"));
  const endDate = addDays(now, trialDays);

  const [created] = await db.insert(driverSubscriptionsTable).values({
    driverId,
    status: "trial",
    startDate: now,
    endDate,
    amount: 0,
  }).returning();

  return created ?? null;
}

export function computeStatus(sub: typeof driverSubscriptionsTable.$inferSelect): string {
  const now = new Date();
  if (sub.status === "trial") {
    return now <= new Date(sub.endDate) ? "trial" : "expired";
  }
  if (sub.status === "active") {
    return now <= new Date(sub.endDate) ? "active" : "expired";
  }
  return sub.status;
}

async function sendReminderIfNeeded(sub: typeof driverSubscriptionsTable.$inferSelect): Promise<void> {
  const effectiveStatus = computeStatus(sub);
  const daysLeft = Math.max(0, Math.ceil((new Date(sub.endDate).getTime() - Date.now()) / 86400000));

  if (effectiveStatus !== "trial" && effectiveStatus !== "active") return;
  if (daysLeft > 7) return;

  const lastSent = sub.reminderSentAt ? new Date(sub.reminderSentAt).getTime() : 0;
  const hoursSinceReminder = (Date.now() - lastSent) / 3600000;
  if (hoursSinceReminder < 23) return;

  const [driver] = await db.select().from(driversTable).where(eq(driversTable.id, sub.driverId));
  if (!driver) return;

  const label = effectiveStatus === "trial" ? "Пробный период" : "Подписка";
  let title: string;
  let body: string;

  if (daysLeft === 0) {
    title = "⚠️ Подписка истекает сегодня";
    body = "Оплатите подписку, иначе заказы поступать не будут.";
  } else {
    const dayWord = daysLeft === 1 ? "день" : daysLeft < 5 ? "дня" : "дней";
    title = `⏰ ${label} истекает через ${daysLeft} ${dayWord}`;
    body = "Оплатите подписку, чтобы продолжить принимать заказы.";
  }

  sendPushToUser(driver.userId, { title, body, tag: "subscription-reminder", url: "/driver" }).catch(() => {});

  await db.update(driverSubscriptionsTable)
    .set({ reminderSentAt: new Date() })
    .where(eq(driverSubscriptionsTable.id, sub.id));
}

// ── GET статус подписки водителя ────────────────────────────────────────────
router.get("/subscriptions/driver/:driverId", async (req, res): Promise<void> => {
  const driverId = parseInt(req.params.driverId);
  if (isNaN(driverId)) { res.status(400).json({ error: "Invalid driverId" }); return; }

  const sub = await getOrCreateSubscription(driverId);
  if (!sub) { res.status(404).json({ error: "Not found" }); return; }

  const effectiveStatus = computeStatus(sub);
  const daysLeft = Math.max(0, Math.ceil((new Date(sub.endDate).getTime() - Date.now()) / 86400000));

  sendReminderIfNeeded(sub).catch(() => {});

  res.json({ ...sub, effectiveStatus, daysLeft });
});

// ── POST создать платёж ──────────────────────────────────────────────────────
router.post("/subscriptions/pay/:driverId", async (req, res): Promise<void> => {
  const driverId = parseInt(req.params.driverId);
  if (isNaN(driverId)) { res.status(400).json({ error: "Invalid driverId" }); return; }

  const [driver] = await db.select().from(driversTable).where(eq(driversTable.id, driverId));
  if (!driver) { res.status(404).json({ error: "Driver not found" }); return; }

  const [driverUser] = await db.select().from(usersTable).where(eq(usersTable.id, driver.userId));

  const priceStr = await getSetting("subscription_price", "2000");
  const amount = parseFloat(priceStr);
  const returnUrl = req.body.returnUrl || `${process.env.APP_URL || "https://taxiimpulse.ru"}/driver`;

  let paymentId: string | undefined;
  let confirmationUrl: string | undefined;

  const yookassaConfigured = !!process.env.YOOKASSA_SHOP_ID && !!process.env.YOOKASSA_SECRET_KEY;

  if (yookassaConfigured) {
    try {
      const payment = await yookassaRequest("POST", "/payments", {
        amount: { value: amount.toFixed(2), currency: "RUB" },
        capture: true,
        confirmation: { type: "redirect", return_url: returnUrl },
        description: `Подписка TAXI IMPULSE — ${driverUser?.name || driverId}`,
        metadata: { driverId: String(driverId) },
      });
      paymentId = payment.id;
      confirmationUrl = payment.confirmation?.confirmation_url;
    } catch (err: any) {
      res.status(502).json({ error: "Ошибка создания платежа: " + err.message });
      return;
    }
  }

  const now = new Date();
  const [existing] = await db.select().from(driverSubscriptionsTable)
    .where(eq(driverSubscriptionsTable.driverId, driverId))
    .orderBy(desc(driverSubscriptionsTable.createdAt)).limit(1);

  if (existing && (existing.status === "pending" || existing.status === "trial" || existing.status === "expired")) {
    await db.update(driverSubscriptionsTable).set({
      status: "pending",
      amount,
      paymentId: paymentId || null,
      paymentUrl: confirmationUrl || null,
    }).where(eq(driverSubscriptionsTable.id, existing.id));
  } else {
    const trialDays = parseInt(await getSetting("subscription_trial_days", "30"));
    await db.insert(driverSubscriptionsTable).values({
      driverId,
      status: "pending",
      startDate: now,
      endDate: addDays(now, trialDays),
      amount,
      paymentId: paymentId || null,
      paymentUrl: confirmationUrl || null,
    });
  }

  res.json({ confirmationUrl, amount, yookassaConfigured });
});

// ── POST вебхук от ЮКассы ────────────────────────────────────────────────────
router.post("/payments/yookassa/webhook", async (req, res): Promise<void> => {
  const { type, object } = req.body || {};
  res.json({ ok: true });

  if (type !== "notification" || !object) return;

  const paymentId = object.id;
  const meta = object.metadata || {};

  // Обработка платежа за попутку
  if (meta.type === "rideshare_post" && meta.rideshareId) {
    const rideshareId = parseInt(meta.rideshareId);
    if (!isNaN(rideshareId)) {
      if (object.status === "succeeded") {
        await db.update(ridesharesTable)
          .set({ status: "active", paymentStatus: "paid", paymentId })
          .where(eq(ridesharesTable.id, rideshareId));
      } else if (object.status === "canceled") {
        await db.delete(ridesharesTable).where(eq(ridesharesTable.id, rideshareId));
      }
    }
    return;
  }

  const driverId = parseInt(meta.driverId);
  if (!paymentId || isNaN(driverId)) return;

  if (object.status === "succeeded") {
    const [sub] = await db.select().from(driverSubscriptionsTable)
      .where(eq(driverSubscriptionsTable.driverId, driverId))
      .orderBy(desc(driverSubscriptionsTable.createdAt)).limit(1);

    if (sub) {
      const now = new Date();
      const prevEnd = sub.status === "active" && new Date(sub.endDate) > now
        ? new Date(sub.endDate) : now;
      const endDate = addDays(prevEnd, 30);

      const paymentMethodId = object.payment_method?.id ?? null;
      await db.update(driverSubscriptionsTable).set({
        status: "active",
        startDate: now,
        endDate,
        paymentId,
        amount: object.amount?.value ? parseFloat(object.amount.value) : sub.amount,
        ...(paymentMethodId ? { paymentMethodId, autoRenew: true, lastAutoChargeAt: now } : {}),
      }).where(eq(driverSubscriptionsTable.id, sub.id));

      const [driver] = await db.select().from(driversTable).where(eq(driversTable.id, driverId));
      if (driver) {
        sendPushToUser(driver.userId, {
          title: "✅ Подписка активирована",
          body: `Подписка активна до ${endDate.toLocaleDateString("ru-RU")}. Принимайте заказы!`,
          tag: "subscription-active",
          url: "/driver",
        }).catch(() => {});
      }
    }
  } else if (object.status === "canceled") {
    const [sub] = await db.select().from(driverSubscriptionsTable)
      .where(eq(driverSubscriptionsTable.driverId, driverId))
      .orderBy(desc(driverSubscriptionsTable.createdAt)).limit(1);
    if (sub && sub.status === "pending") {
      await db.update(driverSubscriptionsTable)
        .set({ status: "expired" })
        .where(eq(driverSubscriptionsTable.id, sub.id));
    }
  }
});

// ── POST подтвердить платёж после редиректа ──────────────────────────────────
router.post("/subscriptions/confirm/:driverId", async (req, res): Promise<void> => {
  const driverId = parseInt(req.params.driverId);
  if (isNaN(driverId)) { res.status(400).json({ error: "Invalid driverId" }); return; }

  const [sub] = await db.select().from(driverSubscriptionsTable)
    .where(eq(driverSubscriptionsTable.driverId, driverId))
    .orderBy(desc(driverSubscriptionsTable.createdAt)).limit(1);

  if (!sub || sub.status !== "pending") {
    res.status(400).json({ error: "No pending subscription" });
    return;
  }

  if (!process.env.YOOKASSA_SHOP_ID) {
    const now = new Date();
    await db.update(driverSubscriptionsTable).set({
      status: "active",
      startDate: now,
      endDate: addDays(now, 30),
    }).where(eq(driverSubscriptionsTable.id, sub.id));
    res.json({ ok: true });
    return;
  }

  if (sub.paymentId) {
    try {
      const payment = await yookassaRequest("GET", `/payments/${sub.paymentId}`);
      if (payment.status === "succeeded") {
        const now = new Date();
        await db.update(driverSubscriptionsTable).set({
          status: "active",
          startDate: now,
          endDate: addDays(now, 30),
        }).where(eq(driverSubscriptionsTable.id, sub.id));
        res.json({ ok: true, activated: true });
        return;
      }
    } catch {}
  }

  res.json({ ok: true, activated: false });
});

// ── GET список подписок (для администратора) ─────────────────────────────────
router.get("/subscriptions", async (_req, res): Promise<void> => {
  const subs = await db.select().from(driverSubscriptionsTable)
    .orderBy(desc(driverSubscriptionsTable.createdAt));

  const result = await Promise.all(subs.map(async (sub) => {
    const [driver] = await db.select().from(driversTable).where(eq(driversTable.id, sub.driverId));
    let driverName = "Неизвестно";
    let driverPhone = "";
    if (driver) {
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, driver.userId));
      driverName = u?.name || "Неизвестно";
      driverPhone = u?.phone || "";
    }
    const effectiveStatus = computeStatus(sub);
    const daysLeft = Math.max(0, Math.ceil((new Date(sub.endDate).getTime() - Date.now()) / 86400000));
    return { ...sub, effectiveStatus, daysLeft, driverName, driverPhone };
  }));

  res.json(result);
});

// ── POST создать ссылку оплаты подписки по номеру телефона (для теста) ──────
router.post("/subscriptions/charge-by-phone", async (req, res): Promise<void> => {
  const { phone } = req.body;
  if (!phone) { res.status(400).json({ error: "Укажите phone" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
  if (!user) { res.status(404).json({ error: "Пользователь не найден" }); return; }

  const [driver] = await db.select().from(driversTable).where(eq(driversTable.userId, user.id));
  if (!driver) { res.status(404).json({ error: "Профиль водителя не найден" }); return; }

  const [sub] = await db.select().from(driverSubscriptionsTable)
    .where(eq(driverSubscriptionsTable.driverId, driver.id))
    .orderBy(desc(driverSubscriptionsTable.createdAt)).limit(1);

  const priceStr = await getSetting("subscription_price", "2000");
  const amount = parseFloat(priceStr);
  const yookassaConfigured = !!process.env.YOOKASSA_SHOP_ID && !!process.env.YOOKASSA_SECRET_KEY;
  const returnUrl = `https://taxiimpulse.ru/driver`;

  if (yookassaConfigured) {
    try {
      const payment = await yookassaRequest("POST", "/payments", {
        amount: { value: amount.toFixed(2), currency: "RUB" },
        capture: true,
        confirmation: { type: "redirect", return_url: returnUrl },
        description: `Подписка TAXI IMPULSE — ${user.name}`,
        metadata: { driverId: String(driver.id) },
      });

      const now = new Date();
      if (sub) {
        await db.update(driverSubscriptionsTable).set({
          status: "pending", amount,
          paymentId: payment.id,
          paymentUrl: payment.confirmation?.confirmation_url || null,
        }).where(eq(driverSubscriptionsTable.id, sub.id));
      } else {
        await db.insert(driverSubscriptionsTable).values({
          driverId: driver.id, status: "pending", amount,
          startDate: now, endDate: addDays(now, 30),
          paymentId: payment.id,
          paymentUrl: payment.confirmation?.confirmation_url || null,
        });
      }

      res.json({
        ok: true,
        confirmationUrl: payment.confirmation?.confirmation_url,
        driverName: user.name,
        phone,
        amount,
      });
      return;
    } catch (err: any) {
      res.status(502).json({ error: "Ошибка создания платежа: " + err.message });
      return;
    }
  }

  // Dev mode — активируем без оплаты
  const now = new Date();
  const endDate = addDays(now, 30);
  if (sub) {
    await db.update(driverSubscriptionsTable)
      .set({ status: "active", startDate: now, endDate, amount })
      .where(eq(driverSubscriptionsTable.id, sub.id));
  } else {
    await db.insert(driverSubscriptionsTable).values({
      driverId: driver.id, status: "active", startDate: now, endDate, amount,
    });
  }
  res.json({ ok: true, devMode: true, endDate, driverName: user.name, phone });
});

// ── Проверка подписки при приёме заказов ────────────────────────────────────
export async function checkDriverSubscription(driverId: number): Promise<boolean> {
  const sub = await getOrCreateSubscription(driverId);
  if (!sub) return false;
  const status = computeStatus(sub);
  return status === "active" || status === "trial";
}

export default router;
