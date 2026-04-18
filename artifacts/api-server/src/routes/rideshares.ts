import { Router, type IRouter } from "express";
import { eq, desc, and, gte, inArray, sql } from "drizzle-orm";
import { db, ridesharesTable, rideshareMessagesTable, driversTable, usersTable, settingsTable } from "@workspace/db";
import crypto from "crypto";
import { sendPushToUser } from "../push";

const router: IRouter = Router();

async function getSetting(key: string, fallback: string): Promise<string> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  return row?.value ?? fallback;
}

async function yookassaRequest(method: string, path: string, body?: object): Promise<any> {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secretKey) throw new Error("YooKassa не настроена");
  const credentials = Buffer.from(`${shopId}:${secretKey}`).toString("base64");
  const res = await fetch(`https://api.yookassa.ru/v3${path}`, {
    method,
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
      "Idempotence-Key": crypto.randomUUID(),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`YooKassa ${res.status}: ${t}`); }
  return res.json();
}

// Батч-обогащение: 2 запроса на весь список вместо 2*N
async function enrichRideshares(rows: (typeof ridesharesTable.$inferSelect)[]) {
  if (rows.length === 0) return [];
  const driverIds = [...new Set(rows.map(r => r.driverId))];
  const drivers = await db.select().from(driversTable).where(inArray(driversTable.id, driverIds));
  const userIds = [...new Set(drivers.map(d => d.userId))];
  const users = userIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds))
    : [];
  const driverMap = new Map(drivers.map(d => [d.id, d]));
  const userMap = new Map(users.map(u => [u.id, u]));
  return rows.map(r => {
    const driver = driverMap.get(r.driverId);
    const driverUser = driver ? userMap.get(driver.userId) : undefined;
    return {
      ...r,
      driverName: driverUser?.name ?? "Водитель",
      driverPhone: driverUser?.phone ?? "",
      carModel: driver?.carModel ?? "",
      carColor: driver?.carColor ?? "",
      carNumber: driver?.carNumber ?? "",
      driverRating: driver?.rating ?? 5,
    };
  });
}

async function enrichRideshare(r: typeof ridesharesTable.$inferSelect) {
  return (await enrichRideshares([r]))[0];
}

// Кэш времени последней проверки (id → timestamp) — не проверяем чаще раз в 30с
const lastCheckedAt = new Map<number, number>();

// Автоматическая проверка и активация pending-попуток через ЮКассу
async function autoCheckPendingPayments(rows: (typeof ridesharesTable.$inferSelect)[]): Promise<(typeof ridesharesTable.$inferSelect)[]> {
  const yookassaConfigured = !!process.env.YOOKASSA_SHOP_ID && !!process.env.YOOKASSA_SECRET_KEY;
  if (!yookassaConfigured) return rows;

  const now = Date.now();
  const pending = rows.filter(r =>
    r.status === "pending" && r.paymentId &&
    (now - (lastCheckedAt.get(r.id) ?? 0)) > 30_000 // не чаще раз в 30с
  );
  if (pending.length === 0) return rows;
  pending.forEach(r => lastCheckedAt.set(r.id, now));

  const updated = [...rows];
  await Promise.all(pending.map(async (r) => {
    try {
      const payment = await yookassaRequest("GET", `/payments/${r.paymentId}`);
      if (payment.status === "succeeded") {
        await db.update(ridesharesTable)
          .set({ status: "active", paymentStatus: "paid" })
          .where(eq(ridesharesTable.id, r.id));
        const idx = updated.findIndex(u => u.id === r.id);
        if (idx !== -1) updated[idx] = { ...updated[idx], status: "active", paymentStatus: "paid" };
      } else if (payment.status === "canceled") {
        await db.update(ridesharesTable)
          .set({ status: "cancelled", paymentStatus: "cancelled" })
          .where(eq(ridesharesTable.id, r.id));
        const idx = updated.findIndex(u => u.id === r.id);
        if (idx !== -1) updated[idx] = { ...updated[idx], status: "cancelled", paymentStatus: "cancelled" };
      }
    } catch (e: any) {
      console.warn(`[rideshare] autoCheck id=${r.id}:`, e.message);
    }
  }));
  return updated;
}

