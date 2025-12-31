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
  
  // Müşteri Görünürlüğü State'i
  const [isClientVisible, setIsClientVisible] = useState(false); 

  const [projectMembers, setProjectMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // GÖZLEMCİ KONTROLÜ: Admin/Manager olsa bile observer ise ekleyemez
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
      <div className={`flex justify-between items-center mb-3 p-3 rounded-t-lg shadow-sm border-b-2 
        ${isLocked 
          ? 'bg-blue-50 dark:bg-blue-900/40 border-blue-200 dark:border-blue-800' 
          : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600'
        }`}
      >
        <div className="flex items-center gap-2">
          {isLocked && <span className="text-blue-500 text-xs">🔒</span>}
          <h3 className={`font-bold text-sm md:text-base ${isLocked ? 'text-blue-700 dark:text-blue-100' : 'text-gray-700 dark:text-gray-200'}`}>
            {column.title} 
            <span className="ml-2 text-xs font-normal opacity-70">({column.tasks.length})</span>
          </h3>
        </div>

        <div className="flex items-center gap-1">
           {/* SİLME BUTONU: Kilitli değilse, Yetkili ise VE Gözlemci DEĞİLSE görünür */}
           {!isLocked && (userRole === 'admin' || userRole === 'manager') && !isObserver && (
            <button 
              onClick={handleDeleteColumn}
              className="text-gray-400 hover:text-red-500 p-1 transition-colors"
              title="Sütunu Sil"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}

          {/* EKLEME BUTONU: Gözlemciye gizli */}
          {canAddTask && (
            <button
              onClick={() => setIsAddingTask(true)}
              className={`text-lg p-1 w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 
                ${isLocked ? 'text-blue-600 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}`}
              title="Yeni görev ekle"
            >
              +
            </button>
          )}
        </div>
      </div>

      {/* YENİ GÖREV FORMU */}
      {isAddingTask && canAddTask && (
        <div className="mb-3 mx-1 p-3 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-blue-200 dark:border-blue-900 z-10">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Görev başlığı..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-white"
            autoFocus
          />
          {(userRole === 'admin' || userRole === 'manager') && (
            <div className="mb-2 space-y-2">
              <select
                value={newTaskAssignee}
                onChange={(e) => setNewTaskAssignee(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-white"
              >
                <option value="">Atanmadı (Bana Ata)</option>
                {loadingMembers ? (
                  <option value="">Yükleniyor...</option>
                ) : (
                  projectMembers.map(member => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.name} ({member.role})
                    </option>
                  ))
                )}
              </select>

              <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 p-1 rounded">
                <input 
                    type="checkbox"
                    checked={isClientVisible}
                    onChange={(e) => setIsClientVisible(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="flex items-center">
                    👁️ Müşteriye Göster
                </span>
              </label>
            </div>
          )}
          <div className="flex space-x-2 mt-2">
            <button
              onClick={handleAddTask}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded text-sm"
            >
              Ekle
            </button>
            <button
              onClick={() => {
                setIsAddingTask(false);
                setNewTaskAssignee('');
                setIsClientVisible(false);
              }}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-1 px-3 rounded text-sm"
            >
              İptal
            </button>
          </div>
        </div>
      )}

      {/* GÖREV LİSTESİ */}
      <div className="flex-1 space-y-2 overflow-y-auto px-1 min-h-[50px]">
        {column.tasks.map(task => (
          <DraggableTask
            key={task.id}
            task={task}
            onUpdate={onTaskUpdate}
            userRole={userRole}
            currentUserId={currentUserId}
            isObserver={isObserver} // Gözlemci bilgisini karta da iletiyoruz
          />
        ))}

        {column.tasks.length === 0 && !isAddingTask && (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 text-xs py-4 opacity-50">
            <span>Boş</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Column;