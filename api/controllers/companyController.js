// api/controllers/companyController.js
const pool = require('../db');

// GET /api/companies
exports.getAllCompanies = async (req, res) => {
  try {
    const query = `
      SELECT
        c.company_id,
        c.name,
        c.tax_no,
        c.tax_office,
        c.mersis_no,
        c.phone,
        c.email,
        c.address,
        c.authorized_person,
        c.created_at,
        c.created_by_user_id,
        c.created_by_name,
        COUNT(p.project_id) AS total_projects,
        COUNT(CASE WHEN p.status = 'active' THEN 1 END) AS active_projects,
        COUNT(CASE WHEN p.status = 'completed' THEN 1 END) AS completed_projects
      FROM companies c
      LEFT JOIN projects p ON c.company_id = p.company_id
      GROUP BY c.company_id
      ORDER BY c.name ASC
    `;
    
    const { rows } = await pool.query(query);
    
    const companies = rows.map(company => ({
      id: company.company_id, 
      company_id: company.company_id,
      name: company.name,
      tax_no: company.tax_no,
      tax_office: company.tax_office,
      mersis_no: company.mersis_no,
      phone: company.phone,
      email: company.email,
      address: company.address,
      authorized_person: company.authorized_person,
      created_at: company.created_at,
      created_by_user_id: company.created_by_user_id,
      created_by_name: company.created_by_name,
      totalProjects: parseInt(company.total_projects, 10),
      activeProjects: parseInt(company.active_projects, 10),
      completedProjects: parseInt(company.completed_projects, 10)
    }));
    
    res.status(200).json(companies);
  } catch (error) {
    console.error('Firmaları getirme hatası (istatistikli):', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// GET /api/companies/:companyId/projects
exports.getProjectsForCompany = async (req, res) => {
  const { companyId } = req.params;
  
  try {
    const query = `
      SELECT project_id, name AS title, created_at, status 
      FROM projects
      WHERE company_id = $1
      ORDER BY created_at DESC
    `;
    const { rows } = await pool.query(query, [companyId]);
    
    const projects = rows.map(p => ({
      ...p,
      id: p.project_id
    }));
    
    res.status(200).json(projects);
  } catch (error) {
    console.error('Firma projelerini getirme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// POST /api/companies/bulk
exports.bulkCreateCompanies = async (req, res) => {
  const { companies } = req.body; 
  const createdByUserId = req.user.userId;
  const createdByName = req.user.name;

  if (!companies || !Array.isArray(companies) || companies.length === 0) {
    return res.status(400).json({ message: 'Liste boş veya geçersiz.' });
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const results = { successCount: 0, failCount: 0, errors: [] };

    for (const company of companies) {
      if (!company.name) {
        results.failCount++;
        results.errors.push({ row: company, error: 'Firma Adı eksik' });
        continue;
      }

      try {
        const query = `
          INSERT INTO companies (
            name, address, tax_no, tax_office, mersis_no, phone, email, authorized_person,
            created_by_user_id, created_by_name
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `;
        
        await client.query(query, [
          company.name, 
          company.address || null, 
          company.tax_no || null,
          company.tax_office || null, 
          company.mersis_no || null,
          company.phone || null,
          company.email || null,
          company.authorized_person || null,
          createdByUserId, 
          createdByName
        ]);
        
        results.successCount++;
      } catch (err) {
        if (err.code === '23505') { 
            results.failCount++;
            results.errors.push({ name: company.name, error: 'Bu firma zaten kayıtlı' });
        } else {
            console.error(err);
            results.failCount++;
            results.errors.push({ name: company.name, error: 'Veritabanı hatası' });
        }
      }
    }

    await client.query('COMMIT');
    res.status(200).json({ message: 'İşlem tamamlandı', ...results });

  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Sunucu hatası: ' + error.message });
  } finally {
    client.release();
  }
};

// POST /api/companies (TEK VE DOĞRU OLAN VERSİYON)
exports.createCompany = async (req, res) => {
  const { name, tax_no, tax_office, mersis_no, phone, email, address, authorized_person } = req.body;
  const createdByUserId = req.user.userId;
  const createdByName = req.user.name; 

  if (!name) {
    return res.status(400).json({ message: 'Firma adı gereklidir' });
  }

  try {
    const query = `
      INSERT INTO companies (
        name, tax_no, tax_office, mersis_no, phone, email, address, authorized_person,
        created_by_user_id, created_by_name
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING * `;
    
    const { rows } = await pool.query(query, [
      name, tax_no || null, tax_office || null, mersis_no || null, phone || null,
      email || null, address || null, authorized_person || null, createdByUserId, createdByName
    ]);

    const newCompany = rows[0];
    res.status(201).json({ ...newCompany, id: newCompany.company_id });
  } catch (error) {
    if (error.code === '23505') { 
      return res.status(409).json({ message: 'Bu isimde bir firma zaten mevcut' });
    }
    console.error('Firma oluşturma hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// PUT /api/companies/:id (DÜZELTİLDİ: updated_at çıkarıldı)
exports.updateCompany = async (req, res) => {
  const { id } = req.params;
  const { name, tax_no, tax_office, mersis_no, phone, email, address, authorized_person } = req.body;
  
  try {
    // updated_at = NOW() kısmını sildik çünkü tablomuzda bu sütun yok.
    const query = `
      UPDATE companies 
      SET name = $1, tax_no = $2, tax_office = $3, mersis_no = $4, 
          phone = $5, email = $6, address = $7, authorized_person = $8
      WHERE company_id = $9
      RETURNING *
    `;
    const values = [name, tax_no, tax_office, mersis_no, phone, email, address, authorized_person, id];
    const { rows } = await pool.query(query, values);
    
    if (rows.length === 0) return res.status(404).json({ message: 'Firma bulunamadı' });
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Firma güncelleme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// DELETE /api/companies/:id (YENİ EKLENDİ)
exports.deleteCompany = async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM companies WHERE company_id = $1', [id]);
    
    if (rowCount === 0) return res.status(404).json({ message: 'Firma bulunamadı' });
    res.status(200).json({ message: 'Firma başarıyla silindi' });
  } catch (error) {
    console.error('Firma silme hatası:', error);
    if (error.code === '23503') { // Foreign key kısıtlaması (Projeler bağlıysa)
      return res.status(400).json({ message: 'Bu firmaya bağlı projeler olduğu için silinemez. Lütfen önce projeleri silin.' });
    }
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};