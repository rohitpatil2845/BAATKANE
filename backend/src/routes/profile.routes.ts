import express from 'express';
import { z } from 'zod';
import db from '../config/database';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';

const router = express.Router();

// Get user profile
router.get('/:userId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;

    const [users] = await db.query(
      `SELECT id, name, username, email, avatar, bio, phone, status, 
              presence_status, custom_status, last_seen, created_at
       FROM users WHERE id = ?`,
      [userId]
    );

    if ((users as any[]).length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = (users as any[])[0];

    // Get user settings
    const [settings] = await db.query(
      'SELECT * FROM user_settings WHERE user_id = ?',
      [userId]
    );

    res.json({
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        phone: user.phone,
        status: user.status,
        presenceStatus: user.presence_status,
        customStatus: user.custom_status,
        lastSeen: user.last_seen,
        createdAt: user.created_at
      },
      settings: (settings as any[])[0] || null
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update user profile
router.patch('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { name, bio, phone, avatar, customStatus } = req.body;

    const updates: any = {};
    if (name) updates.name = name;
    if (bio !== undefined) updates.bio = bio;
    if (phone !== undefined) updates.phone = phone;
    if (avatar !== undefined) updates.avatar = avatar;
    if (customStatus !== undefined) updates.custom_status = customStatus;

    if (Object.keys(updates).length > 0) {
      const setClause = Object.keys(updates)
        .map(key => `${key.replace(/([A-Z])/g, '_$1').toLowerCase()} = ?`)
        .join(', ');
      
      await db.query(
        `UPDATE users SET ${setClause} WHERE id = ?`,
        [...Object.values(updates), userId]
      );
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Update user presence status
router.patch('/me/presence', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { status } = req.body;

    if (!['online', 'offline', 'away', 'busy'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await db.query(
      'UPDATE users SET presence_status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?',
      [status, userId]
    );

    res.json({ message: 'Presence updated' });
  } catch (error) {
    console.error('Update presence error:', error);
    res.status(500).json({ error: 'Failed to update presence' });
  }
});

// Get or create user settings
router.get('/me/settings', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    let [settings] = await db.query(
      'SELECT * FROM user_settings WHERE user_id = ?',
      [userId]
    );

    if ((settings as any[]).length === 0) {
      // Create default settings
      const crypto = await import('crypto');
      const settingsId = crypto.randomUUID();
      
      await db.query(
        `INSERT INTO user_settings (id, user_id) VALUES (?, ?)`,
        [settingsId, userId]
      );

      [settings] = await db.query(
        'SELECT * FROM user_settings WHERE user_id = ?',
        [userId]
      );
    }

    const setting = (settings as any[])[0];
    res.json({
      theme: setting.theme,
      notificationsEnabled: Boolean(setting.notifications_enabled),
      soundEnabled: Boolean(setting.sound_enabled),
      emailNotifications: Boolean(setting.email_notifications),
      showLastSeen: Boolean(setting.show_last_seen),
      showProfilePhoto: Boolean(setting.show_profile_photo)
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// Update user settings
router.patch('/me/settings', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { theme, notificationsEnabled, soundEnabled, emailNotifications, showLastSeen, showProfilePhoto } = req.body;

    const updates: any = {};
    if (theme) updates.theme = theme;
    if (notificationsEnabled !== undefined) updates.notifications_enabled = notificationsEnabled;
    if (soundEnabled !== undefined) updates.sound_enabled = soundEnabled;
    if (emailNotifications !== undefined) updates.email_notifications = emailNotifications;
    if (showLastSeen !== undefined) updates.show_last_seen = showLastSeen;
    if (showProfilePhoto !== undefined) updates.show_profile_photo = showProfilePhoto;

    if (Object.keys(updates).length > 0) {
      const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      
      await db.query(
        `UPDATE user_settings SET ${setClause} WHERE user_id = ?`,
        [...Object.values(updates), userId]
      );
    }

    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
