// api/controllers/reportController.js
const PDFDocument = require('pdfkit');
const axios = require('axios');
const pool = require('../db');

// Türkçe karakter düzeltici
const sanitizeText = (text) => {
    if (!text) return '';
    return text.toString()
        .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
        .replace(/ü/g, 'u').replace(/Ü/g, 'U')
        .replace(/ş/g, 's').replace(/Ş/g, 'S')
        .replace(/ı/g, 'i').replace(/İ/g, 'I')
        .replace(/ö/g, 'o').replace(/Ö/g, 'O')
        .replace(/ç/g, 'c').replace(/Ç/g, 'C');
};

exports.generateProjectReport = async (req, res) => {
  const { projectId } = req.params;
  const { 
    includeFinancials = 'true', 
    includeRisks = 'true', 
    includePhases = 'true', 
    includeWeekly = 'true' 
  } = req.query;

  const showFinancials = includeFinancials === 'true';
  const showRisks = includeRisks === 'true';
  const showPhases = includePhases === 'true';
  const showWeekly = includeWeekly === 'true';

  const { userId, companyId } = req.user;

  try {
    // 1. PROJE VE GENEL BİLGİLER
    const projectQuery = `
      SELECT p.*, c.name as company_name, c.logo_url, c.brand_color, u.name as manager_name
      FROM projects p
      JOIN companies c ON p.company_id = c.company_id
      LEFT JOIN users u ON p.project_manager = u.user_id
      WHERE p.project_id = $1
    `;
    const projectRes = await pool.query(projectQuery, [projectId]);
    if (projectRes.rows.length === 0) return res.status(404).json({ message: 'Proje bulunamadı' });
    const project = projectRes.rows[0];

    // Yetki Kontrolü
    const isMemberQuery = `SELECT 1 FROM project_users WHERE project_id = $1 AND user_id = $2`;
    const memberCheck = await pool.query(isMemberQuery, [projectId, userId]);
    
    if (project.company_id !== companyId && req.user.role !== 'admin' && !memberCheck.rows.length) {
       return res.status(403).json({ message: 'Yetkisiz erişim' });
    }

    // 2. İSTATİSTİKLER (FAZ BAZLI) - DÜZELTİLDİ
    // Görevin statüsü 'completed' stringi değil, sütun ID'sidir. 
    // Bu yüzden Sütun başlığına (pc.title) bakarak sayım yapıyoruz.
    const statsQuery = `
      SELECT 
        pp.name AS phase_name, 
        COUNT(t.task_id) AS total_tasks,
        COALESCE(SUM(t.estimated_cost), 0) AS total_estimated,
        COALESCE(SUM(t.actual_cost), 0) AS total_actual,
        COUNT(CASE 
            WHEN LOWER(pc.title) IN ('tamamlandı', 'done', 'biten', 'completed') THEN 1 
            ELSE NULL 
        END) AS completed_tasks
      FROM project_phases pp
      LEFT JOIN project_columns pc ON pp.phase_id = pc.phase_id
      LEFT JOIN tasks t ON t.status = pc.column_id::text
      WHERE pp.project_id = $1
      GROUP BY pp.phase_id, pp.name
    `;
    const statsRes = await pool.query(statsQuery, [projectId]);

    // 3. HAFTALIK İLERLEME RAPORU - DÜZELTİLDİ
    // Burada da 'completed' kontrolünü sütun adı üzerinden yapıyoruz.
    let weeklyRes = { rows: [] };
    if (showWeekly) {
        const weeklyQuery = `
            SELECT 
                DATE_TRUNC('week', t.updated_at)::date as week_start,
                COUNT(*) as tasks_completed,
                SUM(t.actual_cost) as cost_incurred
            FROM tasks t
            JOIN project_columns pc ON t.status = pc.column_id::text
            WHERE t.project_id = $1 
            AND LOWER(pc.title) IN ('tamamlandı', 'done', 'biten', 'completed')
            GROUP BY 1
            ORDER BY 1 DESC
            LIMIT 12
        `;
        weeklyRes = await pool.query(weeklyQuery, [projectId]);
    }

    // 4. RİSKLİ GÖREVLER - DÜZELTİLDİ
    // Tamamlanmamış görevleri bulmak için "Tamamlandı" sütununda OLMAYANLARI çekiyoruz.
    let risksRes = { rows: [] };
    if (showRisks) {
        const risksQuery = `
            SELECT t.title, t.due_date, u.name as assignee_name, pc.title as status 
            FROM tasks t
            LEFT JOIN users u ON t.assignee_user_id = u.user_id
            LEFT JOIN project_columns pc ON t.status = pc.column_id::text
            WHERE t.project_id = $1 
            AND (LOWER(pc.title) NOT IN ('tamamlandı', 'done', 'biten', 'completed') OR pc.title IS NULL)
            AND t.due_date IS NOT NULL 
            AND t.due_date <= (CURRENT_DATE + INTERVAL '7 days')
            ORDER BY t.due_date ASC LIMIT 10
        `;
        risksRes = await pool.query(risksQuery, [projectId]);
    }

    // --- PDF OLUŞTURMA (Tasarım Aynı) ---
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    const safeName = sanitizeText(project.name).replace(/[^a-zA-Z0-9]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename=Detayli_Rapor_${safeName}.pdf`);
    doc.pipe(res);

    const brandColor = project.brand_color || '#2563EB';
    const lightGray = '#f1f5f9';

    // Yardımcılar...
    const drawHeader = (text, y) => {
        doc.rect(50, y, 5, 20).fill(brandColor);
        doc.fontSize(12).fillColor('black').font('Helvetica-Bold').text(text.toUpperCase(), 65, y + 5);
        return y + 35;
    };
    const drawRow = (y, cols, isHeader = false) => {
        if (isHeader) doc.rect(50, y, 495, 20).fill(lightGray);
        else doc.rect(50, y + 19, 495, 1).fill('#e2e8f0');
        doc.fillColor(isHeader ? 'black' : '#334155').font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
        let x = 60;
        cols.forEach((col, i) => {
            const width = [200, 100, 100, 80][i] || 100;
            doc.text(sanitizeText(col), x, y + 6, { width: width, align: 'left' });
            x += width;
        });
        return y + 20;
    };

    // KAPAK
    let cursorY = 50;
    if (project.logo_url) {
        try {
            const img = await axios.get(project.logo_url, { responseType: 'arraybuffer' });
            doc.image(img.data, 50, 45, { width: 60 });
            cursorY = 120;
        } catch (e) {}
    } else { cursorY = 80; }

    doc.fontSize(22).font('Helvetica-Bold').text(sanitizeText(project.name), 50, cursorY - 60, { align: 'right' });
    doc.fontSize(10).font('Helvetica').fillColor('gray').text('DETAILED PROJECT REPORT', 50, cursorY - 30, { align: 'right' });
    doc.moveTo(50, cursorY).lineTo(545, cursorY).strokeColor('gray').lineWidth(0.5).stroke();
    cursorY += 20;

    cursorY = drawHeader('EXECUTIVE SUMMARY', cursorY);
    doc.font('Helvetica').fontSize(10).fillColor('black');
    doc.text(`Manager: ${sanitizeText(project.manager_name)}`, 60, cursorY);
    doc.text(`Status: ${project.status === 'active' ? 'Active' : 'Completed'}`, 300, cursorY);
    cursorY += 15;
    doc.text(`Start Date: ${new Date(project.created_at).toLocaleDateString('en-GB')}`, 60, cursorY);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 300, cursorY);
    cursorY += 40;

    if (showFinancials) {
        cursorY = drawHeader('FINANCIAL OVERVIEW', cursorY);
        let tBudget = 0, tSpent = 0;
        statsRes.rows.forEach(r => { tBudget += parseFloat(r.total_estimated); tSpent += parseFloat(r.total_actual); });
        
        const drawBox = (x, title, val, color) => {
            doc.rect(x, cursorY, 110, 50).fill(lightGray).stroke();
            doc.fillColor('gray').fontSize(8).text(title, x+10, cursorY+10);
            doc.fillColor(color).fontSize(12).font('Helvetica-Bold').text(val, x+10, cursorY+25);
        };
        drawBox(50, 'TOTAL BUDGET', `${tBudget.toLocaleString()} TL`, 'black');
        drawBox(170, 'TOTAL SPENT', `${tSpent.toLocaleString()} TL`, 'black');
        drawBox(290, 'REMAINING', `${(tBudget-tSpent).toLocaleString()} TL`, (tBudget-tSpent)<0?'red':'green');
        
        // Progress Bar
        const totalTasks = statsRes.rows.reduce((acc, r) => acc + parseInt(r.total_tasks), 0);
        const completedTasks = statsRes.rows.reduce((acc, r) => acc + parseInt(r.completed_tasks), 0);
        const progress = totalTasks > 0 ? Math.round((completedTasks/totalTasks)*100) : 0;
        
        doc.rect(420, cursorY + 15, 100, 10).fill('white').stroke();
        doc.rect(420, cursorY + 15, progress, 10).fill(brandColor);
        doc.fillColor('black').fontSize(10).text(`%${progress} Complete`, 420, cursorY+30, {width: 100, align:'center'}); // Yüzdeyi buraya yazar

        cursorY += 80;
    }

    if (showWeekly && weeklyRes.rows.length > 0) {
        if (cursorY > 600) { doc.addPage(); cursorY = 50; }
        cursorY = drawHeader('WEEKLY BREAKDOWN', cursorY);
        cursorY = drawRow(cursorY, ['WEEK OF', 'COMPLETED TASKS', 'COST INCURRED', 'STATUS'], true);
        weeklyRes.rows.forEach(week => {
            const dateStr = new Date(week.week_start).toLocaleDateString('en-GB');
            const costStr = parseFloat(week.cost_incurred || 0).toLocaleString() + ' TL';
            const performance = parseInt(week.tasks_completed) > 2 ? 'High' : 'Normal'; 
            cursorY = drawRow(cursorY, [dateStr, `${week.tasks_completed} Tasks`, costStr, performance]);
        });
        cursorY += 30;
    }

    if (showPhases) {
        if (cursorY > 600) { doc.addPage(); cursorY = 50; }
        cursorY = drawHeader('PHASE DETAILS', cursorY);
        cursorY = drawRow(cursorY, ['PHASE NAME', 'TASKS (Done/Total)', 'BUDGET', 'SPENT'], true);
        statsRes.rows.forEach(row => {
            const ratio = `${row.completed_tasks} / ${row.total_tasks}`;
            cursorY = drawRow(cursorY, [
                row.phase_name, ratio, 
                parseFloat(row.total_estimated).toLocaleString(), 
                parseFloat(row.total_actual).toLocaleString()
            ]);
        });
        cursorY += 30;
    }

    if (showRisks && risksRes.rows.length > 0) {
        if (cursorY > 600) { doc.addPage(); cursorY = 50; }
        cursorY = drawHeader('CRITICAL RISKS', cursorY);
        cursorY = drawRow(cursorY, ['TASK', 'ASSIGNEE', 'DUE DATE', 'STATUS'], true);
        risksRes.rows.forEach(task => {
            const d = new Date(task.due_date).toLocaleDateString('en-GB');
            const statusText = task.status ? task.status.toUpperCase() : 'TODO'; // Status ID yerine Title gelir
            cursorY = drawRow(cursorY, [task.title, task.assignee_name||'-', d, statusText]);
        });
    }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).fillColor('gray').text(
            `ProAEC System Report - Page ${i + 1} of ${range.count}`, 
            50, doc.page.height - 50, { align: 'center', width: 500 }
        );
    }

    doc.end();

  } catch (error) {
    console.error('Rapor hatası:', error);
    if(!res.headersSent) res.status(500).send('Rapor oluşturulamadı');
  }
};