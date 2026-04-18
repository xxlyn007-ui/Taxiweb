import { pgTable, text, serial, timestamp, real, integer } from "drizzle-orm/pg-core";

export const cityFeesTable = pgTable("city_fees", {
  id: serial("id").primaryKey(),
  city: text("city").notNull().unique(),
  monthlyFee: real("monthly_fee").notNull().default(2000),
  trialDays: integer("trial_days").notNull().default(30),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CityFee = typeof cityFeesTable.$inferSelect;
