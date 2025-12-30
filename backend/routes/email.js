const express = require('express');
const { google } = require('googleapis');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const { processJobEmail } = require('../services/pipeline');
const { extractBody } = require('../services/grouper');

const router = express.Router();

// Keywords to filter job-related emails
const POSITIVE_KEYWORDS = [
  'application','interview','offer','position','role','recruiter',
  'hiring','assessment','shortlisted','unfortunately',
  'regret to inform','next steps','not to move forward','after careful consideration'
];
const NEGATIVE_KEYWORDS = [
  'newsletter','unsubscribe','sale','discount','webinar',
  'promotion','marketing','event reminder','is hiring',
  'job alert','your application was sent to'
];

function isJobRelated(subject, snippet) {
  const text = `${subject} ${snippet}`.toLowerCase();
  if (NEGATIVE_KEYWORDS.some(w => text.includes(w))) return false;
  if (!POSITIVE_KEYWORDS.some(w => text.includes(w))) return false;
  return true;
}

// Utility to initialize Gmail client and refresh token if expired
async function getGmailClient(user) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: user.gmail.accessToken,
    refresh_token: user.gmail.refreshToken,
    expiry_date: user.gmail.expiryDate,
  });

  // Refresh token if expired
  if (!user.gmail.expiryDate || Date.now() >= user.gmail.expiryDate) {
    const newToken = await oauth2Client.getAccessToken();
    if (newToken?.token) {
      user.gmail.accessToken = newToken.token;
      await user.save();
      oauth2Client.setCredentials({
        ...oauth2Client.credentials,
        access_token: newToken.token,
      });
    }
  }

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

// GET /email/job – fetch list of job-related emails
router.get('/job', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user?.gmail?.accessToken) return res.status(400).json({ error: 'Gmail not connected' });

    const gmail = await getGmailClient(user);
    const listRes = await gmail.users.messages.list({ userId: 'me', maxResults: 100 });
    const messages = listRes.data.messages || [];

    const metadataResponses = await Promise.all(
      messages.map(msg =>
        gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'metadata', metadataHeaders: ['Subject','From','Date'] })
      )
    );

    const candidates = [];
    for (const msgRes of metadataResponses) {
      if (candidates.length >= 20) break;
      const headers = msgRes.data.payload?.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const from = headers.find(h => h.name === 'From')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';
      const snippet = msgRes.data.snippet || '';

      if (!isJobRelated(subject, snippet)) continue;
      candidates.push({
        id: msgRes.data.id,
        subject,
        from,
        date,
        snippet,
      });
    }

    const processed = await Promise.all(candidates.map(email => processJobEmail(req.user.id, email)));
    const results = processed.filter(Boolean);
    res.json(results);
  } catch (err) {
    console.error('Job email fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch job emails' });
  }
});

// GET /email/:id – fetch individual email body
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(req.user.id);
    if (!user?.gmail?.accessToken) return res.status(400).json({ error: 'Gmail not connected' });

    const gmail = await getGmailClient(user);
    const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });

    const payload = msg.data.payload;
    const headers = payload.headers.reduce((acc, h) => {
      acc[h.name.toLowerCase()] = h.value;
      return acc;
    }, {});
    const body = extractBody(payload);

    res.json({ id, from: headers.from, subject: headers.subject, date: headers.date, body });
  } catch (err) {
    console.error('Failed to fetch email:', err);
    res.status(500).json({ error: 'Failed to fetch email' });
  }
});

module.exports = router;
