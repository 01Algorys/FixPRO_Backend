let _Expo = null;
const getExpo = async () => {
  if (!_Expo) {
    const mod = await import('expo-server-sdk');
    _Expo = mod.Expo;
  }
  return _Expo;
};

const sendPushNotification = async (expoPushToken, title, body, data = {}) => {
  const Expo = await getExpo();
  const expo = new Expo();
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
