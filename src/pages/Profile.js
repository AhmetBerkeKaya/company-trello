import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import LoadingSpinner from '../components/UI/LoadingSpinner';

const Profile = () => {
    const { userData, updateUserData, changePassword, updateNotificationSettings, theme, toggleTheme } = useAuth();
    const [activeTab, setActiveTab] = useState('profile');
    const [loading, setLoading] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [notifications, setNotifications] = useState([]);
    const [loadingNotifications, setLoadingNotifications] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
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

    // Bildirim state'i
    const [notificationSettings, setNotificationSettings] = useState({
        email: true,
        tasks: true,
        meetings: true
    });

    // Tema state'i
    const [themeSettings, setThemeSettings] = useState({
        theme: 'light'
    });

    // İstatistikler state
    const [statistics, setStatistics] = useState({
        activeProjects: 0,
        completedTasks: 0,
        totalMeetings: 0,
        assignedTasks: 0
    });
    const fetchNotifications = async () => {
        if (!userData) return;

        try {
            setLoadingNotifications(true);
            const userNotifications = await getUserNotifications(userData.id);
            setNotifications(userNotifications);

            // Okunmamış bildirim sayısını hesapla
            const unread = userNotifications.filter(n => !n.read).length;
            setUnreadCount(unread);
        } catch (error) {
            console.error('Bildirimleri getirme hatası:', error);
        } finally {
            setLoadingNotifications(false);
        }
    };

    const [loadingStats, setLoadingStats] = useState(true);

    useEffect(() => {
        if (userData) {
            setFormData({
                name: userData.name || '',
                department: userData.department || '',
                phone: userData.phone || '',
                bio: userData.bio || ''
            });

            // Bildirim ayarlarını yükle
            if (userData.notificationSettings) {
                setNotificationSettings(userData.notificationSettings);
            }

            // Tema ayarlarını yükle
            if (userData.theme) {
                setThemeSettings({ theme: userData.theme });
            }

            if (userData && activeTab === 'notifications') {
                fetchNotifications();
            }
            // İstatistikleri getir
            fetchStatistics();
        }
    }, [userData]);

    // İstatistikleri getir
    const fetchStatistics = async () => {
        if (!userData) return;

        try {
            setLoadingStats(true);

            const stats = {
                activeProjects: 0,
                completedTasks: 0,
                totalMeetings: 0,
                assignedTasks: 0
            };

            // Aktif projeleri say
            const projectsQuery = query(
                collection(db, 'projects'),
                where('members', 'array-contains', userData.id)
            );
            const projectsSnapshot = await getDocs(projectsQuery);
            stats.activeProjects = projectsSnapshot.size;

            // Proje ID'lerini al
            const projectIds = projectsSnapshot.docs.map(doc => doc.id);

            // Tamamlanan görevleri say
            if (projectIds.length > 0) {
                const completedTasksQuery = query(
                    collection(db, 'tasks'),
                    where('projectId', 'in', projectIds),
                    where('status', '==', 'done')
                );
                const completedTasksSnapshot = await getDocs(completedTasksQuery);
                stats.completedTasks = completedTasksSnapshot.size;
            }

            // Atanan görevleri say
            const assignedTasksQuery = query(
                collection(db, 'tasks'),
                where('assignee', '==', userData.id)
            );
            const assignedTasksSnapshot = await getDocs(assignedTasksQuery);
            stats.assignedTasks = assignedTasksSnapshot.size;

            // Toplantıları say (meetings koleksiyonu varsa)
            try {
                const meetingsQuery = query(
                    collection(db, 'meetings'),
                    where('participants', 'array-contains', userData.id)
                );
                const meetingsSnapshot = await getDocs(meetingsQuery);
                stats.totalMeetings = meetingsSnapshot.size;
            } catch (error) {
                console.log('Toplantı istatistikleri getirilemedi:', error);
                stats.totalMeetings = 0;
            }

            setStatistics(stats);
        } catch (error) {
            console.error('İstatistikleri getirme hatası:', error);
        } finally {
            setLoadingStats(false);
        }
    };

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

    const handleInputChange = (e) => {
        const { name, value } = e.target;

        if (name === 'phone') {
            // +90 sabit kalsın, sadece rakamları al
            const numbers = value.replace(/\D/g, '').slice(2); // İlk 2 rakamı at (90)
            const limitedNumbers = numbers.slice(0, 10);

            // +90 her zaman sabit, sadece kullanıcı rakamları girebilsin
            let formatted = '+90 ';
            if (limitedNumbers.length > 0) formatted += limitedNumbers.slice(0, 3);
            if (limitedNumbers.length > 3) formatted += ' ' + limitedNumbers.slice(3, 6);
            if (limitedNumbers.length > 6) formatted += ' ' + limitedNumbers.slice(6, 8);
            if (limitedNumbers.length > 8) formatted += ' ' + limitedNumbers.slice(8, 10);

            setFormData(prev => ({
                ...prev,
                [name]: formatted.trim()
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
        }
    };

    // Şifre input değişikliklerini handle et
    const handlePasswordChange = (e) => {
        const { name, value } = e.target;
        setPasswordData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handlePasswordChangeSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setSaveMessage('');

        try {
            // Validasyon
            if (passwordData.newPassword.length < 6) {
                throw new Error('Yeni şifre en az 6 karakter olmalıdır');
            }

            if (passwordData.newPassword !== passwordData.confirmPassword) {
                throw new Error('Yeni şifreler eşleşmiyor');
            }

            await changePassword(passwordData.currentPassword, passwordData.newPassword);

            setSaveMessage('✅ Şifreniz başarıyla değiştirildi!');
            setPasswordData({
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            });

            setTimeout(() => setSaveMessage(''), 3000);
        } catch (error) {
            console.error('Şifre değiştirme hatası:', error);
            setSaveMessage('❌ Şifre değiştirilemedi: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleNotificationToggle = async (settingId) => {
        const newSettings = {
            ...notificationSettings,
            [settingId]: !notificationSettings[settingId]
        };

        setNotificationSettings(newSettings);

        try {
            await updateNotificationSettings(newSettings);
            setSaveMessage('✅ Bildirim ayarları güncellendi!');
            setTimeout(() => setSaveMessage(''), 3000);
        } catch (error) {
            console.error('Bildirim ayarı kaydetme hatası:', error);
            // Hata durumunda eski haline geri al
            setNotificationSettings(prev => ({
                ...prev,
                [settingId]: !prev[settingId]
            }));
        }
    };

    // Tema değiştirme fonksiyonu
    const handleThemeChange = async (newTheme) => {
        try {
            setThemeSettings({ theme: newTheme });
            await toggleTheme(newTheme);
            setSaveMessage('✅ Tema değiştirildi!');
            setTimeout(() => setSaveMessage(''), 3000);
        } catch (error) {
            console.error('Tema değiştirme hatası:', error);
            setSaveMessage('❌ Tema değiştirilemedi: ' + error.message);
        }
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
            case 'admin': return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800';
            case 'manager': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800';
            case 'user': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800';
            default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600';
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
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Profilim</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">Hesap bilgilerinizi yönetin ve kişisel ayarlarınızı düzenleyin</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Sidebar - Kullanıcı Bilgileri */}
                <div className="lg:col-span-1">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-6 sticky top-6">
                        {/* Kullanıcı Avatar ve Bilgiler */}
                        <div className="text-center">
                            <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
                                {userData.name?.charAt(0) || userData.email?.charAt(0) || 'U'}
                            </div>

                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{userData.name}</h2>
                            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">{userData.email}</p>

                            <div className="mt-3">
                                <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getRoleColor(userData.role)}`}>
                                    {getRoleLabel(userData.role)}
                                </span>
                            </div>

                            {userData.department && (
                                <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">🏢 {userData.department}</p>
                            )}

                            {/* İstatistikler */}
                            <div className="mt-6 space-y-3 text-left">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Üye Olma:</span>
                                    <span className="font-medium text-gray-900 dark:text-white">
                                        {userData.createdAt?.toDate?.().toLocaleDateString('tr-TR') ||
                                            userData.createdAt?.toLocaleDateString?.('tr-TR') ||
                                            'Bilinmiyor'}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Son Giriş:</span>
                                    <span className="font-medium text-gray-900 dark:text-white">
                                        {userData.lastLoginAt?.toDate?.().toLocaleDateString('tr-TR') ||
                                            userData.lastLoginAt?.toLocaleDateString?.('tr-TR') ||
                                            userData.lastLogin?.toDate?.().toLocaleDateString('tr-TR') ||
                                            'Hiç giriş yapılmamış'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="lg:col-span-3">
                    {/* Tab Navigation */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 mb-6">
                        <div className="border-b border-gray-200 dark:border-gray-700">
                            <nav className="flex space-x-8 px-6">
                                {[
                                    { id: 'profile', label: 'Profil Bilgileri', icon: '👤' },
                                    { id: 'security', label: 'Güvenlik', icon: '🔒' },
                                    { id: 'preferences', label: 'Tercihler', icon: '⚙️' }
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`py-4 border-b-2 font-medium text-sm transition-colors flex items-center space-x-2 ${activeTab === tab.id
                                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
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
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Profil Bilgileri</h3>

                                    {saveMessage && (
                                        <div className={`p-4 rounded-lg mb-6 ${saveMessage.includes('✅') ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300' : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                                            }`}>
                                            {saveMessage}
                                        </div>
                                    )}

                                    <form onSubmit={handleProfileUpdate} className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                    Ad Soyad *
                                                </label>
                                                <input
                                                    type="text"
                                                    name="name"
                                                    value={formData.name}
                                                    onChange={handleInputChange}
                                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                    required
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                    Departman
                                                </label>
                                                <input
                                                    type="text"
                                                    name="department"
                                                    value={formData.department}
                                                    onChange={handleInputChange}
                                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                    placeholder="Çalıştığınız departman"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                Telefon
                                            </label>
                                            <input
                                                type="tel"
                                                name="phone"
                                                value={formData.phone}
                                                onChange={handleInputChange}
                                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                placeholder="+90 5xx xxx xx xx"
                                                maxLength={17} // +90 555 123 45 67
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                Hakkımda
                                            </label>
                                            <textarea
                                                name="bio"
                                                value={formData.bio}
                                                onChange={handleInputChange}
                                                rows="4"
                                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                placeholder="Kendinizden kısaca bahsedin..."
                                            />
                                        </div>

                                        <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
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
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Hesap Güvenliği</h3>

                                    {saveMessage && (
                                        <div className={`p-4 rounded-lg mb-6 ${saveMessage.includes('✅') ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300' : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                                            }`}>
                                            {saveMessage}
                                        </div>
                                    )}

                                    <div className="space-y-6">
                                        {/* Şifre Değiştirme */}
                                        <form onSubmit={handlePasswordChangeSubmit}>
                                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                                                <h4 className="font-medium text-gray-900 dark:text-white mb-4">Şifre Değiştir</h4>
                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                            Mevcut Şifre
                                                        </label>
                                                        <input
                                                            type="password"
                                                            name="currentPassword"
                                                            value={passwordData.currentPassword}
                                                            onChange={handlePasswordChange}
                                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                            placeholder="Mevcut şifreniz"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                            Yeni Şifre
                                                        </label>
                                                        <input
                                                            type="password"
                                                            name="newPassword"
                                                            value={passwordData.newPassword}
                                                            onChange={handlePasswordChange}
                                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                            placeholder="En az 6 karakter"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                            Yeni Şifre (Tekrar)
                                                        </label>
                                                        <input
                                                            type="password"
                                                            name="confirmPassword"
                                                            value={passwordData.confirmPassword}
                                                            onChange={handlePasswordChange}
                                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                            placeholder="Yeni şifrenizi tekrar girin"
                                                        />
                                                    </div>

                                                    <button
                                                        type="submit"
                                                        disabled={loading}
                                                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center space-x-2"
                                                    >
                                                        {loading && <LoadingSpinner size="small" />}
                                                        <span>Şifre Değiştir</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </form>

                                        {/* Oturum Bilgileri */}
                                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                                            <h4 className="font-medium text-gray-900 dark:text-white mb-4">Oturum Bilgileri</h4>
                                            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
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
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Sistem Tercihleri</h3>

                                    {saveMessage && (
                                        <div className={`p-4 rounded-lg mb-6 ${saveMessage.includes('✅') ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300' : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                                            }`}>
                                            {saveMessage}
                                        </div>
                                    )}

                                    <div className="space-y-6">
                                        {/* Bildirim Ayarları */}
                                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                                            <h4 className="font-medium text-gray-900 dark:text-white mb-4">Bildirim Ayarları</h4>
                                            <div className="space-y-3">
                                                {[
                                                    { id: 'email', label: 'E-posta Bildirimleri', description: 'Önemli güncellemeler ve toplantı hatırlatıcıları' },
                                                    { id: 'tasks', label: 'Görev Bildirimleri', description: 'Yeni görev atamaları ve görev güncellemeleri' },
                                                    { id: 'meetings', label: 'Toplantı Bildirimleri', description: 'Toplantı hatırlatıcıları ve değişiklikler' }
                                                ].map(setting => (
                                                    <div key={setting.id} className="flex items-center justify-between">
                                                        <div>
                                                            <div className="font-medium text-gray-900 dark:text-white">{setting.label}</div>
                                                            <div className="text-sm text-gray-500 dark:text-gray-400">{setting.description}</div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleNotificationToggle(setting.id)}
                                                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${notificationSettings[setting.id] ? 'bg-blue-600' : 'bg-gray-200'
                                                                }`}
                                                        >
                                                            <span
                                                                aria-hidden="true"
                                                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${notificationSettings[setting.id] ? 'translate-x-5' : 'translate-x-0'
                                                                    }`}
                                                            />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Tema Ayarları */}
                                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                                            <h4 className="font-medium text-gray-900 dark:text-white mb-4">Tema Ayarları</h4>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                        Tema Seçimi
                                                    </label>
                                                    <div className="flex space-x-4">
                                                        <button
                                                            onClick={() => handleThemeChange('light')}
                                                            className={`flex-1 p-4 border-2 rounded-lg text-center transition-colors ${themeSettings.theme === 'light'
                                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                                                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                                                                }`}
                                                        >
                                                            <div className="text-2xl mb-2">🌞</div>
                                                            <div className="font-medium dark:text-white">Açık Tema</div>
                                                        </button>

                                                        <button
                                                            onClick={() => handleThemeChange('dark')}
                                                            className={`flex-1 p-4 border-2 rounded-lg text-center transition-colors ${themeSettings.theme === 'dark'
                                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                                                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                                                                }`}
                                                        >
                                                            <div className="text-2xl mb-2">🌙</div>
                                                            <div className="font-medium dark:text-white">Koyu Tema</div>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Rol Bazlı İstatistikler */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Hesap İstatistikleri</h3>

                        {loadingStats ? (
                            <div className="flex justify-center py-4">
                                <LoadingSpinner size="small" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {/* Aktif Projeler */}
                                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                        {statistics.activeProjects}
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">Aktif Proje</div>
                                </div>

                                {/* Tamamlanan Görevler */}
                                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                        {statistics.completedTasks}
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">Tamamlanan Görev</div>
                                </div>

                                {/* Toplantılar */}
                                <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                        {statistics.totalMeetings}
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">Katıldığım Toplantı</div>
                                </div>

                                {/* Atanan Görevler */}
                                <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                                        {statistics.assignedTasks}
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">Atanan Görev</div>
                                </div>
                            </div>
                        )}

                        {/* Rol Bilgisi */}
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-center space-x-2">
                                <span className="text-lg">
                                    {userData.role === 'admin' ? '👑' :
                                        userData.role === 'manager' ? '📋' : '👤'}
                                </span>
                                <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                                    {getRoleLabel(userData.role)} rolünde
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;