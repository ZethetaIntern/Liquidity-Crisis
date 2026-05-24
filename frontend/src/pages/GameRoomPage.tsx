import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/auth';
import { useGameStateStore } from '../store/gameStateStore';
import { CrtWrapper } from '../components/CrtWrapper';
import { sounds } from '../utils/sound';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { 
  AlertTriangle, Clock, Send, MessageSquare, Terminal, 
  HelpCircle, Zap, Shield, Play, Settings, Layers
} from 'lucide-react';

export const GameRoomPage: React.FC = () => {
  const { user } = useAuthStore();
  const {
    sessionId, status, players, currentUserRole,
    timeRemaining, panicIndex, lcr, nsfr, varValue, bidAskSpread, portfolio,
    currentScenario, warnings, puzzleActive, puzzleData, puzzleErrorAlert, puzzleSuccessAlert, analystHints,
    chatMessages, auditLogs, historyCharts, score, gameOverReason, finalStats,
    executeTrade, drawFedRepo, hedgeRisk, submitPuzzle, requestHints, sendChat, triggerAdminShock, fetchHistoryLogs, resetStore
  } = useGameStateStore();

  const [activeConsoleTab, setActiveConsoleTab] = useState<string>('TRADER');
  const [chatInput, setChatInput] = useState('');
  
  // Puzzle solutions local states
  const [p1FlowA, setP1FlowA] = useState<number>(0);
  const [p1FlowB, setP1FlowB] = useState<number>(0);
  const [p1FlowC, setP1FlowC] = useState<number>(0);

  const [p2Cash, setP2Cash] = useState<number>(0);
  const [p2Gov, setP2Gov] = useState<number>(0);
  const [p2Corp, setP2Corp] = useState<number>(0);

  const [p3Lit, setP3Lit] = useState<number>(0);
  const [p3Dark, setP3Dark] = useState<number>(0);
  const [p3Otc, setP3Otc] = useState<number>(0);

  const [p4Cuts, setP4Cuts] = useState<string[]>([]);
  const [p4Cds, setP4Cds] = useState<string[]>([]);

  const [p5FedDraw, setP5FedDraw] = useState<number>(0);

  const [adminOpen, setAdminOpen] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const auditEndRef = useRef<HTMLDivElement>(null);

  // Sync role tabs on mount or role change
  useEffect(() => {
    if (currentUserRole) {
      setActiveConsoleTab(currentUserRole);
    }
  }, [currentUserRole]);

  // Play warning sirens if LCR drops below regulatory limits
  useEffect(() => {
    if (status === 'PLAYING') {
      sounds.playClick();
      if (lcr < 100) {
        sounds.playSiren();
      }
    }
  }, [lcr, status]);

  // Keep chat and audit scroll in view
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    auditEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [auditLogs]);

  // Periodically fetch alerts/audit logs from API
  useEffect(() => {
    let logFetcher: any = null;
    if (status === 'PLAYING') {
      logFetcher = setInterval(() => {
        fetchHistoryLogs();
      }, 4000);
    }
    return () => {
      if (logFetcher) clearInterval(logFetcher);
    };
  }, [status]);

  // Format MM:SS timer
  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChat(chatInput);
    setChatInput('');
    sounds.playClick();
  };

  // Submit quantitative solutions
  const handlePuzzleSubmit = () => {
    sounds.playClick();
    if (currentScenario === 1) {
      submitPuzzle({ A: p1FlowA, B: p1FlowB, C: p1FlowC });
    } else if (currentScenario === 2) {
      submitPuzzle({ cash: p2Cash, govBonds: p2Gov, corpBonds: p2Corp });
    } else if (currentScenario === 3) {
      submitPuzzle({ lit: p3Lit, dark: p3Dark, otc: p3Otc });
    } else if (currentScenario === 4) {
      submitPuzzle({ cutLines: p4Cuts, buyCds: p4Cds });
    } else if (currentScenario === 5) {
      submitPuzzle({ borrowAmount: p5FedDraw });
    }
  };

  const handleTraderSell = (asset: string, amount: number) => {
    sounds.playClick();
    executeTrade(asset, amount);
  };

  const handleTreasuryBorrow = (amount: number) => {
    sounds.playClick();
    drawFedRepo(amount);
  };

  const handleRiskHedging = () => {
    sounds.playClick();
    hedgeRisk();
  };

  const toggleNodeCut = (name: string) => {
    sounds.playClick();
    setP4Cuts((prev) => 
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    );
  };

  const toggleNodeCds = (name: string) => {
    sounds.playClick();
    setP4Cds((prev) => 
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    );
  };

  // Game over state
  if (status === 'COMPLETED' || status === 'FAILED') {
    return (
      <CrtWrapper className="flex items-center justify-center p-6">
        <div className="w-full max-w-2xl glass-panel border-cyber-border rounded-xl p-8 text-center relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-cyber-purple to-transparent" />
          
          <h1 className={`text-4xl font-extrabold font-mono tracking-wider mb-2 uppercase ${
            status === 'COMPLETED' ? 'text-cyber-green neon-text-green' : 'text-cyber-red neon-text-red'
          }`}>
            {status === 'COMPLETED' ? 'CRISIS STABILIZED' : 'SYSTEMIC COLLAPSE'}
          </h1>
          <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-6">
            QUANTITATIVE INCIDENT REPORT // SESSION #{sessionId}
          </div>

          <p className="text-sm text-gray-300 font-mono mb-8 max-w-lg mx-auto leading-relaxed border border-cyber-border p-4 bg-cyber-bg/40 rounded-lg">
            {gameOverReason}
          </p>

          {/* Core Score KPI block */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <div className="p-4 bg-cyber-bg/30 border border-cyber-border rounded-xl">
              <div className="text-[10px] font-mono text-gray-500 uppercase mb-1">Final Score</div>
              <div className="text-xl font-bold font-mono text-white">{score} pts</div>
            </div>
            <div className="p-4 bg-cyber-bg/30 border border-cyber-border rounded-xl">
              <div className="text-[10px] font-mono text-gray-500 uppercase mb-1">HQLA Preserved</div>
              <div className="text-xl font-bold font-mono text-cyber-green">${finalStats?.cash?.toFixed(1) || portfolio.cash.toFixed(1)}M</div>
            </div>
            <div className="p-4 bg-cyber-bg/30 border border-cyber-border rounded-xl">
              <div className="text-[10px] font-mono text-gray-500 uppercase mb-1">Panic Remaining</div>
              <div className="text-xl font-bold font-mono text-cyber-red">{finalStats?.panicIndex?.toFixed(1) || panicIndex.toFixed(1)}%</div>
            </div>
            <div className="p-4 bg-cyber-bg/30 border border-cyber-border rounded-xl">
              <div className="text-[10px] font-mono text-gray-500 uppercase mb-1">Ending LCR</div>
              <div className="text-xl font-bold font-mono text-cyber-blue">{finalStats?.lcr?.toFixed(1) || lcr.toFixed(1)}%</div>
            </div>
          </div>

          {/* Action links */}
          <button
            onClick={() => { sounds.playSuccess(); resetStore(); }}
            className="px-8 py-3 bg-cyber-purple hover:bg-purple-600 active:scale-[0.98] text-white font-mono uppercase text-xs tracking-wider font-bold rounded-lg shadow-lg shadow-cyber-purple/20 transition-all"
          >
            Return to Operations Center
          </button>
        </div>
      </CrtWrapper>
    );
  }

  return (
    <CrtWrapper className="h-screen flex flex-col">
      {/* 1. TOP HEADER HUD CONTROLLER */}
      <header className="border-b border-cyber-border bg-cyber-surface/40 backdrop-blur-md px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 z-40">
        
        {/* Severity gauge */}
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-cyber-red animate-pulse" />
            <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
              CRISIS_STAGE:
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-cyber-bg/80 border border-cyber-border px-3 py-1.5 rounded-lg flex-1 md:flex-none">
            {[1, 2, 3, 4, 5].map((s) => (
              <div 
                key={s}
                className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[9px] font-bold font-mono ${
                  currentScenario >= s 
                    ? s === 5 
                      ? 'bg-cyber-red border-cyber-red text-white' 
                      : 'bg-cyber-purple border-cyber-purple text-white shadow shadow-cyber-purple/30'
                    : 'border-cyber-border text-gray-600'
                }`}
              >
                {s}
              </div>
            ))}
            <span className="text-[9px] font-mono text-gray-400 uppercase ml-2 hidden sm:inline">
              {currentScenario === 1 && 'Bank Run'}
              {currentScenario === 2 && 'Margin Call'}
              {currentScenario === 3 && 'Market Freeze'}
              {currentScenario === 4 && 'Contagion'}
              {currentScenario === 5 && 'Fed Repo Draw'}
            </span>
          </div>
        </div>

        {/* GLOWING SOLVENCY COUNTDOWN TIMER */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 border border-cyber-red bg-cyber-red/10 rounded-xl flex items-center gap-3 shadow-lg shadow-cyber-red/10 animate-pulse">
            <Clock className="w-5 h-5 text-cyber-red" />
            <div>
              <div className="text-[8px] font-mono text-cyber-red/70 uppercase tracking-widest leading-none">Solvency deadline</div>
              <span className="text-xl font-bold font-mono text-cyber-red tracking-widest leading-none">
                {formatTimer(timeRemaining)}
              </span>
            </div>
          </div>
        </div>

        {/* Live Gauges KPIs */}
        <div className="flex items-center gap-4 w-full md:w-auto justify-end">
          <div className="bg-cyber-surface/60 border border-cyber-border rounded-xl px-4 py-2 text-right">
            <div className="text-[8px] font-mono text-gray-500 uppercase tracking-wide">Panic Index</div>
            <span className={`text-sm font-bold font-mono ${panicIndex > 60 ? 'text-cyber-red neon-text-red' : 'text-cyber-purple neon-text-purple'}`}>
              {panicIndex.toFixed(1)}%
            </span>
          </div>
          <div className="bg-cyber-surface/60 border border-cyber-border rounded-xl px-4 py-2 text-right">
            <div className="text-[8px] font-mono text-gray-500 uppercase tracking-wide">Regulatory LCR</div>
            <span className={`text-sm font-bold font-mono ${lcr < 100 ? 'text-cyber-red neon-text-red' : 'text-cyber-green neon-text-green'}`}>
              {lcr.toFixed(1)}%
            </span>
          </div>
          <div className="bg-cyber-surface/60 border border-cyber-border rounded-xl px-4 py-2 text-right">
            <div className="text-[8px] font-mono text-gray-500 uppercase tracking-wide">Net Stable Funding</div>
            <span className={`text-sm font-bold font-mono ${nsfr < 100 ? 'text-cyber-amber neon-text-amber' : 'text-cyber-blue'}`}>
              {nsfr.toFixed(1)}%
            </span>
          </div>
        </div>

      </header>

      {/* 2. DYNAMIC CRITICAL WARNINGS SIRENS BLOCK */}
      {warnings.length > 0 && (
        <div className="bg-cyber-red/10 border-b border-cyber-red/30 py-2.5 px-6 flex items-center justify-between gap-4 z-30 animate-pulse">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-cyber-red" />
            <span className="font-mono text-xs text-cyber-red uppercase font-bold tracking-wide">
              {warnings[0]}
            </span>
          </div>
          {warnings.length > 1 && (
            <span className="text-[9px] font-mono text-cyber-red/60 uppercase">
              + {warnings.length - 1} other critical failures
            </span>
          )}
        </div>
      )}

      {/* 3. COCKPIT CONTENT MATRIX */}
      <div className="flex-1 w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden z-30">
        
        {/* LEFT COLUMN: Data Feed & Visuals (Span 4) */}
        <section className="lg:col-span-4 flex flex-col gap-6 h-full overflow-hidden">
          
          {/* Real-time Line Charts */}
          <div className="glass-panel border-cyber-border rounded-xl p-5 flex flex-col h-[280px]">
            <div className="flex justify-between items-center mb-4">
              <span className="font-mono text-xs text-white uppercase tracking-wider font-bold">
                📈 High-Freq Financial Metrics Timeline
              </span>
              <span className="text-[9px] font-mono text-cyber-green animate-pulse">● LIVE Ticks</span>
            </div>
            
            <div className="flex-1 min-h-0 text-[10px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historyCharts} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="tickTime" tick={false} stroke="#475569" />
                  <YAxis stroke="#475569" />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: '10px' }} />
                  <Line type="monotone" dataKey="lcr" stroke="#3b82f6" name="LCR" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="panicIndex" stroke="#a855f7" name="Panic %" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="assetPrice" stroke="#ef4444" name="Asset Price" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Exposures / Balance Sheets Widget */}
          <div className="glass-panel border-cyber-border rounded-xl p-5 flex flex-col flex-1 min-h-0">
            <h3 className="font-mono text-xs text-white uppercase tracking-wider font-bold mb-4 flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-cyber-purple" /> HQLA Portfolio Assets
            </h3>

            <div className="space-y-4 overflow-y-auto pr-1">
              <div>
                <div className="flex justify-between text-xs font-mono text-gray-400 mb-1">
                  <span>Available Cash Reserves (HQLA)</span>
                  <span className="text-cyber-green font-bold">${portfolio.cash.toFixed(1)}M</span>
                </div>
                <div className="w-full bg-cyber-bg/60 h-2 border border-cyber-border rounded-full overflow-hidden">
                  <div className="bg-cyber-green h-full" style={{ width: `${Math.min(100, (portfolio.cash / 150) * 100)}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono text-gray-400 mb-1">
                  <span>Sovereign Government Bonds</span>
                  <span className="text-cyber-blue font-bold">${portfolio.govBonds.toFixed(1)}M</span>
                </div>
                <div className="w-full bg-cyber-bg/60 h-2 border border-cyber-border rounded-full overflow-hidden">
                  <div className="bg-cyber-blue h-full" style={{ width: `${Math.min(100, (portfolio.govBonds / 150) * 100)}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono text-gray-400 mb-1">
                  <span>Corporate High-Yield Bonds</span>
                  <span className="text-cyber-purple font-bold">${portfolio.corpBonds.toFixed(1)}M</span>
                </div>
                <div className="w-full bg-cyber-bg/60 h-2 border border-cyber-border rounded-full overflow-hidden">
                  <div className="bg-cyber-purple h-full" style={{ width: `${Math.min(100, (portfolio.corpBonds / 150) * 100)}%` }} />
                </div>
              </div>

              <div className="border-t border-cyber-border pt-3 grid grid-cols-2 gap-3 text-center">
                <div className="p-2 bg-cyber-bg/30 border border-cyber-border rounded-lg">
                  <div className="text-[8px] font-mono text-gray-500 uppercase">Value at Risk (VaR)</div>
                  <div className="font-mono text-xs text-white font-bold">${varValue.toFixed(1)}M</div>
                </div>
                <div className="p-2 bg-cyber-bg/30 border border-cyber-border rounded-lg">
                  <div className="text-[8px] font-mono text-gray-500 uppercase">Bid-Ask Spread</div>
                  <div className="font-mono text-xs text-cyber-amber font-bold">{(bidAskSpread * 100).toFixed(2)} bps</div>
                </div>
              </div>
            </div>
          </div>

        </section>

        {/* MIDDLE COLUMN: Interactive Quantitative Workspace (Span 5) */}
        <section className="lg:col-span-5 flex flex-col gap-6 h-full overflow-hidden">
          
          <div className="glass-panel border-cyber-border rounded-xl p-5 flex flex-col flex-1 min-h-0 relative">
            {/* Pulsing alerts if puzzle has feedback */}
            {puzzleSuccessAlert && (
              <div className="absolute top-4 left-4 right-4 z-40 p-3 border border-cyber-green bg-cyber-green/10 text-cyber-green text-xs font-mono rounded-lg animate-pulse uppercase">
                🛡️ {puzzleSuccessAlert}
              </div>
            )}
            {puzzleErrorAlert && (
              <div className="absolute top-4 left-4 right-4 z-40 p-3 border border-cyber-red bg-cyber-red/10 text-cyber-red text-xs font-mono rounded-lg animate-pulse uppercase">
                ⚠️ Regulatory alert: {puzzleErrorAlert}
              </div>
            )}

            <div className="flex justify-between items-center border-b border-cyber-border pb-4 mb-4">
              <span className="font-mono text-xs text-white uppercase tracking-wider font-bold flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-cyber-purple animate-spin" style={{ animationDuration: '4s' }} />
                Active Operations Workspace
              </span>
              <span className="text-[9px] font-mono bg-cyber-purple/20 text-cyber-purple px-1.5 py-0.5 border border-cyber-purple/30 rounded uppercase">
                STAGE {currentScenario}
              </span>
            </div>

            {/* Terminal View Switcher (For Small lobbies & Solo gaming mode) */}
            <div className="flex border-b border-cyber-border mb-4 bg-cyber-bg/50 p-1 rounded-lg">
              {['TRADER', 'TREASURY_MANAGER', 'RISK_MANAGER', 'ANALYST'].map((role) => (
                <button
                  key={role}
                  onClick={() => { sounds.playClick(); setActiveConsoleTab(role); }}
                  className={`flex-1 py-1.5 text-[9px] font-mono uppercase tracking-wider rounded-md transition-all ${
                    activeConsoleTab === role
                      ? 'bg-cyber-purple text-white shadow'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {role.split('_')[0]}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              
              {/* Dynamic Crisis description */}
              <div className="p-3 bg-cyber-surface/60 border border-cyber-border rounded-xl mb-4 font-mono">
                <div className="text-[10px] text-cyber-purple uppercase tracking-wider font-bold mb-1">Scenario Parameters:</div>
                <p className="text-xs text-white font-medium">{puzzleData?.description}</p>
                <div className="border-t border-cyber-border mt-2 pt-2 text-[10px] text-gray-400 leading-tight">
                  <span className="text-cyber-amber font-bold">OPERATIONS PROTOCOL:</span> {puzzleData?.instructions}
                </div>
              </div>

              {/* PUZZLE RENDER PANELS */}
              {puzzleActive && (
                <div className="border border-cyber-border rounded-xl p-4 bg-cyber-bg/25 mb-4">
                  <h4 className="font-mono text-[10px] text-gray-400 uppercase tracking-widest mb-4">Math calculations workbench:</h4>

                  {/* Puzzle 1 Console */}
                  {currentScenario === 1 && (
                    <div className="space-y-4">
                      <div className="p-3 border border-cyber-border rounded-lg bg-cyber-bg/50 flex justify-between items-center text-center">
                        <div>
                          <div className="text-[8px] font-mono text-gray-500 uppercase">Target Outflow</div>
                          <span className="font-mono text-sm text-cyber-red font-bold">${puzzleData.targetOutflow}M</span>
                        </div>
                        <div>
                          <div className="text-[8px] font-mono text-gray-500 uppercase">Valve Mults (A-B-C)</div>
                          <span className="font-mono text-xs text-white font-bold">{puzzleData.multipliers.A}x - {puzzleData.multipliers.B}x - {puzzleData.multipliers.C}x</span>
                        </div>
                        <div>
                          <div className="text-[8px] font-mono text-gray-500 uppercase">Input Flow Sum</div>
                          <span className="font-mono text-xs text-cyber-green font-bold">
                            ${(p1FlowA * puzzleData.multipliers.A) + (p1FlowB * puzzleData.multipliers.B) + (p1FlowC * puzzleData.multipliers.C)}M
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[9px] font-mono text-gray-500 uppercase text-center mb-1">Valve A (Max {puzzleData.limits.A})</label>
                          <input
                            type="number"
                            min={0}
                            max={puzzleData.limits.A}
                            value={p1FlowA}
                            onChange={(e) => setP1FlowA(Number(e.target.value))}
                            className="w-full bg-cyber-bg border border-cyber-border rounded px-2.5 py-1.5 text-center font-mono text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-mono text-gray-500 uppercase text-center mb-1">Valve B (Max {puzzleData.limits.B})</label>
                          <input
                            type="number"
                            min={0}
                            max={puzzleData.limits.B}
                            value={p1FlowB}
                            onChange={(e) => setP1FlowB(Number(e.target.value))}
                            className="w-full bg-cyber-bg border border-cyber-border rounded px-2.5 py-1.5 text-center font-mono text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-mono text-gray-500 uppercase text-center mb-1">Valve C (Max {puzzleData.limits.C})</label>
                          <input
                            type="number"
                            min={0}
                            max={puzzleData.limits.C}
                            value={p1FlowC}
                            onChange={(e) => setP1FlowC(Number(e.target.value))}
                            className="w-full bg-cyber-bg border border-cyber-border rounded px-2.5 py-1.5 text-center font-mono text-xs text-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Puzzle 2 Console */}
                  {currentScenario === 2 && (
                    <div className="space-y-4">
                      <div className="p-3 border border-cyber-border rounded-lg bg-cyber-bg/50 flex justify-between items-center text-center">
                        <div>
                          <div className="text-[8px] font-mono text-gray-500 uppercase">Margin Demanded</div>
                          <span className="font-mono text-sm text-cyber-red font-bold">${puzzleData.marginRequired}M</span>
                        </div>
                        <div>
                          <div className="text-[8px] font-mono text-gray-500 uppercase">Valuation haircuts</div>
                          <span className="font-mono text-[9px] text-white font-bold">
                            Cash:{puzzleData.haircuts.cash}% / Gov:{puzzleData.haircuts.govBonds}% / Corp:{puzzleData.haircuts.corpBonds}%
                          </span>
                        </div>
                        <div>
                          <div className="text-[8px] font-mono text-gray-500 uppercase">Valued Posted</div>
                          <span className="font-mono text-xs text-cyber-green font-bold">
                            ${(p2Cash * 1.0 + p2Gov * 0.85 + p2Corp * 0.60).toFixed(1)}M
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[8px] font-mono text-gray-500 uppercase text-center mb-1">Cash (Max {puzzleData.portfolio.cash})</label>
                          <input
                            type="number"
                            min={0}
                            max={puzzleData.portfolio.cash}
                            value={p2Cash}
                            onChange={(e) => setP2Cash(Number(e.target.value))}
                            className="w-full bg-cyber-bg border border-cyber-border rounded px-2.5 py-1.5 text-center font-mono text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] font-mono text-gray-500 uppercase text-center mb-1">Gov Bonds (Max {puzzleData.portfolio.govBonds})</label>
                          <input
                            type="number"
                            min={0}
                            max={puzzleData.portfolio.govBonds}
                            value={p2Gov}
                            onChange={(e) => setP2Gov(Number(e.target.value))}
                            className="w-full bg-cyber-bg border border-cyber-border rounded px-2.5 py-1.5 text-center font-mono text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] font-mono text-gray-500 uppercase text-center mb-1">Corp Bonds (Max {puzzleData.portfolio.corpBonds})</label>
                          <input
                            type="number"
                            min={0}
                            max={puzzleData.portfolio.corpBonds}
                            value={p2Corp}
                            onChange={(e) => setP2Corp(Number(e.target.value))}
                            className="w-full bg-cyber-bg border border-cyber-border rounded px-2.5 py-1.5 text-center font-mono text-xs text-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Puzzle 3 Console */}
                  {currentScenario === 3 && (
                    <div className="space-y-4">
                      <div className="p-3 border border-cyber-border rounded-lg bg-cyber-bg/50 flex justify-between items-center text-center">
                        <div>
                          <div className="text-[8px] font-mono text-gray-500 uppercase">Liquidation Goal</div>
                          <span className="font-mono text-sm text-white font-bold">${puzzleData.liquidateAmount}M</span>
                        </div>
                        <div>
                          <div className="text-[8px] font-mono text-gray-500 uppercase">Sum Allocated</div>
                          <span className="font-mono text-xs text-cyber-blue font-bold">${p3Lit + p3Dark + p3Otc}M</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[8px] font-mono text-gray-500 uppercase text-center mb-1">Lit Exchange (Max {puzzleData.venues.lit.maxDepth})</label>
                          <input
                            type="number"
                            min={0}
                            value={p3Lit}
                            onChange={(e) => setP3Lit(Number(e.target.value))}
                            className="w-full bg-cyber-bg border border-cyber-border rounded px-2.5 py-1.5 text-center font-mono text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] font-mono text-gray-500 uppercase text-center mb-1">Dark Pool (Max {puzzleData.venues.dark.maxDepth})</label>
                          <input
                            type="number"
                            min={0}
                            value={p3Dark}
                            onChange={(e) => setP3Dark(Number(e.target.value))}
                            className="w-full bg-cyber-bg border border-cyber-border rounded px-2.5 py-1.5 text-center font-mono text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] font-mono text-gray-500 uppercase text-center mb-1">OTC Desk (Unlimited)</label>
                          <input
                            type="number"
                            min={0}
                            value={p3Otc}
                            onChange={(e) => setP3Otc(Number(e.target.value))}
                            className="w-full bg-cyber-bg border border-cyber-border rounded px-2.5 py-1.5 text-center font-mono text-xs text-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Puzzle 4 Console */}
                  {currentScenario === 4 && (
                    <div className="space-y-4">
                      <div className="p-3 border border-cyber-border rounded-lg bg-cyber-bg/50 text-center font-mono">
                        <div className="text-[8px] text-gray-500 uppercase mb-1">Primary Contagion Source</div>
                        <span className="text-xs text-cyber-red font-bold uppercase animate-pulse">{puzzleData.defaultedNode} (DEFAULTED)</span>
                      </div>

                      <div className="space-y-2">
                        {puzzleData.nodes.map((node: any) => (
                          <div key={node.name} className="flex justify-between items-center p-2.5 border border-cyber-border bg-cyber-bg/40 rounded-lg">
                            <div>
                              <span className="font-mono text-xs text-white font-bold">{node.name}</span>
                              <div className="flex gap-2 text-[8px] font-mono text-gray-500 mt-0.5">
                                <span>Rating: {node.rating}</span>
                                <span>Exposure: ${node.exposure}M</span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => toggleNodeCut(node.name)}
                                className={`px-2 py-1 font-mono text-[9px] uppercase font-bold rounded border transition-all ${
                                  p4Cuts.includes(node.name)
                                    ? 'border-cyber-red bg-cyber-red/10 text-cyber-red'
                                    : 'border-cyber-border text-gray-500'
                                }`}
                              >
                                {p4Cuts.includes(node.name) ? 'Cut Line' : 'Connect'}
                              </button>
                              <button
                                onClick={() => toggleNodeCds(node.name)}
                                className={`px-2 py-1 font-mono text-[9px] uppercase font-bold rounded border transition-all ${
                                  p4Cds.includes(node.name)
                                    ? 'border-cyber-purple bg-cyber-purple/10 text-cyber-purple'
                                    : 'border-cyber-border text-gray-500'
                                }`}
                              >
                                {p4Cds.includes(node.name) ? 'CDS Active' : 'CDS Off'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Puzzle 5 Console */}
                  {currentScenario === 5 && (
                    <div className="space-y-4">
                      <div className="p-3 border border-cyber-border rounded-lg bg-cyber-bg/50 flex justify-between items-center text-center font-mono">
                        <div>
                          <div className="text-[8px] text-gray-500 uppercase">Regulatory LCR Target</div>
                          <span className="text-xs text-cyber-green font-bold">100%</span>
                        </div>
                        <div>
                          <div className="text-[8px] text-gray-500 uppercase">CB Penalty Rate</div>
                          <span className="text-xs text-white font-bold">{puzzleData.penaltyRatePercent}%</span>
                        </div>
                        <div>
                          <div className="text-[8px] text-gray-500 uppercase">Max Int. Budget</div>
                          <span className="text-xs text-cyber-red font-bold">${puzzleData.maxInterestBudget}M</span>
                        </div>
                      </div>

                      <div className="max-w-xs mx-auto text-center">
                        <label className="block text-[9px] font-mono text-gray-500 uppercase mb-2">Fed Discount Window Draw amount ($M)</label>
                        <input
                          type="number"
                          min={0}
                          value={p5FedDraw}
                          onChange={(e) => setP5FedDraw(Number(e.target.value))}
                          className="w-full max-w-[150px] bg-cyber-bg border border-cyber-border rounded px-3 py-2 text-center font-mono text-sm text-white"
                        />
                        <div className="text-[9px] font-mono text-gray-500 mt-2">
                          Projected Interest cost: ${(p5FedDraw * puzzleData.penaltyRatePercent / 100).toFixed(2)}M
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Workspace validation buttons */}
                  <div className="mt-5 flex gap-3">
                    <button
                      onClick={handlePuzzleSubmit}
                      className="flex-1 py-2.5 bg-cyber-green hover:bg-green-600 active:scale-[0.98] text-white font-mono uppercase text-xs font-bold rounded-lg shadow transition-all flex items-center justify-center gap-1.5"
                    >
                      <Zap className="w-4 h-4 animate-bounce" />
                      Submit Calculation to Mainframe
                    </button>
                  </div>
                </div>
              )}

              {/* Exclusive Analyst Dashboard Hints Panel */}
              {activeConsoleTab === 'ANALYST' && (
                <div className="border border-cyber-border rounded-xl p-4 bg-cyber-purple/5">
                  <h4 className="font-mono text-xs text-cyber-purple uppercase tracking-wider font-bold mb-3 flex items-center gap-1">
                    <HelpCircle className="w-4 h-4" /> Decryption & Analyst Hints Console
                  </h4>
                  <p className="text-[10px] font-mono text-gray-400 mb-4 leading-tight">
                    Analysts can draw intelligence files from regulators at the cost of slight panic increments. Coordinate the decrypted results verbally with the team!
                  </p>

                  <button
                    onClick={() => { sounds.playClick(); requestHints(); }}
                    className="w-full py-2 bg-cyber-purple/20 hover:bg-cyber-purple/35 text-cyber-purple border border-cyber-purple/30 font-mono uppercase text-[10px] font-bold rounded-lg transition-all mb-4"
                  >
                    Request Decrypted Target Coordinates (+2% Panic Cost)
                  </button>

                  {analystHints && (
                    <div className="space-y-2">
                      <div className="text-[9px] font-mono text-cyber-purple uppercase tracking-widest">REGULATORY HINT ENVELOPE:</div>
                      {analystHints.map((hint, idx) => (
                        <div key={idx} className="p-2.5 bg-cyber-bg/40 border border-cyber-purple/30 text-gray-200 text-xs font-mono rounded-lg">
                          • {hint}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: Actions panel, Comms and Audits (Span 3) */}
        <section className="lg:col-span-3 flex flex-col gap-6 h-full overflow-hidden">
          
          {/* Main Console Operation Panel */}
          <div className="glass-panel border-cyber-border rounded-xl p-4 flex flex-col">
            <h3 className="font-mono text-xs text-white uppercase tracking-wider font-bold mb-3 flex items-center gap-1">
              <Shield className="w-4 h-4 text-cyber-amber" /> Operational HUD Console
            </h3>

            <div className="space-y-3">
              {/* Trader actions */}
              <div className="border border-cyber-border p-3 bg-cyber-bg/20 rounded-lg">
                <span className="block text-[8px] font-mono text-gray-500 uppercase mb-2">Trader Desk liquidations</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleTraderSell('govBonds', 10)}
                    disabled={portfolio.govBonds < 10}
                    className="py-1.5 border border-cyber-blue hover:bg-cyber-blue/10 disabled:opacity-20 text-cyber-blue font-mono text-[9px] uppercase font-bold rounded-md transition-all"
                  >
                    Sell $10M Gov
                  </button>
                  <button
                    onClick={() => handleTraderSell('corpBonds', 10)}
                    disabled={portfolio.corpBonds < 10}
                    className="py-1.5 border border-cyber-purple hover:bg-cyber-purple/10 disabled:opacity-20 text-cyber-purple font-mono text-[9px] uppercase font-bold rounded-md transition-all"
                  >
                    Sell $10M Corp
                  </button>
                </div>
              </div>

              {/* Treasury actions */}
              <div className="border border-cyber-border p-3 bg-cyber-bg/20 rounded-lg">
                <span className="block text-[8px] font-mono text-gray-500 uppercase mb-2">Treasury Desk funding</span>
                <button
                  onClick={() => handleTreasuryBorrow(25)}
                  className="w-full py-1.5 border border-cyber-green hover:bg-cyber-green/10 text-cyber-green font-mono text-[9px] uppercase font-bold rounded-md transition-all flex items-center justify-center gap-1"
                >
                  <Zap className="w-3.5 h-3.5" />
                  CB Window Draw $25M
                </button>
              </div>

              {/* Risk actions */}
              <div className="border border-cyber-border p-3 bg-cyber-bg/20 rounded-lg">
                <span className="block text-[8px] font-mono text-gray-500 uppercase mb-2">Risk Desk hedging</span>
                <button
                  onClick={handleRiskHedging}
                  disabled={portfolio.cash < 4}
                  className="w-full py-1.5 border border-cyber-amber hover:bg-cyber-amber/10 disabled:opacity-20 text-cyber-amber font-mono text-[9px] uppercase font-bold rounded-md transition-all"
                >
                  Execute Swap Hedge (Cost $4M)
                </button>
              </div>
            </div>
          </div>

          {/* Audit Logs Ticker (Console logs) */}
          <div className="glass-panel border-cyber-border rounded-xl p-4 flex flex-col h-[180px]">
            <span className="font-mono text-[10px] text-gray-500 uppercase tracking-widest mb-2 block border-b border-cyber-border pb-1.5">
              ⚖️ Systemic Audit Logs
            </span>
            <div className="flex-1 overflow-y-auto font-mono text-[9px] text-cyber-green space-y-1.5 pr-1">
              {auditLogs.map((log) => (
                <div key={log.id} className="leading-tight">
                  <span className="opacity-50">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                  <span className="text-white">[{log.actorRole}]</span> {log.message}
                </div>
              ))}
              <div ref={auditEndRef} />
            </div>
          </div>

          {/* Role-to-Role Comms Instant Chat */}
          <div className="glass-panel border-cyber-border rounded-xl p-4 flex flex-col flex-1 min-h-0">
            <span className="font-mono text-[10px] text-gray-500 uppercase tracking-widest mb-2 block border-b border-cyber-border pb-1.5 flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" /> Instant Team Communication
            </span>
            
            <div className="flex-1 overflow-y-auto space-y-2 mb-2 pr-1">
              {chatMessages.map((msg, index) => (
                <div key={index} className="text-[10px] leading-tight font-mono">
                  <span className="text-cyber-purple font-bold">[{msg.sender}]</span>{' '}
                  <span className="text-gray-500 text-[8px]">({msg.role.split('_')[0]})</span>:{' '}
                  <span className="text-gray-200">{msg.message}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendChat} className="flex gap-2">
              <input
                type="text"
                placeholder="Coordinate code..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 bg-cyber-bg/80 border border-cyber-border rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-cyber-purple font-mono placeholder:text-gray-600"
              />
              <button 
                type="submit"
                className="bg-cyber-purple hover:bg-purple-600 text-white p-1 rounded-md active:scale-95 transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

        </section>

      </div>

      {/* 4. ADMIN HUD DRAWER (Bottom floating trigger) */}
      <footer className="z-50 px-6 py-2 bg-cyber-surface border-t border-cyber-border flex justify-between items-center">
        <span className="text-[9px] font-mono text-gray-500 uppercase">
          OPERATIONAL UNIT STATUS: TERMINALS LOCKED & SYNCHRONIZED
        </span>

        <div className="flex gap-4">
          {/* Admin panel launcher */}
          {players.length > 0 && players[0].userId === user?.id && (
            <div className="relative">
              <button
                onClick={() => { sounds.playClick(); setAdminOpen(!adminOpen); }}
                className="flex items-center gap-1 text-[9px] font-mono text-cyber-amber hover:text-amber-500 uppercase border border-cyber-amber/30 px-2 py-0.5 rounded bg-cyber-amber/5 transition-all"
              >
                <Settings className="w-3 h-3 animate-spin" /> Admin Shock Override
              </button>
              
              {adminOpen && (
                <div className="absolute right-0 bottom-full mb-2 w-64 glass-panel border-cyber-amber/40 bg-cyber-surface rounded-xl p-4 shadow-xl z-50 text-left font-mono">
                  <div className="text-[10px] text-cyber-amber uppercase tracking-widest font-bold mb-3 border-b border-cyber-amber/20 pb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-cyber-amber animate-pulse" /> Manual Crisis Shocks HUD
                  </div>
                  <p className="text-[9px] text-gray-400 mb-3 leading-tight">
                    Inject artificial liquidity crunch, rate hikes, or credit downgrades into active game parameters.
                  </p>
                  
                  <div className="space-y-2">
                    <button
                      onClick={() => { sounds.playFailure(); triggerAdminShock('FED_INTEREST_HIKE'); }}
                      className="w-full text-left p-2 bg-cyber-bg/50 border border-cyber-border hover:border-cyber-amber rounded text-[9px] text-white hover:text-cyber-amber transition-all uppercase flex items-center gap-1.5"
                    >
                      <Play className="w-2.5 h-2.5 text-cyber-amber" /> 75bps Rate Hike Shock
                    </button>
                    <button
                      onClick={() => { sounds.playFailure(); triggerAdminShock('RATING_DOWNGRADE'); }}
                      className="w-full text-left p-2 bg-cyber-bg/50 border border-cyber-border hover:border-cyber-amber rounded text-[9px] text-white hover:text-cyber-amber transition-all uppercase flex items-center gap-1.5"
                    >
                      <Play className="w-2.5 h-2.5 text-cyber-amber" /> Sovereign Debt Downgrade
                    </button>
                    <button
                      onClick={() => { sounds.playFailure(); triggerAdminShock('LIQUIDITY_CRUNCH'); }}
                      className="w-full text-left p-2 bg-cyber-bg/50 border border-cyber-border hover:border-cyber-amber rounded text-[9px] text-white hover:text-cyber-amber transition-all uppercase flex items-center gap-1.5"
                    >
                      <Play className="w-2.5 h-2.5 text-cyber-amber" /> Direct Cash Squeeze
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </footer>
    </CrtWrapper>
  );
};
