import { Router, type IRouter } from "express";
import { eq, and, desc, gte, sql, inArray } from "drizzle-orm";
import { db, usersTable, driversTable, ordersTable } from "@workspace/db";
import { getUserFromRequest } from "./auth";

const router: IRouter = Router();

// ── Заказы доставки ────────────────────────────────────────────────────────

// Получить заказы доставки (для delivery_admin — только своя компания/город; для admin — все)
router.get("/delivery/orders", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) { res.status(401).json({ error: "Не авторизован" }); return; }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let conditions: any[] = [eq(ordersTable.orderType, "delivery")];

  if (user.role === "delivery_admin") {
    const managedCity = (user as any).managedCity || user.city;
    if (managedCity) conditions.push(eq(ordersTable.city, managedCity));
  } else if (user.role === "city_admin") {
    const managedCity = (user as any).managedCity || user.city;
    if (managedCity) conditions.push(eq(ordersTable.city, managedCity));
  } else if (user.role !== "admin") {
    res.status(403).json({ error: "Нет доступа" }); return;
  }

  const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : today;

  const orders = await db.select().from(ordersTable)
    .where(and(...conditions, gte(ordersTable.createdAt, dateFrom)))
    .orderBy(desc(ordersTable.createdAt))
    .limit(200);

  // Обогащаем данными о пассажиры и водителях
  const passengerIds = [...new Set(orders.map(o => o.passengerId))];
  const driverIds = [...new Set(orders.filter(o => o.driverId).map(o => o.driverId!))];

  const [passengers, driverRows] = await Promise.all([
    passengerIds.length > 0 ? db.select().from(usersTable).where(inArray(usersTable.id, passengerIds)) : Promise.resolve([]),
    driverIds.length > 0 ? db.select().from(driversTable).where(inArray(driversTable.id, driverIds)) : Promise.resolve([]),
  ]);

  const driverUserIds = driverRows.map(d => d.userId);
  const driverUsers = driverUserIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, driverUserIds))
    : [];

  const passengerMap = new Map(passengers.map(u => [u.id, u]));
  const driverMap = new Map(driverRows.map(d => [d.id, d]));
  const driverUserMap = new Map(driverUsers.map(u => [u.id, u]));

  const enriched = orders.map(order => {
    const passenger = passengerMap.get(order.passengerId);
    const driver = order.driverId ? driverMap.get(order.driverId) : null;
    const driverUser = driver ? driverUserMap.get(driver.userId) : null;
    return {
      id: order.id,
      city: order.city,
      fromAddress: order.fromAddress,
      toAddress: order.toAddress,
      status: order.status,
      price: order.price,
      comment: order.comment,
      packageDescription: order.packageDescription,
      orderType: order.orderType,
      partnerCompany: (order as any).partnerCompany || null,
      recipientPhone: (order as any).recipientPhone || null,
      senderPhone: (order as any).senderPhone || null,
      scheduledAt: (order as any).scheduledAt || null,
      createdAt: order.createdAt,
      acceptedAt: order.acceptedAt,
      completedAt: order.completedAt,
      // Заказчик
      passengerId: order.passengerId,
      passengerName: passenger?.name || "Неизвестно",
      passengerPhone: passenger?.phone || "",
      // Водитель
      driverId: order.driverId,
      driverName: driverUser?.name || null,
      driverPhone: driverUser?.phone || null,
      driverCar: driver?.carModel || null,
      driverCarNumber: driver?.carNumber || null,
    };
  });

  res.json(enriched);
});

// Создать заказ доставки
router.post("/delivery/orders", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) { res.status(401).json({ error: "Не авторизован" }); return; }
  if (!["admin", "delivery_admin", "city_admin"].includes(user.role)) {
    res.status(403).json({ error: "Нет доступа" }); return;
  }

  const {
    fromAddress, toAddress, city,
    price, comment, packageDescription,
    recipientPhone, senderPhone, scheduledAt,
    partnerCompany,
  } = req.body || {};

  if (!fromAddress || !toAddress || !city) {
    res.status(400).json({ error: "Заполните обязательные поля: адрес откуда, куда, город" });
    return;
  }

  // Для delivery_admin — берём их город и компанию
  const orderCity = user.role === "delivery_admin" ? ((user as any).managedCity || user.city || city) : city;
  const orderCompany = user.role === "delivery_admin" ? ((user as any).partnerCompany || partnerCompany || null) : (partnerCompany || null);

  const [newOrder] = await db.insert(ordersTable).values({
    passengerId: user.id,
    city: orderCity,
    fromAddress,
    toAddress,
    status: "pending",
    price: price ? parseFloat(price) : null,
    comment: comment || null,
    packageDescription: packageDescription || null,
    orderType: "delivery",
    ...(orderCompany ? { partnerCompany: orderCompany } as any : {}),
    ...(recipientPhone ? { recipientPhone } as any : {}),
    ...(senderPhone ? { senderPhone } as any : {}),
    ...(scheduledAt ? { scheduledAt: new Date(scheduledAt) } as any : {}),
  }).returning();

  // Рассылаем уведомление водителям (если есть push)
  try {
    const { sendPushToDriversInCity } = await import("../push");
    await sendPushToDriversInCity(orderCity, {
      title: orderCompany ? `Заказ от партнёра: ${orderCompany}` : "Новый заказ доставки",
      body: `${fromAddress} → ${toAddress}`,
      data: { orderId: newOrder.id, type: "delivery" },
    });
  } catch { /* push не обязателен */ }

  res.json(newOrder);
});

// Обновить статус заказа доставки
router.patch("/delivery/orders/:id", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) { res.status(401).json({ error: "Не авторизован" }); return; }

  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Неверный ID" }); return; }

  const [order] = await db.select().from(ordersTable).where(
    and(eq(ordersTable.id, id), eq(ordersTable.orderType, "delivery"))
  );
  if (!order) { res.status(404).json({ error: "Заказ не найден" }); return; }

  const allowed = ["status", "price", "comment", "driverId"];
  const updates: any = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  }

  if (updates.status === "completed") {
    updates.completedAt = new Date();
    // Начислить delivery balance водителю
    if (order.driverId && order.price) {
      await db.update(driversTable)
        .set({ deliveryBalance: sql`delivery_balance + ${order.price}` } as any)
        .where(eq(driversTable.id, order.driverId));
    }
  }
  if (updates.status === "accepted" && !order.acceptedAt) {
    updates.acceptedAt = new Date();
  }

  const [updated] = await db.update(ordersTable).set(updates).where(eq(ordersTable.id, id)).returning();
  res.json(updated);
});

// Статистика доставки за сутки
router.get("/delivery/stats", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user || !["admin", "delivery_admin", "city_admin"].includes(user.role)) {
    res.status(403).json({ error: "Нет доступа" }); return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let cityFilter = user.role !== "admin" ? ((user as any).managedCity || user.city) : null;

  const conditions: any[] = [eq(ordersTable.orderType, "delivery"), gte(ordersTable.createdAt, today)];
  if (cityFilter) conditions.push(eq(ordersTable.city, cityFilter));

  const orders = await db.select().from(ordersTable).where(and(...conditions));

  const total = orders.length;
  const completed = orders.filter(o => o.status === "completed").length;
  const cancelled = orders.filter(o => o.status === "cancelled").length;
  const pending = orders.filter(o => o.status === "pending").length;
  const totalRevenue = orders.filter(o => o.status === "completed").reduce((s, o) => s + (o.price || 0), 0);

  res.json({ total, completed, cancelled, pending, totalRevenue });
});

export default router;
