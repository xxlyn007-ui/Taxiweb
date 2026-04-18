import webpush from "web-push";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq, and, or, sql, inArray } from "drizzle-orm";

// ── VAPID init ─────────────────────────────────────────────────────────────
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails("mailto:info@taxiimpulse.ru", VAPID_PUBLIC, VAPID_PRIVATE);
  } catch {}
}

// ── In-memory polling queue ───────────────────────────────────────────────
interface PendingNotification { title: string; body: string; createdAt: number; }
const pendingByUser = new Map<number, PendingNotification[]>();
const MAX_PER_USER = 50;
const TTL_MS = 5 * 60 * 1000;

// FIX #4 — periodic GC every 10 minutes to prevent memory leak for inactive users
setInterval(() => {
  const now = Date.now();
  for (const [userId, queue] of pendingByUser) {
    const fresh = queue.filter((n) => now - n.createdAt < TTL_MS);
    if (fresh.length === 0) pendingByUser.delete(userId);
    else pendingByUser.set(userId, fresh);
  }
}, 10 * 60 * 1000).unref();

function cleanExpired(userId: number): void {
  const queue = pendingByUser.get(userId);
  if (!queue) return;
  const now = Date.now();
  const fresh = queue.filter((n) => now - n.createdAt < TTL_MS);
  if (fresh.length === 0) pendingByUser.delete(userId);
  else pendingByUser.set(userId, fresh);
}

export function storePending(userId: number, title: string, body: string): void {
  cleanExpired(userId);
  const queue = pendingByUser.get(userId) ?? [];
  queue.push({ title, body, createdAt: Date.now() });
  if (queue.length > MAX_PER_USER) queue.splice(0, queue.length - MAX_PER_USER);
  pendingByUser.set(userId, queue);
}

export function drainPending(userId: number): Array<{ title: string; body: string }> {
  cleanExpired(userId);
  const queue = pendingByUser.get(userId);
  if (!queue || queue.length === 0) return [];
  pendingByUser.delete(userId);
  return queue.map(({ title, body }) => ({ title, body }));
}

// ── FCM helper ────────────────────────────────────────────────────────────
// FIX #7 — cache parsed service account to avoid double-parsing on every send
let cachedSA: { project_id: string; client_email: string; private_key: string } | null = null;
function getParsedSA(): typeof cachedSA {
  if (cachedSA) return cachedSA;
  try {
    const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!saJson) return null;
    cachedSA = JSON.parse(saJson);
    return cachedSA;
  } catch { return null; }
}

async function getFcmAccessToken(): Promise<string | null> {
  try {
    const sa = getParsedSA();
    if (!sa) return null;
    const now = Math.floor(Date.now() / 1000);
    const crypto = await import("crypto");
    const payload = {
      iss: sa.client_email, sub: sa.client_email,
      aud: "https://oauth2.googleapis.com/token",
      iat: now, exp: now + 3600,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
    };
    const header = { alg: "RS256", typ: "JWT" };
    const encode = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
    const unsigned = `${encode(header)}.${encode(payload)}`;
    const sign = crypto.createSign("RSA-SHA256");
    sign.update(unsigned);
    const jwt = `${unsigned}.${sign.sign(sa.private_key, "base64url")}`;
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
      // FIX #3 — timeout on all external calls
      signal: AbortSignal.timeout(10000),
    });
    const data: any = await resp.json();
    return data.access_token ?? null;
  } catch { return null; }
}

async function sendFcm(fcmToken: string, title: string, body: string, tag?: string): Promise<void> {
  try {
    const sa = getParsedSA();
    if (!sa) return;
    const accessToken = await getFcmAccessToken();
    if (!accessToken) return;
    const resp = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          notification: { title, body },
          android: {
            priority: "HIGH",
            notification: {
              sound: "notification",
              channel_id: "taxi-impulse",
              tag: tag ?? undefined,
            },
          },
        },
      }),
      // FIX #3 — timeout on FCM calls
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.warn(`[FCM] send failed (${resp.status}): ${text.slice(0, 200)}`);
    }
  } catch (err: any) {
    if (err?.name !== "TimeoutError" && err?.name !== "AbortError") {
      console.warn("[FCM] error:", err.message);
    }
  }
}

// ── Web push (VAPID) helper ───────────────────────────────────────────────
async function sendWebPush(
  endpoint: string, p256dh: string, auth: string,
  title: string, body: string, tag?: string, url?: string
): Promise<void> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  try {
    await webpush.sendNotification(
      { endpoint, keys: { p256dh, auth } },
      JSON.stringify({ title, body, tag, url }),
      { urgency: "high", TTL: 86400 }
    );
  } catch (err: any) {
    if (err?.statusCode === 410 || err?.statusCode === 404) {
      try { await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, endpoint)); } catch {}
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

