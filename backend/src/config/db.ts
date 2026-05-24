import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// --- Types ---
export interface User {
  id: number;
  username: string;
  email: string;
  passwordHash: string;
  xp: number;
  createdAt: string;
}

export interface GameSession {
  id: number;
  roomCode: string;
  status: 'LOBBY' | 'PLAYING' | 'COMPLETED' | 'FAILED';
  currentScenario: number;
  panicIndex: number;
  lcr: number;
  nsfr: number;
  timeRemaining: number;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface Player {
  id: number;
  sessionId: number;
  userId: number;
  role: 'RISK_MANAGER' | 'TREASURY_MANAGER' | 'TRADER' | 'ANALYST' | null;
  ready: boolean;
  score: number;
  joinedAt: string;
  username?: string; // Hydrated for join queries
}

export interface Puzzle {
  id: number;
  sessionId: number;
  scenarioId: number;
  puzzleType: string;
  status: 'LOCKED' | 'ACTIVE' | 'SOLVED';
  solutionData: any;
  attempts: number;
  solvedAt: string | null;
  solvedBy: string | null;
}

export interface MarketState {
  id: number;
  sessionId: number;
  tickTime: string;
  panicIndex: number;
  lcr: number;
  nsfr: number;
  var: number;
  assetPrice: number;
  bidAskSpread: number;
}

export interface CrisisEvent {
  id: number;
  sessionId: number;
  name: string;
  description: string;
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  triggeredAt: string;
}

export interface LeaderboardEntry {
  id: number;
  sessionId: number | null;
  teamName: string;
  playerCount: number;
  score: number;
  timeTakenSeconds: number;
  liquidityPreserved: number;
  completedAt: string;
}

export interface AuditLog {
  id: number;
  sessionId: number;
  timestamp: string;
  actorRole: string;
  message: string;
  actionType: string;
}

// --- DB Adapter Interface ---
export interface IDatabase {
  users: {
    create: (username: string, email: string, passwordHash: string) => Promise<User>;
    findByUsername: (username: string) => Promise<User | null>;
    findByEmail: (email: string) => Promise<User | null>;
    findById: (id: number) => Promise<User | null>;
    addXp: (id: number, amount: number) => Promise<void>;
  };
  sessions: {
    create: (roomCode: string, createdBy: number) => Promise<GameSession>;
    findByCode: (roomCode: string) => Promise<GameSession | null>;
    findById: (id: number) => Promise<GameSession | null>;
    update: (id: number, fields: Partial<GameSession>) => Promise<GameSession>;
  };
  players: {
    join: (sessionId: number, userId: number) => Promise<Player>;
    findBySession: (sessionId: number) => Promise<Player[]>;
    updateRole: (sessionId: number, userId: number, role: Player['role']) => Promise<Player>;
    toggleReady: (sessionId: number, userId: number, ready: boolean) => Promise<Player>;
    delete: (sessionId: number, userId: number) => Promise<void>;
  };
  puzzles: {
    getOrCreate: (sessionId: number, scenarioId: number, puzzleType: string, solutionData: any) => Promise<Puzzle>;
    solve: (sessionId: number, scenarioId: number, solvedByRole: string) => Promise<Puzzle>;
    incrementAttempts: (sessionId: number, scenarioId: number) => Promise<void>;
  };
  market: {
    log: (sessionId: number, panicIndex: number, lcr: number, nsfr: number, varVal: number, assetPrice: number, spread: number) => Promise<MarketState>;
    getHistory: (sessionId: number) => Promise<MarketState[]>;
  };
  crisis: {
    log: (sessionId: number, name: string, description: string, severity: CrisisEvent['severity']) => Promise<CrisisEvent>;
    getBySession: (sessionId: number) => Promise<CrisisEvent[]>;
  };
  leaderboard: {
    add: (entry: Omit<LeaderboardEntry, 'id' | 'completedAt'>) => Promise<LeaderboardEntry>;
    getTop: (limit?: number) => Promise<LeaderboardEntry[]>;
  };
  audit: {
    log: (sessionId: number, actorRole: string, message: string, actionType: string) => Promise<AuditLog>;
    getBySession: (sessionId: number) => Promise<AuditLog[]>;
  };
}

// --- JSON FILE DATABASE IMPLEMENTATION (Fallback) ---
class JsonDatabase implements IDatabase {
  private dbDir = path.resolve(__dirname, '../../.db');
  private userPath = path.join(this.dbDir, 'users.json');
  private sessionPath = path.join(this.dbDir, 'sessions.json');
  private playerPath = path.join(this.dbDir, 'players.json');
  private puzzlePath = path.join(this.dbDir, 'puzzles.json');
  private marketPath = path.join(this.dbDir, 'market.json');
  private crisisPath = path.join(this.dbDir, 'crisis.json');
  private leaderboardPath = path.join(this.dbDir, 'leaderboard.json');
  private auditPath = path.join(this.dbDir, 'audit.json');

