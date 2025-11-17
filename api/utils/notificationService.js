// api/utils/notificationService.js
const pool = require('../db');
const nodemailer = require('nodemailer');

// 1. Nodemailer Taşıyıcısını Oluştur
// .env dosyasındaki değişkenleri kullanır
let transporter;
try {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT == 465, // Port 465 için true, diğerleri için false
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  transporter.verify(function (error, success) {
    if (error) {
      console.error('SMTP Bağlantı Hatası (Nodemailer):', error);
    } else {
      console.log('✅ Nodemailer (SMTP) Sunucusu Bağlantısı Başarılı.');
    }
  });

} catch (e) {
  console.error('Nodemailer Transport oluşturulamadı:', e);
}


/**
 * Dahili (yardımcı) e-posta gönderme fonksiyonu
 */
const sendEmail = async ({ to, subject, html }) => {
  if (!transporter) {
    console.error('E-posta gönderilemedi: Transporter ayarlanmamış.');
    return;
  }
  
  const mailOptions = {
    from: process.env.EMAIL_FROM, // .env'den gelen gönderici adı
    to: to,
    subject: subject,
    html: html,
  };

  try {
    let info = await transporter.sendMail(mailOptions);
    console.log(`E-posta gönderildi: ${info.messageId} -> ${to}`);
  } catch (error) {
    console.error(`E-posta gönderme hatası (${to}):`, error);
  }
};

/**
 * Veritabanına yeni bir bildirim ekler VE e-posta ayarları açıksa e-posta gönderir.
 */
const createNotification = async (client, {
  userId,
  type,
  title,
  message,
  projectId,
  taskId,
  senderId,
  senderName,
  link
}) => {
  
  // Eğer bir veritabanı 'transaction'ı içindeysek 'client'ı,
  // değilsek 'pool'u kullan.
  const db = client || pool;

  // --- E-POSTA GÖNDERİM MANTIĞI (YENİ) ---
  try {
    // 1. Kullanıcının e-posta ve ayarlarını al
    const userRes = await db.query(
      "SELECT email, notification_settings FROM users WHERE user_id = $1",
      [userId]
    );

    if (userRes.rows.length > 0) {
      const user = userRes.rows[0];
      
      // 2. Ayarları kontrol et (JSONB'deki 'email' alanı)
      const emailEnabled = user.notification_settings?.email;

      if (emailEnabled && user.email) {
        // 3. E-postayı gönder (Asenkron - bekleme yapma)
        const emailHtml = `
          <p>Merhaba,</p>
          <p>${message}</p>
          <p>Detaylar için <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}${link || '/'}">uygulamaya gidin</a>.</p>
        `;
        
        sendEmail({
          to: user.email,
          subject: title,
          html: emailHtml
        }); // .catch() bloğu sendEmail içinde yönetiliyor
        
      } else {
        console.log(`E-posta gönderimi kapalı veya e-posta yok: ${userId}`);
      }
    }
  } catch (emailError) {
    console.error('Bildirim (e-posta) hatası:', emailError);
    // E-posta başarısız olsa bile DB bildirimine devam et
  }
  // --- E-POSTA MANTIĞI SONU ---


  // --- DB BİLDİRİM MANTIĞI (MEVCUT) ---
  try {
    const query = `
      INSERT INTO notifications (
        user_id, type, title, message, project_id, task_id, sender_id, sender_name, link
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    await db.query(query, [
      userId,
      type,
      title,
      message,
      projectId,
      taskId,
      senderId,
      senderName,
      link
    ]);
    
    console.log(`✅ DB Bildirimi oluşturuldu: ${type} -> ${userId}`);
    
  } catch (error) {
    // Bildirim hatası ana işlemi (örn: görev oluşturma) durdurmamalı.
    console.error('Bildirim (DB) oluşturma hatası (servis):', error);
  }
};

module.exports = {
  createNotification
};