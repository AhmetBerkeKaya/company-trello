// api/controllers/reportController.js
const PDFDocument = require('pdfkit');
const axios = require('axios');
const pool = require('../db');

exports.generateProjectReport = async (req, res) => {
  const { projectId } = req.params;
  const { userId, companyId } = req.user;

  try {
    // 1. VERİLERİ ÇEK
    const projectQuery = `
      SELECT p.*, c.name as company_name, c.logo_url, c.brand_color,
      u.name as manager_name
      FROM projects p
      JOIN companies c ON p.company_id = c.company_id
      LEFT JOIN users u ON p.project_manager = u.user_id
      WHERE p.project_id = $1
    `;
    const projectRes = await pool.query(projectQuery, [projectId]);
    
    if (projectRes.rows.length === 0) return res.status(404).json({ message: 'Project not found' });
    const project = projectRes.rows[0];

    // Yetki Kontrolü
    if (project.company_id !== companyId && req.user.role !== 'admin') {
       return res.status(403).json({ message: 'Unauthorized access' });
    }

    // İstatistikler
    const statsQuery = `
      SELECT
        pp.name AS phase_name,
        COUNT(t.task_id) AS total_tasks,
        SUM(t.estimated_cost) AS total_estimated,
        SUM(t.actual_cost) AS total_actual,
        COUNT(CASE WHEN t.status = 'completed' THEN 1 END) AS completed_tasks
      FROM project_phases pp
      LEFT JOIN project_columns pc ON pp.phase_id = pc.phase_id
      LEFT JOIN tasks t ON t.status = pc.column_id::text
      WHERE pp.project_id = $1
      GROUP BY pp.phase_id, pp.name
    `;
    const statsRes = await pool.query(statsQuery, [projectId]);

    // Riskli Görevler
    const risksQuery = `
        SELECT title, due_date, assignee_user_id, status 
        FROM tasks 
        WHERE project_id = $1 
        AND status != 'completed' 
        AND due_date IS NOT NULL
        AND due_date <= (CURRENT_DATE + INTERVAL '3 days')
        ORDER BY due_date ASC
        LIMIT 10
    `;
    const risksRes = await pool.query(risksQuery, [projectId]);

    // 2. PDF OLUŞTURMA (Standart Fontlar Kullanılıyor)
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    // Header ayarları
    res.setHeader('Content-Type', 'application/pdf');
    const safeProjectCode = (project.project_code || 'Report').replace(/[^a-zA-Z0-9-_]/g, '');
    res.setHeader('Content-Disposition', `attachment; filename=Report-${safeProjectCode}.pdf`);

    doc.pipe(res);

    // --- TASARIM (İNGİLİZCE) ---

    // A. Logo
    if (project.logo_url) {
        try {
            const imageResponse = await axios.get(project.logo_url, { responseType: 'arraybuffer' });
            const logoImage = Buffer.from(imageResponse.data, 'base64');
            doc.image(logoImage, 50, 45, { width: 50 });
        } catch (e) {
            console.log("Logo could not be loaded, skipping.");
        }
    }

    // B. Başlıklar
    doc
      .fontSize(20)
      .text(project.name, 50, 50, { align: 'center' })
      .fontSize(10)
      .text(project.project_code || '', { align: 'center' })
      .moveDown(2);

    // C. Yönetici Özeti (Executive Summary)
    doc.fontSize(14).text('Executive Summary', { underline: true }).moveDown(0.5);
    
    const summaryY = doc.y;
    doc.fontSize(10);
    
    doc.text(`Project Manager: ${project.manager_name || 'N/A'}`, 50, summaryY);
    doc.text(`Start Date: ${project.start_date ? new Date(project.start_date).toLocaleDateString('en-GB') : '-'}`, 300, summaryY);
    
    doc.text(`Status: ${project.status === 'active' ? 'Active' : 'Inactive'}`, 50, summaryY + 15);
    doc.text(`End Date: ${project.end_date ? new Date(project.end_date).toLocaleDateString('en-GB') : '-'}`, 300, summaryY + 15);
    
    doc.moveDown(3);

    // D. Finansal Durum (Financial Overview)
    doc.fontSize(14).text('Financial Status & Progress', { underline: true }).moveDown(1);

    let totalBudget = 0;
    let totalSpent = 0;
    let totalTasks = 0;
    let totalCompleted = 0;

    statsRes.rows.forEach(row => {
        totalBudget += parseFloat(row.total_estimated || 0);
        totalSpent += parseFloat(row.total_actual || 0);
        totalTasks += parseInt(row.total_tasks || 0);
        totalCompleted += parseInt(row.completed_tasks || 0);
    });

    const completionRate = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;
    const budgetStatus = totalBudget - totalSpent;

    // Kutu Çizimi
    const boxTop = doc.y;
    doc.rect(50, boxTop, 495, 60).stroke('#e2e8f0');
    
    // Değerler
    doc.fontSize(10).fillColor('#64748b').text('TOTAL BUDGET', 70, boxTop + 15);
    doc.fontSize(12).fillColor('#000000').text(`${totalBudget.toLocaleString('en-US', { style: 'currency', currency: 'USD' }).replace('$', '₺')}`, 70, boxTop + 30);

    doc.fontSize(10).fillColor('#64748b').text('SPENT', 200, boxTop + 15);
    doc.fontSize(12).fillColor('#000000').text(`${totalSpent.toLocaleString('en-US', { style: 'currency', currency: 'USD' }).replace('$', '₺')}`, 200, boxTop + 30);

    doc.fontSize(10).fillColor('#64748b').text('REMAINING', 330, boxTop + 15);
    doc.fontSize(12)
       .fillColor(budgetStatus < 0 ? 'red' : 'green')
       .text(`${budgetStatus.toLocaleString('en-US', { style: 'currency', currency: 'USD' }).replace('$', '₺')}`, 330, boxTop + 30);

    doc.fontSize(10).fillColor('#64748b').text('PROGRESS', 450, boxTop + 15);
    doc.fontSize(12).fillColor('#000000').text(`%${completionRate}`, 450, boxTop + 30);

    doc.fillColor('black').moveDown(4);

    // E. Riskli Görevler (Risks)
    if (risksRes.rows.length > 0) {
        doc.fontSize(14).text('⚠️ Risky / Overdue Tasks', { underline: true }).moveDown(0.5);
        
        risksRes.rows.forEach((task, i) => {
            const date = new Date(task.due_date).toLocaleDateString('en-GB');
            // Türkçe karakterleri basitçe İngilizceye çevirmeyi deneyebiliriz ama en temizi data'nın düzgün olmasıdır.
            doc.fontSize(10).text(`${i + 1}. ${task.title} (Due: ${date}) - ${task.status}`);
        });
    } else {
        doc.fontSize(10).fillColor('green').text('Great! No risky or overdue tasks found.');
        doc.fillColor('black');
    }

    // F. Footer
    doc.fontSize(8).text(
        `This report was generated by ProAEC system on ${new Date().toLocaleString('en-GB')}.`,
        50,
        750,
        { align: 'center', color: 'grey' }
    );

    doc.end();

  } catch (error) {
    console.error('Report error:', error);
    if (!res.headersSent) res.status(500).json({ message: 'Could not generate report' });
  }
};