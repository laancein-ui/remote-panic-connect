import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we have a session, if not we shouldn't be here
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // In case the session takes a moment to establish from the URL hash, wait a bit
        setTimeout(async () => {
          const { data: { session: delayedSession } } = await supabase.auth.getSession();
          if (!delayedSession) {
            setError('No valid session found. The recovery link may be expired.');
          }
        }, 1000);
      }
    };
    checkSession();
  }, []);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMsg('');

    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      setError(error.message);
    } else {
      setMsg('Password updated successfully! Redirecting...');
      setTimeout(() => {
        navigate('/modes');
      }, 2000);
    }
    setLoading(false);
  };

  return (
    <div className="glass-panel form-container" style={{ alignSelf: 'center' }}>
      <h2 className="form-title">Update Password</h2>
      {error && <p style={{ color: '#ef4444', textAlign: 'center' }}>{error}</p>}
      {msg && <p style={{ color: '#10b981', textAlign: 'center' }}>{msg}</p>}
      <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="input-group">
          <label>New Password</label>
          <input 
            type="password" 
            className="input-field" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
}
