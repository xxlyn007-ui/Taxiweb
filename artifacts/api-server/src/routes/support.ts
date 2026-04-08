import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, supportMessagesTable } from "@workspace/db";

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
