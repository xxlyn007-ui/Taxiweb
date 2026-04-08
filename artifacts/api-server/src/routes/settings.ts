import { Router, type IRouter } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const DEFAULTS: Record<string, string> = {
  subscription_price: "2000",
  subscription_trial_days: "30",
};

router.get("/settings", async (_req, res): Promise<void> => {
  const rows = await db.select().from(settingsTable);
  const result: Record<string, string> = { ...DEFAULTS };
  for (const row of rows) {
    result[row.key] = row.value;
  }
  res.json(result);
});

router.put("/settings/:key", async (req, res): Promise<void> => {
  const { key } = req.params;
  const { value } = req.body;
  if (!value && value !== "0") {
    res.status(400).json({ error: "value required" });
    return;
  }
  await db.insert(settingsTable)
    .values({ key, value: String(value), updatedAt: new Date() })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: String(value), updatedAt: new Date() } });
  res.json({ key, value: String(value) });
});

export default router;
