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
    res.status(401).send('Invalid token');
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

        await User.findByIdAndUpdate(state, {
        $set: update
    });

    res.send('Gmail connected successfully. You may close this window.');
  } catch (err) {
    console.error('Google OAuth error:', err);
    res.status(500).send('Google OAuth failed');
  }
});

/*
router.get('/gmail/top', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);

    if (!user || !user.gmail || !user.gmail.accessToken) {
      return res.status(401).json({ error: 'Google not connected' });
    }

    oauth2Client.setCredentials({
      access_token: user.gmail.accessToken,
      refresh_token: user.gmail.refreshToken,
      expiry_date: user.gmail.expiryDate,
    });

    // Force token refresh if needed
    await oauth2Client.getAccessToken();

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const list = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 3,
      labelIds: ['INBOX'],
    });

    const messages = await Promise.all(
      (list.data.messages || []).map(async (msg) => {
        if (!msg.id) return null;

        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        });

        const headers = detail.data.payload?.headers || [];

        const getHeader = (name) =>
          headers.find(h => h.name === name)?.value;

        return {
          id: msg.id,
          from: getHeader('From'),
          subject: getHeader('Subject'),
          date: getHeader('Date'),
        };
      })
    );

    res.json(messages.filter(Boolean));
  } catch (err) {
    console.error('Gmail fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});
*/


module.exports = router;
