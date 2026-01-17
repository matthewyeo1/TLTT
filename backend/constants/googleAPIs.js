const FRONTEND_URL = 'https://unsensualized-nicolle-unmistrustfully.ngrok-free.dev';

const GMAIL_SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
];

const GCALENDAR_SCOPES = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events',
];

const GMAIL_CALLBACK_URL = `${FRONTEND_URL}/auth/google/callback`;

module.exports = {
    GMAIL_SCOPES,
    GCALENDAR_SCOPES,
    GMAIL_CALLBACK_URL,
};