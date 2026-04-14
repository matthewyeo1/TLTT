const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const authMiddleware = require('../middleware/auth');
const Scheduled = require('../models/Scheduled');
const User = require('../models/User');
const EmailLog = require('../models/EmailLog');
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

        const user = await User.findById(req.user.id);
        if (!user?.gmail?.refreshToken) {
            const connectUrl = oauth2Client.generateAuthUrl({
                access_type: 'offline',
                prompt: 'consent',
                scope: [...GMAIL_SCOPES, ...GCALENDAR_SCOPES],
                state: req.user.id,
            });

            return res.status(403).json({
                error: 'Google account not connected',
                connectUrl,
            });
        }

        oauth2Client.setCredentials({
            access_token: user.gmail.accessToken,
            refresh_token: user.gmail.refreshToken,
            expiry_date: user.gmail.expiryDate,
        });

        const emailLog = await EmailLog.findOne({
            _id: emailId,
            userId: req.user.id,
        });

        if (!emailLog) {
            return res.status(404).json({ error: 'Interview email not found' });
        }

        // Check for existing pending/scheduled schedules for this email and cancel them
        let schedule = await Scheduled.findOne({
            userId: req.user.id,
            emailId,
            status: { $in: ['pending', 'scheduled'] },
        });

        if (schedule) {
            // If exists, delete any calendar event if it was scheduled
            if (schedule.calendarEventId && schedule.status === 'scheduled') {
                try {
                    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
                    await calendar.events.delete({
                        calendarId: 'primary',
                        eventId: schedule.calendarEventId,
                    });
                } catch (calendarErr) {
                    console.error('Failed to delete previous calendar event:', calendarErr);
                }
            }

            // Reset the existing schedule instead of creating new
            schedule.status = 'pending';
            schedule.calendarEventId = undefined;
            schedule.selectedSlot = undefined;
            schedule.timezone = timezone;
            await schedule.save();

            return res.status(200).json({ _id: schedule._id, isExisting: true });
        }

        // Create new schedule if none exists
        schedule = await Scheduled.create({
            userId: req.user.id,
            emailId,
            company: emailLog.company,
            role: emailLog.role,
            timezone,
            status: 'pending',
        });

        res.status(201).json({ _id: schedule._id });
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

        if (schedule.userId.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const user = await User.findById(req.user.id);
        if (!user?.gmail?.refreshToken) {
            const reauthUrl = oauth2Client.generateAuthUrl({
                access_type: 'offline',
                prompt: 'consent',
                scope: [...GMAIL_SCOPES, ...GCALENDAR_SCOPES],
                state: req.user.id,
            });

            return res.status(403).json({
                error: 'Google account not connected',
                reauthUrl,
            });
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

        if (!start || !end || !timezone) {
            return res.status(400).json({ error: 'Missing start, end, or timezone' });
        }

        const schedule = await Scheduled.findById(req.params.id);
        if (!schedule) {
            return res.status(404).json({ error: 'Schedule not found' });
        }

        if (schedule.userId.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const user = await User.findById(req.user.id);
        if (!user?.gmail?.refreshToken) {
            const reauthUrl = oauth2Client.generateAuthUrl({
                access_type: 'offline',
                prompt: 'consent',
                scope: [...GMAIL_SCOPES, ...GCALENDAR_SCOPES],
                state: req.user.id,
            });

            return res.status(403).json({
                error: 'Google account not connected',
                reauthUrl,
            });
        }

        oauth2Client.setCredentials({
            access_token: user.gmail.accessToken,
            refresh_token: user.gmail.refreshToken,
            expiry_date: user.gmail.expiryDate,
        });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        const summaryParts = ['Interview'];
        if (schedule.company) summaryParts.push(`with ${schedule.company}`);
        if (schedule.role) summaryParts.push(`for ${schedule.role}`);

        const event = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: {
                summary: summaryParts.join(' '),
                description: `Interview scheduled from email log ${schedule.emailId}.`,
                start: {
                    dateTime: start,
                    timeZone: timezone,
                },
                end: {
                    dateTime: end,
                    timeZone: timezone,
                },
            },
        });

        schedule.selectedSlot = {
            start,
            end,
        };
        schedule.timezone = timezone;
        schedule.calendarEventId = event.data.id;
        schedule.status = 'scheduled';

        await schedule.save();

        res.json({ success: true, calendarEventId: event.data.id });
    } catch (err) {
        console.error('Schedule confirmation failed:', err);
        res.status(500).json({ error: 'Failed to confirm schedule' });
    }
});

router.get('/', authMiddleware, async (req, res) => {
    try {
        const schedules = await Scheduled.find({
            userId: req.user.id,
            status: 'scheduled',
            'selectedSlot.start': { $exists: true, $ne: null },
            'selectedSlot.end': { $exists: true, $ne: null },
        })
            .sort({ 'selectedSlot.start': 1, createdAt: -1 })
            .lean();

        res.json({
            schedules: schedules.map((schedule) => ({
                _id: schedule._id,
                emailId: schedule.emailId,
                company: schedule.company,
                role: schedule.role,
                timezone: schedule.timezone,
                status: schedule.status,
                selectedSlot: schedule.selectedSlot,
                calendarEventId: schedule.calendarEventId,
                createdAt: schedule.createdAt,
            })),
        });
    } catch (err) {
        console.error('Scheduled events fetch failed:', err);
        res.status(500).json({ error: 'Failed to fetch scheduled events' });
    }
});

module.exports = router;
