// src/components/Kanban/TaskDetailModal.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api/axios';
import LoadingSpinner from '../UI/LoadingSpinner';
import FileUpload from './FileUpload';

// Confirm Modal (Firebase'den bağımsız)
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{message}</p>
        <div className="flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 font-medium">
            İptal
          </button>
          <button onClick={onConfirm} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
            Sil
          </button>
        </div>
      </div>
    </div>
  );
};

const TaskDetailModal = ({ task, isOpen, onClose, onUpdate, canEdit, canDeleteProp }) => {
  const { userData } = useAuth();
  const [activeTab, setActiveTab] = useState('details');
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [assignee, setAssignee] = useState(task?.assignee_user_id || '');
  const [dueDate, setDueDate] = useState('');
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [projectMembers, setProjectMembers] = useState([]);
  const [assignedUser, setAssignedUser] = useState(null); // 'Atanan Kişi' objesini tutar
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Yetkiler
  const canDeleteTask = canDeleteProp;
  const canAssignUser = userData?.role === 'admin' || userData?.role === 'manager';

  useEffect(() => {
    if (task && isOpen) {
      // State'i en güncel 'task' prop'u ile doldur
      setTitle(task.title);
      setDescription(task.description || '');
      setAssignee(task.assignee_user_id || '');
      setDueDate(task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '');
      
      // API'den taze veri çek
      fetchComments();
      fetchProjectMembers();
      if (task.assignee_user_id) {
        fetchAssignedUser(task.assignee_user_id);
      } else {
        setAssignedUser(null);
      }
    }
  }, [task, isOpen]);

  // YENİ: Görev Silme (API'ye bağlandı)
  const handleDeleteTask = async () => {
    setLoading(true);
    try {
      await api.delete(`/tasks/${task.task_id}`);
      setShowDeleteModal(false);
      onClose();
      onUpdate();
      console.log('✅ Görev silindi:', task.task_id);
    } catch (error) {
      console.error('❌ Görev silme hatası:', error);
      alert('Görev silinirken hata oluştu: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // YENİ: Atanan kullanıcıyı getir (API'den)
  const fetchAssignedUser = async (userId) => {
    try {
      const response = await api.get(`/users/${userId}`); 
      setAssignedUser(response.data);
    } catch (error) {
      console.error('Atanan kullanıcıyı getirme hatası:', error);
      setAssignedUser(null); // Hata olursa boş kalsın
    }
  };

  // YENİ: Yorumları getir (API'den)
  const fetchComments = async () => {
    if (!task) return;
    setLoading(true);
    try {
      const response = await api.get(`/tasks/${task.task_id}/comments`);
      setComments(response.data);
    } catch (error) {
      console.error('Yorumları getirme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  // YENİ: Proje üyelerini getir (API'den)
  const fetchProjectMembers = async () => {
    if (!task?.project_id) return;
    try {
      const response = await api.get(`/projects/${task.project_id}/members`);
      setProjectMembers(response.data);
    } catch (error) {
      console.error('Üyeleri getirme hatası:', error);
    }
  };

  // Tarih durumunu kontrol eden fonksiyon
  const getDateStatus = (dueDateStr) => {
    if (!dueDateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDateStr); // HTML input'tan 'yyyy-MM-dd' string'i gelir
    due.setHours(0, 0, 0, 0); // Saat farkı olmaması için
    
    const timeDiff = due.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    if (daysDiff < 0) return { status: 'overdue', text: 'Süresi geçmiş', class: 'text-red-600 bg-red-100' };
    if (daysDiff === 0) return { status: 'today', text: 'Bugün', class: 'text-orange-600 bg-orange-100' };
    if (daysDiff <= 3) return { status: 'urgent', text: 'Yaklaşıyor', class: 'text-yellow-600 bg-yellow-100' };
    return { status: 'normal', text: 'Planlanan', class: 'text-green-600 bg-green-100' };
  };

  // YENİ: Değişiklikleri Kaydet (API'ye bağlandı)
  const handleSave = async () => {
    if (!task || !canEdit) return;
    setLoading(true);
    try {
      await api.put(`/tasks/${task.task_id}`, {
        title: title,
        description: description,
        assignee: assignee || null,
        dueDate: dueDate || null
      });
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Görev güncelleme hatası:', error);
      alert('Görev güncellenemedi: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Atanan kişiyi değiştir (State'i günceller)
  const handleAssigneeChange = async (userId) => {
    if (!canAssignUser) {
      alert('Kullanıcı atama yetkiniz yok!');
      return;
    }
    setAssignee(userId);
    if (userId) {
      await fetchAssignedUser(userId);
    } else {
      setAssignedUser(null);
    }
  };

  // YENİ: Yorum Ekle (API'ye bağlandı)
  const handleAddComment = async () => {
    if (!newComment.trim() || !task) return;
    try {
      setLoading(true);
      await api.post(`/tasks/${task.task_id}/comments`, {
        text: newComment,
        projectId: task.project_id
      });
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

  const dateStatus = getDateStatus(dueDate);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              {canEdit ? (
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-xl font-bold text-gray-900 dark:text-white w-full border-none focus:outline-none focus:ring-0 p-0 bg-transparent"
                  placeholder="Görev başlığı..."
                />
              ) : (
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
              )}
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  #{task.task_id.slice(-6)}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">•</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(task.created_at).toLocaleDateString('tr-TR')}
                </span>

                {dueDate && dateStatus && (
                  <>
                    <span className="text-sm text-gray-500 dark:text-gray-400">•</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${dateStatus.class}`}>
                      📅 {new Date(dueDate).toLocaleDateString('tr-TR')} • {dateStatus.text}
                    </span>
                  </>
                )}

                {assignedUser && (
                  <>
                    <span className="text-sm text-gray-500 dark:text-gray-400">•</span>
                    <div className="flex items-center space-x-1 bg-blue-100 dark:bg-blue-900/20 px-2 py-1 rounded-full">
                      <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs">
                        {assignedUser.name?.charAt(0) || 'U'}
                      </div>
                      <span className="text-xs text-blue-800 dark:text-blue-300 font-medium">
                        {assignedUser.name}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300 text-2xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700">
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
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Açıklama
                </label>
                {canEdit ? (
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    rows="4"
                    placeholder="Görev açıklaması..."
                  />
                ) : (
                  <div className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 min-h-[100px]">
                    {description ? (
                      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{description}</p>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 italic">Açıklama yok</p>
                    )}
                  </div>
                )}
              </div>

              {/* Bitiş Tarihi */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Bitiş Tarihi
                  </label>
                  {dateStatus && (
                    <span className={`text-xs px-2 py-1 rounded ${dateStatus.class}`}>
                      {dateStatus.text}
                    </span>
                  )}
                </div>
                {canEdit ? (
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    min={new Date().toISOString().split('T')[0]}
                  />
                ) : (
                  <div className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    {dueDate ? (
                      <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-300">
                        <span>📅</span>
                        <span>{new Date(dueDate).toLocaleDateString('tr-TR')}</span>
                        {dateStatus && (
                          <span className={`text-xs px-2 py-1 rounded ml-2 ${dateStatus.class}`}>
                            {dateStatus.text}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">Belirlenmemiş</span>
                    )}
                  </div>
                )}
              </div>

              {/* Atanan Kişi Seçimi (DÜZELTME: 'else' bloğu dolduruldu) */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Atanan Kişi
                  </label>
                  {canAssignUser ? (
                    <span className="text-xs text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-300 px-2 py-1 rounded">
                      Değiştirebilirsiniz
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-400 px-2 py-1 rounded">
                      Sadece görüntüleme
                    </span>
                  )}
                </div>

                {canAssignUser ? (
                  <>
                    <select
                      value={assignee}
                      onChange={(e) => handleAssigneeChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Atanmadı</option>
                      {projectMembers.map(member => (
                        <option key={member.user_id} value={member.user_id}>
                          {member.name} ({member.role})
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  // DÜZELTME: Bu blok, 'user' rolü için 'assignedUser' state'ini gösterir
                  <div className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    {assignedUser ? (
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                          {assignedUser.name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{assignedUser.name}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                            {assignedUser.role} {assignedUser.department && `• ${assignedUser.department}`}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">Atanmamış</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Yorumlar Sekmesi */}
          {activeTab === 'comments' && (
            <div className="space-y-4">
              <div className="space-y-4 max-h-80 overflow-y-auto">
                {comments.map(comment => (
                  <div key={comment.comment_id} className="flex space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                        {comment.user_info_name?.charAt(0) || 'U'}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-sm text-gray-900 dark:text-white">
                            {comment.user_info_name || 'Kullanıcı'}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(comment.created_at).toLocaleString('tr-TR')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{comment.text}</p>
                      </div>
                      {comment.user_info_role && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 capitalize">
                          {comment.user_info_role}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {comments.length === 0 && !loading && (
                  <div className="text-center py-8">
                     <div className="text-4xl mb-2">💬</div>
                     <p className="text-gray-500 dark:text-gray-400 text-sm">Henüz yorum yok</p>
                  </div>
                )}
              </div>
              
              {/* Yeni Yorum Ekleme */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                      {userData.name?.charAt(0) || 'U'}
                    </div>
                  </div>
                  <div className="flex-1">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Yorumunuzu yazın..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      rows="3"
                      disabled={loading}
                    />
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {userData.name} ({userData.role}) olarak yorum yapıyorsunuz
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

          {/* Dosyalar Sekmesi */}
          {activeTab === 'files' && (
            <div>
              <FileUpload
                taskId={task.task_id}
                projectId={task.project_id}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex justify-between items-center">
            {canDeleteTask && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-medium flex items-center space-x-2 disabled:opacity-50"
                disabled={loading}
              >
                <span>🗑️</span>
                <span>Görevi Sil</span>
              </button>
            )}
            
            <div className="flex space-x-3 ml-auto">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 font-medium"
              >
                {canEdit ? 'İptal' : 'Kapat'}
              </button>
              
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

      {/* Silme Onay Modal'ı */}
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