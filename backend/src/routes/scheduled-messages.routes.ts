import express from 'express';
import db from '../config/database';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';
import crypto from 'crypto';

const router = express.Router();

// Schedule a message
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { chatId, content, scheduledTime, isRecurring, recurrencePattern } = req.body;

    // Verify user is member of chat
    const [membership] = await db.query(
      'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, userId]
    );

    if ((membership as any[]).length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const id = crypto.randomUUID();

    // Convert ISO string to MySQL TIMESTAMP format
    const scheduledTimeFormatted = new Date(scheduledTime).toISOString().slice(0, 19).replace('T', ' ');

    await db.query(
      `INSERT INTO scheduled_messages 
       (id, chat_id, user_id, content, type, scheduled_time, is_recurring, recurrence_pattern)
       VALUES (?, ?, ?, ?, 'text', ?, ?, ?)`,
      [id, chatId, userId, content, scheduledTimeFormatted, isRecurring || false, recurrencePattern || null]
    );

    res.json({ message: 'Message scheduled successfully', id });
  } catch (error) {
    console.error('Schedule message error:', error);
    console.error('Error details:', {
      message: (error as any).message,
      code: (error as any).code,
      sqlMessage: (error as any).sqlMessage
    });
    res.status(500).json({ error: 'Failed to schedule message' });
  }
});

// Get scheduled messages for a chat
router.get('/chat/:chatId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { chatId } = req.params;

    // Verify user is member of chat
    const [membership] = await db.query(
      'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, userId]
    );

    if ((membership as any[]).length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [messages] = await db.query(
      `SELECT sm.*, u.name, u.username, u.avatar
       FROM scheduled_messages sm
       JOIN users u ON sm.user_id = u.id
       WHERE sm.chat_id = ? AND sm.user_id = ? AND sm.is_sent = FALSE
       ORDER BY sm.scheduled_time ASC`,
      [chatId, userId]
    );

    res.json({
      scheduledMessages: (messages as any[]).map(m => ({
        id: m.id,
        chatId: m.chat_id,
        content: m.content,
        scheduledTime: m.scheduled_time,
        isRecurring: Boolean(m.is_recurring),
        recurrencePattern: m.recurrence_pattern,
        user: {
          id: m.user_id,
          name: m.name,
          username: m.username,
          avatar: m.avatar
        }
      }))
    });
  } catch (error) {
    console.error('Get scheduled messages error:', error);
    res.status(500).json({ error: 'Failed to get scheduled messages' });
  }
});

// Delete scheduled message
router.delete('/:messageId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { messageId } = req.params;

    const [result] = await db.query(
      'DELETE FROM scheduled_messages WHERE id = ? AND user_id = ?',
      [messageId, userId]
    );

    if ((result as any).affectedRows === 0) {
      return res.status(404).json({ error: 'Scheduled message not found' });
    }

    res.json({ message: 'Scheduled message deleted' });
  } catch (error) {
    console.error('Delete scheduled message error:', error);
    res.status(500).json({ error: 'Failed to delete scheduled message' });
  }
});

export default router;
