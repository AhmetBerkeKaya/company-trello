// src/components/Layout/Navbar.js
import { useState, useEffect, useRef } from 'react';
import { getUserNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../../utils/notificationHelper';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api/axios'; // Silme işlemi için api'yi dahil ettik

const Navbar = () => {
  const { userData, logout, theme, toggleTheme } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const navRef = useRef();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
        setIsNotificationsOpen(false);
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleThemeToggle = () => {
    toggleTheme();
  };

  const renderBrand = () => {
    if (userData?.logo_url) {
      return (
        <div className="flex items-center gap-2">
          <img src={userData.logo_url} alt={userData.company_name || 'Logo'} className="h-8 w-auto object-contain max-w-[140px] drop-shadow-sm" />
        </div>
      );
    }
    return (
      <span className="text-xl sm:text-2xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 drop-shadow-sm">
        {userData?.company_name || 'ProAEC'}
      </span>
    );
  };

  if (!userData) {
    return (
      <nav className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50 fixed w-full top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </div>
      </nav>
    );
  }

  const navItems = [
    { path: '/', label: 'Kontrol Paneli', icon: '📊' },
    { path: '/projects', label: 'Projelerim', icon: '📁' },
  ];

  if (['admin', 'manager', 'observer'].includes(userData?.role)) {
    navItems.push({ path: '/customers', label: 'Müşteriler', icon: '🏢' });
  }
  
  navItems.push({ path: '/meetings', label: 'Toplantılar', icon: '📅' });
  
  if (['admin', 'observer'].includes(userData?.role)) {
    navItems.push({ path: '/admin/users', label: 'Kullanıcılar', icon: '👥' });
  }

  useEffect(() => { if (userData) fetchNotifications(); }, [userData]);

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  const fetchNotifications = async () => {
    if (!userData) return;
    try {
      setLoadingNotifications(true);
      const userNotifications = await getUserNotifications();
      setNotifications(userNotifications);
      setUnreadCount(userNotifications.filter(n => !n.read).length);
    } catch (error) { console.error('Bildirim hatası:', error); } 
    finally { setLoadingNotifications(false); }
  };

  const handleMarkAllAsRead = async () => {
    try { await markAllNotificationsAsRead(userData.user_id); await fetchNotifications(); } catch (error) {}
  };

  // --- YENİ BİLDİRİM AKSİYONLARI ---
  const handleMarkAsReadSingle = async (e, id) => {
    e.stopPropagation(); // Tıklamanın karta geçip sayfayı yönlendirmesini engeller
    try {
      await markNotificationAsRead(id);
      await fetchNotifications();
    } catch (error) { console.error(error); }
  };

  const handleDeleteNotification = async (e, id) => {
    e.stopPropagation();
    try {
      // Backend'deki silme rotasına istek atıyoruz
      await api.delete(`/notifications/${id}`);
      await fetchNotifications();
    } catch (error) { 
      console.error('Bildirim silinemedi:', error); 
    }
  };

  return (
    <nav ref={navRef} className="bg-white/85 dark:bg-gray-900/85 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50 fixed w-full top-0 z-50 transition-colors duration-300 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 sm:h-20">
          
          <div className="flex items-center gap-3 sm:gap-6">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
              className="p-2 -ml-2 rounded-xl text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors sm:hidden focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            
            <Link to="/" className="flex items-center transition-transform hover:scale-105 active:scale-95 duration-200">
              {renderBrand()}
            </Link>
          </div>

          <div className="hidden sm:flex items-center space-x-1 lg:space-x-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link 
                  key={item.path} 
                  to={item.path} 
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    isActive 
                    ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 shadow-[inset_0_-2px_0_rgba(37,99,235,1)] dark:shadow-[inset_0_-2px_0_rgba(96,165,250,1)]' 
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'
                  }`}
                >
                  <span className="text-lg opacity-80">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            
            <button 
              onClick={handleThemeToggle} 
              className="p-2.5 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 hidden sm:block"
              title="Temayı Değiştir"
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>

            <div className="relative">
              <button 
                onClick={() => { setIsNotificationsOpen(!isNotificationsOpen); setIsDropdownOpen(false); }} 
                className="relative p-2.5 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white dark:border-gray-900"></span>
                  </span>
                )}
              </button>
              
              {isNotificationsOpen && (
                <div className="absolute right-0 mt-3 w-80 sm:w-[400px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden transform origin-top-right transition-all z-50 flex flex-col max-h-[80vh]">
                  <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50 shrink-0">
                      <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        Bildirimler {unreadCount > 0 && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full shadow-sm">{unreadCount} Yeni</span>}
                      </h3>
                      {unreadCount > 0 && <button onClick={handleMarkAllAsRead} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-xs font-semibold hover:underline">Tümünü Okundu İşaretle</button>}
                  </div>
                  
                  <div className="overflow-y-auto custom-scrollbar flex-1">
                    {loadingNotifications ? <div className="flex justify-center p-8"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div> 
                    : notifications.length === 0 ? <div className="text-center py-12 text-gray-500 dark:text-gray-400 flex flex-col items-center"><span className="text-5xl mb-3">📭</span><p className="font-medium">Henüz bildirim yok</p></div> 
                    : (
                      <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                        {/* BİLDİRİMLERİ 10 TANE GÖSTERİYORUZ */}
                        {notifications.slice(0, 10).map(n => (
                          <div 
                            key={n.notification_id} 
                            onClick={async () => { if(!n.read) { await markNotificationAsRead(n.notification_id); await fetchNotifications(); } setIsNotificationsOpen(false); if(n.link) navigate(n.link); }}
                            className={`group relative p-4 cursor-pointer transition-colors flex gap-4 ${!n.read ? 'bg-blue-50/40 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                          >
                            <div className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${!n.read ? 'bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.6)]' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                            
                            <div className="flex-1 min-w-0 pr-12">
                              <p className={`text-sm ${!n.read ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'} truncate`}>{n.title}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 leading-relaxed pr-2">{n.message}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 font-medium">{new Date(n.created_at).toLocaleString('tr-TR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</p>
                            </div>

                            {/* HOVER AKSİYON BUTONLARI (Okundu İşaretle ve Sil) */}
                            <div className="absolute right-3 top-3 flex flex-col sm:flex-row items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-1 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                                {!n.read && (
                                  <button 
                                    onClick={(e) => handleMarkAsReadSingle(e, n.notification_id)}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                                    title="Okundu İşaretle"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                  </button>
                                )}
                                <button 
                                  onClick={(e) => handleDeleteNotification(e, n.notification_id)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                                  title="Sil"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Tümünü Gör Butonu (Eğer 10'dan fazla bildirim varsa) */}
                  {notifications.length > 10 && (
                    <div className="p-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 text-center shrink-0">
                      <Link 
                        to="/notifications" 
                        onClick={() => setIsNotificationsOpen(false)}
                        className="text-sm font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Tümünü Gör ({notifications.length})
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="hidden lg:flex flex-col items-end justify-center mr-2">
              <div className="font-bold text-gray-900 dark:text-white text-sm leading-none">{userData?.name}</div>
              <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold mt-1 uppercase tracking-wider">
                {userData?.role === 'admin' ? 'Yönetici' : userData?.role === 'manager' ? 'Proje Yöneticisi' : userData?.role === 'observer' ? 'Gözlemci' : userData?.role === 'client' ? 'Müşteri' : 'Kullanıcı'}
              </div>
            </div>

            <div className="relative">
              <button 
                onClick={() => { setIsDropdownOpen(!isDropdownOpen); setIsNotificationsOpen(false); }} 
                className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md shadow-blue-500/30 border-2 border-white dark:border-gray-800">
                  {getInitials(userData?.name)}
                </div>
                <svg className="w-4 h-4 text-gray-500 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>
              
              {isDropdownOpen && (
                <div className="absolute right-0 mt-3 w-56 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 py-2 z-50 transform origin-top-right transition-all">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 lg:hidden mb-1">
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{userData?.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{userData?.email}</p>
                  </div>
                  
                  <Link to="/profile" className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" onClick={() => setIsDropdownOpen(false)}>
                    <span className="text-lg">👤</span> Profilim
                  </Link>
                  
                  <button 
                    onClick={handleThemeToggle} 
                    className="w-full flex sm:hidden items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left"
                  >
                    <span className="text-lg">{theme === 'light' ? '🌙' : '☀️'}</span> {theme === 'light' ? 'Koyu Tema' : 'Açık Tema'}
                  </button>

                  <div className="h-px bg-gray-100 dark:bg-gray-700 my-1"></div>
                  <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left">
                    <span className="text-lg">🚪</span> Çıkış Yap
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      <div 
        className={`sm:hidden overflow-hidden transition-all duration-300 ease-in-out bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl border-b border-gray-200/50 dark:border-gray-800/50 ${
          isMobileMenuOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 py-3 space-y-1 shadow-inner">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.path} 
                to={item.path} 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-semibold transition-colors ${
                  isActive 
                  ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' 
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <span className="text-xl opacity-80">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
          
          <div className="h-px bg-gray-200 dark:bg-gray-700 my-2"></div>
          
          <button 
            onClick={() => { handleThemeToggle(); setIsMobileMenuOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
          >
            <span className="text-xl opacity-80">{theme === 'light' ? '🌙' : '☀️'}</span>
            <span>{theme === 'light' ? 'Koyu Tema' : 'Açık Tema'}</span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;