import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import db from '../config/database';

interface AuthSocket extends Socket {
  userId?: string;
}

export const userSockets = new Map<string, string>(); // userId -> socketId

export const initializeSocket = (io: Server) => {
  // Authentication middleware
  io.use(async (socket: AuthSocket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      socket.userId = decoded.userId;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', async (socket: AuthSocket) => {
    const userId = socket.userId!;
    
    // Store user socket mapping
    userSockets.set(userId, socket.id);
    
    console.log(`User connected: ${userId}`);

    // Update user status to online
    await db.query(
      'UPDATE users SET last_seen = CURRENT_TIMESTAMP, presence_status = ? WHERE id = ?',
      ['online', userId]
    ).catch(console.error);

    // Broadcast online status
    socket.broadcast.emit('user_online', { userId });

    // Join user's chat rooms
    const [chatMembers] = await db.query(
      'SELECT chat_id FROM chat_members WHERE user_id = ?',
      [userId]
    );
    
    for (const member of chatMembers as any[]) {
      socket.join(member.chat_id);
    }

    // Handle sending messages
    socket.on('send_message', async ({ chatId, content, type, fileUrl, fileName, replyTo }) => {
      try {
        const messageId = require('crypto').randomUUID();
        
        // Check if message mentions @smartbot
        const mentionsBot = content.toLowerCase().includes('@smartbot');
        
        await db.query(
          `INSERT INTO messages (id, chat_id, user_id, content, type, file_url, file_name, reply_to) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [messageId, chatId, userId, content, type || 'text', fileUrl || null, fileName || null, replyTo || null]
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

        // Update chat's updated_at timestamp
        await db.query(
          'UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [chatId]
        );

        // Broadcast to all users in the chat
        io.to(chatId).emit('new_message', { message: formattedMessage });

        // Check if chat includes SmartBot
        const botId = '00000000-0000-0000-0000-000000000000';
        const [chatMembers] = await db.query(
          'SELECT user_id FROM chat_members WHERE chat_id = ? AND user_id = ?',
          [chatId, botId]
        );

        const isBotInChat = (chatMembers as any[]).length > 0;
        const shouldBotRespond = mentionsBot || (isBotInChat && userId !== botId);

        // Handle AI bot response if mentioned or in bot's direct chat
        if (shouldBotRespond) {
          try {
            const { generateAIResponse } = await import('../services/ai.service');
            
            // Get recent chat history for context
            const [recentMessages] = await db.query(
              `SELECT m.content, u.name 
               FROM messages m
               JOIN users u ON m.user_id = u.id
               WHERE m.chat_id = ?
               ORDER BY m.created_at DESC
               LIMIT 10`,
              [chatId]
            );

            const history = (recentMessages as any[])
              .reverse()
              .map((m: any) => `${m.name}: ${m.content}`);

            // Remove @smartbot mention for cleaner context
            const cleanContent = content.replace(/@smartbot/gi, '').trim();
            
            // Generate AI response
            const aiResponse = await generateAIResponse(cleanContent, history);

            // Send AI response
            const aiMessageId = require('crypto').randomUUID();
            await db.query(
              'INSERT INTO messages (id, chat_id, user_id, content, type) VALUES (?, ?, ?, ?, ?)',
              [aiMessageId, chatId, botId, aiResponse, 'text']
            );

            const aiMessage = {
              id: aiMessageId,
              chatId,
              userId: botId,
              content: aiResponse,
              type: 'text',
              createdAt: new Date(),
              user: {
                id: botId,
                name: 'SmartBot',
                username: 'smartbot',
                avatar: '🤖'
              }
            };

            // Simulate typing delay for more natural feel
            const typingDelay = Math.min(Math.max(aiResponse.length * 20, 1000), 3000);
            setTimeout(() => {
              io.to(chatId).emit('new_message', { message: aiMessage });
            }, typingDelay);
          } catch (error) {
            console.error('AI response error:', error);
          }
        }
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicator
    socket.on('typing', ({ chatId, isTyping }) => {
      socket.to(chatId).emit('user_typing', {
        chatId,
        userId,
        isTyping,
      });
    });

    // Handle message delivered
    socket.on('message_delivered', async ({ messageId, chatId }) => {
      try {
        // Broadcast delivery receipt to chat (so sender knows it was delivered)
        io.to(chatId).emit('message_delivered', { messageId, userId });
      } catch (error) {
        console.error('Mark delivered error:', error);
      }
    });

    // Handle message read
    socket.on('mark_read', async ({ messageId, chatId }) => {
      try {
        const readId = require('crypto').randomUUID();
        await db.query(
          'INSERT INTO message_reads (id, message_id, user_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE read_at = CURRENT_TIMESTAMP',
          [readId, messageId, userId]
        ).catch(() => {}); // Ignore duplicate key errors

        // Broadcast read receipt to chat
        io.to(chatId).emit('message_read', { messageId, userId, readAt: new Date() });
      } catch (error) {
        console.error('Mark read error:', error);
      }
    });

    // Handle presence status update
    socket.on('update_presence', async ({ status }) => {
      try {
        if (['online', 'offline', 'away', 'busy'].includes(status)) {
          await db.query(
            'UPDATE users SET presence_status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?',
            [status, userId]
          );
          
          socket.broadcast.emit('user_presence_changed', { userId, status, lastSeen: new Date() });
        }
      } catch (error) {
        console.error('Update presence error:', error);
      }
    });

    // Handle WebRTC signaling for calls
    socket.on('call_user', ({ targetUserId, offer, callType }) => {
      const targetSocketId = userSockets.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('incoming_call', {
          callerId: userId,
          offer,
          callType // 'voice' or 'video'
        });
      }
    });

    socket.on('call_answer', ({ targetUserId, answer }) => {
      const targetSocketId = userSockets.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call_answered', {
          answer,
          userId
        });
      }
    });

    socket.on('ice_candidate', ({ targetUserId, candidate }) => {
      const targetSocketId = userSockets.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('ice_candidate', {
          candidate,
          userId
        });
      }
    });

    socket.on('end_call', ({ targetUserId }) => {
      const targetSocketId = userSockets.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call_ended', { userId });
      }
    });

    // Handle joining chat room
    socket.on('join_chat', ({ chatId }) => {
      socket.join(chatId);
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${userId}`);
      
      // Remove from online users
      userSockets.delete(userId);

      // Update last seen and presence
      await db.query(
        'UPDATE users SET last_seen = CURRENT_TIMESTAMP, presence_status = ? WHERE id = ?',
        ['offline', userId]
      ).catch(console.error);

      // Broadcast offline status
      socket.broadcast.emit('user_offline', { userId, lastSeen: new Date() });
    });
  });

  console.log('✅ Socket.io initialized');
};
