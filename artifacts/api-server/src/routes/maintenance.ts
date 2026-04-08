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
  const allSubs = await db.select({ id: pushSubscriptionsTable.id, userId: pushSubscriptionsTable.userId })
    .from(pushSubscriptionsTable);
  if (allSubs.length === 0) { res.json({ deleted: 0, message: "Push-подписок нет" }); return; }

  const userIds = [...new Set(allSubs.map(s => s.userId))];
  const existingUsers = await db.select({ id: usersTable.id }).from(usersTable)
    .where(inArray(usersTable.id, userIds));
  const existingUserIds = new Set(existingUsers.map(u => u.id));

  const toDelete = allSubs.filter(s => !existingUserIds.has(s.userId)).map(s => s.id);
  if (toDelete.length === 0) { res.json({ deleted: 0, message: "Устаревших подписок не найдено" }); return; }

  await db.delete(pushSubscriptionsTable).where(inArray(pushSubscriptionsTable.id, toDelete));
  res.json({ deleted: toDelete.length, message: `Удалено ${toDelete.length} устаревших push-подписок` });
});

// POST /admin/maintenance/sync-subscriptions — пометить истёкшие подписки
router.post("/admin/maintenance/sync-subscriptions", async (_req, res): Promise<void> => {
  const now = new Date();
  const activeSubs = await db.select().from(driverSubscriptionsTable)
    .where(or(eq(driverSubscriptionsTable.status, "active"), eq(driverSubscriptionsTable.status, "trial")));

  let updated = 0;
  for (const sub of activeSubs) {
    if (new Date(sub.endDate) < now) {
      await db.update(driverSubscriptionsTable)
        .set({ status: "expired" })
        .where(eq(driverSubscriptionsTable.id, sub.id));
      updated++;
    }
  }

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
