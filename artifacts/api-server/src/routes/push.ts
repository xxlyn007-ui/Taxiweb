import { Router, type IRouter } from "express";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { getUserFromRequest } from "./auth";
import { drainPending, storePending } from "../push";

const router: IRouter = Router();

// FIX #5 — run DDL migration ONCE at startup, not on every FCM token request
db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT`).catch(() => {});

router.get("/push/vapid-key", (_req, res): void => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) { res.status(503).json({ error: "Push not configured" }); return; }
  res.json({ publicKey: key });
});

// FIX #6 — require authentication before accepting push subscriptions
router.post("/push/subscribe", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) { res.status(401).json({ error: "Не авторизован" }); return; }

  const { role, workCity, subscription } = req.body;
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    res.status(400).json({ error: "Invalid subscription data" }); return;
  }

  // Use authenticated user's id instead of trusting client-supplied userId
  await db.insert(pushSubscriptionsTable).values({
    userId: user.id,
    role: role || user.role,
    workCity: workCity || null,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
  }).onConflictDoUpdate({
    target: pushSubscriptionsTable.endpoint,
    set: {
      userId: user.id,
      role: role || user.role,
      workCity: workCity || null,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  });
  res.json({ success: true });
});

router.patch("/push/update-city", async (req, res): Promise<void> => {
  const { endpoint, workCity } = req.body;
  if (!endpoint) { res.status(400).json({ error: "endpoint required" }); return; }
  await db.update(pushSubscriptionsTable)
    .set({ workCity: workCity || null })
    .where(eq(pushSubscriptionsTable.endpoint, endpoint));
  res.json({ success: true });
});

router.delete("/push/unsubscribe", async (req, res): Promise<void> => {
  const { endpoint } = req.body;
  if (!endpoint) { res.status(400).json({ error: "endpoint required" }); return; }
  await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, endpoint));
  res.json({ success: true });
});

// GET /api/push/poll — мобильное приложение опрашивает для получения уведомлений
router.get("/push/poll", async (req, res): Promise<void> => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      res.json({ notifications: [], debug: "no_auth" });
      return;
    }
    const notifications = drainPending(user.id);
    res.json({ notifications, userId: user.id, debug: "ok" });
  } catch (e: any) {
    res.json({ notifications: [], debug: "error", error: String(e?.message || e) });
  }
});

// POST /api/push/fcm-token — регистрация FCM токена мобильного устройства
router.post("/push/fcm-token", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) { res.status(401).json({ error: "Не авторизован" }); return; }
  const { fcmToken } = req.body;
  if (!fcmToken?.trim()) { res.status(400).json({ error: "fcmToken обязателен" }); return; }
  // FIX #5 — DDL column was already ensured at module startup; just UPDATE here
  await db.execute(sql`UPDATE users SET fcm_token = ${fcmToken.trim()} WHERE id = ${user.id}`);
  res.json({ ok: true });
});

// POST /api/push/test-self — тестовое уведомление себе
router.post("/push/test-self", async (req, res): Promise<void> => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) { res.status(401).json({ error: "Не авторизован" }); return; }
    storePending(user.id, "🎉 Тест уведомлений", `Уведомление получено! Пользователь #${user.id} (${user.name || user.phone})`);
    res.json({ ok: true, userId: user.id, message: "Тестовое уведомление добавлено в очередь. Ждите до 20 секунд." });
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// POST /api/push/inject — только для администратора: отправить уведомление любому пользователю
router.post("/push/inject", async (req, res): Promise<void> => {
  try {
    const user = await getUserFromRequest(req);
    if (!user || user.role !== "admin") { res.status(403).json({ error: "Нет доступа" }); return; }
    const { userId, title, body } = req.body;
    if (!userId || !title) { res.status(400).json({ error: "userId и title обязательны" }); return; }
    storePending(Number(userId), title, body || "");
    res.json({ ok: true, userId: Number(userId) });
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// POST /api/push/fcm-test — admin: отправить FCM напрямую по токену (диагностика)
router.post("/push/fcm-test", async (req, res): Promise<void> => {
  try {
    const user = await getUserFromRequest(req);
    if (!user || user.role !== "admin") { res.status(403).json({ error: "Нет доступа" }); return; }
    const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!saJson) { res.status(503).json({ error: "FIREBASE_SERVICE_ACCOUNT не задан" }); return; }
    let sa: any;
    try { sa = JSON.parse(saJson); } catch { res.status(503).json({ error: "Ошибка парсинга SA" }); return; }
    const { fcmToken, title, body } = req.body;
    if (!fcmToken) { res.status(400).json({ error: "fcmToken обязателен" }); return; }
    const now = Math.floor(Date.now() / 1000);
    const crypto = await import("crypto");
    const payload = { iss: sa.client_email, sub: sa.client_email, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600, scope: "https://www.googleapis.com/auth/firebase.messaging" };
    const header = { alg: "RS256", typ: "JWT" };
    const encode = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
    const unsigned = `${encode(header)}.${encode(payload)}`;
    const sign = crypto.createSign("RSA-SHA256");
    sign.update(unsigned);
    const jwt = `${unsigned}.${sign.sign(sa.private_key, "base64url")}`;
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
      signal: AbortSignal.timeout(10000),
    });
    const tokenData: any = await tokenResp.json();
    if (!tokenData.access_token) { res.json({ ok: false, step: "oauth", error: tokenData }); return; }
    const fcmResp = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenData.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { token: fcmToken, notification: { title: title || "Тест", body: body || "Firebase работает!" }, android: { priority: "HIGH" } } }),
      signal: AbortSignal.timeout(10000),
    });
    const fcmData: any = await fcmResp.json();
    res.json({ ok: !!fcmData.name, step: "fcm", result: fcmData });
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// GET /api/push/firebase-info — диагностика Firebase project
router.get("/push/firebase-info", (_req, res): void => {
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!saJson) {
    res.json({ configured: false, project_id: null, message: "FIREBASE_SERVICE_ACCOUNT не задан" });
    return;
  }
  try {
    const sa = JSON.parse(saJson);
    res.json({
      configured: true,
      project_id: sa.project_id || null,
      client_email: sa.client_email ? sa.client_email.split("@")[0] + "@…" : null,
    });
  } catch {
    res.json({ configured: false, project_id: null, message: "Ошибка парсинга" });
  }
});

export default router;
