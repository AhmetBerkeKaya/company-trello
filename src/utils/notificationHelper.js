import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

// Basit email gönderme fonksiyonu
const sendEmailNotification = async (notification, userData) => {
  try {
    console.log('📧 EMAIL GÖNDERİLECEK:', {
      to: userData.email,
      subject: getEmailSubject(notification),
      userName: userData.name,
      type: notification.type
    });

    // Burada gerçek email gönderme kodu olacak
    // Şimdilik başarılı dönüyoruz
    return true;
  } catch (error) {
    console.error('Email gönderme hatası:', error);
    return false;
  }
};

// Bildirim oluşturma fonksiyonu - DÜZELTİLDİ
export const createNotification = async (notificationData) => {
  try {
    const notification = {
      ...notificationData,
      read: false,
      createdAt: serverTimestamp(),
      emailSent: false
    };

    // Bildirimi Firestore'a kaydet ve ID'yi al
    const docRef = await addDoc(collection(db, 'notifications'), notification);
    const notificationId = docRef.id;
    
    console.log('Bildirim oluşturuldu:', notification.type, 'ID:', notificationId);

    // Bildirime ID'yi ekle ve email gönder
    const notificationWithId = {
      ...notification,
      id: notificationId
    };

    // Kullanıcının email tercihlerini kontrol et ve email gönder
    await checkAndSendEmailNotification(notificationWithId);

    return notificationId;
  } catch (error) {
    console.error('Bildirim oluşturma hatası:', error);
  }
};

// Kullanıcının email tercihlerini kontrol et ve email gönder - DÜZELTİLDİ
const checkAndSendEmailNotification = async (notification) => {
  try {
    // Kullanıcı bilgilerini getir
    const userDoc = await getDoc(doc(db, 'users', notification.userId));
    if (!userDoc.exists()) {
      console.log('Kullanıcı bulunamadı:', notification.userId);
      return;
    }

    const userData = userDoc.data();
    const userEmail = userData.email;
    
    if (!userEmail) {
      console.log('Kullanıcı emaili yok:', notification.userId);
      return;
    }

    // Kullanıcının notificationSettings'ini kontrol et
    const notificationSettings = userData.notificationSettings || {
      email: true,
      tasks: true,
      meetings: true
    };

    // Email gönderme koşullarını kontrol et
    const shouldSendEmail = 
      notificationSettings.email && // Genel email ayarı
      (
        (notification.type.includes('task') && notificationSettings.tasks) ||
        (notification.type.includes('meeting') && notificationSettings.meetings)
      );

    if (shouldSendEmail) {
      console.log('📧 Email gönderilecek:', userEmail, 'Bildirim tipi:', notification.type);
      
      // Email gönder
      const emailSent = await sendEmailNotification(notification, userData);
      
      if (emailSent && notification.id) {
        // Bildirimi email gönderildi olarak işaretle
        await updateDoc(doc(db, 'notifications', notification.id), {
          emailSent: true,
          emailSentAt: serverTimestamp()
        });
        console.log('✅ Email gönderildi işaretlendi:', notification.id);
      }
    } else {
      console.log('📧 Email gönderilmeyecek - Tercihler kapalı');
    }

  } catch (error) {
    console.error('Email kontrol hatası:', error);
  }
};

// Email konusunu oluştur
const getEmailSubject = (notification) => {
  switch (notification.type) {
    case 'task_assigned':
      return `Yeni Görev Atandı: ${notification.taskTitle}`;
    case 'task_updated':
      return `Görev Güncellendi: ${notification.taskTitle}`;
    case 'meeting_created':
      return `Yeni Toplantı: ${notification.meetingTitle}`;
    default:
      return 'Yeni Bildirim';
  }
};

// Mevcut fonksiyonlar aynı kalacak...
export const notifyTaskAssignment = async (task, assigneeId, sender) => {
  await createNotification({
    type: 'task_assigned',
    userId: assigneeId,
    taskId: task.id,
    taskTitle: task.title,
    projectId: task.projectId,
    projectTitle: task.projectTitle || 'Proje',
    senderId: sender.id,
    senderName: sender.name,
    description: task.description,
    link: `/projects/${task.projectId}`
  });
};

export const notifyTaskUpdate = async (task, updater) => {
  if (task.assignee && task.assignee !== updater.id) {
    await createNotification({
      type: 'task_updated',
      userId: task.assignee,
      taskId: task.id,
      taskTitle: task.title,
      projectId: task.projectId,
      projectTitle: task.projectTitle || 'Proje',
      senderId: updater.id,
      senderName: updater.name,
      status: getStatusText(task.status),
      link: `/projects/${task.projectId}`
    });
  }
};

export const notifyMeetingCreated = async (meeting, participants, creator) => {
  try {
    for (const participantId of participants) {
      if (participantId !== creator.id) {
        const meetingDate = meeting.startTime || meeting.date || new Date();
        
        await createNotification({
          type: 'meeting_created',
          userId: participantId,
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          meetingDate: meetingDate,
          senderId: creator.id,
          senderName: creator.name,
          description: meeting.description,
          link: '/meetings'
        });
      }
    }
  } catch (error) {
    console.error('❌ Toplantı bildirimi hatası:', error);
  }
};

// Diğer fonksiyonlar aynı...
export const getUserNotifications = async (userId) => {
  try {
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId)
    );

    const snapshot = await getDocs(notificationsQuery);
    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    notifications.sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.createdAt?.toDate?.() || new Date(0);
      return dateB - dateA;
    });

    return notifications;
  } catch (error) {
    console.error('Bildirimleri getirme hatası:', error);
    return [];
  }
};

export const markNotificationAsRead = async (notificationId) => {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      read: true,
      readAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Bildirim okuma hatası:', error);
  }
};

export const markAllNotificationsAsRead = async (userId) => {
  try {
    const notifications = await getUserNotifications(userId);
    const unreadNotifications = notifications.filter(n => !n.read);
    
    const updatePromises = unreadNotifications.map(notification =>
      markNotificationAsRead(notification.id)
    );
    
    await Promise.all(updatePromises);
  } catch (error) {
    console.error('Tüm bildirimleri okuma hatası:', error);
  }
};

const getStatusText = (status) => {
  switch (status) {
    case 'todo': return 'Yapılacak';
    case 'inProgress': return 'Devam Ediyor';
    case 'done': return 'Tamamlandı';
    default: return status;
  }
};