const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Initialize Supabase Admin Client
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseServiceRole);

// Middleware to verify Supabase JWT token from frontend
const verifyAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });
    
    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
        return res.status(401).json({ error: 'Invalid token' });
    }
    
    req.user = user;
    next();
};

app.get('/api/health', (req, res) => {
    res.json({ status: 'Backend is running perfectly with Socket.io!' });
});

// File paths for persistence
const usersFilePath = path.join(__dirname, 'users_db.json');
const messagesFilePath = path.join(__dirname, 'messages_db.json');
const offlineFilePath = path.join(__dirname, 'offline_messages_db.json');

// Load persistent state
let storedUsers = {};
try {
    if (fs.existsSync(usersFilePath)) {
        storedUsers = JSON.parse(fs.readFileSync(usersFilePath, 'utf-8'));
    }
} catch (e) {
    console.error('Error loading stored users:', e);
}

let messagesDB = [];
try {
    if (fs.existsSync(messagesFilePath)) {
        messagesDB = JSON.parse(fs.readFileSync(messagesFilePath, 'utf-8'));
    }
} catch (e) {
    console.error('Error loading stored messages:', e);
}

let offlineMessagesObj = {};
try {
    if (fs.existsSync(offlineFilePath)) {
        offlineMessagesObj = JSON.parse(fs.readFileSync(offlineFilePath, 'utf-8'));
    }
} catch (e) {
    console.error('Error loading stored offline messages:', e);
}

const usersDB = new Map(Object.entries(storedUsers));
const offlineMessages = new Map(Object.entries(offlineMessagesObj));

// In-memory alert history (last 200 entries)
const alertHistory = [];

function saveData() {
    try {
        const usersObj = {};
        for (const [key, value] of usersDB.entries()) {
            usersObj[key] = { ...value, isOnline: false, socketId: null }; // Set offline by default on file save
        }
        fs.writeFileSync(usersFilePath, JSON.stringify(usersObj, null, 2), 'utf-8');
        fs.writeFileSync(messagesFilePath, JSON.stringify(messagesDB, null, 2), 'utf-8');
        
        const offlineObj = {};
        for (const [key, value] of offlineMessages.entries()) {
            offlineObj[key] = value;
        }
        fs.writeFileSync(offlineFilePath, JSON.stringify(offlineObj, null, 2), 'utf-8');
    } catch (e) {
        console.error('Error saving stored data to disk:', e);
    }
}

function broadcastUsersUpdate() {
    const sockets = io.sockets.sockets;
    for (const [id, socket] of sockets.entries()) {
        const userId = socket.userId;
        if (!userId) continue;
        
        const currentUser = usersDB.get(userId);
        if (!currentUser) continue;
        
        const clientIp = socket.handshake.address || socket.request.connection?.remoteAddress || '127.0.0.1';
        
        // Filter users to only those with the same network IP environment
        const filteredUsers = Array.from(usersDB.values()).filter(u => {
            return u.ip === clientIp && u.id !== userId;
        });
        
        socket.emit('users_update', filteredUsers);
    }
}

let sharedFilesDB = [];

