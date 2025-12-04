import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

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

  io.on('connection', (socket: AuthSocket) => {
    const userId = socket.userId!;
    console.log(`User connected: ${userId}`);

    // Store user socket mapping
    userSockets.set(userId, socket.id);

    // Update user status to online
    prisma.user.update({
      where: { id: userId },
      data: { lastSeen: new Date() },
    }).catch(console.error);

    // Broadcast online status to user's contacts
    socket.broadcast.emit('user_online', { userId });

    // Join user's chat rooms
    prisma.chatMember.findMany({
      where: { userId },
      select: { chatId: true },
    }).then((chatMembers) => {
      chatMembers.forEach((cm) => {
        socket.join(cm.chatId);
      });
    }).catch(console.error);

    // Handle joining a chat
    socket.on('join_chat', async (data: { chatId: string }) => {
      try {
        const { chatId } = data;

        // Verify user is member
        const chatMember = await prisma.chatMember.findUnique({
          where: {
            chatId_userId: { chatId, userId },
          },
        });

        if (chatMember) {
          socket.join(chatId);
          console.log(`User ${userId} joined chat ${chatId}`);
        }
      } catch (error) {
        console.error('Join chat error:', error);
      }
    });

    // Handle sending message
    socket.on('send_message', async (data: {
      chatId: string;
      content: string;
      type?: string;
      replyTo?: string;
    }) => {
      try {
        const { chatId, content, type = 'text', replyTo } = data;

        // Verify user is member
        const chatMember = await prisma.chatMember.findUnique({
          where: {
            chatId_userId: { chatId, userId },
          },
        });

        if (!chatMember) {
          return socket.emit('error', { message: 'Access denied' });
        }

        // Check for AI bot mention
        if (content.includes('@smartbot') || content.includes('@ai')) {
          // Extract question
          const question = content.replace(/@smartbot|@ai/gi, '').trim();
          
          // Emit typing indicator
          io.to(chatId).emit('bot_typing', { chatId });

          // Get AI response (simplified - in production, call AI service)
          setTimeout(async () => {
            const botMessage = await prisma.message.create({
              data: {
                chatId,
                userId: 'system', // System/bot user
                content: `🤖 AI Assistant: I received your question "${question}". AI features require OpenAI API key configuration.`,
                type: 'text',
              },
              include: {
                user: {
                  select: { id: true, name: true, avatar: true },
                },
              },
            });

            io.to(chatId).emit('new_message', { message: botMessage });
          }, 1500);
        }

        // Create message
        const message = await prisma.message.create({
          data: {
            chatId,
            userId,
            content,
            type,
            replyTo,
          },
          include: {
            user: {
              select: { id: true, name: true, avatar: true },
            },
          },
        });

        // Update chat timestamp
        await prisma.chat.update({
          where: { id: chatId },
          data: { updatedAt: new Date() },
        });

        // Broadcast to chat room
        io.to(chatId).emit('new_message', { message });

        console.log(`Message sent in chat ${chatId}`);
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicator
    socket.on('typing', async (data: { chatId: string; isTyping: boolean }) => {
      try {
        const { chatId, isTyping } = data;

        // Broadcast to others in chat
        socket.to(chatId).emit('user_typing', {
          chatId,
          userId,
          isTyping,
        });
      } catch (error) {
        console.error('Typing error:', error);
      }
    });

    // Handle marking message as read
    socket.on('mark_read', async (data: { messageId: string; chatId: string }) => {
      try {
        const { messageId, chatId } = data;

        await prisma.messageRead.upsert({
          where: {
            messageId_userId: { messageId, userId },
          },
          create: {
            messageId,
            userId,
          },
          update: {
            readAt: new Date(),
          },
        });

        // Broadcast read receipt
        io.to(chatId).emit('message_read', {
          messageId,
          userId,
          readAt: new Date(),
        });
      } catch (error) {
        console.error('Mark read error:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${userId}`);
      userSockets.delete(userId);

      // Update last seen
      await prisma.user.update({
        where: { id: userId },
        data: { lastSeen: new Date() },
      }).catch(console.error);

      // Broadcast offline status
      socket.broadcast.emit('user_offline', { userId, lastSeen: new Date() });
    });
  });

  console.log('✅ Socket.io initialized');
};
