import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, supportMessagesTable, usersTable } from "@workspace/db";
import { sendPushToUser } from "../push";

const router: IRouter = Router();

router.get("/support/messages", async (req, res): Promise<void> => {
  const userId = req.query.userId ? parseInt(req.query.userId as string) : null;

  let messages;
  if (userId) {
    messages = await db
      .select()
      .from(supportMessagesTable)
      .where(eq(supportMessagesTable.userId, userId))
      .orderBy(supportMessagesTable.createdAt);
  } else {
    messages = await db
      .select()
      .from(supportMessagesTable)
      .orderBy(desc(supportMessagesTable.createdAt));
  }

  res.json(messages.map(m => ({
    id: m.id,
    userId: m.userId,
    userRole: m.userRole,
    message: m.message,
    isFromSupport: m.isFromSupport,
    createdAt: m.createdAt,
  })));
});

router.post("/support/messages", async (req, res): Promise<void> => {
  const { userId, userRole, message, isFromSupport } = req.body;
  if (!userId || !userRole || !message?.trim()) {
    res.status(400).json({ error: "Неверные данные" });
    return;
  }

  const [msg] = await db.insert(supportMessagesTable).values({
    userId,
    userRole,
    message: message.trim(),
    isFromSupport: isFromSupport === true,
  }).returning();

  // Push-уведомление
  try {
    if (isFromSupport === true) {
      // Поддержка написала — уведомить пользователя
      sendPushToUser(parseInt(userId), {
        title: "💬 Ответ от поддержки",
        body: message.trim().slice(0, 100),
        tag: "support",
        url: userRole === "driver" ? "/driver" : "/passenger",
      }).catch(() => {});
    } else {
      // Пользователь написал — уведомить всех админов
      const admins = await db.select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.role, "admin"));
      for (const admin of admins) {
        sendPushToUser(admin.id, {
          title: `💬 Обращение в поддержку`,
          body: message.trim().slice(0, 100),
          tag: "support-admin",
          url: "/admin/support",
        }).catch(() => {});
      }
    }
  } catch {}

  res.status(201).json({
    id: msg.id,
    userId: msg.userId,
    userRole: msg.userRole,
    message: msg.message,
    isFromSupport: msg.isFromSupport,
    createdAt: msg.createdAt,
  });
});

export default router;
