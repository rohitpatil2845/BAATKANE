import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';
import { z } from 'zod';
import OpenAI from 'openai';
import db from '../config/database';

const router = Router();

// Initialize OpenAI (will be null if API key not provided)
let openai: OpenAI | null = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

router.use(authenticateToken);

// AI Message Suggestions
const suggestSchema = z.object({
  context: z.string(),
  type: z.enum(['reply', 'compose', 'complete']).default('compose'),
});

router.post('/suggest', async (req: AuthRequest, res) => {
  try {
    if (!openai) {
      return res.status(503).json({ error: 'AI service not configured' });
    }

    const { context, type } = suggestSchema.parse(req.body);

    const prompts = {
      reply: `Based on this message: "${context}", suggest 3 short, natural reply options (each under 10 words).`,
      compose: `Based on this context: "${context}", suggest how to complete this message naturally.`,
      complete: `Complete this sentence naturally: "${context}"`,
    };

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that suggests natural, friendly chat responses.' },
        { role: 'user', content: prompts[type] },
      ],
      max_tokens: 100,
      temperature: 0.7,
    });

    const suggestion = completion.choices[0]?.message?.content || '';

    res.json({ suggestion });
  } catch (error) {
    console.error('AI suggest error:', error);
    res.status(500).json({ error: 'Failed to generate suggestion' });
  }
});

// AI Chat Summarization
const summarizeSchema = z.object({
  chatId: z.string(),
  messageCount: z.number().int().min(1).max(100).default(50),
});

router.post('/summarize', async (req: AuthRequest, res) => {
  try {
    if (!openai) {
      return res.status(503).json({ error: 'AI service not configured' });
    }

    const userId = req.userId!;
    const { chatId, messageCount } = summarizeSchema.parse(req.body);

    // Verify user is member
    const chatMember = await prisma.chatMember.findUnique({
      where: {
        chatId_userId: { chatId, userId },
      },
    });

    if (!chatMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Fetch messages
    const messages = await prisma.message.findMany({
      where: { chatId },
      include: {
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: messageCount,
    });

    if (messages.length === 0) {
      return res.json({ summary: 'No messages to summarize.' });
    }

    const chatHistory = messages
      .reverse()
      .map((m) => `${m.user.name}: ${m.content}`)
      .join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that summarizes chat conversations concisely.',
        },
        {
          role: 'user',
          content: `Summarize this chat conversation in 3-4 bullet points:\n\n${chatHistory}`,
        },
      ],
      max_tokens: 200,
    });

    const summary = completion.choices[0]?.message?.content || 'Unable to generate summary.';

    res.json({ summary, messageCount: messages.length });
  } catch (error) {
    console.error('AI summarize error:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// AI Content Moderation
const moderateSchema = z.object({
  content: z.string(),
});

router.post('/moderate', async (req: AuthRequest, res) => {
  try {
    if (!openai) {
      // Simple fallback moderation without AI
      const { content } = moderateSchema.parse(req.body);
      const badWords = ['spam', 'abuse', 'offensive']; // Simplified list
      const flagged = badWords.some((word) => content.toLowerCase().includes(word));
      
      return res.json({
        flagged,
        category: flagged ? 'potentially-harmful' : 'safe',
        confidence: 0.5,
      });
    }

    const { content } = moderateSchema.parse(req.body);

    const moderation = await openai.moderations.create({
      input: content,
    });

    const result = moderation.results[0];

    res.json({
      flagged: result.flagged,
      categories: result.categories,
      categoryScores: result.category_scores,
    });
  } catch (error) {
    console.error('AI moderate error:', error);
    res.status(500).json({ error: 'Failed to moderate content' });
  }
});

// AI Bot Response (for @mention)
const botResponseSchema = z.object({
  question: z.string(),
  chatId: z.string(),
});

router.post('/bot-response', async (req: AuthRequest, res) => {
  try {
    if (!openai) {
      return res.json({
        response: 'AI bot is not configured. Please add OPENAI_API_KEY to your environment variables.',
      });
    }

    const { question, chatId } = botResponseSchema.parse(req.body);

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful AI assistant in a chat application. Provide concise, friendly responses.',
        },
        { role: 'user', content: question },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content || 'I apologize, I could not generate a response.';

    res.json({ response });
  } catch (error) {
    console.error('AI bot response error:', error);
    res.status(500).json({ error: 'Failed to generate bot response' });
  }
});

export default router;
