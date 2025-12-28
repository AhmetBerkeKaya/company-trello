// src/pages/Dashboard.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import { Link, useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const { userData } = useAuth();
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

  // Müşteri Rol Kontrolü
  const isClient = userData?.role === 'client';

  useEffect(() => {
    if (userData) {
      fetchDashboardData();
    } else {
      setLoading(false);
    }
  }, [userData]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Müşteri ise 'fetchMyTasks' yapmasına gerek yok
      const promises = [
        fetchProjects(),
        fetchUpcomingMeetings()
      ];
      // Sadece personel ise görevleri çek
      if (!isClient) {
        promises.push(fetchMyTasks());
      }

      const results = await Promise.all(promises);
      const projectsData = results[0];
      const meetingsData = results[1];
      const tasksData = isClient ? [] : results[2]; // Müşteri için boş dizi

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
      setMyTasks(tasksData);

    } catch (error) {
      console.error('Dashboard veri hatası:', error);
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    const response = await api.get('/projects');
    return response.data;
  };

  const fetchUpcomingMeetings = async () => {
    const response = await api.get('/meetings/upcoming');
    return response.data;
  };

  const fetchMyTasks = async () => {
    const response = await api.get('/tasks/my');
    return response.data;
  };
  
  const handlePendingTasksClick = () => {
    if (myTasks.length > 0 && myTasks[0].project_id) {
      navigate(`/projects/${myTasks[0].project_id}`);
    } else {
      navigate('/projects');
    }
  };

  const handleTaskClick = (task) => {
    if (task.project_id) navigate(`/projects/${task.project_id}`);
    else navigate('/projects');
  };

  if (loading) return <div className="flex justify-center items-center h-[calc(100vh-200px)]"><LoadingSpinner size="large" /></div>;

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Hoş Geldiniz, {userData?.name}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        
        {/* YENİ PROJE BUTONU: Müşteriye Gizli */}
        {!isClient && (
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
      <div className={`grid grid-cols-1 md:grid-cols-2 ${isClient ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-6 mb-8`}>
        <StatCard icon="📁" label="Toplam Proje" value={stats.totalProjects} color="blue" link="/projects" />
        <StatCard icon="🔄" label="Aktif Proje" value={stats.activeProjects} color="green" link="/projects" state={{ activeTab: 'active' }} />
        <StatCard icon="📅" label="Yaklaşan Toplantı" value={stats.upcomingMeetings} color="purple" link="/meetings" state={{ activeTab: 'agenda' }} />
        
        {/* BEKLEYEN GÖREV KARTI: Müşteriye Gizli */}
        {!isClient && (
          <StatCard icon="✅" label="Bekleyen Görev" value={stats.pendingTasks} color="orange" onCardClick={handlePendingTasksClick} />
        )}
      </div>

      {/* Grid Yapısı: Müşteri ise tek kolon (sadece toplantılar), değilse iki kolon */}
      <div className={`grid grid-cols-1 ${isClient ? '' : 'lg:grid-cols-2'} gap-8`}>
        
        {/* BENİM GÖREVLERİM: Müşteriye Gizli */}
        {!isClient && (
          <DashboardSection
            title="Benim Görevlerim"
            emptyMessage="Size atanmış görev bulunmuyor."
            items={myTasks}
            renderItem={(task) => (
              <TaskCard key={task.task_id} task={task} onTaskClick={handleTaskClick} />
            )}
            viewAllLink="/projects"
          />
        )}

        {/* YAKLAŞAN TOPLANTILAR: Herkese Açık */}
        <DashboardSection
          title="Yaklaşan Toplantılar"
          emptyMessage="Yaklaşan toplantınız yok."
          items={upcomingMeetings}
          renderItem={(meeting) => (
            <MeetingCard key={meeting.meeting_id} meeting={meeting} />
          )}
          viewAllLink="/meetings"
        />
      </div>
    </div>
  );
};

// Alt Bileşenler
const StatCard = ({ icon, label, value, color, link, state, onCardClick }) => {
    const colorClasses = {
      blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300',
      green: 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-300',
      purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-300',
      orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-300'
    };
    const handleClick = (e) => { if (onCardClick) { e.preventDefault(); onCardClick(); } };
    const content = (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-6 hover:shadow-md transition-all ${(onCardClick || link) ? 'cursor-pointer hover:scale-105' : ''}`} onClick={onCardClick ? handleClick : undefined}>
        <div className="flex items-center">
          <div className={`p-3 rounded-full ${colorClasses[color] || colorClasses.blue}`}><span className="text-2xl">{icon}</span></div>
          <div className="ml-4"><p className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</p><p className="text-2xl font-semibold text-gray-900 dark:text-white">{value || 0}</p></div>
        </div>
      </div>
    );
    return (link && !onCardClick) ? <Link to={link} state={state} className="block">{content}</Link> : content;
  };
  
  const DashboardSection = ({ title, emptyMessage, items, renderItem, viewAllLink }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
        {items.length > 0 && viewAllLink && <Link to={viewAllLink} className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium">Tümünü Gör →</Link>}
      </div>
      <div className="p-6">
        {items.length === 0 ? <div className="text-center py-8"><p className="text-gray-500 text-sm">{emptyMessage}</p></div> : <div className="space-y-4">{items.map(renderItem)}</div>}
      </div>
    </div>
  );
  
  const MeetingCard = ({ meeting }) => {
    const getMeetingTime = () => {
      if (!meeting.start_time) return 'Tarih yok';
      try { return new Date(meeting.start_time).toLocaleString('tr-TR'); } catch (e) { return 'Geçersiz tarih'; }
    };
    return (
      <div className="block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="font-medium text-gray-900 dark:text-white">{meeting.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{meeting.description}</p>
            <div className="flex items-center mt-2 text-xs text-gray-500"><span>🕒 {getMeetingTime()}</span>{meeting.location && <span className="ml-4">📍 {meeting.location}</span>}</div>
          </div>
          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 rounded-full">Planlandı</span>
        </div>
      </div>
    );
  };
  
  const TaskCard = ({ task, onTaskClick }) => {
    const getStatusLabel = (s) => { switch(s) { case 'todo': return 'Yapılacak'; case 'inProgress': return 'Devam Ediyor'; case 'done': case 'completed': return 'Tamamlandı'; default: return s; } };
    const getStatusColor = (s) => { switch(s) { case 'todo': return 'bg-gray-100 text-gray-800'; case 'inProgress': return 'bg-yellow-100 text-yellow-800'; case 'done': case 'completed': return 'bg-green-100 text-green-800'; default: return 'bg-gray-100 text-gray-800'; } };
    return (
      <div className="block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer" onClick={() => onTaskClick(task)}>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="font-medium text-gray-900 dark:text-white">{task.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{task.description}</p>
            <div className="flex items-center mt-2 text-xs text-gray-500"><span>Durum: </span><span className={`ml-1 px-2 py-1 rounded-full ${getStatusColor(task.status)}`}>{getStatusLabel(task.status)}</span>{task.project_id && <span className="ml-4 text-blue-600">Projeye Git →</span>}</div>
          </div>
        </div>
      </div>
    );
  };

export default Dashboard;