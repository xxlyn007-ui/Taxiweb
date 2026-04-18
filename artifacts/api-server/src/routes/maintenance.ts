import { Router, type IRouter } from "express";
import { eq, lt, and, or, sql, inArray } from "drizzle-orm";
import {
  db, ordersTable, chatMessagesTable, pushSubscriptionsTable,
  driverSubscriptionsTable, supportMessagesTable, usersTable,
  driversTable, ridesharesTable, rideshareMessagesTable,
  driverBonusRequestsTable,
} from "@workspace/db";

const router: IRouter = Router();

// GET /admin/maintenance/stats — статистика таблиц
router.get("/admin/maintenance/stats", async (_req, res): Promise<void> => {
  const [
    usersCount, driversCount, ordersCount, activeOrdersCount,
    ridesharesCount, subsCount, activeSubsCount, pushCount,
    chatCount, supportCount,
  ] = await Promise.all([
    db.select({ c: sql<number>`count(*)::int` }).from(usersTable).then(r => r[0]?.c ?? 0),
    db.select({ c: sql<number>`count(*)::int` }).from(driversTable).then(r => r[0]?.c ?? 0),
    db.select({ c: sql<number>`count(*)::int` }).from(ordersTable).then(r => r[0]?.c ?? 0),
    db.select({ c: sql<number>`count(*)::int` }).from(ordersTable)
      .where(or(eq(ordersTable.status, "pending"), eq(ordersTable.status, "accepted"), eq(ordersTable.status, "in_progress")))
      .then(r => r[0]?.c ?? 0),
    db.select({ c: sql<number>`count(*)::int` }).from(ridesharesTable).then(r => r[0]?.c ?? 0),
    db.select({ c: sql<number>`count(*)::int` }).from(driverSubscriptionsTable).then(r => r[0]?.c ?? 0),
    db.select({ c: sql<number>`count(*)::int` }).from(driverSubscriptionsTable)
      .where(eq(driverSubscriptionsTable.status, "active")).then(r => r[0]?.c ?? 0),
    db.select({ c: sql<number>`count(*)::int` }).from(pushSubscriptionsTable).then(r => r[0]?.c ?? 0),
    db.select({ c: sql<number>`count(*)::int` }).from(chatMessagesTable).then(r => r[0]?.c ?? 0),
    db.select({ c: sql<number>`count(*)::int` }).from(supportMessagesTable).then(r => r[0]?.c ?? 0),
  ]);

  res.json({
    users: usersCount,
    drivers: driversCount,
    orders: { total: ordersCount, active: activeOrdersCount },
    rideshares: ridesharesCount,
    subscriptions: { total: subsCount, active: activeSubsCount },
    pushSubscriptions: pushCount,
    chatMessages: chatCount,
    supportMessages: supportCount,
    uptime: Math.floor(process.uptime()),
    memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
  });
});

// POST /admin/maintenance/cleanup-orders — удалить старые завершённые заказы (>30 дней)
router.post("/admin/maintenance/cleanup-orders", async (req, res): Promise<void> => {
  const days = parseInt(req.body?.days ?? "30");
  const cutoff = new Date(Date.now() - days * 86400_000);

  const oldOrders = await db.select({ id: ordersTable.id }).from(ordersTable)
    .where(and(
      or(eq(ordersTable.status, "completed"), eq(ordersTable.status, "cancelled")),
      lt(ordersTable.createdAt, cutoff),
    ));

  if (oldOrders.length === 0) {
    res.json({ deleted: 0, message: "Нет заказов для очистки" }); return;
  }

  const ids = oldOrders.map(o => o.id);
  await db.delete(chatMessagesTable).where(inArray(chatMessagesTable.orderId, ids));
  await db.delete(ordersTable).where(inArray(ordersTable.id, ids));

  res.json({ deleted: ids.length, message: `Удалено ${ids.length} заказов старше ${days} дней` });
});

