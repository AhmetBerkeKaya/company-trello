// api/controllers/companyController.js
const pool = require('../db');

// GET /api/companies (DÜZELTİLDİ: Artık proje istatistiklerini de içeriyor)
exports.getAllCompanies = async (req, res) => {
  try {
    // Bu SQL sorgusu, 'companies' tablosunu 'projects' tablosuyla (LEFT JOIN) birleştirir,
    // her firmayı (GROUP BY) gruplar ve o gruba ait projeleri sayar (COUNT).
    // N+1 sorgusu yerine TEK BİR sorgu atarız.
    const query = `
      SELECT
        c.company_id,
        c.name,
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
    
    // Veriyi React'ın 'id' formatına ve sayı formatına (parseInt) çevirelim
    const companies = rows.map(company => ({
      id: company.company_id, // React uyumluluğu için
      company_id: company.company_id, // Orijinal ID (UUID)
      name: company.name,
      created_at: company.created_at,
      created_by_user_id: company.created_by_user_id,
      created_by_name: company.created_by_name,
      // COUNT'tan dönen string'leri sayıya çevir
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

// POST /api/companies (Değişiklik yok, bu zaten doğruydu)
exports.createCompany = async (req, res) => {
  const { name } = req.body;
  const createdByUserId = req.user.userId;
  const createdByName = req.user.name; 

  if (!name) {
    return res.status(400).json({ message: 'Firma adı gereklidir' });
  }
  try {
    const query = `
      INSERT INTO companies (name, created_by_user_id, created_by_name)
      VALUES ($1, $2, $3)
      RETURNING * `;
    const { rows } = await pool.query(query, [name, createdByUserId, createdByName]);
    const newCompany = rows[0];
    
    res.status(201).json({
      ...newCompany,
      id: newCompany.company_id
    });
  } catch (error) {
    if (error.code === '23505') { 
      return res.status(409).json({ message: 'Bu isimde bir firma zaten mevcut' });
    }
    console.error('Firma oluşturma hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// YENİ: GET /api/companies/:companyId/projects
// (Bir firmanın proje geçmişini getirir - Customers.js için)
exports.getProjectsForCompany = async (req, res) => {
  const { companyId } = req.params;
  
  try {
    // 'Customers.js'in ihtiyaç duyduğu alanlar: id, title, createdAt, status
    const query = `
      SELECT project_id, name AS title, created_at, status 
      FROM projects
      WHERE company_id = $1
      ORDER BY created_at DESC
    `;
    const { rows } = await pool.query(query, [companyId]);
    
    // 'project_id'yi 'id'ye de kopyala
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


exports.bulkCreateCompanies = async (req, res) => {
  const { companies } = req.body; 
  // companies dizisi artık şöyle gelecek: 
  // [{ name: "ABC Ltd", tax_no: "123", address: "..." }, ...]
  
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
      // Backend Validasyonu (Son güvenlik kapısı)
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
        if (err.code === '23505') { // Unique constraint (İsim çakışması)
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


exports.createCompany = async (req, res) => {
  // Frontend'den gelen tüm alanları alıyoruz
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
      name,
      tax_no || null,
      tax_office || null,
      mersis_no || null,
      phone || null,
      email || null,
      address || null,
      authorized_person || null,
      createdByUserId,
      createdByName
    ]);

    const newCompany = rows[0];
    
    res.status(201).json({
      ...newCompany,
      id: newCompany.company_id
    });
  } catch (error) {
    if (error.code === '23505') { 
      return res.status(409).json({ message: 'Bu isimde bir firma zaten mevcut' });
    }
    console.error('Firma oluşturma hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};