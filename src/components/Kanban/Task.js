import React, { useState, useEffect, useRef } from 'react';
import { useDrag } from 'react-dnd';
import { useLocation } from 'react-router-dom';
import api from '../../api/axios'; 
import TaskDetailModal from './TaskDetailModal';

const ItemTypes = { TASK: 'task' };

const getDateStatus = (dueDate) => {
  if (!dueDate) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0); 
  const due = new Date(dueDate); due.setHours(0, 0, 0, 0); 
  const timeDiff = due.getTime() - today.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  
  if (daysDiff < 0) return { status: 'overdue', text: 'Süresi geçmiş', class: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400', icon: '🔴' };
  if (daysDiff === 0) return { status: 'today', text: 'Bugün', class: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400', icon: '🟠' };
  if (daysDiff <= 3) return { status: 'urgent', text: 'Yaklaşıyor', class: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400', icon: '🟡' };
  return { status: 'normal', text: 'Planlanan', class: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400', icon: '🟢' };
};

const DraggableTask = ({ task, onUpdate, userRole, currentUserId }) => {
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [assignedUser, setAssignedUser] = useState(null);
  
  // YENİ: Animasyon State'leri
  const [isHighlighted, setIsHighlighted] = useState(false);
  const taskRef = useRef(null);
  const location = useLocation();

  const canEditTask = userRole === 'admin' || userRole === 'manager' || task.created_by_user_id === currentUserId;
  const canDeleteTask = userRole === 'admin' || userRole === 'manager' || task.created_by_user_id === currentUserId;
  const canDragTask = userRole === 'admin' || userRole === 'manager' || task.assignee_user_id === currentUserId;

  const dateStatus = task.due_date ? getDateStatus(task.due_date) : null;

  const [{ isDragging }, drag, dragPreview] = useDrag(() => ({
    type: ItemTypes.TASK,
    item: { id: task.id, status: task.status, type: 'task' },
    collect: (monitor) => ({ isDragging: !!monitor.isDragging() }),
    canDrag: () => canDragTask,
  }), [task.id, task.status, canDragTask]);

  // YENİ: Dashboard'dan gelen odaklanma ve parlama animasyonu
  useEffect(() => {
    const targetId = location.state?.targetTaskId;
    if (targetId && (targetId === task.id || targetId === task.task_id)) {
      setIsHighlighted(true);
      
      // Board yüklendikten az sonra görevi ekranın tam ortasına kaydır
      setTimeout(() => {
        taskRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 500);

      // 3 saniye sonra neon ışığı kapat
      const timer = setTimeout(() => setIsHighlighted(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [location.state, task.id, task.task_id]);

  useEffect(() => {
    if (task.assignee_user_id) fetchAssignedUser(task.assignee_user_id);
    else setAssignedUser(null);
  }, [task.assignee_user_id]);

  const fetchAssignedUser = async (userId) => {
    try { const response = await api.get(`/users/${userId}`); setAssignedUser(response.data); } 
    catch (error) { setAssignedUser({ name: 'Bilinmeyen Kullanıcı' }); }
  };

  const handleClick = (e) => {
    e.stopPropagation(); 
    if (!isDragging) setShowDetailModal(true);
  };

  return (
    <>
      {isDragging && (
        <div ref={dragPreview} className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl p-6 border-2 border-blue-500 opacity-60 scale-105 pointer-events-none" style={{ transform: 'rotate(4deg)' }}>
          <div className="font-black text-gray-900 dark:text-white text-sm mb-2 uppercase tracking-wide">{task.title}</div>
        </div>
      )}

      <div
        ref={(node) => {
          taskRef.current = node;
          if (canDragTask) drag(node);
        }}
        style={{ opacity: isDragging ? 0 : 1, cursor: canDragTask ? 'grab' : 'pointer' }}
        className={`bg-white dark:bg-gray-800 rounded-[2rem] p-6 relative overflow-hidden group ${
          isDragging ? 'hidden' : 'block'
        } ${
          isHighlighted 
            ? 'ring-4 ring-blue-500 shadow-[0_0_40px_rgba(59,130,246,0.6)] scale-[1.03] z-10 transition-all duration-500 border-transparent' 
            : 'shadow-sm hover:shadow-xl dark:hover:shadow-gray-900/80 transition-all duration-300 border border-gray-100 dark:border-gray-700'
        }`}
        onClick={handleClick}
      >
        <div className={`absolute top-0 left-0 w-2 h-full ${dateStatus?.status === 'overdue' ? 'bg-red-500' : 'bg-blue-500/20'}`}></div>

        <div className="flex justify-between items-start mb-4 pl-2">
          <h4 className="font-black text-gray-900 dark:text-white text-sm leading-tight flex-1 uppercase tracking-wider group-hover:text-blue-600 transition-colors">{task.title}</h4>
        </div>

        {task.description && (
          <p className="text-gray-500 dark:text-gray-400 text-[11px] mb-5 font-medium line-clamp-2 leading-relaxed pl-2">
            {task.description}
          </p>
        )}

        <div className="pl-2 space-y-3">
            {dateStatus && (
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 font-black text-[9px] uppercase tracking-widest ${dateStatus.class}`}>
                <span>{dateStatus.icon}</span>
                <span>{new Date(task.due_date).toLocaleDateString('tr-TR')}</span>
                <span className="opacity-50">•</span>
                <span>{dateStatus.text}</span>
            </div>
            )}

            {assignedUser && (
            <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/50 p-2 rounded-xl border border-gray-100 dark:border-gray-700/50 w-fit pr-4">
                <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white text-[10px] font-black shadow-sm">
                {assignedUser.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <span className="text-[10px] font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest truncate max-w-[120px]">
                {assignedUser.name}
                </span>
            </div>
            )}
        </div>

        <div className="flex justify-between items-center text-[10px] font-black text-gray-300 uppercase tracking-widest mt-5 pt-4 border-t border-gray-50 dark:border-gray-700/50 pl-2">
          <span>{new Date(task.created_at).toLocaleDateString('tr-TR', { day:'numeric', month:'short' })}</span>
          <span>#{task.task_id.slice(-4)}</span>
        </div>
      </div>

      {showDetailModal && (
        <TaskDetailModal task={task} isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} onUpdate={onUpdate} canEdit={canEditTask} canDeleteProp={canDeleteTask} />
      )}
    </>
  );
};

export default DraggableTask;