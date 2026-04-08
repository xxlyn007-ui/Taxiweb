import { pgTable, text, serial, timestamp, real, integer, index } from "drizzle-orm/pg-core";
import { driversTable } from "./drivers";

export const ridesharesTable = pgTable("rideshares", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id").notNull().references(() => driversTable.id),
  fromCity: text("from_city").notNull(),
  toCity: text("to_city").notNull(),
  fromAddress: text("from_address").notNull(),
  toAddress: text("to_address").notNull(),
  departureDate: text("departure_date").notNull(),
  departureTime: text("departure_time").notNull(),
  seatsTotal: integer("seats_total").notNull().default(3),
  price: real("price").notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"),
  paymentId: text("payment_id"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  statusIdx: index("rideshares_status_idx").on(table.status),
  driverIdx: index("rideshares_driver_idx").on(table.driverId),
}));

export type Rideshare = typeof ridesharesTable.$inferSelect;
