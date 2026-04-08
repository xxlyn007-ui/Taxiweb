import webPush from "web-push";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq, and, or, isNull, inArray } from "drizzle-orm";

let initialized = false;

function ensureInit() {
  if (initialized) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const sub = process.env.VAPID_SUBJECT || "mailto:admin@taxiimpulse.ru";
  if (!pub || !priv) return;
  webPush.setVapidDetails(sub, pub, priv);
  initialized = true;
}

export async function sendPushToUser(userId: number, payload: {
  title: string; body: string; tag?: string; url?: string;
}) {
  ensureInit();
  if (!initialized) return;
  const subs = await db.select().from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.userId, userId));
  for (const sub of subs) {
    try {
      await webPush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          icon: "/logo.png",
          badge: "/logo.png",
          tag: payload.tag || "taxi",
          data: { url: payload.url || "/" },
        })
      );
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.id, sub.id));
      }
    }
  }
}

export async function sendPushToDriversInCity(city: string, payload: {
  title: string; body: string; tag?: string; url?: string;
}) {
  ensureInit();
  if (!initialized) return;
  const driverSubs = await db.select().from(pushSubscriptionsTable)
    .where(
      and(
        eq(pushSubscriptionsTable.role, 'driver'),
        or(
          eq(pushSubscriptionsTable.workCity, city),
          isNull(pushSubscriptionsTable.workCity)
        )
      )
    );
  for (const sub of driverSubs) {
    try {
      await webPush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          icon: "/logo.png",
          badge: "/logo.png",
          tag: payload.tag || "new-order",
          data: { url: payload.url || "/driver" },
        })
      );
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.id, sub.id));
      }
    }
  }
}

export async function sendPushBroadcast(options: {
  city: string | null;
  role: 'passenger' | 'driver' | 'all';
  title: string;
  body: string;
  url?: string;
}): Promise<{ sent: number; failed: number }> {
  ensureInit();
  if (!initialized) return { sent: 0, failed: 0 };

  const conditions: any[] = [];

  if (options.role !== 'all') {
    conditions.push(eq(pushSubscriptionsTable.role, options.role));
  } else {
    conditions.push(
      or(
        eq(pushSubscriptionsTable.role, 'passenger'),
        eq(pushSubscriptionsTable.role, 'driver')
      )
    );
  }

  if (options.city) {
    conditions.push(
      or(
        eq(pushSubscriptionsTable.workCity, options.city),
        isNull(pushSubscriptionsTable.workCity)
      )
    );
  }

  const subs = await db.select().from(pushSubscriptionsTable)
    .where(conditions.length > 1 ? and(...conditions) : conditions[0]);

  let sent = 0;
  let failed = 0;
  const toDelete: number[] = [];

  for (const sub of subs) {
    try {
      await webPush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: options.title,
          body: options.body,
          icon: "/logo.png",
          badge: "/logo.png",
          tag: "broadcast",
          data: { url: options.url || "/" },
        })
      );
      sent++;
    } catch (err: any) {
      failed++;
      if (err.statusCode === 410 || err.statusCode === 404) {
        toDelete.push(sub.id);
      }
    }
  }

  if (toDelete.length > 0) {
    await db.delete(pushSubscriptionsTable).where(inArray(pushSubscriptionsTable.id, toDelete));
  }

  return { sent, failed };
}
