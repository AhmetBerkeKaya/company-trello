// src/components/Viewer/ImageMapper.js
import React, { useState, useRef } from 'react';
import api from '../../api/axios';
import InteractivePin from './InteractivePin';
import { useAuth } from '../../contexts/AuthContext'; 

const ImageMapper = ({ plan, projectId, tasks, onTaskCreated, projectMembers }) => {
  const containerRef = useRef(null);
  const { userData } = useAuth(); 
  const [tempPin, setTempPin] = useState(null);
  
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newAssignee, setNewAssignee] = useState('');

  const planTasks = tasks.filter(t => t.plan_file_id === plan.file_id);

  const handleImageClick = (e) => {
    if (e.target.closest('.new-task-form') || e.target.closest('button')) return;
    if (!containerRef.current || e.target.closest('.group')) return;

    const rect = containerRef.current.getBoundingClientRect();
    setTempPin({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 });
  };

  const handleSaveTask = async (e) => {
    if (e) e.stopPropagation();
    if (!newTaskTitle.trim()) return;

    try {
      await api.post('/tasks', {
        title: newTaskTitle, description: newTaskDesc, assignee: newAssignee,
        status: 'todo', projectId: projectId, planFileId: plan.file_id, pinX: tempPin.x, pinY: tempPin.y,
        isVisibleToClient: userData?.role === 'client'
      });
      setTempPin(null); setNewTaskTitle(''); setNewTaskDesc(''); setNewAssignee('');
      if (onTaskCreated) onTaskCreated();
    } catch (error) { alert('Hata: ' + error.message); }
  };

  const handleCancel = (e) => {
    if (e) e.stopPropagation();
    setTempPin(null); setNewTaskTitle(''); setNewTaskDesc(''); setNewAssignee('');
  };

  return (
    <div className="relative w-full h-full bg-gray-200 dark:bg-gray-900 overflow-auto flex items-center justify-center cursor-crosshair">
      <div ref={containerRef} className="relative shadow-2xl inline-block" onClick={handleImageClick}>
        <img src={plan.url} alt={plan.name} className="max-w-none" style={{ maxHeight: '80vh' }} draggable={false} />

        {planTasks.map(task => <InteractivePin key={task.id} task={task} onDelete={onTaskCreated} /> )}

        {tempPin && (
          <div className="absolute transform -translate-x-1/2 -translate-y-full z-30 new-task-form" style={{ left: `${tempPin.x}%`, top: `${tempPin.y}%` }} onClick={(e) => e.stopPropagation()}>
             <div className="w-8 h-8 bg-blue-600 rounded-full border-2 border-white shadow animate-bounce flex items-center justify-center text-white font-bold">+</div>
             <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-white p-4 rounded-xl shadow-2xl w-64 z-40 border border-gray-100">
               <h3 className="font-bold text-gray-800 text-sm mb-3 text-center uppercase tracking-widest">YENİ PİN EKLE</h3>
               <input autoFocus className="w-full border-b border-gray-200 pb-2 mb-3 text-sm focus:border-blue-500 outline-none transition-colors" placeholder="Görev başlığı *" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSaveTask(e)} />
               <textarea className="w-full border border-gray-200 rounded-lg p-2 mb-3 text-xs focus:border-blue-500 outline-none resize-none h-16 transition-colors custom-scrollbar" placeholder="Görev detayı (Opsiyonel)" value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} />
               <select className="w-full border border-gray-200 rounded-lg p-2 mb-4 text-xs focus:border-blue-500 outline-none transition-colors bg-white" value={newAssignee} onChange={e => setNewAssignee(e.target.value)}>
                  <option value="">Atanacak Kişiyi Seçin...</option>
                  {projectMembers.map(m => <option key={m.user_id} value={m.user_id}>{m.name} ({m.role})</option>)}
               </select>
               <div className="flex gap-2">
                 <button onClick={handleSaveTask} className="flex-1 bg-blue-600 text-white text-xs py-2.5 rounded-lg font-bold hover:bg-blue-700 transition-colors uppercase tracking-widest">Ekle</button>
                 <button onClick={handleCancel} className="flex-1 bg-gray-100 text-gray-700 text-xs py-2.5 rounded-lg font-bold hover:bg-gray-200 transition-colors uppercase tracking-widest">İptal</button>
               </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageMapper;