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