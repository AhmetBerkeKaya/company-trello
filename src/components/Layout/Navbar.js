import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Navbar = () => {
  const { currentUser, userData, logout, theme, toggleTheme } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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
    { path: '/meetings', label: 'Toplantılarım', icon: '📅' },
  ];

  // Admin için ek link
  if (userData?.role === 'admin') {
    navItems.push({ path: '/admin/users', label: 'Kullanıcılar', icon: '👥' });
  }

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700 fixed w-full top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo ve Navigasyon */}
          <div className="flex items-center space-x-8">
            <Link 
              to="/" 
              className="text-xl font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              ProAEC Proje Yönetim Sistemi
            </Link>

            <div className="flex space-x-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === item.path
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

          {/* Kullanıcı Bilgileri ve Dropdown */}
          <div className="flex items-center space-x-4">
            {/* Tema Değiştirme Butonu */}
            <button
              onClick={handleThemeToggle}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
              title={theme === 'light' ? 'Koyu temaya geç' : 'Açık temaya geç'}
            >
              {theme === 'light' ? '🌙' : '🌞'}
            </button>

            <div className="text-right hidden sm:block">
              <div className="font-medium text-gray-900 dark:text-white">{userData?.name}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                {userData?.role === 'admin' ? 'Yönetici' :
                  userData?.role === 'manager' ? 'Proje Yöneticisi' : 'Kullanıcı'}
                {userData?.department && ` • ${userData.department}`}
              </div>
            </div>

            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                  {userData?.avatar ? (
                    <img
                      src={userData.avatar}
                      alt={userData.name}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    getInitials(userData?.name || 'U')
                  )}
                </div>
                <span className="hidden md:block dark:text-gray-300">▾</span>
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700">
                  <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 sm:hidden">
                    <div className="font-medium text-gray-900 dark:text-white">{userData?.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 capitalize">{userData?.role}</div>
                  </div>

                  <Link
                    to="/profile"
                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    👤 Profilim
                  </Link>

                  <button
                    onClick={handleThemeToggle}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    {theme === 'light' ? '🌙 Koyu Tema' : '🌞 Açık Tema'}
                  </button>

                  <div className="border-t border-gray-100 dark:border-gray-700">
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      🚪 Çıkış Yap
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dropdown dışına tıklayınca kapat */}
      {isDropdownOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsDropdownOpen(false)}
        ></div>
      )}
    </nav>
  );
};

export default Navbar;