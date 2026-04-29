const { Expo } = require('expo-server-sdk');
const expo = new Expo();

const sendPushNotification = async (expoPushToken, title, body, data = {}) => {
  if (!expoPushToken || !Expo.isExpoPushToken(expoPushToken)) return;
  try {
    await expo.sendPushNotificationsAsync([{
      to: expoPushToken,
      sound: 'default',
      title,
      body,
      data,
      badge: 1,
    }]);
  } catch (error) {
    console.error('Push notification error:', error);
  }
};

module.exports = { sendPushNotification };
