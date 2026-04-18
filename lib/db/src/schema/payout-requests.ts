import { pgTable, text, serial, timestamp, real, integer, index } from "drizzle-orm/pg-core";
import { driversTable } from "./drivers";
import { usersTable } from "./users";

export const payoutRequestsTable = pgTable("payout_requests", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id").notNull().references(() => driversTable.id),
  amount: real("amount").notNull(),
  paymentDetails: text("payment_details").notNull(),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  adminNote: text("admin_note"),
  processedBy: integer("processed_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
}, (table) => ({
  driverIdx: index("payout_driver_idx").on(table.driverId),
  statusIdx: index("payout_status_idx").on(table.status),
}));

export type PayoutRequest = typeof payoutRequestsTable.$inferSelect;
export type InsertPayoutRequest = typeof payoutRequestsTable.$inferInsert;
