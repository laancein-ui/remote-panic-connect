import { useNavigate } from 'react-router-dom';
import { Monitor, Apple, ArrowLeft, Download } from 'lucide-react';

const MAC_DOWNLOAD_URL = 'https://github.com/laancein-ui/remote-panic-connect/releases/download/v1.0.0/Panic.Connect-1.0.0-arm64.dmg';
const WIN_DOWNLOAD_URL = 'https://github.com/laancein-ui/remote-panic-connect/releases/download/v1.0.0/Panic.Connect.Setup.1.0.0.exe';

export default function Downloads() {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', gap: '2rem' }}>
      <button 
        className="btn btn-secondary" 
        style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        onClick={() => navigate('/modes')}
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Download Desktop App</h1>
        <p style={{ color: 'var(--text-muted)' }}>Get the full native experience on your computer</p>
      </div>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>

        {/* Mac Download */}
        <div className="glass-panel mode-card" style={{ width: '300px', cursor: 'default' }}>
          <Apple size={48} color="var(--primary-color)" style={{ marginBottom: '1rem' }} />
          <h3>MacBook (.dmg)</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Apple Silicon supported. Includes global background alerts and keyboard shortcut.
          </p>
          <a 
            href={MAC_DOWNLOAD_URL}
            className="btn btn-primary" 
            style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}
          >
            <Download size={18} /> Download for Mac
          </a>
        </div>

        {/* Windows Download */}
        <div className="glass-panel mode-card" style={{ width: '300px', cursor: 'default' }}>
          <Monitor size={48} color="var(--accent-color)" style={{ marginBottom: '1rem' }} />
          <h3>Windows (.exe)</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Windows 10 & 11 supported. Includes global background alerts and keyboard shortcut.
          </p>
          {WIN_DOWNLOAD_URL ? (
            <a 
              href={WIN_DOWNLOAD_URL}
              className="btn btn-primary" 
              style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}
            >
              <Download size={18} /> Download for Windows
            </a>
          ) : (
            <button className="btn btn-secondary" disabled style={{ width: '100%', opacity: 0.5, cursor: 'not-allowed' }}>
              Coming Soon
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
