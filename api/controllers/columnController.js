// api/controllers/columnController.js
const pool = require('../db');

// GET /api/projects/:projectId/columns
exports.getColumns = async (req, res) => {
  const { projectId } = req.params;
  const { companyId } = req.user;

  try {
    // Güvenlik: Proje şirkete mi ait?
    const projectCheck = await pool.query(
      'SELECT 1 FROM projects WHERE project_id = $1 AND company_id = $2', 
      [projectId, companyId]
    );
    if (projectCheck.rows.length === 0) return res.status(404).json({ message: 'Proje bulunamadı' });

    const query = `
      SELECT * FROM project_columns 
      WHERE project_id = $1 
      ORDER BY order_index ASC
    `;
    const { rows } = await pool.query(query, [projectId]);
    
    // Frontend uyumluluğu için 'id' alanını ekle
    const columns = rows.map(col => ({
        ...col,
        id: col.column_id 
    }));

    res.status(200).json(columns);
  } catch (error) {
    console.error('Sütunları getirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// POST /api/projects/:projectId/columns
exports.createColumn = async (req, res) => {
  const { projectId } = req.params;
  const { title } = req.body;
  const { companyId } = req.user;

  try {
    // Güvenlik
    const projectCheck = await pool.query(
        'SELECT 1 FROM projects WHERE project_id = $1 AND company_id = $2', 
        [projectId, companyId]
    );
    if (projectCheck.rows.length === 0) return res.status(404).json({ message: 'Proje bulunamadı' });

    // En son sırayı bul
    const orderRes = await pool.query(
        'SELECT MAX(order_index) as max_order FROM project_columns WHERE project_id = $1',
        [projectId]
    );
    const nextOrder = (orderRes.rows[0].max_order || 0) + 1;

    const query = `
      INSERT INTO project_columns (project_id, title, order_index)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const { rows } = await pool.query(query, [projectId, title, nextOrder]);
    
    res.status(201).json({ ...rows[0], id: rows[0].column_id });
  } catch (error) {
    console.error('Sütun oluşturma hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// PUT /api/columns/:columnId (İsim güncelleme)
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

exports.deleteColumn = async (req, res) => {
  const { columnId } = req.params;

  try {
    // 1. Önce bu sütun KİLİTLİ Mİ diye bak
    const checkQuery = 'SELECT is_locked, title FROM project_columns WHERE column_id = $1';
    const checkRes = await pool.query(checkQuery, [columnId]);

    if (checkRes.rows.length === 0) {
      return res.status(404).json({ message: 'Sütun bulunamadı' });
    }

    if (checkRes.rows[0].is_locked) {
      return res.status(403).json({ message: 'Bu sistem sütunu silinemez!' });
    }

    // 2. Kilitli değilse sil
    await pool.query('DELETE FROM project_columns WHERE column_id = $1', [columnId]);
    res.status(204).send();
    
  } catch (error) {
    console.error('Sütun silme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

exports.reorderColumns = async (req, res) => {
  const { projectId } = req.params;
  const { newOrder } = req.body; // Array of columnIds ['uuid-1', 'uuid-2', ...]
  const { companyId } = req.user;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Güvenlik Kontrolü
    const projectCheck = await client.query(
        'SELECT 1 FROM projects WHERE project_id = $1 AND company_id = $2', 
        [projectId, companyId]
    );
    if (projectCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Proje bulunamadı' });
    }

    // 2. Sıralamayı Güncelle (Döngü ile tek tek update)
    // Not: Çok yüksek trafikli yerlerde 'CASE WHEN' kullanılır ama burada loop yeterli.
    for (let index = 0; index < newOrder.length; index++) {
      const columnId = newOrder[index];
      await client.query(
        'UPDATE project_columns SET order_index = $1 WHERE column_id = $2 AND project_id = $3',
        [index, columnId, projectId]
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