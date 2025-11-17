// src/components/Kanban/Board.js
import React, { useState, useEffect } from 'react';
import { DndProvider, useDrop } from 'react-dnd'; // 'useDrag' silindi
import { HTML5Backend } from 'react-dnd-html5-backend';
import Column from './Column';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';

const ItemTypes = {
  TASK: 'task'
};

// SİLİNDİ: 'DraggableTask' component'i buradan kaldırıldı.
// Artık 'Task.js' dosyasındaki component'i kullanacağız.

// Droppable Column (DÜZELTME: 'TaskComponent' prop'u kaldırıldı)
const DroppableColumn = ({ column, projectId, onTaskUpdate, moveTask, userRole, currentUserId }) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: ItemTypes.TASK,
    drop: (item) => moveTask(item.id, column.id),
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
    }),
  }));

  return (
    <div
      ref={drop}
      className={`flex-shrink-0 w-full md:w-80 rounded-lg p-4 transition-colors ${isOver
        ? 'bg-blue-100 dark:bg-blue-900/30'
        : 'bg-gray-100 dark:bg-gray-800/50'
        }`}
    >
      <Column
        column={column}
        projectId={projectId}
        onTaskUpdate={onTaskUpdate}
        // SİLİNDİ: TaskComponent={DraggableTask} prop'u kaldırıldı
        userRole={userRole}
        currentUserId={currentUserId}
      />
    </div>
  );
};

// Ana Board Component (API'ye bağlı - DÜZELTME: 'onTaskMoveSuccess' eklendi)
const Board = ({ projectId, userRole, currentUserId, onTaskMoveSuccess }) => {
  const { userData } = useAuth();
  const [columns, setColumns] = useState([
    { id: 'todo', title: 'Yapılacaklar', tasks: [] },
    { id: 'inProgress', title: 'Devam Eden', tasks: [] },
    { id: 'done', title: 'Tamamlandı', tasks: [] }
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (projectId) {
      fetchTasks();
    }
  }, [projectId]);

  // fetchTasks (API'ye bağlı - Değişiklik yok)
  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/projects/${projectId}/tasks`);
      const tasks = response.data;
      
      const updatedColumns = [
        { id: 'todo', title: 'Yapılacaklar', tasks: tasks.filter(task => task.status === 'todo') },
        { id: 'inProgress', title: 'Devam Eden', tasks: tasks.filter(task => task.status === 'inProgress') },
        { id: 'done', title: 'Tamamlandı', tasks: tasks.filter(task => task.status === 'done' || task.status === 'completed') }
      ];

      setColumns(updatedColumns);

    } catch (error) {
      console.error('Görevleri getirme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  // moveTask (API'ye bağlı - Değişiklik yok, 'onTaskMoveSuccess' çağrısı içeriyor)
  const moveTask = async (taskId, newStatus) => {
    
    const taskToMove = columns
      .flatMap(col => col.tasks)
      .find(task => task.id === taskId);

    const canMoveTask = userRole === 'admin' ||
      userRole === 'manager' ||
      (taskToMove && taskToMove.assignee_user_id === currentUserId);

    if (!canMoveTask) {
      alert('Bu görevi taşıma yetkiniz yok! Sadece kendi görevlerinizi taşıyabilirsiniz.');
      return;
    }

    // Optimistic UI Update (Arayüzü hemen güncelle)
    setColumns(prevColumns => {
        const newColumns = prevColumns.map(column => {
          if (column.tasks.some(task => task.id === taskId)) {
            return { ...column, tasks: column.tasks.filter(task => task.id !== taskId) };
          }
          return column;
        });
        return newColumns.map(column => {
          if (column.id === newStatus) {
            if (taskToMove) {
              const finalStatus = (newStatus === 'done' || newStatus === 'completed') ? 'done' : newStatus;
              if (column.id === finalStatus) {
                 return { ...column, tasks: [...column.tasks, { ...taskToMove, status: newStatus }] };
              }
            }
          }
          return column;
        });
      });

    try {
      // API'ye güncelleme isteği at
      await api.put(`/tasks/${taskId}/status`, { status: newStatus });
      
      // Ebeveyne (ProjectDetail) haber ver (Genel Bakış'ı güncellemek için)
      if (onTaskMoveSuccess) {
        onTaskMoveSuccess();
      }

      console.log(`✅ Görev ${taskId} ${newStatus} durumuna taşındı (API)`);

    } catch (error) {
      console.error('❌ Görev taşıma hatası (API):', error);
      alert('Görev taşınamadı: ' + (error.response?.data?.message || error.message));
      fetchTasks(); // Hata varsa Arayüzü API ile eşitle
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="text-gray-500 dark:text-gray-400">Görevler yükleniyor...</div>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4">
        {columns.map(column => (
          <DroppableColumn
            key={column.id}
            column={column}
            projectId={projectId}
            onTaskUpdate={fetchTasks}
            moveTask={moveTask}
            userRole={userRole}
            currentUserId={currentUserId}
          />
        ))}
      </div>
    </DndProvider>
  );
};

export default Board;