// GET /rideshares — активные попутки (для пассажиров)
router.get("/rideshares", async (req, res): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db.select().from(ridesharesTable)
    .where(and(eq(ridesharesTable.status, "active"), gte(ridesharesTable.departureDate, today)))
    .orderBy(ridesharesTable.departureDate, ridesharesTable.departureTime);
  res.json(await enrichRideshares(rows));
});

// GET /rideshares/my — ВСЕ попутки текущего водителя (включая pending после оплаты)
router.get("/rideshares/my", async (req, res): Promise<void> => {
  const driverId = parseInt(req.query.driverId as string);
  if (isNaN(driverId)) { res.status(400).json({ error: "driverId обязателен" }); return; }
  const rows = await db.select().from(ridesharesTable)
    .where(eq(ridesharesTable.driverId, driverId))
    .orderBy(desc(ridesharesTable.createdAt));
  // Автоматически проверяем оплату для pending-попуток (фоновый запрос к ЮКассе)
  const checked = await autoCheckPendingPayments(rows);
  res.json(await enrichRideshares(checked));
});

// GET /rideshares/all — все попутки (для админа)
router.get("/rideshares/all", async (_req, res): Promise<void> => {
  const rows = await db.select().from(ridesharesTable)
    .orderBy(desc(ridesharesTable.createdAt));
  res.json(await enrichRideshares(rows));
});

// GET /rideshares/post-price — цена публикации (для фронта)
router.get("/rideshares/post-price", async (_req, res): Promise<void> => {
  const price = await getSetting("rideshare_post_price", "150");
  res.json({ price: parseFloat(price) });
});

// GET /rideshares/messages-count?driverId= — количество сообщений по всем попуткам водителя (батч, без N запросов)
router.get("/rideshares/messages-count", async (req, res): Promise<void> => {
  const driverId = parseInt(req.query.driverId as string);
  if (isNaN(driverId)) { res.status(400).json({ error: "driverId обязателен" }); return; }
  const rideRows = await db.select({ id: ridesharesTable.id })
    .from(ridesharesTable).where(eq(ridesharesTable.driverId, driverId));
  if (rideRows.length === 0) { res.json({}); return; }
  const ids = rideRows.map(r => r.id);
  const msgs = await db.select({
    rideshareId: rideshareMessagesTable.rideshareId,
    cnt: sql<number>`count(*)::int`,
  }).from(rideshareMessagesTable)
    .where(inArray(rideshareMessagesTable.rideshareId, ids))
    .groupBy(rideshareMessagesTable.rideshareId);
  const result: Record<number, number> = {};
  for (const row of msgs) result[row.rideshareId] = row.cnt;
  res.json(result);
});

// GET /rideshares/my-chats?userId= — попутки где пассажир писал сообщения (история чатов)
router.get("/rideshares/my-chats", async (req, res): Promise<void> => {
  const userId = parseInt(req.query.userId as string);
  if (isNaN(userId)) { res.status(400).json({ error: "userId обязателен" }); return; }
  const msgs = await db.select({ rideshareId: rideshareMessagesTable.rideshareId })
    .from(rideshareMessagesTable)
    .where(eq(rideshareMessagesTable.senderId, userId));
  const rideshareIds = [...new Set(msgs.map(m => m.rideshareId))];
  if (rideshareIds.length === 0) { res.json([]); return; }
  const rows = await db.select().from(ridesharesTable)
    .where(inArray(ridesharesTable.id, rideshareIds))
    .orderBy(desc(ridesharesTable.createdAt));
  res.json(await enrichRideshares(rows));
});

