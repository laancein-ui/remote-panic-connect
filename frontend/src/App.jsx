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
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) return;
    const user = JSON.parse(storedUser);

    let serverUrl = import.meta.env.VITE_API_URL;
    if (!serverUrl) {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        serverUrl = `http://${window.location.hostname}:5002`;
      } else {
        serverUrl = 'https://panic-chat-backend.onrender.com';
      }
    }
    const bgSocket = io(serverUrl);

    bgSocket.on('connect', () => {
      const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      bgSocket.emit('register_bg_session', { userId: user.id, isMobile: isMobileDevice });
    });

    bgSocket.on('panic_alert', (data) => {
      // Audio Chime Fallback for extreme emergency premium WOW factor
      try {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        const osc = context.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, context.currentTime); // High pitch
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
      alert(`⚠️ EMERGENCY ALERT TRIGGERED: Remote trigger activated from linked device on IP ${data.ip} by user ${data.name}!`);
    });

    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowDown') {
        e.preventDefault();
        const targetId = localStorage.getItem('linked_target_id');
        if (targetId) {
          bgSocket.emit('panic_trigger_targeted', { userId: user.id, name: user.name, targetId });
        } else {
          bgSocket.emit('panic_trigger', { userId: user.id, name: user.name });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      bgSocket.disconnect();
    };
  }, []);

  return (
    <Router>
      <div className="app-container">
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
