// src/components/Kanban/TaskDetailModal.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api/axios';
import LoadingSpinner from '../UI/LoadingSpinner';
import FileUpload from './FileUpload';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{message}</p>
        <div className="flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 font-medium">İptal</button>
          <button onClick={onConfirm} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">Sil</button>
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
  
  // YENİ: Müşteri Görünürlüğü State'i
  const [isVisibleToClient, setIsVisibleToClient] = useState(false);

  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [projectMembers, setProjectMembers] = useState([]);
  const [assignedUser, setAssignedUser] = useState(null); 
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const canDeleteTask = canDeleteProp;
  const canAssignUser = userData?.role === 'admin' || userData?.role === 'manager';

  useEffect(() => {
    if (task && isOpen) {
      setTitle(task.title);
      setDescription(task.description || '');
      setAssignee(task.assignee_user_id || '');
      setDueDate(task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '');
      
      // YENİ: State'i task verisinden doldur
      setIsVisibleToClient(task.is_visible_to_client || false);

      fetchComments();
      fetchProjectMembers();
      if (task.assignee_user_id) fetchAssignedUser(task.assignee_user_id);
      else setAssignedUser(null);
    }
  }, [task, isOpen]);

  const handleDeleteTask = async () => {
    setLoading(true);
    try {
      await api.delete(`/tasks/${task.task_id}`);
      setShowDeleteModal(false);
      onClose();
      onUpdate();
    } catch (error) {
      alert('Görev silinirken hata oluştu: ' + (error.response?.data?.message || error.message));
    } finally { setLoading(false); }
  };

  const fetchAssignedUser = async (userId) => {
    try { const response = await api.get(`/users/${userId}`); setAssignedUser(response.data); } 
    catch (error) { setAssignedUser(null); }
  };

  const fetchComments = async () => {
    if (!task) return;
    setLoading(true);
    try { const response = await api.get(`/tasks/${task.task_id}/comments`); setComments(response.data); } 
    catch (error) {} finally { setLoading(false); }
  };

  const fetchProjectMembers = async () => {
    if (!task?.project_id) return;
    try { const response = await api.get(`/projects/${task.project_id}/members`); setProjectMembers(response.data); } 
    catch (error) {}
  };

  const getDateStatus = (dueDateStr) => {
    if (!dueDateStr) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = new Date(dueDateStr); due.setHours(0, 0, 0, 0);
    const daysDiff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 3600 * 24));
    if (daysDiff < 0) return { status: 'overdue', text: 'Süresi geçmiş', class: 'text-red-600 bg-red-100' };
    if (daysDiff === 0) return { status: 'today', text: 'Bugün', class: 'text-orange-600 bg-orange-100' };
    if (daysDiff <= 3) return { status: 'urgent', text: 'Yaklaşıyor', class: 'text-yellow-600 bg-yellow-100' };
    return { status: 'normal', text: 'Planlanan', class: 'text-green-600 bg-green-100' };
  };

  const handleSave = async () => {
    if (!task || !canEdit) return;
    setLoading(true);
    try {
      await api.put(`/tasks/${task.task_id}`, {
        title: title,
        description: description,
        assignee: assignee || null,
        dueDate: dueDate || null,
        isVisibleToClient: isVisibleToClient // YENİ: Backend'e gönder
      });
      onUpdate();
      onClose();
    } catch (error) {
      alert('Görev güncellenemedi: ' + (error.response?.data?.message || error.message));
    } finally { setLoading(false); }
  };

  const handleAssigneeChange = async (userId) => {
    if (!canAssignUser) { alert('Kullanıcı atama yetkiniz yok!'); return; }
    setAssignee(userId);
    if (userId) await fetchAssignedUser(userId); else setAssignedUser(null);
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !task) return;
    try {
      setLoading(true);
      await api.post(`/tasks/${task.task_id}/comments`, { text: newComment, projectId: task.project_id });
      setNewComment('');
      await fetchComments();
    } catch (error) { alert('Yorum eklenirken hata oluştu: ' + error.message); } 
    finally { setLoading(false); }
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
                <span className="text-sm text-gray-500 dark:text-gray-400">#{task.task_id.slice(-6)}</span>
                
                {/* YENİ: Müşteri Görünürlüğü Badge (Header'da da gösterelim) */}
                {isVisibleToClient && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-700 flex items-center gap-1">
                        👁️ Müşteriye Açık
                    </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300 text-2xl font-bold">×</button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6">
             {[{ id: 'details', label: 'Detaylar' }, { id: 'comments', label: 'Yorumlar' }, { id: 'files', label: 'Dosyalar' }].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`py-3 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab.label}</button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'details' && (
            <div className="space-y-6">
              
              {/* YENİ: Görünürlük Ayarı (Sadece Edit Modunda ve Yetkili Kişiler İçin) */}
              {canEdit && (userData.role === 'admin' || userData.role === 'manager') && (
                <div className="p-4 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-100 dark:border-purple-800">
                    <label className="flex items-center space-x-3 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={isVisibleToClient} 
                            onChange={(e) => setIsVisibleToClient(e.target.checked)}
                            className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                        />
                        <div>
                            <span className="block text-sm font-medium text-purple-900 dark:text-purple-300">Bu görevi müşteriye göster</span>
                            <span className="block text-xs text-purple-600 dark:text-purple-400">İşaretlenirse müşteri portalında bu görev görünür olacaktır.</span>
                        </div>
                    </label>
                </div>
              )}

              {/* Açıklama */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Açıklama</label>
                {canEdit ? (
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" rows="4" placeholder="Görev açıklaması..." />
                ) : (
                  <div className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 min-h-[100px]">
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{description || 'Açıklama yok'}</p>
                  </div>
                )}
              </div>

              {/* Bitiş Tarihi */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bitiş Tarihi</label>
                  {dateStatus && <span className={`text-xs px-2 py-1 rounded ${dateStatus.class}`}>{dateStatus.text}</span>}
                </div>
                {canEdit ? (
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" min={new Date().toISOString().split('T')[0]} />
                ) : (
                  <div className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <span className="text-gray-700 dark:text-gray-300">{dueDate ? new Date(dueDate).toLocaleDateString('tr-TR') : 'Belirlenmemiş'}</span>
                  </div>
                )}
              </div>

              {/* Atanan Kişi */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Atanan Kişi</label>
                {canAssignUser ? (
                  <select value={assignee} onChange={(e) => handleAssigneeChange(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                    <option value="">Atanmadı</option>
                    {projectMembers.map(member => (
                      <option key={member.user_id} value={member.user_id}>{member.name} ({member.role})</option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    {assignedUser ? assignedUser.name : 'Atanmamış'}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="space-y-4">
              <div className="space-y-4 max-h-80 overflow-y-auto">
                {comments.map(comment => (
                  <div key={comment.comment_id} className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                    <div className="flex justify-between"><span className="font-bold text-sm">{comment.user_info_name}</span> <span className="text-xs opacity-70">{new Date(comment.created_at).toLocaleString()}</span></div>
                    <p className="text-sm mt-1">{comment.text}</p>
                  </div>
                ))}
                {comments.length === 0 && <p className="text-center text-gray-500 text-sm">Henüz yorum yok</p>}
              </div>
              <div className="flex space-x-2">
                 <input value={newComment} onChange={e => setNewComment(e.target.value)} className="flex-1 border p-2 rounded dark:bg-gray-700 dark:text-white" placeholder="Yorum yaz..." />
                 <button onClick={handleAddComment} disabled={!newComment.trim() || loading} className="bg-blue-600 text-white px-4 rounded hover:bg-blue-700 disabled:opacity-50">Gönder</button>
              </div>
            </div>
          )}
          
          {activeTab === 'files' && <FileUpload taskId={task.task_id} projectId={task.project_id} />}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-between">
           {canDeleteTask && <button onClick={() => setShowDeleteModal(true)} className="text-red-600 hover:text-red-800 font-medium">🗑️ Sil</button>}
           <div className="flex space-x-3 ml-auto">
              <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium">{canEdit ? 'İptal' : 'Kapat'}</button>
              {canEdit && <button onClick={handleSave} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">{loading ? '...' : 'Kaydet'}</button>}
           </div>
        </div>
      </div>
      {canDeleteTask && <ConfirmModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} onConfirm={handleDeleteTask} title="Görevi Sil" message="Bu işlem geri alınamaz." />}
    </div>
  );
};

export default TaskDetailModal;