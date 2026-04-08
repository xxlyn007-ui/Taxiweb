import { Router, type IRouter } from "express";
import { eq, desc, and, gte, inArray } from "drizzle-orm";
import { db, ridesharesTable, rideshareMessagesTable, driversTable, usersTable, settingsTable } from "@workspace/db";
import crypto from "crypto";

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

// GET /rideshares — активные попутки (для пассажиров)
router.get("/rideshares", async (req, res): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db.select().from(ridesharesTable)
    .where(and(eq(ridesharesTable.status, "active"), gte(ridesharesTable.departureDate, today)))
    .orderBy(ridesharesTable.departureDate, ridesharesTable.departureTime);
  res.json(await enrichRideshares(rows));
});

// GET /rideshares/my — попутки текущего водителя
router.get("/rideshares/my", async (req, res): Promise<void> => {
  const driverId = parseInt(req.query.driverId as string);
  if (isNaN(driverId)) { res.status(400).json({ error: "driverId обязателен" }); return; }
  const rows = await db.select().from(ridesharesTable)
    .where(eq(ridesharesTable.driverId, driverId))
    .orderBy(desc(ridesharesTable.createdAt));
  res.json(await enrichRideshares(rows));
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
  console.log(`[rideshare] postPrice=${postPrice}, yookassaConfigured=${yookassaConfigured}, shopId=${process.env.YOOKASSA_SHOP_ID?.slice(0,4)}***`);

  // Создаём запись в БД
  const [rideshare] = await db.insert(ridesharesTable).values({
    driverId: parseInt(driverId),
    fromCity, toCity, fromAddress, toAddress,
    departureDate, departureTime,
    seatsTotal: parseInt(seatsTotal) || 3,
    price: parseFloat(price),
    description: description || null,
    status: postPrice <= 0 ? "active" : "pending",
    paymentStatus: postPrice <= 0 ? "paid" : "pending",
  }).returning();

  if (!rideshare) { res.status(500).json({ error: "Ошибка создания" }); return; }

  // Если публикация бесплатная — сразу активна
  if (postPrice <= 0) {
    res.status(201).json({ rideshare: await enrichRideshare(rideshare), confirmationUrl: null });
    return;
  }

  // Создаём платёж ЮKassa
  if (!yookassaConfigured) {
    // Dev mode — сразу активируем
    await db.update(ridesharesTable).set({ status: "active", paymentStatus: "paid" })
      .where(eq(ridesharesTable.id, rideshare.id));
    res.status(201).json({ rideshare: await enrichRideshare({ ...rideshare, status: "active" }), confirmationUrl: null });
    return;
  }

  try {
    const paymentBody = {
      amount: { value: postPrice.toFixed(2), currency: "RUB" },
      capture: true,
      confirmation: {
        type: "redirect",
        return_url: returnUrl || `${process.env.APP_URL || "https://taxiimpulse.ru"}/driver`,
      },
      description: `Публикация попутки TAXI IMPULSE — ${fromCity} → ${toCity}`,
      metadata: { rideshareId: String(rideshare.id), type: "rideshare_post" },
    };
    console.log(`[rideshare] Creating payment, amount=${postPrice}, return_url=${paymentBody.confirmation.return_url}`);
    const payment = await yookassaRequest("POST", "/payments", paymentBody);
    console.log(`[rideshare] Payment created: id=${payment.id}, status=${payment.status}, confirmation_url=${payment.confirmation?.confirmation_url}`);

    await db.update(ridesharesTable)
      .set({ paymentId: payment.id })
      .where(eq(ridesharesTable.id, rideshare.id));

    const confirmationUrl = payment.confirmation?.confirmation_url ?? null;
    res.status(201).json({
      rideshare: await enrichRideshare(rideshare),
      confirmationUrl,
      paymentId: payment.id,
    });
  } catch (err: any) {
    console.error(`[rideshare] Payment error:`, err.message);
    await db.delete(ridesharesTable).where(eq(ridesharesTable.id, rideshare.id));
    res.status(502).json({ error: "Ошибка оплаты: " + err.message });
  }
});

