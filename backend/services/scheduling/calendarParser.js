const { google } = require('googleapis');

async function getBusyTimes(oauth2Client, timeMin, timeMax, timeZone) {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const response = await calendar.freebusy.query({
        requestBody: {
            timeMin,
            timeMax,
            timeZone,
            items: [{ id: 'primary' }],
        },
    });

    return response.data.calendars.primary.busy || [];
}

modules.exports = { getBusyTimes };