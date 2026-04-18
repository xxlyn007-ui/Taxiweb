import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { createHmac, createHash } from "crypto";
import { db, usersTable, driversTable, settingsTable } from "@workspace/db";

async function getSetting(key: string, fallback: string): Promise<string> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  return row?.value ?? fallback;
}

function generateReferralCode(userId: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  // Use SHA-256 based approach to avoid integer overflow collisions
  const hash = createHash("sha256").update(String(userId) + "taxi-impulse-salt-2024").digest("hex");
  let code = "";
  for (let i = 0; i < 6; i++) {
    const byte = parseInt(hash.slice(i * 2, i * 2 + 2), 16);
    code += chars[byte % chars.length];
  }
  return code;
}

const router: IRouter = Router();

// ── Пароли ────────────────────────────────────────────────────────────────────
// Новый хэш: SHA-256(phone + ":" + password) — уникальная соль на пользователя
function hashPasswordNew(phone: string, password: string): string {
  return createHash("sha256").update(`${phone}:${password}`).digest("hex");
}
// Старый хэш djb2 — оставляем только для проверки при логине (backward compat)
function hashPasswordLegacy(password: string): string {
  let hash = 5381;
  for (let i = 0; i < password.length; i++) {
    hash = ((hash << 5) + hash) + password.charCodeAt(i);
    hash = hash & hash;
  }
  return hash.toString(16);
}
// Для новых пользователей и смены пароля — всегда SHA-256
function hashPassword(phone: string, password: string): string {
  return hashPasswordNew(phone, password);
}

// ── Токены ────────────────────────────────────────────────────────────────────
// Формат: base64url(payload).base64url(hmac-sha256)
// SESSION_SECRET из .env обязателен — без него токены небезопасны
const TOKEN_SECRET = process.env.SESSION_SECRET;
if (!TOKEN_SECRET) {
  console.error("[auth] ВНИМАНИЕ: SESSION_SECRET не задан! Токены небезопасны.");
}
const SECRET = TOKEN_SECRET || "fallback-insecure-secret";

function generateToken(userId: number, role: string): string {
  const payload = Buffer.from(JSON.stringify({ userId, role, ts: Date.now() })).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function parseToken(token: string): { userId: number; role: string } | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = createHmac("sha256", SECRET).update(payload).digest("base64url");
    if (sig !== expected) return null;
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
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

  // Проверяем: новый хэш SHA-256, потом legacy djb2, потом открытый текст (старые данные)
  const newHash = hashPasswordNew(phone, password);
  const legacyHash = hashPasswordLegacy(password);
  const passwordOk = user.password === newHash || user.password === legacyHash || user.password === password;

  if (!passwordOk) {
    res.status(401).json({ error: "Неверный пароль" });
    return;
  }

  // Автоматически апгрейдим хэш при входе (silent upgrade)
  if (user.password !== newHash) {
    await db.update(usersTable)
      .set({ password: newHash })
      .where(eq(usersTable.id, user.id))
      .catch(() => {});
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
  const { name, phone, password, city, referralCode } = req.body || {};
  if (!name || !phone || !password) {
    res.status(400).json({ error: "Заполните все поля" });
    return;
  }

  try {
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
    if (existing) {
      res.status(409).json({ error: "Пользователь с таким номером уже существует" });
      return;
    }

    let referrerId: number | null = null;
    if (referralCode) {
      const [referrer] = await db.select().from(usersTable).where(eq(usersTable.referralCode, referralCode.toUpperCase()));
      if (referrer) referrerId = referrer.id;
    }

    const { user, myCode } = await db.transaction(async (tx: typeof db) => {
      const [newUser] = await tx.insert(usersTable).values({
        name,
        phone,
        password: hashPassword(phone, password),
        role: "passenger",
        city: city || null,
        referredBy: referrerId,
      }).returning();

      const code = generateReferralCode(newUser.id);
      // Use ON CONFLICT DO NOTHING to avoid crashing on rare referral_code collision
      await tx.update(usersTable).set({ referralCode: code }).where(eq(usersTable.id, newUser.id))
        .catch(() => { /* ignore referral_code collision – user still created */ });

      if (referrerId) {
        const bonusAmount = parseFloat(await getSetting("referral_bonus", "100"));
        if (bonusAmount > 0) {
          await tx.update(usersTable)
            .set({ bonusBalance: sql`${usersTable.bonusBalance} + ${bonusAmount}` })
            .where(eq(usersTable.id, referrerId));
        }
      }
      return { user: newUser, myCode: code };
    });

    const token = generateToken(user.id, user.role);
    res.json({ token, user: formatUser({ ...user, referralCode: myCode }) });
  } catch (err: any) {
    console.error("[auth/register]", err.message);
    res.status(500).json({ error: "Ошибка при регистрации. Попробуйте ещё раз." });
  }
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

  const newUserId = await db.transaction(async (tx: typeof db) => {
    const [user] = await tx.insert(usersTable).values({
      name,
      phone,
      password: hashPassword(phone, password),
      role: "driver",
      city: city || null,
    }).returning();

    await tx.insert(driversTable).values({
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

    return user.id;
  });

  res.json({ message: "Заявка отправлена. Ожидайте подтверждения администратора.", userId: newUserId });
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
