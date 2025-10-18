import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const { userData, currentUser } = useAuth();
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
    if (userData) {
      fetchDashboardData();
    }
  }, [userData]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      console.log('🔍 Dashboard verileri yükleniyor...');
      
      // Tüm verileri paralel olarak getir
      const [projectsData, meetingsData, tasksData] = await Promise.all([
        fetchProjects(),
        fetchUpcomingMeetings(),
        fetchMyTasks()
      ]);

      console.log('📊 Veriler alındı:', {
        projects: projectsData.length,
        meetings: meetingsData.length,
        tasks: tasksData.length
      });

      // İstatistikleri hesapla
      setStats({
        totalProjects: projectsData.length,
        activeProjects: projectsData.filter(p => p.status === 'active').length,
        upcomingMeetings: meetingsData.length,
        pendingTasks: tasksData.filter(t => t.status !== 'done').length
      });

      setRecentProjects(projectsData.slice(0, 5));
      setUpcomingMeetings(meetingsData.slice(0, 5));
      setMyTasks(tasksData.slice(0, 5));

    } catch (error) {
      console.error('❌ Dashboard veri getirme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  // Projeleri getir
  const fetchProjects = async () => {
    try {
      const projectsQuery = query(
        collection(db, 'projects'),
        where('members', 'array-contains', userData.id),
        orderBy('createdAt', 'desc')
      );
      
      const projectsSnapshot = await getDocs(projectsQuery);
      const projects = projectsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('📁 Projeler:', projects);
      return projects;
      
    } catch (error) {
      console.error('❌ Projeleri getirme hatası:', error);
      return [];
    }
  };

  // Yaklaşan toplantıları getir
  const fetchUpcomingMeetings = async () => {
    try {
      const now = new Date();
      console.log('🕒 Şu anki zaman:', now);
      
      // GEÇİCİ: Basit sorgu - index sorunu olmasın diye
      const meetingsQuery = query(
        collection(db, 'meetings'),
        where('participants', 'array-contains', userData.id)
        // orderBy kaldırıldı - index gerektirmesin diye
      );
      
      const meetingsSnapshot = await getDocs(meetingsQuery);
      const allMeetings = meetingsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // İstemci tarafında filtrele ve sırala
      const upcoming = allMeetings
        .filter(meeting => {
          const meetingTime = meeting.startTime?.toDate?.();
          return meetingTime && meetingTime > now;
        })
        .sort((a, b) => {
          const dateA = a.startTime?.toDate?.() || new Date(0);
          const dateB = b.startTime?.toDate?.() || new Date(0);
          return dateA - dateB;
        });
      
      console.log('📅 Tüm toplantılar:', allMeetings);
      console.log('🎯 Yaklaşan toplantılar:', upcoming);
      return upcoming;
      
    } catch (error) {
      console.error('❌ Toplantıları getirme hatası:', error);
      return [];
    }
  };

  // Görevlerimi getir
  const fetchMyTasks = async () => {
    try {
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('assignee', '==', userData.id)
        // orderBy kaldırıldı - index gerektirmesin diye
      );
      
      const tasksSnapshot = await getDocs(tasksQuery);
      const tasks = tasksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // İstemci tarafında sırala
      tasks.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB - dateA; // Yeniden eskiye
      });
      
      console.log('✅ Görevlerim:', tasks);
      return tasks;
      
    } catch (error) {
      console.error('❌ Görevleri getirme hatası:', error);
      return [];
    }
  };

  // Tarih formatı
  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('tr-TR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Kısa tarih formatı
  const formatShortDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('tr-TR', {
      day: 'numeric',
      month: 'short'
    }).format(date);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="large" />
        </div>
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

      {/* İstatistik Kartları */}
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
        />
        <StatCard
          icon="📅"
          label="Yaklaşan Toplantı"
          value={stats.upcomingMeetings}
          color="purple"
          link="/meetings"
        />
        <StatCard
          icon="✅"
          label="Bekleyen Görev"
          value={stats.pendingTasks}
          color="orange"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Son Projeler */}
        <DashboardSection
          title="Son Projelerim"
          emptyMessage="Henüz hiç projeniz yok."
          items={recentProjects}
          renderItem={(project) => (
            <ProjectCard key={project.id} project={project} />
          )}
          viewAllLink="/projects"
        />

        {/* Yaklaşan Toplantılar */}
        <DashboardSection
          title="Yaklaşan Toplantılar"
          emptyMessage="Yaklaşan toplantınız yok."
          items={upcomingMeetings}
          renderItem={(meeting) => (
            <MeetingCard key={meeting.id} meeting={meeting} />
          )}
          viewAllLink="/meetings"
        />
      </div>

      {/* Benim Görevlerim */}
      <div className="mt-8">
        <DashboardSection
          title="Benim Görevlerim"
          emptyMessage="Size atanmış görev bulunmuyor."
          items={myTasks}
          renderItem={(task) => (
            <TaskCard key={task.id} task={task} />
          )}
          viewAllLink="/projects"
        />
      </div>
    </div>
  );
};

