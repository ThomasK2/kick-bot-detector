const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Store active connections and bot analysis data
const activeConnections = new Map();
const botAnalysis = new Map();

// Bot detection patterns
const BOT_PATTERNS = {
    username: [
        /^[a-z]+\d{3,}$/i,           // letters followed by 3+ numbers
        /^user\d+$/i,               // user + numbers
        /^[a-z]{1,3}\d{4,}$/i,      // 1-3 letters + 4+ numbers
        /^bot_/i,                   // starts with bot_
        /^anon\d+$/i,               // anon + numbers
        /^\w{1,3}_\w{1,3}_\d+$/i    // short_short_numbers pattern
    ],
    suspicious: [
        /^[a-z]+[0-9]+[a-z]+[0-9]+$/i, // alternating letters/numbers
        /^[a-z]{10,}$/i,               // very long random letters
        /^\d{5,}$/i                     // only numbers (5+)
    ]
};

// Bot detection function
function detectBot(user) {
    const { username, id, created_at, follower_badges, months_subscribed } = user;
    let botScore = 0;
    let reasons = [];

    // Username pattern analysis
    BOT_PATTERNS.username.forEach(pattern => {
        if (pattern.test(username)) {
            botScore += 70;
            reasons.push('Suspicious username pattern');
        }
    });

    BOT_PATTERNS.suspicious.forEach(pattern => {
        if (pattern.test(username)) {
            botScore += 50;
            reasons.push('Bot-like username structure');
        }
    });

    // Account age analysis (if available)
    if (created_at) {
        const accountAge = Date.now() - new Date(created_at).getTime();
        const daysSinceCreated = accountAge / (1000 * 60 * 60 * 24);
        
        if (daysSinceCreated < 1) {
            botScore += 60;
            reasons.push('Very new account (< 1 day)');
        } else if (daysSinceCreated < 7) {
            botScore += 30;
            reasons.push('New account (< 1 week)');
        }
    }

    // Activity analysis
    if (!follower_badges || follower_badges.length === 0) {
        botScore += 20;
        reasons.push('No follower badges');
    }

    if (!months_subscribed || months_subscribed === 0) {
        botScore += 15;
        reasons.push('Never subscribed');
    }

    return {
        isBot: botScore >= 60,
        botScore,
        reasons,
        confidence: Math.min(botScore, 100)
    };
}

// Kick API functions
async function getChannelInfo(channelName) {
    try {
        const endpoints = [
            `https://kick.com/api/v2/channels/${channelName}`,
            `https://kick.com/api/v1/channels/${channelName}`,
        ];
        
        for (const endpoint of endpoints) {
            try {
                console.log(`Trying endpoint: ${endpoint}`);
                const response = await axios.get(endpoint, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'application/json',
                        'Referer': 'https://kick.com/',
                    },
                    timeout: 15000
                });
                
                console.log(`✅ Success with endpoint: ${endpoint}`);
                return response.data;
            } catch (error) {
                console.log(`❌ Failed endpoint ${endpoint}: ${error.response?.status || error.message}`);
                continue;
            }
        }
        
        throw new Error('All channel endpoints failed');
    } catch (error) {
        throw new Error(`Failed to get channel info: ${error.message}`);
    }
}

async function getChatRoomId(channelName) {
    try {
        const channelInfo = await getChannelInfo(channelName);
        console.log('📋 Channel info found');
        
        const possiblePaths = [
            channelInfo.chatroom?.id,
            channelInfo.chatroom_id,
            channelInfo.id,
            channelInfo.user_id,
        ];
        
        for (const id of possiblePaths) {
            if (id) {
                console.log(`✅ Found chatroom ID: ${id}`);
                return id;
            }
        }
        
        throw new Error('Could not find chatroom ID');
    } catch (error) {
        throw new Error(`Failed to get chatroom ID: ${error.message}`);
    }
}