  constructor() {
    if (!fs.existsSync(this.dbDir)) {
      fs.mkdirSync(this.dbDir, { recursive: true });
    }
    this.initFile(this.userPath, []);
    this.initFile(this.sessionPath, []);
    this.initFile(this.playerPath, []);
    this.initFile(this.puzzlePath, []);
    this.initFile(this.marketPath, []);
    this.initFile(this.crisisPath, []);
    this.initFile(this.leaderboardPath, []);
    this.initFile(this.auditPath, []);
  }

  private initFile(filepath: string, defaultData: any) {
    if (!fs.existsSync(filepath)) {
      fs.writeFileSync(filepath, JSON.stringify(defaultData, null, 2), 'utf-8');
    }
  }

  private readFile<T>(filepath: string): T[] {
    try {
      const data = fs.readFileSync(filepath, 'utf-8');
      return JSON.parse(data) as T[];
    } catch {
      return [];
    }
  }

  private writeFile<T>(filepath: string, data: T[]) {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
  }

  // --- Implementations ---

  users = {
    create: async (username: string, email: string, passwordHash: string): Promise<User> => {
      const list = this.readFile<User>(this.userPath);
      const newUser: User = {
        id: list.length > 0 ? list[list.length - 1].id + 1 : 1,
        username,
        email,
        passwordHash,
        xp: 0,
        createdAt: new Date().toISOString(),
      };
      list.push(newUser);
      this.writeFile(this.userPath, list);
      return newUser;
    },
    findByUsername: async (username: string): Promise<User | null> => {
      const list = this.readFile<User>(this.userPath);
      return list.find((u) => u.username.toLowerCase() === username.toLowerCase()) || null;
    },
    findByEmail: async (email: string): Promise<User | null> => {
      const list = this.readFile<User>(this.userPath);
      return list.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
    },
    findById: async (id: number): Promise<User | null> => {
      const list = this.readFile<User>(this.userPath);
      return list.find((u) => u.id === id) || null;
    },
    addXp: async (id: number, amount: number): Promise<void> => {
      const list = this.readFile<User>(this.userPath);
      const user = list.find((u) => u.id === id);
      if (user) {
        user.xp += amount;
        this.writeFile(this.userPath, list);
      }
    },
  };

