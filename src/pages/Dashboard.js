// src/pages/Dashboard.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
// SİLİNDİ: Firebase importları (collection, query, where, getDocs, orderBy, limit)
// SİLİNDİ: import { db } from '../firebase/config';
import api from '../api/axios'; // YENİ: Kendi axios istemcimizi import ediyoruz
import LoadingSpinner from '../components/UI/LoadingSpinner';
import { Link, useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const { userData } = useAuth(); // Artık currentUser'a gerek yok, userData her şeyi içeriyor
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalProjects: 0,
    activeProjects: 0,
    upcomingMeetings: 0,
    pendingTasks: 0
  });
  const [recentProjects, setRecentProjects] = useState([]);
  const [upcomingMeetings, setUpcomingMeetings] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // userData (giriş yapmış kullanıcı bilgisi) gelince verileri çek
    if (userData) {
      fetchDashboardData();
    } else {
      // Eğer bir şekilde userData yoksa (teorik olarak olmamalı)
      setLoading(false);
    }
  }, [userData]); // Sadece userData'ya bağlı

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      console.log('🔍 Dashboard verileri YENİ API\'den yükleniyor...');

      // YENİ: Tüm API isteklerini Promise.all ile aynı anda yapıyoruz
      const [projectsResponse, meetingsResponse, tasksResponse] = await Promise.all([
        fetchProjects(),
        fetchUpcomingMeetings(),
        fetchMyTasks()
      ]);

      // Not: Artık .data dememize gerek yok, direkt diziyi döndüreceğiz
      const projectsData = projectsResponse;
      const meetingsData = meetingsResponse;
      const tasksData = tasksResponse;
      
      console.log('📊 Veriler alındı:', {
        projects: projectsData.length,
        meetings: meetingsData.length,
        tasks: tasksData.length
      });

      // Statü isimlerini PostgreSQL ENUM'larımıza göre güncelledik
      const pendingTasksCount = Array.isArray(tasksData)
        ? tasksData.filter(t => t.status !== 'done' && t.status !== 'completed').length
        : 0;

      setStats({
        totalProjects: projectsData.length,
        // 'active' ENUM tipimizle uyumlu
        activeProjects: projectsData.filter(p => p.status === 'active').length,
        upcomingMeetings: meetingsData.length,
        pendingTasks: pendingTasksCount
      });

      setRecentProjects(projectsData.slice(0, 5));
      setUpcomingMeetings(meetingsData.slice(0, 5));
      setMyTasks(Array.isArray(tasksData) ? tasksData : []);

    } catch (error) {
      console.error('❌ Dashboard veri getirme hatası:', error);
      // Token süresi dolmuş veya geçersizse login'e at
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        console.log('Yetki hatası, login sayfasına yönlendiriliyor.');
        // TODO: Belki useAuth() üzerinden bir logout() çağrısı yapmak daha temiz olabilir
        navigate('/login');
      }
      setMyTasks([]);
    } finally {
      setLoading(false);
    }
  };

  // YENİ: fetchProjects
  const fetchProjects = async () => {
    try {
      // Firebase YERİNE: Kendi API'mize (GET /api/projects) istek atıyoruz
      // Bu istek 'authMiddleware'den geçecek ve 'Authorization' header'ını kullanacak
      const response = await api.get('/projects');
      console.log('📁 Projeler:', response.data);
      return response.data; // API'den gelen proje dizisi
    } catch (error) {
      console.error('❌ Projeleri getirme hatası:', error);
      throw error; // Hatanın fetchDashboardData tarafından yakalanmasını sağla
    }
  };

  // YENİ: fetchUpcomingMeetings
  const fetchUpcomingMeetings = async () => {
    try {
      // Firebase YERİNE: Kendi API'mize (GET /api/meetings/upcoming) istek atıyoruz
      const response = await api.get('/meetings/upcoming');
      console.log('📅 Toplantılar:', response.data);
      // API'den gelen veri zaten filtrelenmiş ve sıralanmış
      // .filter ve .sort kısımlarına gerek kalmadı
      return response.data;
    } catch (error) {
      console.error('❌ Toplantıları getirme hatası:', error);
      throw error;
    }
  };

  // YENİ: fetchMyTasks
  const fetchMyTasks = async () => {
    try {
      // Firebase YERİNE: Kendi API'mize (GET /api/tasks/my) istek atıyoruz
      const response = await api.get('/tasks/my');
      console.log('📋 Görevler:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Görevleri getirme hatası:', error);
      throw error;
    }
  };
  
  // BEKLEYEN GÖREV BUTONU İÇİN FONKSİYON (Aynen kaldı, projectId bekliyor)
  const handlePendingTasksClick = () => {
    try {
      if (!myTasks || !Array.isArray(myTasks)) {
        console.warn('myTasks tanımlı değil');
        navigate('/projects');
        return;
      }
      const pendingTasks = myTasks.filter(task =>
        task && task.status !== 'done' && task.status !== 'completed'
      );
      if (pendingTasks.length > 0) {
        const firstTask = pendingTasks[0];
        // Veritabanı sütun adımız 'project_id' (PostgreSQL standardı)
        if (firstTask && firstTask.project_id) {
          navigate(`/projects/${firstTask.project_id}`);
        } else {
          navigate('/projects');
        }
      } else {
        navigate('/projects');
      }
    } catch (error) {
      console.error('Bekleyen görevler tıklanırken hata:', error);
      navigate('/projects');
    }
  };

  // TASK CARD CLICK HANDLER (Aynen kaldı, projectId bekliyor)
  const handleTaskClick = (task) => {
    // Veritabanı sütun adımız 'project_id'
    if (task.project_id) {
      navigate(`/projects/${task.project_id}`);
    } else {
      navigate('/projects');
    }
  };

  // --- RENDER KISMI (HTML/JSX) ---
  // Render kısmında neredeyse HİÇBİR DEĞİŞİKLİK YOK.
  // Sadece 'MeetingCard' ve 'TaskCard' component'lerindeki
  // veri alanlarını PostgreSQL'e uyarlamamız gerekti.

  if (loading) {
    // Yükleniyor ekranını tam sayfa kaplayacak şekilde gösterelim
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Hoş Geldiniz Mesajı */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Hoş Geldiniz, {userData?.name}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {new Date().toLocaleDateString('tr-TR', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>
        {/* 'role' alanı artık userData'da var */}
        {userData?.role !== 'user' && (
          <Link
            to="/projects"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
          >
            <span>+</span>
            <span>Yeni Proje</span>
          </Link>
        )}
      </div>

      {/* İstatistik Kartları (Aynen kaldı) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon="📁"
          label="Toplam Proje"
          value={stats.totalProjects}
          color="blue"
          link="/projects"
        />
        <StatCard
          icon="🔄"
          label="Aktif Proje"
          value={stats.activeProjects}
          color="green"
          link="/projects"
          state={{ activeTab: 'active' }}
        />
        <StatCard
          icon="📅"
          label="Yaklaşan Toplantı"
          value={stats.upcomingMeetings}
          color="purple"
          link="/meetings"
          state={{ activeTab: 'agenda' }}
        />
        <StatCard
          icon="✅"
          label="Bekleyen Görev"
          value={stats.pendingTasks}
          color="orange"
          onCardClick={handlePendingTasksClick}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Benim Görevlerim - SOL TARAF */}
        <DashboardSection
          title="Benim Görevlerim"
          emptyMessage="Size atanmış görev bulunmuyor."
          items={myTasks}
          renderItem={(task) => (
            // YENİ: 'task.id' -> 'task.task_id' (Veritabanı sütun adımız)
            <TaskCard key={task.task_id} task={task} onTaskClick={handleTaskClick} />
          )}
          viewAllLink="/projects"
        />

        {/* Yaklaşan Toplantılar - SAĞ TARAF */}
        <DashboardSection
          title="Yaklaşan Toplantılar"
          emptyMessage="Yaklaşan toplantınız yok."
          items={upcomingMeetings}
          renderItem={(meeting) => (
            // YENİ: 'meeting.id' -> 'meeting.meeting_id' (Veritabanı sütun adımız)
            <MeetingCard key={meeting.meeting_id} meeting={meeting} />
          )}
          viewAllLink="/meetings"
        />
      </div>
    </div>
  );
};

// --- ALT COMPONENTLER (DEĞİŞTİ) ---

// İstatistik Kartı Component'i (Aynen kaldı)
const StatCard = ({ icon, label, value, color, link, state, onCardClick }) => {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-300',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-300',
    orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-300'
  };
  const handleClick = (e) => {
    if (onCardClick) {
      e.preventDefault();
      onCardClick();
    }
  };
  const content = (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-6 hover:shadow-md dark:hover:shadow-gray-900/70 transition-all ${(onCardClick || link) ? 'cursor-pointer hover:scale-105' : ''
        }`}
      onClick={onCardClick ? handleClick : undefined}
    >
      <div className="flex items-center">
        <div className={`p-3 rounded-full ${colorClasses[color] || colorClasses.blue}`}>
          <span className="text-2xl">{icon}</span>
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">
            {typeof value === 'number' ? value : 0}
          </p>
        </div>
      </div>
    </div>
  );
  if (link && !onCardClick) {
    return (
      <Link to={link} state={state} className="block">
        {content}
      </Link>
    );
  }
  return content;
};

// Dashboard Bölüm Component'i (Aynen kaldı)
const DashboardSection = ({ title, emptyMessage, items, renderItem, viewAllLink }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50">
    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
      {items.length > 0 && viewAllLink && (
        <Link
          to={viewAllLink}
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
        >
          Tümünü Gör →
        </Link>
      )}
    </div>
    <div className="p-6">
      {items.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400 text-sm">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(renderItem)}
        </div>
      )}
    </div>
  </div>
);

// Toplantı Kartı Component'i (DEĞİŞTİ)
const MeetingCard = ({ meeting }) => {
  // YENİ: Veri artık Firebase 'Timestamp' objesi değil,
  // PostgreSQL'den gelen standart bir 'ISO string'.
  // Bunu direkt 'new Date()' ile kullanabiliriz.
  const getMeetingTime = () => {
    if (!meeting.start_time) return 'Tarih yok';
    try {
      // 'meeting.startTime.toDate()' YERİNE:
      return new Date(meeting.start_time).toLocaleString('tr-TR');
    } catch (e) {
      console.error('Tarih format hatası', e);
      return 'Geçersiz tarih';
    }
  };

  return (
    <div className="block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="font-medium text-gray-900 dark:text-white">{meeting.title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
            {meeting.description}
          </p>
          <div className="flex items-center mt-2 text-xs text-gray-500 dark:text-gray-500">
            {/* YENİ: 'meeting.startTime' -> 'meeting.start_time' */}
            <span>🕒 {getMeetingTime()}</span>
            {meeting.location && (
              <span className="ml-4">📍 {meeting.location}</span>
            )}
          </div>
        </div>
        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 rounded-full">
          Planlandı
        </span>
      </div>
    </div>
  );
};

// Görev Kartı Component'i (DEĞİŞTİ)
const TaskCard = ({ task, onTaskClick }) => {
  // YENİ: Statü isimleri artık bizim ENUM tipimize ('inProgress') uyumlu olmalı
  const getStatusLabel = (status) => {
    switch (status) {
      case 'todo': return 'Yapılacak';
      case 'inProgress': return 'Devam Ediyor';
      case 'done':
      case 'completed': return 'Tamamlandı';
      default: return status;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'todo': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'inProgress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'done':
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };
  
  return (
    <div
      className="block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
      // YENİ: 'task.project_id' (Veritabanı sütun adı)
      onClick={() => onTaskClick(task)}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="font-medium text-gray-900 dark:text-white">{task.title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
            {task.description}
          </p>
          <div className="flex items-center mt-2 text-xs text-gray-500 dark:text-gray-500">
            <span>Durum: </span>
            <span className={`ml-1 px-2 py-1 rounded-full ${getStatusColor(task.status)}`}>
              {getStatusLabel(task.status)}
            </span>
            {/* YENİ: 'task.project_id' */}
            {task.project_id && (
              <span className="ml-4 text-blue-600 dark:text-blue-400">
                Projeye Git →
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;