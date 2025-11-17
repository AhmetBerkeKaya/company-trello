// api/controllers/meetingRequestController.js
const pool = require('../db');
const { createNotification } = require('../utils/notificationService');

// POST /api/meeting-requests
exports.createMeetingRequest = async (req, res) => {
  const {
    title, description, projectId, reason, preferredDate, preferredTime
  } = req.body;
  const { userId: requestedById, name: requestedByName } = req.user;

  // ----- YENİ DOĞRULAMA KONTROLÜ -----
  if (!preferredDate || !preferredTime) {
    return res.status(400).json({ 
      message: 'Toplantı isteği oluşturmak için tarih ve saat belirtmeniz zorunludur.' 
    });
  }
  // ----- YENİ DOĞRULAMA KONTROLÜ SONU -----

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const query = `
      INSERT INTO meeting_requests (
        title, description, project_id, reason, preferred_date,
        preferred_time, requested_by_user_id, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    // preferredDate || null kaldırıldı, çünkü artık zorunlu
    const { rows } = await client.query(query, [
      title, description, projectId, reason, preferredDate,
      preferredTime, requestedById, 'pending'
    ]);

    const newRequest = rows[0];

    const userQuery = `SELECT user_id FROM users WHERE role = 'admin' OR role = 'manager'`;
    const userRows = await client.query(userQuery);
    const recipientIds = userRows.rows.map(r => r.user_id);

    for (const userId of recipientIds) {
      if (userId !== requestedById) {
        await createNotification(client, {
          userId: userId,
          type: 'meeting_request',
          title: `Toplantı İsteği: ${title}`,
          message: `${requestedByName} bir toplantı talebinde bulundu.`,
          projectId: projectId,
          senderId: requestedById,
          senderName: requestedByName,
          link: '/meetings?view=requests'
        });
      }
    }

    await client.query('COMMIT');
    res.status(201).json(newRequest);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Toplantı isteği oluşturma hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  } finally {
    client.release();
  }
};

// GET /api/meeting-requests
exports.getAllMeetingRequests = async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Toplantı isteklerini görme yetkiniz yok' });
  }
  try {
    const query = `
      SELECT 
        mr.*, 
        u.name AS requested_by_name, 
        p.name AS project_name
      FROM meeting_requests mr
      JOIN users u ON mr.requested_by_user_id = u.user_id
      LEFT JOIN projects p ON mr.project_id = p.project_id
      ORDER BY mr.created_at DESC
    `;
    const { rows } = await pool.query(query);
    const requests = rows.map(r => ({ ...r, id: r.request_id }));
    res.status(200).json(requests);
  } catch (error) {
    console.error('Toplantı isteklerini getirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// PUT /api/meeting-requests/:id/approve
exports.approveMeetingRequest = async (req, res) => {
  const { id } = req.params;
  const { userId: approverId, name: approverName, role } = req.user;

  if (role !== 'admin' && role !== 'manager') {
    return res.status(403).json({ message: 'İstek onaylama yetkiniz yok' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1️⃣ İsteği bul ve 'approved' olarak güncelle
    const updateQuery = `
      UPDATE meeting_requests 
      SET status = 'approved', approved_by = $1, approved_at = NOW()
      WHERE request_id = $2 AND status = 'pending'
      RETURNING *
    `;
    const { rows } = await client.query(updateQuery, [approverId, id]);

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'İstek bulunamadı veya zaten işlenmiş' });
    }

    const request = rows[0];

    // ----- BAŞLANGIÇ: HATA DÜZELTMESİ (safeDate) -----
    // (Bu kısım önceki adımlarda düzeltilmişti, aynı kalıyor)
    let safeDate;
    try {
      const d = new Date(request.preferred_date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0'); // getMonth 0-indexlidir
      const day = String(d.getDate()).padStart(2, '0');
      safeDate = `${year}-${month}-${day}`;
    } catch (e) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `Geçersiz tarih formatı: ${request.preferred_date}` });
    }
    // ----- BİTİŞ: HATA DÜZELTMESİ (safeDate) -----

    let safeTime = request.preferred_time;
    if (!safeTime || !/^\d{2}:\d{2}(:\d{2})?$/.test(safeTime)) {
      safeTime = '09:00:00';
    }
    const startTimeString = `${safeDate}T${safeTime}`;
    const startTimeLocal = new Date(startTimeString);
    if (isNaN(startTimeLocal.getTime())) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `Geçersiz tarih veya saat: ${safeDate} ${safeTime}` });
    }
    const endTimeLocal = new Date(startTimeLocal.getTime() + 60 * 60 * 1000); // +1 saat

    // 3️⃣ Proje üyeleri + yöneticiler = katılımcılar
    const projectMembersQuery = `SELECT user_id FROM project_users WHERE project_id = $1`;
    const membersRes = await client.query(projectMembersQuery, [request.project_id]);
    const adminManagerQuery = `SELECT user_id FROM users WHERE role = 'admin' OR role = 'manager'`;
    const managersRes = await client.query(adminManagerQuery);
    const allParticipantIds = [
      ...new Set([
        ...membersRes.rows.map(r => r.user_id),
        ...managersRes.rows.map(r => r.user_id),
        request.requested_by_user_id
      ])
    ];

    // 4️⃣ meetings tablosuna toplantı ekle
    const meetingQuery = `
      INSERT INTO meetings (
        title, description, start_time, end_time, project_id, 
        created_by_user_id, agenda, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING meeting_id
    `;
    const agendaAsJson = JSON.stringify([request.reason]);
    const meetingRes = await client.query(meetingQuery, [
      request.title,
      request.description || `Talep Nedeni: ${request.reason}`,
      startTimeLocal,
      endTimeLocal,
      request.project_id,
      approverId,
      agendaAsJson
    ]);
    const newMeetingId = meetingRes.rows[0].meeting_id;

    // 5️⃣ Katılımcıları ekle
    if (allParticipantIds.length > 0) {
      const participantValues = allParticipantIds
        .map(userId => `('${newMeetingId}', '${userId}')`)
        .join(',');
      await client.query(
        `INSERT INTO meeting_participants (meeting_id, user_id) VALUES ${participantValues}`
      );
    }

    // 6️⃣ Bildirim gönder (TÜM KATILIMCILARA)
    const formattedDate = startTimeLocal.toLocaleDateString('tr-TR');
    const formattedTime = startTimeLocal.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    // ----- BAŞLANGIÇ: YENİ GÜNCELLEME (DÖNGÜ) -----
    // Sadece istek yapana değil, tüm katılımcılara bildirim gönder
    for (const participantId of allParticipantIds) {
      let title, message, type;
      
      // Mesajı kişiye göre özelleştir
      if (participantId === request.requested_by_user_id) {
        // Bu, isteği yapan orijinal kullanıcı
        title = `Toplantı İsteğiniz Onaylandı: ${request.title}`;
        message = `${approverName}, toplantı isteğinizi onayladı. Toplantı ${formattedDate} ${formattedTime} tarihinde yapılacak.`;
        type = 'meeting_approved';
      } else {
        // Bu, toplantıya eklenen diğer proje üyeleri/yöneticiler
        title = `Yeni Toplantı: ${request.title}`;
        message = `${approverName}, ${request.title} başlıklı toplantı talebini onayladı. Toplantı ${formattedDate} ${formattedTime} tarihinde yapılacak.`;
        type = 'meeting_created';
      }

      // Onaylayan kişinin kendisine bildirim göndermesini engelle (opsiyonel ama mantıklı)
      if (participantId === approverId) continue;

      await createNotification(client, {
        userId: participantId, // Döngüdeki mevcut katılımcı
        type: type,
        title: title,
        message: message,
        projectId: request.project_id,
        senderId: approverId,
        senderName: approverName,
        link: '/meetings'
      });
    }
    // ----- BİTİŞ: YENİ GÜNCELLEME (DÖNGÜ) -----


    await client.query('COMMIT');
    res.status(200).json({
      message: 'Toplantı başarıyla oluşturuldu.',
      meetingId: newMeetingId,
      startTime: startTimeLocal.toISOString(),
      endTime: endTimeLocal.toISOString()
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Toplantı isteği onaylama hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  } finally {
    client.release();
  }
};
// PUT /api/meeting-requests/:id/reject
exports.rejectMeetingRequest = async (req, res) => {
  const { id } = req.params;
  const { userId: rejecterId, name: rejecterName, role } = req.user;

  if (role !== 'admin' && role !== 'manager') {
    return res.status(403).json({ message: 'İstek reddetme yetkiniz yok' });
  }

  try {
    const updateQuery = `
      UPDATE meeting_requests 
      SET status = 'rejected', approved_by = $1, approved_at = NOW()
      WHERE request_id = $2 AND status = 'pending'
      RETURNING *
    `;
    const { rows } = await pool.query(updateQuery, [rejecterId, id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'İstek bulunamadı veya zaten işlenmiş' });
    }

    const request = rows[0];

    // İsteği yapana bildirim gönder
    await createNotification(null, {
      userId: request.requested_by_user_id,
      type: 'meeting_rejected',
      title: `Toplantı İsteğiniz Reddedildi: ${request.title}`,
      message: `${rejecterName}, toplantı isteğinizi reddetti.`,
      projectId: request.project_id,
      senderId: rejecterId,
      senderName: rejecterName,
      link: '/meetings'
    });

    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Toplantı isteği reddetme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};