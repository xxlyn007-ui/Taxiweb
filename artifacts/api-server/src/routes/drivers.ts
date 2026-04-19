import { Router, type IRouter } from "express";
import { eq, sql, and, inArray, or, isNull } from "drizzle-orm";
import { db, driversTable, usersTable, tariffsTable } from "@workspace/db";
import { checkDriverSubscription } from "./subscriptions";
import { getUserFromRequest } from "./auth";

const router: IRouter = Router();

function toDate(val: any): Date | undefined {
  if (!val) return undefined;
  if (val instanceof Date) return val;
  return new Date(val);
}

function parseTariffIds(raw: string | null | undefined): number[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

async function batchEnrichDrivers(drivers: (typeof driversTable.$inferSelect)[]) {
  if (drivers.length === 0) return [];

  const userIds = [...new Set(drivers.map(d => d.userId))];
  const tariffIds = [...new Set(drivers.filter(d => d.tariffId != null).map(d => d.tariffId!))];

  const [users, tariffs] = await Promise.all([
    db.select().from(usersTable).where(inArray(usersTable.id, userIds)),
    tariffIds.length > 0 ? db.select().from(tariffsTable).where(inArray(tariffsTable.id, tariffIds)) : Promise.resolve([]),
  ]);

  const userMap = new Map(users.map(u => [u.id, u]));
  const tariffMap = new Map(tariffs.map(t => [t.id, t]));

  return drivers.map(driver => {
    const user = userMap.get(driver.userId);
    const tariff = driver.tariffId != null ? tariffMap.get(driver.tariffId) : null;
    return {
      id: driver.id,
      userId: driver.userId,
      name: user?.name || "Неизвестно",
      phone: user?.phone || "",
      city: driver.city,
      workCity: driver.workCity,
      carModel: driver.carModel,
      carColor: driver.carColor,
      carNumber: driver.carNumber,
      licenseNumber: driver.licenseNumber,
      experience: driver.experience,
      status: driver.status,
      rating: driver.rating,
      totalRides: driver.totalRides,
      balance: driver.balance,
      tariffId: driver.tariffId,
      tariffName: tariff?.name || null,
      isApproved: driver.isApproved,
      isBlocked: driver.isBlocked,
      autoAssign: driver.autoAssign,
      rejectionReason: driver.rejectionReason,
      approvedTariffIds: parseTariffIds(driver.approvedTariffIds),
      activeTariffIds: parseTariffIds(driver.activeTariffIds),
      orderMode: (driver as any).orderMode ?? "all",
      driverLat: driver.driverLat ?? null,
      driverLon: driver.driverLon ?? null,
      locationUpdatedAt: toDate(driver.locationUpdatedAt) ?? null,
      createdAt: toDate(driver.createdAt),
    };
  });
}

async function enrichDriver(driver: typeof driversTable.$inferSelect) {
  const [result] = await batchEnrichDrivers([driver]);
  return result;
}

router.get("/drivers", async (req, res): Promise<void> => {
  // Принудительная фильтрация для city_admin через сессию
  const sessionUser = await getUserFromRequest(req);
  const isCityAdmin = sessionUser?.role === "city_admin";
  const adminCity: string | null = isCityAdmin
    ? ((sessionUser as any).managed_city ?? (sessionUser as any).managedCity ?? null)
    : null;
  const adminCompany: string | null = isCityAdmin
    ? ((sessionUser as any).partner_company ?? (sessionUser as any).partnerCompany ?? null)
    : null;

  const { status, isApproved, pendingApproval } = req.query as any;
  const city = adminCity ?? (typeof req.query.city === "string" ? req.query.city : undefined);

  const conditions = [];
  if (status) conditions.push(eq(driversTable.status, status));
  if (isApproved !== undefined) conditions.push(eq(driversTable.isApproved, isApproved === 'true'));

  let drivers = await db.select().from(driversTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  if (city) {
    drivers = drivers.filter(d => (d.workCity || d.city) === city);
  }

  // Если у city_admin указана фирма — показываем только водителей этой фирмы
  if (adminCompany) {
    drivers = drivers.filter(d => d.partnerCompany === adminCompany);
  }

  if (pendingApproval === 'true') {
    drivers = drivers.filter(d => !d.isApproved && !d.isBlocked && !d.rejectionReason);
  }

  const enriched = await batchEnrichDrivers(drivers);
  res.json(enriched);
});

router.post("/drivers", async (req, res): Promise<void> => {
  const { userId, carModel, carColor, carNumber, city, workCity, tariffId, licenseNumber, experience } = req.body;
  if (!userId || !carModel || !carNumber || !city) {
    res.status(400).json({ error: "Неверные данные" });
    return;
  }
  const [driver] = await db.insert(driversTable).values({
    userId, carModel, carColor, carNumber, city, workCity: workCity || city, tariffId, licenseNumber, experience
  }).returning();
  const enriched = await enrichDriver(driver);
  res.status(201).json(enriched);
});

router.get("/drivers/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Неверный ID" }); return; }
  const [driver] = await db.select().from(driversTable).where(eq(driversTable.id, id));
  if (!driver) { res.status(404).json({ error: "Водитель не найден" }); return; }
  const enriched = await enrichDriver(driver);
  res.json(enriched);
});