// POST /rideshares — водитель создаёт попутку + оплата
router.post("/rideshares", async (req, res): Promise<void> => {
  const { driverId, fromCity, toCity, fromAddress, toAddress,
    departureDate, departureTime, seatsTotal, price, description, returnUrl } = req.body;

  if (!driverId || !fromCity || !toCity || !fromAddress || !toAddress ||
    !departureDate || !departureTime || !price) {
    res.status(400).json({ error: "Заполните все обязательные поля" }); return;
  }

  const [driver] = await db.select().from(driversTable).where(eq(driversTable.id, parseInt(driverId)));
  if (!driver) { res.status(404).json({ error: "Профиль водителя не найден" }); return; }
  const [driverUser] = await db.select().from(usersTable).where(eq(usersTable.id, driver.userId));

  const postPriceStr = await getSetting("rideshare_post_price", "150");
  const postPrice = parseFloat(postPriceStr);
  const yookassaConfigured = !!process.env.YOOKASSA_SHOP_ID && !!process.env.YOOKASSA_SECRET_KEY;

  console.log(`[rideshare] create: price=${postPrice}, yookassa=${yookassaConfigured}`);

  // Если публикация бесплатная — сразу активна
  if (postPrice <= 0 || !yookassaConfigured) {
    const [rideshare] = await db.insert(ridesharesTable).values({
      driverId: parseInt(driverId),
      fromCity, toCity, fromAddress, toAddress,
      departureDate, departureTime,
      seatsTotal: parseInt(seatsTotal) || 3,
      price: parseFloat(price),
      description: description || null,
      status: "active",
      paymentStatus: "paid",
    }).returning();
    if (!rideshare) { res.status(500).json({ error: "Ошибка создания" }); return; }
    res.status(201).json({ rideshare: await enrichRideshare(rideshare), confirmationUrl: null });
    return;
  }

  // Создаём платёж ЮKassa
  try {
    const safeReturnUrl = returnUrl || `${process.env.APP_URL || "https://taxiimpulse.ru"}/driver/rideshare?paid=1`;
    const paymentBody = {
      amount: { value: postPrice.toFixed(2), currency: "RUB" },
      capture: true,
      confirmation: { type: "redirect", return_url: safeReturnUrl },
      description: `Публикация попутки TAXI IMPULSE — ${fromCity} → ${toCity}`,
      metadata: { rideshareId: "TBD", type: "rideshare_post" },
    };
    const payment = await yookassaRequest("POST", "/payments", paymentBody);
    console.log(`[rideshare] payment created: id=${payment.id}, status=${payment.status}`);

    // Создаём запись с paymentId сразу
    const [rideshare] = await db.insert(ridesharesTable).values({
      driverId: parseInt(driverId),
      fromCity, toCity, fromAddress, toAddress,
      departureDate, departureTime,
      seatsTotal: parseInt(seatsTotal) || 3,
      price: parseFloat(price),
      description: description || null,
      status: "pending",
      paymentStatus: "pending",
      paymentId: payment.id,
    }).returning();

    if (!rideshare) { res.status(500).json({ error: "Ошибка создания" }); return; }

    const confirmationUrl = payment.confirmation?.confirmation_url ?? null;
    res.status(201).json({ rideshare: await enrichRideshare(rideshare), confirmationUrl, paymentId: payment.id });
  } catch (err: any) {
    console.error(`[rideshare] payment error:`, err.message);
    res.status(502).json({ error: "Ошибка создания платежа: " + err.message });
  }
});

// GET /rideshares/:id/check-payment — вручную проверить оплату (fallback для фронта)
router.get("/rideshares/:id/check-payment", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Неверный ID" }); return; }
  const [rideshare] = await db.select().from(ridesharesTable).where(eq(ridesharesTable.id, id));
  if (!rideshare) { res.status(404).json({ error: "Не найдено" }); return; }

  if (rideshare.status === "active") { res.json({ status: "active", rideshare: await enrichRideshare(rideshare) }); return; }

  const yookassaConfigured = !!process.env.YOOKASSA_SHOP_ID && !!process.env.YOOKASSA_SECRET_KEY;
  if (!yookassaConfigured) {
    // Dev mode: сразу активируем
    const [updated] = await db.update(ridesharesTable)
      .set({ status: "active", paymentStatus: "paid" })
      .where(eq(ridesharesTable.id, id))
      .returning();
    res.json({ status: "active", rideshare: updated ? await enrichRideshare(updated) : rideshare }); return;
  }

  if (!rideshare.paymentId) { res.json({ status: rideshare.status, rideshare: await enrichRideshare(rideshare) }); return; }

  try {
    const payment = await yookassaRequest("GET", `/payments/${rideshare.paymentId}`);
    if (payment.status === "succeeded") {
      const [updated] = await db.update(ridesharesTable)
        .set({ status: "active", paymentStatus: "paid" })
        .where(eq(ridesharesTable.id, id))
        .returning();
      res.json({ status: "active", rideshare: updated ? await enrichRideshare(updated) : rideshare });
    } else if (payment.status === "canceled") {
      await db.update(ridesharesTable).set({ status: "cancelled", paymentStatus: "cancelled" }).where(eq(ridesharesTable.id, id));
      res.json({ status: "cancelled", rideshare });
    } else {
      res.json({ status: rideshare.status, paymentStatus: payment.status, rideshare: await enrichRideshare(rideshare) });
    }
  } catch (e: any) {
    console.warn(`[rideshare] check-payment id=${id}:`, e.message);
    res.json({ status: rideshare.status, rideshare: await enrichRideshare(rideshare) });
  }
});

