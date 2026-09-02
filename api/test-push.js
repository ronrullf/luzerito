const { kv } = require('@vercel/kv');
const webpush = require('web-push');

webpush.setVapidDetails(
  'mailto:soporte@luzerito.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

module.exports = async function handler(req, res) {
  try {
    const users = await kv.smembers('luzcontrol_users');
    let sent = 0;

    for (const userId of users) {
      const data = await kv.get(`user:${userId}`);
      if (!data || !data.subscription) continue;

      try {
        await webpush.sendNotification(data.subscription, JSON.stringify({
          title: '🚀 ¡Prueba de Sistema Exitosa!',
          body: 'Tu dispositivo está conectado al Cerebro en la Nube de Vercel.',
          tag: 'test-alert'
        }));
        sent++;
      } catch (e) {
        console.error('Error al enviar:', e);
      }
    }

    return res.status(200).json({ success: true, usersFound: users.length, notificationsSent: sent });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
