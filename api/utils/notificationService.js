// api/utils/notificationService.js
const pool = require('../db');
const axios = require('axios'); // Nodemailer çöpe, projede zaten olan axios sahnede!

/**
 * Dahili (yardımcı) e-posta gönderme fonksiyonu (Brevo API üzerinden)
 */
const sendEmail = async ({ to, subject, html }) => {
  if (!process.env.BREVO_API_KEY) {
    console.error('E-posta gönderilemedi: BREVO_API_KEY eksik.');
    return;
  }
  
  try {
    // Render duvarını aşan HTTP API İsteği
    await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: { 
          name: 'ProAEC Yönetim Sistemi', 
          email: process.env.EMAIL_USER // .env dosyasındaki Gmail/Kurumsal adresin
        },
        to: [{ email: to }],
        subject: subject,
        htmlContent: html
      },
      {
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`✅ E-posta HTTP API ile gönderildi -> ${to}`);
  } catch (error) {
    console.error(`❌ E-posta gönderme hatası (${to}):`, error.response ? error.response.data : error.message);
  }
};

/**
 * Veritabanına yeni bir bildirim ekler VE e-posta ayarları açıksa e-posta gönderir.
 */
const createNotification = async (client, {
  userId, type, title, message, projectId, taskId, senderId, senderName, link
}) => {
  
  const db = client || pool;

  // --- E-POSTA GÖNDERİM MANTIĞI ---
  try {
    const userRes = await db.query(
      "SELECT email, notification_settings FROM users WHERE user_id = $1",
      [userId]
    );

    if (userRes.rows.length > 0) {
      const user = userRes.rows[0];
      const emailEnabled = user.notification_settings?.email;

      if (emailEnabled && user.email) {
        const emailHtml = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
            
            <div style="background-color: #2563EB; padding: 20px; text-align: center;">
              <h2 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 0.5px;">ProAEC Yönetim Sistemi</h2>
            </div>
            
            <div style="padding: 30px; color: #333333;">
              <p style="font-size: 16px; margin-bottom: 20px;">Merhaba,</p>
              <p style="font-size: 16px; line-height: 1.6; margin-bottom: 30px; color: #4a5568;">
                <strong>${message}</strong>
              </p>
              
              <div style="text-align: center; margin-top: 40px; margin-bottom: 10px;">
                <a href="${process.env.FRONTEND_URL || 'http://www.aecworks.tr'}${link || '/'}" 
                   style="background-color: #2563EB; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 15px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">
                   Detayları Görüntüle
                </a>
              </div>
            </div>
            
            <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb;">
              Bu e-posta ProAEC sistemi tarafından size özel otomatik olarak gönderilmiştir. Lütfen doğrudan yanıtlamayınız.
              <br><br>
              &copy; ${new Date().getFullYear()} PROAEC Yazılım Destek Hizmetleri
            </div>
          </div>
        `;
        
        // Asenkron gönder (sistemi bekletmez)
        sendEmail({
          to: user.email,
          subject: title,
          html: emailHtml
        }); 
      }
    }
  } catch (emailError) {
    console.error('Bildirim (e-posta ön hazırlık) hatası:', emailError);
  }
  // --- E-POSTA MANTIĞI SONU ---

  // --- DB BİLDİRİM MANTIĞI ---
  try {
    const query = `
      INSERT INTO notifications (
        user_id, type, title, message, project_id, task_id, sender_id, sender_name, link
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    await db.query(query, [userId, type, title, message, projectId, taskId, senderId, senderName, link]);
    console.log(`✅ DB Bildirimi oluşturuldu: ${type} -> ${userId}`);
    
  } catch (error) {
    console.error('Bildirim (DB) oluşturma hatası (servis):', error);
  }
};

module.exports = {
  createNotification
};