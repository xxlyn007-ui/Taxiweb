import { pgTable, text, serial, timestamp, real, integer, boolean } from "drizzle-orm/pg-core";
import { driversTable } from "./drivers";

export const driverSubscriptionsTable = pgTable("driver_subscriptions", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id").notNull().references(() => driversTable.id),
  status: text("status").notNull().default("trial"),
  startDate: timestamp("start_date", { withTimezone: true }).notNull().defaultNow(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  amount: real("amount").notNull().default(0),
  paymentId: text("payment_id"),
  paymentUrl: text("payment_url"),
  paymentMethodId: text("payment_method_id"),
  autoRenew: boolean("auto_renew").notNull().default(false),
  lastAutoChargeAt: timestamp("last_auto_charge_at", { withTimezone: true }),
  reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DriverSubscription = typeof driverSubscriptionsTable.$inferSelect;
