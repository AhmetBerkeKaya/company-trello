// src/pages/AdminUsers.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios'; 
import LoadingSpinner from '../components/UI/LoadingSpinner';

const AdminUsers = () => {
  const { userData } = useAuth();
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [updatingUser, setUpdatingUser] = useState(null); 

  // Modal State'leri
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null); 
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', role: 'user', company_id: '', department: ''
  });

  const isObserver = userData?.role === 'observer';
  const isAdmin = userData?.role === 'admin';
  const canView = isAdmin || isObserver;

  useEffect(() => {
    if (canView) {
      fetchUsers();
      if (isAdmin) fetchCompanies(); 
    } else {
      setLoading(false);
    }
  }, [canView, isAdmin]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users');
      const usersData = response.data.map(user => ({
        ...user,
        createdAt: user.created_at ? new Date(user.created_at) : null,
        lastLoginAt: user.last_login_at ? new Date(user.last_login_at) : null
      }));
      usersData.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setUsers(usersData);
    } catch (error) {
      console.error('❌ Kullanıcıları getirme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const response = await api.get('/companies');
      setCompanies(response.data);
    } catch (error) {
      console.error('Firmaları getirme hatası:', error);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const openCreateModal = () => {
    setEditingUserId(null);
    setFormData({ name: '', email: '', password: '', role: 'user', company_id: '', department: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    setEditingUserId(user.user_id);
    setFormData({
      name: user.name || '',
      email: user.email || '',
      password: '', 
      role: user.role || 'user',
      company_id: user.company_id || '',
      department: user.department || ''
    });
    setIsModalOpen(true);
  };

  const handleDeleteUser = async (userId, userName) => {
    if (window.confirm(`"${userName}" isimli kullanıcıyı silmek istediğinize emin misiniz? Bu işlem geri alınamaz!`)) {
      try {
        await api.delete(`/users/${userId}`);
        fetchUsers();
      } catch (error) {
        alert('Silme hatası: ' + (error.response?.data?.message || error.message));
      }
    }
  };

  const handleSubmitUser = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingUserId) {
        await api.put(`/users/${editingUserId}`, formData);
      } else {
        await api.post('/users', formData);
      }
      setIsModalOpen(false);
      fetchUsers(); 
    } catch (error) {
      alert('Hata: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateUserRole = async (userId, newRole) => {
    if (isObserver) return;
    if (userId === userData.user_id) { 
      alert('Kendi rolünüzü değiştiremezsiniz!');
      return;
    }
    setUpdatingUser(userId);
    try {
      await api.put(`/users/${userId}/role`, { newRole });
      setUsers(prev => prev.map(user => user.user_id === userId ? { ...user, role: newRole } : user ));
    } catch (error) {
      alert('Rol güncellenirken hata oluştu: ' + (error.response?.data?.message || error.message));
    } finally {
      setUpdatingUser(null);
    }
  };

  const updateUserDepartment = async (userId, newDepartment) => {
    if (isObserver) return; 
    setUsers(prev => prev.map(user => user.user_id === userId ? { ...user, department: newDepartment } : user ));
    try {
      setUpdatingUser(userId); 
      await api.put(`/users/${userId}/department`, { newDepartment });
    } catch (error) {
      fetchUsers(); 
    } finally {
      setUpdatingUser(null); 
    }
  };
  
  const handleDepartmentChange = (userId, value) => {
     if (isObserver) return;
     setUsers(prev => prev.map(user => user.user_id === userId ? { ...user, department: value } : user ));
  };
  const handleDepartmentBlur = (userId, value) => {
     if (isObserver) return;
     updateUserDepartment(userId, value);
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300';
      case 'manager': return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
      case 'user': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
      case 'observer': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300'; 
      case 'client': return 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin': return 'Yönetici';
      case 'manager': return 'Proje Yöneticisi';
      case 'user': return 'Kullanıcı';
      case 'observer': return 'Gözlemci';
      case 'client': return 'Müşteri';
      default: return 'Kullanıcı';
    }
  };

  if (!canView) return <div className="text-center py-12 text-gray-600 dark:text-gray-400">Erişim Engellendi</div>;
  if (loading) return <div className="flex justify-center items-center h-64"><LoadingSpinner size="large" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        
        {/* --- Üst Başlık & Buton Alanı --- */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10 pb-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">Kullanıcı Yönetimi</h1>
              {isObserver && <span className="px-3.5 py-1.5 bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300 text-xs font-bold rounded-full shadow-sm">👁️ Gözlemci Modu</span>}
            </div>
            <p className="text-gray-600 dark:text-gray-400 mt-2.5 max-w-2xl text-base sm:text-lg">Sistem kullanıcılarını, departmanlarını ve erişim rollerini profesyonel olarak yönetin.</p>
          </div>
          
          {isAdmin && (
            <button 
              onClick={openCreateModal}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2.5 text-base active:scale-95 shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
              Yeni Kullanıcı Ekle
            </button>
          )}
        </div>

        {/* --- İstatistik Kartları --- */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6 mb-12">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-md transition-all p-6 text-center border border-gray-100 dark:border-gray-700 relative overflow-hidden group">
            <div className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">{users.length}</div>
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">Toplam Kullanıcı</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-md transition-all p-6 text-center border-t-4 border-purple-500 relative group">
            <div className="text-3xl font-extrabold text-purple-600 dark:text-purple-400 mb-2">{users.filter(u => u.role === 'admin').length}</div>
            <div className="text-[10px] sm:text-sm text-purple-900/70 dark:text-purple-300/80 font-semibold uppercase tracking-wider">Yönetici (Admin)</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-md transition-all p-6 text-center border-t-4 border-green-500 relative group">
            <div className="text-3xl font-extrabold text-green-600 dark:text-green-400 mb-2">{users.filter(u => u.role === 'manager').length}</div>
            <div className="text-[10px] sm:text-sm text-green-900/70 dark:text-green-300/80 font-semibold uppercase tracking-wider">Proje Yön. (Manager)</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-md transition-all p-6 text-center border-t-4 border-blue-500 relative group">
            <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 mb-2">{users.filter(u => u.role === 'user').length}</div>
            <div className="text-[10px] sm:text-sm text-blue-900/70 dark:text-blue-300/80 font-semibold uppercase tracking-wider">Kullanıcı (User)</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-md transition-all p-6 text-center border-t-4 border-teal-500 relative group">
            <div className="text-3xl font-extrabold text-teal-600 dark:text-teal-400 mb-2">{users.filter(u => u.role === 'client').length}</div>
            <div className="text-[10px] sm:text-sm text-teal-900/70 dark:text-teal-300/80 font-semibold uppercase tracking-wider">Müşteri (Client)</div>
          </div>
        </div>

        {/* --- Kullanıcı Listesi --- */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 dark:border-gray-700 overflow-hidden">
          {/* Mobilde Yatay Kaydırmayı Sağlayan Wrapper Eklendi */}
          <div className="overflow-x-auto custom-scrollbar">
            <div className="min-w-[1100px]">
              
              {/* HEADER */}
              <div className="px-8 py-4 bg-gray-50 dark:bg-gray-700/60 border-b border-gray-200 dark:border-gray-700 flex text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider items-center">
                <div className="flex-1">Kullanıcı Bilgileri</div>
                <div className="w-64 text-left px-4">Firma</div>
                <div className="w-32 text-center">Departman</div>
                <div className="w-40 text-center">Rol Değiştir</div>
                <div className="w-32 text-center">Durum</div>
                {isAdmin && <div className="w-24 text-center">İşlemler</div>}
              </div>

              {/* LİSTE */}
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {users.map(user => (
                  <div key={user.user_id} className="px-8 py-5 hover:bg-gray-50/70 dark:hover:bg-gray-700/40 transition-colors flex items-center justify-between">
                    
                    <div className="flex items-center space-x-5 flex-1 min-w-0">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-extrabold text-xl shadow-inner border-2 border-white dark:border-gray-800 shrink-0">
                        {user.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white text-lg flex items-center gap-2">
                          <span className="truncate">{user.name}</span>
                          {user.user_id === userData.user_id && <span className="px-2.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 text-[10px] font-bold rounded-full shrink-0">Siz</span>}
                        </h3>
                        <p className="text-base text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                      </div>
                    </div>

                    <div className="w-64 text-left px-4 shrink-0">
                      <div 
                        className="text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 inline-flex items-center max-w-full cursor-help"
                        title={user.company_name || 'Firma Yok'} 
                      >
                        <span className="mr-1.5">🏢</span>
                        <span className="truncate">{user.company_name || 'Firma Yok'}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 shrink-0">
                      <input
                        type="text"
                        value={user.department || ''}
                        onChange={(e) => handleDepartmentChange(user.user_id, e.target.value)}
                        onBlur={(e) => handleDepartmentBlur(user.user_id, e.target.value)}
                        placeholder="Departman"
                        className="w-32 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 disabled:opacity-50 transition-colors focus:ring-2 focus:ring-blue-500"
                        disabled={updatingUser === user.user_id || isObserver} 
                      />
                      
                      <select
                        value={user.role || 'user'}
                        onChange={(e) => updateUserRole(user.user_id, e.target.value)}
                        disabled={updatingUser === user.user_id || user.user_id === userData.user_id || isObserver}
                        className="w-40 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 disabled:opacity-50 transition-colors focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="user">Kullanıcı</option>
                        <option value="manager">Proje Yön.</option>
                        <option value="observer">Gözlemci</option>
                        <option value="client">Müşteri</option>
                        {user.role === 'admin' && <option value="admin">Yönetici</option>}
                      </select>
                      
                      <div className="w-32 text-center">
                        <span className={`px-4 py-1.5 text-[11px] font-bold rounded-full inline-block uppercase tracking-wider ${getRoleColor(user.role)}`}>
                          {getRoleLabel(user.role)}
                        </span>
                      </div>

                      {isAdmin && (
                        <div className="w-24 flex items-center justify-center gap-2">
                          <button 
                            onClick={() => openEditModal(user)}
                            className="p-2 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
                            title="Düzenle"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(user.user_id, user.name)}
                            disabled={user.user_id === userData.user_id}
                            className="p-2 text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Sil"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* --- MODAL --- */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-700 animate-slide-in">
              <div className="px-8 py-6 bg-gray-50 dark:bg-gray-700/60 text-gray-900 dark:text-white flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-xl font-black uppercase tracking-widest">{editingUserId ? 'Kullanıcıyı Düzenle' : 'Yeni Kullanıcı Tanımla'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-gray-700 shadow-sm text-gray-400 hover:text-red-500 transition-colors">✕</button>
              </div>
              <form onSubmit={handleSubmitUser} className="p-8 space-y-5">
                
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Ad Soyad *</label>
                  <input required type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full px-5 py-4 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-0 focus:border-blue-500 dark:bg-gray-900 dark:text-white transition-colors text-sm font-bold" placeholder="Örn: Boran Yılmaz" />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">E-Posta *</label>
                  <input required type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full px-5 py-4 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-0 focus:border-blue-500 dark:bg-gray-900 dark:text-white transition-colors text-sm font-bold" placeholder="Örn: boran@proaec.com.tr" />
                </div>

                {!editingUserId && (
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Şifre *</label>
                    <input required type="text" name="password" value={formData.password} onChange={handleInputChange} className="w-full px-5 py-4 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-0 focus:border-blue-500 dark:bg-gray-900 dark:text-white transition-colors text-sm font-bold" placeholder="Geçici şifre belirleyin" />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Rol *</label>
                      <select name="role" value={formData.role} onChange={handleInputChange} className="w-full px-5 py-4 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-0 focus:border-blue-500 dark:bg-gray-900 dark:text-white transition-colors text-sm font-bold appearance-none">
                        <option value="user">Kullanıcı (Standart)</option>
                        <option value="manager">Manager (Proje Yön.)</option>
                        <option value="observer">Gözlemci (Observer)</option>
                        <option value="client">Müşteri (Client)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Departman</label>
                      <input type="text" name="department" value={formData.department} onChange={handleInputChange} className="w-full px-5 py-4 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-0 focus:border-blue-500 dark:bg-gray-900 dark:text-white transition-colors text-sm font-bold" placeholder="Örn: Mimari" />
                    </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Bağlı Olduğu Firma *</label>
                  <select required name="company_id" value={formData.company_id} onChange={handleInputChange} className="w-full px-5 py-4 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-0 focus:border-blue-500 dark:bg-gray-900 dark:text-white transition-colors text-sm font-bold appearance-none">
                    <option value="">Firma Seçiniz...</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="mt-8 flex justify-end gap-3.5 pt-6 border-t border-gray-100 dark:border-gray-700">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-4 text-gray-500 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">İptal</button>
                  <button type="submit" disabled={isSubmitting} className="px-10 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center">
                    {isSubmitting ? <LoadingSpinner size="small" color="white" /> : (editingUserId ? 'GÜNCELLE' : 'SİSTEME KAYDET')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsers;