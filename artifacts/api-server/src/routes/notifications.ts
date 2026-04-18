import { Router, type IRouter } from "express";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq, and, or, sql } from "drizzle-orm";
import { getUserFromRequest } from "./auth";
import { sendPushBroadcast } from "../push";

const router: IRouter = Router();

// GET /notifications/stats — сколько подписок по городам и ролям
router.get("/notifications/stats", async (req, res): Promise<void> => {
  try {
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
      const city = sub.workCity || "Без города";
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
  } catch (err: any) {
    console.error("[notifications/stats]", err.message);
    res.status(500).json({ error: "Ошибка загрузки статистики" });
  }
});

// POST /notifications/broadcast — запустить рассылку (отвечает сразу, рассылает фоном)
router.post("/notifications/broadcast", async (req, res): Promise<void> => {
  try {
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

    if (role && !["passenger", "driver", "all"].includes(role)) {
      res.status(400).json({ error: "Неверная роль получателей" });
      return;
    }

    // Считаем сколько получателей есть в базе (быстро, без отправки)
    const conditions: any[] = [];
    const effectiveRole = role || "all";

    if (effectiveRole !== "all") {
      conditions.push(eq(pushSubscriptionsTable.role, effectiveRole));
    } else {
      conditions.push(or(
        eq(pushSubscriptionsTable.role, "passenger"),
        eq(pushSubscriptionsTable.role, "driver")
      ));
    }
    if (city) conditions.push(eq(pushSubscriptionsTable.workCity, city));

    const [{ total }] = await db.select({ total: sql<number>`count(*)::int` })
      .from(pushSubscriptionsTable)
      .where(conditions.length > 1 ? and(...conditions) : conditions[0]);

    // Отвечаем клиенту сразу — рассылку запускаем фоном
    res.json({
      success: true,
      queued: total,
      message: `Рассылка запущена для ${total} получателей`,
    });

    // Фоновая отправка (не блокирует HTTP response)
    sendPushBroadcast({
      city: city || null,
      role: effectiveRole,
      title: title.trim(),
      body: body.trim(),
      url: url || undefined,
    }).then((result) => {
      console.log(`[broadcast] Завершено: отправлено ${result.sent}, ошибок ${result.failed}`);
    }).catch((err) => {
      console.error("[broadcast] Ошибка:", err.message);
    });
  } catch (err: any) {
    console.error("[notifications/broadcast]", err.message);
    res.status(500).json({ error: "Ошибка запуска рассылки" });
  }
});

export default router;
