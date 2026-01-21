const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const authMiddleware = require('../middleware/auth');
const Scheduled = require('../models/Scheduled');
const User = require('../models/User');
const { computeAvailability } = require('../utils/availability');
const { getBusyTimes } = require('../services/scheduling/calendarParser');
const {
    FRONTEND_URL,
    GMAIL_SCOPES,
    GCALENDAR_SCOPES,
    GMAIL_CALLBACK_URL
} = require('../constants/googleAPIs');

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    GMAIL_CALLBACK_URL
);

router.post('/init', authMiddleware, async (req, res) => {
    try {
        const { emailId, timezone } = req.body;

        if (!emailId || !timezone) {
            return res.status(400).json({ error: 'Missing emailId or timezone' });
        }

        const schedule = await Scheduled.create({
            userId: req.user.id,
            emailId,
            timezone,
            status: 'pending',
        });

        res.status(201).json({ scheduleId: schedule._id });
    } catch (err) {
        console.error('Schedule init failed:', err);
        res.status(500).json({ error: 'Failed to initialize schedule' });
    }
});

router.get('/:id/availability', authMiddleware, async (req, res) => {
    try {
        const { start, end, timezone } = req.query;

        const schedule = await Scheduled.findById(req.params.id);
        if (!schedule) {
            return res.status(404).json({ error: 'Schedule not found' });
        }

        const user = await User.findById(req.user.id);
        if (!user?.gmail?.refreshToken) {
            return res.status(403).json({ error: 'Google account not connected' });
        }

        oauth2Client.setCredentials({
            access_token: user.gmail.accessToken,
            refresh_token: user.gmail.refreshToken,
            expiry_date: user.gmail.expiryDate,
        });

        const busyTimes = await getBusyTimes(
            oauth2Client,
            start,
            end,
            timezone
        );

        const availability = computeAvailability(
            busyTimes,
            start,
            end,
            30,
            timezone
        );

        res.json({ availability });
    } catch (err) {
        console.error('Availability fetch failed:', err);
        res.status(500).json({ error: 'Failed to fetch availability' });
    }
});

router.post('/:id/confirm', authMiddleware, async (req, res) => {
    try {
        const { start, end, timezone } = req.body;

        const schedule = await Scheduled.findById(req.params.id);
        if (!schedule) {
            return res.status(404).json({ error: 'Schedule not found' });
        }

        schedule.confirmedStart = start;
        schedule.confirmedEnd = end;
        schedule.timezone = timezone;
        schedule.status = 'scheduled';

        await schedule.save();

        res.json({ success: true });
    } catch (err) {
        console.error('Schedule confirmation failed:', err);
        res.status(500).json({ error: 'Failed to confirm schedule' });
    }
});

module.exports = router;