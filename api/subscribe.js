const { kv } = require('@vercel/kv');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { userId, subscription, config } = req.body;
    
    if (!userId || !subscription || !config) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Guardar al usuario en un "Set" de Redis para poder iterar sobre ellos luego
    await kv.sadd('luzcontrol_users', userId);

    // Guardar los detalles del usuario
    await kv.set(`user:${userId}`, {
      subscription,
      config,
      updatedAt: new Date().toISOString()
    });

    return res.status(200).json({ success: true, message: 'Subscription saved to cloud' });
  } catch (error) {
    console.error('Error saving subscription:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