  sessions = {
    create: async (roomCode: string, createdBy: number): Promise<GameSession> => {
      const list = this.readFile<GameSession>(this.sessionPath);
      const newSession: GameSession = {
        id: list.length > 0 ? list[list.length - 1].id + 1 : 1,
        roomCode,
        status: 'LOBBY',
        currentScenario: 1,
        panicIndex: 10.0,
        lcr: 150.0,
        nsfr: 120.0,
        timeRemaining: 600,
        createdBy,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      list.push(newSession);
      this.writeFile(this.sessionPath, list);
      return newSession;
    },
    findByCode: async (roomCode: string): Promise<GameSession | null> => {
      const list = this.readFile<GameSession>(this.sessionPath);
      return list.find((s) => s.roomCode.toUpperCase() === roomCode.toUpperCase()) || null;
    },
    findById: async (id: number): Promise<GameSession | null> => {
      const list = this.readFile<GameSession>(this.sessionPath);
      return list.find((s) => s.id === id) || null;
    },
    update: async (id: number, fields: Partial<GameSession>): Promise<GameSession> => {
      const list = this.readFile<GameSession>(this.sessionPath);
      const sIndex = list.findIndex((s) => s.id === id);
      if (sIndex === -1) throw new Error('Session not found');
      list[sIndex] = {
        ...list[sIndex],
        ...fields,
        updatedAt: new Date().toISOString(),
      };
      this.writeFile(this.sessionPath, list);
      return list[sIndex];
    },
  };

  players = {
    join: async (sessionId: number, userId: number): Promise<Player> => {
      const list = this.readFile<Player>(this.playerPath);
      const users = this.readFile<User>(this.userPath);
      const existing = list.find((p) => p.sessionId === sessionId && p.userId === userId);
      if (existing) return existing;

      const userObj = users.find((u) => u.id === userId);
      const newPlayer: Player = {
        id: list.length > 0 ? list[list.length - 1].id + 1 : 1,
        sessionId,
        userId,
        role: null,
        ready: false,
        score: 0,
        joinedAt: new Date().toISOString(),
      };
      list.push(newPlayer);
      this.writeFile(this.playerPath, list);
      return { ...newPlayer, username: userObj?.username || 'Unknown' };
    },
    findBySession: async (sessionId: number): Promise<Player[]> => {
      const list = this.readFile<Player>(this.playerPath);
      const users = this.readFile<User>(this.userPath);
      return list
        .filter((p) => p.sessionId === sessionId)
        .map((p) => {
          const userObj = users.find((u) => u.id === p.userId);
          return { ...p, username: userObj?.username || 'Unknown' };
        });
    },
    updateRole: async (sessionId: number, userId: number, role: Player['role']): Promise<Player> => {
      const list = this.readFile<Player>(this.playerPath);
      const p = list.find((x) => x.sessionId === sessionId && x.userId === userId);
      if (!p) throw new Error('Player not found');

      // Enforce role uniqueness in the room
      if (role !== null) {
        const double = list.find((x) => x.sessionId === sessionId && x.role === role && x.userId !== userId);
        if (double) {
          // Kick the other guy from this role
          double.role = null;
          double.ready = false;
        }
      }

      p.role = role;
      p.ready = false; // Reset ready state when changing role
      this.writeFile(this.playerPath, list);
      return p;
    },
    toggleReady: async (sessionId: number, userId: number, ready: boolean): Promise<Player> => {
      const list = this.readFile<Player>(this.playerPath);
      const p = list.find((x) => x.sessionId === sessionId && x.userId === userId);
      if (!p) throw new Error('Player not found');
      p.ready = ready;
      this.writeFile(this.playerPath, list);
      return p;
    },
    delete: async (sessionId: number, userId: number): Promise<void> => {
      let list = this.readFile<Player>(this.playerPath);
      list = list.filter((x) => !(x.sessionId === sessionId && x.userId === userId));
      this.writeFile(this.playerPath, list);
    },
  };

  puzzles = {
    getOrCreate: async (sessionId: number, scenarioId: number, puzzleType: string, solutionData: any): Promise<Puzzle> => {
      const list = this.readFile<Puzzle>(this.puzzlePath);
      let puzzle = list.find((pz) => pz.sessionId === sessionId && pz.scenarioId === scenarioId);
      if (puzzle) return puzzle;

      puzzle = {
        id: list.length > 0 ? list[list.length - 1].id + 1 : 1,
        sessionId,
        scenarioId,
        puzzleType,
        status: 'LOCKED',
        solutionData,
        attempts: 0,
        solvedAt: null,
        solvedBy: null,
      };
      list.push(puzzle);
      this.writeFile(this.puzzlePath, list);
      return puzzle;
    },
    solve: async (sessionId: number, scenarioId: number, solvedByRole: string): Promise<Puzzle> => {
      const list = this.readFile<Puzzle>(this.puzzlePath);
      const puzzle = list.find((pz) => pz.sessionId === sessionId && pz.scenarioId === scenarioId);
      if (!puzzle) throw new Error('Puzzle not found');
      puzzle.status = 'SOLVED';
      puzzle.solvedAt = new Date().toISOString();
      puzzle.solvedBy = solvedByRole;
      this.writeFile(this.puzzlePath, list);
      return puzzle;
    },
    incrementAttempts: async (sessionId: number, scenarioId: number): Promise<void> => {
      const list = this.readFile<Puzzle>(this.puzzlePath);
      const puzzle = list.find((pz) => pz.sessionId === sessionId && pz.scenarioId === scenarioId);
      if (puzzle) {
        puzzle.attempts += 1;
        this.writeFile(this.puzzlePath, list);
      }
    },
  };

  market = {
    log: async (sessionId: number, panicIndex: number, lcr: number, nsfr: number, varVal: number, assetPrice: number, spread: number): Promise<MarketState> => {
      const list = this.readFile<MarketState>(this.marketPath);
      const logEntry: MarketState = {
        id: list.length > 0 ? list[list.length - 1].id + 1 : 1,
        sessionId,
        tickTime: new Date().toISOString(),
        panicIndex,
        lcr,
        nsfr,
        var: varVal,
        assetPrice,
        bidAskSpread: spread,
      };
      list.push(logEntry);
      // Keep only last 100 historical ticks per room in json memory to avoid bloating
      const sessionTicks = list.filter((m) => m.sessionId === sessionId);
      if (sessionTicks.length > 100) {
        const excessCount = sessionTicks.length - 100;
        let pruned = false;
        let count = 0;
        const newList = list.filter((m) => {
          if (m.sessionId === sessionId && count < excessCount) {
            count++;
            return false;
          }
          return true;
        });
        this.writeFile(this.marketPath, newList);
        return logEntry;
      }
      this.writeFile(this.marketPath, list);
      return logEntry;
    },
    getHistory: async (sessionId: number): Promise<MarketState[]> => {
      const list = this.readFile<MarketState>(this.marketPath);
      return list.filter((m) => m.sessionId === sessionId).sort((a, b) => new Date(a.tickTime).getTime() - new Date(b.tickTime).getTime());
    },
  };

  crisis = {
    log: async (sessionId: number, name: string, description: string, severity: CrisisEvent['severity']): Promise<CrisisEvent> => {
      const list = this.readFile<CrisisEvent>(this.crisisPath);
      const event: CrisisEvent = {
        id: list.length > 0 ? list[list.length - 1].id + 1 : 1,
        sessionId,
        name,
        description,
        severity,
        triggeredAt: new Date().toISOString(),
      };
      list.push(event);
      this.writeFile(this.crisisPath, list);
      return event;
    },
    getBySession: async (sessionId: number): Promise<CrisisEvent[]> => {
      const list = this.readFile<CrisisEvent>(this.crisisPath);
      return list.filter((c) => c.sessionId === sessionId).sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime());
    },
  };