// POST /admin/maintenance/cleanup-rideshares — удалить истёкшие попутки
router.post("/admin/maintenance/cleanup-rideshares", async (_req, res): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);
  const old = await db.select({ id: ridesharesTable.id }).from(ridesharesTable)
    .where(
      or(
        eq(ridesharesTable.status, "cancelled"),
        and(eq(ridesharesTable.status, "completed"), lt(ridesharesTable.departureDate, today)),
      )
    );

  if (old.length === 0) { res.json({ deleted: 0, message: "Нет попуток для очистки" }); return; }

  const ids = old.map(r => r.id);
  await db.delete(rideshareMessagesTable).where(inArray(rideshareMessagesTable.rideshareId, ids));
  await db.delete(ridesharesTable).where(inArray(ridesharesTable.id, ids));

  res.json({ deleted: ids.length, message: `Удалено ${ids.length} завершённых попуток` });
});

// POST /admin/maintenance/cleanup-push — удалить push-подписки без пользователей
router.post("/admin/maintenance/cleanup-push", async (_req, res): Promise<void> => {
  // Используем SQL-подзапрос вместо загрузки всех записей в память
  const result = await db.delete(pushSubscriptionsTable).where(
    sql`user_id NOT IN (SELECT id FROM users)`
  ).returning({ id: pushSubscriptionsTable.id });
  const deleted = result.length;
  res.json({ deleted, message: deleted > 0 ? `Удалено ${deleted} устаревших push-подписок` : "Устаревших подписок не найдено" });
});

// POST /admin/maintenance/fix-push-cities — заполнить workCity для водительских подписок с null городом
router.post("/admin/maintenance/fix-push-cities", async (_req, res): Promise<void> => {
  // Находим водительские push-подписки без города
  const broken = await db.select({
    id: pushSubscriptionsTable.id,
    userId: pushSubscriptionsTable.userId,
  }).from(pushSubscriptionsTable)
    .where(and(
      eq(pushSubscriptionsTable.role, "driver"),
      sql`${pushSubscriptionsTable.workCity} IS NULL`,
    ));

  if (broken.length === 0) {
    res.json({ fixed: 0, message: "Все водительские подписки имеют город" });
    return;
  }

  // Для каждого пользователя ищем workCity из профиля водителя
  const userIds = [...new Set(broken.map(s => s.userId))];
  const driverProfiles = await db
    .select({ userId: driversTable.userId, workCity: driversTable.workCity })
    .from(driversTable)
    .where(inArray(driversTable.userId, userIds));

  const cityByUserId = new Map(driverProfiles.map(d => [d.userId, d.workCity]));

  let fixed = 0;
  for (const sub of broken) {
    const city = cityByUserId.get(sub.userId);
    if (city) {
      await db.update(pushSubscriptionsTable)
        .set({ workCity: city })
        .where(eq(pushSubscriptionsTable.id, sub.id));
      fixed++;
    }
  }

  res.json({ fixed, total: broken.length, message: `Восстановлен город для ${fixed} из ${broken.length} подписок` });
});

// POST /admin/maintenance/sync-subscriptions — пометить истёкшие подписки (одним запросом)
router.post("/admin/maintenance/sync-subscriptions", async (_req, res): Promise<void> => {
  const now = new Date();
  // Единый bulk UPDATE вместо N запросов в цикле
  const result = await db.update(driverSubscriptionsTable)
    .set({ status: "expired" })
    .where(and(
      or(eq(driverSubscriptionsTable.status, "active"), eq(driverSubscriptionsTable.status, "trial")),
      lt(driverSubscriptionsTable.endDate, now),
    ))
    .returning({ id: driverSubscriptionsTable.id });
  const updated = result.length;
  res.json({ updated, message: updated > 0 ? `Помечено ${updated} истёкших подписок` : "Все подписки актуальны" });
});

// POST /admin/maintenance/cleanup-support — удалить старые сообщения поддержки (>90 дней)
router.post("/admin/maintenance/cleanup-support", async (req, res): Promise<void> => {
  const days = parseInt(req.body?.days ?? "90");
  const cutoff = new Date(Date.now() - days * 86400_000);
  const result = await db.delete(supportMessagesTable)
    .where(lt(supportMessagesTable.createdAt, cutoff));
  res.json({ message: `Очищены сообщения поддержки старше ${days} дней` });
});

