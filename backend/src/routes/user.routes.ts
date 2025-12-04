import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';
import db from '../config/database';

const router = Router();

router.use(authenticateToken);

// Search users by username
router.get('/search', async (req: AuthRequest, res) => {
  try {
    const { q } = req.query;
    const userId = req.userId!;

    if (!q || typeof q !== 'string') {
      return res.json({ users: [] });
    }

    const [users] = await db.query(
      `SELECT id, name, username, email, avatar, status, last_seen 
       FROM users 
       WHERE username LIKE ? AND id != ?
       LIMIT 20`,
      [`%${q}%`, userId]
    );

    res.json({ users });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Get current user profile
router.get('/me', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const [users] = await db.query(
      'SELECT id, name, username, email, avatar, status, last_seen FROM users WHERE id = ?',
      [userId]
    );

    const user = (users as any[])[0];
    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

export default router;
