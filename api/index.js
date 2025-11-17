// api/index.js
require('dotenv').config(); // .env dosyasını en başta yükle
const express = require('express');
const cors = require('cors');
const pool = require('./db'); 

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


const app = express();
const port = process.env.API_PORT || 5000;

// Middleware'ler
app.use(cors()); 
app.use(express.json()); 

// --- YENİ ---
// Ana API Rotaları
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes); // YENİ
app.use('/api/meetings', meetingRoutes); // YENİ
app.use('/api/tasks', taskRoutes);       // YENİ
app.use('/api/users', userRoutes);       // YENİ
app.use('/api/companies', companyRoutes); // YENİ
app.use('/api/files', fileRoutes); // YENİ
app.use('/api/notifications', notificationRoutes); // YENİ
app.use('/api/meeting-requests', meetingRequestRoutes); // YENİ


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