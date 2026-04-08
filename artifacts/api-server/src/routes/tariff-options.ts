import { Router, type IRouter } from "express";
import { eq, or, isNull } from "drizzle-orm";
import { db, tariffOptionsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/tariff-options", async (req, res): Promise<void> => {
  const { city } = req.query as { city?: string };
  let options;
  if (city) {
    options = await db.select().from(tariffOptionsTable)
      .where(or(isNull(tariffOptionsTable.city), eq(tariffOptionsTable.city, city)))
      .orderBy(tariffOptionsTable.id);
  } else {
    options = await db.select().from(tariffOptionsTable).orderBy(tariffOptionsTable.id);
  }
  res.json(options.map(o => ({
    id: o.id,
    name: o.name,
    description: o.description,
    price: o.price,
    isActive: o.isActive,
    city: o.city ?? null,
    createdAt: o.createdAt,
  })));
});

router.post("/tariff-options", async (req, res): Promise<void> => {
  const { name, description, price, isActive, city } = req.body;
  if (!name?.trim() || price == null || isNaN(Number(price))) {
    res.status(400).json({ error: "Укажите название и цену" });
    return;
  }
  const [opt] = await db.insert(tariffOptionsTable).values({
    name: name.trim(),
    description: description?.trim() || null,
    price: Number(price),
    isActive: isActive !== false,
    city: city?.trim() || null,
  }).returning();
  res.status(201).json({
    id: opt.id, name: opt.name, description: opt.description,
    price: opt.price, isActive: opt.isActive, city: opt.city ?? null, createdAt: opt.createdAt,
  });
});

router.patch("/tariff-options/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Неверный ID" }); return; }
  const { name, description, price, isActive, city } = req.body;
  const updateData: any = {};
  if (name !== undefined) updateData.name = name.trim();
  if (description !== undefined) updateData.description = description?.trim() || null;
  if (price !== undefined) updateData.price = Number(price);
  if (isActive !== undefined) updateData.isActive = Boolean(isActive);
  if (city !== undefined) updateData.city = city?.trim() || null;
  const [opt] = await db.update(tariffOptionsTable).set(updateData).where(eq(tariffOptionsTable.id, id)).returning();
  if (!opt) { res.status(404).json({ error: "Опция не найдена" }); return; }
  res.json({ id: opt.id, name: opt.name, description: opt.description, price: opt.price, isActive: opt.isActive, city: opt.city ?? null, createdAt: opt.createdAt });
});

router.delete("/tariff-options/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Неверный ID" }); return; }
  const [opt] = await db.delete(tariffOptionsTable).where(eq(tariffOptionsTable.id, id)).returning();
  if (!opt) { res.status(404).json({ error: "Опция не найдена" }); return; }
  res.json({ success: true });
});

export default router;
