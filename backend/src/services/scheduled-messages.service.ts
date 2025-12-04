import cron from 'node-cron';
import db from '../config/database';
import crypto from 'crypto';
import { Server as SocketIOServer } from 'socket.io';

export function startScheduledMessagesCron(io: SocketIOServer) {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      // Get messages that should be sent now
      const [messages] = await db.query(
        `SELECT sm.*, u.name, u.username, u.avatar
         FROM scheduled_messages sm
         JOIN users u ON sm.user_id = u.id
         WHERE sm.is_sent = FALSE 
         AND sm.scheduled_time <= NOW()`,
        []
      );

      for (const msg of messages as any[]) {
        try {
          const messageId = crypto.randomUUID();

          // Insert the message
          await db.query(
            `INSERT INTO messages (id, chat_id, user_id, content, type, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [messageId, msg.chat_id, msg.user_id, msg.content, msg.type || 'text', msg.scheduled_time]
          );

          // Get the full message with user data
          const [newMessages] = await db.query(
            `SELECT m.*, u.id as user_id, u.name as user_name, u.username, u.avatar
             FROM messages m
             JOIN users u ON m.user_id = u.id
             WHERE m.id = ?`,
            [messageId]
          );

          const newMessage = (newMessages as any[])[0];
          const formattedMessage = {
            id: newMessage.id,
            chatId: newMessage.chat_id,
            userId: newMessage.user_id,
            content: newMessage.content,
            type: newMessage.type,
            createdAt: newMessage.created_at,
            user: {
              id: newMessage.user_id,
              name: newMessage.user_name,
              username: newMessage.username,
              avatar: newMessage.avatar
            }
          };

          // Emit to chat room
          io.to(msg.chat_id).emit('new_message', { message: formattedMessage });

          // Update chat's updated_at
          await db.query(
            'UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [msg.chat_id]
          );

          // Mark scheduled message as sent or delete if not recurring
          if (msg.is_recurring) {
            // Calculate next occurrence based on pattern
            let nextTime = new Date(msg.scheduled_time);
            
            switch (msg.recurrence_pattern) {
              case 'daily':
                nextTime.setDate(nextTime.getDate() + 1);
                break;
              case 'weekly':
                nextTime.setDate(nextTime.getDate() + 7);
                break;
              case 'monthly':
                nextTime.setMonth(nextTime.getMonth() + 1);
                break;
            }

            await db.query(
              'UPDATE scheduled_messages SET scheduled_time = ? WHERE id = ?',
              [nextTime, msg.id]
            );
          } else {
            await db.query(
              'UPDATE scheduled_messages SET is_sent = TRUE WHERE id = ?',
              [msg.id]
            );
          }

          console.log(`✅ Sent scheduled message: ${msg.id}`);
        } catch (error) {
          console.error('Error sending scheduled message:', msg.id, error);
        }
      }
    } catch (error) {
      console.error('Scheduled messages cron error:', error);
    }
  });

  console.log('✅ Scheduled messages cron job started');
}
