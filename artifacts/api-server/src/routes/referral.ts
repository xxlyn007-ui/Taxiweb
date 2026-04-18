import { Router, type IRouter } from "express";
import { eq, sql, desc, and } from "drizzle-orm";
import { db, usersTable, driversTable, driverBonusRequestsTable, settingsTable } from "@workspace/db";
import { getUserFromRequest } from "./auth";

const router: IRouter = Router();

function generateReferralCode(userId: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  let seed = userId * 2654435761 + Date.now();
  for (let i = 0; i < 7; i++) {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    code += chars[Math.abs(seed) % chars.length];
  }
  return code;
}

async function getSetting(key: string, fallback: string): Promise<string> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  return row?.value ?? fallback;
}

// GET /api/referral/my — реферальная информация пассажира
router.get("/referral/my", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) { res.status(401).json({ error: "Не авторизован" }); return; }

  // Генерируем код если его нет
  if (!user.referralCode) {
    let code = generateReferralCode(user.id);
    let tries = 0;
    while (tries < 5) {
      const [existing] = await db.select({ id: usersTable.id }).from(usersTable)
        .where(eq(usersTable.referralCode, code));
      if (!existing) break;
      code = generateReferralCode(user.id + tries * 999);
      tries++;
    }
    await db.update(usersTable).set({ referralCode: code }).where(eq(usersTable.id, user.id));
    user.referralCode = code;
  }

  // Считаем приглашённых
  const [{ count: invitedCount }] = await db.select({ count: sql<number>`count(*)::int` })
    .from(usersTable).where(eq(usersTable.referredBy, user.id));

  const bonusPerReferral = parseFloat(await getSetting("referral_bonus", "100"));
  const cashbackPercent = parseFloat(await getSetting("cashback_percent", "3"));

  res.json({
    referralCode: user.referralCode,
    bonusBalance: user.bonusBalance ?? 0,
    invitedCount,
    bonusPerReferral,
    cashbackPercent,
  });
});

// POST /api/referral/ensure-code — генерировать код если нет (вызывается при регистрации)
router.post("/referral/ensure-code", async (req, res): Promise<void> => {
  const { userId } = req.body || {};
  if (!userId) { res.status(400).json({ error: "userId обязателен" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, parseInt(userId)));
  if (!user || user.referralCode) { res.json({ code: user?.referralCode }); return; }

  let code = generateReferralCode(user.id);
  let tries = 0;
  while (tries < 5) {
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable)
      .where(eq(usersTable.referralCode, code));
    if (!existing) break;
    code = generateReferralCode(user.id + tries * 999);
    tries++;
  }
  await db.update(usersTable).set({ referralCode: code }).where(eq(usersTable.id, user.id));
  res.json({ code });
});

// === DRIVER BONUS ROUTES ===

// GET /api/driver-bonus/:driverId — баланс и заявки водителя
router.get("/driver-bonus/:driverId", async (req, res): Promise<void> => {
  const driverId = parseInt(req.params.driverId);
  if (isNaN(driverId)) { res.status(400).json({ error: "Неверный driverId" }); return; }

  const [driver] = await db.select({ bonusBalance: driversTable.bonusBalance })
    .from(driversTable).where(eq(driversTable.id, driverId));
  if (!driver) { res.status(404).json({ error: "Водитель не найден" }); return; }

  const requests = await db.select().from(driverBonusRequestsTable)
    .where(eq(driverBonusRequestsTable.driverId, driverId))
    .orderBy(desc(driverBonusRequestsTable.createdAt));

  res.json({ bonusBalance: driver.bonusBalance ?? 0, requests });
});

// POST /api/driver-bonus/:driverId/request — заявка на вывод бонусов
router.post("/driver-bonus/:driverId/request", async (req, res): Promise<void> => {
  const driverId = parseInt(req.params.driverId);
  if (isNaN(driverId)) { res.status(400).json({ error: "Неверный driverId" }); return; }

  const { cardOrPhone, bank } = req.body || {};
  if (!cardOrPhone || !bank) {
    res.status(400).json({ error: "Введите реквизиты и банк" }); return;
  }

  const [driver] = await db.select({ bonusBalance: driversTable.bonusBalance })
    .from(driversTable).where(eq(driversTable.id, driverId));
  if (!driver) { res.status(404).json({ error: "Водитель не найден" }); return; }
  if ((driver.bonusBalance ?? 0) <= 0) {
    res.status(400).json({ error: "Нет бонусов для вывода" }); return;
  }

  // Проверяем нет ли уже ожидающей заявки
  const [existing] = await db.select({ id: driverBonusRequestsTable.id })
    .from(driverBonusRequestsTable)
    .where(and(
      eq(driverBonusRequestsTable.driverId, driverId),
      eq(driverBonusRequestsTable.status, "pending"),
    ));
  if (existing) {
    res.status(409).json({ error: "У вас уже есть активная заявка на вывод" }); return;
  }

  const [request] = await db.insert(driverBonusRequestsTable).values({
    driverId,
    amount: driver.bonusBalance ?? 0,
    cardOrPhone: cardOrPhone.trim(),
    bank: bank.trim(),
    status: "pending",
  }).returning();

  res.json({ ok: true, request });
});

