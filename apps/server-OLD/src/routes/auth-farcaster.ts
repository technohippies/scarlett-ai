import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '../auth';
import {
  generateExtensionToken,
  createUser,
  getUserByWallet,
  getUserById,
} from '../auth';

const app = new Hono<{ Bindings: Env }>();

// Enable CORS for Farcaster mini app
app.use(
  '/*',
  cors({
    origin: [
      'http://localhost:3002',
      'https://farcaster.xyz',
      'https://warpcast.com',
    ],
    credentials: true,
  })
);

// Farcaster authentication endpoint
app.post('/api/auth/farcaster', async (c) => {
  try {
    const { fid, username, signer_uuid, displayName, pfpUrl } =
      await c.req.json();

    if (!fid) {
      return c.json({ error: 'Farcaster ID required' }, 400);
    }

    // Create a deterministic wallet address from FID for user identification
    // In production, you might want to use the actual Farcaster custody address
    const farcasterWallet = `0xfc${fid.toString().padStart(38, '0')}`;

    // Check if user exists
    let user = await getUserByWallet(farcasterWallet, c.env);

    if (!user) {
      // Create new user
      user = await createUser(
        {
          email: `${username || fid}@farcaster.id`,
          wallet_address: farcasterWallet,
          display_name: displayName || username || `FC User ${fid}`,
          avatar_url: pfpUrl,
        },
        c.env
      );

      if (!user) {
        return c.json({ error: 'Failed to create user' }, 500);
      }

      // Store Farcaster-specific data
      await c.env.DB.prepare(
        `
        INSERT INTO user_metadata (user_id, key, value)
        VALUES (?, 'farcaster_fid', ?), (?, 'farcaster_username', ?)
        ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value
      `
      )
        .bind(user.id, fid.toString(), user.id, username || '')
        .run();
    }

    // Generate auth token
    const token = await generateExtensionToken(user, c.env);

    return c.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        subscriptionStatus: user.subscription_status,
        creditsRemaining: user.credits_limit - user.credits_used,
      },
    });
  } catch (error) {
    console.error('Farcaster auth error:', error);
    return c.json({ error: 'Authentication failed' }, 500);
  }
});

// Webhook endpoint for Farcaster mini app events
app.post('/webhook/farcaster', async (c) => {
  try {
    const payload = await c.req.json();
    const { event, data } = payload;

    console.log('Farcaster webhook event:', event, data);

    switch (event) {
      case 'frame_added':
        // User added the mini app
        // Store notification token if provided
        if (data.notificationDetails?.token) {
          await c.env.DB.prepare(
            `
            INSERT INTO user_metadata (user_id, key, value)
            VALUES (?, 'farcaster_notification_token', ?)
            ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value
          `
          )
            .bind(data.fid, data.notificationDetails.token)
            .run();
        }
        break;

      case 'frame_removed':
        // User removed the mini app
        // Clean up notification tokens
        await c.env.DB.prepare(
          `
          DELETE FROM user_metadata 
          WHERE user_id = ? AND key = 'farcaster_notification_token'
        `
        )
          .bind(data.fid)
          .run();
        break;
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return c.json({ error: 'Webhook processing failed' }, 500);
  }
});

// Leaderboard endpoint
app.post('/api/karaoke/leaderboard', async (c) => {
  try {
    const { score, trackName, fid, username } = await c.req.json();

    // Get authenticated user from token
    const userId = c.get('user')?.id;
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Save to leaderboard
    await c.env.DB.prepare(
      `
      INSERT INTO farcaster_leaderboard 
      (user_id, fid, username, track_name, score, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `
    )
      .bind(userId, fid, username, trackName, score)
      .run();

    // Get current ranking
    const ranking = await c.env.DB.prepare(
      `
      SELECT COUNT(*) + 1 as rank
      FROM farcaster_leaderboard
      WHERE track_name = ? AND score > ?
    `
    )
      .bind(trackName, score)
      .first();

    return c.json({
      success: true,
      ranking: ranking?.rank || 1,
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    return c.json({ error: 'Failed to save score' }, 500);
  }
});

export default app;
