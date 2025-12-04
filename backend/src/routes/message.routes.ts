import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// Send message
const sendMessageSchema = z.object({
  chatId: z.string(),
  content: z.string(),
  type: z.enum(['text', 'image', 'file', 'voice', 'emoji']).default('text'),
  replyTo: z.string().optional(),
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { chatId, content, type, replyTo } = sendMessageSchema.parse(req.body);

    // Verify user is member of chat
    const chatMember = await prisma.chatMember.findUnique({
      where: {
        chatId_userId: { chatId, userId },
      },
    });

    if (!chatMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Handle file upload if present
    let fileUrl = null;
    let fileName = null;
    let fileSize = null;

    if (req.files && req.files.file) {
      const file: any = req.files.file;
      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      
      // Create upload directory if not exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const uniqueName = `${Date.now()}-${file.name}`;
      const filePath = path.join(uploadDir, uniqueName);
      
      await file.mv(filePath);
      
      fileUrl = `/uploads/${uniqueName}`;
      fileName = file.name;
      fileSize = file.size;
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        chatId,
        userId,
        content,
        type,
        fileUrl,
        fileName,
        fileSize,
        replyTo,
      },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    // Update chat updated_at
    await prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    });

    res.status(201).json({ message });
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

    res.json({ message: 'Message marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

// Delete message
router.delete('/:messageId', async (req: AuthRequest, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.userId!;

    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message || message.userId !== userId) {
      return res.status(403).json({ error: 'Cannot delete this message' });
    }

    await prisma.message.update({
      where: { id: messageId },
      data: { isDeleted: true, content: 'This message was deleted' },
    });

    res.json({ message: 'Message deleted' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Pin/unpin message
router.patch('/:messageId/pin', async (req: AuthRequest, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.userId!;
    const { isPinned } = z.object({ isPinned: z.boolean() }).parse(req.body);

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { chat: true },
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Verify user is admin for group chats
    if (message.chat.isGroup) {
      const chatMember = await prisma.chatMember.findUnique({
        where: {
          chatId_userId: { chatId: message.chatId, userId },
        },
      });

      if (!chatMember || chatMember.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can pin messages' });
      }
    }

    await prisma.message.update({
      where: { id: messageId },
      data: { isPinned },
    });

    res.json({ message: `Message ${isPinned ? 'pinned' : 'unpinned'}` });
  } catch (error) {
    console.error('Pin message error:', error);
    res.status(500).json({ error: 'Failed to pin message' });
  }
});

export default router;
