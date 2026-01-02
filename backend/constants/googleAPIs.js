const GMAIL_SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
];

const GMAIL_CALLBACK_URL = 'https://unsensualized-nicolle-unmistrustfully.ngrok-free.dev/auth/google/callback';

module.exports = {
    GMAIL_SCOPES,
    GMAIL_CALLBACK_URL,
};