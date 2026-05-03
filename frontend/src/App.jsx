import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import io from 'socket.io-client';
import Login from './components/Login';
import Register from './components/Register';
import ChatModeSelect from './components/ChatModeSelect';
import GlobalChat from './components/GlobalChat';
import LocalChat from './components/LocalChat';
import WiFiShare from './components/WiFiShare';
import './index.css';

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = !!localStorage.getItem('token');
  return isAuthenticated ? children : <Navigate to="/" />;
};

function App() {
  const requestPermission = () => {
    if ('Notification' in window) {
      Notification.requestPermission().then((perm) => {
        alert(`Notification status: ${perm}`);
      });
    }
  };

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
      timeout: 20000
    });

    // Continuous user session tracking
    const intervalId = setInterval(() => {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        bgSocket.emit('register_bg_session', { userId: user.id, isMobile: isMobileDevice, email: user.email });
      }
    }, 2000);

    bgSocket.on('panic_alert', (data) => {
      try {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        const osc = context.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, context.currentTime);
        osc.connect(context.destination);
        osc.start();
        osc.stop(context.currentTime + 1.25);
      } catch (e) {
        console.error('Audio chime failed:', e);
      }

      const timeStr = new Date().toLocaleTimeString();

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`Triggered by: ${data.name}`, {
          body: `Time: ${timeStr} - User '${data.name}' pressed Cmd + Down / Ctrl + Down`,
          vibrate: [300, 100, 300]
        });
      }
      alert(`⚠️ EMERGENCY ALERT TRIGGERED!\nTime: ${timeStr}\nShortcut clicked by user: '${data.name}'\nFrom IP: ${data.ip}`);
    });

    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowDown') {
        e.preventDefault();
        const storedUser = localStorage.getItem('user');
        if (!storedUser) return;
        const user = JSON.parse(storedUser);
        
        // Broadcast directly to target account laancein@gmail.com
        bgSocket.emit('panic_trigger_targeted_email', { senderName: user.name || user.email || 'Anonymous' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('keydown', handleKeyDown);
      bgSocket.disconnect();
    };
  }, []);

  return (
    <Router>
      <div className="app-container">
        {('Notification' in window && Notification.permission !== 'granted') && (
          <div style={{
            backgroundColor: 'var(--accent-color)',
            color: 'white',
            padding: '12px',
            textAlign: 'center',
            fontSize: '0.95rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            position: 'sticky',
            top: 0,
            zIndex: 1000
          }} onClick={requestPermission}>
            <span>🔔 Click here to Enable Desktop/Mobile Emergency Alert Notifications</span>
          </div>
        )}
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/modes" element={<ProtectedRoute><ChatModeSelect /></ProtectedRoute>} />
          <Route path="/global" element={<ProtectedRoute><GlobalChat /></ProtectedRoute>} />
          <Route path="/local" element={<ProtectedRoute><LocalChat /></ProtectedRoute>} />
          <Route path="/wifishare" element={<ProtectedRoute><WiFiShare /></ProtectedRoute>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
