import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, cityTariffOverridesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/city-tariff-overrides", async (req, res): Promise<void> => {
  const { tariffId, city } = req.query as { tariffId?: string; city?: string };
  let query = db.select().from(cityTariffOverridesTable);
  const conditions = [];
  if (tariffId) conditions.push(eq(cityTariffOverridesTable.tariffId, parseInt(tariffId)));
  if (city) conditions.push(eq(cityTariffOverridesTable.city, city));
  const rows = conditions.length
    ? await db.select().from(cityTariffOverridesTable).where(conditions.length === 1 ? conditions[0] : and(...conditions))
    : await query;
  res.json(rows);
});

router.post("/city-tariff-overrides", async (req, res): Promise<void> => {
  const { city, tariffId, basePrice, pricePerKm, minPrice } = req.body;
  if (!city || !tariffId) { res.status(400).json({ error: "city and tariffId required" }); return; }
  const existing = await db.select().from(cityTariffOverridesTable)
    .where(and(eq(cityTariffOverridesTable.city, city), eq(cityTariffOverridesTable.tariffId, tariffId)));
  if (existing.length > 0) {
    const [updated] = await db.update(cityTariffOverridesTable)
      .set({ basePrice: basePrice ?? null, pricePerKm: pricePerKm ?? null, minPrice: minPrice ?? null })
      .where(eq(cityTariffOverridesTable.id, existing[0].id))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(cityTariffOverridesTable)
      .values({ city, tariffId, basePrice: basePrice ?? null, pricePerKm: pricePerKm ?? null, minPrice: minPrice ?? null })
      .returning();
    res.json(created);
  }
});

router.delete("/city-tariff-overrides/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(cityTariffOverridesTable).where(eq(cityTariffOverridesTable.id, id));
  res.json({ deleted: true });
});

export default router;