  leaderboard = {
    add: async (entry: Omit<LeaderboardEntry, 'id' | 'completedAt'>): Promise<LeaderboardEntry> => {
      const list = this.readFile<LeaderboardEntry>(this.leaderboardPath);
      const newEntry: LeaderboardEntry = {
        id: list.length > 0 ? list[list.length - 1].id + 1 : 1,
        ...entry,
        completedAt: new Date().toISOString(),
      };
      list.push(newEntry);
      this.writeFile(this.leaderboardPath, list);
      return newEntry;
    },
    getTop: async (limit: number = 10): Promise<LeaderboardEntry[]> => {
      const list = this.readFile<LeaderboardEntry>(this.leaderboardPath);
      return list.sort((a, b) => b.score - a.score).slice(0, limit);
    },
  };

  audit = {
    log: async (sessionId: number, actorRole: string, message: string, actionType: string): Promise<AuditLog> => {
      const list = this.readFile<AuditLog>(this.auditPath);
      const logEntry: AuditLog = {
        id: list.length > 0 ? list[list.length - 1].id + 1 : 1,
        sessionId,
        timestamp: new Date().toISOString(),
        actorRole,
        message,
        actionType,
      };
      list.push(logEntry);
      this.writeFile(this.auditPath, list);
      return logEntry;
    },
    getBySession: async (sessionId: number): Promise<AuditLog[]> => {
      const list = this.readFile<AuditLog>(this.auditPath);
      return list.filter((a) => a.sessionId === sessionId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    },
  };
}

// --- POSTGRES DB IMPLEMENTATION ---
class PostgresDatabase implements IDatabase {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
    });
    this.initTables();
  }

  private async initTables() {
    const client = await this.pool.connect();
    try {
      // 1. users
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          xp INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 2. game_sessions
      await client.query(`
        CREATE TABLE IF NOT EXISTS game_sessions (
          id SERIAL PRIMARY KEY,
          room_code VARCHAR(6) UNIQUE NOT NULL,
          status VARCHAR(20) DEFAULT 'LOBBY',
          current_scenario INTEGER DEFAULT 1,
          panic_index DOUBLE PRECISION DEFAULT 10.0,
          lcr DOUBLE PRECISION DEFAULT 150.0,
          nsfr DOUBLE PRECISION DEFAULT 120.0,
          time_remaining INTEGER DEFAULT 600,
          created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 3. players
      await client.query(`
        CREATE TABLE IF NOT EXISTS players (
          id SERIAL PRIMARY KEY,
          session_id INTEGER REFERENCES game_sessions(id) ON DELETE CASCADE,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          role VARCHAR(30),
          ready BOOLEAN DEFAULT FALSE,
          score INTEGER DEFAULT 0,
          joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(session_id, user_id),
          UNIQUE(session_id, role)
        );
      `);

      // 4. puzzles
      await client.query(`
        CREATE TABLE IF NOT EXISTS puzzles (
          id SERIAL PRIMARY KEY,
          session_id INTEGER REFERENCES game_sessions(id) ON DELETE CASCADE,
          scenario_id INTEGER NOT NULL,
          puzzle_type VARCHAR(50) NOT NULL,
          status VARCHAR(20) DEFAULT 'LOCKED',
          solution_data JSONB,
          attempts INTEGER DEFAULT 0,
          solved_at TIMESTAMP WITH TIME ZONE,
          solved_by VARCHAR(30)
        );
      `);

      // 5. market_state
      await client.query(`
        CREATE TABLE IF NOT EXISTS market_state (
          id SERIAL PRIMARY KEY,
          session_id INTEGER REFERENCES game_sessions(id) ON DELETE CASCADE,
          tick_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          panic_index DOUBLE PRECISION NOT NULL,
          lcr DOUBLE PRECISION NOT NULL,
          nsfr DOUBLE PRECISION NOT NULL,
          var DOUBLE PRECISION NOT NULL,
          asset_price DOUBLE PRECISION NOT NULL,
          bid_ask_spread DOUBLE PRECISION NOT NULL
        );
      `);

      // 6. crisis_events
      await client.query(`
        CREATE TABLE IF NOT EXISTS crisis_events (
          id SERIAL PRIMARY KEY,
          session_id INTEGER REFERENCES game_sessions(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          severity VARCHAR(20) NOT NULL,
          triggered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 7. leaderboards
      await client.query(`
        CREATE TABLE IF NOT EXISTS leaderboards (
          id SERIAL PRIMARY KEY,
          session_id INTEGER REFERENCES game_sessions(id) ON DELETE SET NULL,
          team_name VARCHAR(100) NOT NULL,
          player_count INTEGER NOT NULL,
          score INTEGER NOT NULL,
          time_taken_seconds INTEGER NOT NULL,
          liquidity_preserved DOUBLE PRECISION NOT NULL,
          completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 8. audit_logs
      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id SERIAL PRIMARY KEY,
          session_id INTEGER REFERENCES game_sessions(id) ON DELETE CASCADE,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          actor_role VARCHAR(30),
          message TEXT NOT NULL,
          action_type VARCHAR(50)
        );
      `);
    } catch (err) {
      console.error('Failed to initialize Postgres tables:', err);
    } finally {
      client.release();
    }
  }

  users = {
    create: async (username: string, email: string, passwordHash: string): Promise<User> => {
      const res = await this.pool.query(
        'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, password_hash as "passwordHash", xp, created_at as "createdAt"',
        [username, email, passwordHash]
      );
      return res.rows[0];
    },
    findByUsername: async (username: string): Promise<User | null> => {
      const res = await this.pool.query(
        'SELECT id, username, email, password_hash as "passwordHash", xp, created_at as "createdAt" FROM users WHERE LOWER(username) = LOWER($1)',
        [username]
      );
      return res.rows[0] || null;
    },
    findByEmail: async (email: string): Promise<User | null> => {
      const res = await this.pool.query(
        'SELECT id, username, email, password_hash as "passwordHash", xp, created_at as "createdAt" FROM users WHERE LOWER(email) = LOWER($1)',
        [email]
      );
      return res.rows[0] || null;
    },
    findById: async (id: number): Promise<User | null> => {
      const res = await this.pool.query(
        'SELECT id, username, email, password_hash as "passwordHash", xp, created_at as "createdAt" FROM users WHERE id = $1',
        [id]
      );
      return res.rows[0] || null;
    },
    addXp: async (id: number, amount: number): Promise<void> => {
      await this.pool.query('UPDATE users SET xp = xp + $1 WHERE id = $2', [amount, id]);
    },
  };

  sessions = {
    create: async (roomCode: string, createdBy: number): Promise<GameSession> => {
      const res = await this.pool.query(
        'INSERT INTO game_sessions (room_code, created_by) VALUES ($1, $2) RETURNING id, room_code as "roomCode", status, current_scenario as "currentScenario", panic_index as "panicIndex", lcr, nsfr, time_remaining as "timeRemaining", created_by as "createdBy", created_at as "createdAt", updated_at as "updatedAt"',
        [roomCode, createdBy]
      );
      return res.rows[0];
    },
    findByCode: async (roomCode: string): Promise<GameSession | null> => {
      const res = await this.pool.query(
        'SELECT id, room_code as "roomCode", status, current_scenario as "currentScenario", panic_index as "panicIndex", lcr, nsfr, time_remaining as "timeRemaining", created_by as "createdBy", created_at as "createdAt", updated_at as "updatedAt" FROM game_sessions WHERE UPPER(room_code) = UPPER($1)',
        [roomCode]
      );
      return res.rows[0] || null;
    },
    findById: async (id: number): Promise<GameSession | null> => {
      const res = await this.pool.query(
        'SELECT id, room_code as "roomCode", status, current_scenario as "currentScenario", panic_index as "panicIndex", lcr, nsfr, time_remaining as "timeRemaining", created_by as "createdBy", created_at as "createdAt", updated_at as "updatedAt" FROM game_sessions WHERE id = $1',
        [id]
      );
      return res.rows[0] || null;
    },
    update: async (id: number, fields: Partial<GameSession>): Promise<GameSession> => {
      const setStatements: string[] = [];
      const values: any[] = [];
      let index = 1;

      // Map JS camelCase variables to SQL snake_case variables
      const map: Record<string, string> = {
        roomCode: 'room_code',
        status: 'status',
        currentScenario: 'current_scenario',
        panicIndex: 'panic_index',
        lcr: 'lcr',
        nsfr: 'nsfr',
        timeRemaining: 'time_remaining',
        createdBy: 'created_by',
      };

      for (const [key, value] of Object.entries(fields)) {
        const sqlKey = map[key] || key;
        setStatements.push(`${sqlKey} = $${index}`);
        values.push(value);
        index++;
      }

      values.push(id);
      const query = `UPDATE game_sessions SET ${setStatements.join(', ')}, updated_at = NOW() WHERE id = $${index} RETURNING id, room_code as "roomCode", status, current_scenario as "currentScenario", panic_index as "panicIndex", lcr, nsfr, time_remaining as "timeRemaining", created_by as "createdBy", created_at as "createdAt", updated_at as "updatedAt"`;
      
      const res = await this.pool.query(query, values);
      return res.rows[0];
    },
  };

  players = {
    join: async (sessionId: number, userId: number): Promise<Player> => {
      await this.pool.query(
        'INSERT INTO players (session_id, user_id) VALUES ($1, $2) ON CONFLICT (session_id, user_id) DO NOTHING',
        [sessionId, userId]
      );
      const res = await this.pool.query(
        'SELECT p.id, p.session_id as "sessionId", p.user_id as "userId", p.role, p.ready, p.score, p.joined_at as "joinedAt", u.username FROM players p JOIN users u ON p.user_id = u.id WHERE p.session_id = $1 AND p.user_id = $2',
        [sessionId, userId]
      );
      return res.rows[0];
    },
    findBySession: async (sessionId: number): Promise<Player[]> => {
      const res = await this.pool.query(
        'SELECT p.id, p.session_id as "sessionId", p.user_id as "userId", p.role, p.ready, p.score, p.joined_at as "joinedAt", u.username FROM players p JOIN users u ON p.user_id = u.id WHERE p.session_id = $1',
        [sessionId]
      );
      return res.rows;
    },
    updateRole: async (sessionId: number, userId: number, role: Player['role']): Promise<Player> => {
      if (role !== null) {
        // Kick any other player from this role in this session
        await this.pool.query('UPDATE players SET role = NULL, ready = FALSE WHERE session_id = $1 AND role = $2 AND user_id != $3', [sessionId, role, userId]);
      }
      const res = await this.pool.query(
        'UPDATE players SET role = $1, ready = FALSE WHERE session_id = $2 AND user_id = $3 RETURNING id, session_id as "sessionId", user_id as "userId", role, ready, score, joined_at as "joinedAt"',
        [role, sessionId, userId]
      );
      return res.rows[0];
    },
    toggleReady: async (sessionId: number, userId: number, ready: boolean): Promise<Player> => {
      const res = await this.pool.query(
        'UPDATE players SET ready = $1 WHERE session_id = $2 AND user_id = $3 RETURNING id, session_id as "sessionId", user_id as "userId", role, ready, score, joined_at as "joinedAt"',
        [ready, sessionId, userId]
      );
      return res.rows[0];
    },
    delete: async (sessionId: number, userId: number): Promise<void> => {
      await this.pool.query('DELETE FROM players WHERE session_id = $1 AND user_id = $2', [sessionId, userId]);
    },
  };

  puzzles = {
    getOrCreate: async (sessionId: number, scenarioId: number, puzzleType: string, solutionData: any): Promise<Puzzle> => {
      const check = await this.pool.query(
        'SELECT id, session_id as "sessionId", scenario_id as "scenarioId", puzzle_type as "puzzleType", status, solution_data as "solutionData", attempts, solved_at as "solvedAt", solved_by as "solvedBy" FROM puzzles WHERE session_id = $1 AND scenario_id = $2',
        [sessionId, scenarioId]
      );
      if (check.rows[0]) return check.rows[0];

      const res = await this.pool.query(
        'INSERT INTO puzzles (session_id, scenario_id, puzzle_type, solution_data) VALUES ($1, $2, $3, $4) RETURNING id, session_id as "sessionId", scenario_id as "scenarioId", puzzle_type as "puzzleType", status, solution_data as "solutionData", attempts, solved_at as "solvedAt", solved_by as "solvedBy"',
        [sessionId, scenarioId, puzzleType, JSON.stringify(solutionData)]
      );
      return res.rows[0];
    },
    solve: async (sessionId: number, scenarioId: number, solvedByRole: string): Promise<Puzzle> => {
      const res = await this.pool.query(
        'UPDATE puzzles SET status = \'SOLVED\', solved_at = NOW(), solved_by = $1 WHERE session_id = $2 AND scenario_id = $3 RETURNING id, session_id as "sessionId", scenario_id as "scenarioId", puzzle_type as "puzzleType", status, solution_data as "solutionData", attempts, solved_at as "solvedAt", solved_by as "solvedBy"',
        [solvedByRole, sessionId, scenarioId]
      );
      return res.rows[0];
    },
    incrementAttempts: async (sessionId: number, scenarioId: number): Promise<void> => {
      await this.pool.query('UPDATE puzzles SET attempts = attempts + 1 WHERE session_id = $1 AND scenario_id = $2', [sessionId, scenarioId]);
    },
  };

  market = {
    log: async (sessionId: number, panicIndex: number, lcr: number, nsfr: number, varVal: number, assetPrice: number, spread: number): Promise<MarketState> => {
      const res = await this.pool.query(
        'INSERT INTO market_state (session_id, panic_index, lcr, nsfr, var, asset_price, bid_ask_spread) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, session_id as "sessionId", tick_time as "tickTime", panic_index as "panicIndex", lcr, nsfr, var, asset_price as "assetPrice", bid_ask_spread as "bidAskSpread"',
        [sessionId, panicIndex, lcr, nsfr, varVal, assetPrice, spread]
      );
      // Clean up excess ticks inside Postgres
      await this.pool.query('DELETE FROM market_state WHERE id IN (SELECT id FROM market_state WHERE session_id = $1 ORDER BY tick_time ASC OFFSET 100)', [sessionId]);
      return res.rows[0];
    },
    getHistory: async (sessionId: number): Promise<MarketState[]> => {
      const res = await this.pool.query(
        'SELECT id, session_id as "sessionId", tick_time as "tickTime", panic_index as "panicIndex", lcr, nsfr, var, asset_price as "assetPrice", bid_ask_spread as "bidAskSpread" FROM market_state WHERE session_id = $1 ORDER BY tick_time ASC',
        [sessionId]
      );
      return res.rows;
    },
  };

  crisis = {
    log: async (sessionId: number, name: string, description: string, severity: CrisisEvent['severity']): Promise<CrisisEvent> => {
      const res = await this.pool.query(
        'INSERT INTO crisis_events (session_id, name, description, severity) VALUES ($1, $2, $3, $4) RETURNING id, session_id as "sessionId", name, description, severity, triggered_at as "triggeredAt"',
        [sessionId, name, description, severity]
      );
      return res.rows[0];
    },
    getBySession: async (sessionId: number): Promise<CrisisEvent[]> => {
      const res = await this.pool.query(
        'SELECT id, session_id as "sessionId", name, description, severity, triggered_at as "triggeredAt" FROM crisis_events WHERE session_id = $1 ORDER BY triggered_at DESC',
        [sessionId]
      );
      return res.rows;
    },
  };

  leaderboard = {
    add: async (entry: Omit<LeaderboardEntry, 'id' | 'completedAt'>): Promise<LeaderboardEntry> => {
      const res = await this.pool.query(
        'INSERT INTO leaderboards (session_id, team_name, player_count, score, time_taken_seconds, liquidity_preserved) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, session_id as "sessionId", team_name as "teamName", player_count as "playerCount", score, time_taken_seconds as "timeTakenSeconds", liquidity_preserved as "liquidityPreserved", completed_at as "completedAt"',
        [entry.sessionId, entry.teamName, entry.playerCount, entry.score, entry.timeTakenSeconds, entry.liquidityPreserved]
      );
      return res.rows[0];
    },
    getTop: async (limit: number = 10): Promise<LeaderboardEntry[]> => {
      const res = await this.pool.query(
        'SELECT id, session_id as "sessionId", team_name as "teamName", player_count as "playerCount", score, time_taken_seconds as "timeTakenSeconds", liquidity_preserved as "liquidityPreserved", completed_at as "completedAt" FROM leaderboards ORDER BY score DESC LIMIT $1',
        [limit]
      );
      return res.rows;
    },
  };

  audit = {
    log: async (sessionId: number, actorRole: string, message: string, actionType: string): Promise<AuditLog> => {
      const res = await this.pool.query(
        'INSERT INTO audit_logs (session_id, actor_role, message, action_type) VALUES ($1, $2, $3, $4) RETURNING id, session_id as "sessionId", timestamp, actor_role as "actorRole", message, action_type as "actionType"',
        [sessionId, actorRole, message, actionType]
      );
      return res.rows[0];
    },
    getBySession: async (sessionId: number): Promise<AuditLog[]> => {
      const res = await this.pool.query(
        'SELECT id, session_id as "sessionId", timestamp, actor_role as "actorRole", message, action_type as "actionType" FROM audit_logs WHERE session_id = $1 ORDER BY timestamp DESC',
        [sessionId]
      );
      return res.rows;
    },
  };
}

// --- DB Instance Export ---
const dbUrl = process.env.DATABASE_URL;
let db: IDatabase;

if (dbUrl) {
  console.log('⚡ Initializing Database Connection with PostgreSQL...');
  db = new PostgresDatabase(dbUrl);
} else {
  console.log('📂 Local Database Connection: auto-switched to JSON Database fallback.');
  db = new JsonDatabase();
}

export { db };
