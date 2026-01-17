const express = require('express');
const { google } = require('googleapis');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const { verifyToken } = require('../utils/jwt');
const { 
    FRONTEND_URL, 
    GMAIL_SCOPES, 
    GCALENDAR_SCOPES, 
    GMAIL_CALLBACK_URL 
} = require('../constants/googleAPIs');

const router = express.Router();

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    GMAIL_CALLBACK_URL
);

// Token refresh listener
oauth2Client.on('tokens', async (tokens) => {
    try {
        if (!tokens.access_token) return;

        await User.findOneAndUpdate(
            { 'gmail.refreshToken': tokens.refresh_token || oauth2Client.credentials.refresh_token },
            {
                $set: {
                    'gmail.accessToken': tokens.access_token,
                    'gmail.expiryDate': tokens.expiry_date,
                    ...(tokens.refresh_token && {
                        'gmail.refreshToken': tokens.refresh_token,
                    }),
                },
            }
        );
    } catch (err) {
        console.error('Failed to persist refreshed Gmail tokens:', err);
    }
});

router.get('/', (req, res) => {
    let token = req.headers['authorization']?.split(' ')[1] || req.query.token;

    if (!token) return res.status(401).send('No token provided');

    try {
        const decoded = verifyToken(token);
        req.user = decoded;

        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: [...GMAIL_SCOPES, ...GCALENDAR_SCOPES],
            state: req.user.id
        });

        res.redirect(url);
    } catch (err) {
        console.error('JWT error:', err);
        res.status(402).send('Invalid token');
    }
});

router.get('/callback', async (req, res) => {
    const { code, state } = req.query;

    console.log('OAuth state:', state);

    if (!code || !state) {
        return res.status(400).send('Missing OAuth parameters');
    }

    try {
        const { tokens } = await oauth2Client.getToken(code);

        console.log('Google tokens:', tokens);

        const update = {
            'gmail.accessToken': tokens.access_token,
            'gmail.expiryDate': tokens.expiry_date,
        };

        if (tokens.refresh_token) {
            update['gmail.refreshToken'] = tokens.refresh_token;
        }

        await User.findByIdAndUpdate(state, { $set: update }, { new: true, upsert: true });

        res.send('Gmail connected successfully. You may close this window.');
    } catch (err) {
        console.error('Google OAuth error:', err);
        res.status(500).send('Google OAuth failed');
    }
});

router.get('/link', authMiddleware, (req, res) => {
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: [...GMAIL_SCOPES, ...GCALENDAR_SCOPES],
        state: req.user.id
    });

    res.json({ url });
});

router.get('/connect-gmail', authMiddleware, async (req, res) => {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        GMAIL_CALLBACK_URL
    );

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: [...GMAIL_SCOPES, ...GCALENDAR_SCOPES],
        state: req.user.id,
    });

    res.redirect(authUrl);
});

router.get('/connect-gmail/callback', async (req, res) => {
    const { code, state } = req.query;

    if (!code || !state) {
        return res.status(400).json({ error: 'Missing OAuth parameters' });
    }

    const user = await User.findById(state);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        GMAIL_CALLBACK_URL
    );

    try {
        const { tokens } = await oauth2Client.getToken(code);

        user.gmail = {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token, // guaranteed by consent
            expiryDate: tokens.expiry_date,
        };

        await user.save();

        res.redirect(`${FRONTEND_URL}/emails`);
    } catch (err) {
        console.error('Gmail OAuth callback error:', err);
        res.status(500).json({ error: 'Failed to connect Gmail' });
    }
});

router.get('/availability', authMiddleware, async (req, res) => {
    try {
        const { start, end, timezone } = req.query;

        if (!start || !end || !timezone) {
            return res.status(400).json({ error: 'Missing required query parameters' });
        }

        const user = await User.findById(req.user.id);

        if (!user || !user.gmail?.refreshToken) {
            return res.status(402).json({ error: 'Google account not connected' });
        }

        oauth2Client.setCredentials({
            access_token: user.gmail.accessToken,
            refresh_token: user.gmail.refreshToken,
            expiry_date: user.gmail.expiryDate,
        });

        

    } catch (err) {
        console.error('Google Calendar availability error:', err);
        res.status(500).json({ error: 'Failed to fetch availability' });
    }

});

module.exports = router;
