// src/pages/Profile.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios'; 
import LoadingSpinner from '../components/UI/LoadingSpinner';

const Profile = () => {
    const { userData, updateUserData, changePassword, updateNotificationSettings, theme, toggleTheme } = useAuth();
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
    const [loadingStats, setLoadingStats] = useState(true);

    useEffect(() => {
        if (userData) {
            setFormData({
                name: userData.name || '',
                department: userData.department || '',
                phone: userData.phone || '', 
                bio: userData.bio || ''
            });

            if (userData.notification_settings) {
                setNotificationSettings(userData.notification_settings);
            }
            if (userData.theme) {
                setThemeSettings({ theme: userData.theme });
            }
            fetchStatistics();
        }
    }, [userData]); 

    const fetchStatistics = async () => {
        if (!userData) return;
        try {
            setLoadingStats(true);
            const response = await api.get('/users/me/stats');
            setStatistics(response.data);
        } catch (error) {
            console.error('İstatistikleri getirme hatası:', error);
        } finally {
            setLoadingStats(false);
        }
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        setLoading(true);
        setSaveMessage('');
        try {
            await updateUserData(formData);
            setSaveMessage('✅ Profil bilgileriniz başarıyla güncellendi!');
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
            const numbers = value.replace(/\D/g, '').slice(2);
            const limitedNumbers = numbers.slice(0, 10);
            let formatted = '+90 ';
            if (limitedNumbers.length > 0) formatted += limitedNumbers.slice(0, 3);
            if (limitedNumbers.length > 3) formatted += ' ' + limitedNumbers.slice(3, 6);
            if (limitedNumbers.length > 6) formatted += ' ' + limitedNumbers.slice(6, 8);
            if (limitedNumbers.length > 8) formatted += ' ' + limitedNumbers.slice(8, 10);
            setFormData(prev => ({ ...prev, [name]: formatted.trim() }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handlePasswordChange = (e) => {
        const { name, value } = e.target;
        setPasswordData(prev => ({ ...prev, [name]: value }));
    };

    const handlePasswordChangeSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setSaveMessage('');
        try {
            if (passwordData.newPassword.length < 6) throw new Error('Yeni şifre en az 6 karakter olmalıdır');
            if (passwordData.newPassword !== passwordData.confirmPassword) throw new Error('Yeni şifreler eşleşmiyor');
            
            await changePassword(passwordData.currentPassword, passwordData.newPassword);
            setSaveMessage('✅ Şifreniz başarıyla değiştirildi!');
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setTimeout(() => setSaveMessage(''), 3000);
        } catch (error) {
            console.error('Şifre değiştirme hatası:', error);
            setSaveMessage('❌ Şifre değiştirilemedi: ' + (error.response?.data?.message || error.message));
        } finally {
            setLoading(false);
        }
    };

    const handleNotificationToggle = async (settingId) => {
        const newSettings = { ...notificationSettings, [settingId]: !notificationSettings[settingId] };
        setNotificationSettings(newSettings); 
        try {
            await updateNotificationSettings(newSettings);
            setSaveMessage('✅ Bildirim ayarları güncellendi!');
            setTimeout(() => setSaveMessage(''), 3000);
        } catch (error) {
            console.error('Bildirim ayarı kaydetme hatası:', error);
            setNotificationSettings(prev => ({ ...prev, [settingId]: !prev[settingId] }));
        }
    };

    const handleThemeChange = async (newTheme) => {
        try {
            setThemeSettings({ theme: newTheme });
            await toggleTheme(newTheme);
            setSaveMessage('✅ Tema başarıyla güncellendi!');
            setTimeout(() => setSaveMessage(''), 3000);
        } catch (error) {
            console.error('Tema değiştirme hatası:', error);
            setSaveMessage('❌ Tema değiştirilemedi: ' + error.message);
        }
    };

    const getRoleLabel = (role) => {
        switch (role) {
            case 'admin': return 'Yönetici';
            case 'manager': return 'Proje Yöneticisi';
            case 'observer': return 'Gözlemci';
            case 'client': return 'Müşteri';
            default: return 'Kullanıcı';
        }
    };

    const getRoleColor = (role) => {
        switch (role) {
            case 'admin': return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800';
            case 'manager': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
            case 'observer': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
            case 'client': return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800';
            default: return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
        }
    };

    if (!userData) {
        return <div className="min-h-screen flex flex-col justify-center items-center"><LoadingSpinner size="large" /><p className="mt-4 font-black text-[10px] uppercase tracking-[0.3em] text-gray-400">Profil Yükleniyor</p></div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
            
            {/* MODERN HEADER SECTION */}
            <div className="max-w-7xl mx-auto mb-10 bg-white dark:bg-gray-800 p-8 sm:p-10 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 animate-fade-in relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5 select-none pointer-events-none text-8xl font-black italic uppercase">PROFILE</div>
                <div className="relative z-10">
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight leading-tight uppercase">Kişisel Profilim</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-lg font-medium leading-relaxed max-w-2xl mt-3">Hesap bilgilerinizi, güvenlik ayarlarınızı ve sistem tercihlerinizi buradan yönetin.</p>
                </div>
            </div>

            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
                
                {/* SOL PANEL: KULLANICI KARTI */}
                <div className="lg:col-span-4">
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 p-8 sticky top-24">
                        <div className="text-center">
                            <div className="w-28 h-28 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-[2rem] flex items-center justify-center text-white text-4xl font-black mx-auto mb-6 shadow-xl shadow-blue-500/20 transform rotate-3 hover:rotate-0 transition-transform">
                                {userData.name?.charAt(0).toUpperCase() || userData.email?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight uppercase">{userData.name}</h2>
                            <p className="text-gray-500 dark:text-gray-400 text-xs font-bold mt-2 uppercase tracking-widest">{userData.email}</p>
                            
                            <div className="mt-5">
                                <span className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg border-2 ${getRoleColor(userData.role)}`}>
                                    {getRoleLabel(userData.role)}
                                </span>
                            </div>
                            
                            {userData.department && (
                                <p className="text-gray-600 dark:text-gray-400 text-xs font-bold mt-4 uppercase tracking-widest">🏢 {userData.department}</p>
                            )}
                            
                            <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-700 space-y-4 text-left">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Kayıt Tarihi</span>
                                    <span className="font-bold text-gray-900 dark:text-white">
                                        {userData.created_at ? new Date(userData.created_at).toLocaleDateString('tr-TR') : 'Bilinmiyor'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Son Oturum</span>
                                    <span className="font-bold text-gray-900 dark:text-white">
                                        {userData.last_login_at ? new Date(userData.last_login_at).toLocaleDateString('tr-TR') : '—'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* SAĞ PANEL: İÇERİK VE SEKMELER */}
                <div className="lg:col-span-8 flex flex-col gap-8">
                    
                    {/* SEKME NAVİGASYONU */}
                    <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <nav className="flex overflow-x-auto custom-scrollbar">
                            {[
                                { id: 'profile', label: 'GENEL BİLGİLER', icon: '👤' },
                                { id: 'security', label: 'GÜVENLİK', icon: '🔒' },
                                { id: 'preferences', label: 'TERCİHLER', icon: '⚙️' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => { setActiveTab(tab.id); setSaveMessage(''); }}
                                    className={`flex-1 py-6 font-black text-[10px] uppercase tracking-[0.2em] transition-all flex justify-center items-center gap-3 border-b-4 ${
                                        activeTab === tab.id
                                        ? 'border-blue-600 text-blue-600 bg-blue-50/50 dark:bg-blue-900/10 dark:text-blue-400'
                                        : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                                    }`}
                                >
                                    <span className="text-lg">{tab.icon}</span> {tab.label}
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* MESAJ ALANI */}
                    {saveMessage && (
                        <div className={`p-5 rounded-[1.5rem] font-bold text-sm flex items-center gap-3 animate-slide-in border-2 ${
                            saveMessage.includes('✅') 
                            ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:border-green-800' 
                            : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                        }`}>
                            {saveMessage}
                        </div>
                    )}

                    {/* SEKME İÇERİKLERİ */}
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                        
                        {/* 1. PROFİL BİLGİLERİ */}
                        {activeTab === 'profile' && (
                            <form onSubmit={handleProfileUpdate} className="flex flex-col h-full animate-fade-in">
                                <div className="p-8 sm:p-10 space-y-8 flex-1">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Ad Soyad *</label>
                                            <input type="text" name="name" value={formData.name} onChange={handleInputChange} required
                                                className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold text-sm dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Departman</label>
                                            <input type="text" name="department" value={formData.department} onChange={handleInputChange} placeholder="Örn: Mimari Tasarım"
                                                className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold text-sm dark:text-white"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">İletişim Numarası</label>
                                        <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="+90 5XX XXX XX XX" maxLength={17}
                                            className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold text-sm dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Hakkımda & Biyografi</label>
                                        <textarea name="bio" value={formData.bio} onChange={handleInputChange} rows="4" placeholder="Kendinizden veya uzmanlık alanlarınızdan bahsedin..."
                                            className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-medium text-sm dark:text-white resize-none"
                                        />
                                    </div>
                                </div>
                                <div className="px-10 py-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex justify-end shrink-0">
                                    <button type="submit" disabled={loading} className="px-10 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-3">
                                        {loading ? <LoadingSpinner size="small" color="white" /> : 'DEĞİŞİKLİKLERİ KAYDET'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* 2. GÜVENLİK */}
                        {activeTab === 'security' && (
                            <div className="flex flex-col h-full animate-fade-in">
                                <form onSubmit={handlePasswordChangeSubmit} className="p-8 sm:p-10 space-y-8 flex-1">
                                    <div>
                                        <h4 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-widest mb-6">Şifre Yönetimi</h4>
                                        <div className="space-y-6 p-8 bg-gray-50 dark:bg-gray-900/50 rounded-[2rem] border border-gray-100 dark:border-gray-700">
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Mevcut Şifreniz *</label>
                                                <input type="password" name="currentPassword" value={passwordData.currentPassword} onChange={handlePasswordChange} required
                                                    className="w-full px-6 py-4 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold text-sm dark:text-white"
                                                />
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-200 dark:border-gray-700/50">
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Yeni Şifre *</label>
                                                    <input type="password" name="newPassword" value={passwordData.newPassword} onChange={handlePasswordChange} required minLength={6} placeholder="En az 6 karakter"
                                                        className="w-full px-6 py-4 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold text-sm dark:text-white"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Yeni Şifre (Tekrar) *</label>
                                                    <input type="password" name="confirmPassword" value={passwordData.confirmPassword} onChange={handlePasswordChange} required minLength={6}
                                                        className="w-full px-6 py-4 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold text-sm dark:text-white"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </form>
                                <div className="px-10 py-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex justify-end shrink-0">
                                    <button onClick={handlePasswordChangeSubmit} disabled={loading || !passwordData.currentPassword || !passwordData.newPassword} className="px-10 py-4 bg-gray-900 hover:bg-black dark:bg-gray-700 dark:hover:bg-gray-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-3">
                                        {loading ? <LoadingSpinner size="small" color="white" /> : 'ŞİFREYİ GÜNCELLE'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 3. TERCİHLER */}
                        {activeTab === 'preferences' && (
                            <div className="p-8 sm:p-10 space-y-10 animate-fade-in">
                                
                                {/* Tema Seçimi */}
                                <div>
                                    <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-[0.2em] mb-6">Arayüz Teması</h4>
                                    <div className="grid grid-cols-2 gap-6">
                                        <button onClick={() => handleThemeChange('light')} className={`p-8 border-2 rounded-[2rem] text-center transition-all flex flex-col items-center gap-4 ${themeSettings.theme === 'light' ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 shadow-lg' : 'border-gray-100 dark:border-gray-700 hover:border-blue-300 bg-white dark:bg-gray-800'}`}>
                                            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-3xl">🌞</div>
                                            <div className="font-black text-xs uppercase tracking-widest dark:text-white">Aydınlık Mod</div>
                                        </button>
                                        <button onClick={() => handleThemeChange('dark')} className={`p-8 border-2 rounded-[2rem] text-center transition-all flex flex-col items-center gap-4 ${themeSettings.theme === 'dark' ? 'border-blue-600 bg-gray-900 dark:bg-gray-800 shadow-lg' : 'border-gray-100 dark:border-gray-700 hover:border-blue-300 bg-white dark:bg-gray-800'}`}>
                                            <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center text-3xl">🌙</div>
                                            <div className={`font-black text-xs uppercase tracking-widest ${themeSettings.theme === 'dark' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>Karanlık Mod</div>
                                        </button>
                                    </div>
                                </div>

                                <div className="h-px bg-gray-100 dark:bg-gray-700"></div>

                                {/* Bildirimler */}
                                <div>
                                    <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-[0.2em] mb-6">İletişim & Bildirim İzinleri</h4>
                                    <div className="space-y-4">
                                        {[
                                            { id: 'email', label: 'E-posta Bildirimleri', description: 'Önemli sistem güncellemeleri ve günlük özetler' },
                                            { id: 'tasks', label: 'Görev Atamaları', description: 'Size yeni bir iş atandığında anında haberdar olun' },
                                            { id: 'meetings', label: 'Toplantı Hatırlatıcıları', description: 'Yaklaşan toplantılar için takvim uyarıları' }
                                        ].map(setting => (
                                            <div key={setting.id} className="flex items-center justify-between p-6 border-2 border-gray-50 dark:border-gray-700/50 rounded-[1.5rem] hover:border-gray-100 dark:hover:border-gray-600 transition-colors">
                                                <div>
                                                    <div className="font-black text-sm text-gray-900 dark:text-white uppercase tracking-wider">{setting.label}</div>
                                                    <div className="text-[10px] font-bold text-gray-500 mt-1 uppercase tracking-widest">{setting.description}</div>
                                                </div>
                                                <button onClick={() => handleNotificationToggle(setting.id)} className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none ${notificationSettings[setting.id] ? 'bg-blue-600 shadow-lg shadow-blue-500/30' : 'bg-gray-200 dark:bg-gray-700'}`}>
                                                    <span className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-sm transition duration-300 ease-in-out ${notificationSettings[setting.id] ? 'translate-x-6' : 'translate-x-0'}`} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                            </div>
                        )}
                    </div>

                    {/* ROL BAZLI İSTATİSTİKLER (WIDGETLAR) */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 animate-fade-in">
                        {[
                            { l: 'Aktif Proje', v: statistics.activeProjects, i: '🚀', c: 'blue' },
                            { l: 'Tamamlanan İş', v: statistics.completedTasks, i: '✅', c: 'green' },
                            { l: 'Ajanda', v: statistics.totalMeetings, i: '📅', c: 'purple' },
                            { l: 'Atanan Görev', v: statistics.assignedTasks, i: '📋', c: 'orange' }
                        ].map((stat, idx) => (
                            <div key={idx} className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center text-center transform hover:-translate-y-1 transition-transform">
                                <div className={`w-12 h-12 rounded-2xl bg-${stat.c}-50 dark:bg-${stat.c}-900/20 flex items-center justify-center text-2xl mb-4`}>{stat.i}</div>
                                {loadingStats ? (
                                    <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
                                ) : (
                                    <div className={`text-4xl font-black text-${stat.c}-600 dark:text-${stat.c}-400 mb-1 leading-none`}>{stat.v}</div>
                                )}
                                <div className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">{stat.l}</div>
                            </div>
                        ))}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default Profile;