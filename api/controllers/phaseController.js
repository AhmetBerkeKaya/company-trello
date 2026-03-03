// api/controllers/phaseController.js
const pool = require('../db');

// api/controllers/phaseController.js

exports.getPhases = async (req, res) => {
  const { projectId } = req.params;
  const userId = req.user.userId;
  const companyId = req.user.companyId;

  try {
    // GÜVENLİK: Şirket kontrolü VEYA Üyelik kontrolü
    const accessQuery = `
        SELECT company_id, 
        EXISTS(SELECT 1 FROM project_users WHERE project_id = projects.project_id AND user_id = $1) as is_member
        FROM projects WHERE project_id = $2
    `;
    const accessRes = await pool.query(accessQuery, [userId, projectId]);

    if (accessRes.rows.length === 0) return res.status(404).json({ message: 'Proje bulunamadı' });

    const p = accessRes.rows[0];
    const hasAccess = (p.company_id === companyId) || p.is_member || req.user.role === 'admin';

    if (!hasAccess) return res.status(403).json({ message: 'Yetkisiz erişim' });

    // Erişim tamamsa fazları getir
    const query = `
      SELECT * FROM project_phases 
      WHERE project_id = $1 
      ORDER BY order_index ASC
    `;
    const { rows } = await pool.query(query, [projectId]);
    
    const phases = rows.map(ph => ({
        ...ph,
        id: ph.phase_id
    }));

    res.status(200).json(phases);
  } catch (error) {
    console.error('Fazları getirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};
exports.createPhase = async (req, res) => {
  const { projectId } = req.params;
  const { name, type } = req.body; 
  const { userId, role, companyId } = req.user;

  try {
    const projectRes = await pool.query('SELECT created_by_user_id, project_manager, company_id FROM projects WHERE project_id = $1', [projectId]);
    if (projectRes.rows.length === 0) return res.status(404).json({ message: 'Proje bulunamadı' });
    const project = projectRes.rows[0];

    // Yetki: Admin, Manager, Proje Sahibi veya Şirket Sahibi
    const canCreate = role === 'admin' || role === 'manager' || project.created_by_user_id === userId || project.company_id === companyId;
    if (!canCreate) return res.status(403).json({ message: 'Yetkiniz yok' });

    const orderRes = await pool.query('SELECT MAX(order_index) as max_order FROM project_phases WHERE project_id = $1', [projectId]);
    const nextOrder = (orderRes.rows[0].max_order || 0) + 1;

    const { rows } = await pool.query(
      'INSERT INTO project_phases (project_id, name, type, order_index) VALUES ($1, $2, $3, $4) RETURNING *',
      [projectId, name, type || 'general', nextOrder]
    );
    
    // Varsayılan Sütunları Ekle (Kanban yapısı için şart)
    const phaseId = rows[0].phase_id;
    const cols = [['Yapılacaklar', 0, true], ['Devam Eden', 1, true], ['Tamamlandı', 2, true]];
    for (const [title, idx, locked] of cols) {
        await pool.query('INSERT INTO project_columns (project_id, phase_id, title, order_index, is_locked) VALUES ($1, $2, $3, $4, $5)', [projectId, phaseId, title, idx, locked]);
    }

    res.status(201).json({ ...rows[0], id: phaseId });
  } catch (error) {
    console.error('Faz hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// PUT /api/phases/:phaseId (İsim güncelleme)
exports.updatePhase = async (req, res) => {
    const { phaseId } = req.params;
    const { name } = req.body;
    
    try {
      const query = `
          UPDATE project_phases SET name = $1 WHERE phase_id = $2 RETURNING *
      `;
      const { rows } = await pool.query(query, [name, phaseId]);
      if (rows.length === 0) return res.status(404).json({ message: 'Faz bulunamadı' });
      
      res.status(200).json(rows[0]);
    } catch (error) {
      console.error('Faz güncelleme hatası:', error);
      res.status(500).json({ message: 'Sunucu hatası' });
    }
  };

// DELETE /api/phases/:phaseId
exports.deletePhase = async (req, res) => {
    const { phaseId } = req.params;
  
    try {
      // "Genel Yönetim" veya ana faz silinmemeli kontrolü yapılabilir (type check)
      // Şimdilik direkt siliyoruz, CASCADE olduğu için içindeki sütunlar ve tasklar da gider mi?
      // DİKKAT: Task'lar şu an doğrudan phase'e bağlı değil, SÜTUN'a (column) bağlı.
      // Sütunlar phase'e bağlı olduğu için ve FK CASCADE verdiğimiz için hepsi silinecektir.
      
      await pool.query('DELETE FROM project_phases WHERE phase_id = $1', [phaseId]);
      res.status(204).send();
    } catch (error) {
      console.error('Faz silme hatası:', error);
      res.status(500).json({ message: 'Sunucu hatası' });
    }
};