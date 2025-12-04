import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';
import { z } from 'zod';
import db from '../config/database';
import { randomUUID } from 'crypto';
import { io } from '../server';
import { userSockets } from '../socket/socket.handler.new';

const router = Router();

router.use(authenticateToken);

// Get all chats for current user
router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const [chatMembers] = await db.query(
      `SELECT 
        c.id, c.is_group, c.group_name, c.group_icon, c.description, c.admin_id, 
        c.created_at, c.updated_at
       FROM chat_members cm
       JOIN chats c ON cm.chat_id = c.id
       WHERE cm.user_id = ?
       ORDER BY c.updated_at DESC`,
      [userId]
    );

    const chats = [];
    for (const chat of chatMembers as any[]) {
      // Get members for each chat
      const [members] = await db.query(
        `SELECT 
          cm.id, cm.user_id, cm.role, cm.is_muted, cm.joined_at,
          u.id, u.name, u.username, u.email, u.avatar, u.last_seen
         FROM chat_members cm
         JOIN users u ON cm.user_id = u.id
         WHERE cm.chat_id = ?`,
        [chat.id]
      );

      chats.push({
        id: chat.id,
        isGroup: Boolean(chat.is_group),
        groupName: chat.group_name,
        groupIcon: chat.group_icon,
        description: chat.description,
        adminId: chat.admin_id,
        createdAt: chat.created_at,
        updatedAt: chat.updated_at,
        members: (members as any[]).map((m: any) => ({
          id: m.id,
          userId: m.user_id,
          role: m.role,
          isMuted: Boolean(m.is_muted),
          joinedAt: m.joined_at,
          user: {
            id: m.user_id,
            name: m.name,
            username: m.username,
            email: m.email,
            avatar: m.avatar,
            lastSeen: m.last_seen
          }
        }))
      });
    }

    res.json({ chats });
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// Create new chat
const createChatSchema = z.object({
  isGroup: z.boolean().default(false),
  groupName: z.string().optional(),
  groupIcon: z.string().optional(),
  description: z.string().optional(),
  memberIds: z.array(z.string()).min(1),
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { isGroup, groupName, groupIcon, description, memberIds } = createChatSchema.parse(req.body);

    const chatId = randomUUID();

    // Create chat
    await db.query(
      `INSERT INTO chats (id, is_group, group_name, group_icon, description, admin_id) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [chatId, isGroup, groupName || null, groupIcon || null, description || null, isGroup ? userId : null]
    );

    // Add creator as member
    await db.query(
      'INSERT INTO chat_members (id, chat_id, user_id, role) VALUES (?, ?, ?, ?)',
      [randomUUID(), chatId, userId, isGroup ? 'admin' : 'member']
    );

    // Add other members
    for (const memberId of memberIds) {
      await db.query(
        'INSERT INTO chat_members (id, chat_id, user_id, role) VALUES (?, ?, ?, ?)',
        [randomUUID(), chatId, memberId, 'member']
      );
    }

    // Get created chat with members
    const [chats] = await db.query('SELECT * FROM chats WHERE id = ?', [chatId]);
    const [members] = await db.query(
      `SELECT 
        cm.id, cm.user_id, cm.role, cm.is_muted, cm.joined_at,
        u.id, u.name, u.username, u.email, u.avatar, u.last_seen
       FROM chat_members cm
       JOIN users u ON cm.user_id = u.id
       WHERE cm.chat_id = ?`,
      [chatId]
    );

    const chat = (chats as any[])[0];
    const chatResponse = {
      ...chat,
      isGroup: Boolean(chat.is_group),
      groupName: chat.group_name,
      groupIcon: chat.group_icon,
      adminId: chat.admin_id,
      createdAt: chat.created_at,
      updatedAt: chat.updated_at,
      members: (members as any[]).map((m: any) => ({
        id: m.id,
        userId: m.user_id,
        role: m.role,
        isMuted: Boolean(m.is_muted),
        joinedAt: m.joined_at,
        user: {
          id: m.user_id,
          name: m.name,
          username: m.username,
          email: m.email,
          avatar: m.avatar,
          lastSeen: m.last_seen
        }
      }))
    };

    // Notify all members via Socket.io
    const allMemberIds = [userId, ...memberIds];
    allMemberIds.forEach((memberId) => {
      const socketId = userSockets.get(memberId);
      if (socketId) {
        io.to(socketId).emit('new_chat', { chat: chatResponse });
      }
    });

    res.status(201).json({ chat: chatResponse });
  } catch (error) {
    console.error('Create chat error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: 'Failed to create chat' });
    await db.query(
      'DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, userId]
    );

    // Notify user via Socket.io
    const socketId = userSockets.get(userId);
    if (socketId) {
      io.to(socketId).emit('removed_from_group', { chatId });
    }

    res.json({ message: 'Left group successfully' });
    const { chatId } = req.params;
    const userId = req.userId!;

    await db.query(
      'DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, userId]
    );

    res.json({ message: 'Left group successfully' });
  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({ error: 'Failed to leave group' });
  }
});

// Remove member
router.delete('/:chatId/members/:memberId', async (req: AuthRequest, res) => {
  try {
    const { chatId, memberId } = req.params;
    const userId = req.userId!;

    // Check if requester is admin
    const [chats] = await db.query(
      'SELECT admin_id FROM chats WHERE id = ?',
      [chatId]
    );
    await db.query(
      'DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, memberId]
    );

    // Notify removed member via Socket.io
    const socketId = userSockets.get(memberId);
    if (socketId) {
      io.to(socketId).emit('removed_from_group', { chatId });
    }

    res.json({ message: 'Member removed successfully' });
    await db.query(
      'DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, memberId]
    );

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

export default router;
