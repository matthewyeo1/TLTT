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
    res.status(401).send('Invalid token');
  }
});

router.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.status(400).send('Missing OAuth parameters');
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);

    console.log('Google tokens:', tokens);

    await User.findByIdAndUpdate(state, {
      gmail: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date
      }
    });

    res.send('Gmail connected successfully. You may close this window.');
  } catch (err) {
    console.error('Google OAuth error:', err);
    res.status(500).send('Google OAuth failed');
  }
});

module.exports = router;
