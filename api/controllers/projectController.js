// api/controllers/projectController.js
const pool = require('../db');
const { PROJECT_TYPES } = require('../utils/constants'); 

// GET /api/projects (Bu, bir önceki adımdan beri aynı)
exports.getMyProjects = async (req, res) => {
  const userId = req.user.userId;

  try {
    const query = `
      SELECT p.*, c.name AS company_name
      FROM projects p
      JOIN project_users pu ON p.project_id = pu.project_id
      LEFT JOIN companies c ON p.company_id = c.company_id
      WHERE pu.user_id = $1
      ORDER BY p.created_at DESC
    `;
    
    const { rows } = await pool.query(query, [userId]);
    
    const projects = rows.map(p => ({
      ...p,
      id: p.project_id
    }));
    
    res.status(200).json(projects);
  } catch (error) {
    console.error('Proje getirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// POST /api/projects (DÜZELTİLDİ)
exports.createProject = async (req, res) => {
  const {
    title,
    description,
    company, 
    projectType,
    members, 
    projectManager, 
    startDate,
    endDate,
    status
  } = req.body;

  const createdByUserId = req.user.userId;
  const selectedType = PROJECT_TYPES[projectType];
  if (!selectedType) {
    return res.status(400).json({ message: 'Geçersiz proje tipi' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ADIM A: Proje Kodu Üretme (DÜZELTİLDİ)
    // 'FOR UPDATE' bir 'aggregate' (COUNT) ile kullanılamaz.
    // Bu yüzden, o tipteki tüm proje SATIRLARINI seçip KİLİTLİYORUZ...
    const codeQuery = `
      SELECT project_id 
      FROM projects 
      WHERE project_type = $1
      FOR UPDATE
    `;
    const codeRes = await client.query(codeQuery, [projectType]);
    
    // ...ve sonra o satırların SAYISINI alıyoruz.
    const projectCount = codeRes.rows.length + 1; 

    // ... (Geri kalan kod (sıra no, yıl, kod üretme) aynı) ...
    const year = new Date().getFullYear();
    const sequence = projectCount.toString().padStart(3, '0');
    const projectCode = `${selectedType.prefix}-${year}-${sequence}`;

    // ADIM B: 'projects' tablosuna ekle
    // (Bu sorgu bir önceki adımdan beri aynı, zaten doğruydu)
    const projectInsertQuery = `
      INSERT INTO projects (
        name, description, company_id, project_type, project_code, 
        project_manager, created_by_user_id, start_date, end_date, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING * `;
    const projectRes = await client.query(projectInsertQuery, [
      title,
      description,
      company || null, 
      projectType, 
      projectCode, 
      projectManager, 
      createdByUserId,
      startDate || null,
      endDate || null,
      status || 'active'
    ]);
    
    const newProject = projectRes.rows[0];
    const newProjectId = newProject.project_id;

    // ADIM C: 'project_users' tablosuna üyeleri ekle
    const allMemberIds = [...new Set([...members, projectManager])];
    
    if (allMemberIds.length > 0) {
      const memberValues = allMemberIds.map(userId => `('${newProjectId}', '${userId}')`).join(',');
      const memberInsertQuery = `
        INSERT INTO project_users (project_id, user_id)
        VALUES ${memberValues}
      `;
      await client.query(memberInsertQuery);
    }

    // ADIM D: Transaction'ı onayla
    await client.query('COMMIT');

    // ADIM E: React'a yeni projeyi yolla
    res.status(201).json({
      ...newProject,
      id: newProjectId
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Proje oluşturma hatası (ROLLBACK):', error);
    res.status(500).json({ message: 'Sunucu hatası, proje oluşturulamadı' });
  } finally {
    client.release();
  }
};

// YENİ: GET /api/projects/:projectId
// (Tek bir projenin detayını getirir)
exports.getProjectById = async (req, res) => {
  const { projectId } = req.params;
  const userId = req.user.userId; // Giriş yapan kullanıcı

  try {
    // Projeyi ve firma adını çek
    const projectQuery = `
      SELECT p.*, c.name AS company_name
      FROM projects p
      LEFT JOIN companies c ON p.company_id = c.company_id
      WHERE p.project_id = $1
    `;
    const projectRes = await pool.query(projectQuery, [projectId]);

    if (projectRes.rows.length === 0) {
      return res.status(404).json({ message: 'Proje bulunamadı' });
    }

    const project = projectRes.rows[0];

    // YETKİ KONTROLÜ (React kodundakiyle aynı)
    // Bu projenin üyelerini çek
    const memberQuery = `SELECT user_id FROM project_users WHERE project_id = $1`;
    const memberRes = await pool.query(memberQuery, [projectId]);
    const memberIds = memberRes.rows.map(row => row.user_id);

    // Eğer giriş yapan kullanıcı bu üye listesinde DEĞİLSE, reddet
    if (!memberIds.includes(userId)) {
      return res.status(403).json({ message: 'Bu projeyi görüntüleme yetkiniz yok' });
    }
    
    // React'ın beklediği 'members' dizisini ekle
    project.members = memberIds;

    // React'a 'id' formatında da yolla
    project.id = project.project_id;

    res.status(200).json(project);
    
  } catch (error) {
    console.error('Proje detayı getirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// GET /api/projects/:projectId/members
exports.getProjectMembers = async (req, res) => {
  const { projectId } = req.params;
  try {
    const query = `
      SELECT u.user_id, u.name, u.email, u.role, u.department
      FROM users u
      JOIN project_users pu ON u.user_id = pu.user_id
      WHERE pu.project_id = $1
    `;
    const { rows } = await pool.query(query, [projectId]);
    const members = rows.map(m => ({ ...m, id: m.user_id }));
    res.status(200).json(members);
  } catch (error) {
    console.error('Proje üyelerini getirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// (Projenin görev istatistiklerini getirir)
exports.getProjectStats = async (req, res) => {
  const { projectId } = req.params;

  try {
    // 'tasks' tablosundaki görevleri say
    // Bu sorgu, tüm görevleri çekip (React'taki gibi)
    // sonra JavaScript'te filtrelemekten çok daha hızlıdır.
    const query = `
      SELECT
        COUNT(*) AS total_tasks,
        COUNT(CASE WHEN status = 'done' OR status = 'completed' THEN 1 END) AS completed_tasks,
        COUNT(CASE WHEN status = 'inProgress' THEN 1 END) AS in_progress_tasks,
        COUNT(CASE WHEN status = 'todo' THEN 1 END) AS todo_tasks
      FROM tasks
      WHERE project_id = $1
    `;
    const { rows } = await pool.query(query, [projectId]);
    
    // Veriyi React'ın beklediği formata (küçük harf) çevir
    const stats = {
        totalTasks: parseInt(rows[0].total_tasks, 10),
        completedTasks: parseInt(rows[0].completed_tasks, 10),
        inProgressTasks: parseInt(rows[0].in_progress_tasks, 10),
        todoTasks: parseInt(rows[0].todo_tasks, 10)
    };

    res.status(200).json(stats);
  } catch (error) {
    console.error('Proje istatistikleri getirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// YENİ: GET /api/projects/:projectId/tasks
// (Bir projeye ait tüm görevleri Kanban Board için getirir)
exports.getTasksForProject = async (req, res) => {
  const { projectId } = req.params;

  try {
    // Projeye ait tüm görevleri çek (React kodundaki 'fetchTasks' sorgusu)
    const query = `
      SELECT * FROM tasks 
      WHERE project_id = $1 
      ORDER BY created_at ASC
    `;
    const { rows } = await pool.query(query, [projectId]);

    // React'ın 'id' formatına alışkın olması için 'task_id'yi 'id'ye kopyala
    const tasks = rows.map(task => ({
      ...task,
      id: task.task_id
    }));
    
    res.status(200).json(tasks);
  } catch (error) {
    console.error('Projeye ait görevleri getirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};


// YENİ: PUT /api/projects/:projectId/status
// (Proje durumunu günceller - Ayarlar sekmesi)
exports.updateProjectStatus = async (req, res) => {
  const { projectId } = req.params;
  const { status } = req.body; // 'active', 'on-hold', 'completed'
  const { userId, role } = req.user;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // YETKİ KONTROLÜ (ProjectDetail.js'teki 'canEditProject' kuralı)
    const projectQuery = `
      SELECT created_by_user_id 
      FROM projects 
      WHERE project_id = $1 
      FOR UPDATE
    `;
    const projectRes = await client.query(projectQuery, [projectId]);

    if (projectRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Proje bulunamadı' });
    }

    const project = projectRes.rows[0];
    const canEdit = role === 'admin' || project.created_by_user_id === userId;

    if (!canEdit) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Proje durumunu değiştirme yetkiniz yok' });
    }

    // Yetkisi varsa, GÜNCELLE
    // 'completed' ise 'completed_at' zamanını da ayarla
    const completedAt = (status === 'completed') ? 'NOW()' : null;
    
    const updateQuery = `
      UPDATE projects 
      SET 
        status = $1, 
        completed_at = ${completedAt},
        updated_at = NOW()
      WHERE project_id = $2 
      RETURNING *
    `;
    const updateRes = await client.query(updateQuery, [status, projectId]);

    await client.query('COMMIT');
    
    res.status(200).json({
      ...updateRes.rows[0],
      id: updateRes.rows[0].project_id
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Proje durumu güncelleme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  } finally {
    client.release();
  }
};

// YENİ: DELETE /api/projects/:projectId
// (Projeyi siler - Ayarlar sekmesi)
exports.deleteProject = async (req, res) => {
  const { projectId } = req.params;
  const { userId, role } = req.user;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // YETKİ KONTROLÜ (ProjectDetail.js'teki kural: admin veya proje sahibi)
    const projectQuery = `SELECT created_by_user_id FROM projects WHERE project_id = $1 FOR UPDATE`;
    const projectRes = await client.query(projectQuery, [projectId]);

    if (projectRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Proje bulunamadı' });
    }
    
    const project = projectRes.rows[0];
    const canDelete = role === 'admin' || project.created_by_user_id === userId;
    
    if (!canDelete) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Bu projeyi silme yetkiniz yok' });
    }
    
    // Yetkisi varsa, SİL
    // Veritabanını 'ON DELETE CASCADE' ile kurduğumuz için,
    // bu projeyi sildiğimizde buna bağlı tüm 'project_users',
    // 'tasks', 'comments' ve 'files' kayıtları da
    // OTOMATİK OLARAK SİLİNECEKTİR.
    await client.query('DELETE FROM projects WHERE project_id = $1', [projectId]);
    
    await client.query('COMMIT');
    
    res.status(204).send(); // Başarılı, içerik yok
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Proje silme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  } finally {
    client.release();
  }
};


// PUT /api/projects/:projectId/members (DÜZELTİLDİ: 'null' filtresi)
exports.updateProjectMembers = async (req, res) => {
  const { projectId } = req.params;
  const { members, projectManager } = req.body;
  const { userId: updaterId, role } = req.user;

  // DÜZELTME: 'null' veya 'undefined' değerleri filtrele
  const allMemberIds = [...new Set([...members, projectManager])]
                          .filter(id => id != null); // '!= null' hem null hem undefined'ı yakalar

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Yetki kontrolü (sadece admin veya o projenin yöneticisi)
    const projectQuery = `SELECT project_manager FROM projects WHERE project_id = $1 FOR UPDATE`;
    const projectRes = await client.query(projectQuery, [projectId]);
    if (projectRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Proje bulunamadı' });
    }
    
    const project = projectRes.rows[0];
    // DÜZELTME: Kural 'Proje Sahibi' değil, 'Proje Yöneticisi' olmalı
    const canEdit = role === 'admin' || project.project_manager === updaterId;

    if (!canEdit) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Proje üyelerini düzenleme yetkiniz yok' });
    }

    // 2. Mevcut tüm üyeleri sil
    await client.query('DELETE FROM project_users WHERE project_id = $1', [projectId]);

    // 3. Yeni üye listesini ekle (Filtrelenmiş liste)
    if (allMemberIds.length > 0) {
      const memberValues = allMemberIds.map(userId => `('${projectId}', '${userId}')`).join(',');
      const participantQuery = `
        INSERT INTO project_users (project_id, user_id)
        VALUES ${memberValues}
      `;
      await client.query(participantQuery); // HATA BURADA OLUŞUYORDU
    }

    await client.query('COMMIT');
    
    res.status(200).json(allMemberIds);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Proje üye güncelleme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  } finally {
    client.release();
  }
};