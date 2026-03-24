// src/components/Kanban/TaskDetailModal.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api/axios';
import LoadingSpinner from '../UI/LoadingSpinner';
import FileUpload from './FileUpload';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-md flex items-center justify-center z-[300] animate-fade-in p-4">
      <div className="bg-white dark:bg-gray-800 rounded-[3rem] p-10 w-full max-w-sm shadow-2xl border border-gray-100 dark:border-gray-700 animate-slide-in text-center">
        <div className="text-5xl mb-6">🗑️</div>
        <h3 className="text-xl font-black text-gray-900 dark:text-white mb-3 uppercase tracking-widest">{title}</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-10 font-medium leading-relaxed italic">{message}</p>
        <div className="flex flex-col gap-3">
          <button onClick={onConfirm} className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-red-500/20 active:scale-95 transition-all">Kalıcı Olarak Sil</button>
          <button onClick={onClose} className="w-full py-4 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">Vazgeç</button>
        </div>
      </div>
    </div>
  );
};

const TaskDetailModal = ({ task, isOpen, onClose, onUpdate, canEdit: canEditProp, canDeleteProp }) => {
  const { userData } = useAuth();
  const [activeTab, setActiveTab] = useState('details');
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [assignee, setAssignee] = useState(task?.assignee_user_id || '');
  const [dueDate, setDueDate] = useState('');
  
  const [isVisibleToClient, setIsVisibleToClient] = useState(false);
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [actualCost, setActualCost] = useState(0);

  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [projectMembers, setProjectMembers] = useState([]);
  const [assignedUser, setAssignedUser] = useState(null); 
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const isObserver = userData?.role === 'observer';
  const canEdit = canEditProp && !isObserver;
  const canDeleteTask = canDeleteProp && !isObserver;
  const canAssignUser = (userData?.role === 'admin' || userData?.role === 'manager') && !isObserver;
  const canManageBudget = (userData?.role === 'admin' || userData?.role === 'manager') && !isObserver;

  useEffect(() => {
    if (task && isOpen) {
      setTitle(task.title);
      setDescription(task.description || '');
      setAssignee(task.assignee_user_id || '');
      setDueDate(task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '');
      setIsVisibleToClient(task.is_visible_to_client || false);
      setEstimatedCost(task.estimated_cost || 0);
      setActualCost(task.actual_cost || 0);

      fetchComments();
      fetchProjectMembers();
      if (task.assignee_user_id) fetchAssignedUser(task.assignee_user_id);
      else setAssignedUser(null);
    }
  }, [task, isOpen]);

  const handleDeleteTask = async () => {
    if (isObserver) return;
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
    if (daysDiff < 0) return { status: 'overdue', text: 'Süresi geçmiş', class: 'text-red-700 bg-red-100 border-red-200', icon:'🔴' };
    if (daysDiff === 0) return { status: 'today', text: 'Bugün', class: 'text-orange-700 bg-orange-100 border-orange-200', icon:'🟠' };
    if (daysDiff <= 3) return { status: 'urgent', text: 'Yaklaşıyor', class: 'text-yellow-700 bg-yellow-100 border-yellow-200', icon:'🟡' };
    return { status: 'normal', text: 'Planlanan', class: 'text-green-700 bg-green-100 border-green-200', icon:'🟢' };
  };

  const handleSave = async () => {
    if (!task || !canEdit || isObserver) return;
    setLoading(true);
    try {
      await api.put(`/tasks/${task.task_id}`, {
        title: title,
        description: description,
        assignee: assignee || null,
        dueDate: dueDate || null,
        isVisibleToClient: isVisibleToClient,
        estimatedCost: canManageBudget ? estimatedCost : undefined,
        actualCost: canManageBudget ? actualCost : undefined
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
    if (!newComment.trim() || !task || isObserver) return;
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
    <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-[3rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-in border border-gray-100 dark:border-gray-700">
        
        {/* HEADER */}
        <div className="px-10 py-8 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
          <div className="flex justify-between items-start">
            <div className="flex-1 mr-4">
              {canEdit ? (
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="GÖREV BAŞLIĞI..."
                  className="text-2xl font-black text-gray-900 dark:text-white w-full border-none focus:outline-none focus:ring-0 p-0 bg-transparent tracking-tight uppercase"
                />
              ) : (
                <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight uppercase truncate">{title}</h2>
              )}
              <div className="flex items-center gap-3 mt-4">
                <span className="text-[10px] font-black text-gray-400 bg-gray-200 dark:bg-gray-700 px-3 py-1.5 rounded-lg uppercase tracking-widest">#{task.task_id.slice(-6)}</span>
                {isVisibleToClient && (
                    <span className="text-[9px] font-black px-3 py-1.5 rounded-full bg-purple-600 text-white uppercase tracking-widest shadow-lg shadow-purple-500/20">
                        👁️ Müşteriye Açık
                    </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="w-12 h-12 flex items-center justify-center rounded-full bg-white dark:bg-gray-700 shadow-sm text-gray-400 hover:text-red-500 transition-colors">✕</button>
          </div>
        </div>

        {/* TABS */}
        <div className="px-10 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <nav className="flex space-x-10">
             {[{ id: 'details', l: 'DETAYLAR', i: '📝' }, { id: 'comments', l: 'YORUMLAR', i: '💬' }, { id: 'files', l: 'DOSYALAR', i: '📁' }].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} 
                className={`py-5 border-b-4 font-black text-[10px] tracking-[0.2em] transition-all flex items-center gap-2 ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                <span className="text-sm">{tab.i}</span> {tab.l}
              </button>
            ))}
          </nav>
        </div>

        {/* CONTENT */}
        <div className="p-10 overflow-y-auto custom-scrollbar flex-1 bg-white dark:bg-gray-800">
          {activeTab === 'details' && (
            <div className="space-y-10 animate-fade-in">
              
              {/* Müşteri Görünürlüğü */}
              {canEdit && (userData.role === 'admin' || userData.role === 'manager') && !isObserver && (
                <div className="p-6 bg-purple-50 dark:bg-purple-900/10 rounded-[1.5rem] border-2 border-purple-100 dark:border-purple-800/50 flex items-center justify-between cursor-pointer group" onClick={() => setIsVisibleToClient(!isVisibleToClient)}>
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition-all ${isVisibleToClient ? 'bg-purple-600 text-white shadow-lg' : 'bg-white dark:bg-gray-700 text-gray-400 shadow-sm'}`}>
                            {isVisibleToClient ? '👁️' : '🕶️'}
                        </div>
                        <div>
                            <span className="block text-xs font-black text-purple-900 dark:text-purple-300 uppercase tracking-widest">Müşteri Portalı</span>
                            <span className="block text-[10px] font-bold text-purple-600/60 dark:text-purple-400/60 uppercase mt-1">
                                {isVisibleToClient ? 'Bu görev müşteriye açık durumda' : 'Bu görev sadece iç ekibe görünüyor'}
                            </span>
                        </div>
                    </div>
                    <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${isVisibleToClient ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                        <div className={`bg-white w-4 h-4 rounded-full transition-transform duration-300 shadow-sm ${isVisibleToClient ? 'translate-x-6' : 'translate-x-0'}`}></div>
                    </div>
                </div>
              )}

              {/* Bütçe */}
              {(canManageBudget || isObserver) && (estimatedCost > 0 || actualCost > 0 || canManageBudget) && (
                <div className="bg-gray-900 dark:bg-gray-950 p-8 rounded-[2.5rem] text-white relative overflow-hidden shadow-xl">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mt-12"></div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] mb-6 text-gray-400 flex items-center gap-2"><span className="text-xl">💰</span> Bütçe & Hakediş</h3>
                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Tahmini Maliyet (₺)</label>
                            {canManageBudget ? (
                                <input type="number" min="0" step="0.01" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} className="w-full bg-white/5 border-2 border-white/10 rounded-2xl p-4 font-black text-lg focus:border-blue-500 outline-none transition-all" placeholder="0.00" />
                            ) : (
                                <div className="text-2xl font-black">{estimatedCost} ₺</div>
                            )}
                        </div>
                        <div>
                            <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Gerçekleşen (₺)</label>
                            {canManageBudget ? (
                                <input type="number" min="0" step="0.01" value={actualCost} onChange={(e) => setActualCost(e.target.value)} className="w-full bg-white/5 border-2 border-white/10 rounded-2xl p-4 font-black text-lg focus:border-blue-500 outline-none transition-all" placeholder="0.00" />
                            ) : (
                                <div className="text-2xl font-black">{actualCost} ₺</div>
                            )}
                        </div>
                    </div>
                    <div className="mt-6 pt-4 border-t border-white/10 flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">DURUM</span>
                        <span className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${estimatedCost - actualCost >= 0 ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}>
                            {estimatedCost - actualCost >= 0 ? "KALAN BÜTÇE: " : "BÜTÇE AŞIMI: "} 
                            {Math.abs(estimatedCost - actualCost).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                        </span>
                    </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Açıklama */}
                <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Görev Detayları</label>
                    {canEdit ? (
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows="5" placeholder="Görev açıklamasını buraya girin..." className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-medium text-sm resize-none dark:text-white" />
                    ) : (
                    <div className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border-2 border-transparent italic text-gray-600 dark:text-gray-400 text-sm leading-relaxed min-h-[120px]">
                        {description || 'Henüz bir açıklama girilmedi.'}
                    </div>
                    )}
                </div>

                {/* Bitiş Tarihi */}
                <div>
                    <div className="flex justify-between items-center mb-3 ml-1 pr-2">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Termin Tarihi</label>
                        {dateStatus && <span className={`text-[9px] font-black px-2 py-1 border-2 rounded-lg uppercase tracking-widest ${dateStatus.class}`}>{dateStatus.icon} {dateStatus.text}</span>}
                    </div>
                    {canEdit ? (
                    <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-black text-xs uppercase dark:text-white" />
                    ) : (
                    <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl font-black text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        {dueDate ? new Date(dueDate).toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' }) : 'SÜRESİZ'}
                    </div>
                    )}
                </div>

                {/* Atanan Kişi */}
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Sorumlu Kişi</label>
                    {canAssignUser ? (
                    <select value={assignee} onChange={(e) => handleAssigneeChange(e.target.value)} className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-black text-xs uppercase tracking-wider appearance-none dark:text-white">
                        <option value="">SORUMLU ATANMADI</option>
                        {projectMembers.map(member => (
                        <option key={member.user_id} value={member.user_id}>{member.name.toUpperCase()} ({member.role.toUpperCase()})</option>
                        ))}
                    </select>
                    ) : (
                    <div className="flex items-center gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border-2 border-transparent">
                        <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center text-[10px] font-black text-white">{assignedUser?.name?.[0] || '?'}</div>
                        <span className="font-black text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wider">{assignedUser ? assignedUser.name : 'ATANMAMIŞ'}</span>
                    </div>
                    )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="flex flex-col h-full space-y-8 animate-fade-in">
              <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1 min-h-[200px]">
                {comments.map(comment => (
                  <div key={comment.comment_id} className="bg-gray-50 dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 relative group">
                    <div className="flex justify-between items-center mb-3">
                        <span className="font-black text-xs text-blue-600 uppercase tracking-wider">{comment.user_info_name}</span> 
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">{new Date(comment.created_at).toLocaleString('tr-TR')}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 leading-relaxed">{comment.text}</p>
                  </div>
                ))}
                {comments.length === 0 && <div className="py-20 text-center text-gray-400 font-black text-[10px] uppercase tracking-widest">Henüz hiç yorum yapılmamış.</div>}
              </div>
              
              {!isObserver && (
                  <div className="flex gap-3 pt-6 border-t border-gray-100 dark:border-gray-700 mt-auto">
                     <input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Ekibe bir not bırak..." onKeyDown={e=>e.key==='Enter'&&handleAddComment()} className="flex-1 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl px-6 py-4 outline-none focus:border-blue-500 font-medium text-sm dark:text-white"/>
                     <button onClick={handleAddComment} disabled={!newComment.trim() || loading} className="bg-blue-600 hover:bg-blue-700 text-white px-8 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50 transition-all">GÖNDER</button>
                  </div>
              )}
            </div>
          )}
          
          {activeTab === 'files' && <div className="animate-fade-in"><FileUpload taskId={task.task_id} projectId={task.project_id} /></div>}
        </div>

        {/* FOOTER */}
        <div className="px-10 py-8 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex justify-between items-center shrink-0">
           {canDeleteTask ? (
               <button onClick={() => setShowDeleteModal(true)} className="flex items-center gap-2 text-red-500 hover:text-red-700 font-black text-[10px] uppercase tracking-widest transition-colors">
                   <span className="text-lg">🗑️</span> GÖREVİ SİL
               </button>
           ) : <div/>}
           <div className="flex gap-4">
              <button onClick={onClose} className="px-8 py-4 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-2xl border-2 border-gray-100 dark:border-gray-600 font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all">
                  {canEdit ? 'VAZGEÇ' : 'KAPAT'}
              </button>
              {canEdit && (
                  <button onClick={handleSave} disabled={loading} className="px-10 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center min-w-[200px]">
                      {loading ? <LoadingSpinner size="small" color="white"/> : 'GÜNCELLEMELERİ KAYDET'}
                  </button>
              )}
           </div>
        </div>
      </div>
      {canDeleteTask && <ConfirmModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} onConfirm={handleDeleteTask} title="Görevi Sil" message="Bu görev kalıcı olarak sistemden kaldırılacaktır." />}
    </div>
  );
};

export default TaskDetailModal;