import { useEffect } from 'react';

export default function AlertBanner({ alert, onClose }) {
  // Auto-dismiss after 10 seconds
  useEffect(() => {
    if (!alert) return;
    const timer = setTimeout(onClose, 10000);
    return () => clearTimeout(timer);
  }, [alert, onClose]);

  if (!alert) return null;

  const time = alert.triggeredAt ? new Date(alert.triggeredAt).toLocaleTimeString() : new Date().toLocaleTimeString();

  return (
    <div style={{
      position: 'fixed',
      top: '1.5rem',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      width: 'min(480px, 92vw)',
      background: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)',
      border: '1.5px solid #f87171',
      borderRadius: '1rem',
      padding: '1.25rem 1.5rem',
      boxShadow: '0 8px 32px rgba(239,68,68,0.5)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      animation: 'alertSlideIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
    }}>
      <style>{`
        @keyframes alertSlideIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-24px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🚨</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#fef2f2', letterSpacing: '0.01em' }}>
              EMERGENCY ALERT
            </div>
            <div style={{ fontSize: '0.8rem', color: '#fca5a5', marginTop: '0.15rem' }}>
              Triggered at {time}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: '#fca5a5', fontSize: '1.25rem', cursor: 'pointer', lineHeight: 1, padding: '0 0.25rem' }}
          aria-label="Dismiss"
        >✕</button>
      </div>

      <div style={{ borderTop: '1px solid rgba(248,113,113,0.3)', paddingTop: '0.6rem', fontSize: '0.9rem', color: '#fef2f2' }}>
        <strong>{alert.name}</strong> activated a panic alert
        {alert.ip && <span style={{ color: '#fca5a5', fontSize: '0.8rem' }}> · IP: {alert.ip}</span>}
      </div>
    </div>
  );
}
