import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, updateDoc, collection, addDoc, getDocs, query, where, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import LoadingSpinner from '../UI/LoadingSpinner';
import FileUpload from './FileUpload';
import { notifyTaskAssignment, notifyTaskUpdate } from '../../utils/notificationHelper';

// Confirm Modal
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

const TaskDetailModal = ({ task, isOpen, onClose, onUpdate, canEdit }) => { // YENİ: canEdit prop'u eklendi
  const { userData } = useAuth();
  const [activeTab, setActiveTab] = useState('details');
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [assignee, setAssignee] = useState(task?.assignee || '');
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [projectMembers, setProjectMembers] = useState([]);
  const [assignedUser, setAssignedUser] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // YENİ: Kullanıcı yetkisi kontrolleri
  const canDeleteTask = userData?.role === 'admin' || userData?.role === 'manager';
  const canAssignUser = userData?.role === 'admin' || userData?.role === 'manager';

  useEffect(() => {
    if (task && isOpen) {
      setTitle(task.title);
      setDescription(task.description || '');
      setAssignee(task.assignee || '');
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
      onClose();
      onUpdate();
      console.log('✅ Görev silindi:', task.id);
    } catch (error) {
      console.error('❌ Görev silme hatası:', error);
      alert('Görev silinirken bir hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Atanan kullanıcıyı getir
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
      setLoading(true);
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

      // İstemci tarafında sırala (Firestore index gerektirmemek için)
      commentsData.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateA - dateB; // Eskiden yeniye
      });

      setComments(commentsData);
    } catch (error) {
      console.error('Yorumları getirme hatası:', error);
    } finally {
      setLoading(false);
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

  // handleSave fonksiyonunu şu şekilde güncelleyin:
  const handleSave = async () => {
    if (!task || !canEdit) return; // YENİ: canEdit kontrolü

    setLoading(true);
    try {
      await updateDoc(doc(db, 'tasks', task.id), {
        title,
        description,
        assignee,
        updatedAt: new Date()
      });

      // PROJE BİLGİSİNİ AL
      let projectTitle = 'Proje';
      if (task.projectId) {
        try {
          const projectDoc = await getDoc(doc(db, 'projects', task.projectId));
          if (projectDoc.exists()) {
            projectTitle = projectDoc.data().title || 'Proje';
          }
        } catch (error) {
          console.error('Proje bilgisi alınamadı:', error);
        }
      }

      // BİLDİRİM GÖNDER
      if (assignee !== task.assignee) {
        // YENİ ATAMA - notifyTaskAssignment
        if (assignee) {
          await notifyTaskAssignment(
            {
              ...task,
              title,
              assignee,
              projectTitle,
              id: task.id
            },
            assignee,
            { id: userData.id, name: userData.name }
          );
        }
      } else if (title !== task.title || description !== task.description) {
        // GÖREV GÜNCELLEME - notifyTaskUpdate
        await notifyTaskUpdate(
          {
            ...task,
            title,
            description,
            assignee,
            projectTitle,
            id: task.id
          },
          { id: userData.id, name: userData.name }
        );
      }

      onUpdate();
      onClose();
    } catch (error) {
      console.error('Görev güncelleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  // Atanan kişiyi değiştir
  const handleAssigneeChange = async (userId) => {
    // YENİ: canAssignUser kontrolü
    if (!canAssignUser) {
      alert('Kullanıcı atama yetkiniz yok! Sadece admin ve proje yöneticileri kullanıcı atayabilir.');
      return;
    }

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
      setLoading(true);

      const comment = {
        text: newComment,
        taskId: task.id,
        projectId: task.projectId,
        createdBy: userData.id,
        createdAt: new Date(),
        userInfo: {
          name: userData.name,
          role: userData.role
        }
      };

      await addDoc(collection(db, 'comments'), comment);
      setNewComment('');
      await fetchComments();
    } catch (error) {
      console.error('Yorum ekleme hatası:', error);
      alert('Yorum eklenirken hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
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
              {/* YENİ: canEdit kontrolü - Sadece yetkililer input'u kullanabilir */}
              {canEdit ? (
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-xl font-bold text-gray-900 w-full border-none focus:outline-none focus:ring-0"
                  placeholder="Görev başlığı..."
                />
              ) : (
                <h2 className="text-xl font-bold text-gray-900">{title}</h2>
              )}
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-sm text-gray-500">
                  #{task.id.slice(-6)}
                </span>
                <span className="text-sm text-gray-500">•</span>
                <span className="text-sm text-gray-500">
                  {task.createdAt?.toDate?.().toLocaleDateString('tr-TR')}
                </span>

                {/* Atanan Kişi Badge'i */}
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
                {/* YENİ: canEdit kontrolü - Sadece yetkililer textarea'yı kullanabilir */}
                {canEdit ? (
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="4"
                    placeholder="Görev açıklaması..."
                  />
                ) : (
                  <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 min-h-[100px]">
                    {description ? (
                      <p className="text-gray-700 whitespace-pre-wrap">{description}</p>
                    ) : (
                      <p className="text-gray-500 italic">Açıklama yok</p>
                    )}
                  </div>
                )}
              </div>

              {/* Geliştirilmiş Atanan Kişi Seçimi */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Atanan Kişi
                  </label>
                  {canAssignUser ? (
                    <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                      Değiştirebilirsiniz
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      Sadece görüntüleme
                    </span>
                  )}
                </div>

                {canAssignUser ? (
                  <>
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
                  </>
                ) : (
                  /* Sadece okuma modu - normal kullanıcılar için */
                  <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                    {assignedUser ? (
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                          {assignedUser.name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{assignedUser.name}</div>
                          <div className="text-sm text-gray-600">
                            {assignedUser.role} • {assignedUser.department}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-500">Atanmamış</span>
                    )}
                  </div>
                )}

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

          {activeTab === 'comments' && (
            <div className="space-y-4">
              {/* Yorum Listesi */}
              <div className="space-y-4 max-h-80 overflow-y-auto">
                {comments.map(comment => (
                  <div key={comment.id} className="flex space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                        {comment.userInfo?.name?.charAt(0) || comment.createdBy?.charAt(0) || 'U'}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="bg-gray-100 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-sm text-gray-900">
                            {comment.userInfo?.name || 'Kullanıcı'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {comment.createdAt?.toDate?.().toLocaleString('tr-TR')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.text}</p>
                      </div>
                      {comment.userInfo?.role && (
                        <div className="text-xs text-gray-500 mt-1">
                          {comment.userInfo.role === 'admin' ? 'Admin' :
                            comment.userInfo.role === 'manager' ? 'Proje Yöneticisi' : 'Kullanıcı'}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {comments.length === 0 && (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-2">💬</div>
                    <p className="text-gray-500 text-sm">
                      Henüz yorum yok
                    </p>
                    <p className="text-gray-400 text-xs mt-1">
                      İlk yorumu siz yapın!
                    </p>
                  </div>
                )}
              </div>

              {/* Yeni Yorum Ekleme */}
              <div className="border-t pt-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                      {userData.name?.charAt(0) || userData.id?.charAt(0) || 'U'}
                    </div>
                  </div>
                  <div className="flex-1">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Yorumunuzu yazın..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      rows="3"
                      disabled={loading}
                    />
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-gray-500">
                        {userData.name} ({userData.role === 'admin' ? 'Admin' : userData.role === 'manager' ? 'Proje Yöneticisi' : 'Kullanıcı'}) olarak yorum yapıyorsunuz
                      </span>
                      <button
                        onClick={handleAddComment}
                        disabled={!newComment.trim() || loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                      >
                        {loading && <LoadingSpinner size="small" />}
                        <span>Yorum Ekle</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'files' && (
            <div>
              <FileUpload
                taskId={task.id}
                projectId={task.projectId}
              />
            </div>
          )}
        </div>

        {/* Footer - YENİ: canEdit kontrolü */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            {/* YENİ: Sil butonu sadece yetkililer için */}
            {canDeleteTask && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 text-red-600 hover:text-red-800 font-medium flex items-center space-x-2"
              >
                <span>🗑️</span>
                <span>Görevi Sil</span>
              </button>
            )}
            
            <div className="flex space-x-3 ml-auto">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
              >
                {canEdit ? 'İptal' : 'Kapat'}
              </button>
              
              {/* YENİ: Kaydet butonu sadece yetkililer için */}
              {canEdit && (
                <button
                  onClick={handleSave}
                  disabled={loading || !title.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  {loading && <LoadingSpinner size="small" />}
                  <span>Kaydet</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Silme Onay Modal'ı - YENİ: Sadece yetkililer için */}
      {canDeleteTask && (
        <ConfirmModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteTask}
          title="Görevi Sil"
          message={`"${task.title}" görevini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`}
        />
      )}
    </div>
  );
};

export default TaskDetailModal;