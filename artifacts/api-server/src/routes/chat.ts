import { Router, type IRouter } from "express";
import { eq, desc, inArray } from "drizzle-orm";
import { db, chatMessagesTable, usersTable, ordersTable, driversTable } from "@workspace/db";
import { sendPushToUser } from "../push";

const router: IRouter = Router();

router.get("/chat/:orderId/messages", async (req, res): Promise<void> => {
  const orderId = parseInt(req.params.orderId);
  if (isNaN(orderId)) { res.status(400).json({ error: "Неверный ID заказа" }); return; }

  // Последние 200 сообщений, батчевый запрос пользователей (без N+1)
  const messages = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.orderId, orderId))
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(200);

  messages.reverse();

  const senderIds = [...new Set(messages.map(m => m.senderId))];
  const users = senderIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, senderIds))
    : [];
  const userMap = new Map(users.map(u => [u.id, u]));

  const enriched = messages.map(msg => ({
    id: msg.id,
    orderId: msg.orderId,
    senderId: msg.senderId,
    senderName: userMap.get(msg.senderId)?.name || "Неизвестно",
    senderRole: msg.senderRole,
    message: msg.message,
    createdAt: msg.createdAt,
  }));

  res.json(enriched);
});

router.post("/chat/:orderId/messages", async (req, res): Promise<void> => {
  const orderId = parseInt(req.params.orderId);
  if (isNaN(orderId)) { res.status(400).json({ error: "Неверный ID заказа" }); return; }

  const { senderId, senderRole, message } = req.body;
  if (!senderId || !senderRole || !message?.trim()) {
    res.status(400).json({ error: "Неверные данные" });
    return;
  }

  const [msg] = await db.insert(chatMessagesTable).values({
    orderId,
    senderId,
    senderRole,
    message: message.trim(),
  }).returning();

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, senderId));

  // Push-уведомление получателю
  try {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
    if (order) {
      if (senderRole === "passenger" && order.driverId) {
        // Пассажир написал — уведомить водителя
        const [driver] = await db.select().from(driversTable).where(eq(driversTable.id, order.driverId));
        if (driver) {
          sendPushToUser(driver.userId, {
            title: `💬 ${user?.name || "Пассажир"}`,
            body: message.trim().slice(0, 100),
            tag: `chat-${orderId}`,
            url: "/driver",
          }).catch(() => {});
        }
      } else if (senderRole === "driver") {
        // Водитель написал — уведомить пассажира
        sendPushToUser(order.passengerId, {
          title: `💬 ${user?.name || "Водитель"}`,
          body: message.trim().slice(0, 100),
          tag: `chat-${orderId}`,
          url: "/passenger",
        }).catch(() => {});
      }
    }
  } catch {}

  res.status(201).json({
    id: msg.id,
    orderId: msg.orderId,
    senderId: msg.senderId,
    senderName: user?.name || "Неизвестно",
    senderRole: msg.senderRole,
    message: msg.message,
    createdAt: msg.createdAt,
  });
});

export default router;
