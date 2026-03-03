// api/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db'); 
const authMiddleware = require('./middleware/authMiddleware');
const fileController = require('./controllers/fileController');

// Rotaları import et
const authRoutes = require('./routes/authRoutes');
const projectRoutes = require('./routes/projectRoutes');
const meetingRoutes = require('./routes/meetingRoutes');
const taskRoutes = require('./routes/taskRoutes');
const userRoutes = require('./routes/userRoutes');
const companyRoutes = require('./routes/companyRoutes');
const fileRoutes = require('./routes/fileRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const meetingRequestRoutes = require('./routes/meetingRequestRoutes');
const columnRoutes = require('./routes/columnRoutes');
const phaseRoutes = require('./routes/phaseRoutes');
const reportRoutes = require('./routes/reportRoutes');
const initScheduledJobs = require('./utils/scheduler');
initScheduledJobs();
const app = express();
const port = process.env.API_PORT || 5000;
const apsController = require('./controllers/apsController');
const multer = require('multer');

// 👇 GÜNCELLEME 1: Multer Limitini Artır (500MB)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024 } // 500 MB
});

// 👇 GÜNCELLEME 2: Body Parser Limitlerini Artır
app.use(cors()); 
app.use(express.json({ limit: '500mb' })); 
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// Rotalar
app.use('/api', columnRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/meeting-requests', meetingRequestRoutes);
app.use('/api', phaseRoutes);
app.use('/api/phases', phaseRoutes);
app.use('/api/reports', reportRoutes);

app.get('/api/files/:fileId', authMiddleware, fileController.getFileById);
app.delete('/api/files/:fileId', authMiddleware, fileController.deleteFileRecord);

app.get('/api/aps/token', apsController.getPublicToken);
// Upload rotası aynı
app.post('/api/aps/upload', upload.single('file'), apsController.uploadAndTranslate);

app.get('/api', (req, res) => {
  res.send('ProAEC Works API Çalışıyor!');
});

// 👇 GÜNCELLEME 3: Sunucu Zaman Aşımını Uzat (10 Dakika)
const server = app.listen(port, () => {
  console.log(`Sunucu http://localhost:${port} adresinde çalışıyor`);
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('Veritabanı bağlantı hatası!', err.stack);
    } else {
      console.log('PostgreSQL veritabanına başarıyla bağlanıldı:', res.rows[0].now);
    }
  });
});


server.setTimeout(600000); // 10 dakika (600,000 ms)