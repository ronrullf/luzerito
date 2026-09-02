const { kv } = require('@vercel/kv');
const webpush = require('web-push');

module.exports = async function handler(req, res) {
  // Configurar llaves en runtime, no en build-time
  webpush.setVapidDetails(
    'mailto:soporte@luzerito.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  // Seguridad: Solo Vercel Cron puede ejecutar esto
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const users = await kv.smembers('luzcontrol_users');
    let notificationsSent = 0;

    for (const userId of users) {
      const data = await kv.get(`user:${userId}`);
      if (!data || !data.config || !data.subscription) continue;

      const { config, subscription } = data;
      const now = new Date();
      
      // Asegurarnos de que el día de hoy está activo para este usuario
      const todayDay = now.getDay();
      if (!config.activeDays.includes(todayDay)) continue;

      let [sh, sm] = config.startTime.split(':').map(Number);
      const cutStart = new Date(now);
      cutStart.setHours(sh, sm, 0, 0);

      // Si el corte fue ayer o ya pasó, lo saltamos por hoy
      if (cutStart < now) continue;

      const diffMs = cutStart.getTime() - now.getTime();
      const diffMinutes = diffMs / (1000 * 60);

      // El cron se ejecuta cada 5 minutos, así que buscamos rangos de 5 min.
      let title = '';
      let body = '';

      if (diffMinutes > 175 && diffMinutes <= 180) {
        title = '⏳ Faltan 3 horas para el apagón';
        body = 'Tip: Ve lavando la ropa y adelantando las comidas antes de que se vaya la luz.';
      } 
      else if (diffMinutes > 115 && diffMinutes <= 120) {
        title = '⏳ Faltan 2 horas para el apagón';
        body = 'Checklist: Pon a cargar teléfonos, powerbanks y bombillos recargables.';
      }
      else if (diffMinutes > 55 && diffMinutes <= 60) {
        title = '⚠️ Falta 1 hora para el apagón';
        body = 'Checklist: Conecta el Mini UPS del módem y verifica tu saldo (Digitel/Movistar).';
      }
      else if (diffMinutes > 25 && diffMinutes <= 30) {
        title = '🚨 Faltan 30 minutos';
        body = 'Tip: Llena tus tobos de agua y guarda todo tu trabajo en la computadora.';
      }
      else if (diffMinutes > 10 && diffMinutes <= 15) {
        title = '⚡ Faltan 15 minutos';
        body = 'Checklist: ¡Es hora de desconectar los protectores AC y la nevera!';
      }
      else if (diffMinutes > 0 && diffMinutes <= 5) {
        title = '🌑 Faltan 5 minutos';
        body = 'El apagón es inminente. Todo debería estar listo. ¡Mantén la calma!';
      }

      if (title) {
        try {
          await webpush.sendNotification(subscription, JSON.stringify({
            title,
            body,
            tag: 'cron-alert'
          }));
          notificationsSent++;
        } catch (e) {
          console.error(`Error sending push to ${userId}:`, e);
          // Si el endpoint expiró, podríamos eliminar al usuario de la DB aquí
          if (e.statusCode === 410) {
            await kv.srem('luzcontrol_users', userId);
            await kv.del(`user:${userId}`);
          }
        }
      }
    }

    return res.status(200).json({ success: true, notificationsSent });
  } catch (error) {
    console.error('Cron job error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
