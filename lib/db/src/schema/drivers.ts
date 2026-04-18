import { pgTable, text, serial, timestamp, real, integer, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { tariffsTable } from "./tariffs";

export const driversTable = pgTable("drivers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  carModel: text("car_model").notNull(),
  carColor: text("car_color"),
  carNumber: text("car_number").notNull(),
  city: text("city").notNull(),
  workCity: text("work_city"),
  status: text("status").notNull().default("offline"),
  rating: real("rating").default(5.0),
  totalRides: integer("total_rides").default(0),
  balance: real("balance").default(0),
  tariffId: integer("tariff_id").references(() => tariffsTable.id),
  isApproved: boolean("is_approved").default(false),
  isBlocked: boolean("is_blocked").default(false),
  autoAssign: boolean("auto_assign").default(false),
  licenseNumber: text("license_number"),
  experience: integer("experience"),
  rejectionReason: text("rejection_reason"),
  approvedTariffIds: text("approved_tariff_ids"),
  activeTariffIds: text("active_tariff_ids"),
  driverLat: real("driver_lat"),
  driverLon: real("driver_lon"),
  locationUpdatedAt: timestamp("location_updated_at", { withTimezone: true }),
  bonusBalance: real("bonus_balance").notNull().default(0),
  orderMode: text("order_mode").notNull().default("all"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  statusIdx: index("drivers_status_idx").on(table.status),
  cityIdx: index("drivers_city_idx").on(table.city),
  workCityIdx: index("drivers_work_city_idx").on(table.workCity),
  userIdIdx: index("drivers_user_id_idx").on(table.userId),
  approvedIdx: index("drivers_approved_idx").on(table.isApproved),
}));

export const insertDriverSchema = createInsertSchema(driversTable).omit({ id: true, createdAt: true });
export type InsertDriver = z.infer<typeof insertDriverSchema>;
export type Driver = typeof driversTable.$inferSelect;
