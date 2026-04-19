import { Router, type IRouter } from "express";
import { sql, count, eq } from "drizzle-orm";
import { db, ordersTable, driversTable, usersTable } from "@workspace/db";
import { getUserFromRequest } from "./auth";

const router: IRouter = Router();

router.get("/stats", async (req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const user = await getUserFromRequest(req);
  const managedCity: string | null =
    user?.role === "city_admin" ? ((user as any).managed_city ?? (user as any).managedCity ?? null) : null;

  const [ordersStats, driversStats, usersStats] = await Promise.all([
    db.select({
      total: managedCity
        ? sql<number>`COUNT(*) FILTER (WHERE city = ${managedCity})`
        : count(),
      ordersToday: managedCity
        ? sql<number>`COUNT(*) FILTER (WHERE created_at >= ${today} AND city = ${managedCity})`
        : sql<number>`COUNT(*) FILTER (WHERE created_at >= ${today})`,
      completed: managedCity
        ? sql<number>`COUNT(*) FILTER (WHERE status = 'completed' AND city = ${managedCity})`
        : sql<number>`COUNT(*) FILTER (WHERE status = 'completed')`,
      cancelled: managedCity
        ? sql<number>`COUNT(*) FILTER (WHERE status = 'cancelled' AND city = ${managedCity})`
        : sql<number>`COUNT(*) FILTER (WHERE status = 'cancelled')`,
      pending: managedCity
        ? sql<number>`COUNT(*) FILTER (WHERE status = 'pending' AND city = ${managedCity})`
        : sql<number>`COUNT(*) FILTER (WHERE status = 'pending')`,
      revenue: managedCity
        ? sql<number>`COALESCE(SUM(price) FILTER (WHERE status = 'completed' AND city = ${managedCity}), 0)`
        : sql<number>`COALESCE(SUM(price) FILTER (WHERE status = 'completed'), 0)`,
      revenueToday: managedCity
        ? sql<number>`COALESCE(SUM(price) FILTER (WHERE status = 'completed' AND completed_at >= ${today} AND city = ${managedCity}), 0)`
        : sql<number>`COALESCE(SUM(price) FILTER (WHERE status = 'completed' AND completed_at >= ${today}), 0)`,
      avgRating: sql<number>`COALESCE(AVG(rating) FILTER (WHERE rating IS NOT NULL), 5.0)`,
    }).from(ordersTable),

    db.select({
      total: managedCity
        ? sql<number>`COUNT(*) FILTER (WHERE COALESCE(work_city, city) = ${managedCity})`
        : count(),
      active: managedCity
        ? sql<number>`COUNT(*) FILTER (WHERE status IN ('online', 'busy') AND COALESCE(work_city, city) = ${managedCity})`
        : sql<number>`COUNT(*) FILTER (WHERE status IN ('online', 'busy'))`,
    }).from(driversTable),

    db.select({
      passengers: managedCity
        ? sql<number>`COUNT(*) FILTER (WHERE role = 'passenger' AND city = ${managedCity})`
        : sql<number>`COUNT(*) FILTER (WHERE role = 'passenger')`,
    }).from(usersTable),
  ]);

  const o = ordersStats[0];
  const d = driversStats[0];
  const u = usersStats[0];

  res.json({
    totalOrders: Number(o.total),
    ordersToday: Number(o.ordersToday),
    activeDrivers: Number(d.active),
    totalDrivers: Number(d.total),
    totalPassengers: Number(u.passengers),
    revenue: Math.round(Number(o.revenue) * 100) / 100,
    revenueToday: Math.round(Number(o.revenueToday) * 100) / 100,
    completedOrders: Number(o.completed),
    cancelledOrders: Number(o.cancelled),
    pendingOrders: Number(o.pending),
    avgRating: Math.round(Number(o.avgRating) * 10) / 10,
    city: managedCity,
  });
});

router.get("/stats/by-city", async (req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const user = await getUserFromRequest(req);
  const managedCity: string | null =
    user?.role === "city_admin" ? ((user as any).managed_city ?? (user as any).managedCity ?? null) : null;

  const [ordersByCity, driversByCity] = await Promise.all([
    db.select({
      city: ordersTable.city,
      total: count(),
      today: sql<number>`COUNT(*) FILTER (WHERE created_at >= ${today})`,
    }).from(ordersTable)
      .where(managedCity ? eq(ordersTable.city, managedCity) : undefined)
      .groupBy(ordersTable.city),

    db.select({
      city: sql<string>`COALESCE(work_city, city)`,
      total: count(),
      online: sql<number>`COUNT(*) FILTER (WHERE status IN ('online', 'busy'))`,
    }).from(driversTable)
      .where(managedCity ? sql`COALESCE(work_city, city) = ${managedCity}` : undefined)
      .groupBy(sql`COALESCE(work_city, city)`),
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
