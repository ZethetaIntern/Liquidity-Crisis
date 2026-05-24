import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/auth';
import { CrtWrapper } from '../components/CrtWrapper';
import { sounds } from '../utils/sound';
import { Lock, Mail, User, ShieldAlert, Cpu } from 'lucide-react';

export const AuthPage: React.FC = () => {
  const { login } = useAuthStore();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    sounds.playClick();
  }, [isLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    sounds.playClick();

    const endpoint = isLogin ? '/api/v1/auth/login' : '/api/v1/auth/signup';
    const payload = isLogin 
      ? { username, password }
      : { username, email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Authentication failed');
        sounds.playFailure();
      } else {
        sounds.playSuccess();
        login(data.token, data.user);
      }
    } catch (err) {
      console.error(err);
      setError('Connection to security gateway failed.');
      sounds.playFailure();
    } finally {
      setLoading(false);
    }
  };

  return (
    <CrtWrapper className="flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        
        {/* Terminal Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-cyber-green/30 bg-cyber-green/5 rounded-full mb-3">
            <Cpu className="w-4 h-4 text-cyber-green animate-pulse" />
            <span className="text-[10px] font-mono text-cyber-green uppercase tracking-wider">Quant terminal network // Node v3.8</span>
          </div>
          
          <h1 className="text-3xl font-bold tracking-tight text-white uppercase neon-text-purple font-mono">
            LIQUIDITY CRISIS
          </h1>
          <p className="text-xs text-gray-400 mt-2 font-mono">
            ESCAPE ROOM & FINANCIAL RISK SIMULATOR
          </p>
        </div>

        {/* Auth Glass Card */}
        <div className="glass-panel border-cyber-border rounded-xl p-8 relative shadow-2xl overflow-hidden">
          
          {/* Neon Top Bar indicator */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-right from-transparent via-cyber-purple to-transparent animate-pulse" />

          <div className="flex border-b border-cyber-border mb-6">
            <button
              onClick={() => { setIsLogin(true); setError(null); }}
              className={`flex-1 pb-3 text-sm font-mono uppercase tracking-wide border-b-2 transition-all ${
                isLogin ? 'border-cyber-purple text-white' : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              System Access
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(null); }}
              className={`flex-1 pb-3 text-sm font-mono uppercase tracking-wide border-b-2 transition-all ${
                !isLogin ? 'border-cyber-purple text-white' : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              Enlist Operator
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 mb-6 p-3 border border-cyber-red/30 bg-cyber-red/10 rounded-md text-xs font-mono text-cyber-red">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 animate-bounce" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-mono uppercase text-gray-400 mb-1.5">Username ID</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  required
                  placeholder="e.g. OPERATOR_49"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-cyber-bg/50 border border-cyber-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyber-purple transition-all font-mono placeholder:text-gray-600"
                />
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="block text-xs font-mono uppercase text-gray-400 mb-1.5">Regulatory Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="email"
                    required
                    placeholder="operator@sec.gov"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-cyber-bg/50 border border-cyber-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyber-purple transition-all font-mono placeholder:text-gray-600"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-mono uppercase text-gray-400 mb-1.5">Terminal Keycode</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-cyber-bg/50 border border-cyber-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyber-purple transition-all font-mono placeholder:text-gray-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-gradient-to-r from-cyber-purple to-cyber-blue hover:from-purple-600 hover:to-blue-600 active:scale-[0.98] text-white font-mono uppercase text-xs tracking-wider font-bold py-3 px-4 rounded-lg shadow-lg shadow-cyber-purple/20 transition-all flex justify-center items-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isLogin ? (
                'Request Clearance'
              ) : (
                'Register Operator'
              )}
            </button>
          </form>
        </div>

        {/* Footer info decals */}
        <div className="text-center mt-6">
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">
            WARN: RESTRICTED ACCESS. UNAUTHORIZED INTERFERENCE MONITORED BY S.E.C. F.I.R.A.S.
          </span>
        </div>

      </div>
    </CrtWrapper>
  );
};
