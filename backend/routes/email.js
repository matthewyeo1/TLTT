const express = require('express');
const { google } = require('googleapis');
const User = require('../models/User');
const EmailLog = require('../models/EmailLog');
const authMiddleware = require('../middleware/auth');
const { processJobEmail, actionable } = require('../services/filtering/pipeline');
const {
    extractEmailAddress,
    extractBody,
    extractCompany,
    extractRole,
    POSITIVE_KEYWORDS,
    NEGATIVE_KEYWORDS,
    BLACKLISTED_SENDERS
} = require('../services/filtering/grouper');
const { cleanEmailBody } = require('../services/filtering/parser');
const router = express.Router();
const { GMAIL_SCOPES, GMAIL_CALLBACK_URL } = require('../constants/googleAPIs');

function isJobRelated(subject, snippet, senderEmail, userEmail) {
    const text = `${subject} ${snippet}`.toLowerCase();
    const sender = extractEmailAddress(senderEmail).toLowerCase();
    const user = userEmail.toLowerCase();

    const hasNegative = (NEGATIVE_KEYWORDS || []).some((w) => text.includes(w));
    const hasPositive = (POSITIVE_KEYWORDS || []).some((w) => text.includes(w));
    const isBlacklisted = (BLACKLISTED_SENDERS || []).some((s) => sender.includes(s));

    const isFromUser = sender === user;

    const company = extractCompany(senderEmail);
    const role = extractRole(subject);

    const hasCompanyAndRole = company && role;

    return !hasNegative && hasPositive && !isFromUser && !isBlacklisted && hasCompanyAndRole;
}

router.get('/job', authMiddleware, async (req, res) => {
    let user;

    try {
        user = await User.findById(req.user.id);
        if (!user?.gmail?.accessToken) {
            return res.status(400).json({ error: 'Gmail not connected' });
        }

        // Initialize OAuth2 client with credentials
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            GMAIL_CALLBACK_URL
        );

        // Set user credentials
        oauth2Client.setCredentials({
            access_token: user.gmail.accessToken,
            refresh_token: user.gmail.refreshToken,
            expiry_date: user.gmail.expiryDate,
        });

        oauth2Client.on('tokens', async (tokens) => {
            if (tokens.access_token) {
                user.gmail.accessToken = tokens.access_token;
            }
            if (tokens.expiry_date) {
                user.gmail.expiryDate = tokens.expiry_date;
            }
            if (tokens.refresh_token) {
                user.gmail.refreshToken = tokens.refresh_token;
            }
            await user.save();
        });

        await oauth2Client.getAccessToken();

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // Query structure
        const listRes = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 500,
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
                processJobEmail(req.user.id, email, user.gmail.accessToken)
            )
        );

        // Step 5: Clean nulls
        const results = processed.filter(Boolean);

        res.json(results);
    } catch (err) {
        if (err?.response?.data?.error === 'invalid_grant') {
        // Token is permanently invalid — clear stored credentials
        const user = await User.findById(req.user.id);
        if (user) {
            user.gmail = undefined;
            await user.save();
        }

        return res.status(401).json({
            error: 'Gmail authorization expired. Please reconnect Gmail.',
            code: 'GMAIL_REAUTH_REQUIRED',
        });
    }

    console.error('Job email fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch job emails' });
    }
});

router.get("/logs", authMiddleware, async (req, res) => {
    try {
        const logs = await EmailLog.find({ 
            userId: req.user.id,
            status: { $in: ['interview', 'accepted'] }
        })
        .sort({ lastUpdatedFromEmailAt: -1 })
        .limit(10)
        .select('company role status interviewSubtype updatedAt lastUpdatedFromEmailAt');

        res.json(logs);
    } catch (err) {
        console.error('Failed to fetch log emails:', err);
        res.status(500).json({ error: 'Failed to fetch log emails' });
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
            GMAIL_CALLBACK_URL
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
