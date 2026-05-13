import { useEffect, useState } from 'react';
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

  useEffect(() => {
    let serverUrl = import.meta.env.VITE_API_URL;
    if (!serverUrl) {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        serverUrl = `http://${window.location.hostname}:5002`;
      } else {
        serverUrl = 'https://panic-chat-backend.onrender.com';
      }
    }

    // Enable auto-reconnection with aggressive settings so the socket
    // NEVER permanently dies while the user is logged in.
    const bgSocket = io(serverUrl, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    const registerSession = () => {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        bgSocket.emit('register_bg_session', { userId: user.id, isMobile: isMobileDevice, email: user.email });
      }
    };

    // Register immediately on connect and again after every reconnect
    bgSocket.on('connect', registerSession);
    bgSocket.on('reconnect', registerSession);

    // Keep re-registering every 5s to survive any silent drops
    const intervalId = setInterval(registerSession, 5000);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.error('ServiceWorker registration failed: ', err);
      });
    }

    bgSocket.on('panic_alert', (data) => {
      try {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        
        // Main bell tone
        const osc = context.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1046.50, context.currentTime); // High C

        // Harmonic overtone
        const osc2 = context.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(2093.00, context.currentTime);

        // Amplitude envelope for the "ding" decay
        const gainNode = context.createGain();
        gainNode.gain.setValueAtTime(1, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 1.5);

        osc.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(context.destination);

        osc.start();
        osc2.start();
        osc.stop(context.currentTime + 1.5);
        osc2.stop(context.currentTime + 1.5);
      } catch (e) {
        console.error('Audio chime failed:', e);
      }

      const title = `⚠️ Emergency Alert: ${data.name}`;
      const options = {
        body: `Direct Alert activated from linked device via IP: ${data.ip}`,
        vibrate: [300, 100, 300],
        icon: '/favicon.svg'
      };

      // Native Web Notifications Fallback
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, options);
      } else if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification(title, options);
          }
        });
      }

      // Also trigger via Service Worker for active cross-platform/mobile stability
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, options);
        });
      }

      // Show in-app banner (replaces blocking window.alert)
      setActiveAlert(data);
    });

    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowDown') {
        e.preventDefault();
        const storedUser = localStorage.getItem('user');
        if (!storedUser) return;
        const user = JSON.parse(storedUser);
        const senderName = user.name || user.email || 'Anonymous';

        const doEmit = () => {
          bgSocket.emit('panic_trigger_targeted_email', { senderName, senderId: user.id });
        };

        // If socket is disconnected, reconnect first then emit
        if (!bgSocket.connected) {
          bgSocket.connect();
          bgSocket.once('connect', () => {
            registerSession();
            doEmit();
          });
        } else {
          doEmit();
        }
      }
    };

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
    };
  }, []);

  return (
    <Router>
      <div className="app-container">
        <AlertBanner alert={activeAlert} onClose={() => setActiveAlert(null)} />
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
