// api/controllers/notificationController.js
const pool = require('../db');

// GET /api/notifications
// (Giriş yapmış kullanıcının bildirimlerini getirir - Navbar.js için)
exports.getNotifications = async (req, res) => {
  const userId = req.user.userId;

  try {
    const query = `
      SELECT * FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
    const { rows } = await pool.query(query, [userId]);

    const notifications = rows.map(n => ({
      ...n,
      id: n.notification_id
    }));
    
    res.status(200).json(notifications);
  } catch (error) {
    console.error('Bildirimleri getirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// POST /api/notifications/:id/read
// (Tek bir bildirimi okundu olarak işaretler)
exports.markNotificationAsRead = async (req, res) => {
  const { notificationId } = req.params;
  const userId = req.user.userId;

  try {
    const query = `
      UPDATE notifications
      SET read = true, read_at = NOW()
      WHERE notification_id = $1 AND user_id = $2
      RETURNING *
    `;
    const { rows } = await pool.query(query, [notificationId, userId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Bildirim bulunamadı veya size ait değil' });
    }
    
    res.status(200).json({ ...rows[0], id: rows[0].notification_id });
  } catch (error) {
    console.error('Bildirim okuma hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// POST /api/notifications/read-all
// (Tüm bildirimleri okundu olarak işaretler)
exports.markAllNotificationsAsRead = async (req, res) => {
  const userId = req.user.userId;

  try {
    const query = `
      UPDATE notifications
      SET read = true, read_at = NOW()
      WHERE user_id = $1 AND read = false
    `;
    await pool.query(query, [userId]);
    
    res.status(200).json({ message: 'Tüm bildirimler okundu' });
  } catch (error) {
    console.error('Tüm bildirimleri okuma hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};