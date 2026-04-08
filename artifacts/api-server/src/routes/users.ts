import { Router, type IRouter } from "express";
import { eq, ilike, ne } from "drizzle-orm";
import { db, usersTable, driversTable, ordersTable, driverSubscriptionsTable } from "@workspace/db";

const router: IRouter = Router();

function formatUser(user: any) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    city: user.city,
    rating: user.rating,
    totalRides: user.totalRides,
    isBlocked: user.isBlocked ?? false,
    createdAt: user.createdAt instanceof Date ? user.createdAt : (user.createdAt ? new Date(user.createdAt) : undefined),
  };
}

router.get("/users", async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable);
  res.json(users.map(formatUser));
});

router.get("/users/search", async (req, res): Promise<void> => {
  const phone = ((req.query.phone as string) || "").trim();
  if (!phone) { res.status(400).json({ error: "Укажите номер телефона" }); return; }
  const users = await db.select().from(usersTable).where(ilike(usersTable.phone, `%${phone}%`));
  res.json(users.map(formatUser));
});

router.get("/users/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Неверный ID" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "Пользователь не найден" }); return; }
  res.json(formatUser(user));
});

router.patch("/users/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Неверный ID" }); return; }
  const allowed = ["name", "city"];
  const data: any = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) data[k] = req.body[k];
  }
  if (!Object.keys(data).length) { res.status(400).json({ error: "Нет данных для обновления" }); return; }
  const [user] = await db.update(usersTable).set(data).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "Пользователь не найден" }); return; }
  res.json(formatUser(user));
});

router.patch("/users/:id/phone", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Неверный ID" }); return; }
  const phone = (req.body.phone || "").trim();
  if (!phone) { res.status(400).json({ error: "Укажите номер телефона" }); return; }

  const [existing] = await db.select().from(usersTable)
    .where(eq(usersTable.phone, phone));
  if (existing && existing.id !== id) {
    res.status(409).json({ error: "Этот номер уже используется другим пользователем" }); return;
  }

  const [user] = await db.update(usersTable).set({ phone }).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "Пользователь не найден" }); return; }
  res.json(formatUser(user));
});

router.patch("/users/:id/block", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Неверный ID" }); return; }
  const isBlocked = req.body.isBlocked !== false;

  const [user] = await db.update(usersTable).set({ isBlocked }).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "Пользователь не найден" }); return; }

  if (user.role === "driver") {
    await db.update(driversTable).set({ isBlocked, status: isBlocked ? "offline" : "offline" })
      .where(eq(driversTable.userId, id));
  }

  res.json({ ok: true, isBlocked, userId: id });
});

router.delete("/users/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Неверный ID" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "Пользователь не найден" }); return; }

  try {
    await db.update(ordersTable)
      .set({ status: "cancelled" })
      .where(eq(ordersTable.passengerId, id));

    const [driver] = await db.select().from(driversTable).where(eq(driversTable.userId, id));
    if (driver) {
      await db.update(ordersTable)
        .set({ status: "cancelled", driverId: null })
        .where(eq(ordersTable.driverId, driver.id));
      await db.delete(driverSubscriptionsTable).where(eq(driverSubscriptionsTable.driverId, driver.id));
      await db.delete(driversTable).where(eq(driversTable.id, driver.id));
    }

    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.json({ ok: true, deleted: id });
  } catch (e: any) {
    res.status(500).json({ error: "Ошибка удаления: " + e.message });
  }
});

export default router;
