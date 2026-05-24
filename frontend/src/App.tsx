import React, { useEffect } from 'react';
import { useAuthStore } from './store/auth';
import { useGameStateStore } from './store/gameStateStore';
import { AuthPage } from './pages/AuthPage';
import { LobbyPage } from './pages/LobbyPage';
import { GameRoomPage } from './pages/GameRoomPage';

const App: React.FC = () => {
  const { isAuthenticated, syncUser } = useAuthStore();
  const { status } = useGameStateStore();

  // Try to restore user profile if token is present
  useEffect(() => {
    if (isAuthenticated) {
      syncUser();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  if (status === 'LOBBY') {
    return <LobbyPage />;
  }

  return <GameRoomPage />;
};

export default App;
