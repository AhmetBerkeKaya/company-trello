// src/pages/Login.js
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import icon from './icon.png'; // aynı dizindeki icon.png

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // 1. Giriş işlemini yap
      await login(email, password);
      
      // 2. YÖNLENDİRME
      navigate('/'); 

    } catch (error) {
      console.error('Giriş hatası:', error);
      setError(getErrorMessage(error.code || 'auth/unknown'));
    } finally {
      setIsLoading(false);
    }
  };

  const getErrorMessage = (errorCode) => {
    const errorMessages = {
      'auth/invalid-email': 'Geçersiz e-posta adresi',
      'auth/user-disabled': 'Bu kullanıcı devre dışı bırakılmış',
      'auth/user-not-found': 'Kullanıcı bulunamadı',
      'auth/wrong-password': 'Yanlış şifre',
      'auth/too-many-requests': 'Çok fazla deneme yaptınız, lütfen bekleyin'
    };
    
    return errorMessages[errorCode] || 'Giriş başarısız, lütfen bilgilerinizi kontrol edin';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
      
      {/* --- Arka Plan Dekoratif Elementleri (Glassmorphism & Glow) --- */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[30rem] h-[30rem] bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full mix-blend-multiply filter blur-[100px] opacity-40 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-20 w-[30rem] h-[30rem] bg-gradient-to-tr from-cyan-300 to-blue-500 rounded-full mix-blend-multiply filter blur-[100px] opacity-40"></div>
      </div>

      {/* --- Ana Giriş Kartı --- */}
      <div className="max-w-md w-full z-10 bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white/60 overflow-hidden transition-all">
        
        <div className="py-10 px-8 sm:px-10">
          
          {/* Logo / Başlık Alanı */}
          <div className="text-center mb-10">

            {/* --- İkon --- */}
            <div className="flex justify-center mb-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-100/80 shadow-[0_4px_20px_rgba(37,99,235,0.15)] flex items-center justify-center p-1.5">
                <img
                  src={icon}
                  alt="ProAEC Logo"
                  className="w-full h-full object-contain drop-shadow-sm"
                />
              </div>
            </div>

            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-700 tracking-tight mb-2">
              ProAEC
            </h1>
            <p className="text-sm font-semibold text-gray-400 uppercase tracking-widest">
              Proje Yönetim Sistemi
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            
            {/* Hata Mesajı Kutusu */}
            {error && (
              <div className="bg-red-50/80 backdrop-blur-sm border-l-4 border-red-500 text-red-700 p-4 rounded-r-lg shadow-sm text-sm animate-fade-in">
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">{error}</span>
                </div>
              </div>
            )}
            
            {/* E-Posta Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1">
                E-posta Adresi
              </label>
              <div className="relative">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="block w-full pl-4 pr-4 py-3.5 bg-gray-50/50 border border-gray-200 text-gray-900 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ease-in-out sm:text-sm shadow-sm"
                  placeholder="ornek@proaec.com.tr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Şifre Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1">
                Şifre
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="block w-full pl-4 pr-4 py-3.5 bg-gray-50/50 border border-gray-200 text-gray-900 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ease-in-out sm:text-sm shadow-sm"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {/* Giriş Butonu */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center items-center py-3.5 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-300 shadow-[0_4px_14px_0_rgb(37,99,235,0.39)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.23)] hover:-translate-y-0.5"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <LoadingSpinner size="small" />
                    <span>Giriş Yapılıyor...</span>
                  </div>
                ) : (
                  'Sisteme Giriş Yap'
                )}
              </button>
            </div>
            
          </form>
        </div>
      </div>
      
    </div>
  );
};

export default Login;