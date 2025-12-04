import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';
import { z } from 'zod';
import db from '../config/database';
import { randomUUID } from 'crypto';
import { io } from '../server';
import { userSockets } from '../socket/socket.handler.new';

const router = Router();

router.use(authenticateToken);

// Search public groups
router.get('/search', async (req: AuthRequest, res) => {
  try {
    const { q } = req.query;
    const userId = req.userId!;

    if (!q || typeof q !== 'string') {
      return res.json({ groups: [] });
    }

    const [groups] = await db.query(
      `SELECT c.*, 
        (SELECT COUNT(*) FROM chat_members WHERE chat_id = c.id) as member_count,
        (SELECT COUNT(*) FROM chat_members WHERE chat_id = c.id AND user_id = ?) as is_member,
        (SELECT COUNT(*) FROM join_requests WHERE chat_id = c.id AND user_id = ? AND status = 'pending') as has_pending_request
       FROM chats c
       WHERE c.is_group = true AND c.group_name LIKE ?
       LIMIT 20`,
      [userId, userId, `%${q}%`]
    );

    const formattedGroups = (groups as any[]).map(g => ({
      id: g.id,
      groupName: g.group_name,
      groupIcon: g.group_icon,
      description: g.description,
      memberCount: g.member_count,
      isMember: g.is_member > 0,
      hasPendingRequest: g.has_pending_request > 0
    }));

    res.json({ groups: formattedGroups });
  } catch (error) {
    console.error('Search groups error:', error);
    res.status(500).json({ error: 'Failed to search groups' });
  }
});

