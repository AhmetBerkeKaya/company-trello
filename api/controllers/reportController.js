// api/controllers/reportController.js
const PDFDocument = require('pdfkit');
const axios = require('axios');
const pool = require('../db');

// Türkçe karakter düzeltici
const sanitizeText = (text) => {
    if (text === null || text === undefined) return '';
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

  const { userId, companyId, role } = req.user;

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

    const isMemberQuery = `SELECT 1 FROM project_users WHERE project_id = $1 AND user_id = $2`;
    const memberCheck = await pool.query(isMemberQuery, [projectId, userId]);
    
    if (project.company_id !== companyId && role !== 'admin' && !memberCheck.rows.length) {
       return res.status(403).json({ message: 'Yetkisiz erişim' });
    }

    // 2. İSTATİSTİKLER (Dashboard ile %100 Senkronize Edildi - HATA 2 ve 3 ÇÖZÜMÜ)
    const statsQuery = `
      SELECT
        pp.phase_id,
        pp.name AS phase_name,
        pc.column_id,
        pc.title AS column_title,
        pc.order_index,
        COUNT(t.task_id) AS task_count,
        SUM(t.estimated_cost) AS total_estimated_cost,
        SUM(t.actual_cost) AS total_actual_cost
      FROM project_phases pp
      JOIN project_columns pc ON pp.phase_id = pc.phase_id
      LEFT JOIN tasks t ON t.status = pc.column_id::text
      WHERE pp.project_id = $1
      GROUP BY pp.phase_id, pp.name, pc.column_id, pc.title, pc.order_index
      ORDER BY pp.order_index ASC
    `;
    const statsRes = await pool.query(statsQuery, [projectId]);

    let tBudget = 0, tSpent = 0, tTasks = 0, cTasks = 0;
    const phaseStats = [];
    const phasesMap = {};
    
    statsRes.rows.forEach(row => {
        if (!phasesMap[row.phase_id]) {
            phasesMap[row.phase_id] = { phase_name: row.phase_name, columns: [] };
        }
        phasesMap[row.phase_id].columns.push({
            count: parseInt(row.task_count),
            order: row.order_index,
            title: row.column_title,
            est_cost: parseFloat(row.total_estimated_cost || 0),
            act_cost: parseFloat(row.total_actual_cost || 0)
        });
    });

    Object.values(phasesMap).forEach(phase => {
        const cols = phase.columns.sort((a, b) => a.order - b.order);
        let p_total = 0, p_completed = 0, p_budget = 0, p_spent = 0;

        cols.forEach((col, index) => {
            p_total += col.count;
            p_budget += col.est_cost;
            p_spent += col.act_cost;
            
            const rawTitle = (col.title || '').toLowerCase();
            const normalizedTitle = rawTitle.replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g');

            if (normalizedTitle.includes('tamam') || normalizedTitle.includes('biten') || normalizedTitle.includes('bitti') || normalizedTitle.includes('done')) {
                p_completed += col.count;
            } else if (normalizedTitle.includes('yapilacak') || normalizedTitle.includes('bekleyen') || normalizedTitle.includes('todo') || normalizedTitle.includes('devam') || normalizedTitle.includes('suren') || normalizedTitle.includes('suruyor') || normalizedTitle.includes('progress')) {
                // Diğer durumlarda biten sayısını artırma
            } else {
                if (index === cols.length - 1) p_completed += col.count; // En son sütunsa bitmiş say
            }
        });

        tBudget += p_budget;
        tSpent += p_spent;
        tTasks += p_total;
        cTasks += p_completed;

        phaseStats.push({
            phase_name: phase.phase_name,
            total_tasks: p_total,
            completed_tasks: p_completed,
            total_estimated: p_budget,
            total_actual: p_spent
        });
    });

    // 3. HAFTALIK İLERLEME RAPORU
    let weeklyRes = { rows: [] };
    if (showWeekly) {
        const weeklyQuery = `
            SELECT DATE_TRUNC('week', t.updated_at)::date as week_start, COUNT(*) as tasks_completed, SUM(t.actual_cost) as cost_incurred
            FROM tasks t JOIN project_columns pc ON t.status = pc.column_id::text
            WHERE t.project_id = $1 AND (LOWER(pc.title) LIKE '%tamam%' OR LOWER(pc.title) LIKE '%biten%' OR LOWER(pc.title) LIKE '%done%')
            GROUP BY 1 ORDER BY 1 DESC LIMIT 12
        `;
        weeklyRes = await pool.query(weeklyQuery, [projectId]);
    }

    // 4. RİSKLİ GÖREVLER
    let risksRes = { rows: [] };
    if (showRisks) {
        const risksQuery = `
            SELECT t.title, t.due_date, u.name as assignee_name, pc.title as status 
            FROM tasks t LEFT JOIN users u ON t.assignee_user_id = u.user_id LEFT JOIN project_columns pc ON t.status = pc.column_id::text
            WHERE t.project_id = $1 AND (LOWER(pc.title) NOT LIKE '%tamam%' AND LOWER(pc.title) NOT LIKE '%biten%' AND LOWER(pc.title) NOT LIKE '%done%' OR pc.title IS NULL)
            AND t.due_date IS NOT NULL AND t.due_date <= (CURRENT_DATE + INTERVAL '7 days')
            ORDER BY t.due_date ASC LIMIT 10
        `;
        risksRes = await pool.query(risksQuery, [projectId]);
    }

    // --- PREMIUM PDF OLUŞTURMA ---
    const doc = new PDFDocument({ size: 'A4', bufferPages: true, margins: { top: 50, bottom: 0, left: 50, right: 50 } });
    res.setHeader('Content-Type', 'application/pdf');
    const safeName = sanitizeText(project.name).replace(/[^a-zA-Z0-9]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename=Detayli_Rapor_${safeName}.pdf`);
    doc.pipe(res);

    const brandColor = project.brand_color || '#2563EB'; 
    const textDark = '#1E293B'; 
    const textMuted = '#64748B'; 
    const borderLight = '#E2E8F0'; 
    const bgLight = '#F8FAFC'; 

    const drawSectionTitle = (text, y) => {
        if (y > 700) { doc.addPage(); y = 50; } 
        doc.roundedRect(50, y, 6, 18, 3).fill(brandColor);
        doc.fillColor(textDark).fontSize(12).font('Helvetica-Bold').text(text.toUpperCase(), 65, y + 3);
        return y + 40;
    };

    const drawStatCard = (x, y, title, value, valColor = textDark) => {
        doc.roundedRect(x, y, 140, 65, 8).fill(bgLight).strokeColor(borderLight).lineWidth(1).stroke();
        doc.fillColor(textMuted).fontSize(8).font('Helvetica-Bold').text(title.toUpperCase(), x + 15, y + 15);
        doc.fillColor(valColor).fontSize(14).font('Helvetica-Bold').text(value, x + 15, y + 35);
    };

    const drawPremiumTable = (startY, headers, rows, colWidths) => {
        let currentY = startY;
        doc.roundedRect(50, currentY, 495, 25, 4).fill(bgLight);
        doc.fillColor(textMuted).fontSize(8).font('Helvetica-Bold');
        let currentX = 60;
        headers.forEach((h, i) => {
            const align = i === headers.length - 1 ? 'right' : 'left';
            doc.text(h, currentX, currentY + 8, { width: colWidths[i], align });
            currentX += colWidths[i];
        });
        currentY += 35;

        doc.font('Helvetica').fontSize(9);
        rows.forEach((row) => {
            if (currentY > 720) { doc.addPage(); currentY = 50; }
            currentX = 60;
            doc.fillColor(textDark);
            row.forEach((cell, i) => {
                const align = i === row.length - 1 ? 'right' : 'left';
                doc.text(sanitizeText(cell), currentX, currentY, { width: colWidths[i], align });
                currentX += colWidths[i];
            });
            doc.moveTo(50, currentY + 20).lineTo(545, currentY + 20).strokeColor(borderLight).lineWidth(1).stroke();
            currentY += 30;
        });
        return currentY + 10;
    };

    // --- 1. SAYFA DİZGİSİ (KAPAK & ÖZET) ---
    // HATA 1 ÇÖZÜMÜ: Başlık Çarpışması Önleme
    doc.fillColor(brandColor).fontSize(14).font('Helvetica-Bold');
    doc.text(sanitizeText(project.company_name), 50, 50, { width: 230, align: 'left' });
    const yLeft = doc.y; // Firma adından sonraki Y noktası

    doc.fillColor(textDark).fontSize(18).font('Helvetica-Bold');
    doc.text(sanitizeText(project.name).toUpperCase(), 310, 50, { width: 235, align: 'right' });
    doc.fillColor(brandColor).fontSize(10).font('Helvetica-Bold').text('DETAYLI PROJE RAPORU', 310, doc.y + 5, { width: 235, align: 'right' });
    const yRight = doc.y; // Proje adından sonraki Y noktası

    // En aşağı inen hangisiyse, çizgiyi oradan çiz (Kesişme imkansız hale geldi)
    let cursorY = Math.max(yLeft, yRight) + 20;
    doc.moveTo(50, cursorY).lineTo(545, cursorY).strokeColor(borderLight).lineWidth(2).stroke();
    cursorY += 30;

    cursorY = drawSectionTitle('PROJE OZETI', cursorY);
    doc.roundedRect(50, cursorY, 495, 70, 8).fill(bgLight).strokeColor(borderLight).lineWidth(1).stroke();
    
    doc.fillColor(textMuted).fontSize(9).font('Helvetica-Bold');
    doc.text('PROJE YONETICISI', 70, cursorY + 15);
    doc.text('BASLANGIC TARIHI', 70, cursorY + 40);
    
    doc.text('PROJE DURUMU', 300, cursorY + 15);
    doc.text('RAPOR TARIHI', 300, cursorY + 40);

    doc.fillColor(textDark).font('Helvetica');
    doc.text(sanitizeText(project.manager_name || 'Atanmadi'), 180, cursorY + 15);
    doc.text(project.start_date ? new Date(project.start_date).toLocaleDateString('tr-TR') : 'Belirtilmedi', 180, cursorY + 40);
    
    const statusText = project.status === 'active' ? 'AKTIF' : project.status === 'completed' ? 'TAMAMLANDI' : 'BEKLEMEDE';
    const statusColor = project.status === 'active' ? '#16A34A' : project.status === 'completed' ? brandColor : '#EA580C';
    doc.fillColor(statusColor).font('Helvetica-Bold').text(statusText, 390, cursorY + 15);
    doc.fillColor(textDark).font('Helvetica').text(new Date().toLocaleDateString('tr-TR'), 390, cursorY + 40);
    cursorY += 100;

    if (showFinancials) {
        cursorY = drawSectionTitle('FINANSAL ANALIZ & ILERLEME', cursorY);
        const remaining = tBudget - tSpent;
        let progress = tTasks > 0 ? Math.round((cTasks / tTasks) * 100) : 0;
        if(progress > 100) progress = 100; // Güvenlik önlemi

        drawStatCard(50, cursorY, 'TOPLAM BUTCE', `${tBudget.toLocaleString('tr-TR')} TL`, textDark);
        drawStatCard(200, cursorY, 'GERCEKLESEN MALIYET', `${tSpent.toLocaleString('tr-TR')} TL`, textDark);
        drawStatCard(350, cursorY, 'KALAN BUTCE', `${remaining.toLocaleString('tr-TR')} TL`, remaining < 0 ? '#DC2626' : '#16A34A');
        
        cursorY += 85;

        doc.fillColor(textDark).fontSize(9).font('Helvetica-Bold').text('GENEL PROJE ILERLEMESI', 50, cursorY);
        doc.fillColor(brandColor).fontSize(14).text(`%${progress}`, 500, cursorY - 5, { align: 'right' });
        
        cursorY += 15;
        doc.roundedRect(50, cursorY, 495, 12, 6).fill(borderLight);
        if (progress > 0) {
            const barWidth = (495 * progress) / 100;
            doc.roundedRect(50, cursorY, barWidth, 12, 6).fill(brandColor);
        }
        cursorY += 45;
    }

    if (showPhases) {
        cursorY = drawSectionTitle('DISIPLIN (FAZ) DETAYLARI', cursorY);
        const headers = ['DISIPLIN ADI', 'IS (Biten/Toplam)', 'BUTCE (TL)', 'HARCANAN (TL)'];
        const colWidths = [180, 100, 100, 95];
        
        const rows = phaseStats.map(row => [
            row.phase_name,
            `${row.completed_tasks} / ${row.total_tasks}`,
            row.total_estimated.toLocaleString('tr-TR'),
            row.total_actual.toLocaleString('tr-TR')
        ]);
        cursorY = drawPremiumTable(cursorY, headers, rows, colWidths);
    }

    if (showWeekly && weeklyRes.rows.length > 0) {
        cursorY = drawSectionTitle('HAFTALIK ILERLEME & HIZ', cursorY);
        const headers = ['HAFTA BASLANGICI', 'BITEN GOREV', 'HAFTALIK MALIYET', 'PERFORMANS'];
        const colWidths = [120, 120, 130, 105];
        const rows = weeklyRes.rows.map(week => {
            const dateStr = new Date(week.week_start).toLocaleDateString('tr-TR');
            const costStr = parseFloat(week.cost_incurred || 0).toLocaleString('tr-TR') + ' TL';
            return [dateStr, `${week.tasks_completed} Gorev`, costStr, parseInt(week.tasks_completed) > 2 ? 'Yuksek' : 'Normal'];
        });
        cursorY = drawPremiumTable(cursorY, headers, rows, colWidths);
    }

    if (showRisks && risksRes.rows.length > 0) {
        cursorY = drawSectionTitle('KRITIK & GECIKEN ISLER', cursorY);
        const headers = ['GOREV ADI', 'SORUMLU', 'TERMIN', 'DURUM'];
        const colWidths = [180, 120, 95, 80];
        const rows = risksRes.rows.map(task => [
            task.title, 
            task.assignee_name || 'Atanmadi', 
            new Date(task.due_date).toLocaleDateString('tr-TR'), 
            task.status ? task.status.toUpperCase() : 'BEKLEYEN'
        ]);
        cursorY = drawPremiumTable(cursorY, headers, rows, colWidths);
    }

    // --- SAYFA NUMARALARI VE FOOTER ---
    const range = doc.bufferedPageRange();
    const A4_HEIGHT = 841.89; 
    for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        doc.moveTo(50, A4_HEIGHT - 60).lineTo(545, A4_HEIGHT - 60).strokeColor(borderLight).lineWidth(1).stroke();
        doc.fontSize(8).font('Helvetica').fillColor(textMuted).text(`ProAEC Proje Yonetim Sistemi`, 50, A4_HEIGHT - 45, { align: 'left', width: 250 });
        doc.text(`Sayfa ${i + 1} / ${range.count}`, 300, A4_HEIGHT - 45, { align: 'right', width: 245 });
    }
    doc.end();

  } catch (error) {
    console.error('Rapor hatası:', error);
    if(!res.headersSent) res.status(500).json({ message: 'Rapor oluşturulamadı' });
  }
};