// src/pages/AdminUsers.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios'; 
import LoadingSpinner from '../components/UI/LoadingSpinner';

const AdminUsers = () => {
  const { userData } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingUser, setUpdatingUser] = useState(null); 

  // ROL KONTROLÜ
  const isObserver = userData?.role === 'observer';
  // Admin veya Gözlemci görebilir
  const canView = userData?.role === 'admin' || isObserver;

  useEffect(() => {
    if (canView) {
      fetchUsers();
    } else {
      setLoading(false);
    }
  }, [canView]);

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

  const updateUserRole = async (userId, newRole) => {
    if (isObserver) return; // Gözlemci yetkisi yok
    if (userId === userData.user_id) { 
      alert('Kendi rolünüzü değiştiremezsiniz!');
      return;
    }

    setUpdatingUser(userId);

    try {
      await api.put(`/users/${userId}/role`, { newRole });
      setUsers(prev => prev.map(user =>
        user.user_id === userId ? { ...user, role: newRole } : user
      ));
    } catch (error) {
      alert('Rol güncellenirken hata oluştu: ' + (error.response?.data?.message || error.message));
    } finally {
      setUpdatingUser(null);
    }
  };

  const updateUserDepartment = async (userId, newDepartment) => {
    if (isObserver) return; // Gözlemci yetkisi yok
    
    setUsers(prev => prev.map(user =>
      user.user_id === userId ? { ...user, department: newDepartment } : user
    ));
    
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
     if (isObserver) return; // Input değişikliğini engelle
     setUsers(prev => prev.map(user =>
        user.user_id === userId ? { ...user, department: value } : user
      ));
  };
  const handleDepartmentBlur = (userId, value) => {
     if (isObserver) return;
     updateUserDepartment(userId, value);
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800';
      case 'manager': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800';
      case 'user': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800';
      case 'observer': return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800'; // Observer rengi
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600';
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin': return 'Yönetici';
      case 'manager': return 'Proje Yöneticisi';
      case 'user': return 'Kullanıcı';
      case 'observer': return 'Gözlemci';
      default: return 'Kullanıcı';
    }
  };

  // Yetki kontrolü (Admin veya Observer görebilir)
  if (!canView) {
    return (
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-8 text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Erişim Engellendi</h2>
          <p className="text-gray-600 dark:text-gray-400">Bu sayfayı görüntüleme yetkiniz bulunmuyor.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="large" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Kullanıcı Yönetimi</h1>
            {isObserver && (
               <span className="px-3 py-1 bg-purple-100 text-purple-800 text-xs font-bold rounded-full dark:bg-purple-900/30 dark:text-purple-300">
                   👁️ Gözlemci Modu
               </span>
            )}
        </div>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Sistem kullanıcılarını ve rollerini görüntüleyin.
        </p>
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-6">
          <div className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{users.length}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Toplam Kullanıcı</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-6">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-2">
            {users.filter(u => u.role === 'admin').length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Yönetici</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-6">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">
            {users.filter(u => u.role === 'manager').length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Proje Yöneticisi</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-6">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-2">
            {users.filter(u => u.role === 'user').length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Kullanıcı</div>
        </div>
      </div>

      {/* Kullanıcı Listesi */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Sistem Kullanıcıları ({users.length})
          </h2>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {users.map(user => (
            <div key={user.user_id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <div className="flex items-center justify-between">
                {/* Kullanıcı Bilgileri */}
                <div className="flex items-center space-x-4 flex-1">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                    {user.name?.charAt(0) || user.email?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">
                        {user.name || 'İsimsiz Kullanıcı'}
                        {user.user_id === userData.user_id && (
                          <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(Siz)</span>
                        )}
                      </h3>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{user.email}</p>
                    <div className="flex items-center space-x-3 mt-1 text-xs text-gray-500 dark:text-gray-500">
                      {user.department && (
                        <span>🏢 {user.department}</span>
                      )}
                      <span>📅 {user.createdAt ? user.createdAt.toLocaleDateString('tr-TR') : 'Bilinmiyor'}</span>
                      {user.lastLoginAt && (
                        <span>🔐 {user.lastLoginAt.toLocaleDateString('tr-TR')}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Kontroller (Gözlemciye Disabled) */}
                <div className="flex items-center space-x-4">
                  <div className="w-32">
                    <input
                      type="text"
                      value={user.department || ''}
                      onChange={(e) => handleDepartmentChange(user.user_id, e.target.value)}
                      onBlur={(e) => handleDepartmentBlur(user.user_id, e.target.value)}
                      placeholder="Departman"
                      className="w-full px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 disabled:dark:bg-gray-800 disabled:opacity-70"
                      disabled={updatingUser === user.user_id || isObserver} // Gözlemci değiştiremez
                    />
                  </div>

                  <select
                    value={user.role || 'user'}
                    onChange={(e) => updateUserRole(user.user_id, e.target.value)}
                    disabled={updatingUser === user.user_id || user.user_id === userData.user_id || isObserver} // Gözlemci değiştiremez
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-70 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="user">Kullanıcı</option>
                    <option value="manager">Proje Yöneticisi</option>
                    <option value="admin">Yönetici</option>
                    <option value="observer">Gözlemci</option> {/* Seçeneği ekledim */}
                  </select>

                  <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getRoleColor(user.role)}`}>
                    {getRoleLabel(user.role)}
                  </span>

                  {updatingUser === user.user_id && (
                    <LoadingSpinner size="small" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {users.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">👥</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Henüz Kullanıcı Yok</h3>
            <p className="text-gray-600 dark:text-gray-400">Sisteme giriş yapan kullanıcılar burada listelenecek.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsers;