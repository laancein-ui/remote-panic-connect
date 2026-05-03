import { useState, useEffect } from 'react';
import { ArrowLeft, Share2, Download, Upload, File, Shield, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { supabase } from '../supabase';

export default function WiFiShare() {
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [sharedFiles, setSharedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  const storedUser = localStorage.getItem('user');
  const currentUser = storedUser ? JSON.parse(storedUser) : { id: 'anon', name: 'Anonymous' };

  useEffect(() => {
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
      newSocket.emit('login', { id: currentUser.id, name: currentUser.name });
      newSocket.emit('get_shared_files');
    });

    newSocket.on('shared_files_update', (files) => {
      setSharedFiles(files);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleFileShare = async (e) => {
    const file = e.target.files[0];
    if (!file || !socket) return;
    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const fileSize = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
      
      const { data, error } = await supabase.storage.from('chat_files').upload(fileName, file);

      if (!error) {
        const { data: publicUrlData } = supabase.storage.from('chat_files').getPublicUrl(fileName);
        const fileData = {
          file_name: file.name,
          file_url: publicUrlData.publicUrl,
          size: fileSize,
          sender_name: currentUser.name
        };
        socket.emit('share_file', fileData);
        setSuccessMsg(`"${file.name}" successfully shared with network!`);
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        // Base64 direct network broadcast fallback
        const reader = new FileReader();
        reader.onloadend = () => {
          const fileData = {
            file_name: file.name,
            file_url: reader.result,
            size: fileSize,
            sender_name: currentUser.name
          };
          socket.emit('share_file', fileData);
          setSuccessMsg(`"${file.name}" successfully shared with network!`);
          setTimeout(() => setSuccessMsg(''), 4000);
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      console.error('WiFi File Sharing error:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="chat-layout" style={{ height: '100vh', display: 'flex', flexDirection: 'column', padding: '1rem', overflowY: 'auto' }}>
      
      {/* Header */}
      <div className="chat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="icon-btn" onClick={() => navigate('/modes')}><ArrowLeft size={20} /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Share2 size={24} color="#f59e0b" />
            <h3 style={{ margin: 0 }}>WiFi File Share</h3>
          </div>
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Xender / ShareMe Mode</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '800px', width: '100%', margin: '0 auto' }}>
        {/* Top: Upload/Share File Module */}
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', border: '2px dashed var(--border-color)', borderRadius: '16px' }}>
          <Upload size={48} color="#f59e0b" />
          <h4 style={{ margin: 0 }}>Share a file to anyone on this Wi-Fi Network</h4>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Files are instantly visible to devices connected to your same IP environment.</p>
          
          <input 
            type="file" 
            id="wifi-file-upload" 
            style={{ display: 'none' }} 
            onChange={handleFileShare} 
            disabled={uploading}
          />
          <label htmlFor="wifi-file-upload" className="btn btn-primary" style={{ cursor: 'pointer', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '8px' }}>
            {uploading ? 'Broadcasting...' : 'Select File to Broadcast'}
          </label>

          {successMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-color)', fontWeight: '600', marginTop: '0.5rem' }}>
              <CheckCircle size={18} />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Bottom: Shared Files Section */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px', flex: 1 }}>
          <h4 style={{ margin: 0, marginBottom: '1rem', color: 'var(--text-primary)' }}>Shared Network Files ({sharedFiles.length})</h4>
          
          {sharedFiles.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
              No files are shared on your network currently. Start by broadcasting a file above!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {sharedFiles.map(file => (
                <div 
                  key={file.id} 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-body)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '8px', backgroundColor: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <File size={22} />
                    </div>
                    <div>
                      <div style={{ fontWeight: '600', color: 'var(--text-primary)', maxWidth: '300px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {file.file_name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {file.size} • Shared by {file.sender_name}
                      </div>
                    </div>
                  </div>

                  <a 
                    href={file.file_url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    download={file.file_name}
                    className="btn btn-secondary" 
                    style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '8px', textDecoration: 'none' }}
                  >
                    <Download size={18} />
                    Download
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
