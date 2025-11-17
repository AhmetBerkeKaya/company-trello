// api/controllers/taskController.js
const pool = require('../db');
const { PROJECT_TYPES } = require('../utils/constants');
const { createNotification } = require('../utils/notificationService'); // YENİ


// GET /api/tasks/my
// (Atananı 'ben' olan görevleri getirir)
exports.getMyTasks = async (req, res) => {
  const userId = req.user.userId;

  try {
    // Dashboard.js'teki 'assignee == userData.id' sorgusu
    const query = `
      SELECT * FROM tasks
      WHERE assignee_user_id = $1
      ORDER BY created_at DESC
    `;
    
    const { rows } = await pool.query(query, [userId]);
    
    res.status(200).json(rows);
  } catch (error) {
    console.error('Görev getirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};
// POST /api/tasks (YENİ: Bildirim eklendi)
exports.createTask = async (req, res) => {
  const { title, status, projectId, assignee } = req.body;
  const { userId: createdByUserId, name: createdByName } = req.user;
  const finalAssignee = assignee || createdByUserId;

  try {
    const query = `
      INSERT INTO tasks (title, description, status, project_id, assignee_user_id, created_by_user_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const { rows } = await pool.query(query, [
      title, '', status, projectId, finalAssignee, createdByUserId
    ]);

    const newTask = { ...rows[0], id: rows[0].task_id };

    // --- YENİ BİLDİRİM MANTIĞI ---
    // Eğer görevi oluşturan kişi, atanan kişiden farklıysa, atanan kişiye bildir
    if (finalAssignee !== createdByUserId) {
      await createNotification(null, { // Transaction'da değiliz, 'null' yolla
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
    // --- BİLDİRİM SONU ---
    
    res.status(201).json(newTask);
  } catch (error) {
    console.error('Görev oluşturma hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// PUT /api/tasks/:taskId (YENİ: Bildirim eklendi)
exports.updateTaskDetails = async (req, res) => {
  const { taskId } = req.params;
  const { title, description, assignee: newAssignee, dueDate } = req.body;
  const { userId: updaterId, name: updaterName, role } = req.user;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const taskQuery = `
      SELECT created_by_user_id, assignee_user_id 
      FROM tasks 
      WHERE task_id = $1 
      FOR UPDATE
    `;
    const taskRes = await client.query(taskQuery, [taskId]);

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

    // --- YENİ BİLDİRİM MANTIĞI ---
    // 1. Atanan kişi değiştiyse YENİ atanan kişiye bildir
    if (newAssignee && newAssignee !== oldAssignee && newAssignee !== updaterId) {
      await createNotification(client, { // Transaction içindeyiz, 'client' yolla
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
    // 2. Atanan kişi değişmediyse AMA hala varsa ve güncelleyen kişi değilse, 'güncellendi' diye bildir
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
    // --- BİLDİRİM SONU ---
    
    await client.query('COMMIT');
    res.status(200).json({ ...updatedTask, id: updatedTask.task_id });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Görev detay güncelleme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  } finally {
    client.release();
  }
};

// PUT /api/tasks/:taskId/status (YENİ: Bildirim eklendi)
exports.updateTaskStatus = async (req, res) => {
  const { taskId } = req.params;
  const { status } = req.body;
  const { userId, name, role } = req.user;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const taskQuery = `
      SELECT assignee_user_id, title, project_id 
      FROM tasks 
      WHERE task_id = $1 
      FOR UPDATE
    `;
    const taskRes = await client.query(taskQuery, [taskId]);

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
    
    // --- YENİ BİLDİRİM MANTIĞI ---
    // Eğer sürükleyen kişi, atanan kişi değilse, atanan kişiye bildir
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
    // --- BİLDİRİM SONU ---

    await client.query('COMMIT');
    res.status(200).json({ ...updateRes.rows[0], id: updateRes.rows[0].task_id });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Görev durumu güncelleme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  } finally {
    client.release();
  }
};


// api/controllers/taskController.js
exports.deleteTask = async (req, res) => {
  const { taskId } = req.params;
  const { userId, role, name: deleterName } = req.user;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Görevi al (yetki kontrolü VE bildirim için)
    const taskQuery = `
      SELECT created_by_user_id, assignee_user_id, title, project_id 
      FROM tasks 
      WHERE task_id = $1 
      FOR UPDATE
    `;
    const taskRes = await client.query(taskQuery, [taskId]);

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

    // ----- BAŞLANGIÇ: MANTIKSAL DÜZELTME -----
    // ÖNCE BİLDİRİMİ GÖNDER, SONRA SİL.
    
    // 2. Bildirim Mantiği (Silmeden Hemen Önce)
    if (task.assignee_user_id && task.assignee_user_id !== userId) { 
      await createNotification(client, {
        userId: task.assignee_user_id,
        type: 'task_deleted',
        title: `Görev Silindi: ${task.title}`,
        message: `${deleterName}, size atanmış olan "${task.title}" başlıklı görevi sildi.`,
        projectId: task.project_id,
        // Dikkat: Linki '/projects/...' olarak bırakıyoruz, ancak
        // bildirim eklendiği AN task_id HÂLÂ 'tasks' tablosunda olduğu için
        // 'foreign key' hatası almayacağız.
        taskId: taskId, 
        senderId: userId,
        senderName: deleterName,
        link: `/projects/${task.project_id}`
      });
    }

    // 3. Görevi SİL
    // 'ON DELETE CASCADE' kuralları yorumları ve dosyaları da silecektir.
    await client.query('DELETE FROM tasks WHERE task_id = $1', [taskId]);
    
    // ----- BİTİŞ: MANTIKSAL DÜZELTME -----

    await client.query('COMMIT');
    
    res.status(204).send(); // Başarılı
    
  } catch (error) {
    // Hata createNotification'dan gelse bile (ki gelmemeli),
    // ROLLBACK tüm işlemi (silme dahil) geri alacaktır.
    await client.query('ROLLBACK');
    console.error('Görev silme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  } finally {
    client.release();
  }
};