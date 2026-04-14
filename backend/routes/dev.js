const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const EmailLog = require('../models/EmailLog');

router.post('/stub-interview', authMiddleware, async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Not allowed in production' });
    }

    if (!req.user?.id) {
        return res.status(401).json({ error: 'Invalid auth token' });
    }

    const fakeEmail = await EmailLog.create({
        userId: req.user.id,
        messageId: `stub-${Date.now()}`,   

        company: 'Google',
        role: 'Software Engineer Intern',

        status: 'interview',
        interviewSubtype: 'schedule_interview',

        actionable: true,

        source: 'stub',
        receivedAt: new Date(),

        scheduling: {
            status: 'pending',
        },
    });

    res.status(201).json(fakeEmail);
});

module.exports = router;
