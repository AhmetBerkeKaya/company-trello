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

  const isClient = userData?.role === 'client';
  const canCreateProject = ['admin', 'manager'].includes(userData?.role);

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
      
      const promises = [
        fetchProjects(),
        fetchUpcomingMeetings()
      ];
      if (!isClient) {
        promises.push(fetchMyTasks());
      }

      const results = await Promise.all(promises);
      const projectsData = results[0];
      const meetingsData = results[1];
      const tasksData = isClient ? [] : results[2]; 

      // Sütun ID'lerine bakmaksızın bitmemiş görevleri sayıyoruz (done/completed hariç)
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
    // Eskiden projects'e atıyordu, artık yeni sayfamıza atacak.
    navigate('/my-tasks');
  };

  const handleTaskClick = (task) => {
    if (task.project_id) {
      const isPin = !!task.plan_file_id || !!task.pin_3d_data;
      navigate(`/projects/${task.project_id}`, {
        state: {
          targetPhaseId: task.phase_id,
          targetTaskId: task.task_id || task.id,
          targetTab: isPin ? 'viewer' : 'board' // Pin ise direkt Viewer'a at!
        }
      });
    } else {
      navigate('/projects');
    }
  };

  if (loading) return <div className="min-h-screen flex justify-center items-center"><LoadingSpinner size="large" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="max-w-7xl mx-auto">
        
        {/* --- PREMIUM HEADER --- */}
        <div className="mb-10 bg-white dark:bg-gray-800 p-8 sm:p-10 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 animate-fade-in relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5 select-none pointer-events-none text-8xl font-black italic uppercase">DASHBOARD</div>
            
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 relative z-10">
                <div className="flex-1 min-w-0">
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight leading-tight uppercase mb-2">
                        Hoş Geldiniz, <span className="text-blue-600">{userData?.name?.split(' ')[0]}</span>!
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                        <span>📅</span>
                        {new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                
                {canCreateProject && (
                    <Link
                        to="/projects"
                        className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0"
                    >
                        <span>➕</span> YENİ PROJE
                    </Link>
                )}
            </div>
        </div>

        {/* --- İSTATİSTİK KARTLARI --- */}
        <div className={`grid grid-cols-2 ${isClient ? 'md:grid-cols-3' : 'md:grid-cols-4'} gap-4 sm:gap-6 mb-10 animate-fade-in`}>
          <StatCard icon="📁" label="Toplam Proje" value={stats.totalProjects} color="blue" link="/projects" />
          <StatCard icon="🚀" label="Aktif Proje" value={stats.activeProjects} color="green" link="/projects" state={{ activeTab: 'active' }} />
          <StatCard icon="📅" label="Yaklaşan Toplantı" value={stats.upcomingMeetings} color="purple" link="/meetings" state={{ activeTab: 'agenda' }} />
          
          {!isClient && (
            <StatCard icon="📋" label="Bekleyen Görev" value={stats.pendingTasks} color="orange" onCardClick={handlePendingTasksClick} />
          )}
        </div>

        {/* --- LİSTELER (GÖREVLER VE TOPLANTILAR) --- */}
        <div className={`grid grid-cols-1 ${isClient ? '' : 'lg:grid-cols-2'} gap-8 animate-fade-in`}>
          
          {!isClient && (
            <DashboardSection
              title="BENİM GÖREVLERİM"
              icon="🎯"
              emptyMessage="Size atanmış bekleyen bir görev bulunmuyor."
              items={myTasks}
              renderItem={(task) => <TaskCard key={task.task_id} task={task} onTaskClick={handleTaskClick} />}
              viewAllLink="/my-tasks" // <--- BURAYI '/projects' YERİNE '/my-tasks' YAPTIK
            />
          )}

          <DashboardSection
            title="YAKLAŞAN TOPLANTILAR"
            icon="🤝"
            emptyMessage="Yakın zamanda planlanmış bir toplantınız yok."
            items={upcomingMeetings}
            renderItem={(meeting) => <MeetingCard key={meeting.meeting_id} meeting={meeting} />}
            viewAllLink="/meetings"
          />
        </div>

      </div>
    </div>
  );
};

// --- ALT BİLEŞENLER (PREMIUM TASARIM) ---

const StatCard = ({ icon, label, value, color, link, state, onCardClick }) => {
    const colorStyles = {
      blue: 'text-blue-600',
      green: 'text-green-600',
      purple: 'text-purple-600',
      orange: 'text-orange-600'
    };
    
    const handleClick = (e) => { if (onCardClick) { e.preventDefault(); onCardClick(); } };
    
    const content = (
      <div className={`bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center text-center transform hover:scale-105 transition-transform duration-300 ${(onCardClick || link) ? 'cursor-pointer' : ''}`} onClick={onCardClick ? handleClick : undefined}>
        <div className="text-3xl sm:text-4xl mb-3">{icon}</div>
        <div className={`text-3xl sm:text-4xl font-black ${colorStyles[color] || 'text-blue-600'} mb-2`}>{value || 0}</div>
        <div className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{label}</div>
      </div>
    );
    return (link && !onCardClick) ? <Link to={link} state={state} className="block">{content}</Link> : content;
};
  
