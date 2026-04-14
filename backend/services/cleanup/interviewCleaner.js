const cron = require('node-cron');
const EmailLog = require('../../models/EmailLog');
const { google } = require('googleapis');
const User = require('../../models/User');

async function cleanupExpiredInterviews() {
  console.log('Running expired interviews cleanup...');
  const now = new Date();
  
  // All active interviews that should be cleaned up
  const expiredInterviews = await EmailLog.find({
    isActive: true,
    $or: [
      // Unscheduled and expired
      {
        'scheduling.status': { $ne: 'scheduled' },
        expiresAt: { $lt: now }
      },
      // Scheduled and interview time has passed
      {
        'scheduling.status': 'scheduled',
        scheduledEnd: { $lt: now }
      }
    ]
  });
  
  for (const interview of expiredInterviews) {
    console.log(`Cleaning up: ${interview.company} - ${interview.role}`);
    
    // Delete from Google Calendar if event exists
    if (interview.calendarEventId) {
      try {
        const user = await User.findById(interview.userId);
        if (user?.gmail?.refreshToken) {
          const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_CALLBACK_URL
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
          console.log(`Deleted calendar event for: ${interview._id}`);
        }
      } catch (err) {
        console.error(`Failed to delete calendar event:`, err);
      }
    }
    
    // Mark as inactive
    interview.isActive = false;
    await interview.save();
    console.log(`Marked interview as inactive`);
  }
  
  console.log(`Cleaned up ${expiredInterviews.length} expired interviews`);
}

// Run daily at 2 AM
cron.schedule('0 2 * * *', cleanupExpiredInterviews);

module.exports = { cleanupExpiredInterviews };