// src/components/Viewer/PDFMapper.js
import React, { useState, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import InteractivePin from './InteractivePin';
import api from '../../api/axios';

// Worker ayarı (Sizin dosyanızdaki ayar korundu)
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PDFMapper = ({ plan, projectId, tasks, onTaskCreated, onTaskUpdate }) => {
  const containerRef = useRef(null);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [tempPin, setTempPin] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const planTasks = tasks.filter(t => t.plan_file_id === plan.file_id);

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
  }

  const handleCanvasClick = (e) => {
    // 1. KONTROL (YENİ): Eğer tıklanan yer yeni görev formu veya bir buton ise işlem yapma
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

  const handleSaveTask = async (e) => {
    // Tıklamanın arkaya geçmesini engelle
    if (e) e.stopPropagation();

    if (!newTaskTitle.trim()) return;
    try {
      await api.post('/tasks', {
        title: newTaskTitle,
        status: 'todo',
        projectId: projectId,
        planFileId: plan.file_id,
        pinX: tempPin.x,
        pinY: tempPin.y
      });
      setTempPin(null);
      setNewTaskTitle('');
      if (onTaskCreated) onTaskCreated();
    } catch (error) {
      alert('Görev oluşturulamadı');
    }
  };

  const handleCancel = (e) => {
    // KRİTİK: Tıklamanın arkaya (PDF'e) geçmesini engelle
    if (e) e.stopPropagation();
    setTempPin(null);
    setNewTaskTitle('');
  };

  return (
    <div className="flex flex-col items-center w-full h-full bg-gray-500 overflow-auto relative p-4">
      
      {/* Sayfa Kontrolleri */}
      <div className="sticky top-0 z-50 bg-white shadow-lg p-2 rounded-full flex gap-4 mb-4 items-center border border-gray-200">
        <button 
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 disabled:opacity-30"
          disabled={pageNumber <= 1} 
          onClick={() => setPageNumber(prev => prev - 1)}
        >❮</button>
        <span className="text-sm font-medium">Sayfa {pageNumber} / {numPages || '--'}</span>
        <button 
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 disabled:opacity-30"
          disabled={pageNumber >= numPages} 
          onClick={() => setPageNumber(prev => prev + 1)}
        >❯</button>
      </div>

      {/* PDF Alanı */}
      <div 
        ref={containerRef} 
        className="relative shadow-2xl bg-white cursor-crosshair inline-block border-8 border-white"
        onClick={handleCanvasClick}
      >
        <Document 
          file={plan.url} 
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<div className="p-10 text-center">PDF Yükleniyor...</div>}
          error={<div className="p-10 text-red-500">PDF Açılamadı! Dosya bozuk olabilir.</div>}
        >
          <Page 
            pageNumber={pageNumber} 
            renderTextLayer={false} 
            renderAnnotationLayer={false}
            width={800} 
          />
        </Document>

        {/* Mevcut Pinler */}
        {planTasks.map(task => (
           <InteractivePin 
             key={task.id} 
             task={task} 
             containerRef={containerRef}
             onUpdate={onTaskUpdate} 
             onDelete={onTaskCreated} 
           />
        ))}

        {/* Geçici Pin Formu */}
        {tempPin && (
          <div 
            className="absolute transform -translate-x-1/2 -translate-y-full z-30 new-task-form" // 'new-task-form' sınıfı eklendi
            style={{ left: `${tempPin.x}%`, top: `${tempPin.y}%` }}
            onClick={(e) => e.stopPropagation()} // Modalın kendisine tıklayınca arkaya geçmesin
          >
             <div className="w-8 h-8 bg-blue-600 rounded-full border-2 border-white shadow animate-bounce flex items-center justify-center text-white font-bold">+</div>
             <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-white p-3 rounded-lg shadow-xl w-56 z-40 border border-gray-200">
               <input 
                 autoFocus
                 className="w-full border p-2 text-sm mb-2 rounded" 
                 placeholder="Görev adı giriniz..."
                 value={newTaskTitle}
                 onChange={e => setNewTaskTitle(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && handleSaveTask(e)}
               />
               <div className="flex gap-2">
                 <button onClick={handleSaveTask} className="flex-1 bg-blue-600 text-white text-xs py-2 rounded hover:bg-blue-700">Kaydet</button>
                 <button onClick={handleCancel} className="flex-1 bg-gray-100 text-gray-700 text-xs py-2 rounded hover:bg-gray-200">İptal</button>
               </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PDFMapper;