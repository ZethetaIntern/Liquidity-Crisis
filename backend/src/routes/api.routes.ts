import { Router } from 'express';
import { signup, login, getMe } from '../controllers/auth.controller';
import { createRoom, joinRoom, getLeaderboard } from '../controllers/room.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { SimulationEngine } from '../services/simulation.service';
import { db } from '../config/db';

const router = Router();

// --- Public Auth Routes ---
router.post('/auth/signup', signup);
router.post('/auth/login', login);

// --- Secure User Profile ---
router.get('/auth/me', authenticateToken, getMe);

// --- Secure Room Routes ---
router.post('/rooms/create', authenticateToken, createRoom);
router.post('/rooms/join', authenticateToken, joinRoom);
router.get('/leaderboard', authenticateToken, getLeaderboard);

// --- Admin Controls HUD (For manual overrides) ---
router.post('/admin/trigger-shock', authenticateToken, async (req, res) => {
  try {
    const { roomCode, shockType } = req.body;
    if (!roomCode || !shockType) {
      return res.status(400).json({ error: 'roomCode and shockType are required' });
    }

    const session = await db.sessions.findByCode(roomCode);
    if (!session || session.status !== 'PLAYING') {
      return res.status(404).json({ error: 'Active playing room session not found' });
    }

    const gameState = SimulationEngine.getGame(session.id);
    if (!gameState) {
      return res.status(400).json({ error: 'Game simulation not running in memory for this session' });
    }

    let shockLabel = '';
    let shockDetail = '';

    if (shockType === 'FED_INTEREST_HIKE') {
      // Shocks funding stress: drops LCR and NSFR instantly
      gameState.lcr = Math.max(35, gameState.lcr - 15.0);
      gameState.nsfr = Math.max(35, gameState.nsfr - 12.0);
      gameState.panicIndex = Math.min(100, gameState.panicIndex + 10.0);
      shockLabel = 'Federal Reserve Rate Hike';
      shockDetail = 'Fed announces unexpected 75bps rate hike! Wholesale borrowing rates spike immediately.';
    } else if (shockType === 'RATING_DOWNGRADE') {
      // Shocks panic and spreads: asset prices crash
      gameState.panicIndex = Math.min(100, gameState.panicIndex + 25.0);
      gameState.assetPrice = Math.max(30, gameState.assetPrice - 20.0);
      shockLabel = 'Sovereign Rating Downgrade';
      shockDetail = 'Ratings agency downgrades national debt to BBB-. Sovereign collateral values collapse.';
    } else if (shockType === 'LIQUIDITY_CRUNCH') {
      // Immediate cash drain
      gameState.portfolio.cash = Math.max(10, gameState.portfolio.cash - 25.0);
      gameState.lcr = Math.max(30, gameState.lcr - 25.0);
      shockLabel = 'Interbank Capital Crunch';
      shockDetail = 'Major settlement clearers halt credit lending, locking $25M of our active cash reserves.';
    } else {
      return res.status(400).json({ error: `Unsupported shockType: ${shockType}` });
    }

    // Log the shock in DB
    await db.crisis.log(session.id, shockLabel, shockDetail, 'CRITICAL');
    await db.audit.log(session.id, 'ADMIN', `Triggered manual admin shock: ${shockLabel}.`, 'ADMIN_SHOCK');

    return res.status(200).json({
      message: 'Admin shock successfully executed!',
      shock: shockLabel,
      gameState: {
        panicIndex: gameState.panicIndex,
        lcr: gameState.lcr,
        nsfr: gameState.nsfr,
        cash: gameState.portfolio.cash,
      },
    });
  } catch (err: any) {
    console.error('Trigger shock error:', err);
    return res.status(500).json({ error: 'Failed to inject manual admin shock' });
  }
});

// --- Audit & Crisis logs query (For rendering history logs) ---
router.get('/rooms/:roomCode/logs', authenticateToken, async (req, res) => {
  try {
    const { roomCode } = req.params;
    const session = await db.sessions.findByCode(roomCode);
    if (!session) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const audits = await db.audit.getBySession(session.id);
    const crises = await db.crisis.getBySession(session.id);
    const charts = await db.market.getHistory(session.id);

    return res.status(200).json({
      audits,
      crises,
      charts: charts.slice(-40), // return last 40 historical ticks
    });
  } catch (err) {
    console.error('Get room logs error:', err);
    return res.status(500).json({ error: 'Failed to retrieve game room history reports' });
  }
});

export default router;
