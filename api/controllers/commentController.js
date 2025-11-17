// api/controllers/commentController.js
const pool = require('../db');
const { createNotification } = require('../utils/notificationService'); // DÜZELTME: EKSİK OLAN SATIR

// GET /api/tasks/:taskId/comments
exports.getCommentsForTask = async (req, res) => {
  const { taskId } = req.params;
  try {
    const query = `
      SELECT * FROM comments 
      WHERE task_id = $1 
      ORDER BY created_at ASC
    `;
    const { rows } = await pool.query(query, [taskId]);

    const comments = rows.map(c => ({
      ...c,
      id: c.comment_id
    }));
    
    res.status(200).json(comments);
  } catch (error) {
    console.error('Yorumları getirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// POST /api/tasks/:taskId/comments (Bildirim mantığı dahil)
exports.addCommentToTask = async (req, res) => {
  const { taskId } = req.params;
  const { text, projectId } = req.body;
  const { userId: commenterId, name: commenterName, role: commenterRole } = req.user;

  try {
    // 1. Görevin sahibini (assignee) ve proje yöneticisini bul
    const taskQuery = `
      SELECT t.assignee_user_id, t.title, p.project_manager
      FROM tasks t
      JOIN projects p ON t.project_id = p.project_id
      WHERE t.task_id = $1
    `;
    const taskRes = await pool.query(taskQuery, [taskId]);
    if (taskRes.rows.length === 0) {
      return res.status(404).json({ message: 'İlişkili görev bulunamadı' });
    }
    const task = taskRes.rows[0];

    // 2. Yorumu veritabanına ekle
    const query = `
      INSERT INTO comments (text, task_id, project_id, created_by_user_id, user_info_name, user_info_role)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const { rows } = await pool.query(query, [
      text, taskId, projectId, commenterId, commenterName, commenterRole
    ]);

    const newComment = { ...rows[0], id: rows[0].comment_id };
    
    // --- BİLDİRİM MANTIĞI ---
    const recipients = new Set();
    
    // 1. Görevin sahibini ekle (eğer varsa ve yorumu yapan kişi değilse)
    if (task.assignee_user_id && task.assignee_user_id !== commenterId) {
      recipients.add(task.assignee_user_id);
    }
    
    // 2. Projenin yöneticisini ekle (eğer varsa ve yorumu yapan kişi değilse)
    if (task.project_manager && task.project_manager !== commenterId) {
      recipients.add(task.project_manager);
    }
    
    // 3. Bu kişilere bildirim yolla
    for (const userId of recipients) {
      await createNotification(null, {
        userId: userId,
        type: 'comment_added',
        title: `Yeni Yorum: ${task.title}`,
        message: `${commenterName}, ilgili olduğunuz bir göreve yorum yaptı.`,
        projectId: projectId,
        taskId: taskId,
        senderId: commenterId,
        senderName: commenterName,
        link: `/projects/${projectId}`
      });
    }
    // --- BİLDİRİM SONU ---
    
    res.status(201).json(newComment);
  } catch (error) {
    console.error('Yorum ekleme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};