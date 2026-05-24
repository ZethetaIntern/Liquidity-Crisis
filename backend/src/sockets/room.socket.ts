import { Server, Socket } from 'socket.io';
import { db } from '../config/db';
import { SimulationEngine } from '../services/simulation.service';
import { PuzzleService } from '../services/puzzle.service';

export const registerSocketHandlers = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // --- Lobby Room Joining ---
    socket.on('join_room', async (payload: { roomCode: string; userId: number }) => {
      const { roomCode, userId } = payload;
      try {
        const session = await db.sessions.findByCode(roomCode);
        if (!session) {
          socket.emit('error_alert', { message: 'Room not found' });
          return;
        }

        socket.join(roomCode);
        socket.data.roomCode = roomCode;
        socket.data.userId = userId;
        socket.data.sessionId = session.id;

        // Auto join database table
        await db.players.join(session.id, userId);
        
        // Fetch updated player lists
        const players = await db.players.findBySession(session.id);
        
        // Broadcast new list to everyone in room
        io.to(roomCode).emit('room_state_updated', {
          roomCode,
          sessionId: session.id,
          status: session.status,
          players: players.map((p) => ({
            id: p.id,
            userId: p.userId,
            username: p.username,
            role: p.role,
            ready: p.ready,
          })),
        });

        // Log join action to audit logs
        const userObj = await db.users.findById(userId);
        await db.audit.log(session.id, 'SYSTEM', `${userObj?.username || 'Player'} joined the escape lobby.`, 'ROOM_JOIN');
      } catch (err) {
        console.error('Socket join_room error:', err);
        socket.emit('error_alert', { message: 'Failed to join lobby channel' });
      }
    });

    // --- Dynamic Role Locking ---
    socket.on('select_role', async (payload: { role: 'RISK_MANAGER' | 'TREASURY_MANAGER' | 'TRADER' | 'ANALYST' | null }) => {
      const { role } = payload;
      const { roomCode, userId, sessionId } = socket.data;

      if (!roomCode || !userId || !sessionId) {
        socket.emit('error_alert', { message: 'Session data not initialized' });
        return;
      }

      try {
        await db.players.updateRole(sessionId, userId, role);
        
        // Broadcast updated players list with new roles
        const players = await db.players.findBySession(sessionId);
        io.to(roomCode).emit('room_state_updated', {
          roomCode,
          sessionId,
          players: players.map((p) => ({
            id: p.id,
            userId: p.userId,
            username: p.username,
            role: p.role,
            ready: p.ready,
          })),
        });

        const userObj = await db.users.findById(userId);
        const roleLabel = role ? role.replace('_', ' ') : 'None';
        await db.audit.log(sessionId, 'SYSTEM', `${userObj?.username || 'Player'} changed role assignment to ${roleLabel}.`, 'ROLE_SELECT');
      } catch (err: any) {
        console.error('Socket select_role error:', err);
        socket.emit('error_alert', { message: err.message || 'Failed to select role' });
      }
    });

    // --- Toggle Ready ---
    socket.on('toggle_ready', async (payload: { ready: boolean }) => {
      const { ready } = payload;
      const { roomCode, userId, sessionId } = socket.data;

      if (!roomCode || !userId || !sessionId) {
        socket.emit('error_alert', { message: 'Session data missing' });
        return;
      }

      try {
        const players = await db.players.findBySession(sessionId);
        const currentPlayer = players.find((p) => p.userId === userId);

        if (ready && !currentPlayer?.role) {
          socket.emit('error_alert', { message: 'You must lock in a specialized financial role before marking Ready.' });
          return;
        }

        await db.players.toggleReady(sessionId, userId, ready);

        // Broadcast new ready state
        const updatedPlayers = await db.players.findBySession(sessionId);
        io.to(roomCode).emit('room_state_updated', {
          roomCode,
          sessionId,
          players: updatedPlayers.map((p) => ({
            id: p.id,
            userId: p.userId,
            username: p.username,
            role: p.role,
            ready: p.ready,
          })),
        });
      } catch (err: any) {
        console.error('Socket toggle_ready error:', err);
        socket.emit('error_alert', { message: 'Failed to update ready state' });
      }
    });

    // --- Start Game ---
    socket.on('start_game', async () => {
      const { roomCode, userId, sessionId } = socket.data;

      if (!roomCode || !userId || !sessionId) {
        socket.emit('error_alert', { message: 'Session data missing' });
        return;
      }

      try {
        const session = await db.sessions.findById(sessionId);
        if (!session) return;

        if (session.createdBy !== userId) {
          socket.emit('error_alert', { message: 'Only the room creator host can start the crisis simulation.' });
          return;
        }

        const players = await db.players.findBySession(sessionId);

        // Requirements validation: All players must be ready, and roles must be selected.
        // For debugging/easier local testing, we bypass this if player count is 1 (Solo Play)
        const unready = players.filter((p) => !p.ready);
        if (players.length > 1 && unready.length > 0) {
          socket.emit('error_alert', { message: 'All connected analysts & managers must check Ready before launch.' });
          return;
        }

        // Initialize simulation loops
        const gameState = await SimulationEngine.startGame(sessionId, roomCode);
        
        io.to(roomCode).emit('game_started', gameState);
      } catch (err: any) {
        console.error('Socket start_game error:', err);
        socket.emit('error_alert', { message: err.message || 'Failed to start crisis simulation' });
      }
    });

    // --- Trade execution (Trader action) ---
    socket.on('trader_action', async (payload: { actionType: 'SELL_ASSET'; asset: string; amount: number }) => {
      const { actionType, asset, amount } = payload;
      const { roomCode, userId, sessionId } = socket.data;

      if (!roomCode || !userId || !sessionId) return;

      try {
        const players = await db.players.findBySession(sessionId);
        const player = players.find((p) => p.userId === userId);

        if (player?.role !== 'TRADER') {
          socket.emit('error_alert', { message: 'Access denied: Trader credentials required for execution.' });
          return;
        }

        const success = await SimulationEngine.executeTraderAction(sessionId, actionType, asset, amount);
        if (!success) {
          socket.emit('error_alert', { message: 'Transaction rejected: Insufficient asset balance or frozen book depth!' });
        }
      } catch (err) {
        console.error('Socket trader_action error:', err);
      }
    });

    // --- Federal Window loan draw (Treasury Manager action) ---
    socket.on('treasury_action', async (payload: { actionType: 'CB_BORROW'; amount: number }) => {
      const { actionType, amount } = payload;
      const { roomCode, userId, sessionId } = socket.data;

      if (!roomCode || !userId || !sessionId) return;

      try {
        const players = await db.players.findBySession(sessionId);
        const player = players.find((p) => p.userId === userId);

        if (player?.role !== 'TREASURY_MANAGER') {
          socket.emit('error_alert', { message: 'Access denied: Treasury Manager authorization required.' });
          return;
        }

        const success = await SimulationEngine.executeTreasuryAction(sessionId, actionType, amount);
        if (!success) {
          socket.emit('error_alert', { message: 'Central Bank injection failed.' });
        }
      } catch (err) {
        console.error('Socket treasury_action error:', err);
      }
    });

    // --- Credit line swaps hedging (Risk Manager action) ---
    socket.on('risk_action', async (payload: { actionType: 'HEGDE_VAR'; value: number }) => {
      const { actionType, value } = payload;
      const { roomCode, userId, sessionId } = socket.data;

      if (!roomCode || !userId || !sessionId) return;

      try {
        const players = await db.players.findBySession(sessionId);
        const player = players.find((p) => p.userId === userId);

        if (player?.role !== 'RISK_MANAGER') {
          socket.emit('error_alert', { message: 'Access denied: Risk Manager authorization required.' });
          return;
        }

        const success = await SimulationEngine.executeRiskAction(sessionId, actionType, value);
        if (!success) {
          socket.emit('error_alert', { message: 'Risk hedging swap rejected. (Requires $4M cash reserves)' });
        }
      } catch (err) {
        console.error('Socket risk_action error:', err);
      }
    });

    // --- Puzzle Solution Submission ---
    socket.on('submit_puzzle_solution', async (payload: { solution: any }) => {
      const { solution } = payload;
      const { roomCode, userId, sessionId } = socket.data;

      if (!roomCode || !userId || !sessionId) return;

      try {
        const state = SimulationEngine.getGame(sessionId);
        if (!state || !state.puzzleActive || state.puzzleSolved) {
          socket.emit('error_alert', { message: 'No active puzzles pending verification.' });
          return;
        }

        const players = await db.players.findBySession(sessionId);
        const player = players.find((p) => p.userId === userId);
        const role = player?.role || 'SYSTEM';

        // Increment attempts on the database
        await db.puzzles.incrementAttempts(sessionId, state.currentScenario);

        // Validate
        const validation = PuzzleService.verifySolution(state.currentScenario, solution, state.puzzleData);

        if (validation.success) {
          // Log solver info to DB and cache memory
          await db.puzzles.solve(sessionId, state.currentScenario, role);
          
          // Emit success back to rooms
          io.to(roomCode).emit('puzzle_solved_alert', {
            message: validation.message,
            solvedBy: role,
          });

          // Advance Scenario in simulation engine
          await SimulationEngine.advanceScenario(sessionId, role);
        } else {
          // Failure penalty: time decremented by 25 seconds for sloppy inputs
          state.timeRemaining = Math.max(10, state.timeRemaining - 25);
          state.panicIndex = Math.min(100, state.panicIndex + 12.0);

          await db.audit.log(sessionId, role, `Submitted invalid puzzle inputs! regulatory audit penalty applied: -25 seconds, +12% panic.`, 'PUZZLE_ATTEMPT_FAIL');
          await db.crisis.log(sessionId, 'Regulator Penalty Applied', `Incorrect calculation submission triggers operational hazard penalty.`, 'CRITICAL');

          socket.emit('puzzle_failed_alert', {
            message: validation.message,
          });

          io.to(roomCode).emit('market_tick', {
            timeRemaining: state.timeRemaining,
            panicIndex: state.panicIndex,
            lcr: state.lcr,
            nsfr: state.nsfr,
            varValue: state.varValue,
            assetPrice: state.assetPrice,
            bidAskSpread: state.bidAskSpread,
            portfolio: state.portfolio,
            currentScenario: state.currentScenario,
            puzzleActive: state.puzzleActive,
            puzzleSolved: state.puzzleSolved,
            puzzleData: state.puzzleData,
            warnings: state.warnings
          });
        }
      } catch (err) {
        console.error('Socket submit_puzzle_solution error:', err);
      }
    });

    // --- Analyst Action: Get Hints ---
    socket.on('request_analyst_hint', async () => {
      const { roomCode, userId, sessionId } = socket.data;
      if (!roomCode || !userId || !sessionId) return;

      try {
        const players = await db.players.findBySession(sessionId);
        const player = players.find((p) => p.userId === userId);

        if (player?.role !== 'ANALYST') {
          socket.emit('error_alert', { message: 'Access denied: Analyst credentials required for intelligence requests.' });
          return;
        }

        const state = SimulationEngine.getGame(sessionId);
        if (!state) return;

        // Cost: 2% panic increase for request overhead
        state.panicIndex = Math.min(100, state.panicIndex + 2.0);
        
        const hints = PuzzleService.generatePuzzle(state.currentScenario).hints;
        
        // Send hints ONLY to the Analyst client to promote verbal coordinate trading
        socket.emit('analyst_hint_data', { hints });
        await db.audit.log(sessionId, 'ANALYST', 'Requested encrypted regulatory hint coordinates.', 'HINT_REQUEST');
      } catch (err) {
        console.error('Socket hint request error:', err);
      }
    });

    // --- Chat System Relay ---
    socket.on('send_chat', async (payload: { message: string }) => {
      const { message } = payload;
      const { roomCode, userId, sessionId } = socket.data;

      if (!roomCode || !userId || !sessionId) return;

      try {
        const players = await db.players.findBySession(sessionId);
        const player = players.find((p) => p.userId === userId);
        const username = player?.username || 'Player';
        const role = player?.role || 'NONE';

        io.to(roomCode).emit('chat_message_received', {
          sender: username,
          role,
          message: message.substring(0, 200),
          timestamp: new Date().toLocaleTimeString(),
        });
      } catch (err) {
        console.error('Socket chat error:', err);
      }
    });

    // --- Disconnect Handler ---
    socket.on('disconnect', async () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
      const { roomCode, userId, sessionId } = socket.data;

      if (roomCode && userId && sessionId) {
        try {
          const session = await db.sessions.findById(sessionId);
          if (session && session.status === 'LOBBY') {
            // Delete player record from lobby room
            await db.players.delete(sessionId, userId);

            const players = await db.players.findBySession(sessionId);
            io.to(roomCode).emit('room_state_updated', {
              roomCode,
              sessionId,
              players: players.map((p) => ({
                id: p.id,
                userId: p.userId,
                username: p.username,
                role: p.role,
                ready: p.ready,
              })),
            });

            const userObj = await db.users.findById(userId);
            await db.audit.log(sessionId, 'SYSTEM', `${userObj?.username || 'Player'} disconnected from the room.`, 'ROOM_LEAVE');
          }
        } catch (err) {
          console.error('Disconnect cleanup error:', err);
        }
      }
    });
  });
};
