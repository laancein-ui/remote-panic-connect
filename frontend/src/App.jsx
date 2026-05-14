import { useEffect, useState, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import io from 'socket.io-client';
import Login from './components/Login';
import Register from './components/Register';
import ChatModeSelect from './components/ChatModeSelect';
import GlobalChat from './components/GlobalChat';
import LocalChat from './components/LocalChat';
import UpdatePassword from './components/UpdatePassword';
import Downloads from './components/Downloads';
import AlertHistory from './components/AlertHistory';
import AlertBanner from './components/AlertBanner';
import './index.css';

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = !!localStorage.getItem('token');
  return isAuthenticated ? children : <Navigate to="/" />;
};

function App() {
  const [activeAlert, setActiveAlert] = useState(null);

  // Use refs for persistent objects that don't need to trigger re-renders
  const audioCtxRef = useRef(null);
  const socketRef = useRef(null);

  const registerSession = () => {
    const storedUser = localStorage.getItem('user');
    if (storedUser && socketRef.current) {
      const user = JSON.parse(storedUser);
      const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      socketRef.current.emit('register_bg_session', { userId: user.id, isMobile: isMobileDevice, email: user.email });
    }
  };

  const triggerAlert = () => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) return;
    const user = JSON.parse(storedUser);
    const senderName = user.name || user.email || 'Anonymous';
    const socket = socketRef.current;
    if (!socket) return;

    const emit = () => {
      socket.emit('panic_trigger_targeted_email', { senderName, senderId: user.id });
    };

    const playLocalAlert = () => {
      if ('vibrate' in navigator) {
        navigator.vibrate([300, 100, 300]);
      }
      const ctx = audioCtxRef.current;
      if (ctx) {
        const playBell = () => {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1046.5, ctx.currentTime);
          const osc2 = ctx.createOscillator();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(2093.0, ctx.currentTime);
          const gainNode = ctx.createGain();
          gainNode.gain.setValueAtTime(1, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
          osc.connect(gainNode);
          osc2.connect(gainNode);
          gainNode.connect(ctx.destination);
          osc.start();
          osc2.start();
          osc.stop(ctx.currentTime + 1.5);
          osc2.stop(ctx.currentTime + 1.5);
        };
        if (ctx.state === 'suspended') {
          ctx.resume().then(playBell);
        } else {
          playBell();
        }
      }
      alert(`⚠️ Emergency Alert sent by ${senderName}`);
    };

    if (!socket.connected) {
      socket.connect();
      socket.once('connect', () => {
        registerSession();
        emit();
        playLocalAlert();
      });
    } else {
      emit();
      playLocalAlert();
    }
  };

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowDown') {
      e.preventDefault();
      triggerAlert();
    }
  };

  useEffect(() => {
    // Audio Context Setup
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx && !audioCtxRef.current) {
      audioCtxRef.current = new AudioCtx();
    }

    const unlockAudio = () => {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    window.addEventListener('keydown', unlockAudio);

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  useEffect(() => {
    let serverUrl = import.meta.env.VITE_API_URL;
    if (!serverUrl) {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        serverUrl = `http://${window.location.hostname}:5002`;
      } else {
        serverUrl = 'https://panic-chat-backend.onrender.com';
      }
    }

    const bgSocket = io(serverUrl, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });
    socketRef.current = bgSocket;

    bgSocket.on('connect', registerSession);
    bgSocket.on('reconnect', registerSession);

    const intervalId = setInterval(registerSession, 5000);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.error('ServiceWorker registration failed: ', err);
      });
    }

    bgSocket.on('panic_alert', (data) => {
      if ("vibrate" in navigator) {
        navigator.vibrate([300, 100, 300]);
      }
      
      const ctx = audioCtxRef.current;
      if (ctx) {
        const playBell = () => {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1046.50, ctx.currentTime);
          const osc2 = ctx.createOscillator();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(2093.00, ctx.currentTime);
          const gainNode = ctx.createGain();
          gainNode.gain.setValueAtTime(1, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
          osc.connect(gainNode);
          osc2.connect(gainNode);
          gainNode.connect(ctx.destination);
          osc.start();
          osc2.start();
          osc.stop(ctx.currentTime + 1.5);
          osc2.stop(ctx.currentTime + 1.5);
        };

        if (ctx.state === 'suspended') {
          ctx.resume().then(playBell);
        } else {
          playBell();
        }
      }

      // Small delay before blocking alert to ensure sound starts properly
      setTimeout(() => {
        alert(`⚠️ Emergency Alert: ${data.name}\nIP: ${data.ip}`);
      }, 50);
    });

    window.addEventListener('keydown', handleKeyDown);
    
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('keydown', handleKeyDown);
      bgSocket.off('connect', registerSession);
      bgSocket.off('reconnect', registerSession);
      bgSocket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return (
    <Router>
      <div className="app-container">
        <AlertBanner alert={activeAlert} onClose={() => setActiveAlert(null)} />
        <button onClick={triggerAlert} style={{
          margin: '0.5rem',
          padding: '0.5rem 1rem',
          backgroundColor: '#d9534f',
          color: '#fff',
          border: 'none',
          borderRadius: '0.4rem',
          cursor: 'pointer',
          fontWeight: '600',
          position: 'relative',
          zIndex: 1000
        }}>
          Emergency Alert (CMD + DOWN)
        </button>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/modes" element={<ProtectedRoute><ChatModeSelect /></ProtectedRoute>} />
          <Route path="/global" element={<ProtectedRoute><GlobalChat /></ProtectedRoute>} />
          <Route path="/local" element={<ProtectedRoute><LocalChat /></ProtectedRoute>} />
          <Route path="/downloads" element={<ProtectedRoute><Downloads /></ProtectedRoute>} />
          <Route path="/alert-history" element={<ProtectedRoute><AlertHistory /></ProtectedRoute>} />
          <Route path="/update-password" element={<UpdatePassword />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
