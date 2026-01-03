const User = require('../../models/User');
const { google } = require('googleapis');
const { GMAIL_SCOPES, GMAIL_CALLBACK_URL } = require('../../constants/googleAPIs');

async function sendReply({ to, threadId, body, accessToken, refreshToken, expiryDate, userId }) {
    const SAFE_RECIPIENT = 'yeomatthew61@gmail.com';

    console.log('\n================ AUTO-REPLY PREVIEW ================');
    console.log(`To       : ${to}`);
    console.log(`Using Safe Recipient: ${SAFE_RECIPIENT}`);
    console.log(`Thread ID: ${threadId || '(none)'}`);
    console.log('--------------------------------------------------');
    console.log(body);
    console.log('==================================================\n');

    // Initialize OAuth2 client with credentials
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        GMAIL_CALLBACK_URL
    );

    // Set user credentials
    oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
        expiry_date: expiryDate,
    });

    console.log("Gmail API scopes:", GMAIL_SCOPES);

    // Refresh token if expired
    if (!expiryDate || Date.now() >= expiryDate) {
        const newToken = await oauth2Client.getAccessToken();
        if (newToken?.token) {
            accessToken = newToken.token;

            await User.findByIdAndUpdate(userId, {
                'gmail.accessToken': accessToken,
                'gmail.expiryDate': Date.now() + 60 * 60 * 1000, // 1 hour expiry
            });
        }
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // RFC 2822 email format
    const rawMessage = [
        //`To: ${to}`,
        `To: ${SAFE_RECIPIENT}`,
        "Content-Type: text/plain; charset=utf-8",
        "MIME-Version: 1.0",
        "Subject: Re: Application Update",
        "",
        body,
    ].join("\n");

    const encodedMessage = Buffer.from(rawMessage)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

    const res = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
            raw: encodedMessage,
            ...(threadId ? { threadId } : {}),
        },
    });

    console.log("[AUTO-REPLY SENT]");
    console.log(`Message ID : ${res.data.id}`);
    console.log(`Thread ID  : ${res.data.threadId}`);

    return res.data;
}

module.exports = { sendReply };