io.on('connection', (socket) => {
    socket.on('share_file', (fileData) => {
        const clientIp = socket.handshake.address || socket.request.connection?.remoteAddress || '127.0.0.1';
        const fileObj = {
            id: Date.now().toString(),
            sender_id: socket.userId || 'anon',
            sender_name: fileData.sender_name || 'Anonymous',
            file_name: fileData.file_name,
            file_url: fileData.file_url,
            size: fileData.size || 'Unknown',
            timestamp: new Date().toISOString(),
            ip: clientIp
        };
        sharedFilesDB.push(fileObj);
        
        // Broadcast to everyone on same network IP
        const sockets = io.sockets.sockets;
        for (const [id, s] of sockets.entries()) {
            const sIp = s.handshake.address || s.request.connection?.remoteAddress || '127.0.0.1';
            if (sIp === clientIp) {
                s.emit('shared_files_update', sharedFilesDB.filter(f => f.ip === clientIp));
            }
        }
    });

    socket.on('get_shared_files', () => {
        const clientIp = socket.handshake.address || socket.request.connection?.remoteAddress || '127.0.0.1';
        const filtered = sharedFilesDB.filter(f => f.ip === clientIp);
        socket.emit('shared_files_update', filtered);
    });
    socket.on('login', (userData) => {
        if (!userData || !userData.id) return;
        
        const clientIp = socket.handshake.address || socket.request.connection?.remoteAddress || '127.0.0.1';
        const connectTime = new Date().toISOString();

        usersDB.set(userData.id, {
            id: userData.id,
            name: userData.name,
            isOnline: true,
            socketId: socket.id,
            ip: clientIp,
            connectTime: connectTime
        });
        
        // Map socket ID to user ID for disconnect handling
        socket.userId = userData.id;

        saveData();

        // Inform user of their login success and active IP context
        socket.emit('login_success', { ip: clientIp });

        // Broadcast updated user list within the same IP scope
        broadcastUsersUpdate();

        // Send offline messages if any from the same network IP context
        if (offlineMessages.has(userData.id)) {
            const msgs = offlineMessages.get(userData.id).filter(m => m.ip === clientIp);
            if (msgs.length > 0) {
                socket.emit('reconnect_offline_sync', { messages: msgs });
                msgs.forEach(msg => {
                    socket.emit('receive_message', msg);
                    messagesDB.push(msg);
                });
                offlineMessages.delete(userData.id);
                saveData();
            }
        }
    });

    socket.on('get_users', () => {
        const userId = socket.userId;
        if (!userId) return;
        const clientIp = socket.handshake.address || socket.request.connection?.remoteAddress || '127.0.0.1';
        const filteredUsers = Array.from(usersDB.values()).filter(u => u.ip === clientIp && u.id !== userId);
        socket.emit('users_update', filteredUsers);
    });
    
    socket.on('get_history', (targetId) => {
        const userId = socket.userId;
        if (!userId || !targetId) return;
        const clientIp = socket.handshake.address || socket.request.connection?.remoteAddress || '127.0.0.1';
        
        // Filter messages between userId and targetId or matching the group chat targetId
        const history = messagesDB.filter(m => {
            if (targetId === 'all_users') {
                return m.target_id === 'all_users' && m.ip === clientIp;
            }
            return ((m.sender_id === userId && m.target_id === targetId) ||
                   (m.sender_id === targetId && m.target_id === userId)) &&
                   m.ip === clientIp;
        });
        socket.emit('chat_history', { targetId, history });
    });

    socket.on('send_message', (message) => {
        const { sender_id, target_id, content, timestamp, type, file_url, file_name } = message;
        if (!sender_id || !target_id) return;
        const clientIp = socket.handshake.address || socket.request.connection?.remoteAddress || '127.0.0.1';

        const msgObj = { 
            id: Date.now().toString(), 
            sender_id, 
            target_id, 
            content, 
            timestamp, 
            type: type || 'text',
            file_url: file_url || null,
            file_name: file_name || null,
            ip: clientIp 
        };
        
        messagesDB.push(msgObj);
        saveData();
        
        // Check if target is 'all_users' to broadcast to the network
        if (target_id === 'all_users') {
            const sockets = io.sockets.sockets;
            for (const [id, s] of sockets.entries()) {
                const sIp = s.handshake.address || s.request.connection?.remoteAddress || '127.0.0.1';
                if (sIp === clientIp) {
                    s.emit('receive_message', msgObj);
                }
            }
            return;
        }

        // Send to sender to confirm
        socket.emit('receive_message', msgObj);

        // Check if target is online and matches the same IP environment
        const targetUser = usersDB.get(target_id);
        if (targetUser && targetUser.isOnline && targetUser.socketId && targetUser.ip === clientIp) {
            io.to(targetUser.socketId).emit('receive_message', msgObj);
        } else {
            // Store offline message linked to client IP
            const queued = offlineMessages.get(target_id) || [];
            queued.push(msgObj);
            offlineMessages.set(target_id, queued);
            saveData();
        }
    });

    socket.on('update_profile', (profileData) => {
        const userId = socket.userId;
        if (userId && usersDB.has(userId)) {
            const user = usersDB.get(userId);
            user.name = profileData.name || user.name;
            user.avatarUrl = profileData.avatarUrl || user.avatarUrl;
            usersDB.set(userId, user);
            
            saveData();
            broadcastUsersUpdate();
        }
    });

    socket.on('register_bg_session', ({ userId, isMobile, email }) => {
        socket.userId = userId;
        socket.email = email;
        socket.isMobile = !!isMobile;
        socket.join(`user_${userId}`);
        if (email === 'laancein@gmail.com') {
            socket.join(`email_laancein@gmail.com`);
        }
    });

    socket.on('panic_trigger_targeted_email', ({ senderName, senderId }) => {
        const clientIp = socket.handshake.address || socket.request.connection?.remoteAddress || '127.0.0.1';
        const triggeredAt = new Date().toISOString();

        // Log to alert history
        const entry = { senderName, senderId: senderId || socket.userId || 'unknown', senderIp: clientIp, triggeredAt };
        alertHistory.unshift(entry);
        if (alertHistory.length > 200) alertHistory.pop();

        const payload = { name: senderName, senderId: entry.senderId, ip: clientIp, triggeredAt };

        const sockets = io.sockets.sockets;
        for (const [id, s] of sockets.entries()) {
            if (s.email === 'laancein@gmail.com' || (s.user && s.user.email === 'laancein@gmail.com')) {
                s.emit('panic_alert', payload);
            }
        }

        io.to(`email_laancein@gmail.com`).emit('panic_alert', payload);
    });

    socket.on('get_alert_history', () => {
        // Only serve history to the laancein@gmail.com account
        if (socket.email === 'laancein@gmail.com') {
            socket.emit('alert_history', alertHistory);
        }
    });

    socket.on('panic_trigger', ({ userId, name }) => {
        const clientIp = socket.handshake.address || socket.request.connection?.remoteAddress || '127.0.0.1';
        
        // Find and emit panic alert ONLY to mobile sockets linked to the same user
        const sockets = io.sockets.sockets;
        let emitted = false;
        for (const [id, s] of sockets.entries()) {
            if (s.userId === userId && s.isMobile) {
                s.emit('panic_alert', { name, ip: clientIp });
                emitted = true;
            }
        }

        // If no active mobile session is connected, fallback to everyone on same userId room
        if (!emitted) {
            io.to(`user_${userId}`).emit('panic_alert', { name, ip: clientIp });
        }
    });

    socket.on('panic_trigger_targeted', ({ userId, name, targetId }) => {
        if (!targetId) return;
        const clientIp = socket.handshake.address || socket.request.connection?.remoteAddress || '127.0.0.1';
        
        const sockets = io.sockets.sockets;
        for (const [id, s] of sockets.entries()) {
            const sIp = s.handshake.address || s.request.connection?.remoteAddress || '127.0.0.1';
            // Match exactly same IP network and target User ID
            if (s.userId === targetId && sIp === clientIp) {
                s.emit('panic_alert', { name, ip: clientIp });
            }
        }
    });

    socket.on('disconnect', () => {
        const userId = socket.userId;
        if (userId && usersDB.has(userId)) {
            const user = usersDB.get(userId);
            user.isOnline = false;
            user.socketId = null;
            usersDB.set(userId, user);
            
            saveData();
            broadcastUsersUpdate();
        }
    });
});

const PORT = process.env.PORT || 5002;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Render Backend / Local Socket Server running on port ${PORT}`);
});
