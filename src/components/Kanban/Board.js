// src/components/Kanban/Board.js
import React, { useState, useEffect, useRef } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Column from './Column';
import api from '../../api/axios';

const ItemTypes = { TASK: 'task', COLUMN: 'column' };

// DraggableColumn
const DraggableColumn = ({ column, index, moveColumn, projectId, onTaskUpdate, moveTask, userRole, currentUserId, isObserver }) => {
  const ref = useRef(null);
  
  // Sütun taşıma yetkisi: Müşteri değilse VE Gözlemci değilse
  const canDragColumn = userRole !== 'client' && !isObserver;

  const [, drop] = useDrop({
    accept: ItemTypes.COLUMN,
    hover(item, monitor) {
      if (!ref.current || !canDragColumn) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;
      moveColumn(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  const [{ isDragging }, drag] = useDrag({
    type: ItemTypes.COLUMN,
    item: { type: ItemTypes.COLUMN, id: column.id, index },
    canDrag: canDragColumn,
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [{ isOver }, dropTask] = useDrop({
    accept: ItemTypes.TASK,
    drop: (item) => moveTask(item.id, column.id),
    collect: (monitor) => ({ isOver: !!monitor.isOver() }),
  });

  if(canDragColumn) drag(drop(dropTask(ref)));
  else dropTask(ref);

  return (
    <div ref={ref} className={`flex-shrink-0 w-80 mr-4 transition-all duration-200 ${isDragging ? 'opacity-40' : 'opacity-100'} ${isOver && !isObserver ? 'ring-2 ring-blue-400 rounded-lg' : ''}`}>
      <div className="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-3 h-full flex flex-col">
        {canDragColumn && (
            <div className="cursor-move flex justify-center pb-1 opacity-0 hover:opacity-100 transition-opacity">
               <div className="w-8 h-1 bg-gray-300 rounded-full"></div>
            </div>
        )}
        <Column
          column={column}
          projectId={projectId}
          onTaskUpdate={onTaskUpdate}
          userRole={userRole}
          currentUserId={currentUserId}
          isObserver={isObserver} // Prop'u aşağı iletiyoruz
        />
      </div>
    </div>
  );
};

const Board = ({ projectId, phaseId, userRole, currentUserId, onTaskMoveSuccess, isObserver }) => {
  const [columns, setColumns] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');

  // Board düzenleme yetkisi: Admin/Manager VE Gözlemci DEĞİL
  const canEditBoard = (userRole === 'admin' || userRole === 'manager') && !isObserver;

  useEffect(() => {
    if (phaseId) fetchBoardData();
  }, [phaseId, projectId]);

  const fetchBoardData = async () => {
    try {
      setLoading(true);
      const [colsRes, tasksRes] = await Promise.all([
        api.get(`/phases/${phaseId}/columns`), 
        api.get(`/projects/${projectId}/tasks`) 
      ]);
      setColumns(colsRes.data);
      setTasks(tasksRes.data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleTaskUpdate = async () => {
    await fetchBoardData(); 
    if (onTaskMoveSuccess) onTaskMoveSuccess(); 
  };

  const moveColumn = (dragIndex, hoverIndex) => {
    if (!canEditBoard) return;
    const updatedColumns = [...columns];
    const [draggedColumn] = updatedColumns.splice(dragIndex, 1);
    updatedColumns.splice(hoverIndex, 0, draggedColumn);
    setColumns(updatedColumns);
  };

  const saveColumnOrder = async (finalColumns) => {
      if (!canEditBoard) return;
      try {
          const newOrder = finalColumns.map(c => c.id);
          await api.put(`/phases/${phaseId}/columns/reorder`, { newOrder });
      } catch (error) { console.error(error); }
  };

  const handleAddColumn = async () => {
    if (!newColumnTitle.trim()) return;
    try {
      await api.post(`/phases/${phaseId}/columns`, { title: newColumnTitle });
      setNewColumnTitle('');
      setIsAddingColumn(false);
      fetchBoardData();
    } catch (error) { alert('Sütun eklenemedi.'); }
  };

  const moveTask = async (taskId, targetColumnId) => {
    // Gözlemci taşıyamaz
    if (userRole === 'client' || isObserver) return; 

    const taskToMove = tasks.find(t => t.id === taskId);
    const canMove = userRole === 'admin' || userRole === 'manager' || (taskToMove && taskToMove.assignee_user_id === currentUserId);
    if (!canMove) { alert('Yetkiniz yok'); return; }

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: targetColumnId } : t));
    try {
      await api.put(`/tasks/${taskId}/status`, { status: targetColumnId });
      if (onTaskMoveSuccess) onTaskMoveSuccess();
    } catch (error) { fetchBoardData(); }
  };

  const getColumnsWithTasks = () => {
    return columns.map(col => ({
      ...col,
      tasks: tasks.filter(task => task.status === col.id || task.column_id === col.id)
    }));
  };

  if (loading) return <div className="p-10 text-center">Yükleniyor...</div>;

  const columnsWithTasks = getColumnsWithTasks();

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex overflow-x-auto pb-4 h-full items-start min-h-[500px]">
        {columnsWithTasks.map((column, index) => (
          <DraggableColumn
            key={column.id}
            index={index}
            column={column}
            projectId={projectId}
            userRole={userRole}
            currentUserId={currentUserId}
            onTaskUpdate={handleTaskUpdate}
            moveTask={moveTask}
            moveColumn={moveColumn}
            isObserver={isObserver} // Gözlemci bilgisini iletiyoruz
          />
        ))}
        
        {/* Sütun Ekleme Butonu: Sadece yetkili ve gözlemci olmayanlar görebilir */}
        {canEditBoard && (
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
      <BoardSaver columns={columns} projectId={projectId} saveColumnOrder={saveColumnOrder} />
    </DndProvider>
  );
};

const BoardSaver = ({ columns, projectId, saveColumnOrder }) => {
    const isFirstRun = useRef(true);
    useEffect(() => {
        if (isFirstRun.current) { isFirstRun.current = false; return; }
        const timer = setTimeout(() => { saveColumnOrder(columns); }, 1000);
        return () => clearTimeout(timer);
    }, [columns]);
    return null;
}

export default Board;