import { pgTable, text, serial, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const supportMessagesTable = pgTable("support_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  userRole: text("user_role").notNull(),
  message: text("message").notNull(),
  isFromSupport: boolean("is_from_support").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("support_user_id_idx").on(table.userId),
  createdAtIdx: index("support_created_at_idx").on(table.createdAt),
}));

export type SupportMessage = typeof supportMessagesTable.$inferSelect;
