import React, { createContext, useState, useContext, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,  // ← BU VİRGÜLÜ EKLE
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

const AuthContext = createContext();

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState('light');

  const login = async (email, password) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);

      // Giriş başarılı olduğunda lastLoginAt alanını güncelle
      if (result.user) {
        const userRef = doc(db, 'users', result.user.uid);
        await updateDoc(userRef, {
          lastLoginAt: new Date()
        });

        // Local state'i de güncelle
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }
      }

      return result;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (email, password, userData) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);

      await updateProfile(result.user, {
        displayName: userData.name
      });

      const userDoc = {
        id: result.user.uid,
        name: userData.name,
        email: email,
        role: userData.role || 'user',
        department: userData.department || '',
        createdAt: new Date(),
        lastLoginAt: new Date() // lastLogin yerine lastLoginAt kullan
      };

      await setDoc(doc(db, 'users', result.user.uid), userDoc);

      return result;
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    }
  };
  const updateUserData = async (updatedData) => {
    try {
      if (!currentUser) throw new Error('Kullanıcı girişi yapılmamış');

      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        ...updatedData,
        updatedAt: new Date()
      });

      // Yerel state'i güncelle
      setUserData(prev => ({ ...prev, ...updatedData }));

      return true;
    } catch (error) {
      console.error('Profil güncelleme hatası:', error);
      throw error;
    }
  };
  const changePassword = async (currentPassword, newPassword) => {
    try {
      if (!currentUser) throw new Error('Kullanıcı girişi yapılmamış');

      // Mevcut şifreyi doğrula
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        currentPassword
      );

      await reauthenticateWithCredential(currentUser, credential);

      // Yeni şifreyi güncelle
      await updatePassword(currentUser, newPassword);

      return true;
    } catch (error) {
      console.error('Şifre değiştirme hatası:', error);
      throw error;
    }
  };
  const updateNotificationSettings = async (settings) => {
    try {
      if (!currentUser) throw new Error('Kullanıcı girişi yapılmamış');

      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        notificationSettings: settings,
        updatedAt: new Date()
      });

      // Yerel state'i güncelle
      setUserData(prev => ({
        ...prev,
        notificationSettings: settings
      }));

      return true;
    } catch (error) {
      console.error('Bildirim ayarları güncelleme hatası:', error);
      throw error;
    }
  };
  const toggleTheme = async (newTheme) => {
    try {
      const themeToSet = newTheme || (theme === 'light' ? 'dark' : 'light');
      setTheme(themeToSet);

      // LocalStorage'a kaydet (hemen tema değişsin diye)
      localStorage.setItem('theme', themeToSet);

      // HTML class'ını güncelle (Tailwind dark mode için)
      if (themeToSet === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

      // Firebase'e kaydet (eğer kullanıcı giriş yapmışsa)
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          theme: themeToSet,
          updatedAt: new Date()
        });

        // Yerel state'i güncelle
        setUserData(prev => ({ ...prev, theme: themeToSet }));
      }

      return true;
    } catch (error) {
      console.error('Tema değiştirme hatası:', error);
      throw error;
    }
  };
  const logout = () => {
    return signOut(auth);
  };

  useEffect(() => {
    // Tema kontrolü - sayfa yüklendiğinde
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);

    // HTML class'ını ayarla
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUserData(userData);

            // Kullanıcının tema tercihini yükle
            if (userData.theme) {
              setTheme(userData.theme);
              localStorage.setItem('theme', userData.theme);
              if (userData.theme === 'dark') {
                document.documentElement.classList.add('dark');
              } else {
                document.documentElement.classList.remove('dark');
              }
            }
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      } else {
        setUserData(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userData,
    login,
    register,
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
      {children}
    </AuthContext.Provider>
  );
}