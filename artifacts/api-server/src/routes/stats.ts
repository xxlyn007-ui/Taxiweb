import { Router, type IRouter } from "express";
import { sql, count } from "drizzle-orm";
import { db, ordersTable, driversTable, usersTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/stats", async (_req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [ordersStats, driversStats, usersStats] = await Promise.all([
    db.select({
      total: count(),
      ordersToday: sql<number>`COUNT(*) FILTER (WHERE created_at >= ${today})`,
      completed: sql<number>`COUNT(*) FILTER (WHERE status = 'completed')`,
      cancelled: sql<number>`COUNT(*) FILTER (WHERE status = 'cancelled')`,
      pending: sql<number>`COUNT(*) FILTER (WHERE status = 'pending')`,
      revenue: sql<number>`COALESCE(SUM(price) FILTER (WHERE status = 'completed'), 0)`,
      revenueToday: sql<number>`COALESCE(SUM(price) FILTER (WHERE status = 'completed' AND completed_at >= ${today}), 0)`,
      avgRating: sql<number>`COALESCE(AVG(rating) FILTER (WHERE rating IS NOT NULL), 5.0)`,
    }).from(ordersTable),
    db.select({
      total: count(),
      active: sql<number>`COUNT(*) FILTER (WHERE status IN ('online', 'busy'))`,
    }).from(driversTable),
    db.select({
      passengers: sql<number>`COUNT(*) FILTER (WHERE role = 'passenger')`,
    }).from(usersTable),
  ]);

  const o = ordersStats[0];
  const d = driversStats[0];
  const u = usersStats[0];

  res.json({
    totalOrders: o.total,
    ordersToday: Number(o.ordersToday),
    activeDrivers: Number(d.active),
    totalDrivers: d.total,
    totalPassengers: Number(u.passengers),
    revenue: Math.round(Number(o.revenue) * 100) / 100,
    revenueToday: Math.round(Number(o.revenueToday) * 100) / 100,
    completedOrders: Number(o.completed),
    cancelledOrders: Number(o.cancelled),
    pendingOrders: Number(o.pending),
    avgRating: Math.round(Number(o.avgRating) * 10) / 10,
  });
});

router.get("/stats/by-city", async (_req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [ordersByCity, driversByCity] = await Promise.all([
    db.select({
      city: ordersTable.city,
      total: count(),
      today: sql<number>`COUNT(*) FILTER (WHERE created_at >= ${today})`,
    }).from(ordersTable).groupBy(ordersTable.city),

    db.select({
      city: sql<string>`COALESCE(work_city, city)`,
      total: count(),
      online: sql<number>`COUNT(*) FILTER (WHERE status IN ('online', 'busy'))`,
    }).from(driversTable).groupBy(sql`COALESCE(work_city, city)`),
  ]);

  const citySet = new Set<string>([
    ...ordersByCity.map(r => r.city),
    ...driversByCity.map(r => r.city),
  ]);

  const ordersMap = new Map(ordersByCity.map(r => [r.city, r]));
  const driversMap = new Map(driversByCity.map(r => [r.city, r]));

  const result = Array.from(citySet).map(city => {
    const o = ordersMap.get(city);
    const d = driversMap.get(city);
    return {
      city,
      ordersToday: Number(o?.today ?? 0),
      totalOrders: Number(o?.total ?? 0),
      driversOnline: Number(d?.online ?? 0),
      totalDrivers: Number(d?.total ?? 0),
    };
  }).filter(c => c.totalOrders > 0 || c.totalDrivers > 0)
    .sort((a, b) => b.totalOrders - a.totalOrders);

  res.json(result);
});

export default router;
