// src/utils/notificationHelper.js
import api from '../api/axios'; // YENİ

// --- OKUMA FONKSİYONLARI (API'YE BAĞLANDI) ---

export const getUserNotifications = async (userId) => {
  // 'userId' parametresine artık gerek yok, API (JWT'den)
  // kim olduğumuzu biliyor.
  try {
    const response = await api.get('/notifications');
    
    // Veritabanı (PostgreSQL) tarih formatını
    // JavaScript 'Date' objesine çevirelim
    const notifications = response.data.map(n => ({
      ...n,
      createdAt: n.created_at ? new Date(n.created_at) : new Date()
    }));
    
    // Sıralama (API zaten yapıyor ama garanti olsun)
    notifications.sort((a, b) => b.createdAt - a.createdAt);
    
    return notifications;
  } catch (error) {
    console.error('Bildirimleri getirme hatası (API):', error);
    return [];
  }
};

export const markNotificationAsRead = async (notificationId) => {
  try {
    await api.post(`/notifications/${notificationId}/read`);
  } catch (error) {
    console.error('Bildirim okuma hatası (API):', error);
  }
};

export const markAllNotificationsAsRead = async (userId) => {
  // 'userId' yine gerekmiyor
  try {
    await api.post('/notifications/read-all');
  } catch (error) {
    console.error('Tüm bildirimleri okuma hatası (API):', error);
  }
};


// --- OLUŞTURMA FONKSİYONLARI (DEVRE DIŞI BIRAKILDI) ---
// Bu fonksiyonlar artık React (frontend) tarafından değil,
// API (backend) tarafından (örn: 'taskController.js' içinde)
// çağrılacak. Frontend'in bu fonksiyonları çağırmasını engelliyoruz.

export const createNotification = async (notificationData) => {
  console.warn('createNotification artık backend\'de çalışıyor.');
  return;
};

export const notifyTaskAssignment = async (task, assigneeId, sender) => {
  console.warn('notifyTaskAssignment artık backend\'de çalışıyor.');
  return;
};

export const notifyTaskUpdate = async (task, updater) => {
  console.warn('notifyTaskUpdate artık backend\'de çalışıyor.');
  return;
};

export const notifyMeetingCreated = async (meeting, participants, creator) => {
  console.warn('notifyMeetingCreated artık backend\'de çalışıyor.');
  return;
};

export const notifyMeetingRequest = async (meetingRequest, recipients, requestedBy) => {
  console.warn('notifyMeetingRequest artık backend\'de çalışıyor.');
  return;
};