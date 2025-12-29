// api/controllers/projectController.js
const pool = require('../db');
const { PROJECT_TYPES } = require('../utils/constants'); 

// GET /api/projects
exports.getMyProjects = async (req, res) => {
  const userId = req.user.userId;
  const companyId = req.user.companyId;

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

// POST /api/projects
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
  const companyId = req.user.companyId; 
  
  const selectedType = PROJECT_TYPES[projectType];
  if (!selectedType) {
    return res.status(400).json({ message: 'Geçersiz proje tipi' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const codeQuery = `
      SELECT project_id 
      FROM projects 
      WHERE project_type = $1 AND company_id = $2
      FOR UPDATE
    `;
    const codeRes = await client.query(codeQuery, [projectType, companyId]);
    
    const projectCount = codeRes.rows.length + 1; 
    const year = new Date().getFullYear();
    const sequence = projectCount.toString().padStart(3, '0');
    const projectCode = `${selectedType.prefix}-${year}-${sequence}`;

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
      company, // Gelen company ID'yi kullanıyoruz (SaaS/Admin panelinden seçilen)
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

    // Fazları oluştur (PhaseController.js yapısına uygun olarak varsayılan faz eklenebilir ama 
    // senin kodunda createProject içinde manuel column ekleme var. 
    // Faz sistemine tam geçiş yaptıysak buraya 'Genel Yönetim' fazı eklenmeli.)
    
    // YENİ: Varsayılan 'Genel Yönetim' Fazı
    const phaseQuery = `INSERT INTO project_phases (project_id, name, type, order_index) VALUES ($1, 'Genel Yönetim', 'general', 0) RETURNING phase_id`;
    const phaseRes = await client.query(phaseQuery, [newProjectId]);
    const defaultPhaseId = phaseRes.rows[0].phase_id;

    // Sütunları bu faza bağla
    const defaultColumns = [
      { title: 'Yapılacaklar', order: 0 },
      { title: 'Devam Eden', order: 1 },
      { title: 'Tamamlandı', order: 2 }
    ];
    for (const col of defaultColumns) {
      await client.query(
        `INSERT INTO project_columns (project_id, phase_id, title, order_index, is_locked)
         VALUES ($1, $2, $3, $4, $5)`,
        [newProjectId, defaultPhaseId, col.title, col.order, true] 
      );
    }

    const allMemberIds = [...new Set([...members, projectManager])];
    if (allMemberIds.length > 0) {
      const memberValues = allMemberIds.map(userId => `('${newProjectId}', '${userId}')`).join(',');
      await client.query(`INSERT INTO project_users (project_id, user_id) VALUES ${memberValues}`);
    }

    await client.query('COMMIT');

    res.status(201).json({ ...newProject, id: newProjectId });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Proje oluşturma hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası, proje oluşturulamadı' });
  } finally {
    client.release();
  }
};

// GET /api/projects/:projectId
exports.getProjectById = async (req, res) => {
  const { projectId } = req.params;
  const userId = req.user.userId;
  const companyId = req.user.companyId;

  try {
    const projectQuery = `
      SELECT p.*, c.name AS company_name,
             EXISTS(SELECT 1 FROM project_users pu WHERE pu.project_id = p.project_id AND pu.user_id = $1) as is_member
      FROM projects p
      LEFT JOIN companies c ON p.company_id = c.company_id
      WHERE p.project_id = $2
    `;
    const projectRes = await pool.query(projectQuery, [userId, projectId]);

    if (projectRes.rows.length === 0) {
      return res.status(404).json({ message: 'Proje bulunamadı' });
    }

    const project = projectRes.rows[0];
    const hasAccess = (project.company_id === companyId) || project.is_member || req.user.role === 'admin';

    if (!hasAccess) {
      return res.status(403).json({ message: 'Bu projeyi görüntüleme yetkiniz yok' });
    }

    const memberQuery = `SELECT user_id FROM project_users WHERE project_id = $1`;
    const memberRes = await pool.query(memberQuery, [projectId]);
    project.members = memberRes.rows.map(row => row.user_id);
    project.id = project.project_id;

    res.status(200).json(project);
    
  } catch (error) {
    console.error('Proje detayı hatası:', error);
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
    console.error('Proje üyeleri hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// GET /api/projects/:projectId/stats (GÜNCELLENDİ: Müşteriye Tam Analiz)
exports.getProjectStats = async (req, res) => {
  const { projectId } = req.params;
  const userId = req.user.userId;

  try {
    // 1. Erişim kontrolü
    const accessQuery = `
        SELECT company_id, 
        EXISTS(SELECT 1 FROM project_users WHERE project_id = projects.project_id AND user_id = $1) as is_member
        FROM projects WHERE project_id = $2
    `;
    const accessRes = await pool.query(accessQuery, [userId, projectId]);
    
    if (accessRes.rows.length === 0) return res.status(404).json({message: 'Proje bulunamadı'});
    
    const p = accessRes.rows[0];
    const userRole = req.user.role;
    // Admin değilse, üye değilse ve şirket eşleşmiyorsa engelle
    if (userRole !== 'admin' && !p.is_member && p.company_id !== req.user.companyId) {
        return res.status(403).json({ message: 'Erişim yetkiniz yok' });
    }

    // 2. TÜM SÜTUNLARI VE GÖREV SAYILARINI ÇEK
    // İsim tahminine gerek yok. Her sütunun kaç görevi olduğunu ve sırasını (order_index) çekiyoruz.
    const statsQuery = `
      SELECT
        pp.phase_id,
        pp.name AS phase_name,
        pc.column_id,
        pc.order_index,
        COUNT(t.task_id) AS task_count
      FROM project_phases pp
      JOIN project_columns pc ON pp.phase_id = pc.phase_id
      LEFT JOIN tasks t ON t.status = pc.column_id::text
      WHERE pp.project_id = $1
      GROUP BY pp.phase_id, pp.name, pc.column_id, pc.order_index
      ORDER BY pp.order_index ASC
    `;
    
    const { rows } = await pool.query(statsQuery, [projectId]);
    
    // 3. VERİYİ JS TARAFINDA GRUPLA (Daha güvenli ve esnek)
    const phasesMap = {};

    rows.forEach(row => {
        if (!phasesMap[row.phase_id]) {
            phasesMap[row.phase_id] = {
                phase_id: row.phase_id,
                phase_name: row.phase_name,
                columns: []
            };
        }
        phasesMap[row.phase_id].columns.push({
            count: parseInt(row.task_count),
            order: row.order_index
        });
    });

    let total = 0, completed = 0, inProgress = 0, todo = 0;
    const phaseStats = [];

    // Her faz için hesaplama yap
    Object.values(phasesMap).forEach(phase => {
        // Sütunları sırasına göre diz (Garanti olsun)
        const cols = phase.columns.sort((a, b) => a.order - b.order);
        
        let p_total = 0, p_completed = 0, p_inProgress = 0, p_todo = 0;

        if (cols.length > 0) {
            // MANTIK: 
            // - İlk Sütun (Index 0) -> Yapılacaklar (Todo)
            // - Son Sütun (Index Length-1) -> Tamamlandı (Done)
            // - Aradakiler -> Devam Eden (In Progress)

            cols.forEach((col, index) => {
                p_total += col.count;

                if (index === 0) {
                    // İlk Sütun: Yapılacaklar
                    p_todo += col.count;
                } else if (index === cols.length - 1 && cols.length > 1) {
                    // Son Sütun (Eğer tek sütun değilse): Tamamlandı
                    p_completed += col.count;
                } else {
                    // Aradaki Sütunlar: Devam Eden
                    p_inProgress += col.count;
                }
            });
        }

        // Genel Toplamlara Ekle
        total += p_total;
        completed += p_completed;
        inProgress += p_inProgress;
        todo += p_todo;

        // Faz İstatistiği Listesine Ekle
        phaseStats.push({
            phase_id: phase.phase_id,
            phase_name: phase.phase_name,
            total_tasks: p_total,
            completed_tasks: p_completed,
            in_progress_tasks: p_inProgress,
            todo_tasks: p_todo
        });
    });

    const stats = {
        totalTasks: total,
        completedTasks: completed,
        inProgressTasks: inProgress,
        todoTasks: todo,
        phaseStats: phaseStats
    };

    res.status(200).json(stats);
  } catch (error) {
    console.error('İstatistik hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// GET /api/projects/:projectId/tasks
exports.getTasksForProject = async (req, res) => {
  const { projectId } = req.params;
  const userId = req.user.userId;
  const companyId = req.user.companyId;
  const userRole = req.user.role;

  try {
    const accessQuery = `
        SELECT company_id, 
        EXISTS(SELECT 1 FROM project_users WHERE project_id = projects.project_id AND user_id = $1) as is_member
        FROM projects WHERE project_id = $2
    `;
    const accessRes = await pool.query(accessQuery, [userId, projectId]);
    
    if (accessRes.rows.length === 0) return res.status(404).json({message: 'Proje bulunamadı'});
    
    const p = accessRes.rows[0];
    if (p.company_id !== companyId && !p.is_member && userRole !== 'admin') {
        return res.status(403).json({ message: 'Erişim yetkiniz yok' });
    }

    let query = `SELECT * FROM tasks WHERE project_id = $1`;
    
    // GÖREV LİSTESİNDE: Müşteri sadece kendine açık olanı görsün.
    if (userRole === 'client') {
        query += ` AND is_visible_to_client = true`;
    }

    query += ` ORDER BY created_at ASC`;
    const { rows } = await pool.query(query, [projectId]);

    const tasks = rows.map(task => ({
      ...task,
      id: task.task_id
    }));
    
    res.status(200).json(tasks);
  } catch (error) {
    console.error('Görev listesi hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

exports.updateProject = async (req, res) => {
  const { projectId } = req.params;
  const { name, description, start_date, end_date } = req.body;
  const { userId, role } = req.user; // companyId'yi buradan almamıza gerek kalmadı

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // DÜZELTME: 'AND company_id = $2' kısmını kaldırdık.
    // Çünkü proje Müşteri şirketine ait olsa bile, onu oluşturan Manager (Bizim şirket) düzenleyebilmeli.
    const projectQuery = `
      SELECT created_by_user_id, project_manager, company_id 
      FROM projects 
      WHERE project_id = $1
      FOR UPDATE
    `;
    // Sorguya sadece projectId veriyoruz
    const projectRes = await client.query(projectQuery, [projectId]);

    if (projectRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Proje bulunamadı' });
    }

    const project = projectRes.rows[0];

    // YETKİ KONTROLÜ:
    // 1. Admin her şeyi düzenler.
    // 2. Projeyi OLUŞTURAN kişi (Manager) düzenleyebilir.
    // 3. Projeye atanmış PROJE YÖNETİCİSİ düzenleyebilir.
    const canEdit = 
        role === 'admin' || 
        project.created_by_user_id === userId || 
        project.project_manager === userId;

    if (!canEdit) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Proje detaylarını düzenleme yetkiniz yok' });
    }

    const updateQuery = `
      UPDATE projects 
      SET 
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        start_date = $3,
        end_date = $4,
        updated_at = NOW()
      WHERE project_id = $5
      RETURNING *
    `;
    
    const updateRes = await client.query(updateQuery, [name, description, start_date, end_date, projectId]);

    await client.query('COMMIT');
    
    const updatedProject = updateRes.rows[0];
    res.status(200).json({ ...updatedProject, id: updatedProject.project_id });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Proje güncelleme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  } finally {
    client.release();
  }
};


// PUT /api/projects/:projectId/status
// GÜNCELLENEN FONKSİYON: Durum Güncelleme (Sadece Admin)
exports.updateProjectStatus = async (req, res) => {
  const { projectId } = req.params;
  const { status } = req.body; 
  const { role, companyId } = req.user; // userId sildim çünkü sadece role bakacağız

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const projectQuery = `SELECT project_id FROM projects WHERE project_id = $1 AND company_id = $2 FOR UPDATE`;
    const projectRes = await client.query(projectQuery, [projectId, companyId]);

    if (projectRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Proje bulunamadı' });
    }

    // İSTEK: "Sadece admin değiştirebilmeli"
    if (role !== 'admin') {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Proje durumunu sadece Admin değiştirebilir' });
    }

    const completedAt = (status === 'completed') ? 'NOW()' : null;
    
    const updateQuery = `
      UPDATE projects 
      SET status = $1, completed_at = ${completedAt}, updated_at = NOW()
      WHERE project_id = $2 RETURNING *
    `;
    const updateRes = await client.query(updateQuery, [status, projectId]);

    await client.query('COMMIT');
    res.status(200).json({ ...updateRes.rows[0], id: updateRes.rows[0].project_id });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Durum güncelleme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  } finally {
    client.release();
  }
};
// DELETE /api/projects/:projectId
exports.deleteProject = async (req, res) => {
  const { projectId } = req.params;
  const { userId, role, companyId } = req.user;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Şirket kontrolü
    const projectQuery = `
        SELECT created_by_user_id 
        FROM projects 
        WHERE project_id = $1 AND company_id = $2 
        FOR UPDATE
    `;
    const projectRes = await client.query(projectQuery, [projectId, companyId]);

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
    
    await client.query('DELETE FROM projects WHERE project_id = $1', [projectId]);
    
    await client.query('COMMIT');
    
    res.status(204).send(); 
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Silme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  } finally {
    client.release();
  }
};

// PUT /api/projects/:projectId/members
exports.updateProjectMembers = async (req, res) => {
  const { projectId } = req.params;
  const { members, projectManager } = req.body;
  const { userId: updaterId, role, companyId } = req.user;

  const allMemberIds = [...new Set([...members, projectManager])]
                          .filter(id => id != null);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Şirket kontrolü
    const projectQuery = `
        SELECT project_manager 
        FROM projects 
        WHERE project_id = $1 AND company_id = $2 
        FOR UPDATE
    `;
    const projectRes = await client.query(projectQuery, [projectId, companyId]);
    
    if (projectRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Proje bulunamadı' });
    }
    
    const project = projectRes.rows[0];
    const canEdit = role === 'admin' || project.project_manager === updaterId;

    if (!canEdit) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Proje üyelerini düzenleme yetkiniz yok' });
    }

    await client.query('DELETE FROM project_users WHERE project_id = $1', [projectId]);

    if (allMemberIds.length > 0) {
      const memberValues = allMemberIds.map(userId => `('${projectId}', '${userId}')`).join(',');
      const participantQuery = `
        INSERT INTO project_users (project_id, user_id)
        VALUES ${memberValues}
      `;
      await client.query(participantQuery);
    }

    await client.query('COMMIT');
    res.status(200).json(allMemberIds);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Üye güncelleme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  } finally {
    client.release();
  }
};