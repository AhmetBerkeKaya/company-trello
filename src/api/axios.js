// src/api/axios.js
import axios from 'axios';

const api = axios.create({
  // API'mizin temel adresi (localhost:5000)
  baseURL: 'http://localhost:5000/api', 
});

// Bu bir "Interceptor" (Araya Girici)
// axios, bir isteği göndermeden HEMEN ÖNCE bu fonksiyonu çalıştırır.
api.interceptors.request.use(
  (config) => {
    // 1. localStorage'dan "token"ımızı al
    const token = localStorage.getItem('token');
    
    // 2. Eğer token varsa, isteğin "Authorization" header'ına ekle
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    // 3. Değiştirilmiş isteği gönder
    return config;
  },
  (error) => {
    // Hata olursa
    return Promise.reject(error);
  }
);

export default api;