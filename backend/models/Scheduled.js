const mongoose = require('mongoose');

const ScheduledSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },

    emailId: {
        type: String, 
        required: true,
        index: true,
    },

    company: String,
    role: String,

    status: {
        type: String,
        enum: ['pending', 'scheduled', 'cancelled'],
        default: 'pending',
    },

    timezone: {
        type: String,
        required: true,
    },

    selectedSlot: {
        start: String,
        end: String,
    },

    calendarEventId: String,

    createdAt: {
        type: Date,
        default: Date.now,
    },

    emailLogId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmailLog',
        default: null
    }
});

module.exports = mongoose.model('Scheduled', ScheduledSchema);
