import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/auth';
import { useGameStateStore, PlayerState } from '../store/gameStateStore';
import { CrtWrapper } from '../components/CrtWrapper';
import { sounds } from '../utils/sound';
import { 
  LogOut, Plus, ArrowRight, Trophy, Users, Shield, 
  Coins, TrendingUp, HelpCircle, Activity, Award
} from 'lucide-react';

export const LobbyPage: React.FC = () => {
  const { user, token, logout } = useAuthStore();
  const { 
    roomCode, players, currentUserRole,
    initializeSocket, selectRole, toggleReady, startGame, resetStore 
  } = useGameStateStore();

  const [inputCode, setInputCode] = useState('');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load Leaderboard on mount
  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/v1/leaderboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateRoom = async () => {
    setLoading(true);
    setError(null);
    sounds.playClick();
    try {
      const res = await fetch('/api/v1/rooms/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create room');
        sounds.playFailure();
      } else {
        sounds.playSuccess();
        // Initialize Socket.io connection and join room
        initializeSocket(data.roomCode, token!, user!.id);
      }
    } catch (err) {
      setError('Connection to regulatory server failed.');
      sounds.playFailure();
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode) return;
    setLoading(true);
    setError(null);
    sounds.playClick();
    try {
      const res = await fetch('/api/v1/rooms/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ roomCode: inputCode.toUpperCase() })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Room not found');
        sounds.playFailure();
      } else {
        sounds.playSuccess();
        initializeSocket(data.roomCode, token!, user!.id);
      }
    } catch (err) {
      setError('Regulatory join validation failed.');
      sounds.playFailure();
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSelection = (role: PlayerState['role']) => {
    sounds.playClick();
    selectRole(role);
  };

  const handleToggleReady = (isReady: boolean) => {
    sounds.playClick();
    toggleReady(isReady);
  };

  const handleStartGame = () => {
    sounds.playSuccess();
    startGame();
  };

  // Find if user is creator of room
  const amICreator = players.length > 0 && players[0].userId === user?.id;
  const isEveryoneReady = players.length > 0 && players.every((p) => p.ready);

  return (
    <CrtWrapper>
      {/* Top Navbar HUD */}
      <header className="border-b border-cyber-border bg-cyber-surface/40 backdrop-blur-md px-6 py-4 flex justify-between items-center z-40">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyber-purple animate-pulse" />
          <span className="font-mono text-sm tracking-wider uppercase font-bold text-white">
            FINANCIAL_CRISIS_GRID // LOBBY
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 bg-cyber-surface border border-cyber-border rounded-lg px-3 py-1 text-xs">
            <Award className="w-4 h-4 text-cyber-amber" />
            <span className="font-mono text-gray-400">XP Buffer:</span>
            <span className="font-mono text-cyber-green font-bold">{user?.xp || 0}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-white bg-cyber-purple/10 px-2.5 py-1 border border-cyber-purple/30 rounded-md">
              {user?.username}
            </span>
            <button
              onClick={() => { sounds.playFailure(); logout(); resetStore(); }}
              className="text-gray-400 hover:text-cyber-red p-1.5 border border-cyber-border rounded-lg bg-cyber-surface/40 hover:bg-cyber-red/5 transition-all"
              title="Terminate Clearance"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 z-30">
        
        {/* Left Console: Room Join / Lobby Management (Span 7) */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          
          {error && (
            <div className="p-4 border border-cyber-red/30 bg-cyber-red/10 rounded-lg text-xs font-mono text-cyber-red">
              🛡️ CRITICAL_ERROR: {error}
            </div>
          )}

          {!roomCode ? (
            // Room Selection View
            <div className="space-y-6">
              <div className="glass-panel border-cyber-border rounded-xl p-8 relative">
                <h2 className="text-xl font-bold font-mono text-white mb-2 uppercase flex items-center gap-2">
                  <Plus className="w-5 h-5 text-cyber-purple" /> Create Crisis Room
                </h2>
                <p className="text-xs text-gray-400 font-mono mb-5 leading-relaxed">
                  Establish a secure simulation server sandbox. Generate an invite code for up to 4 Risk Managers, Traders, Analysts, and Treasury officers.
                </p>
                <button
                  onClick={handleCreateRoom}
                  disabled={loading}
                  className="bg-cyber-purple hover:bg-purple-600 active:scale-[0.98] text-white font-mono uppercase text-xs tracking-wider font-bold py-3 px-6 rounded-lg shadow-lg shadow-cyber-purple/20 transition-all flex items-center gap-2"
                >
                  {loading ? 'Booting Server...' : 'Bootstrap Room Sandbox'}
                </button>
              </div>

              <div className="glass-panel border-cyber-border rounded-xl p-8 relative">
                <h2 className="text-xl font-bold font-mono text-white mb-2 uppercase flex items-center gap-2">
                  <ArrowRight className="w-5 h-5 text-cyber-blue" /> Connect to Active Room
                </h2>
                <p className="text-xs text-gray-400 font-mono mb-5 leading-relaxed">
                  Enter an encrypted 6-character room invite code to join a team's active crisis lobby.
                </p>
                <form onSubmit={handleJoinRoom} className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="ENTER INVITE CODE (e.g. ABCDEF)"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    className="flex-1 bg-cyber-bg/50 border border-cyber-border rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyber-blue transition-all font-mono placeholder:text-gray-600 uppercase tracking-widest text-center"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-cyber-blue hover:bg-blue-600 active:scale-[0.98] text-white font-mono uppercase text-xs tracking-wider font-bold py-3 px-6 rounded-lg shadow-lg shadow-cyber-blue/20 transition-all flex items-center justify-center gap-2"
                  >
                    Join Operations
                  </button>
                </form>
              </div>
            </div>
          ) : (
            // Joined Room Lobby View
            <div className="glass-panel border-cyber-border rounded-xl p-8 space-y-6 relative">
              <div className="flex justify-between items-start border-b border-cyber-border pb-5">
                <div>
                  <div className="text-[10px] font-mono text-cyber-purple uppercase tracking-widest mb-1">Room invite code</div>
                  <div className="text-3xl font-extrabold font-mono text-white tracking-widest neon-text-purple">
                    {roomCode}
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 border border-cyber-green/30 bg-cyber-green/5 text-cyber-green text-[10px] font-mono rounded-full animate-pulse uppercase">
                    Connected
                  </span>
                  <div className="text-xs text-gray-500 font-mono mt-1">Players: {players.length}/4</div>
                </div>
              </div>

              {/* Roles Selector Section */}
              <div>
                <h3 className="text-sm font-bold font-mono text-white mb-3 uppercase tracking-wide flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-cyber-purple" /> Allocate Financial Roles
                </h3>
                <p className="text-[11px] text-gray-400 font-mono mb-4">
                  Each player must pick a unique department. Roles grant restricted dashboards and distinct mathematical capabilities. Coordinate verbally to balance the team!
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Trader */}
                  <button
                    onClick={() => handleRoleSelection(currentUserRole === 'TRADER' ? null : 'TRADER')}
                    className={`p-4 border rounded-xl text-left transition-all ${
                      currentUserRole === 'TRADER'
                        ? 'border-cyber-purple bg-cyber-purple/10 text-white shadow-lg shadow-cyber-purple/10'
                        : 'border-cyber-border bg-cyber-bg/30 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-mono text-xs font-bold uppercase tracking-wider">Trader</span>
                      <Coins className="w-4 h-4 text-cyber-blue" />
                    </div>
                    <p className="text-[9px] font-mono text-gray-500 leading-tight">
                      Executes fast market liquidations, post CDS, and arbitrage trades in high-frequency order books.
                    </p>
                  </button>

                  {/* Treasury Manager */}
                  <button
                    onClick={() => handleRoleSelection(currentUserRole === 'TREASURY_MANAGER' ? null : 'TREASURY_MANAGER')}
                    className={`p-4 border rounded-xl text-left transition-all ${
                      currentUserRole === 'TREASURY_MANAGER'
                        ? 'border-cyber-purple bg-cyber-purple/10 text-white shadow-lg shadow-cyber-purple/10'
                        : 'border-cyber-border bg-cyber-bg/30 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-mono text-xs font-bold uppercase tracking-wider">Treasury Manager</span>
                      <TrendingUp className="w-4 h-4 text-cyber-green" />
                    </div>
                    <p className="text-[9px] font-mono text-gray-500 leading-tight">
                      Monitors HQLA cash reserves, draws from Fed Discount window, and balances structural LCR/NSFR ratios.
                    </p>
                  </button>

                  {/* Risk Manager */}
                  <button
                    onClick={() => handleRoleSelection(currentUserRole === 'RISK_MANAGER' ? null : 'RISK_MANAGER')}
                    className={`p-4 border rounded-xl text-left transition-all ${
                      currentUserRole === 'RISK_MANAGER'
                        ? 'border-cyber-purple bg-cyber-purple/10 text-white shadow-lg shadow-cyber-purple/10'
                        : 'border-cyber-border bg-cyber-bg/30 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-mono text-xs font-bold uppercase tracking-wider">Risk Manager</span>
                      <Shield className="w-4 h-4 text-cyber-amber" />
                    </div>
                    <p className="text-[9px] font-mono text-gray-500 leading-tight">
                      Monitors Value at Risk (VaR), sets credit exposure limits, isolates defaulted counterparties, and executes hedging swaps.
                    </p>
                  </button>

                  {/* Analyst */}
                  <button
                    onClick={() => handleRoleSelection(currentUserRole === 'ANALYST' ? null : 'ANALYST')}
                    className={`p-4 border rounded-xl text-left transition-all ${
                      currentUserRole === 'ANALYST'
                        ? 'border-cyber-purple bg-cyber-purple/10 text-white shadow-lg shadow-cyber-purple/10'
                        : 'border-cyber-border bg-cyber-bg/30 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-mono text-xs font-bold uppercase tracking-wider">Analyst</span>
                      <HelpCircle className="w-4 h-4 text-cyber-purple" />
                    </div>
                    <p className="text-[9px] font-mono text-gray-500 leading-tight">
                      Decodes quantitative formulas, models stress tests, previews crisis shocks, and requests regulatory hints.
                    </p>
                  </button>
                </div>
              </div>

              {/* Room Operator List */}
              <div className="border-t border-cyber-border pt-5">
                <h3 className="text-xs font-bold font-mono text-gray-400 mb-3 uppercase tracking-wide flex items-center gap-1.5">
                  <Users className="w-4 h-4" /> Connected Operators
                </h3>
                <div className="space-y-2">
                  {players.map((p) => {
                    const isSelf = p.userId === user?.id;
                    return (
                      <div key={p.userId} className="flex justify-between items-center p-3 bg-cyber-bg/40 border border-cyber-border rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${p.ready ? 'bg-cyber-green animate-pulse' : 'bg-cyber-red animate-pulse'}`} />
                          <span className="font-mono text-xs text-white">
                            {p.username} {isSelf && <span className="text-[9px] text-cyber-purple font-bold font-mono">(YOU)</span>}
                          </span>
                          {p.role && (
                            <span className="text-[9px] font-mono bg-cyber-purple/20 text-cyber-purple px-1.5 py-0.5 border border-cyber-purple/30 rounded uppercase">
                              {p.role.replace('_', ' ')}
                            </span>
                          )}
                        </div>

                        <div>
                          {isSelf ? (
                            <button
                              onClick={() => handleToggleReady(!p.ready)}
                              disabled={!p.role}
                              className={`px-3 py-1 font-mono text-[10px] uppercase font-bold rounded-lg border transition-all ${
                                !p.role 
                                  ? 'border-gray-800 text-gray-600 cursor-not-allowed'
                                  : p.ready
                                    ? 'border-cyber-green text-cyber-green bg-cyber-green/10 hover:bg-cyber-green/5'
                                    : 'border-cyber-purple text-cyber-purple bg-cyber-purple/10 hover:bg-cyber-purple/5'
                              }`}
                            >
                              {p.ready ? 'Locked & Ready' : 'Mark Ready'}
                            </button>
                          ) : (
                            <span className={`text-[10px] font-mono uppercase ${p.ready ? 'text-cyber-green' : 'text-cyber-red'}`}>
                              {p.ready ? 'READY' : 'STANDBY'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Start Game Action */}
              <div className="border-t border-cyber-border pt-5 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-[10px] font-mono text-gray-500 uppercase leading-normal">
                  {amICreator 
                    ? 'Host Authority: Initiate crisis simulation once all operators are ready.'
                    : 'Awaiting host operator authorization to start crisis parameters.'}
                </div>
                {amICreator && (
                  <button
                    onClick={handleStartGame}
                    disabled={!isEveryoneReady}
                    className={`w-full sm:w-auto px-6 py-3 font-mono text-xs uppercase font-bold rounded-lg tracking-wider border shadow-lg transition-all ${
                      isEveryoneReady
                        ? 'border-cyber-green bg-cyber-green/20 text-cyber-green hover:bg-cyber-green/35 shadow-cyber-green/10'
                        : 'border-gray-800 bg-gray-900 text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    Start Crisis Simulation
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Right Console: High Score Leaderboard Dashboard (Span 5) */}
        <section className="lg:col-span-5">
          <div className="glass-panel border-cyber-border rounded-xl p-6 h-full flex flex-col">
            <h2 className="text-lg font-bold font-mono text-white mb-1 uppercase flex items-center gap-2">
              <Trophy className="w-5 h-5 text-cyber-amber animate-pulse" /> SOLVENCY LEADERBOARD
            </h2>
            <p className="text-[10px] font-mono text-gray-500 mb-5 uppercase tracking-wide">
              Top stabilizing agents // Historical records
            </p>

            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {leaderboard.length === 0 ? (
                <div className="text-center py-16 text-xs font-mono text-gray-600 uppercase border border-dashed border-cyber-border rounded-lg bg-cyber-bg/20">
                  No records stored in secure mainframe database yet.
                </div>
              ) : (
                leaderboard.map((entry, index) => (
                  <div 
                    key={entry.id} 
                    className={`p-3 bg-cyber-bg/40 border rounded-lg transition-all flex items-center justify-between ${
                      index === 0 
                        ? 'border-cyber-amber bg-cyber-amber/5' 
                        : index === 1 
                          ? 'border-gray-400 bg-gray-400/5' 
                          : index === 2 
                            ? 'border-amber-700 bg-amber-700/5' 
                            : 'border-cyber-border'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-5 h-5 flex justify-center items-center rounded bg-cyber-surface border border-cyber-border text-[9px] font-bold font-mono text-gray-400">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-mono text-xs font-bold text-white truncate max-w-[150px]">
                          {entry.teamName}
                        </div>
                        <div className="text-[9px] font-mono text-gray-500 mt-0.5">
                          Time taken: {Math.floor(entry.timeTakenSeconds / 60)}m {entry.timeTakenSeconds % 60}s // preserved: ${entry.liquidityPreserved.toFixed(1)}M
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono text-xs font-bold text-cyber-green">
                        {entry.score} pts
                      </div>
                      <div className="text-[8px] font-mono text-gray-600 uppercase mt-0.5">
                        LCR preserved
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

      </main>
    </CrtWrapper>
  );
};
