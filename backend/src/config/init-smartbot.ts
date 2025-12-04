import db from './database';

export async function initializeSmartBot() {
  try {
    const botId = '00000000-0000-0000-0000-000000000000';
    
    // Create SmartBot user if not exists (PostgreSQL uses ON CONFLICT instead of ON DUPLICATE KEY)
    await db.query(
      `INSERT INTO users (id, name, username, email, password_hash, avatar, bio, presence_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET presence_status = 'online', updated_at = CURRENT_TIMESTAMP`,
      [
        botId,
        'SmartBot',
        'smartbot',
        'bot@baatkare.com',
        '',
        '🤖',
        'AI-powered assistant ready to help you anytime! Mention me with @smartbot or chat with me directly.',
        'online'
      ]
    );

    // Get all users except bot
    const [users] = await db.query(
      'SELECT id, name FROM users WHERE id != ?',
      [botId]
    );

    // Create chat with SmartBot for each user who doesn't have one
    for (const user of users as any[]) {
      // Check if user already has a chat with SmartBot
      const [existingChat] = await db.query(
        `SELECT c.id FROM chats c
         JOIN chat_members cm1 ON c.id = cm1.chat_id AND cm1.user_id = ?
         JOIN chat_members cm2 ON c.id = cm2.chat_id AND cm2.user_id = ?
         WHERE c.is_group = false
         LIMIT 1`,
        [user.id, botId]
      );

      if ((existingChat as any[]).length === 0) {
        // Create new chat
        const chatId = require('crypto').randomUUID();
        await db.query(
          'INSERT INTO chats (id, is_group, created_at, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
          [chatId, false]
        );

        // Add chat members
        const member1Id = require('crypto').randomUUID();
        const member2Id = require('crypto').randomUUID();
        await db.query(
          'INSERT INTO chat_members (id, chat_id, user_id, role) VALUES (?, ?, ?, ?), (?, ?, ?, ?)',
          [member1Id, chatId, user.id, 'member', member2Id, chatId, botId, 'member']
        );

        // Send welcome message
        const messageId = require('crypto').randomUUID();
        await db.query(
          `INSERT INTO messages (id, chat_id, user_id, content, type, created_at) 
           VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [
            messageId,
            chatId,
            botId,
            `👋 Hello ${user.name}! I'm SmartBot, your AI companion on Baatkare.\n\nI'm here to:\n✨ Chat with you anytime\n💡 Help solve problems\n🎯 Provide suggestions and advice\n❤️ Understand your emotions\n\nJust send me a message! How can I help you today?`,
            'text'
          ]
        );

        console.log(`✅ Created SmartBot chat for user: ${user.name}`);
      }
    }

    console.log('✅ SmartBot initialized successfully');
  } catch (error) {
    console.error('❌ SmartBot initialization error:', error);
  }
}
