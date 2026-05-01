const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

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

// Health Check API
app.get('/api/health', (req, res) => {
    res.json({ status: 'Backend is running on Render perfectly!' });
});

// Example Authenticated API Route
app.get('/api/user-stats', verifyAuth, async (req, res) => {
    // You can use the Node backend to perform secure operations using the Service Role
    try {
        const { count, error } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('sender_id', req.user.id);
            
        if (error) throw error;
        
        res.json({ messageCount: count, userId: req.user.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Optional: WebSockets / Socket.io can be attached here in the future if Supabase Realtime isn't enough
const PORT = process.env.PORT || 5002;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Render Backend Server running on port ${PORT}`);
});
