import { useEffect, useState } from 'react';
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
  const [panicNotification, setPanicNotification] = useState(null);

  useEffect(() => {
    let serverUrl = import.meta.env.VITE_API_URL;
    if (!serverUrl) {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        serverUrl = `http://${window.location.hostname}:5002`;
      } else {
        serverUrl = 'https://panic-chat-backend.onrender.com';
      }
    }
    const bgSocket = io(serverUrl);

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
      // Create visually rich in-app floating banner
      setPanicNotification(data);
      setTimeout(() => setPanicNotification(null), 12000);

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

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`Device Alert: ${data.name}`, {
          body: `Direct Alert activated from linked device via IP: ${data.ip}`,
          vibrate: [300, 100, 300]
        });
      }
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
      <div className="app-container" style={{ position: 'relative' }}>
        {panicNotification && (
          <div style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#ef4444',
            color: '#ffffff',
            padding: '1.25rem 2rem',
            borderRadius: '16px',
            boxShadow: '0 12px 40px rgba(239, 68, 68, 0.4)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            animation: 'slideDown 0.4s ease-out',
            border: '2px solid rgba(255,255,255,0.2)',
            minWidth: '320px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: '800', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🚨 Remote Alert Triggered
              </div>
              <button 
                onClick={() => setPanicNotification(null)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '1.5rem', lineHeight: '1', padding: 0 }}
              >
                ×
              </button>
            </div>
            <div style={{ fontSize: '1rem', opacity: 0.95, marginTop: '4px' }}>
              Triggered by user: <strong>{panicNotification.name}</strong>
            </div>
            <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
              Network IP: {panicNotification.ip}
            </div>
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
