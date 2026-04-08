import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, citiesTable } from "@workspace/db";
import { getUserFromRequest } from "./auth";

const router: IRouter = Router();

router.get("/cities", async (_req, res): Promise<void> => {
  const cities = await db.select().from(citiesTable).where(eq(citiesTable.isActive, true)).orderBy(citiesTable.name);
  res.json(cities);
});

router.get("/cities/all", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Нет доступа" });
    return;
  }
  const cities = await db.select().from(citiesTable).orderBy(citiesTable.name);
  res.json(cities);
});

router.post("/cities", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Нет доступа" });
    return;
  }
  const { name, region } = req.body || {};
  if (!name?.trim()) {
    res.status(400).json({ error: "Укажите название города" });
    return;
  }
  const existing = await db.select().from(citiesTable).where(eq(citiesTable.name, name.trim()));
  if (existing.length > 0) {
    res.status(409).json({ error: "Город с таким названием уже существует" });
    return;
  }
  const [city] = await db.insert(citiesTable).values({
    name: name.trim(),
    region: region?.trim() || "Красноярский край",
    isActive: true,
  }).returning();
  res.status(201).json(city);
});

router.patch("/cities/:id", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Нет доступа" });
    return;
  }
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Неверный ID" });
    return;
  }
  const { name, region, isActive } = req.body || {};
  const update: Record<string, any> = {};
  if (name?.trim()) update.name = name.trim();
  if (region?.trim()) update.region = region.trim();
  if (typeof isActive === "boolean") update.isActive = isActive;

  const [city] = await db.update(citiesTable).set(update).where(eq(citiesTable.id, id)).returning();
  if (!city) {
    res.status(404).json({ error: "Город не найден" });
    return;
  }
  res.json(city);
});

router.delete("/cities/:id", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Нет доступа" });
    return;
  }
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Неверный ID" });
    return;
  }
  const [city] = await db.delete(citiesTable).where(eq(citiesTable.id, id)).returning();
  if (!city) {
    res.status(404).json({ error: "Город не найден" });
    return;
  }
  res.json({ success: true });
});

export default router;