// API Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Real Kick API endpoint
app.post('/api/start-analysis-real', async (req, res) => {
    try {
        const { channelName } = req.body;
        
        if (!channelName) {
            return res.status(400).json({ error: 'Channel name is required' });
        }
        
        console.log(`🚀 Starting real analysis for channel: ${channelName}`);
        
        // Get chatroom ID
        const chatroomId = await getChatRoomId(channelName);
        
        if (!chatroomId) {
            return res.status(404).json({ error: 'Channel not found or no active chat' });
        }
        
        // Generate analysis ID  
        const analysisId = `real_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Create connection entry
        activeConnections.set(analysisId, {
            chatroomId: chatroomId,
            startTime: Date.now(),
            messageCount: 0,
            uniqueUsers: new Set(),
            botCount: 0,
            realUserCount: 0
        });
        
        console.log(`✅ Successfully connected to ${channelName} (ID: ${chatroomId})`);
        
        res.json({
            success: true,
            analysisId: analysisId,
            channelName: channelName,
            chatroomId: chatroomId
        });
        
    } catch (error) {
        console.error('🚨 Error starting real analysis:', error);
        res.status(500).json({ error: error.message });
    }
});

// Demo endpoint (fake data)
app.post('/api/start-analysis-demo', async (req, res) => {
    try {
        const { channelName } = req.body;
        
        if (!channelName) {
            return res.status(400).json({ error: 'Channel name is required' });
        }
        
        // Generate fake analysis ID
        const analysisId = `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Create fake connection data
        activeConnections.set(analysisId, {
            ws: null, // No real websocket
            chatroomId: 'demo_' + Math.floor(Math.random() * 100000),
            startTime: Date.now(),
            messageCount: 0,
            uniqueUsers: new Set(),
            botCount: 0,
            realUserCount: 0
        });
        
        // Start fake data generator
        startFakeDataGenerator(analysisId);
        
        res.json({
            success: true,
            analysisId: analysisId,
            channelName: channelName,
            chatroomId: 'demo_chat'
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Fake data generator
function startFakeDataGenerator(analysisId) {
    const connection = activeConnections.get(analysisId);
    if (!connection) return;
    
    const interval = setInterval(() => {
        if (!activeConnections.has(analysisId)) {
            clearInterval(interval);
            return;
        }
        
        // Generate fake users and messages
        const userTypes = [
            { username: `user${Math.floor(Math.random() * 9999)}`, isBot: true },
            { username: `bot_${Math.floor(Math.random() * 999)}`, isBot: true },
            { username: `viewer${Math.floor(Math.random() * 999)}`, isBot: false },
            { username: `fan_${Math.random().toString(36).substr(2, 8)}`, isBot: false },
            { username: `anon${Math.floor(Math.random() * 99999)}`, isBot: true },
            { username: `regular_viewer`, isBot: false },
            { username: `mod_${Math.random().toString(36).substr(2, 6)}`, isBot: false }
        ];
        
        // Add 1-3 random users each interval
        const numUsers = Math.floor(Math.random() * 3) + 1;
        
        for (let i = 0; i < numUsers; i++) {
            const user = userTypes[Math.floor(Math.random() * userTypes.length)];
            const userId = Math.floor(Math.random() * 100000);
            
            connection.messageCount++;
            connection.uniqueUsers.add(userId);
            
            if (user.isBot) {
                connection.botCount++;
            } else {
                connection.realUserCount++;
            }
            
            // Store individual user analysis
            if (!botAnalysis.has(analysisId)) {
                botAnalysis.set(analysisId, new Map());
            }
            
            const analysis = detectBot({
                username: user.username,
                id: userId,
                created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
                follower_badges: user.isBot ? [] : ['VIP'],
                months_subscribed: user.isBot ? 0 : Math.floor(Math.random() * 12)
            });
            
            botAnalysis.get(analysisId).set(userId, {
                username: user.username,
                analysis: analysis,
                lastSeen: Date.now(),
                messageCount: 1
            });
        }
        
    }, 1000 + Math.random() * 2000); // Random interval 1-3 seconds
    
    // Store interval reference
    connection.fakeInterval = interval;
}

app.get('/api/analysis/:analysisId', (req, res) => {
    const { analysisId } = req.params;
    const connection = activeConnections.get(analysisId);
    const userAnalysis = botAnalysis.get(analysisId);
    
    if (!connection) {
        return res.status(404).json({ error: 'Analysis not found or inactive' });
    }
    
    const totalUniqueUsers = connection.uniqueUsers.size;
    const botPercentage = totalUniqueUsers > 0 ? (connection.botCount / totalUniqueUsers * 100).toFixed(1) : 0;
    
    // Get recent bot detections
    const recentBots = [];
    if (userAnalysis) {
        for (const [userId, data] of userAnalysis.entries()) {
            if (data.analysis.isBot && Date.now() - data.lastSeen < 300000) { // Last 5 minutes
                recentBots.push({
                    username: data.username,
                    confidence: data.analysis.confidence,
                    reasons: data.analysis.reasons
                });
            }
        }
    }
    
    res.json({
        analysisId: analysisId,
        status: 'active',
        runtime: Math.floor((Date.now() - connection.startTime) / 1000),
        stats: {
            totalMessages: connection.messageCount,
            uniqueUsers: totalUniqueUsers,
            suspectedBots: connection.botCount,
            realUsers: connection.realUserCount,
            botPercentage: parseFloat(botPercentage)
        },
        recentBots: recentBots.slice(-10) // Last 10 bot detections
    });
});

app.delete('/api/analysis/:analysisId', (req, res) => {
    const { analysisId } = req.params;
    const connection = activeConnections.get(analysisId);
    
    if (connection) {
        // Close WebSocket if it exists (for demo connections)
        if (connection.ws) {
            connection.ws.close();
        }
        
        // Clear fake interval if it exists
        if (connection.fakeInterval) {
            clearInterval(connection.fakeInterval);
        }
    }
    
    activeConnections.delete(analysisId);
    botAnalysis.delete(analysisId);
    
    res.json({ success: true, message: 'Analysis stopped' });
});

app.get('/api/active-analyses', (req, res) => {
    const analyses = [];
    
    for (const [analysisId, connection] of activeConnections.entries()) {
        analyses.push({
            analysisId: analysisId,
            chatroomId: connection.chatroomId,
            runtime: Math.floor((Date.now() - connection.startTime) / 1000),
            messageCount: connection.messageCount,
            uniqueUsers: connection.uniqueUsers.size
        });
    }
    
    res.json(analyses);
});

// Start server
app.listen(PORT, () => {
    console.log(`🤖 Kick Bot Detector API running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down server...');
    
    // Close all WebSocket connections
    for (const [analysisId, connection] of activeConnections.entries()) {
        if (connection.ws) {
            connection.ws.close();
        }
    }
    
    process.exit(0);
});