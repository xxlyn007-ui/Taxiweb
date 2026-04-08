import { pgTable, text, serial, timestamp, real, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { driversTable } from "./drivers";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  passengerId: integer("passenger_id").notNull().references(() => usersTable.id),
  driverId: integer("driver_id").references(() => driversTable.id),
  city: text("city").notNull(),
  toCity: text("to_city"),
  fromAddress: text("from_address").notNull(),
  toAddress: text("to_address").notNull(),
  status: text("status").notNull().default("pending"),
  price: real("price"),
  distance: real("distance"),
  tariffId: integer("tariff_id"),
  tariffName: text("tariff_name"),
  orderType: text("order_type").notNull().default("taxi"),
  comment: text("comment"),
  packageDescription: text("package_description"),
  optionIds: text("option_ids"),
  rating: integer("rating"),
  bonusUsed: real("bonus_used").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => ({
  statusIdx: index("orders_status_idx").on(table.status),
  passengerIdx: index("orders_passenger_idx").on(table.passengerId),
  driverIdx: index("orders_driver_idx").on(table.driverId),
  cityIdx: index("orders_city_idx").on(table.city),
  createdAtIdx: index("orders_created_at_idx").on(table.createdAt),
  completedAtIdx: index("orders_completed_at_idx").on(table.completedAt),
}));

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
