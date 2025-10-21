import { useState, useEffect } from 'react';
import { getUserNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../../utils/notificationHelper';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Navbar = () => {
  const { currentUser, userData, logout, theme, toggleTheme } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // YENİ: Mobil menü
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

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

  if (!currentUser) return null;

  const navItems = [
    { path: '/', label: 'Kontrol Paneli', icon: '📊' },
    { path: '/projects', label: 'Projelerim', icon: '📁' },
  ];

  // Sadece admin ve manager müşteri kartlarını görebilir
  if (userData?.role === 'admin' || userData?.role === 'manager') {
    navItems.push({ path: '/customers', label: 'Müşteri Kartları', icon: '🏢' });
  }

  navItems.push({ path: '/meetings', label: 'Toplantılarım', icon: '📅' });

  // Admin için ek link
  if (userData?.role === 'admin') {
    navItems.push({ path: '/admin/users', label: 'Kullanıcılar', icon: '👥' });
  }

  useEffect(() => {
    if (userData) {
      fetchNotifications();
    }
  }, [userData]);

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Bildirimleri getir
  const fetchNotifications = async () => {
    if (!userData) return;

    try {
      setLoadingNotifications(true);
      const userNotifications = await getUserNotifications(userData.id);
      setNotifications(userNotifications);

      const unread = userNotifications.filter(n => !n.read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Bildirimleri getirme hatası:', error);
    } finally {
      setLoadingNotifications(false);
    }
  };

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700 fixed w-full top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex justify-between items-center h-14 sm:h-16">
          {/* Sol Taraf: Logo ve Mobil Menü Butonu */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Mobil Menü Butonu */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors sm:hidden"
              aria-label="Menü"
            >
              <span className="text-lg">☰</span>
            </button>

            {/* Logo */}
            <Link
              to="/"
              className="text-lg sm:text-xl font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors truncate"
            >
              <span className="hidden sm:inline">ProAEC Proje Yönetim Sistemi</span>
              <span className="sm:hidden">ProAEC</span>
            </Link>
          </div>

          {/* Masaüstü Navigasyon - Mobilde gizli */}
          <div className="hidden sm:flex items-center space-x-4">
            <div className="flex space-x-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${location.pathname === item.path
                    ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-600 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-400'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                    }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Sağ Taraf: Kullanıcı İşlemleri */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Tema Değiştirme Butonu */}
            <button
              onClick={handleThemeToggle}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
              title={theme === 'light' ? 'Koyu temaya geç' : 'Açık temaya geç'}
            >
              <span className="text-sm sm:text-base">{theme === 'light' ? '🌙' : '🌞'}</span>
            </button>

            {/* Bildirim İkonu */}
            <div className="relative">
              <button
                onClick={() => {
                  setIsNotificationsOpen(!isNotificationsOpen);
                  setIsDropdownOpen(false);
                  setIsMobileMenuOpen(false);
                }}
                className="relative p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                title="Bildirimler"
              >
                <span className="text-sm sm:text-base">🔔</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center text-[10px] sm:text-xs">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Bildirim Dropdown */}
              {isNotificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-96 overflow-hidden">
                  <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
                        Bildirimler
                        {unreadCount > 0 && (
                          <span className="ml-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                            {unreadCount} yeni
                          </span>
                        )}
                      </h3>
                      {unreadCount > 0 && (
                        <button
                          onClick={async () => {
                            await markAllNotificationsAsRead(userData.id);
                            await fetchNotifications();
                          }}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs sm:text-sm font-medium"
                        >
                          Tümünü okundu işaretle
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="overflow-y-auto max-h-64">
                    {loadingNotifications ? (
                      <div className="flex justify-center py-6">
                        <div className="text-gray-500 dark:text-gray-400 text-sm">Yükleniyor...</div>
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="text-center py-6 px-3">
                        <div className="text-3xl sm:text-4xl mb-2">🔔</div>
                        <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">Henüz bildirim yok</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {notifications.slice(0, 5).map(notification => (
                          <div
                            key={notification.id}
                            className={`p-2 sm:p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer ${!notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                              }`}
                            onClick={async () => {
                              if (!notification.read) {
                                await markNotificationAsRead(notification.id);
                                await fetchNotifications();
                              }
                              setIsNotificationsOpen(false);
                              if (notification.link) {
                                navigate(notification.link);
                              }
                            }}
                          >
                            <div className="flex items-start space-x-2 sm:space-x-3">
                              <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs sm:text-sm ${notification.type === 'task_assigned' ? 'bg-green-100 text-green-600' :
                                notification.type === 'task_updated' ? 'bg-blue-100 text-blue-600' :
                                  notification.type === 'meeting_created' ? 'bg-purple-100 text-purple-600' :
                                    notification.type === 'meeting_request' ? 'bg-orange-100 text-orange-600' : // YENİ: meeting_request için stil
                                      'bg-gray-100 text-gray-600'
                                }`}>
                                {notification.type === 'task_assigned' ? '📋' :
                                  notification.type === 'task_updated' ? '✏️' :
                                    notification.type === 'meeting_created' ? '📅' :
                                      notification.type === 'meeting_request' ? '📨' : // YENİ: meeting_request için ikon
                                        '🔔'}
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {notification.type === 'task_assigned' && `Yeni görev: ${notification.taskTitle}`}
                                  {notification.type === 'task_updated' && `Görev güncellendi: ${notification.taskTitle}`}
                                  {notification.type === 'meeting_created' && `Yeni toplantı: ${notification.meetingTitle}`}
                                  {notification.type === 'meeting_request' && `Toplantı İsteği: ${notification.metadata?.meetingTitle || 'Yeni talep'}`} {/* YENİ: meeting_request için başlık */}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                                  {notification.type === 'task_assigned' && `${notification.senderName} size görev atadı`}
                                  {notification.type === 'task_updated' && `${notification.senderName} görevi güncelledi`}
                                  {notification.type === 'meeting_created' && `${notification.senderName} toplantı oluşturdu`}
                                  {notification.type === 'meeting_request' && `${notification.metadata?.requestedByName || 'Bir kullanıcı'} toplantı talebinde bulundu`} {/* YENİ: meeting_request için açıklama */}
                                </p>
                                {notification.type === 'meeting_request' && notification.metadata?.reason && ( // YENİ: Talep nedeni gösterimi
                                  <p className="text-xs text-gray-600 dark:text-gray-500 mt-1 line-clamp-2">
                                    📝 {notification.metadata.reason}
                                  </p>
                                )}
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                  {notification.createdAt?.toDate?.().toLocaleString('tr-TR') || 'Yeni'}
                                </p>
                              </div>

                              {!notification.read && (
                                <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 mt-1 sm:mt-2"></div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Kullanıcı Bilgileri - Masaüstünde göster */}
            <div className="hidden sm:block text-right">
              <div className="font-medium text-gray-900 dark:text-white text-sm">{userData?.name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                {userData?.role === 'admin' ? 'Yönetici' :
                  userData?.role === 'manager' ? 'Proje Yöneticisi' : 'Kullanıcı'}
                {userData?.department && ` • ${userData.department}`}
              </div>
            </div>

            {/* Kullanıcı Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-1 sm:space-x-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 px-2 sm:px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-semibold">
                  {userData?.avatar ? (
                    <img
                      src={userData.avatar}
                      alt={userData.name}
                      className="w-6 h-6 sm:w-8 sm:h-8 rounded-full"
                    />
                  ) : (
                    getInitials(userData?.name || 'U')
                  )}
                </div>
                <span className="hidden md:block dark:text-gray-300 text-sm">▾</span>
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700">
                  <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 sm:hidden">
                    <div className="font-medium text-gray-900 dark:text-white text-sm">{userData?.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">{userData?.role}</div>
                  </div>

                  <Link
                    to="/profile"
                    className="block px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    👤 Profilim
                  </Link>

                  <button
                    onClick={handleThemeToggle}
                    className="block w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    {theme === 'light' ? '🌙 Koyu Tema' : '🌞 Açık Tema'}
                  </button>

                  <div className="border-t border-gray-100 dark:border-gray-700">
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      🚪 Çıkış Yap
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobil Menü - Açılır Kapanır */}
        {isMobileMenuOpen && (
          <div className="sm:hidden bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-2">
            <div className="flex flex-col space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${location.pathname === item.path
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Overlay - Dropdown/Menu dışına tıklayınca kapat */}
      {(isDropdownOpen || isNotificationsOpen || isMobileMenuOpen) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setIsDropdownOpen(false);
            setIsNotificationsOpen(false);
            setIsMobileMenuOpen(false);
          }}
        ></div>
      )}
    </nav>
  );
};

export default Navbar;