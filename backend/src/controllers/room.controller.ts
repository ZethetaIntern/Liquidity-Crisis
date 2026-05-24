import { Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

// Generate a random 6-character uppercase alphanumeric room invite code
const generateInviteCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const createRoom = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let roomCode = generateInviteCode();
    let existing = await db.sessions.findByCode(roomCode);

    // Keep generating if code collision
    while (existing) {
      roomCode = generateInviteCode();
      existing = await db.sessions.findByCode(roomCode);
    }

    const session = await db.sessions.create(roomCode, req.userId);
    // Automatically join creator as player
    await db.players.join(session.id, req.userId);

    return res.status(201).json({
      message: 'Room created successfully',
      roomCode: session.roomCode,
      sessionId: session.id,
      status: session.status,
    });
  } catch (err: any) {
    console.error('Create room error:', err);
    return res.status(500).json({ error: 'Failed to create room' });
  }
};

export const joinRoom = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { roomCode } = req.body;
    if (!roomCode) {
      return res.status(400).json({ error: 'Invite room code is required' });
    }

    const session = await db.sessions.findByCode(roomCode);
    if (!session) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (session.status !== 'LOBBY') {
      return res.status(400).json({ error: 'Game has already started or completed in this room' });
    }

    const players = await db.players.findBySession(session.id);
    if (players.length >= 4) {
      // Check if user is already in the room
      const alreadyIn = players.some((p) => p.userId === req.userId);
      if (!alreadyIn) {
        return res.status(400).json({ error: 'Room is already full (max 4 players)' });
      }
    }

    await db.players.join(session.id, req.userId);

    return res.status(200).json({
      message: 'Joined room successfully',
      roomCode: session.roomCode,
      sessionId: session.id,
      status: session.status,
    });
  } catch (err: any) {
    console.error('Join room error:', err);
    return res.status(500).json({ error: 'Failed to join room' });
  }
};

export const getLeaderboard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const list = await db.leaderboard.getTop(15);
    return res.status(200).json({ leaderboard: list });
  } catch (err: any) {
    console.error('Get leaderboard error:', err);
    return res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
};
