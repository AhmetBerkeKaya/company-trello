// src/pages/MyTasks.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import LoadingSpinner from '../components/UI/LoadingSpinner';

const MyTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await api.get('/tasks/my');
      setTasks(response.data);
    } catch (error) {
      console.error('Görevleri getirme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskClick = (task) => {
    if (task.project_id) {
      const isPin = !!task.plan_file_id || !!task.pin_3d_data;
      navigate(`/projects/${task.project_id}`, {
        state: {
          targetPhaseId: task.phase_id,
          targetTaskId: task.task_id || task.id,
          targetTab: isPin ? 'viewer' : 'board'
        }
      });
    }
  };

  if (loading) return <div className="min-h-screen flex justify-center items-center"><LoadingSpinner size="large" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="max-w-7xl mx-auto animate-fade-in">
        
        {/* PREMIUM HEADER */}
        <div className="mb-10 bg-white dark:bg-gray-800 p-8 sm:p-10 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5 select-none pointer-events-none text-8xl font-black italic uppercase">TASKS</div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight leading-tight uppercase mb-2">
                        Bana Atanan <span className="text-blue-600">Görevler</span>
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-bold uppercase tracking-widest">
                        Tüm projelerdeki aktif iş yükünüzü buradan yönetebilirsiniz.
                    </p>
                </div>
                <button onClick={() => navigate(-1)} className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all">
                    ← Geri Dön
                </button>
            </div>
        </div>

        {/* GÖREV KARTLARI (GRID YAPI) */}
        {tasks.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-20 text-center shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="text-7xl mb-6">🎉</div>
            <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-widest mb-2">Görev Kutusu Boş!</h2>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Şu anda size atanmış aktif bir görev bulunmuyor.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tasks.map(task => {
                const is2DPin = !!task.plan_file_id;
                const is3DPin = !!task.pin_3d_data;
                const isPin = is2DPin || is3DPin;

                return (
                  <div key={task.task_id} className="group block p-8 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700/50 rounded-[2rem] hover:border-blue-200 dark:hover:border-blue-800/50 transition-all hover:shadow-xl cursor-pointer" onClick={() => handleTaskClick(task)}>
                    <div className="flex justify-between items-start gap-4 mb-4">
                        <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wider group-hover:text-blue-600 transition-colors flex-1">
                          {isPin && <span className="mr-2 text-xl">📍</span>}
                          {task.title}
                        </h3>
                    </div>
                    
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 line-clamp-3 mb-6 leading-relaxed min-h-[3rem]">{task.description || 'Açıklama bulunmuyor'}</p>
                    
                    <div className="flex flex-wrap items-center pt-5 border-t border-gray-100 dark:border-gray-700/50 gap-3">
                        {isPin ? (
                            <span className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                {is3DPin ? '3D PİNİ' : 'PAFTA PİNİ'}
                            </span>
                        ) : (
                            <span className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                #{task.task_id.slice(-6)}
                            </span>
                        )}
                        
                        {task.due_date && (
                            <span className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                ⏳ {new Date(task.due_date).toLocaleDateString('tr-TR')}
                            </span>
                        )}

                        <div className="w-full mt-2">
                           <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest line-clamp-1 border border-gray-100 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-gray-50 dark:bg-gray-900/50">
                               📁 {task.project_name || 'PROJE BİLİNMİYOR'}
                           </span>
                        </div>
                    </div>
                  </div>
                );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyTasks;