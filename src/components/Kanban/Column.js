// src/components/Kanban/Column.js
import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import DraggableTask from './Task';

const Column = ({ column, projectId, onTaskUpdate, userRole, currentUserId, isObserver }) => {
  const { userData } = useAuth();
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [isClientVisible, setIsClientVisible] = useState(false); 
  const [projectMembers, setProjectMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const canAddTask = (userRole === 'admin' || userRole === 'manager') && !isObserver;
  const isLocked = column.is_locked;

  useEffect(() => {
    if (isAddingTask && projectId && canAddTask) {
      fetchProjectMembers();
    }
  }, [isAddingTask, projectId, canAddTask]);

  const fetchProjectMembers = async () => {
    try {
      setLoadingMembers(true);
      const response = await api.get(`/projects/${projectId}/members`);
      setProjectMembers(response.data);
    } catch (error) {
      console.error('Üyeleri getirme hatası:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    try {
      await api.post('/tasks', {
        title: newTaskTitle,
        status: column.id,
        projectId: projectId,
        assignee: newTaskAssignee || null,
        isVisibleToClient: isClientVisible
      });
      
      setNewTaskTitle('');
      setNewTaskAssignee('');
      setIsClientVisible(false);
      setIsAddingTask(false);
      onTaskUpdate();
    } catch (error) {
      console.error('Görev ekleme hatası:', error);
    }
  };

  const handleDeleteColumn = async () => {
    if (!window.confirm(`"${column.title}" sütununu ve içindeki tüm görevleri silmek istediğinize emin misiniz?`)) return;
    try {
      await api.delete(`/columns/${column.id}`);
      onTaskUpdate(); 
    } catch (error) {
      alert('Sütun silinemedi: ' + (error.response?.data?.message || error.message));
    }
  };

  return (
    <div className="w-full flex flex-col h-full">
      {/* HEADER KISMI */}
      <div className={`flex justify-between items-center mb-6 p-6 rounded-[2rem] shadow-sm border-2 
        ${isLocked 
          ? 'bg-blue-50/80 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' 
          : 'bg-white dark:bg-gray-800 border-transparent'
        }`}
      >
        <div className="flex items-center gap-3">
          {isLocked && <span className="text-xl">🔒</span>}
          <h3 className={`font-black text-sm uppercase tracking-widest ${isLocked ? 'text-blue-800 dark:text-blue-300' : 'text-gray-900 dark:text-white'}`}>
            {column.title} 
            <span className="ml-3 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-lg text-[10px]">{column.tasks.length}</span>
          </h3>
        </div>

        <div className="flex items-center gap-2">
           {!isLocked && (userRole === 'admin' || userRole === 'manager') && !isObserver && (
            <button onClick={handleDeleteColumn} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Sütunu Sil">
              ✕
            </button>
          )}
          {canAddTask && (
            <button onClick={() => setIsAddingTask(true)} className={`w-8 h-8 flex items-center justify-center rounded-xl font-black text-lg transition-colors ${isLocked ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'}`} title="Yeni görev ekle">
              +
            </button>
          )}
        </div>
      </div>

      {/* YENİ GÖREV FORMU */}
      {isAddingTask && canAddTask && (
        <div className="mb-4 mx-2 p-6 bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl border-2 border-blue-200 dark:border-blue-800 relative z-10 animate-slide-in">
          <input type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="Görev başlığı..." autoFocus
            className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold text-sm mb-4 dark:text-white"
          />
          {(userRole === 'admin' || userRole === 'manager') && (
            <div className="mb-6 space-y-4">
              <select value={newTaskAssignee} onChange={(e) => setNewTaskAssignee(e.target.value)}
                className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold text-xs uppercase tracking-wider dark:text-white appearance-none"
              >
                <option value="">👤 Atanmadı (Bana Ata)</option>
                {loadingMembers ? <option value="">Yükleniyor...</option> : projectMembers.map(member => (
                  <option key={member.user_id} value={member.user_id}>{member.name.toUpperCase()} ({member.role})</option>
                ))}
              </select>

              <label className="flex items-center space-x-3 p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/50 rounded-2xl cursor-pointer group">
                <input type="checkbox" checked={isClientVisible} onChange={(e) => setIsClientVisible(e.target.checked)} className="w-5 h-5 text-purple-600 rounded-md focus:ring-purple-500" />
                <span className="font-black text-[10px] text-purple-800 dark:text-purple-300 uppercase tracking-widest group-hover:text-purple-600 transition-colors">
                    👁️ Müşteriye Göster
                </span>
              </label>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={handleAddTask} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all">Ekle</button>
            <button onClick={() => { setIsAddingTask(false); setNewTaskAssignee(''); setIsClientVisible(false); }} className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">İptal</button>
          </div>
        </div>
      )}

      {/* GÖREV LİSTESİ */}
      <div className="flex-1 space-y-4 overflow-y-auto px-2 pb-6 min-h-[100px] custom-scrollbar">
        {column.tasks.map(task => (
          <DraggableTask key={task.id} task={task} onUpdate={onTaskUpdate} userRole={userRole} currentUserId={currentUserId} isObserver={isObserver} />
        ))}
        {column.tasks.length === 0 && !isAddingTask && (
          <div className="h-32 flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-[2rem] mx-2">
            <span className="font-black text-[10px] uppercase tracking-widest">Sütun Boş</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Column;