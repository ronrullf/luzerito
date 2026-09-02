const { kv } = require('@vercel/kv');
const webpush = require('web-push');

webpush.setVapidDetails(
  'mailto:soporte@luzerito.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
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
      const diffHours = diffMs / (1000 * 60 * 60);

      // Lógica de avisos: si faltan entre 1.8h y 2.2h, avisar "Faltan 2 horas"
      // Como el cron se ejecuta cada hora, podemos redondear
      let title = '';
      let body = '';

      if (diffHours > 1.8 && diffHours <= 2.2) {
        title = '⏳ Faltan 2 horas para el apagón';
        body = `Tu corte de ${config.durationHours}h comienza a las ${config.startTime}. ¡Carga tus baterías!`;
      } else if (diffHours > 0.8 && diffHours <= 1.2) {
        title = '⚠️ Falta 1 hora para el apagón';
        body = 'Desconecta equipos delicados y verifica tu saldo.';
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
