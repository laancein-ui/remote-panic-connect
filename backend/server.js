const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const http = require('http');
const { Server } = require('socket.io');

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

// Local Secure Chat State
// store users as: { userId: { id, name, isOnline, socketId } }
const usersDB = new Map(); 
const messagesDB = []; // { id, sender_id, target_id, content, timestamp }
const offlineMessages = new Map(); // target_id -> array of message objects

io.on('connection', (socket) => {
    socket.on('login', (userData) => {
        if (!userData || !userData.id) return;
        
        usersDB.set(userData.id, {
            id: userData.id,
            name: userData.name,
            isOnline: true,
            socketId: socket.id
        });
        
        // Map socket ID to user ID for disconnect handling
        socket.userId = userData.id;

        // Broadcast updated user list
        io.emit('users_update', Array.from(usersDB.values()));

        // Send offline messages if any
        if (offlineMessages.has(userData.id)) {
            const msgs = offlineMessages.get(userData.id);
            msgs.forEach(msg => {
                socket.emit('receive_message', msg);
                messagesDB.push(msg);
            });
            offlineMessages.delete(userData.id);
        }
    });

    socket.on('get_users', () => {
        socket.emit('users_update', Array.from(usersDB.values()));
    });
    
    socket.on('get_history', (targetId) => {
        const userId = socket.userId;
        if (!userId || !targetId) return;
        
        // Get messages between userId and targetId
        const history = messagesDB.filter(m => 
            (m.sender_id === userId && m.target_id === targetId) ||
            (m.sender_id === targetId && m.target_id === userId)
        );
        socket.emit('chat_history', { targetId, history });
    });

    socket.on('send_message', (message) => {
        const { sender_id, target_id, content, timestamp } = message;
        if (!sender_id || !target_id) return;

        const msgObj = { id: Date.now().toString(), sender_id, target_id, content, timestamp };
        
        messagesDB.push(msgObj);
        
        // Send to sender to confirm
        socket.emit('receive_message', msgObj);

        // Check if target is online
        const targetUser = usersDB.get(target_id);
        if (targetUser && targetUser.isOnline && targetUser.socketId) {
            io.to(targetUser.socketId).emit('receive_message', msgObj);
        } else {
            // Store offline message
            const queued = offlineMessages.get(target_id) || [];
            queued.push(msgObj);
            offlineMessages.set(target_id, queued);
        }
    });

    socket.on('disconnect', () => {
        const userId = socket.userId;
        if (userId && usersDB.has(userId)) {
            const user = usersDB.get(userId);
            user.isOnline = false;
            user.socketId = null;
            usersDB.set(userId, user);
            
            io.emit('users_update', Array.from(usersDB.values()));
        }
    });
});

const PORT = process.env.PORT || 5002;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Render Backend / Local Socket Server running on port ${PORT}`);
});
