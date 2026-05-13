import { useNavigate } from 'react-router-dom';
import { Globe, Wifi, DownloadCloud, ShieldAlert } from 'lucide-react';

export default function ChatModeSelect() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', gap: '2rem', position: 'relative' }}>
      
      {/* Alert History — only visible to laancein@gmail.com */}
      {user?.email === 'laancein@gmail.com' && (
        <button
          onClick={() => navigate('/alert-history')}
          style={{ position: 'absolute', top: '1rem', left: '1rem', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', borderRadius: '0.5rem', padding: '0.5rem 0.75rem' }}
          title="View Alert History"
        >
          <ShieldAlert size={22} />
          <span style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>Alerts</span>
        </button>
      )}

      {/* Download icon */}
      <button 
        onClick={() => navigate('/downloads')}
        style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}
        title="Download Desktop Apps"
      >
        <DownloadCloud size={24} />
        <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Get App</span>
      </button>

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
