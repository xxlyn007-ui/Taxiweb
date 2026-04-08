import { Router, type IRouter } from "express";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/push/vapid-key", (_req, res): void => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) { res.status(503).json({ error: "Push not configured" }); return; }
  res.json({ publicKey: key });
});

router.post("/push/subscribe", async (req, res): Promise<void> => {
  const { userId, role, workCity, subscription } = req.body;
  if (!userId || !role || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    res.status(400).json({ error: "Invalid subscription data" });
    return;
  }
  await db.insert(pushSubscriptionsTable).values({
    userId: Number(userId),
    role,
    workCity: workCity || null,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
  }).onConflictDoUpdate({
    target: pushSubscriptionsTable.endpoint,
    set: { userId: Number(userId), role, workCity: workCity || null, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
  });
  res.json({ success: true });
});

router.delete("/push/unsubscribe", async (req, res): Promise<void> => {
  const { endpoint } = req.body;
  if (!endpoint) { res.status(400).json({ error: "endpoint required" }); return; }
  await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, endpoint));
  res.json({ success: true });
});

export default router;
