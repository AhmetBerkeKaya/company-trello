// api/index.js
require('dotenv').config(); // .env dosyasını en başta yükle
const express = require('express');
const cors = require('cors');
const pool = require('./db'); 
const authMiddleware = require('./middleware/authMiddleware');
const fileController = require('./controllers/fileController');
// --- YENİ ---
// Rotaları import et
const authRoutes = require('./routes/authRoutes');
const projectRoutes = require('./routes/projectRoutes'); // YENİ
const meetingRoutes = require('./routes/meetingRoutes'); // YENİ
const taskRoutes = require('./routes/taskRoutes');       // YENİ
const userRoutes = require('./routes/userRoutes');       // YENİ
const companyRoutes = require('./routes/companyRoutes'); // YENİ
const fileRoutes = require('./routes/fileRoutes'); // YENİ
const notificationRoutes = require('./routes/notificationRoutes'); // YENİ
const meetingRequestRoutes = require('./routes/meetingRequestRoutes');
const columnRoutes = require('./routes/columnRoutes');
const phaseRoutes = require('./routes/phaseRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();
const port = process.env.API_PORT || 5000;
const apsController = require('./controllers/apsController');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() }); // Dosyayı hafızada tut

// Middleware'ler
app.use(cors()); 
app.use(express.json()); 

// --- YENİ ---
// Ana API Rotaları
app.use('/api', columnRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes); // YENİ
app.use('/api/meetings', meetingRoutes); // YENİ
app.use('/api/tasks', taskRoutes);       // YENİ
app.use('/api/users', userRoutes);       // YENİ
app.use('/api/companies', companyRoutes); // YENİ
app.use('/api/files', fileRoutes); // YENİ
app.use('/api/notifications', notificationRoutes); // YENİ
app.use('/api/meeting-requests', meetingRequestRoutes); // YENİ
app.use('/api', columnRoutes);
app.use('/api', phaseRoutes);
app.use('/api/phases', phaseRoutes);
app.use('/api/reports', reportRoutes);
app.get('/api/files/:fileId', authMiddleware, fileController.getFileById);
app.delete('/api/files/:fileId', authMiddleware, fileController.deleteFileRecord);


app.get('/api/aps/token', apsController.getPublicToken);
app.post('/api/aps/upload', upload.single('file'), apsController.uploadAndTranslate);

// Basit bir test yolu
app.get('/api', (req, res) => {
  res.send('ProAEC Works API Çalışıyor!');
});

// Sunucuyu başlat
app.listen(port, () => {
  console.log(`Sunucu http://localhost:${port} adresinde çalışıyor`);
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('Veritabanı bağlantı hatası!', err.stack);
    } else {
      console.log('PostgreSQL veritabanına başarıyla bağlanıldı:', res.rows[0].now);
    }
  });
});