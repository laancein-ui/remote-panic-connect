import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      localStorage.setItem('token', data.session.access_token);
      localStorage.setItem('user', JSON.stringify({ id: data.user.id, email: data.user.email, name: data.user.user_metadata?.name || data.user.email }));
      navigate('/modes');
    }
    setLoading(false);
  };

  return (
    <div className="glass-panel form-container" style={{ alignSelf: 'center' }}>
      <h2 className="form-title">Welcome Back</h2>
      {error && <p style={{ color: '#ef4444', textAlign: 'center' }}>{error}</p>}
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="input-group">
          <label>Email Address</label>
          <input 
            type="email" 
            className="input-field" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
            placeholder="user@gmail.com"
          />
        </div>
        <div className="input-group">
          <label>Password</label>
          <input 
            type="password" 
            className="input-field" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
      <p style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--text-muted)' }}>
        Don't have an account? <Link to="/register" style={{ color: 'var(--primary-color)' }}>Sign up</Link>
      </p>
    </div>
  );
}
