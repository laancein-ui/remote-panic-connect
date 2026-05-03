import { useState, useEffect, useRef } from 'react';
import { Send, ArrowLeft, Wifi, User, Circle, Bell, Shield, Paperclip, Edit3, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { supabase } from '../supabase';

export default function LocalChat() {
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]); // Messages for current selected user
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('Connecting to Local Network...');
  const [notification, setNotification] = useState(null);
  const [currentIp, setCurrentIp] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editTargetId, setEditTargetId] = useState(localStorage.getItem('linked_target_id') || '');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const currentIpRef = useRef('');
  
  const storedUser = localStorage.getItem('user');
  const [currentUser, setCurrentUser] = useState(storedUser ? JSON.parse(storedUser) : { id: 'anon', name: 'Anonymous', avatarUrl: '' });

  // Load cached messages for the partner matching the exact network IP context
  const loadCachedMessages = (partnerId) => {
    try {
      const activeIp = currentIpRef.current || 'default';
      const cacheKey = `local_chat_history_${currentUser.id}_${partnerId}_${activeIp}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.error('Error loading cached messages:', e);
    }
    return [];
  };

  // Save messages to local cache matching the exact network IP context
  const saveCachedMessages = (partnerId, msgs) => {
    try {
      const activeIp = currentIpRef.current || 'default';
      const cacheKey = `local_chat_history_${currentUser.id}_${partnerId}_${activeIp}`;
      localStorage.setItem(cacheKey, JSON.stringify(msgs));
    } catch (e) {
      console.error('Error saving cached messages:', e);
    }
  };

  useEffect(() => {
    setEditName(currentUser.name || '');
    setEditAvatar(currentUser.avatarUrl || '');

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

    // Online/Offline listener for browser events
    const handleBrowserOnline = () => {
      setStatus('Online Status Restored');
      newSocket.connect();
    };

    const handleBrowserOffline = () => {
      setStatus('Offline (No Internet/Network Connection)');
    };

    window.addEventListener('online', handleBrowserOnline);
    window.addEventListener('offline', handleBrowserOffline);

    newSocket.on('connect', () => {
      setStatus('Connected (Local Secure Network)');
      if (currentUser && currentUser.id) {
        newSocket.emit('login', { id: currentUser.id, name: currentUser.name, avatarUrl: currentUser.avatarUrl });
      }
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setStatus('Connecting to Local Network...');
    });

    newSocket.on('disconnect', () => {
      setStatus('Disconnected from Local Network');
    });

    newSocket.on('login_success', ({ ip }) => {
      currentIpRef.current = ip;
      setCurrentIp(ip);
    });

    newSocket.on('users_update', (updatedUsers) => {
      setUsers(updatedUsers.filter(u => u.id !== currentUser.id));
    });

    newSocket.on('reconnect_offline_sync', ({ messages }) => {
      if (messages && messages.length > 0) {
        setNotification('You received messages while you were offline.');
        setTimeout(() => setNotification(null), 8000);
      }
    });

    newSocket.on('receive_message', (msgObj) => {
      setSelectedUser(currentSelected => {
        const partnerId = msgObj.sender_id === currentUser.id ? msgObj.target_id : msgObj.sender_id;
        const activeChatId = (partnerId === 'all_users' || msgObj.target_id === 'all_users') ? 'all_users' : partnerId;
        
        // Update local cache regardless of who we're currently chatting with
        const cached = loadCachedMessages(activeChatId);
        if (!cached.some(m => m.id === msgObj.id)) {
          const updated = [...cached, msgObj];
          saveCachedMessages(activeChatId, updated);
          
          if (currentSelected && (currentSelected.id === activeChatId || (activeChatId === 'all_users' && currentSelected.id === 'all_users'))) {
            setMessages(updated);
          }
        }
        return currentSelected;
      });
    });

    newSocket.on('chat_history', ({ targetId, history }) => {
      setSelectedUser(currentSelected => {
        if (currentSelected && currentSelected.id === targetId) {
          setMessages(history);
          saveCachedMessages(targetId, history);
        }
        return currentSelected;
      });
    });

    return () => {
      newSocket.disconnect();
      window.removeEventListener('online', handleBrowserOnline);
      window.removeEventListener('offline', handleBrowserOffline);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectUser = (user) => {
    setSelectedUser(user);
    // Load local cached history instantly for premium UX
    const cached = loadCachedMessages(user.id);
    setMessages(cached);
    if (socket) {
      socket.emit('get_history', user.id);
    }
  };

  const handleProfileSave = (e) => {
    e.preventDefault();
    const updated = { ...currentUser, name: editName, avatarUrl: editAvatar };
    setCurrentUser(updated);
    localStorage.setItem('user', JSON.stringify(updated));
    localStorage.setItem('linked_target_id', editTargetId);
    if (socket) {
      socket.emit('update_profile', { name: editName, avatarUrl: editAvatar });
    }
    setIsEditingProfile(false);
  };

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setUploading(true);

    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const { data, error } = await supabase.storage.from('chat_files').upload(fileName, selectedFile);
      
      if (!error) {
        const { data: publicUrlData } = supabase.storage.from('chat_files').getPublicUrl(fileName);
        const msgData = {
          sender_id: currentUser.id,
          target_id: selectedUser.id,
          content: `Sent a file: ${selectedFile.name}`,
          file_url: publicUrlData.publicUrl,
          file_name: selectedFile.name,
          type: 'file',
          timestamp: new Date().toISOString()
        };
        socket.emit('send_message', msgData);
      } else {
        // Fallback to base64 for direct offline network sending
        const reader = new FileReader();
        reader.onloadend = () => {
          const msgData = {
            sender_id: currentUser.id,
            target_id: selectedUser.id,
            content: `Sent a file: ${selectedFile.name}`,
            file_url: reader.result,
            file_name: selectedFile.name,
            type: 'file',
            timestamp: new Date().toISOString()
          };
          socket.emit('send_message', msgData);
        };
        reader.readAsDataURL(selectedFile);
      }
    } catch (err) {
      console.error('File upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !selectedUser || !socket) return;

    const msgData = {
      sender_id: currentUser.id,
      target_id: selectedUser.id,
      content: input,
      type: 'text',
      timestamp: new Date().toISOString()
    };
    
    socket.emit('send_message', msgData);
    setInput('');
  };

  return (
    <div className="chat-layout" style={{ height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      
      {/* Smart Notification Banner */}
      {notification && (
        <div style={{
          position: 'absolute',
          top: '80px',
          right: '20px',
          backgroundColor: 'var(--accent-color, #10b981)',
          color: '#ffffff',
          padding: '1rem 1.5rem',
          borderRadius: '12px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          zIndex: 1000,
          animation: 'slideIn 0.3s ease-out'
        }}>
          <Bell size={24} />
          <div>
            <div style={{ fontWeight: '700' }}>Smart Notification</div>
            <div style={{ fontSize: '0.85rem' }}>{notification}</div>
          </div>
          <button style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', marginLeft: 'auto', fontSize: '1.25rem', fontWeight: '700' }} onClick={() => setNotification(null)}>×</button>
        </div>
      )}

      <div className="chat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="icon-btn" onClick={() => navigate('/modes')}><ArrowLeft size={20} /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={24} color="var(--accent-color)" />
            <h3 style={{ margin: 0 }}>Local Secure Chat</h3>
          </div>
        </div>
        <div style={{ fontSize: '0.875rem', color: status.includes('Connected') || status.includes('Restored') ? 'var(--accent-color)' : 'var(--text-muted)' }}>
          {status}
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div className="sidebar" style={{ width: '320px', borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', display: 'flex', flexDirection: 'column' }}>
          
          {/* User Profile / Edit Block */}
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ position: 'relative' }}>
                {currentUser.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt="Avatar" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                    <User size={24} />
                  </div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '700', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{currentUser.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{currentUser.email || 'Local user'}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--accent-color)', fontWeight: 'bold', marginTop: '2px' }}>ID: {currentUser.id}</div>
              </div>
              <button onClick={() => setIsEditingProfile(!isEditingProfile)} style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer' }} title="Edit Profile">
                <Edit3 size={18} />
              </button>
            </div>

            {isEditingProfile && (
              <form onSubmit={handleProfileSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
                <input 
                  type="text" 
                  className="input-field" 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)} 
                  placeholder="Your username" 
                  required 
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                />
                <input 
                  type="text" 
                  className="input-field" 
                  value={editAvatar} 
                  onChange={(e) => setEditAvatar(e.target.value)} 
                  placeholder="Avatar URL" 
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                />
                <input 
                  type="text" 
                  className="input-field" 
                  value={editTargetId} 
                  onChange={(e) => setEditTargetId(e.target.value)} 
                  placeholder="Linked Target User ID" 
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '0.4rem', fontSize: '0.8rem' }}>Save Details</button>
              </form>
            )}
          </div>

          <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border-color)', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
            <span>Network Spaces</span>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto' }}>
            
            {/* NEW: Global Network Chat Tab for all users on this network */}
            <div 
              onClick={() => selectUser({ id: 'all_users', name: 'Global Network Chat', isOnline: true })}
              style={{
                padding: '1rem',
                borderBottom: '2px solid var(--border-color)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                backgroundColor: selectedUser?.id === 'all_users' ? 'var(--bg-body)' : 'transparent',
                transition: 'background-color 0.2s ease'
              }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                <MessageSquare size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>Global Network Chat</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Chat with everyone on this network</div>
              </div>
            </div>

            <p style={{ padding: '0.75rem 1.25rem 0.25rem 1.25rem', fontWeight: '600', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', margin: 0 }}>Private Contacts ({users.length})</p>

            {users.length === 0 ? (
              <p style={{ padding: '1.25rem', color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.875rem' }}>No other users on matching IP network</p>
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
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                        <User size={20} />
                      </div>
                    )}
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
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexDirection: 'column', gap: '1.25rem' }}>
              <Wifi size={56} opacity={0.2} />
              <p>Select a contact or join the Global Network Chat to start messaging.</p>
              <p style={{ fontSize: '0.75rem', maxWidth: '350px', textAlign: 'center' }}>
                Chat memory is securely isolated. Re-connecting with another network hides previous chats automatically.
              </p>
            </div>
          ) : (
            <>
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {selectedUser.avatarUrl ? (
                  <img src={selectedUser.avatarUrl} alt={selectedUser.name} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                    <User size={16} />
                  </div>
                )}
                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{selectedUser.name}</span>
                <Circle size={10} fill={selectedUser.isOnline ? '#10b981' : '#9ca3af'} color={selectedUser.isOnline ? '#10b981' : '#9ca3af'} />
                {selectedUser.ip && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>Client IP: {selectedUser.ip}</span>}
              </div>
              
              <div className="message-list" style={{ flex: 1, padding: '1.25rem', overflowY: 'auto' }}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2.5rem', fontSize: '0.875rem' }}>No messages yet. Send a text or a file!</div>
                ) : (
                  messages.map((msg, i) => (
                    <div key={i} className={`message ${msg.sender_id === currentUser.id ? 'sent' : 'received'}`}>
                      {msg.type === 'file' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          {msg.file_url && (msg.file_url.startsWith('data:image/') || msg.file_url.match(/\.(jpeg|jpg|gif|png)$/i)) ? (
                            <img src={msg.file_url} alt="Attachment" style={{ maxWidth: '220px', borderRadius: '8px', marginTop: '0.25rem' }} />
                          ) : msg.file_url ? (
                            <a href={msg.file_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', color: 'inherit', fontWeight: 'bold' }}>
                              📎 Download Attachment ({msg.file_name || 'View file'})
                            </a>
                          ) : (
                            <span style={{ fontStyle: 'italic' }}>Attachment link unavailable</span>
                          )}
                          {msg.content && <p style={{ margin: 0 }}>{msg.content}</p>}
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              
              <form className="chat-input-area" onSubmit={sendMessage} style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <input 
                  type="file" 
                  id="chat-file-upload" 
                  style={{ display: 'none' }} 
                  onChange={handleFileUpload} 
                />
                <label htmlFor="chat-file-upload" className="icon-btn" style={{ cursor: 'pointer', color: uploading ? 'var(--accent-color)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Upload File">
                  <Paperclip size={22} />
                </label>
                <input 
                  type="text" 
                  value={input} 
                  onChange={(e) => setInput(e.target.value)} 
                  placeholder={uploading ? `Uploading file attachment...` : `Message ${selectedUser.name}...`} 
                  disabled={uploading || (!status.includes('Connected') && !status.includes('Restored'))}
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-primary)' }}
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} disabled={uploading || (!status.includes('Connected') && !status.includes('Restored')) || !input.trim()}>
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
