// src/pages/Notifications.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../utils/notificationHelper';
import api from '../api/axios';
import LoadingSpinner from '../components/UI/LoadingSpinner';

const Notifications = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' veya 'unread'

  useEffect(() => {
    if (userData) fetchNotifications();
  }, [userData]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const data = await getUserNotifications();
      setNotifications(data);
    } catch (error) {
      console.error('Bildirimler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await markNotificationAsRead(id);
      setNotifications(prev => prev.map(n => n.notification_id === id ? { ...n, read: true } : n));
    } catch (error) { console.error(error); }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead(userData.user_id);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) { console.error(error); }
  };

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.notification_id !== id));
    } catch (error) {
      console.error('Silme hatası:', error);
      alert('Bildirim silinemedi. Lütfen backend rotasını kontrol edin.');
    }
  };

  const filteredNotifications = notifications.filter(n => filter === 'all' || !n.read);
  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) return <div className="flex justify-center items-center h-[calc(100vh-200px)]"><LoadingSpinner size="large" /></div>;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 animate-fade-in">
      
      {/* Header Alanı */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
            Bildirim Merkezi
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full shadow-sm animate-pulse">
                {unreadCount} Yeni
              </span>
            )}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">Sistemdeki tüm güncellemeleri ve uyarıları buradan yönetin.</p>
        </div>

        {unreadCount > 0 && (
          <button 
            onClick={handleMarkAllAsRead}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-semibold bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 px-4 py-2 rounded-xl transition-colors"
          >
            ✓ Tümünü Okundu İşaretle
          </button>
        )}
      </div>

      {/* Filtre Tabları */}
      <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-700 pb-px">
        <button 
          onClick={() => setFilter('all')}
          className={`pb-3 px-2 font-semibold text-sm transition-colors border-b-2 ${filter === 'all' ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400' : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'}`}
        >
          Tüm Bildirimler
        </button>
        <button 
          onClick={() => setFilter('unread')}
          className={`pb-3 px-2 font-semibold text-sm transition-colors border-b-2 flex items-center gap-2 ${filter === 'unread' ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400' : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'}`}
        >
          Okunmayanlar {filter !== 'unread' && unreadCount > 0 && <span className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full text-xs">{unreadCount}</span>}
        </button>
      </div>

      {/* Bildirim Listesi */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-6xl mb-4 opacity-50">📭</span>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Burada her şey sakin</h3>
            <p className="text-gray-500 dark:text-gray-400">Gösterilecek herhangi bir bildiriminiz bulunmuyor.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {filteredNotifications.map(n => (
              <div 
                key={n.notification_id} 
                onClick={() => { if(!n.read) handleMarkAsRead(n.notification_id); if(n.link) navigate(n.link); }}
                className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 transition-colors cursor-pointer ${!n.read ? 'bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'}`}
              >
                <div className="flex gap-4 items-start flex-1 min-w-0">
                  <div className={`mt-1.5 w-3 h-3 rounded-full shrink-0 ${!n.read ? 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.6)]' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-base truncate ${!n.read ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'}`}>{n.title}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 leading-relaxed">{n.message}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 font-medium">
                      {new Date(n.created_at).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                {/* Aksiyon Butonları */}
                <div className="flex items-center gap-2 pl-7 sm:pl-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                  {!n.read && (
                    <button onClick={(e) => handleMarkAsRead(n.notification_id, e)} className="px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60 rounded-lg transition-colors">
                      Okundu İşaretle
                    </button>
                  )}
                  <button onClick={(e) => handleDelete(n.notification_id, e)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Sil">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;