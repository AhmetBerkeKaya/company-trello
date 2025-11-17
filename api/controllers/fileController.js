// api/controllers/fileController.js
const pool = require('../db');

// GET /api/tasks/:taskId/files
exports.getFilesForTask = async (req, res) => {
  const { taskId } = req.params;

  try {
    const query = `
      SELECT * FROM files 
      WHERE task_id = $1 
      ORDER BY uploaded_at DESC
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

// POST /api/tasks/:taskId/files
// (FileUpload.js, Firebase'e yükledikten sonra bu API'yi çağıracak)
exports.addFileRecord = async (req, res) => {
  const { taskId } = req.params;
  const { name, url, storagePath, size, type, projectId } = req.body;
  const uploadedByUserId = req.user.userId;

  try {
    const query = `
      INSERT INTO files (name, url, storage_path, size, type, task_id, project_id, uploaded_by_user_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const { rows } = await pool.query(query, [
      name, url, storagePath, size, type, taskId, projectId, uploadedByUserId
    ]);
    
    res.status(201).json({ ...rows[0], id: rows[0].file_id });
  } catch (error) {
    console.error('Dosya kaydı ekleme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};


exports.deleteFileRecord = async (req, res) => {
  const { fileId } = req.params;
  const { userId, role } = req.user;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Dosyayı al (yetki ve 'storage_path' için)
    const fileQuery = `SELECT uploaded_by_user_id, storage_path FROM files WHERE file_id = $1 FOR UPDATE`;
    const fileRes = await client.query(fileQuery, [fileId]);

    if (fileRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Dosya kaydı bulunamadı' });
    }

    const file = fileRes.rows[0];

    // YETKİLENDİRME (Admin, Manager veya Dosyayı Yükleyen)
    const canDelete = role === 'admin' || role === 'manager' || file.uploaded_by_user_id === userId;

    if (!canDelete) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Bu dosyayı silme yetkiniz yok' });
    }
    
    // Yetkisi varsa, SİL.
    await client.query('DELETE FROM files WHERE file_id = $1', [fileId]);

    await client.query('COMMIT');
    
    // ÖNEMLİ: React'a, Firebase Storage'dan silmesi için 'storage_path'i yolluyoruz
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