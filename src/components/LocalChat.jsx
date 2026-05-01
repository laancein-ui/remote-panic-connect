import { useState, useEffect, useRef } from 'react';
import { Send, ArrowLeft, Wifi, Paperclip } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

export default function LocalChat() {
  const [roomCode, setRoomCode] = useState(localStorage.getItem('savedRoomCode') || '');
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('Disconnected');
  
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const peerConnection = useRef(null);
  const dataChannel = useRef(null);
  const signalingChannel = useRef(null);
  
  const currentUser = JSON.parse(localStorage.getItem('user'));
  const peerId = currentUser.id;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const initWebRTC = (isInitiator, targetPeerId) => {
    // Only use host candidates to force LAN-only connection. No STUN/TURN servers.
    peerConnection.current = new RTCPeerConnection({
      iceServers: [] 
    });

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate && event.candidate.candidate.includes('typ host')) {
         signalingChannel.current.send({
           type: 'broadcast',
           event: 'webrtc_ice_candidate',
           payload: { target: targetPeerId, candidate: event.candidate, sender: peerId }
         });
      }
    };

    peerConnection.current.onconnectionstatechange = () => {
      setStatus(peerConnection.current.connectionState);
    };

    if (isInitiator) {
      dataChannel.current = peerConnection.current.createDataChannel('local-secure-chat');
      setupDataChannel();
      
      peerConnection.current.createOffer().then(offer => {
        return peerConnection.current.setLocalDescription(offer);
      }).then(() => {
        signalingChannel.current.send({
          type: 'broadcast',
          event: 'webrtc_offer',
          payload: { target: targetPeerId, sdp: peerConnection.current.localDescription, sender: peerId }
        });
      });
    } else {
      peerConnection.current.ondatachannel = (event) => {
        dataChannel.current = event.channel;
        setupDataChannel();
      };
    }
  };

  const setupDataChannel = () => {
    dataChannel.current.onopen = () => {
      setStatus('Connected (Secure LAN)');
    };
    dataChannel.current.onmessage = (event) => {
      if (typeof event.data === 'string') {
        const msg = JSON.parse(event.data);
        setMessages(prev => [...prev, msg]);
      } else {
        const blob = new Blob([event.data]);
        const url = URL.createObjectURL(blob);
        setMessages(prev => [...prev, {
          sender_id: 'peer',
          type: 'file',
          file_url: url,
          content: 'Received File',
          timestamp: new Date().toISOString()
        }]);
      }
    };
  };

  const joinRoom = (e) => {
    e.preventDefault();
    if (!roomCode.trim()) return;
    localStorage.setItem('savedRoomCode', roomCode.toUpperCase());
    setJoined(true);
    setStatus('Waiting for peer...');

    const channelName = `local_room_${roomCode.toUpperCase()}`;
    signalingChannel.current = supabase.channel(channelName, {
      config: { broadcast: { self: false } }
    });

    signalingChannel.current
      .on('broadcast', { event: 'peer_joined' }, ({ payload }) => {
        initWebRTC(true, payload.sender);
      })
      .on('broadcast', { event: 'webrtc_offer' }, async ({ payload }) => {
        if (payload.target === peerId) {
          initWebRTC(false, payload.sender);
          await peerConnection.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          const answer = await peerConnection.current.createAnswer();
          await peerConnection.current.setLocalDescription(answer);
          signalingChannel.current.send({
            type: 'broadcast',
            event: 'webrtc_answer',
            payload: { target: payload.sender, sdp: peerConnection.current.localDescription, sender: peerId }
          });
        }
      })
      .on('broadcast', { event: 'webrtc_answer' }, async ({ payload }) => {
        if (payload.target === peerId && peerConnection.current) {
          await peerConnection.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        }
      })
      .on('broadcast', { event: 'webrtc_ice_candidate' }, async ({ payload }) => {
        if (payload.target === peerId && peerConnection.current) {
          try {
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (e) {
            console.error('Error adding received ice candidate', e);
          }
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Announce presence
          signalingChannel.current.send({
            type: 'broadcast',
            event: 'peer_joined',
            payload: { sender: peerId }
          });
        }
      });
  };

  useEffect(() => {
    return () => {
      if (signalingChannel.current) supabase.removeChannel(signalingChannel.current);
      if (peerConnection.current) peerConnection.current.close();
    };
  }, []);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!dataChannel.current || dataChannel.current.readyState !== 'open') return;

    if (file) {
      const buffer = await file.arrayBuffer();
      dataChannel.current.send(buffer);
      setMessages(prev => [...prev, {
        sender_id: currentUser.id,
        type: 'file',
        file_url: URL.createObjectURL(file),
        content: `Sent File: ${file.name}`,
        timestamp: new Date().toISOString()
      }]);
      setFile(null);
    }

    if (input.trim()) {
      const msgData = {
        sender_name: currentUser.name,
        sender_id: currentUser.id,
        content: input,
        type: 'text',
        timestamp: new Date().toISOString()
      };
      dataChannel.current.send(JSON.stringify(msgData));
      setMessages(prev => [...prev, msgData]);
      setInput('');
    }
  };

  return (
    <div className="chat-layout" style={{ flexDirection: 'column' }}>
      <div className="chat-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="icon-btn" onClick={() => navigate('/modes')}><ArrowLeft size={20} /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Wifi size={24} color="var(--accent-color)" />
            <h3>Local Secure Chat</h3>
          </div>
        </div>
        <div style={{ fontSize: '0.875rem', color: status.includes('Connected') ? 'var(--accent-color)' : 'var(--text-muted)' }}>
          Status: {status}
        </div>
      </div>

      {!joined ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel form-container">
            <h2 className="form-title" style={{ fontSize: '1.5rem' }}>Join Local Network</h2>
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Enter a shared room code with someone on the same Wi-Fi. Traffic will not leave your local network.
            </p>
            <form onSubmit={joinRoom} className="input-group">
              <input 
                type="text" 
                className="input-field" 
                placeholder="e.g. HOME_WIFI_99" 
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                required
              />
              <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Connect</button>
            </form>
          </div>
        </div>
      ) : (
        <>
          <div className="message-list" style={{ flex: 1 }}>
            {messages.map((msg, i) => (
              <div key={i} className={`message ${msg.sender_id === currentUser.id ? 'sent' : 'received'}`}>
                {msg.sender_id !== currentUser.id && msg.sender_name && (
                  <div style={{ fontSize: '0.75rem', marginBottom: '0.25rem', opacity: 0.8 }}>
                    {msg.sender_name}
                  </div>
                )}
                {msg.type === 'file' ? (
                  <div>
                    <a href={msg.file_url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>{msg.content}</a>
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
              id="local-file-upload" 
              style={{ display: 'none' }} 
              onChange={(e) => setFile(e.target.files[0])} 
            />
            <label htmlFor="local-file-upload" className="icon-btn" style={{ cursor: 'pointer', color: file ? 'var(--primary-color)' : 'var(--text-muted)' }}>
              <Paperclip size={24} />
            </label>
            <input 
              type="text" 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              placeholder={status.includes('Connected') ? "Type a secure local message..." : "Waiting for connection..."} 
              disabled={!status.includes('Connected')}
            />
            <button type="submit" className="icon-btn" style={{ color: 'var(--accent-color)' }} disabled={!status.includes('Connected') && !file && !input.trim()}>
              <Send size={24} />
            </button>
          </form>
        </>
      )}
    </div>
  );
}
