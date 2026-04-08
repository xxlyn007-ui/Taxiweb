import { pgTable, text, serial, timestamp, real, integer, index } from "drizzle-orm/pg-core";
import { driversTable } from "./drivers";

export const driverBonusRequestsTable = pgTable("driver_bonus_requests", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id").notNull().references(() => driversTable.id),
  amount: real("amount").notNull(),
  cardOrPhone: text("card_or_phone").notNull(),
  bank: text("bank").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
}, (table) => ({
  driverIdIdx: index("bonus_req_driver_id_idx").on(table.driverId),
  statusIdx: index("bonus_req_status_idx").on(table.status),
}));

export type DriverBonusRequest = typeof driverBonusRequestsTable.$inferSelect;
