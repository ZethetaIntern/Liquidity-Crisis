import { db, GameSession } from '../config/db';
import { PuzzleService } from './puzzle.service';
import { Server } from 'socket.io';

export interface GameState {
  sessionId: number;
  roomCode: string;
  status: 'LOBBY' | 'PLAYING' | 'COMPLETED' | 'FAILED';
  currentScenario: number;
  timeRemaining: number; // in seconds
  panicIndex: number; // 0 - 100
  lcr: number; // %
  nsfr: number; // %
  varValue: number; // Value at Risk ($M)
  assetPrice: number; // Stock price reference
  bidAskSpread: number; // Bid-ask spread in %
  portfolio: {
    cash: number;
    govBonds: number;
    corpBonds: number;
  };
  puzzleActive: boolean;
  puzzleSolved: boolean;
  puzzleData: any;
  score: number;
  lastTickLogCount: number;
  warnings: string[];
}

export class SimulationEngine {
  private static io: Server;
  private static activeGames: Map<number, GameState> = new Map();
  private static intervals: Map<number, NodeJS.Timeout> = new Map();

  public static init(socketIoServer: Server) {
    this.io = socketIoServer;
  }

  public static getGame(sessionId: number): GameState | undefined {
    return this.activeGames.get(sessionId);
  }

  /**
   * Initializes and starts the simulation loop for a room
   */
  public static async startGame(sessionId: number, roomCode: string): Promise<GameState> {
    const session = await db.sessions.findById(sessionId);
    if (!session) throw new Error('Session not found');

    // Create starting state
    const state: GameState = {
      sessionId,
      roomCode,
      status: 'PLAYING',
      currentScenario: 1,
      timeRemaining: 600, // 10 minutes
      panicIndex: 10,
      lcr: 150,
      nsfr: 120,
      varValue: 12.5,
      assetPrice: 100,
      bidAskSpread: 0.05,
      portfolio: {
        cash: 60,
        govBonds: 90,
        corpBonds: 110
      },
      puzzleActive: true,
      puzzleSolved: false,
      puzzleData: PuzzleService.generatePuzzle(1).data,
      score: 0,
      lastTickLogCount: 0,
      warnings: []
    };

    // Update session status in DB
    await db.sessions.update(sessionId, { status: 'PLAYING', currentScenario: 1 });
    await db.audit.log(sessionId, 'SYSTEM', 'Global Liquidity Crisis Simulation initiated. solvency timer set to 10:00.', 'GAME_START');

    // Trigger first crisis event log in DB
    await db.crisis.log(sessionId, 'Retail Panic Sparked', 'Retail depositors are withdrawing funds rapidly. Cash reserves declining.', 'CRITICAL');

    this.activeGames.set(sessionId, state);

    // Initialize the tick interval (every 1.5s)
    const interval = setInterval(() => this.tick(sessionId), 1500);
    this.intervals.set(sessionId, interval);

    return state;
  }