export async function sendPushToUser(userId: number, payload: PushPayload): Promise<void> {
  const { title, body, tag, url } = payload;
  storePending(userId, title, body);
  try {
    const rows = await db.execute(sql`SELECT fcm_token FROM users WHERE id = ${userId} AND fcm_token IS NOT NULL LIMIT 1`);
    const fcmToken = (rows.rows?.[0] as any)?.fcm_token;
    if (fcmToken) await sendFcm(fcmToken, title, body, tag);
  } catch {}
  try {
    const subs = await db.select().from(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.userId, userId));
    await Promise.all(subs.map((s) => sendWebPush(s.endpoint, s.p256dh, s.auth, title, body, tag, url)));
  } catch {}
}

// FIX #2 — query drivers by workCity (join drivers table), not users.city
export async function sendPushToDriversInCity(city: string, payload: PushPayload, orderType?: string): Promise<void> {
  const { title, body, tag, url } = payload;
  try {
    // Join with drivers table to use workCity, filter by order_mode preference
    const rows = await db.execute(sql`
      SELECT u.id, u.fcm_token
      FROM users u
      JOIN drivers d ON d.user_id = u.id
      WHERE d.is_approved = true
        AND d.is_blocked = false
        AND (d.work_city = ${city} OR d.city = ${city})
        AND (
          d.order_mode IS NULL OR d.order_mode = 'all'
          OR (${orderType ?? 'taxi'} = 'taxi' AND d.order_mode IN ('taxi', 'all'))
          OR (${orderType ?? 'taxi'} = 'delivery' AND d.order_mode IN ('delivery', 'all'))
        )
    `);
    const users = (rows.rows ?? []) as Array<{ id: number; fcm_token: string | null }>;
    const userIds = users.map((u) => u.id);
    await Promise.all([
      ...users.map(async (u) => {
        storePending(u.id, title, body);
        if (u.fcm_token) await sendFcm(u.fcm_token, title, body, tag);
      }),
      (async () => {
        if (userIds.length === 0) return;
        const subs = await db.select().from(pushSubscriptionsTable)
          .where(inArray(pushSubscriptionsTable.userId, userIds));
        await Promise.all(subs.map((s) => sendWebPush(s.endpoint, s.p256dh, s.auth, title, body, tag, url)));
      })(),
    ]);
  } catch {}
}

export interface BroadcastPayload {
  city?: string | null;
  role: string;
  title: string;
  body: string;
  url?: string;
}

export async function sendPushBroadcast(payload: BroadcastPayload): Promise<{ sent: number; failed: number }> {
  const { city, role, title, body, url } = payload;
  let sent = 0;
  let failed = 0;
  const BATCH = 50;

  try {
    // Web push subscriptions
    const subConditions: any[] = [];
    if (role !== "all") {
      subConditions.push(eq(pushSubscriptionsTable.role, role));
    } else {
      subConditions.push(or(eq(pushSubscriptionsTable.role, "passenger"), eq(pushSubscriptionsTable.role, "driver")));
    }
    if (city) subConditions.push(eq(pushSubscriptionsTable.workCity, city));

    const subs = await db.select().from(pushSubscriptionsTable)
      .where(subConditions.length > 1 ? and(...subConditions) : subConditions[0]);

    for (let i = 0; i < subs.length; i += BATCH) {
      await Promise.all(subs.slice(i, i + BATCH).map(async (s) => {
        try { await sendWebPush(s.endpoint, s.p256dh, s.auth, title, body, undefined, url); sent++; }
        catch { failed++; }
      }));
    }

    // FIX #1 — avoid fragile nested sql fragments; use explicit if/else branches
    let userRows: Array<{ id: number; fcm_token: string | null }>;
    if (role === "all" && city) {
      const result = await db.execute(sql`SELECT id, fcm_token FROM users WHERE role IN ('passenger', 'driver') AND city = ${city} AND is_blocked = false`);
      userRows = (result.rows ?? []) as Array<{ id: number; fcm_token: string | null }>;
    } else if (role === "all") {
      const result = await db.execute(sql`SELECT id, fcm_token FROM users WHERE role IN ('passenger', 'driver') AND is_blocked = false`);
      userRows = (result.rows ?? []) as Array<{ id: number; fcm_token: string | null }>;
    } else if (city) {
      const result = await db.execute(sql`SELECT id, fcm_token FROM users WHERE role = ${role} AND city = ${city} AND is_blocked = false`);
      userRows = (result.rows ?? []) as Array<{ id: number; fcm_token: string | null }>;
    } else {
      const result = await db.execute(sql`SELECT id, fcm_token FROM users WHERE role = ${role} AND is_blocked = false`);
      userRows = (result.rows ?? []) as Array<{ id: number; fcm_token: string | null }>;
    }

    for (const u of userRows) storePending(u.id, title, body);

    const fcmUsers = userRows.filter((u) => u.fcm_token);
    for (let i = 0; i < fcmUsers.length; i += BATCH) {
      await Promise.all(fcmUsers.slice(i, i + BATCH).map(async (u) => {
        try { await sendFcm(u.fcm_token!, title, body); sent++; }
        catch { failed++; }
      }));
    }
  } catch (err: any) {
    console.error("[broadcast]", err.message);
  }
  return { sent, failed };
}
