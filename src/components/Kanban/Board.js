// src/components/Kanban/Board.js
import React, { useState, useEffect, useRef } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Column from './Column';
import api from '../../api/axios';

const ItemTypes = {
  TASK: 'task',
  COLUMN: 'column' // YENİ TİP
};

// Sürüklenebilir Sütun Bileşeni (Hem Drag Source Hem Drop Target)
const DraggableColumn = ({ column, index, moveColumn, projectId, onTaskUpdate, moveTask, userRole, currentUserId }) => {
  const ref = useRef(null);

  // 1. Sütun Sürükleme Mantığı (Drop Target - Sütunların yer değiştirmesi için)
  const [, drop] = useDrop({
    accept: ItemTypes.COLUMN,
    hover(item, monitor) {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;

      if (dragIndex === hoverIndex) return;

      // Sütunları yer değiştir
      moveColumn(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  // 2. Sütun Sürükleme Mantığı (Drag Source)
  const [{ isDragging }, drag] = useDrag({
    type: ItemTypes.COLUMN,
    item: { type: ItemTypes.COLUMN, id: column.id, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  // 3. Görev Bırakma Mantığı (Task Drop Target - Görevlerin sütuna düşmesi için)
  const [{ isOver }, dropTask] = useDrop({
    accept: ItemTypes.TASK,
    drop: (item) => moveTask(item.id, column.id),
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
    }),
  });

  // Ref'leri birleştir (Hem sütun sürükleme, hem bırakma, hem görev kabul etme)
  drag(drop(dropTask(ref)));

  return (
    <div
      ref={ref}
      className={`flex-shrink-0 w-80 mr-4 transition-all duration-200 ${
        isDragging ? 'opacity-40' : 'opacity-100'
      } ${isOver ? 'ring-2 ring-blue-400 rounded-lg' : ''}`}
    >
      <div className="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-3 h-full flex flex-col">
        {/* Tutamaç (Handle) - Kullanıcı buradan tutup sürüklesin diye */}
        <div className="cursor-move flex justify-center pb-1 opacity-0 hover:opacity-100 transition-opacity">
           <div className="w-8 h-1 bg-gray-300 rounded-full"></div>
        </div>
        
        <Column
          column={column}
          projectId={projectId}
          onTaskUpdate={onTaskUpdate}
          userRole={userRole}
          currentUserId={currentUserId}
        />
      </div>
    </div>
  );
};

// Ana Board Component
const Board = ({ projectId, userRole, currentUserId, onTaskMoveSuccess }) => {
  const [columns, setColumns] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');

  useEffect(() => {
    if (projectId) fetchBoardData();
  }, [projectId]);

  const fetchBoardData = async () => {
    try {
      setLoading(true);
      const [colsRes, tasksRes] = await Promise.all([
        api.get(`/projects/${projectId}/columns`),
        api.get(`/projects/${projectId}/tasks`)
      ]);
      setColumns(colsRes.data);
      setTasks(tasksRes.data);
    } catch (error) {
      console.error('Board verisi getirme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  // Sütun Yer Değiştirme (Frontend State Update)
  const moveColumn = (dragIndex, hoverIndex) => {
    const updatedColumns = [...columns];
    const [draggedColumn] = updatedColumns.splice(dragIndex, 1);
    updatedColumns.splice(hoverIndex, 0, draggedColumn);
    setColumns(updatedColumns);
  };

  // Sütun Sıralamasını Backend'e Kaydetme (DND Bittiğinde tetiklenebilir ama burada basitlik için useEffect kullanmayacağız)
  // React-DnD'de "end drag" olayını yakalamak complex olabilir, o yüzden
  // basit bir yöntemle "moveColumn" her çalıştığında değil, sütun yerleştiğinde API isteği atabiliriz.
  // Ancak performans için en iyisi: Kullanıcı sürüklemeyi bitirdiğinde kaydetmektir.
  // Şimdilik basitçe: Sütun sırası değiştiğinde arka planda API'ye istek atalım (Debounce gerekebilir ama şimdilik OK).
  
  // Not: moveColumn çok sık tetiklenir, bu yüzden API isteğini buraya koymak performansı düşürür.
  // Doğrusu useDrag içindeki 'end' metodunu kullanmaktır.
  // Ancak DraggableColumn bileşeni alt bileşen olduğu için state'e erişimimiz kısıtlı.
  // ÇÖZÜM: useDrop (Board seviyesinde) veya DraggableColumn içinde end handler.
  // Pratik Çözüm: DraggableColumn içinde end eventi kullanacağız.

  const handleColumnDrop = async (item) => {
    // Sürükleme bittiğinde mevcut 'columns' state'indeki ID sırasını gönder
    // Dikkat: State update asenkron olduğu için, burada columns state'i hemen güncel olmayabilir.
    // Bu yüzden moveColumn anlık güncelliyor. 
    // Biz API isteğini atmak için bir "Save" fonksiyonu yazalım ve DraggableColumn'a verelim.
  };
  
  // API'ye kaydetme işini 'DraggableColumn' içindeki 'end' callback'i ile tetiklemek için:
  const saveColumnOrder = async (finalColumns) => {
      try {
          const newOrder = finalColumns.map(c => c.id);
          await api.put(`/projects/${projectId}/columns/reorder`, { newOrder });
          console.log('Sütun sırası kaydedildi');
      } catch (error) {
          console.error('Sıralama kaydedilemedi:', error);
      }
  };


  const getColumnsWithTasks = () => {
    return columns.map(col => ({
      ...col,
      tasks: tasks.filter(task => task.status === col.id)
    }));
  };

  const handleAddColumn = async () => {
    if (!newColumnTitle.trim()) return;
    try {
      await api.post(`/projects/${projectId}/columns`, { title: newColumnTitle });
      setNewColumnTitle('');
      setIsAddingColumn(false);
      fetchBoardData();
    } catch (error) {
      alert('Sütun eklenemedi.');
    }
  };

  const moveTask = async (taskId, targetColumnId) => {
    const taskToMove = tasks.find(t => t.id === taskId);
    
    // Yetki kontrolü (Basit)
    const canMove = userRole === 'admin' || userRole === 'manager' || (taskToMove && taskToMove.assignee_user_id === currentUserId);
    if (!canMove) {
       alert('Yetkiniz yok');
       return;
    }

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: targetColumnId } : t));

    try {
      await api.put(`/tasks/${taskId}/status`, { status: targetColumnId });
      if (onTaskMoveSuccess) onTaskMoveSuccess();
    } catch (error) {
      fetchBoardData(); // Hata varsa geri al
    }
  };

  if (loading) return <div className="p-10 text-center">Yükleniyor...</div>;

  const columnsWithTasks = getColumnsWithTasks();

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex overflow-x-auto pb-4 h-full items-start">
        {columnsWithTasks.map((column, index) => (
          <DraggableColumn
            key={column.id}
            index={index}
            column={column}
            projectId={projectId}
            userRole={userRole}
            currentUserId={currentUserId}
            onTaskUpdate={fetchBoardData}
            moveTask={moveTask}
            moveColumn={moveColumn}
            // Sürükleme bittiğinde tetiklenecek mekanizmayı buraya eklemek biraz advanced,
            // Şimdilik UI'da yer değişsin, backend'i bir sonraki adımda %100 senkronize ederiz.
            // (State zaten güncelleniyor, tek eksik API call)
          />
        ))}
        
        {/* Yeni Sütun Ekleme Butonu */}
        {(userRole === 'admin' || userRole === 'manager') && (
          <div className="flex-shrink-0 w-80 bg-gray-100 dark:bg-gray-800/30 rounded-lg p-4 border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors">
            {isAddingColumn ? (
              <div className="bg-white dark:bg-gray-700 p-2 rounded shadow">
                <input 
                  autoFocus
                  type="text" 
                  className="w-full mb-2 p-1 border rounded text-sm dark:bg-gray-600 dark:text-white"
                  value={newColumnTitle}
                  onChange={(e) => setNewColumnTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()}
                />
                 <div className="flex gap-2">
                  <button onClick={handleAddColumn} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">Ekle</button>
                  <button onClick={() => setIsAddingColumn(false)} className="text-gray-500 text-sm">İptal</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setIsAddingColumn(true)} className="w-full h-full text-gray-500 hover:text-blue-600 py-4">
                + Sütun Ekle
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* SÜTUN SIRALAMASINI KAYDETMEK İÇİN GİZLİ BİR "SAVER" */}
      <BoardSaver columns={columns} projectId={projectId} saveColumnOrder={saveColumnOrder} />

    </DndProvider>
  );
};

// Bu yardımcı bileşen, columns state'i değiştiğinde API'ye istek atar (Debounce ile)
const BoardSaver = ({ columns, projectId, saveColumnOrder }) => {
    // İlk render'da çalışmasın diye ref kullanıyoruz
    const isFirstRun = useRef(true);
    
    useEffect(() => {
        if (isFirstRun.current) {
            isFirstRun.current = false;
            return;
        }
        
        // Debounce: Kullanıcı hızlıca sürüklerken sürekli istek atma, durduğunda at.
        const timer = setTimeout(() => {
            saveColumnOrder(columns);
        }, 1000); // 1 saniye bekle

        return () => clearTimeout(timer);
    }, [columns, projectId]); // columns değiştiğinde çalışır

    return null;
}

export default Board;