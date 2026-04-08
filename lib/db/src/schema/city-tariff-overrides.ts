import { pgTable, text, serial, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tariffsTable } from "./tariffs";

export const cityTariffOverridesTable = pgTable("city_tariff_overrides", {
  id: serial("id").primaryKey(),
  city: text("city").notNull(),
  tariffId: integer("tariff_id").notNull().references(() => tariffsTable.id, { onDelete: "cascade" }),
  basePrice: real("base_price"),
  pricePerKm: real("price_per_km"),
  minPrice: real("min_price"),
});

export const insertCityTariffOverrideSchema = createInsertSchema(cityTariffOverridesTable).omit({ id: true });
export type InsertCityTariffOverride = z.infer<typeof insertCityTariffOverrideSchema>;
export type CityTariffOverride = typeof cityTariffOverridesTable.$inferSelect;
