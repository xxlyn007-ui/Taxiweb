import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, driversTable } from "@workspace/db";

const router: IRouter = Router();

function hashPassword(password: string): string {
  let hash = 5381;
  for (let i = 0; i < password.length; i++) {
    hash = ((hash << 5) + hash) + password.charCodeAt(i);
    hash = hash & hash;
  }
  return hash.toString(16);
}

function generateToken(userId: number, role: string): string {
  return Buffer.from(JSON.stringify({ userId, role, ts: Date.now() })).toString("base64");
}

function parseToken(token: string): { userId: number; role: string } | null {
  try {
    return JSON.parse(Buffer.from(token, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

export async function getUserFromRequest(req: any): Promise<any | null> {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const payload = parseToken(token);
  if (!payload) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
  return user || null;
}

function formatUser(user: any) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    city: user.city,
    rating: user.rating,
    totalRides: user.totalRides,
    createdAt: user.createdAt instanceof Date ? user.createdAt : (user.createdAt ? new Date(user.createdAt) : new Date()),
  };
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const { phone, password } = req.body || {};
  if (!phone || !password) {
    res.status(400).json({ error: "Введите телефон и пароль" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));

  if (!user) {
    res.status(401).json({ error: "Пользователь не найден" });
    return;
  }

  if (user.password !== hashPassword(password) && user.password !== password) {
    res.status(401).json({ error: "Неверный пароль" });
    return;
  }

  if ((user as any).isBlocked) {
    res.status(403).json({ error: "Ваш аккаунт заблокирован. Обратитесь в поддержку." });
    return;
  }

  if (user.role === "driver") {
    const [driver] = await db.select().from(driversTable).where(eq(driversTable.userId, user.id));
    if (driver?.isBlocked) {
      res.status(403).json({ error: "Ваш аккаунт заблокирован" });
      return;
    }
    if (driver && !driver.isApproved) {
      res.status(403).json({ error: "Ваша заявка на рассмотрении у администратора" });
      return;
    }
  }

  const token = generateToken(user.id, user.role);
  res.json({ token, user: formatUser(user) });
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const { name, phone, password, city } = req.body || {};
  if (!name || !phone || !password) {
    res.status(400).json({ error: "Заполните все поля" });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
  if (existing) {
    res.status(409).json({ error: "Пользователь с таким номером уже существует" });
    return;
  }

  const [user] = await db.insert(usersTable).values({
    name,
    phone,
    password: hashPassword(password),
    role: "passenger",
    city: city || null,
  }).returning();

  const token = generateToken(user.id, user.role);
  res.json({ token, user: formatUser(user) });
});

// Driver registration — sends to admin for review
router.post("/auth/register-driver", async (req, res): Promise<void> => {
  const { name, phone, password, city, workCity, carModel, carColor, carNumber, licenseNumber, experience } = req.body || {};
  if (!name || !phone || !password || !carModel || !carNumber) {
    res.status(400).json({ error: "Заполните все обязательные поля" });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
  if (existing) {
    res.status(409).json({ error: "Пользователь с таким номером уже существует" });
    return;
  }

  const [user] = await db.insert(usersTable).values({
    name,
    phone,
    password: hashPassword(password),
    role: "driver",
    city: city || null,
  }).returning();

  await db.insert(driversTable).values({
    userId: user.id,
    carModel,
    carColor: carColor || null,
    carNumber,
    city: city || workCity || "Красноярск",
    workCity: workCity || city || "Красноярск",
    status: "offline",
    licenseNumber: licenseNumber || null,
    experience: experience ? parseInt(experience) : null,
    isApproved: false,
    isBlocked: false,
  });

  res.json({ message: "Заявка отправлена. Ожидайте подтверждения администратора.", userId: user.id });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Не авторизован" });
    return;
  }
  res.json(formatUser(user));
});

export default router;
