// api/utils/scheduler.js
const cron = require('node-cron');
const pool = require('../db');

const initScheduledJobs = () => {
  console.log('🕒 Zamanlanmış görevler başlatıldı...');

  // Her gün sabah 09:00'da çalışır ('0 9 * * *')
  cron.schedule('0 9 * * *', async () => {
    console.log('📅 Günlük görev kontrolü çalışıyor...');

    try {
      // 1. SON GÜNÜ YARIN OLANLARI BUL (Yaklaşan)
      const upcomingQuery = `
        SELECT t.task_id, t.title, t.assignee_user_id, p.name as project_name, p.project_id
        FROM tasks t
        JOIN projects p ON t.project_id = p.project_id
        WHERE t.status != 'completed' 
        AND t.assignee_user_id IS NOT NULL
        AND t.due_date::date = (CURRENT_DATE + INTERVAL '1 day')::date
      `;
      
      const upcomingRes = await pool.query(upcomingQuery);

      for (const task of upcomingRes.rows) {
        await pool.query(
          `INSERT INTO notifications (user_id, title, message, type, link)
           VALUES ($1, $2, $3, 'warning', $4)`,
          [
            task.assignee_user_id,
            'Son Gün Yarın! ⏳',
            `'${task.project_name}' projesindeki '${task.title}' görevinin teslim tarihi yarın.`,
            `/projects/${task.project_id}`
          ]
        );
      }

      // 2. SÜRESİ GEÇMİŞ OLANLARI BUL (Geciken - Sadece bugün gecikmiş gibi işaretlenenler)
      // Sürekli spam yapmamak için sadece due_date'i "dün" olanları alıyoruz.
      const overdueQuery = `
        SELECT t.task_id, t.title, t.assignee_user_id, p.name as project_name, p.project_id
        FROM tasks t
        JOIN projects p ON t.project_id = p.project_id
        WHERE t.status != 'completed'
        AND t.assignee_user_id IS NOT NULL
        AND t.due_date::date = (CURRENT_DATE - INTERVAL '1 day')::date
      `;

      const overdueRes = await pool.query(overdueQuery);

      for (const task of overdueRes.rows) {
        await pool.query(
          `INSERT INTO notifications (user_id, title, message, type, link)
           VALUES ($1, $2, $3, 'error', $4)`,
          [
            task.assignee_user_id,
            'Gecikme Uyarısı 🚨',
            `'${task.title}' görevinin süresi doldu! Lütfen durumu güncelleyin.`,
            `/projects/${task.project_id}`
          ]
        );
      }

      console.log(`✅ Kontrol tamamlandı. ${upcomingRes.rowCount} yaklaşan, ${overdueRes.rowCount} geciken görev bildirildi.`);

    } catch (error) {
      console.error('❌ Scheduler hatası:', error);
    }
  });
};

module.exports = initScheduledJobs;