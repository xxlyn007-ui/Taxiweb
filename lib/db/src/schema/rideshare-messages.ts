import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { ridesharesTable } from "./rideshares";

export const rideshareMessagesTable = pgTable("rideshare_messages", {
  id: serial("id").primaryKey(),
  rideshareId: integer("rideshare_id").notNull().references(() => ridesharesTable.id),
  senderId: integer("sender_id").notNull().references(() => usersTable.id),
  senderName: text("sender_name").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  rideshareIdx: index("rideshare_messages_rideshare_idx").on(table.rideshareId),
}));

export type RideshareMessage = typeof rideshareMessagesTable.$inferSelect;
