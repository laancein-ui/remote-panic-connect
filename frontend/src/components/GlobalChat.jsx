import { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

export default function GlobalChat() {
  const [users, setUsers] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  const currentUser = JSON.parse(localStorage.getItem('user'));
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Fetch users
    const fetchUsers = async () => {
      const { data } = await supabase.from('users').select('*').neq('id', currentUser.id);
      if (data) setUsers(data);
    };
    fetchUsers();

    // Subscribe to new messages using Supabase Realtime
    const messageSubscription = supabase
      .channel('messages_channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const newMessage = payload.new;
        if (
          (newMessage.sender_id === currentUser.id && newMessage.receiver_id === activeUser?.id) ||
          (newMessage.sender_id === activeUser?.id && newMessage.receiver_id === currentUser.id)
        ) {
          setMessages((prev) => [...prev, newMessage]);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messageSubscription);
    };
  }, [currentUser.id, activeUser]);

  useEffect(() => {
    if (activeUser) {
      const fetchMessages = async () => {
        const { data } = await supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeUser.id}),and(sender_id.eq.${activeUser.id},receiver_id.eq.${currentUser.id})`)
          .order('created_at', { ascending: true });
        
        if (data) setMessages(data);
      };
      fetchMessages();
    }
  }, [activeUser, currentUser.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() && !file) return;

    let fileUrl = null;
    let type = 'text';

    if (file) {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const { data, error } = await supabase.storage.from('chat_files').upload(fileName, file);
      
      if (!error) {
        const { data: publicUrlData } = supabase.storage.from('chat_files').getPublicUrl(fileName);
        fileUrl = publicUrlData.publicUrl;
        type = 'file';
      }
      setUploading(false);
    }

    const msgData = {
      sender_id: currentUser.id,
      receiver_id: activeUser.id,
      content: input,
      type: type,
      file_url: fileUrl
    };

    // Optimistic UI update
    setMessages(prev => [...prev, { ...msgData, created_at: new Date().toISOString() }]);
    setInput('');
    setFile(null);

    // Save to Supabase
    await supabase.from('messages').insert([msgData]);
  };

  return (
    <div className="chat-layout">
      <div className="sidebar">
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="icon-btn" onClick={() => navigate('/modes')}><ArrowLeft size={20} /></button>
          <h3>Global Chat</h3>
        </div>
        <div className="user-list">
          {users.map(u => (
            <div 
              key={u.id} 
              className={`user-item ${activeUser?.id === u.id ? 'active' : ''}`}
              onClick={() => setActiveUser(u)}
            >
              <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {u.name ? u.name[0].toUpperCase() : '?'}
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>{u.name || 'Anonymous'}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{u.email}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="chat-area">
        {activeUser ? (
          <>
            <div className="chat-header">
              <h3>{activeUser.name || activeUser.email}</h3>
            </div>
            <div className="message-list">
              {messages.map((msg, i) => (
                <div key={i} className={`message ${msg.sender_id === currentUser.id ? 'sent' : 'received'}`}>
                  {msg.type === 'file' ? (
                    <div>
                      <a href={msg.file_url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>View Attachment</a>
                      {msg.content && <p style={{ marginTop: '0.5rem' }}>{msg.content}</p>}
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form className="chat-input-area" onSubmit={sendMessage}>
              <input 
                type="file" 
                id="file-upload" 
                style={{ display: 'none' }} 
                onChange={(e) => setFile(e.target.files[0])} 
              />
              <label htmlFor="file-upload" className="icon-btn" style={{ cursor: 'pointer', color: file ? 'var(--primary-color)' : 'var(--text-muted)' }}>
                <Paperclip size={24} />
              </label>
              <input 
                type="text" 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                placeholder={uploading ? "Uploading file..." : "Type a message..."} 
                disabled={uploading}
              />
              <button type="submit" className="icon-btn" style={{ color: 'var(--primary-color)' }} disabled={uploading}>
                <Send size={24} />
              </button>
            </form>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            Select a user to start chatting
          </div>
        )}
      </div>
    </div>
  );
}
