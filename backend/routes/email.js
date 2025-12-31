const express = require('express');
const { google } = require('googleapis');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const { processJobEmail } = require('../services/pipeline');
const { extractEmailAddress, extractBody } = require('../services/grouper');
const { cleanEmailBody } = require('../services/parser');

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
    'not to move forward',
    'after careful consideration',
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
    'your application was sent to',
    'your application was viewed'
];

function isJobRelated(subject, snippet, senderEmail, userEmail) {
  const text = `${subject} ${snippet}`.toLowerCase();
  const sender = extractEmailAddress(senderEmail).toLowerCase();
  const user = userEmail.toLowerCase();

  const hasNegative = NEGATIVE_KEYWORDS.some((w) => text.includes(w));
  const hasPositive = POSITIVE_KEYWORDS.some((w) => text.includes(w));
  const isFromUser = sender === user;

  return !hasNegative && hasPositive && !isFromUser;
}

router.get('/job', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user?.gmail?.accessToken) {
            return res.status(600).json({ error: 'Gmail not connected' });
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

        // Query structure
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
        if (messages.length === 0) {
            return res.json([]);
        }

        // Step 2: Fetch metadata in parallel
        const metadataResponses = await Promise.all(
            messages.map(msg =>
                gmail.users.messages.get({
                    userId: 'me',
                    id: msg.id,
                    format: 'metadata',
                    metadataHeaders: ['Subject', 'From', 'Date'],
                })
            )
        );

        // Step 3: Filter + prepare candidates
        const candidates = [];

        for (const msgRes of metadataResponses) {
            if (candidates.length >= 20) break;

            const headers = msgRes.data.payload?.headers || [];
            const subject = headers.find(h => h.name === 'Subject')?.value || '';
            const from = headers.find(h => h.name === 'From')?.value || '';
            const date = headers.find(h => h.name === 'Date')?.value || '';
            const snippet = msgRes.data.snippet || '';

            if (!isJobRelated(subject, snippet, from, user.email)) continue;

            candidates.push({
                id: msgRes.data.id,
                subject,
                sender: from,
                date,
                snippet,
            });
        }

        // Step 4: Process pipeline in parallel
        const processed = await Promise.all(
            candidates.map(email =>
                processJobEmail(req.user.id, email)
            )
        );

        // Step 5: Clean nulls
        const results = processed.filter(Boolean);

        res.json(results);
    } catch (err) {
        console.error('Job email fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch job emails' });
    }
});

router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(req.user.id);

        if (!user?.gmail?.accessToken) {
            return res.status(400).json({ error: 'Gmail not connected' });
        }

        // Initialize OAuth2 client directly
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

        // Refresh access token if expired
        if (!user.gmail.expiryDate || Date.now() >= user.gmail.expiryDate) {
            const newToken = await oauth2Client.getAccessToken();
            if (newToken?.token) {
                user.gmail.accessToken = newToken.token;
                await user.save();
            }
        }

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // Fetch full email
        const msg = await gmail.users.messages.get({
            userId: 'me',
            id,
            format: 'full',
        });

        const payload = msg.data.payload;

        // Extract headers
        const headers = payload.headers.reduce((acc, h) => {
            acc[h.name.toLowerCase()] = h.value;
            return acc;
        }, {});

        // Extract body
        const body = extractBody(payload);
        cleanedBody = cleanEmailBody(body);

        if (cleanedBody.length === 0) {
            cleanedBody = "(No content available)";
        }

        res.json({
            id,
            from: headers.from || '',
            subject: headers.subject || '',
            date: headers.date || '',
            body: cleanedBody,
        });

        //console.log("Body:", cleanedBody);

    } catch (err) {
        console.error('Failed to fetch email:', err);
        res.status(500).json({ error: 'Failed to fetch email' });
    }
});

module.exports = router;
