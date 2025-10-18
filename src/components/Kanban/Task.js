import React, { useState, useEffect } from 'react';
import { useDrag } from 'react-dnd';
import { doc, getDoc, deleteDoc } from 'firebase/firestore'; // YENİ: deleteDoc eklendi
import { db } from '../../firebase/config';
import TaskDetailModal from './TaskDetailModal';

const ItemTypes = {
  TASK: 'task'
};

// Basit Confirm Modal Component - YENİ
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
      <div className="bg-white rounded-lg p-6 w-full max-w-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
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
const DraggableTask = ({ task, onUpdate }) => {
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false); // YENİ: Delete modal state
  const [assignedUser, setAssignedUser] = useState(null);

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
  }), [task.id, task.status]);

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

  // YENİ: Görev silme fonksiyonu
  const handleDeleteTask = async () => {
    try {
      await deleteDoc(doc(db, 'tasks', task.id));
      setShowDeleteModal(false);
      onUpdate(); // Listeyi yenile
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

  // YENİ: Sil butonuna tıklama - event propagation'ı durdur
  const handleDeleteClick = (e) => {
    e.stopPropagation(); // Modal'ın açılmasını engelle
    setShowDeleteModal(true);
  };

  return (
    <>
      {/* Drag preview */}
      {isDragging && (
        <div
          ref={dragPreview}
          className="bg-white rounded-lg shadow-lg p-3 border-2 border-blue-500 opacity-80"
          style={{
            transform: 'rotate(5deg)',
          }}
        >
          <div className="font-medium text-gray-900 text-sm mb-1">
            {task.title}
          </div>
          {assignedUser && (
            <div className="flex items-center space-x-1">
              <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs">
                {assignedUser.name?.charAt(0)}
              </div>
              <span className="text-xs text-gray-600">{assignedUser.name}</span>
            </div>
          )}
        </div>
      )}

      {/* Normal task görünümü */}
      <div
        ref={drag}
        style={{ 
          opacity: isDragging ? 0 : 1,
          cursor: 'grab'
        }}
        className={`bg-white rounded-lg shadow-sm hover:shadow-md transition-all p-3 border border-gray-200 relative group ${
          isDragging ? 'hidden' : 'block'
        }`}
        onClick={handleClick}
      >
        {/* YENİ: Sil butonu - hover'da görünecek */}
        <button
          onClick={handleDeleteClick}
          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-md z-10"
          title="Görevi sil"
        >
          ×
        </button>

        <div className="flex justify-between items-start mb-2">
          <h4 className="font-medium text-gray-900 text-sm leading-tight flex-1 pr-4">
            {task.title}
          </h4>
        </div>
        
        {task.description && (
          <p className="text-gray-600 text-xs mb-2 line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}
        
        {/* Atanan Kişi */}
        {assignedUser && (
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
              {assignedUser.name?.charAt(0) || 'U'}
            </div>
            <span className="text-xs text-gray-600 truncate">
              {assignedUser.name}
            </span>
          </div>
        )}
        
        <div className="flex justify-between items-center text-xs text-gray-400">
          <span className="truncate">
            {task.createdAt?.toDate?.().toLocaleDateString('tr-TR')}
          </span>
          <span className="flex-shrink-0">#{task.id.slice(-4)}</span>
        </div>
      </div>

      {/* Task Detail Modal */}
      <TaskDetailModal
        task={task}
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        onUpdate={onUpdate}
      />

      {/* YENİ: Silme Onay Modal'ı */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteTask}
        title="Görevi Sil"
        message={`"${task.title}" görevini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`}
      />
    </>
  );
};

export default DraggableTask;