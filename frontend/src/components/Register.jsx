import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name }
      }
    });

    if (error) {
      setError(error.message);
    } else {
      // Supabase auto-logins on signup if email confirmation is disabled
      if (data.session) {
        localStorage.setItem('token', data.session.access_token);
        localStorage.setItem('user', JSON.stringify({ id: data.user.id, email: data.user.email, name: data.user.user_metadata?.name }));
        
        // Also insert into a public users table so they show up in the chat list
        await supabase.from('users').insert([{ id: data.user.id, email, name }]);
        
        navigate('/modes');
      } else {
        setError('Account created! Please check your email to verify.');
      }
    }
    setLoading(false);
  };

  return (
    <div className="glass-panel form-container" style={{ alignSelf: 'center' }}>
      <h2 className="form-title">Create Account</h2>
      {error && <p style={{ color: '#ef4444', textAlign: 'center' }}>{error}</p>}
      <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="input-group">
          <label>Full Name</label>
          <input 
            type="text" 
            className="input-field" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            required 
          />
        </div>
        <div className="input-group">
          <label>Email Address</label>
          <input 
            type="email" 
            className="input-field" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required
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
          {loading ? 'Signing up...' : 'Sign Up'}
        </button>
      </form>
      <p style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--text-muted)' }}>
        Already have an account? <Link to="/" style={{ color: 'var(--primary-color)' }}>Login</Link>
      </p>
    </div>
  );
}
