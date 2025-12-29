// src/contexts/AuthContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../api/axios'; // Bizim API istemcimiz

const AuthContext = createContext();

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null); // 'user_id' vb. tutar
  const [userData, setUserData] = useState(null);       // Tam kullanıcı objesi
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState('light');
  const applyBrandTheme = (userData) => {
    if (userData?.brand_color) {
      // CSS değişkenini güncelle (index.css içinde --brand-color tanımlayacağız)
      document.documentElement.style.setProperty('--brand-color', userData.brand_color);
    } else {
      // Varsayılan renk (Mavi - Tailwind blue-600 karşılığı)
      document.documentElement.style.setProperty('--brand-color', '#2563EB');
    }
  };
  // 1. LOGIN
  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, userData } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('userData', JSON.stringify(userData));

      setCurrentUser(userData);
      setUserData(userData);
      
      // TEMAYI VE MARKAYI UYGULA
      if (userData.theme) {
        setTheme(userData.theme);
        updateHtmlTheme(userData.theme);
      }
      applyBrandTheme(userData); // <-- YENİ EKLEME

      return response.data; 

    } catch (error) {
      // ... (hata yakalama aynı)
      throw error;
    }
  };

  // 3. OTURUM KONTROLÜ (Sayfa yenilendiğinde)
  useEffect(() => {
    // ... (önceki kodlar)
    const token = localStorage.getItem('token');
    const storedUserData = localStorage.getItem('userData');

    if (token && storedUserData) {
      try {
        const parsedData = JSON.parse(storedUserData);
        setCurrentUser(parsedData);
        setUserData(parsedData);
        
        if (parsedData.theme) {
          setTheme(parsedData.theme);
          updateHtmlTheme(parsedData.theme);
        }
        applyBrandTheme(parsedData); // <-- YENİ EKLEME (Sayfa yenilendiğinde rengi hatırla)

      } catch (error) {
        // ...
      }
    }
    setLoading(false);
  }, []);

  // 2. LOGOUT
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    setCurrentUser(null);
    setUserData(null);
    return Promise.resolve();
  };

  // 3. OTURUM KONTROLÜ
  useEffect(() => {
    // Tema kontrolü (localStorage'dan)
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    updateHtmlTheme(savedTheme);

    // Oturum kontrolü (localStorage'dan)
    const token = localStorage.getItem('token');
    const storedUserData = localStorage.getItem('userData');

    if (token && storedUserData) {
      try {
        const parsedData = JSON.parse(storedUserData);
        setCurrentUser(parsedData);
        setUserData(parsedData);
        // Kullanıcının veritabanındaki temasını da yükle
        if (parsedData.theme) {
          setTheme(parsedData.theme);
          updateHtmlTheme(parsedData.theme);
        }
      } catch (error) {
        console.error("Kullanıcı verisi parse edilemedi", error);
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
      }
    }
    
    setLoading(false);
  }, []);

  // --- YARDIMCI FONKSİYONLAR ---

  // updateUserData (Profile.js için)
  const updateUserData = async (updatedData) => {
    try {
      const response = await api.put('/users/me/profile', updatedData);
      
      const newUserData = response.data;
      setUserData(newUserData);
      setCurrentUser(newUserData); 
      localStorage.setItem('userData', JSON.stringify(newUserData));
      
      return true;
    } catch (error) {
      console.error('Profil güncelleme hatası (AuthContext):', error);
      throw error;
    }
  };

  // changePassword (Profile.js için)
  const changePassword = async (currentPassword, newPassword) => {
    try {
      await api.put('/users/me/password', { currentPassword, newPassword });
      return true;
    } catch (error) {
      console.error('Şifre değiştirme hatası (AuthContext):', error);
      throw error;
    }
  };

  // updateNotificationSettings (Profile.js için)
  const updateNotificationSettings = async (settings) => {
    try {
      const response = await api.put('/users/me/settings', { 
        notificationSettings: settings 
      });
      
      const newSettings = response.data.notification_settings;
      const updatedUserData = { ...userData, notification_settings: newSettings };
      
      setUserData(updatedUserData);
      localStorage.setItem('userData', JSON.stringify(updatedUserData));
      
      return true;
    } catch (error) {
      console.error('Bildirim ayarı kaydetme hatası (AuthContext):', error);
      throw error;
    }
  };

  // toggleTheme (Profile.js ve Navbar.js için)
  const toggleTheme = async (newTheme) => {
    const themeToSet = newTheme || (theme === 'light' ? 'dark' : 'light');
    
    // 1. Arayüzü hemen güncelle
    setTheme(themeToSet);
    localStorage.setItem('theme', themeToSet);
    updateHtmlTheme(themeToSet);

    try {
      // 2. API'ye kaydet
      await api.put('/users/me/settings', { 
        theme: themeToSet 
      });
      
      // 3. 'userData' state'ini güncelle
      const updatedUserData = { ...userData, theme: themeToSet };
      setUserData(updatedUserData);
      localStorage.setItem('userData', JSON.stringify(updatedUserData));
      
      return true;
    } catch (error) {
      console.error('Tema değiştirme hatası (AuthContext):', error);
    }
  };

  // HTML tag'ine 'dark' class'ı ekleyen yardımcı fonksiyon
  const updateHtmlTheme = (themeName) => {
    if (themeName === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const value = {
    currentUser,
    userData,
    login,
    logout,
    changePassword,
    updateUserData,
    updateNotificationSettings,
    toggleTheme,
    theme,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}