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
  const { userId: commenterId, name: commenterName } = req.user;

  try {
    const taskQuery = `
      SELECT t.assignee_user_id, t.title, p.project_manager
      FROM tasks t
      JOIN projects p ON t.project_id = p.project_id
      WHERE t.task_id = $1
    `;
    const taskRes = await pool.query(taskQuery, [taskId]);
    if (taskRes.rows.length === 0) return res.status(404).json({ message: 'Görev bulunamadı' });
    const task = taskRes.rows[0];

    const query = `
      INSERT INTO comments (text, task_id, project_id, created_by_user_id, user_info_name)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `;
    const { rows } = await pool.query(query, [text, taskId, projectId, commenterId, commenterName]);
    const newComment = { ...rows[0], id: rows[0].comment_id };

    // Bildirim gönderimi
    if (task.assignee_user_id && task.assignee_user_id !== commenterId) {
      await createNotification(null, {
        userId: task.assignee_user_id,
        type: 'comment_added',
        title: `Yeni Yorum: ${task.title}`,
        message: `${commenterName} bir yorum yaptı.`,
        projectId, taskId, senderId: commenterId, senderName: commenterName, link: `/projects/${projectId}`
      });
    }
    
    res.status(201).json(newComment);
  } catch (error) {
    console.error('Yorum hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};