import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';
import { z } from 'zod';
import { io } from '../server';
import { userSockets } from '../socket/socket.handler';

const router = Router();
const prisma = new PrismaClient();

// All routes require authentication
router.use(authenticateToken);

// Get all chats for current user
router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const chatMembers = await prisma.chatMember.findMany({
      where: { userId },
      include: {
        chat: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatar: true,
                    lastSeen: true,
                  },
                },
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                user: {
                  select: { id: true, name: true, avatar: true },
                },
              },
            },
          },
        },
      },
      orderBy: {
        chat: {
          updatedAt: 'desc',
        },
      },
    });

    const chats = chatMembers.map((cm) => ({
      ...cm.chat,
      lastMessage: cm.chat.messages[0] || null,
    }));

    res.json({ chats });
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// Create new chat (one-to-one or group)
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

    // For one-to-one chat, check if chat already exists
    if (!isGroup && memberIds.length === 1) {
      const existingChat = await prisma.chat.findFirst({
        where: {
          isGroup: false,
          members: {
            every: {
              userId: { in: [userId, memberIds[0]] },
            },
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatar: true, lastSeen: true },
              },
            },
          },
        },
      });

      if (existingChat) {
        return res.json({ chat: existingChat });
      }
    }

    // Create new chat
    const chat = await prisma.chat.create({
      data: {
        isGroup,
        groupName: isGroup ? groupName : null,
        groupIcon,
        description,
        adminId: isGroup ? userId : null,
        members: {
          create: [
            { userId, role: isGroup ? 'admin' : 'member' },
            ...memberIds.map((id) => ({ userId: id, role: 'member' })),
          ],
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true, lastSeen: true },
            },
          },
        },
      },
    });

    // Notify all members about the new chat via Socket.io
    const allMemberIds = [userId, ...memberIds];
    allMemberIds.forEach((memberId) => {
      const socketId = userSockets.get(memberId);
      if (socketId) {
        io.to(socketId).emit('new_chat', { chat });
      }
    });

    res.status(201).json({ chat });
  } catch (error) {
    console.error('Create chat error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

// Get chat by ID
router.get('/:chatId', async (req: AuthRequest, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId!;

    // Verify user is member of chat
    const chatMember = await prisma.chatMember.findUnique({
      where: {
        chatId_userId: { chatId, userId },
      },
    });

    if (!chatMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true, lastSeen: true },
            },
          },
        },
      },
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    res.json({ chat });
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

// Get messages for a chat
router.get('/:chatId/messages', async (req: AuthRequest, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId!;
    const { limit = '50', before } = req.query;

    // Verify user is member
    const chatMember = await prisma.chatMember.findUnique({
      where: {
        chatId_userId: { chatId, userId },
      },
    });

    if (!chatMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messages = await prisma.message.findMany({
      where: {
        chatId,
        ...(before && { createdAt: { lt: new Date(before as string) } }),
      },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
        messageReads: {
          include: {
            user: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
    });

    res.json({ messages: messages.reverse() });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Add member to group
router.post('/:chatId/members', async (req: AuthRequest, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId!;
    const { memberIds } = z.object({ memberIds: z.array(z.string()) }).parse(req.body);

    // Verify user is admin
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        members: {
          where: { userId, role: 'admin' },
        },
      },
    });

    if (!chat || !chat.isGroup || chat.members.length === 0) {
      return res.status(403).json({ error: 'Only group admins can add members' });
    }

    // Add members
    await prisma.chatMember.createMany({
      data: memberIds.map((id) => ({ chatId, userId: id, role: 'member' })),
      skipDuplicates: true,
    });

    res.json({ message: 'Members added successfully' });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ error: 'Failed to add members' });
  }
});

// Remove member from group
router.delete('/:chatId/members/:memberId', async (req: AuthRequest, res) => {
  try {
    const { chatId, memberId } = req.params;
    const userId = req.userId!;

    // Verify user is admin or removing themselves
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        members: {
          where: { userId, role: 'admin' },
        },
      },
    });

    if (!chat || !chat.isGroup) {
      return res.status(403).json({ error: 'Invalid operation' });
    }

    if (chat.members.length === 0 && userId !== memberId) {
      return res.status(403).json({ error: 'Only admins can remove members' });
    }

    await prisma.chatMember.delete({
      where: {
        chatId_userId: { chatId, userId: memberId },
      },
    });

    // Notify the removed member via socket
    const socketId = userSockets.get(memberId);
    if (socketId) {
      io.to(socketId).emit('removed_from_group', { chatId, groupName: chat.groupName });
    }

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Leave group
router.post('/:chatId/leave', async (req: AuthRequest, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId!;

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat || !chat.isGroup) {
      return res.status(400).json({ error: 'Not a group chat' });
    }

    if (chat.adminId === userId) {
      return res.status(400).json({ error: 'Admin cannot leave group. Transfer admin rights first or delete the group.' });
    }

    await prisma.chatMember.delete({
      where: {
        chatId_userId: { chatId, userId },
      },
    });

    // Notify other members
    const members = await prisma.chatMember.findMany({
      where: { chatId },
      include: { user: true },
    });

    members.forEach((member) => {
      const socketId = userSockets.get(member.userId);
      if (socketId) {
        io.to(socketId).emit('member_left_group', { 
          chatId, 
          userId,
          groupName: chat.groupName 
        });
      }
    });

    res.json({ message: 'Left group successfully' });
  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({ error: 'Failed to leave group' });
  }
});

export default router;
