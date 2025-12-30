const express = require('express');
const { google } = require('googleapis');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const { verifyToken } = require('../utils/jwt');

const router = express.Router();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://unsensualized-nicolle-unmistrustfully.ngrok-free.dev/auth/google/callback'
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
      scope: ['https://www.googleapis.com/auth/gmail.readonly'],
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
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
    state: req.user.id        
  });

  res.json({ url });
});

module.exports = router;
