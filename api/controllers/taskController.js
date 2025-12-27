// api/controllers/taskController.js
const pool = require('../db');
const { PROJECT_TYPES } = require('../utils/constants');
const { createNotification } = require('../utils/notificationService');

// GET /api/tasks/my
exports.getMyTasks = async (req, res) => {
  const userId = req.user.userId;
  const companyId = req.user.companyId;

  try {
    // JOIN İLE GÜVENLİK:
    // Sadece kullanıcının şirketine ait projelerdeki görevleri getir
    const query = `
      SELECT t.* FROM tasks t
      JOIN projects p ON t.project_id = p.project_id
      WHERE t.assignee_user_id = $1 AND p.company_id = $2
      ORDER BY t.created_at DESC
    `;
    
    const { rows } = await pool.query(query, [userId, companyId]);
    
    res.status(200).json(rows);
  } catch (error) {
    console.error('Görev getirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// POST /api/tasks
exports.createTask = async (req, res) => {
  const { title, status, projectId, assignee } = req.body;
  const { userId: createdByUserId, name: createdByName, companyId } = req.user;
  const finalAssignee = assignee || createdByUserId;

  try {
    // 1. GÜVENLİK KONTROLÜ: Görev eklenen proje bu şirkete mi ait?
    const checkQuery = 'SELECT 1 FROM projects WHERE project_id = $1 AND company_id = $2';
    const checkRes = await pool.query(checkQuery, [projectId, companyId]);

    if (checkRes.rows.length === 0) {
      return res.status(403).json({ message: 'Bu projeye görev ekleme yetkiniz yok' });
    }

    const query = `
      INSERT INTO tasks (title, description, status, project_id, assignee_user_id, created_by_user_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const { rows } = await pool.query(query, [
      title, '', status, projectId, finalAssignee, createdByUserId
    ]);

    const newTask = { ...rows[0], id: rows[0].task_id };

    if (finalAssignee !== createdByUserId) {
      await createNotification(null, {
        userId: finalAssignee,
        type: 'task_assigned',
        title: `Yeni Görev: ${title}`,
        message: `${createdByName} size yeni bir görev atadı.`,
        projectId: projectId,
        taskId: newTask.task_id,
        senderId: createdByUserId,
        senderName: createdByName,
        link: `/projects/${projectId}`
      });
    }
    
    res.status(201).json(newTask);
  } catch (error) {
    console.error('Görev oluşturma hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// PUT /api/tasks/:taskId
exports.updateTaskDetails = async (req, res) => {
  const { taskId } = req.params;
  const { title, description, assignee: newAssignee, dueDate } = req.body;
  const { userId: updaterId, name: updaterName, role, companyId } = req.user;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // GÜVENLİK: Proje üzerinden şirket kontrolü
    const taskQuery = `
      SELECT t.created_by_user_id, t.assignee_user_id, t.project_id
      FROM tasks t
      JOIN projects p ON t.project_id = p.project_id
      WHERE t.task_id = $1 AND p.company_id = $2
      FOR UPDATE OF t
    `;
    const taskRes = await client.query(taskQuery, [taskId, companyId]);

    if (taskRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Görev bulunamadı' });
    }

    const task = taskRes.rows[0];
    const oldAssignee = task.assignee_user_id;

    const canEdit = role === 'admin' || role === 'manager' || task.created_by_user_id === updaterId;
    if (!canEdit) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Bu görevi düzenleme yetkiniz yok' });
    }
    
    const updateQuery = `
      UPDATE tasks 
      SET 
        title = $1, 
        description = $2, 
        assignee_user_id = $3, 
        due_date = $4,
        updated_at = NOW()
      WHERE task_id = $5 
      RETURNING *
    `;
    const updateRes = await client.query(updateQuery, [
      title, description, newAssignee || null, dueDate || null, taskId
    ]);
    const updatedTask = updateRes.rows[0];

    if (newAssignee && newAssignee !== oldAssignee && newAssignee !== updaterId) {
      await createNotification(client, {
        userId: newAssignee,
        type: 'task_assigned',
        title: `Görev Atandı: ${title}`,
        message: `${updaterName} size bu görevi atadı.`,
        projectId: updatedTask.project_id,
        taskId: taskId,
        senderId: updaterId,
        senderName: updaterName,
        link: `/projects/${updatedTask.project_id}`
      });
    } 
    else if (newAssignee && newAssignee === oldAssignee && newAssignee !== updaterId) {
       await createNotification(client, {
          userId: newAssignee,
          type: 'task_updated',
          title: `Görev Güncellendi: ${title}`,
          message: `${updaterName} atandığınız bir görevi güncelledi.`,
          projectId: updatedTask.project_id,
          taskId: taskId,
          senderId: updaterId,
          senderName: updaterName,
          link: `/projects/${updatedTask.project_id}`
       });
    }
    
    await client.query('COMMIT');
    res.status(200).json({ ...updatedTask, id: updatedTask.task_id });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Görev güncelleme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  } finally {
    client.release();
  }
};

// PUT /api/tasks/:taskId/status
exports.updateTaskStatus = async (req, res) => {
  const { taskId } = req.params;
  const { status } = req.body;
  const { userId, name, role, companyId } = req.user;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // GÜVENLİK: Proje üzerinden şirket kontrolü
    const taskQuery = `
      SELECT t.assignee_user_id, t.title, t.project_id 
      FROM tasks t
      JOIN projects p ON t.project_id = p.project_id
      WHERE t.task_id = $1 AND p.company_id = $2
      FOR UPDATE OF t
    `;
    const taskRes = await client.query(taskQuery, [taskId, companyId]);

    if (taskRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Görev bulunamadı' });
    }

    const task = taskRes.rows[0];
    const isAssignee = task.assignee_user_id === userId;
    const isManagerOrAdmin = role === 'admin' || role === 'manager';

    if (!isAssignee && !isManagerOrAdmin) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Bu görevi taşıma yetkiniz yok' });
    }
    
    const updateQuery = `
      UPDATE tasks 
      SET status = $1, updated_at = NOW() 
      WHERE task_id = $2 
      RETURNING *
    `;
    const updateRes = await client.query(updateQuery, [status, taskId]);
    
    if (task.assignee_user_id && task.assignee_user_id !== userId) {
      await createNotification(client, {
        userId: task.assignee_user_id,
        type: 'task_updated',
        title: `Görev Durumu Değişti: ${task.title}`,
        message: `${name}, görevinizin durumunu "${status}" olarak değiştirdi.`,
        projectId: task.project_id,
        taskId: taskId,
        senderId: userId,
        senderName: name,
        link: `/projects/${task.project_id}`
      });
    }

    await client.query('COMMIT');
    res.status(200).json({ ...updateRes.rows[0], id: updateRes.rows[0].task_id });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Görev durumu hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  } finally {
    client.release();
  }
};

// DELETE /api/tasks/:taskId
exports.deleteTask = async (req, res) => {
  const { taskId } = req.params;
  const { userId, role, name: deleterName, companyId } = req.user;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // GÜVENLİK: Proje üzerinden şirket kontrolü
    const taskQuery = `
      SELECT t.created_by_user_id, t.assignee_user_id, t.title, t.project_id 
      FROM tasks t
      JOIN projects p ON t.project_id = p.project_id
      WHERE t.task_id = $1 AND p.company_id = $2
      FOR UPDATE OF t
    `;
    const taskRes = await client.query(taskQuery, [taskId, companyId]);

    if (taskRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Görev bulunamadı' });
    }
    
    const task = taskRes.rows[0];
    const canDelete = role === 'admin' || role === 'manager' || task.created_by_user_id === userId;

    if (!canDelete) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Bu görevi silme yetkiniz yok' });
    }

    if (task.assignee_user_id && task.assignee_user_id !== userId) { 
      await createNotification(client, {
        userId: task.assignee_user_id,
        type: 'task_deleted',
        title: `Görev Silindi: ${task.title}`,
        message: `${deleterName}, size atanmış olan "${task.title}" başlıklı görevi sildi.`,
        projectId: task.project_id,
        taskId: taskId, 
        senderId: userId,
        senderName: deleterName,
        link: `/projects/${task.project_id}`
      });
    }

    await client.query('DELETE FROM tasks WHERE task_id = $1', [taskId]);
    
    await client.query('COMMIT');
    
    res.status(204).send();
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Görev silme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  } finally {
    client.release();
  }
};