// İstatistik Kartı Component'i
const StatCard = ({ icon, label, value, color, link }) => {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-300',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-300',
    orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-300'
  };

  const content = (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-6 hover:shadow-md dark:hover:shadow-gray-900/70 transition-shadow">
      <div className="flex items-center">
        <div className={`p-3 rounded-full ${colorClasses[color]}`}>
          <span className="text-2xl">{icon}</span>
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
        </div>
      </div>
    </div>
  );

  if (link) {
    return (
      <Link to={link} className="block">
        {content}
      </Link>
    );
  }

  return content;
};

// Dashboard Bölüm Component'i
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

// Proje Kartı Component'i
const ProjectCard = ({ project }) => (
  <Link
    to={`/projects/${project.id}`}
    className="block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group"
  >
    <div className="flex justify-between items-start">
      <div className="flex-1">
        <h3 className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {project.title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
          {project.description}
        </p>
        <div className="flex items-center mt-2 text-xs text-gray-500 dark:text-gray-500">
          <span>Oluşturulma: {project.createdAt && new Date(project.createdAt.toDate()).toLocaleDateString('tr-TR')}</span>
        </div>
      </div>
      <span className={`px-2 py-1 text-xs rounded-full ${
        project.status === 'active' 
          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
          : project.status === 'completed'
          ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
      }`}>
        {project.status === 'active' ? 'Aktif' : 
         project.status === 'completed' ? 'Tamamlandı' : 'Beklemede'}
      </span>
    </div>
  </Link>
);

// Toplantı Kartı Component'i
const MeetingCard = ({ meeting }) => (
  <div className="block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
    <div className="flex justify-between items-start">
      <div className="flex-1">
        <h3 className="font-medium text-gray-900 dark:text-white">{meeting.title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
          {meeting.description}
        </p>
        <div className="flex items-center mt-2 text-xs text-gray-500 dark:text-gray-500">
          <span>🕒 {meeting.startTime && new Date(meeting.startTime.toDate()).toLocaleString('tr-TR')}</span>
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

// Görev Kartı Component'i
const TaskCard = ({ task }) => (
  <div className="block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
    <div className="flex justify-between items-start">
      <div className="flex-1">
        <h3 className="font-medium text-gray-900 dark:text-white">{task.title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
          {task.description}
        </p>
        <div className="flex items-center mt-2 text-xs text-gray-500 dark:text-gray-500">
          <span>Durum: </span>
          <span className={`ml-1 px-2 py-1 rounded-full ${
            task.status === 'todo' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' :
            task.status === 'inProgress' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' :
            'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
          }`}>
            {task.status === 'todo' ? 'Yapılacak' :
             task.status === 'inProgress' ? 'Devam Ediyor' : 'Tamamlandı'}
          </span>
        </div>
      </div>
    </div>
  </div>
);

export default Dashboard;