// src/components/Viewer/PDFMapper.js
import React, { useState, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import InteractivePin from './InteractivePin';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PDFMapper = ({ plan, projectId, tasks, onTaskCreated, projectMembers }) => {
  const containerRef = useRef(null);
  const { userData } = useAuth();
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [tempPin, setTempPin] = useState(null);

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newAssignee, setNewAssignee] = useState('');

  const planTasks = tasks.filter(t => t.plan_file_id === plan.file_id);

  const handleCanvasClick = (e) => {
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
    } catch (error) { alert('Görev oluşturulamadı'); }
  };

  return (
    <div className="flex flex-col items-center w-full h-full bg-gray-500 overflow-auto relative p-4">
      <div className="sticky top-0 z-50 bg-white shadow-lg p-2 rounded-full flex gap-4 mb-4 items-center border border-gray-200">
        <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 disabled:opacity-30" disabled={pageNumber <= 1} onClick={() => setPageNumber(prev => prev - 1)}>❮</button>
        <span className="text-sm font-medium">Sayfa {pageNumber} / {numPages || '--'}</span>
        <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 disabled:opacity-30" disabled={pageNumber >= numPages} onClick={() => setPageNumber(prev => prev + 1)}>❯</button>
      </div>

      <div ref={containerRef} className="relative shadow-2xl bg-white cursor-crosshair inline-block border-8 border-white" onClick={handleCanvasClick}>
        <Document file={plan.url} onLoadSuccess={({numPages}) => setNumPages(numPages)} loading={<div className="p-10 text-center">PDF Yükleniyor...</div>} error={<div className="p-10 text-red-500">PDF Açılamadı!</div>}>
          <Page pageNumber={pageNumber} renderTextLayer={false} renderAnnotationLayer={false} width={800} />
        </Document>

        {planTasks.map(task => <InteractivePin key={task.id} task={task} onDelete={onTaskCreated} />)}

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
                 <button onClick={() => {setTempPin(null); setNewTaskTitle(''); setNewTaskDesc(''); setNewAssignee('');}} className="flex-1 bg-gray-100 text-gray-700 text-xs py-2.5 rounded-lg font-bold hover:bg-gray-200 transition-colors uppercase tracking-widest">İptal</button>
               </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PDFMapper;