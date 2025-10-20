const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();


// Alternatif 2: Gmail SMTP (daha güvenilir)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'ahmetberkekayaproje@gmail.com', // Gmail hesabı
    pass: 'uhahmbjjlnwpftrl' // Gmail App Password
  }
});

// Email gönderme fonksiyonu
exports.sendNotificationEmail = functions.firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snapshot, context) => {
    const notification = snapshot.data();
    
    try {
      console.log('📧 Outlook Email tetiklendi:', notification.type);

      // Kullanıcı bilgilerini getir
      const userDoc = await admin.firestore().collection('users').doc(notification.userId).get();
      if (!userDoc.exists) {
        console.log('Kullanıcı bulunamadı:', notification.userId);
        return null;
      }

      const userData = userDoc.data();
      const userEmail = userData.email;

      if (!userEmail) {
        console.log('Kullanıcı emaili yok:', notification.userId);
        return null;
      }

      // Kullanıcının email tercihlerini kontrol et
      const notificationSettings = userData.notificationSettings || {
        email: true,
        tasks: true,
        meetings: true
      };

      // Email gönderme koşullarını kontrol et
      const shouldSendEmail = 
        notificationSettings.email && // Genel email ayarı
        (
          (notification.type.includes('task') && notificationSettings.tasks) ||
          (notification.type.includes('meeting') && notificationSettings.meetings)
        );

      if (!shouldSendEmail) {
        console.log('📧 Email gönderilmeyecek - kullanıcı tercihi');
        return null;
      }

      // Email içeriğini oluştur
      const emailContent = createEmailContent(notification, userData);
      
      // Email gönder
      const mailOptions = {
        from: '"ProAEC Proje Yönetimi" <proaecworks@proaec.com.tr>',
        to: userEmail,
        subject: emailContent.subject,
        html: emailContent.html
      };

      await transporter.sendMail(mailOptions);
      console.log('✅ Outlook Email gönderildi:', userEmail);

      // Bildirimi email gönderildi olarak işaretle
      await snapshot.ref.update({ 
        emailSent: true,
        emailSentAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return null;
    } catch (error) {
      console.error('❌ Outlook Email gönderme hatası:', error);
      return null;
    }
  });

// Test fonksiyonu - GÜNCELLENDİ
exports.testEmail = functions.https.onRequest(async (req, res) => {
  try {
    const mailOptions = {
      from: '"ProAEC Test" <proaecworks@proaec.com.tr>',
      to: 'ahmetberkekaya04@gmail.com', // Test email adresiniz
      subject: '✅ Test Email - ProAEC System Çalışıyor!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0;">🏢 ProAEC</h1>
            <p style="margin: 10px 0 0 0;">Proje Yönetim Sistemi</p>
          </div>
          <div style="padding: 30px;">
            <h2 style="color: #2563eb;">Test Başarılı! 🎉</h2>
            <p>ProAEC email bildirim sistemi başarıyla çalışıyor.</p>
            <p>Bu email <strong>Outlook/Office 365</strong> üzerinden gönderilmiştir.</p>
            <div style="text-align: center; margin: 25px 0;">
              <a href="https://proaecworks.firebaseapp.com" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                ProAEC'e Git
              </a>
            </div>
          </div>
          <div style="background: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 14px;">
            <p>© 2025 ProAEC Proje Yönetim Sistemi</p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    res.status(200).send('✅ Test email ahmetberkekaya04@gmail.com adresine gönderildi!');
  } catch (error) {
    console.error('Test email hatası:', error);
    res.status(500).send('❌ Test email hatası: ' + error.message);
  }
});

// Email içeriğini oluştur
function createEmailContent(notification, userData) {
  const greeting = `Merhaba ${userData.name},`;
  let content = '';
  let subject = '';

  switch (notification.type) {
    case 'task_assigned':
      subject = `Yeni Görev Atandı: ${notification.taskTitle}`;
      content = `
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #2563eb;">
          <h2 style="color: #2563eb; margin-top: 0;">🎯 Yeni Görev Atandı</h2>
          <p><strong>Görev:</strong> ${notification.taskTitle}</p>
          <p><strong>Proje:</strong> ${notification.projectTitle}</p>
          <p><strong>Açıklama:</strong> ${notification.description || 'Açıklama yok'}</p>
          <p><strong>Atayan:</strong> ${notification.senderName}</p>
        </div>
      `;
      break;

    case 'task_updated':
      subject = `Görev Güncellendi: ${notification.taskTitle}`;
      content = `
        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #0369a1;">
          <h2 style="color: #0369a1; margin-top: 0;">✏️ Görev Güncellendi</h2>
          <p><strong>Görev:</strong> ${notification.taskTitle}</p>
          <p><strong>Durum:</strong> ${notification.status}</p>
          <p><strong>Proje:</strong> ${notification.projectTitle}</p>
          <p><strong>Güncelleyen:</strong> ${notification.senderName}</p>
        </div>
      `;
      break;

    case 'meeting_created':
      const meetingDate = notification.meetingDate ? 
        (typeof notification.meetingDate.toDate === 'function' ? 
          notification.meetingDate.toDate() : new Date(notification.meetingDate)) : 
        new Date();
      subject = `Yeni Toplantı: ${notification.meetingTitle}`;
      content = `
        <div style="background: #faf5ff; padding: 20px; border-radius: 8px; border-left: 4px solid #7c3aed;">
          <h2 style="color: #7c3aed; margin-top: 0;">📅 Yeni Toplantı Daveti</h2>
          <p><strong>Toplantı:</strong> ${notification.meetingTitle}</p>
          <p><strong>Tarih:</strong> ${meetingDate.toLocaleString('tr-TR')}</p>
          <p><strong>Açıklama:</strong> ${notification.description || 'Açıklama yok'}</p>
          <p><strong>Organizatör:</strong> ${notification.senderName}</p>
        </div>
      `;
      break;

    default:
      subject = 'Yeni Bildirim - ProAEC';
      content = `
        <div style="background: #f1f5f9; padding: 20px; border-radius: 8px;">
          <p>Yeni bir bildiriminiz var.</p>
        </div>
      `;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #334155; margin: 0; padding: 0; background: #ffffff; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
        .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 30px 20px; text-align: center; }
        .content { padding: 30px; background: #ffffff; }
        .footer { text-align: center; padding: 25px; color: #64748b; font-size: 14px; background: #f8fafc; border-top: 1px solid #e2e8f0; }
        .button { background: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; margin: 20px 0; }
        .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🏢 ProAEC</div>
          <p>Proje Yönetim Sistemi</p>
        </div>
        <div class="content">
          <p>${greeting}</p>
          ${content}
          <div style="text-align: center; margin-top: 25px;">
            <a href="https://proaecworks.firebaseapp.com${notification.link}" class="button">
              🔍 Detayları Görüntüle
            </a>
          </div>
        </div>
        <div class="footer">
          <p>Bu e-posta otomatik olarak gönderilmiştir. Lütfen cevap vermeyin.</p>
          <p><strong>© 2025 ProAEC Proje Yönetim Sistemi</strong></p>
          <p style="font-size: 12px; color: #94a3b8;">ProAEC Works - Tüm hakları saklıdır.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}