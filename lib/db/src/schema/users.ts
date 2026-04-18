import { pgTable, text, serial, timestamp, real, integer, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("passenger"),
  city: text("city"),
  rating: real("rating").default(5.0),
  totalRides: integer("total_rides").default(0),
  isBlocked: boolean("is_blocked").notNull().default(false),
  referralCode: text("referral_code").unique(),
  referredBy: integer("referred_by"),
  bonusBalance: real("bonus_balance").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  managedCity: text("managed_city"),
  partnerCompany: text("partner_company"),
}, (table) => ({  roleIdx: index("users_role_idx").on(table.role),
  referralCodeIdx: index("users_referral_code_idx").on(table.referralCode),
}));

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

// Доп. поля для городских и партнёрских администраторов
// managedCity: для city_admin — какой город он администрирует
// partnerCompany: для delivery_admin — название партнёрской компании
