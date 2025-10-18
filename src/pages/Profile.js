import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import LoadingSpinner from '../components/UI/LoadingSpinner';

const Profile = () => {
  const { userData, updateUserData } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    department: '',
    phone: '',
    bio: ''
  });

  // Şifre değiştirme state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (userData) {
      setFormData({
        name: userData.name || '',
        department: userData.department || '',
        phone: userData.phone || '',
        bio: userData.bio || ''
      });
    }
  }, [userData]);

  // Profil bilgilerini güncelle
  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSaveMessage('');

    try {
      await updateUserData(formData);
      setSaveMessage('✅ Profil bilgileriniz başarıyla güncellendi!');
      
      // 3 saniye sonra mesajı kaldır
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Profil güncelleme hatası:', error);
      setSaveMessage('❌ Profil güncellenirken bir hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Input değişikliklerini handle et
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Şifre input değişikliklerini handle et
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Rol etiketi
  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin': return 'Yönetici';
      case 'manager': return 'Proje Yöneticisi';
      case 'user': return 'Kullanıcı';
      default: return 'Kullanıcı';
    }
  };

  // Rol rengi
  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'manager': return 'bg-green-100 text-green-800 border-green-200';
      case 'user': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (!userData) {
    return (
      <div className="max-w-4xl mx-auto py-6 px-4">
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="large" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Profilim</h1>
        <p className="text-gray-600 mt-2">Hesap bilgilerinizi yönetin ve kişisel ayarlarınızı düzenleyin</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar - Kullanıcı Bilgileri */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 sticky top-6">
            {/* Kullanıcı Avatar ve Bilgiler */}
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
                {userData.name?.charAt(0) || userData.email?.charAt(0) || 'U'}
              </div>
              
              <h2 className="text-xl font-bold text-gray-900">{userData.name}</h2>
              <p className="text-gray-600 text-sm mt-1">{userData.email}</p>
              
              <div className="mt-3">
                <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getRoleColor(userData.role)}`}>
                  {getRoleLabel(userData.role)}
                </span>
              </div>

              {userData.department && (
                <p className="text-gray-500 text-sm mt-2">🏢 {userData.department}</p>
              )}

              {/* İstatistikler */}
              <div className="mt-6 space-y-3 text-left">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Üye Olma:</span>
                  <span className="font-medium">
                    {userData.createdAt?.toDate?.().toLocaleDateString('tr-TR') || 'Bilinmiyor'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Son Giriş:</span>
                  <span className="font-medium">
                    {userData.lastLogin?.toDate?.().toLocaleDateString('tr-TR') || 'Hiç'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {/* Tab Navigation */}
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6">
                {[
                  { id: 'profile', label: 'Profil Bilgileri', icon: '👤' },
                  { id: 'security', label: 'Güvenlik', icon: '🔒' },
                  { id: 'preferences', label: 'Tercihler', icon: '⚙️' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-4 border-b-2 font-medium text-sm transition-colors flex items-center space-x-2 ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {/* Profil Bilgileri Tab'ı */}
              {activeTab === 'profile' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">Profil Bilgileri</h3>
                  
                  {saveMessage && (
                    <div className={`p-4 rounded-lg mb-6 ${
                      saveMessage.includes('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                    }`}>
                      {saveMessage}
                    </div>
                  )}

                  <form onSubmit={handleProfileUpdate} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Ad Soyad *
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Departman
                        </label>
                        <input
                          type="text"
                          name="department"
                          value={formData.department}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Çalıştığınız departman"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Telefon
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="+90 5XX XXX XX XX"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Hakkımda
                      </label>
                      <textarea
                        name="bio"
                        value={formData.bio}
                        onChange={handleInputChange}
                        rows="4"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Kendinizden kısaca bahsedin..."
                      />
                    </div>

                    <div className="flex justify-end pt-4 border-t border-gray-200">
                      <button
                        type="submit"
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center space-x-2"
                      >
                        {loading && <LoadingSpinner size="small" />}
                        <span>Değişiklikleri Kaydet</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Güvenlik Tab'ı */}
              {activeTab === 'security' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">Hesap Güvenliği</h3>
                  
                  <div className="space-y-6">
                    {/* Şifre Değiştirme */}
                    <div className="bg-gray-50 rounded-lg p-6">
                      <h4 className="font-medium text-gray-900 mb-4">Şifre Değiştir</h4>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Mevcut Şifre
                          </label>
                          <input
                            type="password"
                            name="currentPassword"
                            value={passwordData.currentPassword}
                            onChange={handlePasswordChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Mevcut şifreniz"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Yeni Şifre
                          </label>
                          <input
                            type="password"
                            name="newPassword"
                            value={passwordData.newPassword}
                            onChange={handlePasswordChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="En az 6 karakter"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Yeni Şifre (Tekrar)
                          </label>
                          <input
                            type="password"
                            name="confirmPassword"
                            value={passwordData.confirmPassword}
                            onChange={handlePasswordChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Yeni şifrenizi tekrar girin"
                          />
                        </div>
                        
                        <button
                          disabled={true}
                          className="bg-gray-400 text-white px-6 py-2 rounded-lg font-medium cursor-not-allowed opacity-50"
                        >
                          Şifre Değiştir (Yakında)
                        </button>
                        
                        <p className="text-sm text-gray-500">
                          🔒 Şifre değiştirme özelliği yakında eklenecektir.
                        </p>
                      </div>
                    </div>

                    {/* Oturum Bilgileri */}
                    <div className="bg-gray-50 rounded-lg p-6">
                      <h4 className="font-medium text-gray-900 mb-4">Oturum Bilgileri</h4>
                      <div className="space-y-2 text-sm text-gray-600">
                        <p>🖥️ <strong>Son Giriş:</strong> {new Date().toLocaleString('tr-TR')}</p>
                        <p>🌐 <strong>IP Adresi:</strong> Sistemde kayıtlı değil</p>
                        <p>📍 <strong>Konum:</strong> Belirlenemedi</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tercihler Tab'ı */}
              {activeTab === 'preferences' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">Sistem Tercihleri</h3>
                  
                  <div className="space-y-6">
                    {/* Bildirim Ayarları */}
                    <div className="bg-gray-50 rounded-lg p-6">
                      <h4 className="font-medium text-gray-900 mb-4">Bildirim Ayarları</h4>
                      <div className="space-y-3">
                        {[
                          { id: 'email', label: 'E-posta Bildirimleri', description: 'Önemli güncellemeler ve toplantı hatırlatıcıları' },
                          { id: 'tasks', label: 'Görev Bildirimleri', description: 'Yeni görev atamaları ve görev güncellemeleri' },
                          { id: 'meetings', label: 'Toplantı Bildirimleri', description: 'Toplantı hatırlatıcıları ve değişiklikler' }
                        ].map(setting => (
                          <div key={setting.id} className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-gray-900">{setting.label}</div>
                              <div className="text-sm text-gray-500">{setting.description}</div>
                            </div>
                            <button
                              disabled={true}
                              className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-gray-200 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                            >
                              <span className="sr-only">Kullan</span>
                              <span
                                aria-hidden="true"
                                className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out translate-x-0"
                              />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Dil ve Bölge */}
                    <div className="bg-gray-50 rounded-lg p-6">
                      <h4 className="font-medium text-gray-900 mb-4">Dil ve Bölge</h4>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Dil
                          </label>
                          <select
                            disabled={true}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100"
                          >
                            <option>Türkçe</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Zaman Dilimi
                          </label>
                          <select
                            disabled={true}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100"
                          >
                            <option>Europe/Istanbul (UTC+3)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="text-center text-gray-500 text-sm">
                      ⚙️ Tercihler modülü yakında genişletilecektir.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Rol Bazlı İstatistikler */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Hesap İstatistikleri</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">0</div>
                <div className="text-sm text-gray-600">Aktif Proje</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">0</div>
                <div className="text-sm text-gray-600">Tamamlanan Görev</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">0</div>
                <div className="text-sm text-gray-600">Katıldığım Toplantı</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {userData.role === 'admin' ? '👑' : 
                   userData.role === 'manager' ? '📋' : '👤'}
                </div>
                <div className="text-sm text-gray-600 capitalize">{getRoleLabel(userData.role)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;