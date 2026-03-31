// api/controllers/meetingController.js
const pool = require('../db');
// (Bildirim servisini 10. Adım'da eklemiştik,
// ama toplantılar için henüz kullanmıyoruz, o yüzden şimdilik import etmeye gerek yok)
const { createNotification } = require('../utils/notificationService');
// GET /api/meetings (Meetings.js için - TÜMÜ)
exports.getMyAllMeetings = async (req, res) => {
  const userId = req.user.userId;

  try {
    // Bu sorgu, proje adını ve katılımcı listesini (JSON) çeker
    const query = `
      SELECT 
        m.*, 
        p.name AS project_name,
        (SELECT json_agg(json_build_object('user_id', u.user_id, 'name', u.name))
         FROM users u
         JOIN meeting_participants mp_inner ON u.user_id = mp_inner.user_id
         WHERE mp_inner.meeting_id = m.meeting_id
        ) AS participants_list
      FROM meetings m
      JOIN meeting_participants mp ON m.meeting_id = mp.meeting_id
      LEFT JOIN projects p ON m.project_id = p.project_id
      WHERE mp.user_id = $1
      GROUP BY m.meeting_id, p.name -- Her toplantıyı tekilleştir
      ORDER BY m.start_time ASC
    `;
    
    const { rows } = await pool.query(query, [userId]);
    
    const meetings = rows.map(m => ({
      ...m,
      id: m.meeting_id,
      participants: m.participants_list || [] // JSON dizisini 'participants'a ata
    }));
    
    res.status(200).json(meetings);
  } catch (error) {
    console.error('Tüm toplantıları getirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// GET /api/meetings/upcoming (Dashboard.js için - YAKLAŞANLAR)
// (Bu fonksiyon bir önceki adımda silinmişti, şimdi geri ekliyoruz)
exports.getMyUpcomingMeetings = async (req, res) => {
  const userId = req.user.userId;

  try {
    // Yukarıdaki sorgunun AYNISI, sadece 'AND m.start_time > NOW()' filtresi var
    const query = `
      SELECT 
        m.*, 
        p.name AS project_name,
        (SELECT json_agg(json_build_object('user_id', u.user_id, 'name', u.name))
         FROM users u
         JOIN meeting_participants mp_inner ON u.user_id = mp_inner.user_id
         WHERE mp_inner.meeting_id = m.meeting_id
        ) AS participants_list
      FROM meetings m
      JOIN meeting_participants mp ON m.meeting_id = mp.meeting_id
      LEFT JOIN projects p ON m.project_id = p.project_id
      WHERE mp.user_id = $1 AND m.start_time > NOW() -- Tek fark bu satır
      GROUP BY m.meeting_id, p.name
      ORDER BY m.start_time ASC
    `;
    
    const { rows } = await pool.query(query, [userId]);
    
    const meetings = rows.map(m => ({
      ...m,
      id: m.meeting_id,
      participants: m.participants_list || []
    }));
    
    res.status(200).json(meetings);
  } catch (error) {
    console.error('Yaklaşan toplantıları getirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};


exports.createMeeting = async (req, res) => {
  const {
    title, description, startTime, endTime, location,
    meetingLink, projectId, participants, agenda
  } = req.body;
  const { userId: organizerId, name: organizerName } = req.user;

  // 'participants' dizisinin organizatörü içerdiğinden emin ol
  const allParticipantIds = [...new Set([...participants, organizerId])];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const meetingQuery = `
      INSERT INTO meetings (
        title, description, start_time, end_time, location,
        meeting_link, project_id, created_by_user_id, agenda
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING meeting_id, created_at, start_time
    `;
    
    // DÜZELTİLEN KISIM: agenda yerine JSON.stringify(agenda || []) eklendi
    const meetingRes = await client.query(meetingQuery, [
      title, description, startTime, endTime, location,
      meetingLink, projectId || null, organizerId, JSON.stringify(agenda || []) 
    ]);
    
    const newMeetingId = meetingRes.rows[0].meeting_id;
    const newMeetingStartTime = meetingRes.rows[0].start_time;

    // 2. 'meeting_participants' tablosuna katılımcıları ekle
    if (allParticipantIds.length > 0) {
      const participantValues = allParticipantIds.map(userId => `('${newMeetingId}', '${userId}')`).join(',');
      const participantQuery = `
        INSERT INTO meeting_participants (meeting_id, user_id)
        VALUES ${participantValues}
      `;
      await client.query(participantQuery);
    }

    // 3. Katılımcılara bildirim gönder (organizatör hariç)
    for (const userId of allParticipantIds) {
      if (userId !== organizerId) {
        await createNotification(client, {
          userId: userId,
          type: 'meeting_created',
          title: `Yeni Toplantı: ${title}`,
          message: `${organizerName} sizi bir toplantıya davet etti.`,
          projectId: projectId || null,
          senderId: organizerId,
          senderName: organizerName,
          link: '/meetings'
        });
      }
    }
    
    await client.query('COMMIT');
    
    res.status(201).json({
      ...meetingRes.rows[0],
      id: newMeetingId
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Toplantı oluşturma hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  } finally {
    client.release();
  }
};

// PUT /api/meetings/:meetingId
// (Mevcut bir toplantıyı günceller)
exports.updateMeeting = async (req, res) => {
  const { meetingId } = req.params;
  const {
    title, description, startTime, endTime, location,
    meetingLink, projectId, participants, agenda
  } = req.body;
  const { userId: updaterId, name: updaterName, role } = req.user; // updaterName eklendi

  // Güncellemeyi yapanı da katılımcı listesine dahil et
  const allParticipantIds = [...new Set([...participants, updaterId])];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Yetki kontrolü (sadece admin, manager veya oluşturan)
    const meetingQuery = `SELECT created_by_user_id FROM meetings WHERE meeting_id = $1 FOR UPDATE`;
    const meetingRes = await client.query(meetingQuery, [meetingId]);
    if (meetingRes.rows.length === 0) {
      return res.status(404).json({ message: 'Toplantı bulunamadı' });
    }
    
    const canEdit = role === 'admin' || role === 'manager' || meetingRes.rows[0].created_by_user_id === updaterId;
    if (!canEdit) {
      return res.status(403).json({ message: 'Bu toplantıyı düzenleme yetkiniz yok' });
    }

    // 2. Ana toplantı kaydını güncelle
    const updateMeetingQuery = `
      UPDATE meetings
      SET
        title = $1, description = $2, start_time = $3, end_time = $4,
        location = $5, meeting_link = $6, project_id = $7, agenda = $8,
        updated_at = NOW()
      WHERE meeting_id = $9
      RETURNING *
    `;
    
    // DÜZELTİLEN KISIM: agenda yerine JSON.stringify(agenda || []) eklendi
    await client.query(updateMeetingQuery, [
      title, description, startTime, endTime, location,
      meetingLink, projectId || null, JSON.stringify(agenda || []), meetingId
    ]);

    // 3. Katılımcıları güncelle (Eskileri sil, yenileri ekle)
    await client.query('DELETE FROM meeting_participants WHERE meeting_id = $1', [meetingId]);
    if (allParticipantIds.length > 0) {
      const participantValues = allParticipantIds.map(userId => `('${meetingId}', '${userId}')`).join(',');
      const participantQuery = `
        INSERT INTO meeting_participants (meeting_id, user_id)
        VALUES ${participantValues}
      `;
      await client.query(participantQuery);
    }
    
    // ----- BAŞLANGIÇ: YENİ GÜNCELLEME (TODO Düzeltmesi) -----
    // Katılımcılara 'toplantı güncellendi' bildirimi gönder
    for (const participantId of allParticipantIds) {
      // Güncellemeyi yapan kişiye bildirim gönderme
      if (participantId === updaterId) continue;

      await createNotification(client, {
        userId: participantId,
        type: 'meeting_updated',
        title: `Toplantı Güncellendi: ${title}`,
        message: `${updaterName}, katıldığınız bir toplantının detaylarını veya katılımcı listesini güncelledi.`,
        projectId: projectId || null,
        senderId: updaterId,
        senderName: updaterName,
        link: '/meetings'
      });
    }
    // ----- BİTİŞ: YENİ GÜNCELLEME (TODO Düzeltmesi) -----

    await client.query('COMMIT');
    res.status(200).json({ message: 'Toplantı güncellendi' });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Toplantı güncelleme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  } finally {
    client.release();
  }
};