// POST /rideshares/:id/pay — получить/обновить ссылку оплаты для попутки
router.post("/rideshares/:id/pay", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Неверный ID" }); return; }

  const [rideshare] = await db.select().from(ridesharesTable).where(eq(ridesharesTable.id, id));
  if (!rideshare) { res.status(404).json({ error: "Попутка не найдена" }); return; }
  if (rideshare.paymentStatus === "paid") { res.json({ alreadyPaid: true }); return; }

  const postPriceStr = await getSetting("rideshare_post_price", "150");
  const postPrice = parseFloat(postPriceStr);
  const yookassaConfigured = !!process.env.YOOKASSA_SHOP_ID && !!process.env.YOOKASSA_SECRET_KEY;

  console.log(`[rideshare/pay] id=${id}, postPrice=${postPrice}, yookassaConfigured=${yookassaConfigured}`);

  if (!yookassaConfigured) {
    await db.update(ridesharesTable).set({ status: "active", paymentStatus: "paid" }).where(eq(ridesharesTable.id, id));
    res.json({ alreadyPaid: true }); return;
  }

  const returnUrl = req.body.returnUrl || `https://taxiimpulse.ru/driver/rideshare?paid=1`;

  try {
    const payment = await yookassaRequest("POST", "/payments", {
      amount: { value: postPrice.toFixed(2), currency: "RUB" },
      capture: true,
      confirmation: { type: "redirect", return_url: returnUrl },
      description: `Публикация попутки TAXI IMPULSE — ${rideshare.fromCity} → ${rideshare.toCity}`,
      metadata: { rideshareId: String(id), type: "rideshare_post" },
    });
    console.log(`[rideshare/pay] payment id=${payment.id}, url=${payment.confirmation?.confirmation_url}`);
    await db.update(ridesharesTable).set({ paymentId: payment.id }).where(eq(ridesharesTable.id, id));
    res.json({ confirmationUrl: payment.confirmation?.confirmation_url ?? null, paymentId: payment.id });
  } catch (err: any) {
    console.error(`[rideshare/pay] error:`, err.message);
    res.status(502).json({ error: "Ошибка оплаты: " + err.message });
  }
});

// PATCH /rideshares/:id — обновить/отменить
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

// GET /rideshares/:id/messages — история сообщений
router.get("/rideshares/:id/messages", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Неверный ID" }); return; }
  const msgs = await db.select().from(rideshareMessagesTable)
    .where(eq(rideshareMessagesTable.rideshareId, id))
    .orderBy(rideshareMessagesTable.createdAt);
  res.json(msgs);
});

// POST /rideshares/:id/messages — отправить сообщение
router.post("/rideshares/:id/messages", async (req, res): Promise<void> => {
  const rideshareId = parseInt(req.params.id);
  if (isNaN(rideshareId)) { res.status(400).json({ error: "Неверный ID" }); return; }
  const { senderId, message } = req.body;
  if (!senderId || !message?.trim()) { res.status(400).json({ error: "senderId и message обязательны" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, parseInt(senderId)));
  if (!user) { res.status(404).json({ error: "Пользователь не найден" }); return; }

  const [msg] = await db.insert(rideshareMessagesTable).values({
    rideshareId,
    senderId: parseInt(senderId),
    senderName: user.name,
    message: message.trim(),
  }).returning();

  res.status(201).json(msg);
});

// POST /rideshares/webhook/yookassa — обработка успешной оплаты
router.post("/rideshares/webhook/yookassa", async (req, res): Promise<void> => {
  try {
    const event = req.body;
    if (event?.event === "payment.succeeded") {
      const paymentId = event.object?.id;
      const meta = event.object?.metadata;
      if (meta?.type === "rideshare_post" && meta?.rideshareId) {
        const id = parseInt(meta.rideshareId);
        await db.update(ridesharesTable)
          .set({ status: "active", paymentStatus: "paid", paymentId })
          .where(eq(ridesharesTable.id, id));
      }
    }
    res.json({ ok: true });
  } catch { res.status(500).json({ ok: false }); }
});

export default router;
