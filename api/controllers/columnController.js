// api/controllers/columnController.js
const pool = require('../db');

// GET /api/projects/:projectId/columns (GÜNCELLENDİ)
exports.getColumns = async (req, res) => {
  // DİKKAT: Artık projectId değil, phaseId alıyoruz. 
  // route dosyasında '/phases/:phaseId/columns' tanımlı olmalı.
  const { phaseId } = req.params; 
  const userId = req.user.userId;
  const companyId = req.user.companyId;

  // Eğer route hala '/projects/:projectId/columns' ise req.params.projectId gelebilir,
  // ama frontend '/phases/...' atıyorsa route dosyasında da ':phaseId' olmalı.
  // Varsayım: Route dosyasını güncellemiştin, burada phaseId yakalıyoruz.

  try {
    // 1. Fazın hangi projeye ait olduğunu bul ve Erişim Kontrolü Yap
    const checkQuery = `
        SELECT pp.project_id, p.company_id,
        EXISTS(SELECT 1 FROM project_users pu WHERE pu.project_id = p.project_id AND pu.user_id = $1) as is_member
        FROM project_phases pp
        JOIN projects p ON pp.project_id = p.project_id
        WHERE pp.phase_id = $2
    `;
    const checkRes = await pool.query(checkQuery, [userId, phaseId]);
    
    if (checkRes.rows.length === 0) return res.status(404).json({ message: 'Faz bulunamadı' });
    
    const info = checkRes.rows[0];
    
    // Erişim Kontrolü (Üye mi, Şirket sahibi mi, Admin mi?)
    const hasAccess = (info.company_id === companyId) || info.is_member || req.user.role === 'admin';

    if (!hasAccess) {
        return res.status(403).json({ message: 'Yetkisiz erişim' });
    }

    // 2. O faza ait sütunları getir
    const query = `
      SELECT * FROM project_columns 
      WHERE phase_id = $1 
      ORDER BY order_index ASC
    `;
    const { rows } = await pool.query(query, [phaseId]);
    
    const columns = rows.map(col => ({ ...col, id: col.column_id }));

    res.status(200).json(columns);
  } catch (error) {
    console.error('Sütunları getirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// POST /api/phases/:phaseId/columns
exports.createColumn = async (req, res) => {
  const { phaseId } = req.params;
  const { title } = req.body;

  try {
    // 1. Fazın hangi projeye ait olduğunu bul (project_id'yi de kaydetmek için)
    const phaseRes = await pool.query('SELECT project_id FROM project_phases WHERE phase_id = $1', [phaseId]);
    
    if (phaseRes.rows.length === 0) {
        return res.status(404).json({ message: 'Faz bulunamadı' });
    }
    const projectId = phaseRes.rows[0].project_id;

    // 2. Bu fazdaki son sırayı bul
    const orderRes = await pool.query(
        'SELECT MAX(order_index) as max_order FROM project_columns WHERE phase_id = $1',
        [phaseId]
    );
    const nextOrder = (orderRes.rows[0].max_order || 0) + 1;

    // 3. Oluştur
    const query = `
      INSERT INTO project_columns (project_id, phase_id, title, order_index)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const { rows } = await pool.query(query, [projectId, phaseId, title, nextOrder]);
    
    res.status(201).json({ ...rows[0], id: rows[0].column_id });
  } catch (error) {
    console.error('Sütun oluşturma hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// PUT /api/columns/:columnId (İsim güncelleme - Değişmedi)
exports.updateColumn = async (req, res) => {
  const { columnId } = req.params;
  const { title } = req.body;
  
  try {
    const query = `
        UPDATE project_columns SET title = $1 WHERE column_id = $2 RETURNING *
    `;
    const { rows } = await pool.query(query, [title, columnId]);
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Sütun güncelleme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// DELETE /api/columns/:columnId (Değişmedi)
exports.deleteColumn = async (req, res) => {
  const { columnId } = req.params;

  try {
    const checkQuery = 'SELECT is_locked FROM project_columns WHERE column_id = $1';
    const checkRes = await pool.query(checkQuery, [columnId]);

    if (checkRes.rows.length === 0) return res.status(404).json({ message: 'Sütun bulunamadı' });
    if (checkRes.rows[0].is_locked) return res.status(403).json({ message: 'Bu sistem sütunu silinemez!' });

    await pool.query('DELETE FROM project_columns WHERE column_id = $1', [columnId]);
    res.status(204).send();
  } catch (error) {
    console.error('Sütun silme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// PUT /api/phases/:phaseId/columns/reorder (YENİ: Phase bazlı sıralama)
exports.reorderColumns = async (req, res) => {
  const { phaseId } = req.params;
  const { newOrder } = req.body; // ['col_id_1', 'col_id_2']

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (let index = 0; index < newOrder.length; index++) {
      const columnId = newOrder[index];
      // Sadece o faza aitse güncelle
      await client.query(
        'UPDATE project_columns SET order_index = $1 WHERE column_id = $2 AND phase_id = $3',
        [index, columnId, phaseId]
      );
    }

    await client.query('COMMIT');
    res.status(200).json({ message: 'Sıralama güncellendi' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Sütun sıralama hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  } finally {
    client.release();
  }
};