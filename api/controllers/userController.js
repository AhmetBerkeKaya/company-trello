// api/controllers/userController.js
const pool = require('../db');
const bcrypt = require('bcryptjs');

// GET /api/users (AdminUsers.js için)
exports.getAllUsers = async (req, res) => {
  try {
    const query = `
      SELECT user_id, name, email, role, department, created_at, last_login_at 
      FROM users 
      ORDER BY created_at DESC
    `;
    const { rows } = await pool.query(query);
    const users = rows.map(user => ({ ...user, id: user.user_id }));
    res.status(200).json(users);
  } catch (error) {
    console.error('Tüm kullanıcıları getirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// GET /api/users/role/managers (MeetingRequestModal.js için)
exports.getManagersAndAdmins = async (req, res) => {
  try {
    const query = `
      SELECT user_id, name, email FROM users 
      WHERE role = 'admin' OR role = 'manager'
    `;
    const { rows } = await pool.query(query);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Yöneticileri getirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// GET /api/users/me/stats (Profile.js için)
exports.getUserStats = async (req, res) => {
  const userId = req.user.userId;
  try {
    const projectsQuery = `
      SELECT COUNT(DISTINCT project_id) AS active_projects
      FROM project_users
      WHERE user_id = $1
    `;
    const assignedTasksQuery = `
      SELECT 
        COUNT(*) AS assigned_tasks,
        COUNT(CASE WHEN status = 'done' OR status = 'completed' THEN 1 END) AS completed_tasks
      FROM tasks
      WHERE assignee_user_id = $1
    `;
    const meetingsQuery = `
      SELECT COUNT(DISTINCT meeting_id) AS total_meetings
      FROM meeting_participants
      WHERE user_id = $1
    `;

    const [projectsRes, tasksRes, meetingsRes] = await Promise.all([
      pool.query(projectsQuery, [userId]),
      pool.query(assignedTasksQuery, [userId]),
      pool.query(meetingsQuery, [userId])
    ]);

    res.status(200).json({
      activeProjects: parseInt(projectsRes.rows[0].active_projects, 10),
      assignedTasks: parseInt(tasksRes.rows[0].assigned_tasks, 10),
      completedTasks: parseInt(tasksRes.rows[0].completed_tasks, 10),
      totalMeetings: parseInt(meetingsRes.rows[0].total_meetings, 10)
    });

  } catch (error) {
    console.error('Kullanıcı istatistiklerini getirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// PUT /api/users/me/profile (Profile.js için)
exports.updateUserProfile = async (req, res) => {
  const userId = req.user.userId;
  const { name, department, phone, bio } = req.body;
  try {
    const query = `
      UPDATE users 
      SET name = $1, department = $2, phone = $3, bio = $4, updated_at = NOW()
      WHERE user_id = $5
      RETURNING 
        user_id, name, email, role, department, phone, bio, 
        notification_settings, theme, created_at, last_login_at
    `;
    const { rows } = await pool.query(query, [name, department, phone, bio, userId]);
    res.status(200).json({ ...rows[0], id: rows[0].user_id });
  } catch (error) {
    console.error('Profil güncelleme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// PUT /api/users/me/password (Profile.js için)
exports.updateUserPassword = async (req, res) => {
  const userId = req.user.userId;
  const { currentPassword, newPassword } = req.body;
  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Yeni şifre en az 6 karakter olmalıdır' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const passQuery = `SELECT password_hash FROM users WHERE user_id = $1 FOR UPDATE`;
    const passRes = await client.query(passQuery, [userId]);
    const oldHash = passRes.rows[0].password_hash;
    const isMatch = await bcrypt.compare(currentPassword, oldHash);
    if (!isMatch) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Mevcut şifre yanlış' });
    }
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);
    const updateQuery = `UPDATE users SET password_hash = $1 WHERE user_id = $2`;
    await client.query(updateQuery, [newHash, userId]);
    await client.query('COMMIT');
    res.status(200).json({ message: 'Şifre başarıyla değiştirildi' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Şifre değiştirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  } finally {
    client.release();
  }
};

// PUT /api/users/me/settings (Profile.js için)
exports.updateUserSettings = async (req, res) => {
  const userId = req.user.userId;
  const { notificationSettings, theme } = req.body;
  try {
    let query, queryParams;
    if (notificationSettings) {
      query = `UPDATE users SET notification_settings = $1, updated_at = NOW() WHERE user_id = $2 RETURNING notification_settings`;
      queryParams = [notificationSettings, userId];
    } else if (theme) {
      query = `UPDATE users SET theme = $1, updated_at = NOW() WHERE user_id = $2 RETURNING theme`;
      queryParams = [theme, userId];
    } else {
      return res.status(400).json({ message: 'Güncellenecek ayar yok' });
    }
    const { rows } = await pool.query(query, queryParams);
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Ayar güncelleme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// --- ADMIN Yolları ---

// PUT /api/users/:userId/role (AdminUsers.js için)
exports.updateUserRole = async (req, res) => {
  const { userId: targetUserId } = req.params;
  const { newRole } = req.body;
  const { userId: adminUserId, role: adminRole } = req.user;
  if (adminRole !== 'admin') {
    return res.status(403).json({ message: 'Kullanıcı rollerini değiştirme yetkiniz yok' });
  }
  if (targetUserId === adminUserId) {
    return res.status(400).json({ message: 'Kendi rolünüzü değiştiremezsiniz' });
  }
  if (!['admin', 'manager', 'user'].includes(newRole)) {
    return res.status(400).json({ message: 'Geçersiz rol tipi' });
  }
  try {
    const query = `
      UPDATE users 
      SET role = $1, updated_at = NOW() 
      WHERE user_id = $2 
      RETURNING user_id, role
    `;
    const { rows } = await pool.query(query, [newRole, targetUserId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Rol güncelleme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// PUT /api/users/:userId/department (AdminUsers.js için)
exports.updateUserDepartment = async (req, res) => {
  const { userId: targetUserId } = req.params;
  const { newDepartment } = req.body;
  const { role: adminRole } = req.user;
  if (adminRole !== 'admin') {
    return res.status(403).json({ message: 'Kullanıcı departmanlarını değiştirme yetkiniz yok' });
  }
  try {
    const query = `
      UPDATE users 
      SET department = $1, updated_at = NOW() 
      WHERE user_id = $2 
      RETURNING user_id, department
    `;
    const { rows } = await pool.query(query, [newDepartment, targetUserId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Departman güncelleme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// GET /api/users/:userId (Task.js ve TaskDetailModal.js için)
// (Bu fonksiyon 404 hatasına neden oluyordu)
exports.getUserById = async (req, res) => {
  const { userId } = req.params;
  try {
    const query = `
      SELECT user_id, name, email, role, department 
      FROM users 
      WHERE user_id = $1
    `;
    const { rows } = await pool.query(query, [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }
    res.status(200).json({ ...rows[0], id: rows[0].user_id });
  } catch (error) {
    console.error('Kullanıcı getirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};