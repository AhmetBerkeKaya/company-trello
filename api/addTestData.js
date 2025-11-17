// api/addTestData.js
const pool = require('./db');

// Bu script, admin@proaec.com kullanıcısı için
// 1 proje, 1 görev ve 1 toplantı oluşturur.
async function seedData() {
  console.log('Test verisi ekleme scripti başlıyor...');
  
  try {
    // 1. Admin kullanıcısını bul (ID'sini almamız gerek)
    const userRes = await pool.query("SELECT user_id FROM users WHERE email = $1", ['admin@proaec.com.tr']);
    if (userRes.rows.length === 0) {
      console.log('admin@proaec.com kullanıcısı bulunamadı. Lütfen önce "addFirstUser.js" çalıştırın.');
      return;
    }
    const adminUserId = userRes.rows[0].user_id;
    console.log(`Admin kullanıcısı bulundu (ID: ${adminUserId})`);

    // 2. Yeni bir proje oluştur
    const projectRes = await pool.query(
      `INSERT INTO projects (name, description, status, created_by_user_id)
       VALUES ($1, $2, $3, $4)
       RETURNING project_id, name`,
      ['İlk Test Projesi', 'Bu, API tarafından eklenen ilk projedir.', 'active', adminUserId]
    );
    const projectId = projectRes.rows[0].project_id;
    console.log(`Proje oluşturuldu: "${projectRes.rows[0].name}"`);

    // 3. Admin kullanıcısını o projeye "üye" yap (project_users)
    await pool.query(
      `INSERT INTO project_users (project_id, user_id) VALUES ($1, $2)`,
      [projectId, adminUserId]
    );
    console.log('Admin, projeye üye olarak eklendi.');

    // 4. Admin kullanıcısına bir "görev" ata (tasks)
    await pool.query(
      `INSERT INTO tasks (title, description, status, assignee_user_id, project_id)
       VALUES ($1, $2, $3, $4, $5)`,
      ['API Kurulumunu Bitir', 'API için dashboard endpointlerini tamamla.', 'inProgress', adminUserId, projectId]
    );
    console.log('Admin kullanıcısına "inProgress" bir görev atandı.');

    // 5. Bir "yaklaşan toplantı" oluştur
    const meetingRes = await pool.query(
      `INSERT INTO meetings (title, description, start_time, end_time, created_by_user_id)
       VALUES ($1, $2, NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 1 hour', $3)
       RETURNING meeting_id, title`,
      ['API Planlama Toplantısı', 'Yeni API yapısını tartış.', adminUserId]
    );
    const meetingId = meetingRes.rows[0].meeting_id;
    console.log(`Toplantı oluşturuldu: "${meetingRes.rows[0].title}"`);

    // 6. Admin kullanıcısını o toplantıya "katılımcı" yap (meeting_participants)
    await pool.query(
      `INSERT INTO meeting_participants (meeting_id, user_id) VALUES ($1, $2)`,
      [meetingId, adminUserId]
    );
    console.log('Admin, toplantıya katılımcı olarak eklendi.');
    
    console.log('-----------------------------------');
    console.log('✅ Test verisi başarıyla eklendi!');
    console.log('-----------------------------------');

  } catch (error) {
    console.error('Test verisi eklenirken HATA oluştu:', error);
  } finally {
    await pool.end(); // Script bitti, bağlantıyı kapat
  }
}

seedData();