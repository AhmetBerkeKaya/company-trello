import React, { useState, useEffect } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Column from './Column';
import { collection, query, where, getDocs, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { notifyTaskUpdate } from '../../utils/notificationHelper';

// YENİ: Task component'ini burada TANIMLAMA, sadece DraggableTask kullanacağız
const ItemTypes = {
  TASK: 'task'
};

// YENİ: Sadece DraggableTask component'i
const DraggableTask = ({ task, onUpdate }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.TASK,
    item: { id: task.id, status: task.status },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }), [task.id, task.status]);

  return (
    <div
      ref={drag}
      style={{
        opacity: isDragging ? 0.5 : 1,
        transform: isDragging ? 'scale(0.95)' : 'scale(1)'
      }}
      className="cursor-grab active:cursor-grabbing transition-transform"
    >
      {/* Task içeriği Column'dan gelecek */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md dark:hover:shadow-gray-900/70 transition-all p-3 border border-gray-200 dark:border-gray-700 cursor-pointer">
        <div className="flex justify-between items-start mb-2">
          <h4 className="font-medium text-gray-900 dark:text-white text-sm leading-tight">
            {task.title}
          </h4>
        </div>

        {task.description && (
          <p className="text-gray-600 dark:text-gray-400 text-xs mb-2 line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}

        <div className="flex justify-between items-center text-xs text-gray-400 dark:text-gray-500">
          <span className="truncate">
            {task.createdAt?.toDate?.().toLocaleDateString('tr-TR')}
          </span>
          <span className="flex-shrink-0">#{task.id.slice(-4)}</span>
        </div>
      </div>
    </div>
  );
};

// YENİ: Task component (DraggableTask'dan ayrı)
const Task = ({ task, onUpdate }) => {
  const [showDetailModal, setShowDetailModal] = useState(false);

  return (
    <>
      <div
        className="bg-white dark:bg-gray-800 rounded shadow dark:shadow-gray-900/50 p-3 hover:shadow-md dark:hover:shadow-gray-900/70 transition-shadow cursor-pointer"
        onClick={() => setShowDetailModal(true)}
      >
        <div className="flex justify-between items-start mb-2">
          <h4 className="font-medium text-gray-900 dark:text-white text-sm">{task.title}</h4>
        </div>

        {task.description && (
          <p className="text-gray-600 dark:text-gray-400 text-xs mb-2 line-clamp-2">{task.description}</p>
        )}

        <div className="flex justify-between items-center text-xs text-gray-400 dark:text-gray-500">
          <span>{task.createdAt?.toDate?.().toLocaleDateString('tr-TR')}</span>
          <span>#{task.id.slice(-4)}</span>
        </div>
      </div>
    </>
  );
};

// YENİ: Droppable Column component
const DroppableColumn = ({ column, projectId, onTaskUpdate, moveTask }) => {
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
        TaskComponent={DraggableTask}
      />
    </div>
  );
};

// Ana Board Component
const Board = ({ projectId }) => {
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

  const fetchTasks = async () => {
    try {
      setLoading(true);

      // Projeye ait görevleri getir
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('projectId', '==', projectId)
      );

      const tasksSnapshot = await getDocs(tasksQuery);
      const tasks = tasksSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data
        };
      });

      // İstemci tarafında sırala
      tasks.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateA - dateB;
      });

      // Görevleri kolonlara dağıt
      const updatedColumns = columns.map(column => ({
        ...column,
        tasks: tasks.filter(task => task.status === column.id)
      }));

      setColumns(updatedColumns);

    } catch (error) {
      console.error('Görevleri getirme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  // YENİ: Görevi taşıma fonksiyonu
  const moveTask = async (taskId, newStatus) => {
    try {
      // Önce UI'ı güncelle (optimistic update)
      setColumns(prevColumns => {
        return prevColumns.map(column => {
          // Eski kolondan görevi kaldır
          if (column.tasks.some(task => task.id === taskId)) {
            return {
              ...column,
              tasks: column.tasks.filter(task => task.id !== taskId)
            };
          }
          // Yeni kolona görevi ekle
          if (column.id === newStatus) {
            const taskToMove = prevColumns
              .flatMap(col => col.tasks)
              .find(task => task.id === taskId);

            if (taskToMove) {
              return {
                ...column,
                tasks: [...column.tasks, { ...taskToMove, status: newStatus }]
              };
            }
          }
          return column;
        });
      });

      await updateDoc(doc(db, 'tasks', taskId), {
        status: newStatus,
        updatedAt: new Date()
      });

      // BİLDİRİM EKLE - YENİ
      const taskToNotify = updatedColumns
        .flatMap(col => col.tasks)
        .find(task => task.id === taskId);

      if (taskToNotify && taskToNotify.assignee) {
        await notifyTaskUpdate(
          { ...taskToNotify, projectTitle: project?.title },
          { id: userData.id, name: userData.name }
        );
      }

      console.log(`✅ Görev ${taskId} ${newStatus} durumuna taşındı`);

    } catch (error) {
      console.error('❌ Görev taşıma hatası:', error);
      // Hata durumunda verileri yeniden yükle
      fetchTasks();
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
      {/* YENİ: Grid layout ve responsive classes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4">
        {columns.map(column => (
          <DroppableColumn
            key={column.id}
            column={column}
            projectId={projectId}
            onTaskUpdate={fetchTasks}
            moveTask={moveTask}
          />
        ))}
      </div>
    </DndProvider>
  );
};

export default Board;