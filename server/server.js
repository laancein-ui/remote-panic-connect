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
// store users as: { userId: { id, name, isOnline, socketId, ip } }
const usersDB = new Map(); 

io.on('connection', (socket) => {
    // Get client IP securely
    const getClientIp = () => {
        return socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
    };

    socket.on('login', async (userData) => {
        if (!userData || !userData.id) return;
        
        const clientIp = getClientIp();

        usersDB.set(userData.id, {
            id: userData.id,
            name: userData.name,
            isOnline: true,
            socketId: socket.id,
            ip: clientIp
        });
        
        socket.userId = userData.id;
        io.emit('users_update', Array.from(usersDB.values()));

        // Process Offline Messages from Supabase
        const { data: unread } = await supabase
            .from('messages')
            .select('*')
            .eq('receiver_id', userData.id);

        const messagesToUpdate = [];
        const messagesToSend = [];

        if (unread) {
            unread.forEach(msg => {
                try {
                    const parsedContent = JSON.parse(msg.content);
                    // If message was sent while user was offline, it will have no receiver_ip
                    if (!parsedContent.receiver_ip) {
                        parsedContent.receiver_ip = clientIp; // Lock it to their CURRENT IP
                        messagesToUpdate.push({ id: msg.id, content: JSON.stringify(parsedContent) });
                        messagesToSend.push({
                            id: msg.id,
                            sender_id: msg.sender_id,
                            target_id: msg.receiver_id,
                            content: parsedContent.text,
                            timestamp: parsedContent.timestamp || Date.now()
                        });
                    }
                } catch(e) {}
            });
        }

        // Save IP locks to database
        for (const update of messagesToUpdate) {
            await supabase.from('messages').update({ content: update.content }).eq('id', update.id);
        }

        // Deliver messages
        messagesToSend.forEach(msg => {
            socket.emit('receive_message', msg);
        });
    });

    socket.on('get_users', () => {
        socket.emit('users_update', Array.from(usersDB.values()));
    });
    
    socket.on('get_history', async (targetId) => {
        const userId = socket.userId;
        if (!userId || !targetId) return;
        
        const clientIp = getClientIp();

        // Fetch conversation from Supabase
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${userId},receiver_id.eq.${targetId}),and(sender_id.eq.${targetId},receiver_id.eq.${userId})`)
            .order('created_at', { ascending: true });
            
        if (error) {
            console.error("Error fetching history:", error);
            return;
        }

        const history = [];
        data.forEach(m => {
            try {
                const parsed = JSON.parse(m.content);
                // Strict IP Lock check
                let canView = false;
                if (m.sender_id === userId && parsed.sender_ip === clientIp) canView = true;
                if (m.receiver_id === userId && parsed.receiver_ip === clientIp) canView = true;
                
                if (canView) {
                    history.push({
                        id: m.id,
                        sender_id: m.sender_id,
                        target_id: m.receiver_id,
                        content: parsed.text,
                        timestamp: parsed.timestamp || Date.now()
                    });
                }
            } catch (e) {
                // Ignore plain-text legacy messages
            }
        });

        socket.emit('chat_history', { targetId, history });
    });

    socket.on('send_message', async (message) => {
        const { sender_id, target_id, content, timestamp } = message;
        if (!sender_id || !target_id) return;

        const clientIp = getClientIp();
        const targetUser = usersDB.get(target_id);

        // Prepare message data with IP locks
        const messageData = {
            text: content,
            sender_ip: clientIp,
            receiver_ip: (targetUser && targetUser.isOnline) ? targetUser.ip : null,
            timestamp: timestamp || Date.now()
        };

        const msgObj = { 
            sender_id, 
            receiver_id: target_id, 
            content: JSON.stringify(messageData), 
            type: 'chat' 
        };
        
        // Save to Supabase immediately
        const { data, error } = await supabase.from('messages').insert([msgObj]).select();
        
        if (data && data.length > 0) {
            const savedMsg = data[0];
            const frontendMsg = {
                id: savedMsg.id,
                sender_id,
                target_id,
                content,
                timestamp: messageData.timestamp
            };
            
            // Send to sender to confirm
            socket.emit('receive_message', frontendMsg);

            // Check if target is online and send
            if (targetUser && targetUser.isOnline && targetUser.socketId) {
                io.to(targetUser.socketId).emit('receive_message', frontendMsg);
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
            
            io.emit('users_update', Array.from(usersDB.values()));
        }
    });
});

const PORT = process.env.PORT || 5002;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Render Backend / Local Socket Server running on port ${PORT}`);
});
