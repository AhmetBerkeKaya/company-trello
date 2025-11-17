// src/components/Kanban/Column.js
import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import DraggableTask from './Task';

// DÜZELTME: 'TaskComponent' prop'u kaldırıldı
const Column = ({ column, projectId, onTaskUpdate, userRole, currentUserId }) => {
  const { userData } = useAuth();
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [projectMembers, setProjectMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const canAddTask = userRole === 'admin' || userRole === 'manager';

  useEffect(() => {
    if (isAddingTask && projectId && canAddTask) {
      fetchProjectMembers();
    }
  }, [isAddingTask, projectId, canAddTask]);

  // fetchProjectMembers (API'ye bağlı - Değişiklik yok)
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

  // handleAddTask (API'ye bağlı - Değişiklik yok)
  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    try {
      await api.post('/tasks', {
        title: newTaskTitle,
        status: column.id,
        projectId: projectId,
        assignee: newTaskAssignee || null 
      });
      setNewTaskTitle('');
      setNewTaskAssignee('');
      setIsAddingTask(false);
      onTaskUpdate();
    } catch (error) {
      console.error('Görev ekleme hatası:', error);
    }
  };

  return (
    <div className="w-full">
      {/* Column Header (Değişiklik yok) */}
      <div className="flex justify-between items-center mb-4 p-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
        <h3 className="font-semibold text-gray-700 dark:text-gray-300 text-sm md:text-base">
          {column.title} <span className="text-gray-500 dark:text-gray-400">({column.tasks.length})</span>
        </h3>
        {canAddTask && (
          <button
            onClick={() => setIsAddingTask(true)}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-lg p-1"
            title="Yeni görev ekle"
          >
            +
          </button>
        )}
      </div>

      {/* Yeni Görev Ekleme Formu (Değişiklik yok) */}
      {isAddingTask && canAddTask && (
        <div className="mb-3 p-3 bg-white dark:bg-gray-700 rounded-lg shadow border border-gray-200 dark:border-gray-600">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Görev başlığı..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-white"
            autoFocus
          />
          {(userRole === 'admin' || userRole === 'manager') && (
            <div className="mb-2">
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                Atanan Kişi:
              </label>
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
            </div>
          )}
          <div className="flex space-x-2">
            <button
              onClick={handleAddTask}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded text-sm transition-colors"
            >
              Ekle
            </button>
            <button
              onClick={() => {
                setIsAddingTask(false);
                setNewTaskAssignee('');
              }}
              className="flex-1 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 py-1 px-3 rounded text-sm transition-colors"
            >
              İptal
            </button>
          </div>
        </div>
      )}

      {/* Görev Listesi (DÜZELTME: <TaskComponent> yerine <Task> kullan) */}
      <div className="space-y-3 min-h-[100px]">
        {column.tasks.map(task => (
          <DraggableTask // YENİ: 'Task' (Task.js'ten import edilen) component'i render ediyoruz
            key={task.id}
            task={task}
            onUpdate={onTaskUpdate}
            userRole={userRole}
            currentUserId={currentUserId}
          />
        ))}

        {column.tasks.length === 0 && !isAddingTask && (
          <div className="text-center text-gray-400 dark:text-gray-500 text-sm py-6 bg-white dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
            📝<br />
            Görev yok
          </div>
        )}
      </div>
    </div>
  );
};

export default Column;