import { pgTable, text, serial, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tariffOptionsTable = pgTable("tariff_options", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: real("price").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  city: text("city"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTariffOptionSchema = createInsertSchema(tariffOptionsTable).omit({ id: true, createdAt: true });
export type InsertTariffOption = z.infer<typeof insertTariffOptionSchema>;
export type TariffOption = typeof tariffOptionsTable.$inferSelect;