  /**
   * Core simulation clock tick (1.5 seconds)
   */
  private static async tick(sessionId: number) {
    const state = this.activeGames.get(sessionId);
    if (!state || state.status !== 'PLAYING') {
      this.stopSimulation(sessionId);
      return;
    }

    // 1. Time decrement
    state.timeRemaining -= 1.5;
    if (state.timeRemaining <= 0) {
      state.timeRemaining = 0;
      await this.endGame(sessionId, 'FAILED', 'Solvency timer expired before liquidity stabilization was achieved.');
      return;
    }

    // 2. Adjust panic index based on scenario difficulty and puzzle state
    const puzzleUnsolvedPenalty = !state.puzzleSolved ? 0.35 : 0;
    const baseScenarioPanic = state.currentScenario * 0.12;
    state.panicIndex = Math.min(100, Math.max(0, state.panicIndex + baseScenarioPanic + puzzleUnsolvedPenalty));

    // 3. Volatility, Spread, and Pricing formulas based on Panic
    state.assetPrice = Math.max(25, 100 - state.panicIndex * 0.72 + (Math.random() * 2 - 1));
    state.bidAskSpread = 0.05 + (state.panicIndex / 100) * 0.65;
    state.varValue = 10 + state.panicIndex * 0.45 + state.currentScenario * 3.5;

    // 4. Scenario-specific decay rules
    state.warnings = [];
    switch (state.currentScenario) {
      case 1: // Bank run cash drain
        if (!state.puzzleSolved) {
          const drain = 1.6;
          state.portfolio.cash = Math.max(0, state.portfolio.cash - drain);
          state.lcr = Math.max(0, state.lcr - 2.8);
          state.nsfr = Math.max(0, state.nsfr - 0.5);
          if (state.portfolio.cash <= 15) {
            state.warnings.push('CRITICAL CASH WARNING: Reserve levels extremely depleted!');
          }
        }
        break;
      case 2: // Margin call pressure
        if (!state.puzzleSolved) {
          state.lcr = Math.max(0, state.lcr - 1.2);
          state.nsfr = Math.max(0, state.nsfr - 0.8);
          state.warnings.push('CLEANSING MARGIN WARNING: Posting collateral overdue!');
        }
        break;
      case 3: // Interbank market freeze
        if (!state.puzzleSolved) {
          state.nsfr = Math.max(0, state.nsfr - 2.5);
          state.lcr = Math.max(0, state.lcr - 0.5);
          state.warnings.push('MARKET FREEZE WARNING: Interbank funding channels completely blocked.');
        }
        break;
      case 4: // Counterparty defaults contagion
        if (!state.puzzleSolved) {
          state.lcr = Math.max(0, state.lcr - 1.8);
          state.nsfr = Math.max(0, state.nsfr - 1.2);
          state.warnings.push('CREDIT CONTAGION WARNING: Lehman-equivalent counterparties cascading!');
        }
        break;
      case 5: // Central Bank repo injection phase
        if (!state.puzzleSolved) {
          state.lcr = Math.max(0, state.lcr - 3.2);
          state.warnings.push('SYSTEMIC EMERGENCY: Federal Discount Window pumping required to restore LCR >= 100%!');
        }
        break;
    }

    // Add alarm warnings for low ratios
    if (state.lcr < 100) {
      state.warnings.push(`SOLVENCY ALERT: LCR at ${state.lcr.toFixed(1)}% is below regulatory 100% threshold!`);
    }
    if (state.nsfr < 100) {
      state.warnings.push(`FUNDING ALERT: NSFR at ${state.nsfr.toFixed(1)}% is below stable threshold!`);
    }

    // 5. Game Over triggers due to Insolvency
    if (state.lcr <= 0) {
      await this.endGame(sessionId, 'FAILED', 'Systemic Collapse! High Quality Liquid Assets fully exhausted (LCR hit 0%).');
      return;
    }

    // 6. DB Log Throttling (save a chart tick log roughly every 4.5 seconds / 3 ticks)
    state.lastTickLogCount++;
    if (state.lastTickLogCount >= 3) {
      state.lastTickLogCount = 0;
      try {
        await db.market.log(
          sessionId,
          state.panicIndex,
          state.lcr,
          state.nsfr,
          state.varValue,
          state.assetPrice,
          state.bidAskSpread
        );
      } catch (err) {
        console.error('Failed to log market tick to database:', err);
      }
    }

    // 7. Broadcast updated state to room
    this.io.to(state.roomCode).emit('market_tick', {
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

  /**
   * Triggers actions executed by players to update states (e.g. selling assets or drawing CB loans)
   */
  public static async executeTraderAction(sessionId: number, actionType: string, asset: string, amount: number): Promise<boolean> {
    const state = this.activeGames.get(sessionId);
    if (!state || state.status !== 'PLAYING') return false;

    if (actionType === 'SELL_ASSET') {
      // Execute liquidation: Trader sells bonds for cash
      // Slippage increases due to panic
      const priceFactor = state.assetPrice / 100;
      const transactionDiscount = 1 - state.bidAskSpread;

      if (asset === 'govBonds') {
        if (state.portfolio.govBonds < amount) return false;
        state.portfolio.govBonds -= amount;
        // Cash raised includes price discounts
        const cashRaised = amount * priceFactor * transactionDiscount;
        state.portfolio.cash += cashRaised;
        state.lcr = Math.min(300, state.lcr + (cashRaised / 120) * 100);
        await db.audit.log(sessionId, 'TRADER', `Sold $${amount}M Gov Bonds. Raised $${cashRaised.toFixed(1)}M cash.`, 'TRADE_EXECUTION');
      } else if (asset === 'corpBonds') {
        if (state.portfolio.corpBonds < amount) return false;
        state.portfolio.corpBonds -= amount;
        // Corporate bonds have 1.5x wider bid-ask spread
        const cashRaised = amount * priceFactor * (1 - state.bidAskSpread * 1.5);
        state.portfolio.cash += cashRaised;
        state.lcr = Math.min(300, state.lcr + (cashRaised / 120) * 100);
        await db.audit.log(sessionId, 'TRADER', `Sold $${amount}M Corporate Bonds. Raised $${cashRaised.toFixed(1)}M cash.`, 'TRADE_EXECUTION');
      }
      return true;
    }
    return false;
  }

  public static async executeTreasuryAction(sessionId: number, actionType: string, amount: number): Promise<boolean> {
    const state = this.activeGames.get(sessionId);
    if (!state || state.status !== 'PLAYING') return false;

    if (actionType === 'CB_BORROW') {
      // Emergency Federal Window loan
      // Immediate Cash injection, LCR improves
      // Penalty: Panic Index increases by 8 points (Central Bank borrowing stigma!)
      state.portfolio.cash += amount;
      state.lcr = Math.min(300, state.lcr + (amount / 120) * 100);
      state.panicIndex = Math.min(100, state.panicIndex + 8.0);
      await db.audit.log(sessionId, 'TREASURY_MANAGER', `Drew $${amount}M Emergency Liquidity from Fed Discount Window (Stigma Penalty triggered).`, 'CB_DRAWDOWN');
      await db.crisis.log(sessionId, 'Fed Window Drawn', `Emergency drawdown of $${amount}M triggers market stigma panic.`, 'WARN');
      return true;
    }
    return false;
  }

  public static async executeRiskAction(sessionId: number, actionType: string, value: number): Promise<boolean> {
    const state = this.activeGames.get(sessionId);
    if (!state || state.status !== 'PLAYING') return false;

    if (actionType === 'HEGDE_VAR') {
      // Swaps hedging: Reduces VaR by 35% instantly, costs $4M Cash reserves
      if (state.portfolio.cash < 4) return false;
      state.portfolio.cash -= 4;
      state.varValue = Math.max(5, state.varValue * 0.65);
      await db.audit.log(sessionId, 'RISK_MANAGER', `Executed currency swap hedging program. Net portfolio VaR risk index lowered. Cost: $4M HQLA.`, 'RISK_HEDGING');
      return true;
    }
    return false;
  }

  /**
   * Advances the game to the next scenario once a puzzle is solved
   */
  public static async advanceScenario(sessionId: number, role: string) {
    const state = this.activeGames.get(sessionId);
    if (!state || state.status !== 'PLAYING') return;

    state.puzzleSolved = true;
    state.panicIndex = Math.max(10, state.panicIndex - 20.0); // Reward: Panic drops!
    state.portfolio.cash += 25.0; // Reward: Liquidity boost!

    await db.audit.log(sessionId, 'SYSTEM', `Scenario ${state.currentScenario} Puzzle successfully resolved by ${role}! Solvency channels recovered.`, 'PUZZLE_RESOLVED');

    setTimeout(async () => {
      if (state.currentScenario < 5) {
        state.currentScenario += 1;
        state.puzzleSolved = false;
        state.puzzleActive = true;
        // Generate new puzzle
        const newPuzzle = PuzzleService.generatePuzzle(state.currentScenario);
        state.puzzleData = newPuzzle.data;

        await db.sessions.update(sessionId, { currentScenario: state.currentScenario });

        // Crisis scenarios alerts log
        let alertName = '';
        let alertDesc = '';
        if (state.currentScenario === 2) {
          alertName = 'Margin Call Triggered';
          alertDesc = 'Underlying portfolio asset collateral values hit 12-month low. Clearinghouse demands margin posting.';
        } else if (state.currentScenario === 3) {
          alertName = 'Interbank Market Freeze';
          alertDesc = 'Wholesale interbank lending completely dried up. Counterparties refusing short-term rollovers.';
        } else if (state.currentScenario === 4) {
          alertName = 'Counterparty Contagion Cascade';
          alertDesc = 'Apex Credit has filed for bankruptcy protection. Multi-dealer contagion chain spreading.';
        } else if (state.currentScenario === 5) {
          alertName = 'Systemic Banking Freeze';
          alertDesc = 'LCR ratio under immediate pressure! Federal Reserve emergency lending pipeline opened.';
        }

        await db.crisis.log(sessionId, alertName, alertDesc, 'CRITICAL');
        this.io.to(state.roomCode).emit('scenario_advanced', {
          currentScenario: state.currentScenario,
          puzzleData: state.puzzleData
        });
      } else {
        // Solved the final scenario! We Win!
        await this.endGame(sessionId, 'COMPLETED', 'Stabilization achieved! Solvency restored across all accounts.');
      }
    }, 2500); // 2.5s delay for player celebrating sound and animations
  }

  /**
   * Shuts down simulation and logs end game status
   */
  public static async endGame(sessionId: number, status: 'COMPLETED' | 'FAILED', reason: string) {
    const state = this.activeGames.get(sessionId);
    if (!state) return;

    state.status = status;
    this.stopSimulation(sessionId);

    // Calculate score
    let finalScore = 0;
    if (status === 'COMPLETED') {
      // Score: Remaining time + LCR value + NSFR value + Cash preserved - Panic remaining
      finalScore = Math.floor(
        state.timeRemaining * 1.8 +
        state.lcr * 1.5 +
        state.nsfr * 1.2 +
        state.portfolio.cash * 2.0 -
        state.panicIndex * 1.0
      );
    } else {
      finalScore = Math.floor(state.currentScenario * 100);
    }
    state.score = finalScore;

    // Update DB
    await db.sessions.update(sessionId, { status });
    await db.audit.log(sessionId, 'SYSTEM', `Game ended: ${status}. Reason: ${reason} Final Score: ${finalScore}.`, 'GAME_OVER');

    // Save score to leaderboard
    const players = await db.players.findBySession(sessionId);
    const names = players.map(p => p.username).join(', ');
    const teamName = names ? `Team ${names.substring(0, 45)}` : `Escape Team #${sessionId}`;

    try {
      await db.leaderboard.add({
        sessionId,
        teamName,
        playerCount: players.length || 1,
        score: finalScore,
        timeTakenSeconds: 600 - state.timeRemaining,
        liquidityPreserved: state.portfolio.cash
      });
      
      // Award XP to registered players
      for (const p of players) {
        await db.users.addXp(p.userId, Math.floor(finalScore / 4));
      }
    } catch (err) {
      console.error('Failed to log scoreboard or award XP:', err);
    }

    // Broadcast Game Over to room
    this.io.to(state.roomCode).emit('game_over', {
      status,
      reason,
      score: finalScore,
      stats: {
        timeRemaining: state.timeRemaining,
        lcr: state.lcr,
        nsfr: state.nsfr,
        cash: state.portfolio.cash,
        panicIndex: state.panicIndex
      }
    });

    this.activeGames.delete(sessionId);
  }

  private static stopSimulation(sessionId: number) {
    const interval = this.intervals.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(sessionId);
    }
  }
}