// === ADMIN BONUS REQUESTS ===

// GET /api/admin/bonus-requests — все заявки на вывод
router.get("/admin/bonus-requests", async (_req, res): Promise<void> => {
  const requests = await db.select().from(driverBonusRequestsTable)
    .orderBy(desc(driverBonusRequestsTable.createdAt));

  const driverIds = [...new Set(requests.map(r => r.driverId))];
  const drivers = driverIds.length > 0
    ? await db.select({ id: driversTable.id, userId: driversTable.userId, city: driversTable.city })
        .from(driversTable).where(sql`${driversTable.id} = ANY(ARRAY[${sql.join(driverIds.map(id => sql`${id}`), sql`, `)}]::int[])`)
    : [];
  const userIds = [...new Set(drivers.map(d => d.userId))];
  const users = userIds.length > 0
    ? await db.select({ id: usersTable.id, name: usersTable.name, phone: usersTable.phone })
        .from(usersTable).where(sql`${usersTable.id} = ANY(ARRAY[${sql.join(userIds.map(id => sql`${id}`), sql`, `)}]::int[])`)
    : [];
  const driverMap = new Map(drivers.map(d => [d.id, d]));
  const userMap = new Map(users.map(u => [u.id, u]));

  const enriched = requests.map(r => {
    const driver = driverMap.get(r.driverId);
    const user = driver ? userMap.get(driver.userId) : undefined;
    return { ...r, driverName: user?.name ?? "—", driverPhone: user?.phone ?? "—", driverCity: driver?.city ?? "—" };
  });

  res.json(enriched);
});

// POST /api/admin/bonus-requests/:id/reject — отклонить заявку
router.post("/admin/bonus-requests/:id/reject", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Неверный id" }); return; }
  const [request] = await db.select().from(driverBonusRequestsTable).where(eq(driverBonusRequestsTable.id, id));
  if (!request) { res.status(404).json({ error: "Заявка не найдена" }); return; }
  if (request.status !== "pending") { res.status(409).json({ error: "Заявка уже обработана" }); return; }
  await db.update(driverBonusRequestsTable).set({ status: "rejected" }).where(eq(driverBonusRequestsTable.id, id));
  res.json({ ok: true });
});

// POST /api/admin/bonus-requests/:id/pay — отметить заявку оплаченной
router.post("/admin/bonus-requests/:id/pay", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Неверный id" }); return; }

  const [request] = await db.select().from(driverBonusRequestsTable)
    .where(eq(driverBonusRequestsTable.id, id));
  if (!request) { res.status(404).json({ error: "Заявка не найдена" }); return; }
  if (request.status !== "pending") {
    res.status(409).json({ error: "Заявка уже обработана" }); return;
  }

  // Списываем бонусы у водителя
  const [driver] = await db.select({ bonusBalance: driversTable.bonusBalance })
    .from(driversTable).where(eq(driversTable.id, request.driverId));
  const newBalance = Math.max(0, (driver?.bonusBalance ?? 0) - request.amount);

  await db.update(driversTable)
    .set({ bonusBalance: newBalance })
    .where(eq(driversTable.id, request.driverId));

  await db.update(driverBonusRequestsTable)
    .set({ status: "paid", paidAt: new Date() })
    .where(eq(driverBonusRequestsTable.id, id));

  res.json({ ok: true, newBalance });
});

// GET /api/admin/subscriptions/by-city — подписки по городам
router.get("/admin/subscriptions/by-city", async (_req, res): Promise<void> => {
  const rows = await db.execute(sql`
    SELECT
      d.city,
      COUNT(DISTINCT ds.driver_id) FILTER (WHERE ds.status = 'active') AS active_paid,
      COUNT(DISTINCT ds.driver_id) FILTER (WHERE ds.status = 'trial') AS on_trial,
      COUNT(DISTINCT ds.driver_id) FILTER (WHERE ds.status = 'expired') AS expired,
      COUNT(DISTINCT d.id) FILTER (WHERE d.is_approved = true AND d.is_blocked = false) AS total_drivers
    FROM drivers d
    LEFT JOIN driver_subscriptions ds ON ds.driver_id = d.id
      AND ds.end_date > NOW()
    WHERE d.is_approved = true
    GROUP BY d.city
    ORDER BY active_paid DESC, d.city
  `);
  res.json(rows.rows);
});

export default router;
