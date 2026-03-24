// api/controllers/taskController.js
const pool = require('../db');
const { createNotification } = require('../utils/notificationService');

// GET /api/tasks/my
// GET /api/tasks/my
exports.getMyTasks = async (req, res) => {
  const userId = req.user.userId;

  try {
    // YENİ: pc.phase_id eklendi, böylece görev hangi disiplinde bilebileceğiz
    const query = `
      SELECT t.*, p.name as project_name, p.project_code, pc.phase_id
      FROM tasks t
      JOIN projects p ON t.project_id = p.project_id
      LEFT JOIN project_columns pc ON t.status = pc.column_id::text
      WHERE t.assignee_user_id = $1
      ORDER BY t.due_date ASC NULLS LAST
    `;
    
    const { rows } = await pool.query(query, [userId]);
    
    const tasks = rows.map(t => ({
        ...t,
        id: t.task_id
    }));
    
    res.status(200).json(tasks);
  } catch (error) {
    console.error('Görev getirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};
// api/controllers/taskController.js içindeki createTask fonksiyonunu bul ve şununla değiştir:

exports.createTask = async (req, res) => {
  const { 
    title, description, status, projectId, assignee, planFileId, 
    pinX, pinY, pin3dData, isVisibleToClient, estimatedCost, actualCost 
  } = req.body; 

  const { userId: createdByUserId, name: createdByName } = req.user;
  const finalAssignee = assignee || createdByUserId;

  try {
    const query = `
      INSERT INTO tasks (
        title, description, status, project_id, assignee_user_id, created_by_user_id,
        plan_file_id, pin_x, pin_y, pin_3d_data, is_visible_to_client,
        estimated_cost, actual_cost
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [
      title, 
      description || '', // DÜZELTİLDİ: Artık açıklamayı veritabanına yazıyor
      status, 
      projectId, 
      finalAssignee, 
      createdByUserId,
      planFileId || null, 
      pinX || null, 
      pinY || null,
      pin3dData || null,
      isVisibleToClient || false,
      estimatedCost || 0,
      actualCost || 0
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

exports.updateTaskDetails = async (req, res) => {
  const { taskId } = req.params;
  const { title, description, assignee: newAssignee, dueDate, isVisibleToClient, estimatedCost, actualCost } = req.body;
  const { userId: updaterId, name: updaterName, role } = req.user;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const taskQuery = `
      SELECT t.created_by_user_id, t.assignee_user_id, t.project_id, 
             p.created_by_user_id as project_creator_id, p.project_manager
      FROM tasks t
      JOIN projects p ON t.project_id = p.project_id
      WHERE t.task_id = $1
      FOR UPDATE OF t
    `;
    const taskRes = await client.query(taskQuery, [taskId]);

    if (taskRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Görev bulunamadı' });
    }

    const task = taskRes.rows[0];
    const oldAssignee = task.assignee_user_id;

    const canEdit = 
        role === 'admin' || 
        role === 'manager' || 
        task.created_by_user_id === updaterId ||
        task.project_creator_id === updaterId ||
        task.project_manager === updaterId;

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
        is_visible_to_client = COALESCE($5, is_visible_to_client),
        estimated_cost = COALESCE($6, estimated_cost),
        actual_cost = COALESCE($7, actual_cost),
        updated_at = NOW()
      WHERE task_id = $8 
      RETURNING *
    `;
    const updateRes = await client.query(updateQuery, [
      title, description, newAssignee || null, dueDate || null, isVisibleToClient, 
      estimatedCost, actualCost, taskId
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

exports.updateTaskLocation = async (req, res) => {
  const { taskId } = req.params;
  const { pinX, pinY } = req.body;

  try {
    const query = `
      UPDATE tasks 
      SET pin_x = $1, pin_y = $2, updated_at = NOW()
      WHERE task_id = $3
      RETURNING *
    `;
    const { rows } = await pool.query(query, [pinX, pinY, taskId]);

    if (rows.length === 0) return res.status(404).json({ message: 'Görev bulunamadı' });

    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Pin taşıma hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

exports.updateTaskStatus = async (req, res) => {
  const { taskId } = req.params;
  const { status } = req.body; // Bu şu an çirkin bir UUID
  const { userId, name, role } = req.user;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const taskQuery = `
      SELECT t.assignee_user_id, t.title, t.project_id, 
             p.created_by_user_id as project_creator_id, p.project_manager
      FROM tasks t
      JOIN projects p ON t.project_id = p.project_id
      WHERE t.task_id = $1
      FOR UPDATE OF t
    `;
    const taskRes = await client.query(taskQuery, [taskId]);

    if (taskRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Görev bulunamadı' });
    }

    const task = taskRes.rows[0];

    const canMove = 
        task.assignee_user_id === userId || 
        role === 'admin' || 
        role === 'manager' ||
        task.project_creator_id === userId ||
        task.project_manager === userId;

    if (!canMove) {
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
    
    // --- YENİ EKLENEN PROFESYONEL DÜZELTME BAŞLANGICI ---
    // Çirkin UUID'nin gerçek faz (aşama) adını veritabanından çekelim
    let statusName = status; // Varsayılan olarak kalsın (hata olursa sistem çökmesin diye)
    try {
      // DÜZELTİLDİ: Tablo adı 'columns', aranacak sütun 'column_id', isim 'title' yapıldı.
      const columnQuery = `SELECT title FROM project_columns WHERE column_id = $1`; 
      const columnRes = await client.query(columnQuery, [status]);
      if (columnRes.rows.length > 0) {
        statusName = columnRes.rows[0].title; // Çirkin ID, mis gibi "Yapılacaklar" oldu!
      }
    } catch (nameError) {
      console.log('Sütun adı çekilemedi, ID ile devam edilecek:', nameError.message);
    }
    // --- DÜZELTME BİTİŞİ ---

    if (task.assignee_user_id && task.assignee_user_id !== userId) {
      await createNotification(client, {
        userId: task.assignee_user_id,
        type: 'task_updated',
        title: `Görev Durumu Değişti: ${task.title}`,
        // Mesajın içine artık çirkin status'u değil, tertemiz statusName'i koyuyoruz:
        message: `${name}, görevinizin durumunu "${statusName}" olarak değiştirdi.`,
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

exports.deleteTask = async (req, res) => {
  const { taskId } = req.params;
  const { userId, role, name: deleterName } = req.user;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const taskQuery = `
      SELECT t.created_by_user_id, t.assignee_user_id, t.title, t.project_id,
             p.created_by_user_id as project_creator_id, p.project_manager
      FROM tasks t
      JOIN projects p ON t.project_id = p.project_id
      WHERE t.task_id = $1
      FOR UPDATE OF t
    `;
    const taskRes = await client.query(taskQuery, [taskId]);

    if (taskRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Görev bulunamadı' });
    }
    
    const task = taskRes.rows[0];

    const canDelete = 
        role === 'admin' || 
        role === 'manager' || 
        task.created_by_user_id === userId ||
        task.project_creator_id === userId ||
        task.project_manager === userId;

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