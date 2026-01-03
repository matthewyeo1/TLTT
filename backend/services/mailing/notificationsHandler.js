const { Expo } = require('expo-server-sdk');
const User = require('../../models/User');

async function sendPushNotification(userId, message) {
  const user = await User.findById(userId);
  if (!user?.expoToken?.length) return;

  console.log('Tokens:', user.expoToken);

  const expo = new Expo();
  const messages = [];

  for (const pushToken of user.expoToken) {
    if (!Expo.isExpoPushToken(pushToken)) continue;

    messages.push({
      to: pushToken,
      sound: 'default',
      title: 'Auto-reply sent',
      body: message,
      data: { withSome: 'data' },
    });
  }

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const receipt = await expo.sendPushNotificationsAsync(chunk);
      console.log('Push notification receipt:', receipt);
    } catch (err) {
      console.error('Push notification error:', err);
    }
  }
}

module.exports = { sendPushNotification };
//await sendPushNotification(job.userId, `Your auto-reply to ${job.company} was sent.`);