// POST /rideshares/:id/pay — получить/обновить ссылку оплаты для pending-попутки
router.post("/rideshares/:id/pay", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Неверный ID" }); return; }

  const [rideshare] = await db.select().from(ridesharesTable).where(eq(ridesharesTable.id, id));
  if (!rideshare) { res.status(404).json({ error: "Попутка не найдена" }); return; }
  if (rideshare.paymentStatus === "paid" || rideshare.status === "active") {
    res.json({ alreadyPaid: true }); return;
  }

  const postPriceStr = await getSetting("rideshare_post_price", "150");
  const postPrice = parseFloat(postPriceStr);
  const yookassaConfigured = !!process.env.YOOKASSA_SHOP_ID && !!process.env.YOOKASSA_SECRET_KEY;

  if (!yookassaConfigured || postPrice <= 0) {
    const [updated] = await db.update(ridesharesTable)
      .set({ status: "active", paymentStatus: "paid" })
      .where(eq(ridesharesTable.id, id))
      .returning();
    res.json({ alreadyPaid: true, rideshare: updated }); return;
  }

  const safeReturnUrl = req.body.returnUrl || `https://taxiimpulse.ru/driver/rideshare?paid=1`;

  try {
    // Сначала проверим существующий платёж если есть
    if (rideshare.paymentId) {
      try {
        const existing = await yookassaRequest("GET", `/payments/${rideshare.paymentId}`);
        if (existing.status === "succeeded") {
          await db.update(ridesharesTable).set({ status: "active", paymentStatus: "paid" }).where(eq(ridesharesTable.id, id));
          res.json({ alreadyPaid: true }); return;
        }
        if (existing.status === "pending" && existing.confirmation?.confirmation_url) {
          res.json({ confirmationUrl: existing.confirmation.confirmation_url, paymentId: existing.id }); return;
        }
      } catch {}
    }

    // Создаём новый платёж
    const payment = await yookassaRequest("POST", "/payments", {
      amount: { value: postPrice.toFixed(2), currency: "RUB" },
      capture: true,
      confirmation: { type: "redirect", return_url: safeReturnUrl },
      description: `Публикация попутки TAXI IMPULSE — ${rideshare.fromCity} → ${rideshare.toCity}`,
      metadata: { rideshareId: String(id), type: "rideshare_post" },
    });

    await db.update(ridesharesTable).set({ paymentId: payment.id, status: "pending" }).where(eq(ridesharesTable.id, id));
    res.json({ confirmationUrl: payment.confirmation?.confirmation_url ?? null, paymentId: payment.id });
  } catch (err: any) {
    console.error(`[rideshare/pay] id=${id}:`, err.message);
    res.status(502).json({ error: "Ошибка создания платежа: " + err.message });
  }
});

// PATCH /rideshares/:id — обновить
router.patch("/rideshares/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Неверный ID" }); return; }
  const allowed = ["status", "description", "price", "seatsTotal", "departureDate", "departureTime"];
  const data: any = {};
  for (const k of allowed) { if (req.body[k] !== undefined) data[k] = req.body[k]; }
  const [updated] = await db.update(ridesharesTable).set(data).where(eq(ridesharesTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Не найдено" }); return; }
  res.json(await enrichRideshare(updated));
});

// DELETE /rideshares/:id
router.delete("/rideshares/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Неверный ID" }); return; }
  await db.delete(rideshareMessagesTable).where(eq(rideshareMessagesTable.rideshareId, id));
  await db.delete(ridesharesTable).where(eq(ridesharesTable.id, id));
  res.json({ ok: true });
});

