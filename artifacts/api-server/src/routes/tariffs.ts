import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, tariffsTable } from "@workspace/db";
import {
  GetTariffsResponse,
  CreateTariffBody,
  UpdateTariffParams,
  UpdateTariffBody,
  UpdateTariffResponse,
  DeleteTariffParams,
  DeleteTariffResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/tariffs", async (_req, res): Promise<void> => {
  const tariffs = await db.select().from(tariffsTable);
  res.json(GetTariffsResponse.parse(tariffs));
});

router.post("/tariffs", async (req, res): Promise<void> => {
  const parsed = CreateTariffBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Неверные данные" });
    return;
  }
  const rawCategory = req.body.category;
  const category = rawCategory === 'delivery' ? 'delivery' : 'taxi';
  const [tariff] = await db.insert(tariffsTable).values({ ...parsed.data, category }).returning();
  res.status(201).json(tariff);
});

router.patch("/tariffs/:id", async (req, res): Promise<void> => {
  const params = UpdateTariffParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Неверный ID" });
    return;
  }
  const parsed = UpdateTariffBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Неверные данные" });
    return;
  }
  const rawCategory = req.body.category;
  const updateData: any = { ...parsed.data };
  if (rawCategory === 'delivery' || rawCategory === 'taxi') updateData.category = rawCategory;
  const [tariff] = await db.update(tariffsTable).set(updateData).where(eq(tariffsTable.id, params.data.id)).returning();
  if (!tariff) {
    res.status(404).json({ error: "Тариф не найден" });
    return;
  }
  res.json(UpdateTariffResponse.parse(tariff));
});

router.delete("/tariffs/:id", async (req, res): Promise<void> => {
  const params = DeleteTariffParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Неверный ID" });
    return;
  }
  const [tariff] = await db.delete(tariffsTable).where(eq(tariffsTable.id, params.data.id)).returning();
  if (!tariff) {
    res.status(404).json({ error: "Тариф не найден" });
    return;
  }
  res.json(DeleteTariffResponse.parse({ success: true }));
});

export default router;
