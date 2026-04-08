import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { ordersTable } from "./orders";

export const chatMessagesTable = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id),
  senderId: integer("sender_id").notNull().references(() => usersTable.id),
  senderRole: text("sender_role").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orderIdIdx: index("chat_order_id_idx").on(table.orderId),
  senderIdIdx: index("chat_sender_id_idx").on(table.senderId),
}));

export type ChatMessage = typeof chatMessagesTable.$inferSelect;
