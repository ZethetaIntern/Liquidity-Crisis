import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './auth';


export interface PlayerState {
  userId: number;
  username: string;
  role: 'RISK_MANAGER' | 'TREASURY_MANAGER' | 'TRADER' | 'ANALYST' | null;
  ready: boolean;
}

export interface ChatMessage {
  sender: string;
  role: string;
  message: string;
  timestamp: string;
}

export interface CrisisLog {
  id: number;
  name: string;
  description: string;
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  triggeredAt: string;
}

export interface AuditRecord {
  id: number;
  actorRole: string;
  message: string;
  actionType: string;
  timestamp: string;
}

export interface ChartTick {
  tickTime: string;
  panicIndex: number;
  lcr: number;
  nsfr: number;
  var: number;
  assetPrice: number;
  bidAskSpread: number;
}

interface GameStateStore {
  // Connection state
  socket: Socket | null;
  connected: boolean;

  // Lobby/Room state
  sessionId: number | null;
  roomCode: string | null;
  status: 'LOBBY' | 'PLAYING' | 'COMPLETED' | 'FAILED';
  players: PlayerState[];
  currentUserRole: PlayerState['role'];

  // Simulation Metrics
  timeRemaining: number;
  panicIndex: number;
  lcr: number;
  nsfr: number;
  varValue: number;
  assetPrice: number;
  bidAskSpread: number;
  portfolio: {
    cash: number;
    govBonds: number;
    corpBonds: number;
  };
  currentScenario: number;
  warnings: string[];

  // Active Puzzle
  puzzleActive: boolean;
  puzzleSolved: boolean;
  puzzleData: any;
  puzzleErrorAlert: string | null;
  puzzleSuccessAlert: string | null;
  analystHints: string[] | null;

  // Chat & History logs
  chatMessages: ChatMessage[];
  crisisLogs: CrisisLog[];
  auditLogs: AuditRecord[];
  historyCharts: ChartTick[];

  // Scoring/Final state
  score: number;
  gameOverReason: string | null;
  finalStats: any | null;

  // Socket Actions
  initializeSocket: (roomCode: string, token: string, userId: number) => void;
  disconnectSocket: () => void;
  selectRole: (role: PlayerState['role']) => void;
  toggleReady: (ready: boolean) => void;
  startGame: () => void;
  executeTrade: (asset: string, amount: number) => void;
  drawFedRepo: (amount: number) => void;
  hedgeRisk: () => void;
  submitPuzzle: (solution: any) => void;
  requestHints: () => void;
  sendChat: (message: string) => void;
  triggerAdminShock: (shockType: string) => Promise<void>;
  fetchHistoryLogs: () => Promise<void>;
  resetStore: () => void;
}

