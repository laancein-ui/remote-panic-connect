import { useState, useEffect, useRef } from 'react';
import { Send, ArrowLeft, Wifi, User, Circle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';

export default function LocalChat() {
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]); // Messages for the current selected user
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('Connecting to Local Network...');
  const messagesEndRef = useRef(null);
  
  const storedUser = localStorage.getItem('user');
  const currentUser = storedUser ? JSON.parse(storedUser) : { id: 'anon', name: 'Anonymous' };

  useEffect(() => {
    // Connect to the local server running on port 5002 or the deployed Render backend
    // We use window.location.hostname to dynamically target the local IP if VITE_API_URL is not set
    let serverUrl = import.meta.env.VITE_API_URL;
    if (!serverUrl) {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        serverUrl = `http://${window.location.hostname}:5002`;
      } else {
        serverUrl = 'https://panic-chat-backend.onrender.com';
      }
    }
    const newSocket = io(serverUrl);
    
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setStatus('Connected (Local Secure Network)');
      if (currentUser && currentUser.id) {
        newSocket.emit('login', { id: currentUser.id, name: currentUser.name });
      }
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setStatus('Connecting to Local Network...');
    });

    newSocket.on('disconnect', () => {
      setStatus('Disconnected from Local Network');
    });

    newSocket.on('users_update', (updatedUsers) => {
      // Exclude self from the contacts list
      setUsers(updatedUsers.filter(u => u.id !== currentUser.id));
    });

    newSocket.on('receive_message', (msgObj) => {
      // When a message is received, if it belongs to the current chat, add it
      setSelectedUser(currentSelected => {
        if (currentSelected && (msgObj.sender_id === currentSelected.id || msgObj.target_id === currentSelected.id)) {
          setMessages(prev => [...prev, msgObj]);
        }
        return currentSelected;
      });
    });

    newSocket.on('chat_history', ({ targetId, history }) => {
      setSelectedUser(currentSelected => {
        if (currentSelected && currentSelected.id === targetId) {
          setMessages(history);
        }
        return currentSelected;
      });
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectUser = (user) => {
    setSelectedUser(user);
    setMessages([]); // Clear until history loads
    if (socket) {
      socket.emit('get_history', user.id);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !selectedUser || !socket) return;

    const msgData = {
      sender_id: currentUser.id,
      target_id: selectedUser.id,
      content: input,
      timestamp: new Date().toISOString()
    };
    
    socket.emit('send_message', msgData);
    setInput('');
  };

  return (
    <div className="chat-layout" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="chat-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="icon-btn" onClick={() => navigate('/modes')}><ArrowLeft size={20} /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Wifi size={24} color="var(--accent-color)" />
            <h3>Local Secure Chat</h3>
          </div>
        </div>
        <div style={{ fontSize: '0.875rem', color: status.includes('Connected') ? 'var(--accent-color)' : 'var(--text-muted)' }}>
          {status}
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div className="sidebar" style={{ width: '300px', borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', fontWeight: '600', color: 'var(--text-primary)' }}>
            Contacts ({users.length})
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {users.length === 0 ? (
              <p style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.875rem' }}>No other users on network</p>
            ) : (
              users.map(user => (
                <div 
                  key={user.id}
                  onClick={() => selectUser(user)}
                  style={{
                    padding: '1rem',
                    borderBottom: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    backgroundColor: selectedUser?.id === user.id ? 'var(--bg-body)' : 'transparent',
                    transition: 'background-color 0.2s ease'
                  }}
                >
                  <div style={{ position: 'relative' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                      <User size={20} />
                    </div>
                    <div style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: 'var(--bg-card)', borderRadius: '50%', padding: '2px' }}>
                      <Circle size={12} fill={user.isOnline ? '#10b981' : '#9ca3af'} color={user.isOnline ? '#10b981' : '#9ca3af'} />
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{user.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.isOnline ? 'Online' : 'Offline'}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-body)' }}>
          {!selectedUser ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexDirection: 'column', gap: '1rem' }}>
              <Wifi size={48} opacity={0.2} />
              <p>Select a contact from the local network to start chatting.</p>
              <p style={{ fontSize: '0.75rem', maxWidth: '300px', textAlign: 'center' }}>Messages stay entirely on your local IP network and are queued if the user is offline.</p>
            </div>
          ) : (
            <>
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{selectedUser.name}</span>
                <Circle size={10} fill={selectedUser.isOnline ? '#10b981' : '#9ca3af'} color={selectedUser.isOnline ? '#10b981' : '#9ca3af'} />
              </div>
              
              <div className="message-list" style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem', fontSize: '0.875rem' }}>No messages yet. Say hello!</div>
                ) : (
                  messages.map((msg, i) => (
                    <div key={i} className={`message ${msg.sender_id === currentUser.id ? 'sent' : 'received'}`}>
                      {msg.content}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              
              <form className="chat-input-area" onSubmit={sendMessage} style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
                <input 
                  type="text" 
                  value={input} 
                  onChange={(e) => setInput(e.target.value)} 
                  placeholder={`Message ${selectedUser.name}...`} 
                  disabled={!status.includes('Connected')}
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-primary)' }}
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} disabled={!status.includes('Connected') || !input.trim()}>
                  <Send size={20} />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
