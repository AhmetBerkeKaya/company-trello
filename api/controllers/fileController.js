// api/controllers/fileController.js
const pool = require('../db');

// --- GÖREV DOSYALARI ---

// GET /api/tasks/:taskId/files
exports.getFilesForTask = async (req, res) => {
  const { taskId } = req.params;

  try {
    // Tüm dosyaları getiriyoruz (Frontend'de güncel ve geçmiş diye ayıracağız)
    const query = `
      SELECT * FROM files 
      WHERE task_id = $1 
      ORDER BY is_current_version DESC, version DESC, uploaded_at DESC
    `;
    const { rows } = await pool.query(query, [taskId]);

    const files = rows.map(f => ({
      ...f,
      id: f.file_id
    }));
    
    res.status(200).json(files);
  } catch (error) {
    console.error('Dosyaları getirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// POST /api/tasks/:taskId/files (REVİZYON MANTIĞI EKLENDİ)
exports.addFileRecord = async (req, res) => {
  const { taskId } = req.params;
  const { name, url, storagePath, size, type, projectId } = req.body;
  const uploadedByUserId = req.user.userId;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. AYNI İSİMDE MEVCUT 'GÜNCEL' DOSYAYI BUL
    const checkQuery = `
      SELECT file_id, version 
      FROM files 
      WHERE task_id = $1 AND name = $2 AND is_current_version = true
      FOR UPDATE
    `;
    const checkRes = await client.query(checkQuery, [taskId, name]);

    let newVersion = 1;
    let parentFileId = null;

    // 2. EĞER VARSA ESKİYİ ARŞİVLE
    if (checkRes.rows.length > 0) {
      const oldFile = checkRes.rows[0];
      newVersion = oldFile.version + 1;
      parentFileId = oldFile.file_id;

      // Eski dosyanın 'is_current_version' bayrağını kaldır
      await client.query(
        `UPDATE files SET is_current_version = false WHERE file_id = $1`,
        [oldFile.file_id]
      );
    }

    // 3. YENİ DOSYAYI KAYDET (v2, v3...)
    const insertQuery = `
      INSERT INTO files (
        name, url, storage_path, size, type, task_id, project_id, uploaded_by_user_id, 
        category, version, is_current_version, parent_file_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'document', $9, true, $10)
      RETURNING *
    `;
    const { rows } = await client.query(insertQuery, [
      name, url, storagePath, size, type, taskId, projectId, uploadedByUserId, 
      newVersion, parentFileId
    ]);
    
    await client.query('COMMIT');
    res.status(201).json({ ...rows[0], id: rows[0].file_id });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Dosya kaydı ekleme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  } finally {
    client.release();
  }
};

// --- PROJE PAFTALARI (PLANS) ---

// GET /api/projects/:projectId/plans
exports.getProjectPlans = async (req, res) => {
  const { projectId } = req.params;

  try {
    const query = `
      SELECT * FROM files 
      WHERE project_id = $1 AND category = 'plan'
      ORDER BY is_current_version DESC, version DESC, uploaded_at DESC
    `;
    const { rows } = await pool.query(query, [projectId]);

    const files = rows.map(f => ({
      ...f,
      id: f.file_id
    }));
    
    res.status(200).json(files);
  } catch (error) {
    console.error('Paftaları getirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// POST /api/projects/:projectId/plans (REVİZYON MANTIĞI EKLENDİ)
exports.addProjectPlan = async (req, res) => {
  const { projectId } = req.params;
  const { name, url, storagePath, size, type, description, taskId } = req.body; 
  const uploadedByUserId = req.user.userId;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. AYNI İSİMDEKİ PAFTAYI BUL
    const checkQuery = `
      SELECT file_id, version 
      FROM files 
      WHERE project_id = $1 AND category = 'plan' AND name = $2 AND is_current_version = true
      FOR UPDATE
    `;
    const checkRes = await client.query(checkQuery, [projectId, name]);

    let newVersion = 1;
    let parentFileId = null;

    // 2. ESKİYİ ARŞİVLE
    if (checkRes.rows.length > 0) {
      const oldFile = checkRes.rows[0];
      newVersion = oldFile.version + 1;
      parentFileId = oldFile.file_id;

      await client.query(
        `UPDATE files SET is_current_version = false WHERE file_id = $1`,
        [oldFile.file_id]
      );
    }

    // 3. YENİSİNİ EKLE
    const insertQuery = `
      INSERT INTO files (
        name, url, storage_path, size, type, project_id, uploaded_by_user_id, 
        category, description, task_id, version, is_current_version, parent_file_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'plan', $8, $9, $10, true, $11)
      RETURNING *
    `;
    const { rows } = await client.query(insertQuery, [
      name, 
      url, 
      storagePath, 
      size, 
      type, 
      projectId, 
      uploadedByUserId, 
      description || '', 
      taskId || null,
      newVersion,
      parentFileId
    ]);
    
    await client.query('COMMIT');
    res.status(201).json({ ...rows[0], id: rows[0].file_id });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Pafta ekleme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  } finally {
    client.release();
  }
};

// --- ORTAK İŞLEMLER ---

exports.deleteFileRecord = async (req, res) => {
  const { fileId } = req.params;
  const { userId, role } = req.user;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const fileQuery = `SELECT uploaded_by_user_id, storage_path, parent_file_id, is_current_version FROM files WHERE file_id = $1 FOR UPDATE`;
    const fileRes = await client.query(fileQuery, [fileId]);

    if (fileRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Dosya kaydı bulunamadı' });
    }

    const file = fileRes.rows[0];
    const canDelete = role === 'admin' || role === 'manager' || file.uploaded_by_user_id === userId;

    if (!canDelete) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Bu dosyayı silme yetkiniz yok' });
    }
    
    // YENİ: Silinen dosya 'güncel' ise ve bir 'parent'ı (atası) varsa, atayı tekrar güncel yapabiliriz (Opsiyonel)
    // Şimdilik sadece siliyoruz, geçmiş koptuğu için zincir bozulabilir ama karmaşıklığı artırmayalım.
    
    await client.query('DELETE FROM files WHERE file_id = $1', [fileId]);
    await client.query('COMMIT');
    
    res.status(200).json({
      message: 'Dosya kaydı silindi',
      storagePath: file.storage_path
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Dosya silme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  } finally {
    client.release();
  }
};