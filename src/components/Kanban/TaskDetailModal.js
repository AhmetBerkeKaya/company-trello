import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, updateDoc, collection, addDoc, getDocs, query, where, getDoc, deleteDoc } from 'firebase/firestore'; // YENİ: deleteDoc eklendiimport { db } from '../../firebase/config';
import LoadingSpinner from '../UI/LoadingSpinner';
import FileUpload from './FileUpload';

// YENİ: Confirm Modal (aynısını buraya da ekleyebiliriz veya ayrı component yapabiliriz)
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

const TaskDetailModal = ({ task, isOpen, onClose, onUpdate }) => {
  const { userData } = useAuth();
  const [activeTab, setActiveTab] = useState('details');
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [assignee, setAssignee] = useState(task?.assignee || ''); // YENİ: Atanan kişi state'i
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [projectMembers, setProjectMembers] = useState([]);
  const [assignedUser, setAssignedUser] = useState(null); // YENİ: Atanan kullanıcı detayları
  const [showDeleteModal, setShowDeleteModal] = useState(false); // YENİ: Delete modal state

  useEffect(() => {
    if (task && isOpen) {
      setTitle(task.title);
      setDescription(task.description || '');
      setAssignee(task.assignee || ''); // YENİ: Atanan kişiyi set et
      fetchComments();
      fetchProjectMembers();
      if (task.assignee) {
        fetchAssignedUser(task.assignee);
      }
    }
  }, [task, isOpen]);
  const handleDeleteTask = async () => {
    try {
      setLoading(true);
      await deleteDoc(doc(db, 'tasks', task.id));
      setShowDeleteModal(false);
      onClose(); // Modal'ı kapat
      onUpdate(); // Listeyi yenile
      console.log('✅ Görev silindi:', task.id);
    } catch (error) {
      console.error('❌ Görev silme hatası:', error);
      alert('Görev silinirken bir hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  // YENİ: Atanan kullanıcıyı getir
  const fetchAssignedUser = async (userId) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        setAssignedUser(userDoc.data());
      }
    } catch (error) {
      console.error('Atanan kullanıcıyı getirme hatası:', error);
    }
  };

  const fetchComments = async () => {
    if (!task) return;

    try {
      const commentsQuery = query(
        collection(db, 'comments'),
        where('taskId', '==', task.id),
        where('projectId', '==', task.projectId)
      );

      const commentsSnapshot = await getDocs(commentsQuery);
      const commentsData = commentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setComments(commentsData);
    } catch (error) {
      console.error('Yorumları getirme hatası:', error);
    }
  };

  const fetchProjectMembers = async () => {
    if (!task?.projectId) return;

    try {
      const projectDoc = await getDoc(doc(db, 'projects', task.projectId));
      const projectData = projectDoc.data();

      if (projectData?.members) {
        const usersQuery = query(
          collection(db, 'users'),
          where('__name__', 'in', projectData.members.slice(0, 10))
        );

        const usersSnapshot = await getDocs(usersQuery);
        const members = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setProjectMembers(members);
      }
    } catch (error) {
      console.error('Üyeleri getirme hatası:', error);
    }
  };

  const handleSave = async () => {
    if (!task) return;

    setLoading(true);
    try {
      await updateDoc(doc(db, 'tasks', task.id), {
        title,
        description,
        assignee, // YENİ: Atanan kişiyi kaydet
        updatedAt: new Date()
      });

      onUpdate();
      onClose();
    } catch (error) {
      console.error('Görev güncelleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  // YENİ: Atanan kişiyi değiştir
  const handleAssigneeChange = async (userId) => {
    setAssignee(userId);
    if (userId) {
      await fetchAssignedUser(userId);
    } else {
      setAssignedUser(null);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !task) return;

    try {
      const comment = {
        text: newComment,
        taskId: task.id,
        projectId: task.projectId,
        createdBy: userData.id,
        createdAt: new Date()
      };

      await addDoc(collection(db, 'comments'), comment);
      setNewComment('');
      fetchComments();
    } catch (error) {
      console.error('Yorum ekleme hatası:', error);
    }
  };

  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-xl font-bold text-gray-900 w-full border-none focus:outline-none focus:ring-0"
              />
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-sm text-gray-500">
                  #{task.id.slice(-6)}
                </span>
                <span className="text-sm text-gray-500">•</span>
                <span className="text-sm text-gray-500">
                  {task.createdAt?.toDate?.().toLocaleDateString('tr-TR')}
                </span>

                {/* YENİ: Atanan Kişi Badge'i */}
                {assignedUser && (
                  <>
                    <span className="text-sm text-gray-500">•</span>
                    <div className="flex items-center space-x-1 bg-blue-100 px-2 py-1 rounded-full">
                      <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs">
                        {assignedUser.name?.charAt(0) || 'U'}
                      </div>
                      <span className="text-xs text-blue-800 font-medium">
                        {assignedUser.name}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'details', label: 'Detaylar' },
              { id: 'comments', label: 'Yorumlar' },
              { id: 'files', label: 'Dosyalar' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Açıklama */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Açıklama
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="4"
                  placeholder="Görev açıklaması..."
                />
              </div>

              {/* YENİ: Geliştirilmiş Atanan Kişi Seçimi */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Atanan Kişi
                </label>
                <select
                  value={assignee}
                  onChange={(e) => handleAssigneeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Atanmadı</option>
                  {projectMembers.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.name} ({member.role}) - {member.department}
                    </option>
                  ))}
                </select>

                {/* Atanan Kişi Önizleme */}
                {assignedUser && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {assignedUser.name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{assignedUser.name}</div>
                        <div className="text-sm text-gray-600 capitalize">
                          {assignedUser.role} • {assignedUser.department}
                        </div>
                        <div className="text-sm text-gray-500">{assignedUser.email}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ... comments ve files kısımları aynı kalacak ... */}
          {activeTab === 'comments' && (
            <div className="space-y-4">
              {/* Yorum Listesi */}
              <div className="space-y-4">
                {comments.map(comment => (
                  <div key={comment.id} className="flex space-x-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                      {comment.createdBy?.charAt(0) || 'U'}
                    </div>
                    <div className="flex-1">
                      <div className="bg-gray-100 rounded-lg p-3">
                        <p className="text-sm text-gray-900">{comment.text}</p>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {comment.createdAt?.toDate?.().toLocaleString('tr-TR')}
                      </div>
                    </div>
                  </div>
                ))}

                {comments.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-4">
                    Henüz yorum yok
                  </p>
                )}
              </div>

              {/* Yeni Yorum Ekleme */}
              <div className="border-t pt-4">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Yorumunuzu yazın..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    Yorum Ekle
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'files' && (
            <div>
              {/* YENİ: FileUpload component'i */}
              <FileUpload
                taskId={task.id}
                projectId={task.projectId}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
            >
              İptal
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !title.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center space-x-2"
            >
              {loading && <LoadingSpinner size="small" />}
              <span>Kaydet</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailModal;