import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, User, Wifi, ShieldAlert } from 'lucide-react';
import io from 'socket.io-client';

export default function AlertHistory() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // Guard: redirect non-authorized accounts
  useEffect(() => {
    if (user?.email !== 'laancein@gmail.com') {
      navigate('/modes');
      return;
    }

    let serverUrl = import.meta.env.VITE_API_URL || 'https://panic-chat-backend.onrender.com';
    const socket = io(serverUrl, { reconnection: true });

    socket.on('connect', () => {
      socket.emit('register_bg_session', { userId: user.id, isMobile: false, email: user.email });
      socket.emit('get_alert_history');
    });

    socket.on('alert_history', (data) => {
      setHistory(data);
      setLoading(false);
    });

    // Also update in real-time when a new panic alert fires
    socket.on('panic_alert', (data) => {
      setHistory(prev => [
        { senderName: data.name, senderId: data.senderId, senderIp: data.ip, triggeredAt: data.triggeredAt || new Date().toISOString() },
        ...prev
      ]);
    });

    return () => socket.disconnect();
  }, []);

  if (user?.email !== 'laancein@gmail.com') return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '720px', margin: '0 auto', gap: '1.5rem' }}>
      <button
        className="btn btn-secondary"
        style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        onClick={() => navigate('/modes')}
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <ShieldAlert size={36} color="var(--primary-color)" />
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.2rem' }}>Alert History</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>All panic alerts sent to laancein@gmail.com</p>
        </div>
      </div>

      {loading ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Loading alert history...
        </div>
      ) : history.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          No alerts have been triggered yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {history.map((entry, i) => (
            <div key={i} className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderLeft: '3px solid #ef4444' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: '#fef2f2', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ShieldAlert size={16} color="#ef4444" /> {entry.senderName || 'Unknown User'}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Clock size={13} /> {entry.triggeredAt ? new Date(entry.triggeredAt).toLocaleString() : '—'}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <User size={13} /> User ID: <code style={{ background: 'rgba(255,255,255,0.08)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.78rem' }}>{entry.senderId || '—'}</code>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Wifi size={13} /> IP: {entry.senderIp || '—'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