// POST /admin/maintenance/activate-subscription — вручную активировать подписку водителя
router.post("/admin/maintenance/activate-subscription", async (req, res): Promise<void> => {
  const { phone, days = 30 } = req.body;
  if (!phone) { res.status(400).json({ error: "Укажите phone" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
  if (!user) { res.status(404).json({ error: "Пользователь не найден" }); return; }

  const [driver] = await db.select().from(driversTable).where(eq(driversTable.userId, user.id));
  if (!driver) { res.status(404).json({ error: "Профиль водителя не найден" }); return; }

  const now = new Date();
  const endDate = new Date(now.getTime() + parseInt(days) * 86400_000);

  const [existing] = await db.select().from(driverSubscriptionsTable)
    .where(eq(driverSubscriptionsTable.driverId, driver.id))
    .orderBy(sql`created_at DESC`).limit(1);

  if (existing) {
    await db.update(driverSubscriptionsTable)
      .set({ status: "active", startDate: now, endDate, amount: 0 })
      .where(eq(driverSubscriptionsTable.id, existing.id));
  } else {
    await db.insert(driverSubscriptionsTable).values({
      driverId: driver.id, status: "active", startDate: now, endDate, amount: 0,
    });
  }

  res.json({ ok: true, driverName: user.name, phone, endDate, days });
});

// POST /admin/maintenance/expire-subscription — сделать подписку водителя истекающей (для тестов)
router.post("/admin/maintenance/expire-subscription", async (req, res): Promise<void> => {
  const { phone, hoursLeft = 2 } = req.body;
  if (!phone) { res.status(400).json({ error: "Укажите phone" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.phone, phone.trim()));
  if (!user) { res.status(404).json({ error: "Пользователь не найден" }); return; }

  const [driver] = await db.select().from(driversTable).where(eq(driversTable.userId, user.id));
  if (!driver) { res.status(404).json({ error: "Профиль водителя не найден" }); return; }

  const endDate = new Date(Date.now() + parseInt(hoursLeft) * 3600_000);

  const [existing] = await db.select().from(driverSubscriptionsTable)
    .where(eq(driverSubscriptionsTable.driverId, driver.id))
    .orderBy(sql`created_at DESC`).limit(1);

  if (existing) {
    await db.update(driverSubscriptionsTable)
      .set({ status: "active", endDate })
      .where(eq(driverSubscriptionsTable.id, existing.id));
  } else {
    await db.insert(driverSubscriptionsTable).values({
      driverId: driver.id, status: "active",
      startDate: new Date(Date.now() - 28 * 86400_000), endDate, amount: 0,
    });
  }

  res.json({ ok: true, driverName: user.name, phone, endDate, hoursLeft, message: `Подписка истекает через ${hoursLeft}ч` });
});

// POST /admin/maintenance/add-bonus — начислить бонус пользователю вручную
router.post("/admin/maintenance/add-bonus", async (req, res): Promise<void> => {
  const { phone, amount } = req.body || {};
  if (!phone || !amount || isNaN(parseFloat(amount))) {
    res.status(400).json({ error: "Укажите телефон и сумму" }); return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.phone, phone.trim()));
  if (!user) { res.status(404).json({ error: "Пользователь не найден" }); return; }
  const bonus = parseFloat(amount);
  await db.execute(sql`UPDATE users SET bonus_balance = bonus_balance + ${bonus} WHERE id = ${user.id}`);
  const [updated] = await db.select({ bonusBalance: usersTable.bonusBalance }).from(usersTable).where(eq(usersTable.id, user.id));
  res.json({ ok: true, userName: user.name, phone: user.phone, newBalance: updated?.bonusBalance ?? 0 });
});

// POST /admin/maintenance/reset-bonus — обнулить бонус пользователя
router.post("/admin/maintenance/reset-bonus", async (req, res): Promise<void> => {
  const { phone } = req.body || {};
  if (!phone) { res.status(400).json({ error: "Укажите телефон" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.phone, phone.trim()));
  if (!user) { res.status(404).json({ error: "Пользователь не найден" }); return; }
  await db.update(usersTable).set({ bonusBalance: 0 }).where(eq(usersTable.id, user.id));
  res.json({ ok: true, userName: user.name });
});

export default router;
