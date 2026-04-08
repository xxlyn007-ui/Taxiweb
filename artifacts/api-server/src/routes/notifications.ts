import { Router, type IRouter } from "express";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq, and, or, isNull, count, sql } from "drizzle-orm";
import { getUserFromRequest } from "./auth";
import { sendPushBroadcast } from "../push";

const router: IRouter = Router();

router.get("/notifications/stats", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Нет доступа" });
    return;
  }

  const allSubs = await db.select({
    role: pushSubscriptionsTable.role,
    workCity: pushSubscriptionsTable.workCity,
  }).from(pushSubscriptionsTable);

  const byCity: Record<string, { passengers: number; drivers: number; total: number }> = {};
  let totalPassengers = 0;
  let totalDrivers = 0;

  for (const sub of allSubs) {
    const city = sub.workCity || "Не указан";
    if (!byCity[city]) byCity[city] = { passengers: 0, drivers: 0, total: 0 };
    if (sub.role === "passenger") {
      byCity[city].passengers++;
      totalPassengers++;
    } else if (sub.role === "driver") {
      byCity[city].drivers++;
      totalDrivers++;
    }
    byCity[city].total++;
  }

  res.json({
    total: allSubs.length,
    totalPassengers,
    totalDrivers,
    byCity,
  });
});

router.post("/notifications/broadcast", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Нет доступа" });
    return;
  }

  const { city, role, title, body, url } = req.body || {};

  if (!title?.trim() || !body?.trim()) {
    res.status(400).json({ error: "Укажите заголовок и текст сообщения" });
    return;
  }

  if (role && !['passenger', 'driver', 'all'].includes(role)) {
    res.status(400).json({ error: "Неверная роль получателей" });
    return;
  }

  const result = await sendPushBroadcast({
    city: city || null,
    role: role || 'all',
    title: title.trim(),
    body: body.trim(),
    url: url || undefined,
  });

  res.json({
    success: true,
    sent: result.sent,
    failed: result.failed,
    message: `Отправлено: ${result.sent}, ошибок: ${result.failed}`,
  });
});

export default router;
