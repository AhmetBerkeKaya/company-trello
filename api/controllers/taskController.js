// api/controllers/taskController.js
const pool = require('../db');
const { createNotification } = require('../utils/notificationService');

// GET /api/tasks/my
exports.getMyTasks = async (req, res) => {
  const userId = req.user.userId;
  const companyId = req.user.companyId;

  try {
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

// POST /api/tasks (Müşteri Görünürlüğü Eklendi)
exports.createTask = async (req, res) => {
  const { title, status, projectId, assignee, planFileId, pinX, pinY, isVisibleToClient } = req.body;
  const { userId: createdByUserId, name: createdByName } = req.user;
  const finalAssignee = assignee || createdByUserId;

  try {
    const query = `
      INSERT INTO tasks (
        title, description, status, project_id, assignee_user_id, created_by_user_id,
        plan_file_id, pin_x, pin_y, is_visible_to_client
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [
      title, 
      '', // Açıklama başlangıçta boş
      status, 
      projectId, 
      finalAssignee, 
      createdByUserId,
      planFileId || null, 
      pinX || null, 
      pinY || null,
      isVisibleToClient || false // Varsayılan: Müşteri göremez
    ]);

    const newTask = { ...rows[0], id: rows[0].task_id };

    // Bildirim Gönderimi
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

// PUT /api/tasks/:taskId (Detay ve Müşteri Görünürlüğü Güncelleme)
exports.updateTaskDetails = async (req, res) => {
  const { taskId } = req.params;
  const { title, description, assignee: newAssignee, dueDate, isVisibleToClient } = req.body;
  const { userId: updaterId, name: updaterName, role } = req.user; // companyId'yi sildik

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // GÜVENLİK DÜZELTME: Şirket kontrolünü (p.company_id) kaldırdık.
    // Proje bilgilerini de çekiyoruz ki yetki kontrolü yapabilelim.
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

    // YETKİ KONTROLÜ:
    // 1. Admin veya Manager (Genel Yetki)
    // 2. Görevi OLUŞTURAN kişi
    // 3. Projeyi OLUŞTURAN kişi
    // 4. Proje Yöneticisi
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
        updated_at = NOW()
      WHERE task_id = $6 
      RETURNING *
    `;
    const updateRes = await client.query(updateQuery, [
      title, description, newAssignee || null, dueDate || null, isVisibleToClient, taskId
    ]);
    const updatedTask = updateRes.rows[0];

    // Atama Bildirimleri (Aynen kalıyor)
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

// PUT /api/tasks/:taskId/location (Pin Taşıma - Değişmedi)
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

// PUT /api/tasks/:taskId/status (Sütun Değiştirme - Değişmedi)
exports.updateTaskStatus = async (req, res) => {
  const { taskId } = req.params;
  const { status } = req.body;
  const { userId, name, role } = req.user;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Şirket kontrolü kalktı
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

    // YETKİ: Atanan kişi de durum değiştirebilir, Yönetici de.
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
    
    // Bildirim (Aynen kalıyor)
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

// DELETE /api/tasks/:taskId (Silme - Değişmedi)
exports.deleteTask = async (req, res) => {
  const { taskId } = req.params;
  const { userId, role, name: deleterName } = req.user;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Şirket kontrolü kalktı
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

    // YETKİ: Admin, Manager, Görevi Oluşturan, Projeyi Oluşturan veya Proje Yöneticisi
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

    // Bildirim (Aynen kalıyor)
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

// GET /api/projects/:projectId/tasks (GÜNCELLENDİ: Müşteri Filtresi!)
// projectController.js'den buraya taşınmadıysa bile, oradaki mantığı buraya taşıman mantıklı olabilir
// veya projectController'daki getTasksForProject fonksiyonunu güncellemelisin.
// Bu fonksiyon taskController'da yoksa, projectController'daki fonksiyonu güncellemelisin.
// NOT: Genelde /api/projects/:id/tasks rotası projectController'a gider. 
// Eğer öyleyse projectController.js'deki getTasksForProject'i şu şekilde güncellemen gerekir:

/*
exports.getTasksForProject = async (req, res) => {
  const { projectId } = req.params;
  const { companyId, role } = req.user;

  try {
    const checkQuery = 'SELECT 1 FROM projects WHERE project_id = $1 AND company_id = $2';
    const checkRes = await pool.query(checkQuery, [projectId, companyId]);
    if (checkRes.rows.length === 0) return res.status(404).json({message: 'Proje bulunamadı'});

    let query = `SELECT * FROM tasks WHERE project_id = $1`;
    
    // GÜVENLİK: Eğer kullanıcı 'client' ise, sadece ona açık görevleri getir
    if (role === 'client') {
       query += ` AND is_visible_to_client = true`;
    }

    query += ` ORDER BY created_at ASC`;

    const { rows } = await pool.query(query, [projectId]);
    const tasks = rows.map(task => ({ ...task, id: task.task_id }));
    res.status(200).json(tasks);
  } catch (error) { ... }
};
*/