export const useGameStateStore = create<GameStateStore>((set, get) => ({
  socket: null,
  connected: false,
  sessionId: null,
  roomCode: null,
  status: 'LOBBY',
  players: [],
  currentUserRole: null,

  timeRemaining: 600,
  panicIndex: 10,
  lcr: 150,
  nsfr: 120,
  varValue: 12,
  assetPrice: 100,
  bidAskSpread: 0.05,
  portfolio: { cash: 60, govBonds: 90, corpBonds: 110 },
  currentScenario: 1,
  warnings: [],

  puzzleActive: false,
  puzzleSolved: false,
  puzzleData: null,
  puzzleErrorAlert: null,
  puzzleSuccessAlert: null,
  analystHints: null,

  chatMessages: [],
  crisisLogs: [],
  auditLogs: [],
  historyCharts: [],

  score: 0,
  gameOverReason: null,
  finalStats: null,

  initializeSocket: (roomCode: string, token: string, userId: number) => {
    // Disconnect if already connected
    get().disconnectSocket();

    // In local development, the Vite proxy handles socket forwarding.
    // If deployed, standard hostname connection is negotiated automatically.
    const socketUrl = window.location.origin;
    
    console.log(`🔌 Initializing WebSocket Connection to: ${socketUrl}`);
    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('⚡ Connected to socket server!');
      set({ connected: true, roomCode });
      socket.emit('join_room', { roomCode, userId });
    });

    // --- Lobby Sync ---
    socket.on('room_state_updated', (data: { roomCode: string; sessionId: number; status: 'LOBBY' | 'PLAYING'; players: PlayerState[] }) => {
      const pList = data.players || [];
      const self = pList.find((p) => p.userId === userId);
      set({
        sessionId: data.sessionId,
        status: data.status || get().status,
        players: pList,
        currentUserRole: self ? self.role : null
      });
    });

    // --- Game Initialization ---
    socket.on('game_started', (gameState: any) => {
      set({
        status: 'PLAYING',
        timeRemaining: gameState.timeRemaining,
        panicIndex: gameState.panicIndex,
        lcr: gameState.lcr,
        nsfr: gameState.nsfr,
        varValue: gameState.varValue,
        assetPrice: gameState.assetPrice,
        bidAskSpread: gameState.bidAskSpread,
        portfolio: gameState.portfolio,
        currentScenario: gameState.currentScenario,
        puzzleActive: gameState.puzzleActive,
        puzzleSolved: gameState.puzzleSolved,
        puzzleData: gameState.puzzleData,
        warnings: gameState.warnings || [],
        chatMessages: [],
        puzzleErrorAlert: null,
        puzzleSuccessAlert: null
      });
      get().fetchHistoryLogs();
    });

    // --- Simulation High-Frequency Ratios Tick ---
    socket.on('market_tick', (tick: any) => {
      set({
        timeRemaining: tick.timeRemaining,
        panicIndex: tick.panicIndex,
        lcr: tick.lcr,
        nsfr: tick.nsfr,
        varValue: tick.varValue,
        assetPrice: tick.assetPrice,
        bidAskSpread: tick.bidAskSpread,
        portfolio: tick.portfolio,
        currentScenario: tick.currentScenario,
        puzzleActive: tick.puzzleActive,
        puzzleSolved: tick.puzzleSolved,
        puzzleData: tick.puzzleData,
        warnings: tick.warnings || []
      });
    });

    // --- Puzzle Feedback Alerts ---
    socket.on('puzzle_solved_alert', (payload: { message: string; solvedBy: string }) => {
      set({
        puzzleSuccessAlert: `RESOLVED: ${payload.message} (${payload.solvedBy.replace('_', ' ')})`,
        puzzleErrorAlert: null
      });
      setTimeout(() => set({ puzzleSuccessAlert: null }), 4000);
      get().fetchHistoryLogs(); // reload logs to display puzzle completed report
    });

    socket.on('puzzle_failed_alert', (payload: { message: string }) => {
      set({
        puzzleErrorAlert: payload.message,
        puzzleSuccessAlert: null
      });
      setTimeout(() => set({ puzzleErrorAlert: null }), 4000);
    });

    socket.on('analyst_hint_data', (payload: { hints: string[] }) => {
      set({ analystHints: payload.hints });
    });

    // --- Scenario Transitions ---
    socket.on('scenario_advanced', (data: { currentScenario: number; puzzleData: any }) => {
      set({
        currentScenario: data.currentScenario,
        puzzleSolved: false,
        puzzleActive: true,
        puzzleData: data.puzzleData,
        analystHints: null
      });
      get().fetchHistoryLogs(); // reload alerts
    });

    // --- Chat Relay Receiver ---
    socket.on('chat_message_received', (msg: ChatMessage) => {
      set((state) => ({
        chatMessages: [...state.chatMessages, msg]
      }));
    });

    // --- Game Over ---
    socket.on('game_over', (payload: { status: 'COMPLETED' | 'FAILED'; reason: string; score: number; stats: any }) => {
      set({
        status: payload.status,
        gameOverReason: payload.reason,
        score: payload.score,
        finalStats: payload.stats,
        puzzleActive: false
      });
      get().fetchHistoryLogs();
    });

    socket.on('error_alert', (err: { message: string }) => {
      set({ puzzleErrorAlert: err.message });
      setTimeout(() => set({ puzzleErrorAlert: null }), 5000);
    });

    socket.on('disconnect', () => {
      set({ connected: false });
    });

    set({ socket });
  },

  disconnectSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
    }
    set({ socket: null, connected: false });
  },

  selectRole: (role: PlayerState['role']) => {
    const { socket } = get();
    if (socket) {
      socket.emit('select_role', { role });
    }
  },

  toggleReady: (ready: boolean) => {
    const { socket } = get();
    if (socket) {
      socket.emit('toggle_ready', { ready });
    }
  },

  startGame: () => {
    const { socket } = get();
    if (socket) {
      socket.emit('start_game');
    }
  },

  executeTrade: (asset: string, amount: number) => {
    const { socket } = get();
    if (socket) {
      socket.emit('trader_action', { actionType: 'SELL_ASSET', asset, amount });
    }
  },

  drawFedRepo: (amount: number) => {
    const { socket } = get();
    if (socket) {
      socket.emit('treasury_action', { actionType: 'CB_BORROW', amount });
    }
  },

  hedgeRisk: () => {
    const { socket } = get();
    if (socket) {
      socket.emit('risk_action', { actionType: 'HEGDE_VAR', value: 0 });
    }
  },

  submitPuzzle: (solution: any) => {
    const { socket } = get();
    if (socket) {
      socket.emit('submit_puzzle_solution', { solution });
    }
  },

  requestHints: () => {
    const { socket } = get();
    if (socket) {
      socket.emit('request_analyst_hint');
    }
  },

  sendChat: (message: string) => {
    const { socket } = get();
    if (socket) {
      socket.emit('send_chat', { message });
    }
  },

  triggerAdminShock: async (shockType: string) => {
    const { roomCode } = get();
    const token = useAuthStore.getState().token;
    if (!roomCode || !token) return;


    try {
      const res = await fetch('/api/v1/admin/trigger-shock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ roomCode, shockType })
      });
      if (res.ok) {
        get().fetchHistoryLogs(); // reload logs immediately
      }
    } catch (err) {
      console.error('Failed to trigger admin shock:', err);
    }
  },

  fetchHistoryLogs: async () => {
    const { roomCode } = get();
    const token = useAuthStore.getState().token;
    if (!roomCode || !token) return;


    try {
      const res = await fetch(`/api/v1/rooms/${roomCode}/logs`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        set({
          auditLogs: data.audits || [],
          crisisLogs: data.crises || [],
          historyCharts: data.charts || []
        });
      }
    } catch (err) {
      console.error('Failed to fetch historical room logs:', err);
    }
  },

  resetStore: () => {
    get().disconnectSocket();
    set({
      sessionId: null,
      roomCode: null,
      status: 'LOBBY',
      players: [],
      currentUserRole: null,
      timeRemaining: 600,
      panicIndex: 10,
      lcr: 150,
      nsfr: 120,
      varValue: 12,
      assetPrice: 100,
      bidAskSpread: 0.05,
      portfolio: { cash: 60, govBonds: 90, corpBonds: 110 },
      currentScenario: 1,
      warnings: [],
      puzzleActive: false,
      puzzleSolved: false,
      puzzleData: null,
      puzzleErrorAlert: null,
      puzzleSuccessAlert: null,
      analystHints: null,
      chatMessages: [],
      crisisLogs: [],
      auditLogs: [],
      historyCharts: [],
      score: 0,
      gameOverReason: null,
      finalStats: null
    });
  }
}));
