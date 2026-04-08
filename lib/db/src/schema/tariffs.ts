import { pgTable, text, serial, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tariffsTable = pgTable("tariffs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("taxi"),
  basePrice: real("base_price").notNull(),
  pricePerKm: real("price_per_km").notNull(),
  minPrice: real("min_price").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  tier1MaxKm: real("tier1_max_km"),
  tier1PricePerKm: real("tier1_price_per_km"),
  tier2MaxKm: real("tier2_max_km"),
  tier2PricePerKm: real("tier2_price_per_km"),
  tier3MaxKm: real("tier3_max_km"),
  tier3PricePerKm: real("tier3_price_per_km"),
});

export const insertTariffSchema = createInsertSchema(tariffsTable).omit({ id: true });
export type InsertTariff = z.infer<typeof insertTariffSchema>;
export type Tariff = typeof tariffsTable.$inferSelect;
