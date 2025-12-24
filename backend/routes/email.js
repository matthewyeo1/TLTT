const express = require('express');
const { google } = require('googleapis');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Hard keyword filters (precision > recall)
const POSITIVE_KEYWORDS = [
  'application',
  'interview',
  'offer',
  'position',
  'role',
  'recruiter',
  'hiring',
  'assessment',
  'shortlisted',
  'unfortunately',
  'regret to inform',
  'next steps',
];

const NEGATIVE_KEYWORDS = [
  'newsletter',
  'unsubscribe',
  'sale',
  'discount',
  'webinar',
  'promotion',
  'marketing',
  'event reminder',
  'is hiring',
];

function isJobRelated(subject, snippet) {
  const text = `${subject} ${snippet}`.toLowerCase();

  if (NEGATIVE_KEYWORDS.some(w => text.includes(w))) return false;
  if (!POSITIVE_KEYWORDS.some(w => text.includes(w))) return false;

  return true;
}

router.get('/job', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user?.gmail?.accessToken) {
      return res.status(400).json({ error: 'Gmail not connected' });
    }

    // Initialize OAuth2 client with credentials
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'https://unsensualized-nicolle-unmistrustfully.ngrok-free.dev/auth/google/callback'
    );

    // Set user credentials
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
        // optionally update expiryDate if returned
        await user.save();
      }
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Gmail query with LinkedIn/Indeed exclusions
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 100,
      q: `
        (subject:(application OR interview OR offer OR rejection OR unfortunately OR update)
        OR from:(@indeed.com OR @glassdoor.com OR @lever.co OR @greenhouse.io))
        -from:jobalerts-noreply@linkedin.com
        -subject:"linkedin job alerts"
        -from:invitationtoapply-sg@match.indeed.com
        -category:promotions
        -category:social
        newer_than:60d
      `,
    });

    const messages = listRes.data.messages || [];
    const results = [];

    for (const msg of messages) {
      if (results.length >= 20) break;

      const msgRes = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date'],
      });

      const headers = msgRes.data.payload.headers;
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const from = headers.find(h => h.name === 'From')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';
      const snippet = msgRes.data.snippet || '';

      if (!isJobRelated(subject, snippet)) continue;

      results.push({
        id: msg.id,
        subject,
        sender: from,
        date,
        snippet,
        status: 'pending',
      });
    }

    res.json(results);
  } catch (err) {
    console.error('Job email fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch job emails' });
  }
});

module.exports = router;
