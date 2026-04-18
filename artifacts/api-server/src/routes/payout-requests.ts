import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, driversTable, usersTable } from "@workspace/db";
import { payoutRequestsTable } from "@workspace/db";
import { getUserFromRequest } from "./auth";

const router: IRouter = Router();

// Получить запросы на выплату
router.get("/payout-requests", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) { res.status(401).json({ error: "Не авторизован" }); return; }

  let requests: any[] = [];

  if (user.role === "driver") {
    // Водитель видит только свои запросы
    const [driver] = await db.select().from(driversTable).where(eq(driversTable.userId, user.id));
    if (!driver) { res.json([]); return; }
    requests = await db.select().from(payoutRequestsTable)
      .where(eq(payoutRequestsTable.driverId, driver.id))
      .orderBy(desc(payoutRequestsTable.createdAt))
      .limit(50);
  } else if (["admin", "delivery_admin", "city_admin"].includes(user.role)) {
    requests = await db.select().from(payoutRequestsTable)
      .orderBy(desc(payoutRequestsTable.createdAt))
      .limit(200);
  } else {
    res.status(403).json({ error: "Нет доступа" }); return;
  }

  // Обогащаем данными о водителях
  const driverIds = [...new Set(requests.map(r => r.driverId))];
  const drivers = driverIds.length > 0
    ? await db.select().from(driversTable).where(
        sql`${driversTable.id} = ANY(${driverIds}::int[])`
      ).catch(() => [] as any[])
    : [];

  const driverUserIds = drivers.map((d: any) => d.userId);
  const driverUsers = driverUserIds.length > 0
    ? await db.select().from(usersTable).where(
        sql`${usersTable.id} = ANY(${driverUserIds}::int[])`
      ).catch(() => [] as any[])
    : [];

  const driverMap = new Map((drivers as any[]).map((d: any) => [d.id, d]));
  const userMap = new Map((driverUsers as any[]).map((u: any) => [u.id, u]));

  const enriched = requests.map((r: any) => {
    const driver = driverMap.get(r.driverId) as any;
    const driverUser = driver ? userMap.get(driver.userId) as any : null;
    return {
      ...r,
      driverName: driverUser?.name || "Неизвестно",
      driverPhone: driverUser?.phone || "",
      driverCar: driver?.carModel || "",
      driverCarNumber: driver?.carNumber || "",
      driverDeliveryBalance: driver?.deliveryBalance || 0,
    };
  });

  res.json(enriched);
});

// Создать запрос на выплату (только водитель)
router.post("/payout-requests", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "driver") { res.status(403).json({ error: "Только для водителей" }); return; }

  const [driver] = await db.select().from(driversTable).where(eq(driversTable.userId, user.id));
  if (!driver) { res.status(404).json({ error: "Профиль водителя не найден" }); return; }

  const deliveryBalance = (driver as any).deliveryBalance || 0;
  if (deliveryBalance <= 0) {
    res.status(400).json({ error: "Баланс доставки пуст" });
    return;
  }

  const { paymentDetails } = req.body || {};
  if (!paymentDetails) {
    res.status(400).json({ error: "Укажите номер карты или телефона для выплаты" });
    return;
  }

  // Проверяем нет ли уже pending запроса
  const [existing] = await db.select().from(payoutRequestsTable)
    .where(and(eq(payoutRequestsTable.driverId, driver.id), eq(payoutRequestsTable.status, "pending")));
  if (existing) {
    res.status(409).json({ error: "У вас уже есть активный запрос на выплату" });
    return;
  }

  const [request] = await db.insert(payoutRequestsTable).values({
    driverId: driver.id,
    amount: deliveryBalance,
    paymentDetails,
    status: "pending",
  }).returning();

  res.json(request);
});

// Одобрить или отклонить выплату (admin/delivery_admin)
router.patch("/payout-requests/:id", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user || !["admin", "delivery_admin"].includes(user.role)) {
    res.status(403).json({ error: "Нет доступа" }); return;
  }

  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Неверный ID" }); return; }

  const [request] = await db.select().from(payoutRequestsTable).where(eq(payoutRequestsTable.id, id));
  if (!request) { res.status(404).json({ error: "Запрос не найден" }); return; }
  if (request.status !== "pending") { res.status(400).json({ error: "Запрос уже обработан" }); return; }

  const { status, adminNote } = req.body || {};
  if (!["approved", "rejected"].includes(status)) {
    res.status(400).json({ error: "Укажите status: approved или rejected" });
    return;
  }

  const updates: any = {
    status,
    adminNote: adminNote || null,
    processedBy: user.id,
    processedAt: new Date(),
  };

  const [updated] = await db.update(payoutRequestsTable).set(updates).where(eq(payoutRequestsTable.id, id)).returning();

  // При одобрении — обнуляем баланс доставки водителя
  if (status === "approved") {
    await db.update(driversTable)
      .set({ deliveryBalance: 0 } as any)
      .where(eq(driversTable.id, request.driverId));
  }

  res.json(updated);
});

export default router;
