import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import { Link, useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const { userData, currentUser } = useAuth();
  const navigate = useNavigate(); // ← BU SATIR ÇOK ÖNEMLİ
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

      const pendingTasksCount = Array.isArray(tasksData)
        ? tasksData.filter(t => t.status !== 'done' && t.status !== 'completed').length
        : 0;

      setStats({
        totalProjects: projectsData.length,
        activeProjects: projectsData.filter(p => p.status === 'active').length,
        upcomingMeetings: meetingsData.length,
        pendingTasks: pendingTasksCount
      });

      setRecentProjects(projectsData.slice(0, 5));
      setUpcomingMeetings(meetingsData.slice(0, 5));
      setMyTasks(Array.isArray(tasksData) ? tasksData : []);

    } catch (error) {
      console.error('❌ Dashboard veri getirme hatası:', error);
      setMyTasks([]);
    } finally {
      setLoading(false);
    }
  };

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

  const fetchUpcomingMeetings = async () => {
    try {
      const now = new Date();

      const meetingsQuery = query(
        collection(db, 'meetings'),
        where('participants', 'array-contains', userData.id)
      );

      const meetingsSnapshot = await getDocs(meetingsQuery);
      const allMeetings = meetingsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

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

      return upcoming;

    } catch (error) {
      console.error('❌ Toplantıları getirme hatası:', error);
      return [];
    }
  };

  const fetchMyTasks = async () => {
    try {
      if (!userData || !userData.id) {
        console.warn('Kullanıcı verisi yok, görevler getirilemiyor');
        return [];
      }

      // Önce normal sorguyu dene
      try {
        const tasksQuery = query(
          collection(db, 'tasks'),
          where('assignee', '==', userData.id)
        );

        const tasksSnapshot = await getDocs(tasksQuery);
        console.log('📋 Normal sorgu sonucu:', tasksSnapshot.docs.length, 'görev');

        const tasks = tasksSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        return tasks;

      } catch (queryError) {
        console.warn('❌ Normal sorgu başarısız, debug moda geçiliyor:', queryError);
        // Normal sorgu başarısız olursa debug moduna geç
        return await fetchAllTasksForDebug();
      }

    } catch (error) {
      console.error('❌ Görevleri getirme hatası:', error);
      return [];
    }
  };

  // BEKLEYEN GÖREV BUTONU İÇİN FONKSİYON
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
        if (firstTask && firstTask.projectId) {
          navigate(`/projects/${firstTask.projectId}`);
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

  // TASK CARD CLICK HANDLER
  const handleTaskClick = (task) => {
    if (task.projectId) {
      navigate(`/projects/${task.projectId}`);
    } else {
      navigate('/projects');
    }
  };


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
            <TaskCard key={task.id} task={task} onTaskClick={handleTaskClick} />
          )}
          viewAllLink="/projects"
        />

        {/* Yaklaşan Toplantılar - SAĞ TARAF */}
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
    </div>
  );
};

// İstatistik Kartı Component'i
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
const TaskCard = ({ task, onTaskClick }) => (
  <div
    className="block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
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
          <span className={`ml-1 px-2 py-1 rounded-full ${task.status === 'todo' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' :
            task.status === 'inProgress' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' :
              'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
            }`}>
            {task.status === 'todo' ? 'Yapılacak' :
              task.status === 'inProgress' ? 'Devam Ediyor' : 'Tamamlandı'}
          </span>
          {task.projectId && (
            <span className="ml-4 text-blue-600 dark:text-blue-400">
              Projeye Git →
            </span>
          )}
        </div>
      </div>
    </div>
  </div>
);

export default Dashboard;