const DashboardSection = ({ title, icon, emptyMessage, items, renderItem, viewAllLink }) => (
    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col h-full min-h-[400px]">
      <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
        <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-[0.2em] flex items-center gap-3">
            <span className="text-xl">{icon}</span> {title}
        </h2>
        {items.length > 0 && viewAllLink && (
          <Link to={viewAllLink} className="text-[10px] font-black text-blue-600 hover:text-blue-800 dark:text-blue-400 uppercase tracking-widest transition-colors flex items-center gap-1">
            TÜMÜNÜ GÖR <span className="text-lg">→</span>
          </Link>
        )}
      </div>
      <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 opacity-70 mt-10">
            <span className="text-6xl mb-4">📭</span>
            <span className="font-black text-xs uppercase tracking-widest">{emptyMessage}</span>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map(renderItem)}
          </div>
        )}
      </div>
    </div>
);
  
const MeetingCard = ({ meeting }) => {
    const getMeetingTime = () => {
      if (!meeting.start_time) return 'Tarih yok';
      try { return new Date(meeting.start_time).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return 'Geçersiz tarih'; }
    };
    return (
      <div className="group block p-6 bg-gray-50/50 dark:bg-gray-900/40 border-2 border-gray-100 dark:border-gray-700/50 rounded-[2rem] hover:bg-white dark:hover:bg-gray-800 hover:border-purple-200 dark:hover:border-purple-800/50 transition-all hover:shadow-xl">
        <div className="flex justify-between items-start gap-4 mb-4">
          <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider group-hover:text-purple-600 transition-colors flex-1">{meeting.title}</h3>
          <span className="shrink-0 px-3 py-1.5 text-[9px] font-black bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-lg border border-purple-200 dark:border-purple-800 uppercase tracking-widest">Planlandı</span>
        </div>
        <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 leading-relaxed">{meeting.description || 'Açıklama belirtilmemiş'}</p>
        
        <div className="flex flex-wrap items-center pt-4 border-t border-gray-200/50 dark:border-gray-700/50 gap-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
            <span className="flex items-center gap-2"><span className="text-base">🕒</span> {getMeetingTime()}</span>
            {meeting.location && <span className="flex items-center gap-2"><span className="text-base">📍</span> <span className="truncate max-w-[120px]">{meeting.location}</span></span>}
        </div>
      </div>
    );
};
  
const TaskCard = ({ task, onTaskClick }) => {
    const is2DPin = !!task.plan_file_id;
    const is3DPin = !!task.pin_3d_data;
    const isPin = is2DPin || is3DPin;

    return (
      <div className="group block p-6 bg-gray-50/50 dark:bg-gray-900/40 border-2 border-gray-100 dark:border-gray-700/50 rounded-[2rem] hover:bg-white dark:hover:bg-gray-800 hover:border-blue-200 dark:hover:border-blue-800/50 transition-all hover:shadow-xl cursor-pointer" onClick={() => onTaskClick(task)}>
        <div className="flex justify-between items-start gap-4 mb-4">
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider group-hover:text-blue-600 transition-colors flex-1">
              {isPin && <span className="mr-2 text-lg">📍</span>}
              {task.title}
            </h3>
        </div>
        
        <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 leading-relaxed">{task.description || 'Açıklama bulunmuyor'}</p>
        
        <div className="flex flex-wrap items-center pt-4 border-t border-gray-200/50 dark:border-gray-700/50 gap-3">
            {/* PIN İSE TURUNCU ROZET, GÖREV İSE GRİ ID GÖSTER */}
            {isPin ? (
                <span className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                    {is3DPin ? '3D MODEL PİNİ' : 'PAFTA PİNİ'}
                </span>
            ) : (
                <span className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    #{task.task_id.slice(-6)}
                </span>
            )}
            
            {task.due_date && (
                <span className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    Termin: {new Date(task.due_date).toLocaleDateString('tr-TR')}
                </span>
            )}

            {task.project_id && (
            <span className="ml-auto text-[9px] font-black text-blue-600 dark:text-blue-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest">
                {isPin ? 'Görüntüleyiciye Git' : 'Projeye Git'} <span className="text-lg">→</span>
            </span>
            )}
        </div>
      </div>
    );
};

export default Dashboard;