// GET /rideshares/:id/messages
router.get("/rideshares/:id/messages", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Неверный ID" }); return; }
  const msgs = await db.select().from(rideshareMessagesTable)
    .where(eq(rideshareMessagesTable.rideshareId, id))
    .orderBy(rideshareMessagesTable.createdAt);
  res.json(msgs);
});

// POST /rideshares/:id/messages
router.post("/rideshares/:id/messages", async (req, res): Promise<void> => {
  const rideshareId = parseInt(req.params.id);
  if (isNaN(rideshareId)) { res.status(400).json({ error: "Неверный ID" }); return; }
  const { senderId, message } = req.body;
  if (!senderId || !message?.trim()) { res.status(400).json({ error: "senderId и message обязательны" }); return; }

  const senderIdNum = parseInt(senderId);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, senderIdNum));
  if (!user) { res.status(404).json({ error: "Пользователь не найден" }); return; }

  const [msg] = await db.insert(rideshareMessagesTable).values({
    rideshareId,
    senderId: senderIdNum,
    senderName: user.name,
    message: message.trim(),
  }).returning();

  // Push-уведомления асинхронно
  (async () => {
    try {
      const [rideshare] = await db.select().from(ridesharesTable).where(eq(ridesharesTable.id, rideshareId));
      if (!rideshare) return;

      const preview = message.trim().substring(0, 100);

      if (user.role === "passenger") {
        // Пассажир написал → уведомить водителя
        const [driver] = await db.select().from(driversTable).where(eq(driversTable.id, rideshare.driverId));
        if (driver) {
          await sendPushToUser(driver.userId, {
            title: "Сообщение от пассажира",
            body: `${user.name}: ${preview}`,
          }).catch(() => {});
        }
      } else {
        // Водитель написал → уведомить всех пассажиров что писали в этом чате
        const allMsgs = await db.select({ senderId: rideshareMessagesTable.senderId })
          .from(rideshareMessagesTable)
          .where(eq(rideshareMessagesTable.rideshareId, rideshareId));
        const passengerIds = [...new Set(allMsgs.map(m => m.senderId).filter(id => id !== senderIdNum))];
        for (const pid of passengerIds) {
          await sendPushToUser(pid, {
            title: "Ответ водителя",
            body: `${user.name}: ${preview}`,
          }).catch(() => {});
        }
      }
    } catch (e: any) {
      console.warn("[rideshare msg push]", e.message);
    }
  })();

  res.status(201).json(msg);
});

// POST /rideshares/webhook/yookassa — вебхук от ЮКассы (настроить URL в dashboard)
router.post("/rideshares/webhook/yookassa", async (req, res): Promise<void> => {
  try {
    const event = req.body;
    res.json({ ok: true });

    const rawPaymentId = event?.object?.id;
    if (!rawPaymentId) return;

    // Верифицируем платёж через API — не доверяем только телу вебхука
    let verified: any;
    try {
      verified = await yookassaRequest("GET", `/payments/${rawPaymentId}`);
    } catch {
      console.warn(`[rideshare webhook] не удалось верифицировать платёж ${rawPaymentId}`);
      return;
    }
    if (!verified) return;

    const paymentId = verified.id;
    const meta = verified.metadata || {};

    if (verified.status === "succeeded" && meta.type === "rideshare_post" && meta.rideshareId) {
      const id = parseInt(meta.rideshareId);
      if (!isNaN(id)) {
        await db.update(ridesharesTable)
          .set({ status: "active", paymentStatus: "paid", paymentId })
          .where(eq(ridesharesTable.id, id));
        console.log(`[rideshare webhook] activated id=${id}`);
      }
    } else if (verified.status === "canceled" && meta.type === "rideshare_post" && meta.rideshareId) {
      const id = parseInt(meta.rideshareId);
      if (!isNaN(id)) {
        await db.delete(ridesharesTable).where(eq(ridesharesTable.id, id));
        console.log(`[rideshare webhook] canceled/deleted id=${id}`);
      }
    }
  } catch (e: any) {
    console.error("[rideshare webhook]", e.message);
  }
});

export default router;
