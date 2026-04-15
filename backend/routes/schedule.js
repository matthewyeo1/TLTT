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

        // Return existing schedule if found
        if (schedule) {
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
        const { start, end, timezone, duration } = req.query;
        const slotDuration = duration ? parseInt(duration) : 30;

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
            slotDuration,
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

        // Find associated EmailLog
        const emailLog = await EmailLog.findOne({
            _id: schedule.emailId,
            userId: req.user.id
        });

        if (!emailLog) {
            console.warn(`EmailLog not found for schedule ${schedule._id}, but continuing...`);
        }

        // If this email log has an existing calendar event, delete it first (for rescheduling)
        if (emailLog && emailLog.calendarEventId) {
            try {
                const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
                await calendar.events.delete({
                    calendarId: 'primary',
                    eventId: emailLog.calendarEventId,
                });
                console.log(`Deleted existing calendar event for email log: ${emailLog._id}`);
            } catch (calendarErr) {
                console.error('Failed to delete existing calendar event:', calendarErr);
                // Continue anyway: the event might already be deleted
            }
        }

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        const summaryParts = ['Interview'];
        if (schedule.company) summaryParts.push(`with ${schedule.company}`);
        if (schedule.role) summaryParts.push(`for ${schedule.role}`);

        // Add round info if available
        if (emailLog && emailLog.roundNumber) {
            const roundText = emailLog.roundNumber === 1 ? 'Initial' : `Round ${emailLog.roundNumber}`;
            summaryParts.push(`(${roundText})`);
        }

        const event = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: {
                summary: summaryParts.join(' '),
                description: `Interview scheduled from email: ${schedule.emailId}\nCompany: ${schedule.company || 'N/A'}\nRole: ${schedule.role || 'N/A'}`,
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

        // Update schedule
        schedule.selectedSlot = {
            start,
            end,
        };
        schedule.timezone = timezone;
        schedule.calendarEventId = event.data.id;
        schedule.status = 'scheduled';
        
        // Link back to email log
        if (emailLog) {
            schedule.emailLogId = emailLog._id;
        }
        
        await schedule.save();

        // Update EmailLog with calendar event and mark as inactive/processed
        if (emailLog) {
            const interviewEnd = new Date(end);
            
            emailLog.calendarEventId = event.data.id;
            emailLog.isActive = false;  // Mark as no longer actionable

            emailLog.scheduling.scheduledAt = new Date();
            emailLog.scheduling.timezone = timezone;
            emailLog.scheduling.status = 'scheduled';
            emailLog.scheduledSlot = {
                start,
                end,
                timezone
            };
            emailLog.scheduledEnd = interviewEnd;  // Store when interview ends
            emailLog.expiresAt = new Date(interviewEnd.getTime() + 24 * 60 * 60 * 1000);  // Expire 1 day after interview
            
            await emailLog.save();
            console.log(`Updated EmailLog ${emailLog._id}: Interview scheduled for ${start}, will expire on ${emailLog.expiresAt}`);
        }

        // Also update any other active interviews for same company/role to inactive
        if (emailLog && emailLog.company && emailLog.role) {
            await EmailLog.updateMany(
                {
                    userId: req.user.id,
                    company: emailLog.company,
                    role: emailLog.role,
                    status: 'interview',
                    isActive: true,
                    _id: { $ne: emailLog._id }  // Exclude the current one
                },
                {
                    $set: {
                        isActive: false,
                        supersededBy: emailLog._id,
                        supersededAt: new Date()
                    }
                }
            );
            console.log(`Marked older interviews for ${emailLog.company} - ${emailLog.role} as inactive`);
        }

        res.json({ 
            success: true, 
            calendarEventId: event.data.id,
            emailLogId: emailLog?._id
        });
        
    } catch (err) {
        console.error('Schedule confirmation failed:', err);
        res.status(500).json({ error: 'Failed to confirm schedule' });
    }
});

// Cancel interview appointment
router.delete('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const schedule = await Scheduled.findById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    if (schedule.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const user = await User.findById(req.user.id);
    if (!user?.gmail?.refreshToken) {
      return res.status(403).json({ error: 'Google account not connected' });
    }

    // 1. Delete calendar event if exists
    if (schedule.calendarEventId) {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        GMAIL_CALLBACK_URL
      );
      oauth2Client.setCredentials({
        access_token: user.gmail.accessToken,
        refresh_token: user.gmail.refreshToken,
        expiry_date: user.gmail.expiryDate,
      });
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: schedule.calendarEventId,
      });
    }

    // 2. Delete the Scheduled document
    await schedule.deleteOne();

    // 3. Update the associated EmailLog to 'cancelled' (instead of deleting)
    const emailLogId = schedule.emailId || schedule.emailLogId;
    if (emailLogId) {
      await EmailLog.updateOne(
        { _id: emailLogId },
        {
          $set: {
            isActive: false,
            status: 'cancelled',           // add 'cancelled' to enum if needed
            'scheduling.status': 'cancelled',
            cancelledAt: new Date()
          }
        }
      );
    }

    res.json({ success: true, message: 'Interview cancelled successfully' });
  } catch (err) {
    console.error('Cancel interview failed:', err);
    res.status(500).json({ error: 'Failed to cancel interview' });
  }
});

// Clean-up expired interviews
router.post('/cleanup-expired', authMiddleware, async (req, res) => {
    try {
        const expiredInterviews = await EmailLog.find({
            userId: req.user.id,
            status: 'interview',
            isActive: true,
            expiresAt: { $lt: new Date() }
        });
        
        const results = [];
        
        for (const interview of expiredInterviews) {
            // Delete from Google Calendar if exists
            if (interview.calendarEventId) {
                try {
                    const user = await User.findById(req.user.id);
                    if (user?.gmail?.refreshToken) {
                        const oauth2Client = new google.auth.OAuth2(
                            process.env.GOOGLE_CLIENT_ID,
                            process.env.GOOGLE_CLIENT_SECRET,
                            GMAIL_CALLBACK_URL
                        );
                        oauth2Client.setCredentials({
                            access_token: user.gmail.accessToken,
                            refresh_token: user.gmail.refreshToken,
                        });
                        
                        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
                        await calendar.events.delete({
                            calendarId: 'primary',
                            eventId: interview.calendarEventId,
                        });
                    }
                } catch (err) {
                    console.error(`Failed to delete calendar event for ${interview._id}:`, err);
                }
            }
            
            // Mark as inactive
            interview.isActive = false;
            await interview.save();
            results.push(interview._id);
        }
        
        res.json({ 
            success: true, 
            cleanedUp: results.length,
            ids: results 
        });
    } catch (err) {
        console.error('Cleanup failed:', err);
        res.status(500).json({ error: 'Failed to cleanup expired interviews' });
    }
});

module.exports = router;
