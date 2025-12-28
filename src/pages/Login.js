// src/pages/Login.js
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/UI/LoadingSpinner';

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
      
      // 2. YÖNLENDİRME (GÜNCELLENDİ)
      // Artık ayrım yok. Müşteri de olsa, personel de olsa ana akışa dahil oluyor.
      // İçerik, kullanıcının rolüne göre (ProjectDetail vb. sayfalarda) kısıtlanacak.
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-blue-600 py-6 px-8">
          <h2 className="text-center text-3xl font-extrabold text-white">
            ProAEC Works
          </h2>
          <p className="mt-2 text-center text-blue-100 text-sm">
            PROAEC Şirket İçi Proje Yönetim Sistemi
          </p>
        </div>
        
        <div className="py-8 px-8">
          <div className="text-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Sisteme Giriş Yapın</h3>
            <p className="text-gray-600 text-sm mt-1">
              Lütfen hesap bilgilerinizle giriş yapın
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                E-posta Adresi
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="ornek@proaec.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Şifre
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Şifreniz"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {isLoading ? (
                  <LoadingSpinner size="small" />
                ) : (
                  'Giriş Yap'
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