import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';
import { z } from 'zod';
import db from '../config/database';
import { randomUUID } from 'crypto';

const router = Router();

router.use(authenticateToken);

// Get messages for a chat
router.get('/:chatId', async (req: AuthRequest, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId!;

    // Verify user is member
    const [membership] = await db.query(
      'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, userId]
    );

    if ((membership as any[]).length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [messages] = await db.query(
      `SELECT 
        m.*,
        u.id as user_id, u.name as user_name, u.username, u.avatar
       FROM messages m
       JOIN users u ON m.user_id = u.id
       WHERE m.chat_id = ?
       ORDER BY m.created_at ASC`,
      [chatId]
    );

    const formattedMessages = (messages as any[]).map(m => ({
      id: m.id,
      chatId: m.chat_id,
      userId: m.user_id,
      content: m.content,
      type: m.type,
      fileUrl: m.file_url,
      fileName: m.file_name,
      isPinned: Boolean(m.is_pinned),
      isDeleted: Boolean(m.is_deleted),
      replyTo: m.reply_to,
      createdAt: m.created_at,
      user: {
        id: m.user_id,
        name: m.user_name,
        username: m.username,
        avatar: m.avatar
      }
    }));

    res.json({ messages: formattedMessages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send message
const sendMessageSchema = z.object({
  content: z.string().min(1),
  type: z.string().default('text'),
  fileUrl: z.string().optional(),
  fileName: z.string().optional(),
  replyTo: z.string().optional(),
});

router.post('/:chatId', async (req: AuthRequest, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId!;
    const { content, type, fileUrl, fileName, replyTo } = sendMessageSchema.parse(req.body);

    const messageId = randomUUID();

    await db.query(
      `INSERT INTO messages (id, chat_id, user_id, content, type, file_url, file_name, reply_to) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [messageId, chatId, userId, content, type, fileUrl || null, fileName || null, replyTo || null]
    );

    // Get created message with user info
    const [messages] = await db.query(
      `SELECT 
        m.*,
        u.id as user_id, u.name as user_name, u.username, u.avatar
       FROM messages m
       JOIN users u ON m.user_id = u.id
       WHERE m.id = ?`,
      [messageId]
    );

    const message = (messages as any[])[0];
    const formattedMessage = {
      id: message.id,
      chatId: message.chat_id,
      userId: message.user_id,
      content: message.content,
      type: message.type,
      fileUrl: message.file_url,
      fileName: message.file_name,
      isPinned: Boolean(message.is_pinned),
      isDeleted: Boolean(message.is_deleted),
      replyTo: message.reply_to,
      createdAt: message.created_at,
      user: {
        id: message.user_id,
        name: message.user_name,
        username: message.username,
        avatar: message.avatar
      }
    };

    res.status(201).json({ message: formattedMessage });
  } catch (error) {
    console.error('Send message error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Mark message as read
router.post('/:messageId/read', async (req: AuthRequest, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.userId!;

    // Check if already read
    const [existing] = await db.query(
      'SELECT * FROM message_reads WHERE message_id = ? AND user_id = ?',
      [messageId, userId]
    );

    if ((existing as any[]).length === 0) {
      const readId = randomUUID();
      await db.query(
        'INSERT INTO message_reads (id, message_id, user_id) VALUES (?, ?, ?)',
        [readId, messageId, userId]
      );
    }

    res.json({ message: 'Message marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// Get message read receipts
router.get('/:messageId/reads', async (req: AuthRequest, res) => {
  try {
    const { messageId } = req.params;

    const [reads] = await db.query(
      `SELECT mr.read_at, u.id, u.name, u.username, u.avatar
       FROM message_reads mr
       JOIN users u ON mr.user_id = u.id
       WHERE mr.message_id = ?`,
      [messageId]
    );

    res.json({
      reads: (reads as any[]).map(r => ({
        userId: r.id,
        userName: r.name,
        username: r.username,
        avatar: r.avatar,
        readAt: r.read_at
      }))
    });
  } catch (error) {
    console.error('Get reads error:', error);
    res.status(500).json({ error: 'Failed to get read receipts' });
  }
});

// Forward message
router.post('/:messageId/forward', async (req: AuthRequest, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.userId!;
    const { targetChatIds } = req.body;

    if (!Array.isArray(targetChatIds) || targetChatIds.length === 0) {
      return res.status(400).json({ error: 'Target chat IDs required' });
    }

    // Get original message
    const [messages] = await db.query(
      'SELECT * FROM messages WHERE id = ?',
      [messageId]
    );

    if ((messages as any[]).length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const originalMessage = (messages as any[])[0];

    // Forward to each target chat
    const forwardedMessages = [];
    for (const chatId of targetChatIds) {
      // Verify user is member
      const [membership] = await db.query(
        'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?',
        [chatId, userId]
      );

      if ((membership as any[]).length > 0) {
        const newMessageId = randomUUID();
        await db.query(
          `INSERT INTO messages (id, chat_id, user_id, content, type, file_url, file_name)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            newMessageId,
            chatId,
            userId,
            originalMessage.content,
            originalMessage.type,
            originalMessage.file_url,
            originalMessage.file_name
          ]
        );

        forwardedMessages.push({ chatId, messageId: newMessageId });
      }
    }

    res.json({ message: 'Message forwarded', forwardedMessages });
  } catch (error) {
    console.error('Forward message error:', error);
    res.status(500).json({ error: 'Failed to forward message' });
  }
});

export default router;

