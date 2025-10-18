import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

// Tüm kullanıcıları getiren fonksiyon
export const getAllUsers = async () => {
  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    return users;
  } catch (error) {
    console.error('Kullanıcıları getirme hatası:', error);
    return [];
  }
};