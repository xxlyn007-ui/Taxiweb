import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { createHash } from "crypto";
import { db, usersTable } from "@workspace/db";
import { getUserFromRequest } from "./auth";

const router: IRouter = Router();

function hashPassword(phone: string, password: string): string {
  return createHash("sha256").update(`${phone}:${password}`).digest("hex");
}

// Получить список всех суб-администраторов (city_admin и delivery_admin)
router.get("/admin/accounts", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "admin") { res.status(403).json({ error: "Нет доступа" }); return; }

  const accounts = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    phone: usersTable.phone,
    role: usersTable.role,
    city: usersTable.city,
    managedCity: (usersTable as any).managedCity,
    partnerCompany: (usersTable as any).partnerCompany,
    isBlocked: usersTable.isBlocked,
    createdAt: usersTable.createdAt,
  }).from(usersTable)
    .where(eq(usersTable.role, "city_admin"));

  const deliveryAccounts = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    phone: usersTable.phone,
    role: usersTable.role,
    city: usersTable.city,
    managedCity: (usersTable as any).managedCity,
    partnerCompany: (usersTable as any).partnerCompany,
    isBlocked: usersTable.isBlocked,
    createdAt: usersTable.createdAt,
  }).from(usersTable)
    .where(eq(usersTable.role, "delivery_admin"));

  res.json([...accounts, ...deliveryAccounts]);
});

// Создать city_admin или delivery_admin аккаунт
router.post("/admin/accounts", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "admin") { res.status(403).json({ error: "Нет доступа" }); return; }

  const { name, phone, password, role, managedCity, partnerCompany } = req.body || {};

  if (!name || !phone || !password || !role) {
    res.status(400).json({ error: "Заполните все обязательные поля" });
    return;
  }

  if (!["city_admin", "delivery_admin"].includes(role)) {
    res.status(400).json({ error: "Недопустимая роль. Допустимы: city_admin, delivery_admin" });
    return;
  }

  if (role === "city_admin" && !managedCity) {
    res.status(400).json({ error: "Для городского администратора укажите город" });
    return;
  }

  if (role === "delivery_admin" && !managedCity) {
    res.status(400).json({ error: "Для администратора доставки укажите город" });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
  if (existing) {
    res.status(409).json({ error: "Пользователь с таким номером уже существует" });
    return;
  }

  const [newUser] = await db.insert(usersTable).values({
    name,
    phone,
    password: hashPassword(phone, password),
    role,
    city: managedCity || null,
    isBlocked: false,
    ...(managedCity ? { managedCity } as any : {}),
    ...(partnerCompany ? { partnerCompany } as any : {}),
  }).returning();

  res.json({
    id: newUser.id,
    name: newUser.name,
    phone: newUser.phone,
    role: newUser.role,
    managedCity: (newUser as any).managedCity || managedCity,
    partnerCompany: (newUser as any).partnerCompany || partnerCompany,
  });
});

// Удалить суб-администратора
router.delete("/admin/accounts/:id", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "admin") { res.status(403).json({ error: "Нет доступа" }); return; }

  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Неверный ID" }); return; }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!target || !["city_admin", "delivery_admin"].includes(target.role)) {
    res.status(404).json({ error: "Аккаунт не найден" });
    return;
  }

  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.json({ ok: true });
});

export default router;
