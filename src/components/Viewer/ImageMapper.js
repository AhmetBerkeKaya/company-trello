// src/components/Viewer/ImageMapper.js
import React, { useState, useRef } from 'react';
import api from '../../api/axios';
import InteractivePin from './InteractivePin';
import { useAuth } from '../../contexts/AuthContext'; // YENİ: Auth eklendi

const ImageMapper = ({ plan, projectId, tasks, onTaskCreated }) => {
  const containerRef = useRef(null);
  const { userData } = useAuth(); // YENİ: Kullanıcı bilgisi
  
  // Sürükleme Kilidi
  const isPinDragging = useRef(false);
  
  const [tempPin, setTempPin] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Sadece bu paftaya ait görevleri filtrele
  const planTasks = tasks.filter(t => t.plan_file_id === plan.file_id);

  const handleImageClick = (e) => {
    if (isPinDragging.current) return;
    if (e.target.closest('.new-task-form') || e.target.closest('button')) return;
    if (!containerRef.current) return;
    if (e.target.closest('.group')) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setTempPin({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100
    });
  };

  const handlePinDragStart = () => { isPinDragging.current = true; };
  const handlePinDragEnd = () => { setTimeout(() => { isPinDragging.current = false; }, 200); };

  const handleSaveTask = async (e) => {
    if (e) e.stopPropagation();
    if (!newTaskTitle.trim()) return;
    
    // Müşteri ise otomatik görünür yap
    const isClient = userData?.role === 'client';

    try {
      await api.post('/tasks', {
        title: newTaskTitle,
        status: 'todo',
        projectId: projectId,
        planFileId: plan.file_id,
        pinX: tempPin.x,
        pinY: tempPin.y,
        isVisibleToClient: isClient // YENİ: Müşteriyse true, değilse varsayılan (false)
      });
      setTempPin(null);
      setNewTaskTitle('');
      if (onTaskCreated) onTaskCreated();
    } catch (error) {
      alert('Hata: ' + error.message);
    }
  };

  const handleCancel = (e) => {
    if (e) e.stopPropagation();
    setTempPin(null);
    setNewTaskTitle('');
  };

  return (
    <div className="relative w-full h-full bg-gray-200 dark:bg-gray-900 overflow-auto flex items-center justify-center cursor-crosshair">
      <div 
        ref={containerRef}
        className="relative shadow-2xl inline-block"
        onClick={handleImageClick}
      >
        <img 
          src={plan.url} 
          alt={plan.name} 
          className="max-w-none"
          style={{ maxHeight: '80vh' }}
          draggable={false}
        />

        {/* Mevcut Pinler */}
        {planTasks.map(task => (
           <InteractivePin 
             key={task.id} 
             task={task} 
             containerRef={containerRef}
             onUpdate={onTaskCreated}
             onDelete={onTaskCreated}
             onDragStart={handlePinDragStart}
             onDragEnd={handlePinDragEnd}
           />
        ))}

        {/* Geçici Pin Formu */}
        {tempPin && (
          <div 
            className="absolute transform -translate-x-1/2 -translate-y-full z-30 new-task-form" 
            style={{ left: `${tempPin.x}%`, top: `${tempPin.y}%` }}
            onClick={(e) => e.stopPropagation()} 
          >
             <div className="w-8 h-8 bg-blue-600 rounded-full border-2 border-white shadow animate-bounce flex items-center justify-center text-white">+</div>
             <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-white p-2 rounded shadow w-48 z-40">
               <input 
                 autoFocus
                 className="w-full border p-1 text-sm mb-1" 
                 placeholder="Görev adı..."
                 value={newTaskTitle}
                 onChange={e => setNewTaskTitle(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && handleSaveTask(e)}
               />
               <button onClick={handleSaveTask} className="w-full bg-blue-600 text-white text-xs py-1 rounded">Ekle</button>
               <button onClick={handleCancel} className="w-full bg-gray-200 text-gray-700 text-xs py-1 rounded mt-1">İptal</button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageMapper;