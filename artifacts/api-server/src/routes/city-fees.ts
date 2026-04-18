import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { cityFeesTable } from "@workspace/db";
import { getUserFromRequest } from "./auth";

const router: IRouter = Router();

// Получить ставки по всем городам
router.get("/city-fees", async (req, res): Promise<void> => {
  const fees = await db.select().from(cityFeesTable);
  res.json(fees);
});

// Получить ставку для конкретного города
router.get("/city-fees/:city", async (req, res): Promise<void> => {
  const city = decodeURIComponent(req.params.city);
  const [fee] = await db.select().from(cityFeesTable).where(eq(cityFeesTable.city, city));
  res.json(fee || { city, monthlyFee: 2000, trialDays: 30 });
});

// Обновить или создать ставку для города
router.put("/city-fees/:city", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "admin") { res.status(403).json({ error: "Нет доступа" }); return; }

  const city = decodeURIComponent(req.params.city);
  const { monthlyFee, trialDays } = req.body || {};

  if (monthlyFee === undefined) {
    res.status(400).json({ error: "Укажите monthlyFee" });
    return;
  }

  await db.insert(cityFeesTable).values({
    city,
    monthlyFee: parseFloat(monthlyFee),
    trialDays: trialDays ? parseInt(trialDays) : 30,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: cityFeesTable.city,
    set: {
      monthlyFee: parseFloat(monthlyFee),
      trialDays: trialDays ? parseInt(trialDays) : 30,
      updatedAt: new Date(),
    },
  });

  const [fee] = await db.select().from(cityFeesTable).where(eq(cityFeesTable.city, city));
  res.json(fee);
});

export default router;
