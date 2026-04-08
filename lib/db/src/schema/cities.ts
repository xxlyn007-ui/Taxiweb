import { pgTable, text, serial, boolean } from "drizzle-orm/pg-core";

export const citiesTable = pgTable("cities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  region: text("region").notNull().default("Красноярский край"),
  isActive: boolean("is_active").notNull().default(true),
});

export type City = typeof citiesTable.$inferSelect;
export type InsertCity = typeof citiesTable.$inferInsert;
