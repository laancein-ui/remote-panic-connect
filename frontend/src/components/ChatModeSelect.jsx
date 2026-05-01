import { useNavigate } from 'react-router-dom';
import { Globe, Wifi } from 'lucide-react';

export default function ChatModeSelect() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', gap: '2rem' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Welcome, {user?.name}</h1>
        <p style={{ color: 'var(--text-muted)' }}>Choose a secure messaging mode</p>
      </div>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <div className="glass-panel mode-card" onClick={() => navigate('/global')} style={{ width: '300px' }}>
          <Globe size={48} color="var(--primary-color)" style={{ marginBottom: '1rem' }} />
          <h3>Global Internet Chat</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.875rem' }}>
            Chat with anyone globally. Messages are stored securely in the cloud.
          </p>
        </div>

        <div className="glass-panel mode-card" onClick={() => navigate('/local')} style={{ width: '300px' }}>
          <Wifi size={48} color="var(--accent-color)" style={{ marginBottom: '1rem' }} />
          <h3>Local Secure Chat</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.875rem' }}>
            Offline LAN-only chat. Extremely secure, peer-to-peer over your Wi-Fi network.
          </p>
        </div>
      </div>
      
      <button 
        className="btn btn-secondary" 
        onClick={() => { localStorage.removeItem('token'); navigate('/'); }}
      >
        Logout
      </button>
    </div>
  );
}