router.patch("/drivers/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Неверный ID" }); return; }
  const allowed = [
    'carModel', 'carColor', 'carNumber', 'city', 'workCity', 'tariffId',
    'isApproved', 'isBlocked', 'autoAssign', 'balance', 'licenseNumber',
    'experience', 'rejectionReason', 'approvedTariffIds', 'activeTariffIds',
  ];
  const updateData: any = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      if (key === 'approvedTariffIds' || key === 'activeTariffIds') {
        updateData[key] = Array.isArray(req.body[key])
          ? JSON.stringify(req.body[key])
          : req.body[key];
      } else {
        updateData[key] = req.body[key];
      }
    }
  }
  // Handle orderMode via raw SQL (Drizzle schema type may not include it yet)
  if (req.body.orderMode !== undefined) {
    const validModes = ["taxi", "delivery", "all"];
    const mode = validModes.includes(req.body.orderMode) ? req.body.orderMode : "all";
    await db.execute(sql`UPDATE drivers SET order_mode = ${mode} WHERE id = ${id}`);
    if (Object.keys(updateData).length === 0) {
      const [fetchedDriver] = await db.select().from(driversTable).where(eq(driversTable.id, id));
      if (!fetchedDriver) { res.status(404).json({ error: "Водитель не найден" }); return; }
      const enriched = await enrichDriver(fetchedDriver);
      res.json(enriched);
      return;
    }
  }

  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: "Нет полей для обновления" }); return;
  }
  const [driver] = await db.update(driversTable).set(updateData).where(eq(driversTable.id, id)).returning();
  if (!driver) { res.status(404).json({ error: "Водитель не найден" }); return; }
  const enriched = await enrichDriver(driver);
  res.json(enriched);
});

router.patch("/drivers/:id/status", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Неверный ID" }); return; }
  const { status } = req.body;
  if (!['online', 'offline', 'busy'].includes(status)) {
    res.status(400).json({ error: "Неверный статус" });
    return;
  }
  if (status === 'online') {
    const allowed = await checkDriverSubscription(id);
    if (!allowed) {
      res.status(403).json({ error: "subscription_required", message: "Для выхода на линию необходима активная подписка" });
      return;
    }
  }
  const [driver] = await db.update(driversTable).set({ status }).where(eq(driversTable.id, id)).returning();
  if (!driver) { res.status(404).json({ error: "Водитель не найден" }); return; }
  const enriched = await enrichDriver(driver);
  res.json(enriched);
});

router.patch("/drivers/:id/location", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Неверный ID" }); return; }
  const { lat, lon } = req.body;
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    res.status(400).json({ error: "Неверные координаты" });
    return;
  }
  const [driver] = await db.update(driversTable)
    .set({ driverLat: lat, driverLon: lon, locationUpdatedAt: new Date() })
    .where(eq(driversTable.id, id))
    .returning();
  if (!driver) { res.status(404).json({ error: "Водитель не найден" }); return; }
  res.json({ ok: true });
});

router.patch("/drivers/:id/block", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Неверный ID" }); return; }
  const { isBlocked } = req.body;
  const [driver] = await db.update(driversTable).set({ isBlocked: !!isBlocked, status: 'offline' }).where(eq(driversTable.id, id)).returning();
  if (!driver) { res.status(404).json({ error: "Водитель не найден" }); return; }
  const enriched = await enrichDriver(driver);
  res.json(enriched);
});

router.patch("/drivers/:id/approve", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Неверный ID" }); return; }
  const { isApproved, rejectionReason } = req.body;
  const updateData: any = { isApproved: !!isApproved };
  if (rejectionReason) updateData.rejectionReason = rejectionReason;
  const [driver] = await db.update(driversTable).set(updateData).where(eq(driversTable.id, id)).returning();
  if (!driver) { res.status(404).json({ error: "Водитель не найден" }); return; }
  const enriched = await enrichDriver(driver);
  res.json(enriched);
});

export default router;
