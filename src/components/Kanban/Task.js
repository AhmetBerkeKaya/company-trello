import React, { useState, useEffect } from 'react';
import { useDrag } from 'react-dnd';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import TaskDetailModal from './TaskDetailModal';

const ItemTypes = {
  TASK: 'task'
};

// Basit Confirm Modal Component
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{message}</p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 font-medium"
          >
            İptal
          </button>
          <button
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Sil
          </button>
        </div>
      </div>
    </div>
  );
};

// Draggable Task Component
const DraggableTask = ({ task, onUpdate, userRole, currentUserId }) => { // YENİ: userRole ve currentUserId prop'ları eklendi
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [assignedUser, setAssignedUser] = useState(null);

  // YENİ: Kullanıcı yetkisi kontrolleri
  const canEditTask = userRole === 'admin' || userRole === 'manager' || task.createdBy === currentUserId;
  const canDeleteTask = userRole === 'admin' || userRole === 'manager' || task.createdBy === currentUserId;
  const canDragTask = userRole === 'admin' || userRole === 'manager' || task.assignee === currentUserId;

  // Drag configuration
  const [{ isDragging }, drag, dragPreview] = useDrag(() => ({
    type: ItemTypes.TASK,
    item: {
      id: task.id,
      status: task.status,
      type: 'task'
    },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
    canDrag: () => canDragTask, // YENİ: Sürükleme yetkisi kontrolü
  }), [task.id, task.status, canDragTask]);

  // Fetch assigned user
  useEffect(() => {
    if (task.assignee) {
      fetchAssignedUser();
    }
  }, [task.assignee]);

  const fetchAssignedUser = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', task.assignee));
      if (userDoc.exists()) {
        setAssignedUser(userDoc.data());
      }
    } catch (error) {
      console.error('Atanan kullanıcıyı getirme hatası:', error);
    }
  };

  // Görev silme fonksiyonu
  const handleDeleteTask = async () => {
    try {
      await deleteDoc(doc(db, 'tasks', task.id));
      setShowDeleteModal(false);
      onUpdate();
      console.log('✅ Görev silindi:', task.id);
    } catch (error) {
      console.error('❌ Görev silme hatası:', error);
      alert('Görev silinirken bir hata oluştu: ' + error.message);
    }
  };

  // Handle click
  const handleClick = (e) => {
    if (isDragging) {
      return;
    }
    setShowDetailModal(true);
  };

  // Sil butonuna tıklama - event propagation'ı durdur
  const handleDeleteClick = (e) => {
    e.stopPropagation();
    setShowDeleteModal(true);
  };

  return (
    <>
      {/* Drag preview */}
      {isDragging && (
        <div
          ref={dragPreview}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 border-2 border-blue-500 opacity-80"
          style={{
            transform: 'rotate(5deg)',
          }}
        >
          <div className="font-medium text-gray-900 dark:text-white text-sm mb-1">
            {task.title}
          </div>
          {assignedUser && (
            <div className="flex items-center space-x-1">
              <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs">
                {assignedUser.name?.charAt(0)}
              </div>
              <span className="text-xs text-gray-600 dark:text-gray-400">{assignedUser.name}</span>
            </div>
          )}
        </div>
      )}

      {/* Normal task görünümü */}
      <div
        ref={canDragTask ? drag : null} // DÜZELTİLDİ: drag referansını doğru kullan
        style={{
          opacity: isDragging ? 0 : 1,
          cursor: canDragTask ? 'grab' : 'pointer'
        }}
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md dark:hover:shadow-gray-900/70 transition-all p-3 border border-gray-200 dark:border-gray-700 relative group ${isDragging ? 'hidden' : 'block'
          }`}
        onClick={handleClick}
      >
        {/* Sil butonu - YENİ: Sadece yetkili kullanıcılar görebilir */}
        {canDeleteTask && (
          <button
            onClick={handleDeleteClick}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-md z-10"
            title="Görevi sil"
          >
            ×
          </button>
        )}

        <div className="flex justify-between items-start mb-2">
          <h4 className="font-medium text-gray-900 dark:text-white text-sm leading-tight flex-1 pr-4">
            {task.title}
          </h4>
        </div>

        {task.description && (
          <p className="text-gray-600 dark:text-gray-400 text-xs mb-2 line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Atanan Kişi - Daha Belirgin */}
        {assignedUser && (
          <div className="flex items-center space-x-2 mb-2 p-1 bg-blue-50 dark:bg-blue-900/20 rounded">
            <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
              {assignedUser.name?.charAt(0) || 'U'}
            </div>
            <span className="text-xs text-blue-700 dark:text-blue-300 font-medium truncate">
              {assignedUser.name}
            </span>
          </div>
        )}

        <div className="flex justify-between items-center text-xs text-gray-400 dark:text-gray-500">
          <span className="truncate">
            {task.createdAt?.toDate?.().toLocaleDateString('tr-TR')}
          </span>
          <span className="flex-shrink-0">#{task.id.slice(-4)}</span>
        </div>
      </div>

      {/* Task Detail Modal - YENİ: Düzenleme yetkisi prop'u eklendi */}
      <TaskDetailModal
        task={task}
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        onUpdate={onUpdate}
        canEdit={canEditTask} // YENİ: Düzenleme yetkisi
      />

      {/* Silme Onay Modal'ı - YENİ: Sadece yetkili kullanıcılar için */}
      {canDeleteTask && (
        <ConfirmModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteTask}
          title="Görevi Sil"
          message={`"${task.title}" görevini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`}
        />
      )}
    </>
  );
};

export default DraggableTask;