// Get all chats for current user
router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const [chatMembers] = await db.query(
      `SELECT DISTINCT
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

      // Get last message
      const [lastMessages] = await db.query(
        `SELECT m.*, u.name as user_name, u.avatar
         FROM messages m
         JOIN users u ON m.user_id = u.id
         WHERE m.chat_id = ?
         ORDER BY m.created_at DESC
         LIMIT 1`,
        [chat.id]
      );

      const lastMessage = (lastMessages as any[])[0];

      // Get unread count for this user
      const [unreadResult] = await db.query(
        `SELECT COUNT(*) as count
         FROM messages m
         LEFT JOIN message_reads mr ON m.id = mr.message_id AND mr.user_id = ?
         WHERE m.chat_id = ? AND m.user_id != ? AND mr.id IS NULL`,
        [userId, chat.id, userId]
      );

      const unreadCount = (unreadResult as any[])[0]?.count || 0;

      chats.push({
        id: chat.id,
        isGroup: Boolean(chat.is_group),
        groupName: chat.group_name,
        groupIcon: chat.group_icon,
        description: chat.description,
        adminId: chat.admin_id,
        createdAt: chat.created_at,
        updatedAt: chat.updated_at,
        unreadCount: Number(unreadCount),
        lastMessage: lastMessage ? {
          id: lastMessage.id,
          content: lastMessage.content,
          type: lastMessage.type,
          createdAt: lastMessage.created_at,
          user: {
            id: lastMessage.user_id,
            name: lastMessage.user_name,
            avatar: lastMessage.avatar
          }
        } : null,
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

// Get messages for a chat
router.get('/:chatId/messages', async (req: AuthRequest, res) => {
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

    // Get read receipts for all messages
    const messageIds = (messages as any[]).map((m: any) => m.id);
    let readReceipts: any[] = [];
    
    if (messageIds.length > 0) {
      const placeholders = messageIds.map(() => '?').join(',');
      const [reads] = await db.query(
        `SELECT mr.message_id, mr.user_id, mr.read_at, u.name, u.username
         FROM message_reads mr
         JOIN users u ON mr.user_id = u.id
         WHERE mr.message_id IN (${placeholders})`,
        messageIds
      );
      readReceipts = reads as any[];
    }

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
      },
      readBy: readReceipts
        .filter(r => r.message_id === m.id)
        .map(r => ({
          userId: r.user_id,
          userName: r.name,
          username: r.username,
          readAt: r.read_at
        }))
    }));

    res.json({ messages: formattedMessages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
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
  }
});

// Leave group
router.post('/:chatId/leave', async (req: AuthRequest, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId!;

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
  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({ error: 'Failed to leave group' });
  }
});

// Send join request
router.post('/:chatId/join-request', async (req: AuthRequest, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId!;

    // Check if already a member
    const [membership] = await db.query(
      'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, userId]
    );

    if ((membership as any[]).length > 0) {
      return res.status(400).json({ error: 'Already a member of this group' });
    }

    // Check if already has pending request
    const [existing] = await db.query(
      'SELECT * FROM join_requests WHERE chat_id = ? AND user_id = ? AND status = ?',
      [chatId, userId, 'pending']
    );

    if ((existing as any[]).length > 0) {
      return res.status(400).json({ error: 'Join request already sent' });
    }

    const requestId = randomUUID();
    await db.query(
      'INSERT INTO join_requests (id, chat_id, user_id, status) VALUES (?, ?, ?, ?)',
      [requestId, chatId, userId, 'pending']
    );

    // Notify group admin
    const [chats] = await db.query('SELECT admin_id FROM chats WHERE id = ?', [chatId]);
    const chat = (chats as any[])[0];
    if (chat && chat.admin_id) {
      const socketId = userSockets.get(chat.admin_id);
      if (socketId) {
        io.to(socketId).emit('join_request_received', { chatId, userId, requestId });
      }
    }

    res.status(201).json({ message: 'Join request sent successfully' });
  } catch (error) {
    console.error('Send join request error:', error);
    res.status(500).json({ error: 'Failed to send join request' });
  }
});

// Get pending join requests for a group
router.get('/:chatId/join-requests', async (req: AuthRequest, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId!;

    // Check if user is admin
    const [chats] = await db.query('SELECT admin_id FROM chats WHERE id = ?', [chatId]);
    const chat = (chats as any[])[0];
    
    if (!chat || chat.admin_id !== userId) {
      return res.status(403).json({ error: 'Only admin can view join requests' });
    }

    const [requests] = await db.query(
      `SELECT jr.*, u.id as user_id, u.name, u.username, u.avatar
       FROM join_requests jr
       JOIN users u ON jr.user_id = u.id
       WHERE jr.chat_id = ? AND jr.status = 'pending'
       ORDER BY jr.created_at DESC`,
      [chatId]
    );

    const formattedRequests = (requests as any[]).map(r => ({
      id: r.id,
      chatId: r.chat_id,
      status: r.status,
      createdAt: r.created_at,
      user: {
        id: r.user_id,
        name: r.name,
        username: r.username,
        avatar: r.avatar
      }
    }));

    res.json({ requests: formattedRequests });
  } catch (error) {
    console.error('Get join requests error:', error);
    res.status(500).json({ error: 'Failed to fetch join requests' });
  }
});

// Approve/reject join request
router.patch('/:chatId/join-requests/:requestId', async (req: AuthRequest, res) => {
  try {
    const { chatId, requestId } = req.params;
    const { action } = req.body; // 'approve' or 'reject'
    const userId = req.userId!;

    // Check if user is admin
    const [chats] = await db.query('SELECT admin_id FROM chats WHERE id = ?', [chatId]);
    const chat = (chats as any[])[0];
    
    if (!chat || chat.admin_id !== userId) {
      return res.status(403).json({ error: 'Only admin can manage join requests' });
    }

    const [requests] = await db.query('SELECT * FROM join_requests WHERE id = ?', [requestId]);
    const request = (requests as any[])[0];

    if (!request) {
      return res.status(404).json({ error: 'Join request not found' });
    }

    if (action === 'approve') {
      // Add user to group
      await db.query(
        'INSERT INTO chat_members (id, chat_id, user_id, role) VALUES (?, ?, ?, ?)',
        [randomUUID(), chatId, request.user_id, 'member']
      );

      // Update request status
      await db.query(
        'UPDATE join_requests SET status = ? WHERE id = ?',
        ['approved', requestId]
      );

      // Notify user
      const socketId = userSockets.get(request.user_id);
      if (socketId) {
        // Send new chat info
        const [chatData] = await db.query('SELECT * FROM chats WHERE id = ?', [chatId]);
        const [members] = await db.query(
          `SELECT cm.*, u.* FROM chat_members cm
           JOIN users u ON cm.user_id = u.id
           WHERE cm.chat_id = ?`,
          [chatId]
        );
        
        const chatResponse = {
          ...(chatData as any[])[0],
          isGroup: true,
          members: members
        };
        
        io.to(socketId).emit('join_request_approved', { chatId, chat: chatResponse });
      }

      res.json({ message: 'Join request approved' });
    } else {
      // Update request status
      await db.query(
        'UPDATE join_requests SET status = ? WHERE id = ?',
        ['rejected', requestId]
      );

      // Notify user
      const socketId = userSockets.get(request.user_id);
      if (socketId) {
        io.to(socketId).emit('join_request_rejected', { chatId });
      }

      res.json({ message: 'Join request rejected' });
    }
  } catch (error) {
    console.error('Manage join request error:', error);
    res.status(500).json({ error: 'Failed to manage join request' });
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

    const chat = (chats as any[])[0];
    if (chat.admin_id !== userId) {
      return res.status(403).json({ error: 'Only admin can remove members' });
    }

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
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

export default router;
