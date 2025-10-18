import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import Task from './Task'; // YENİ: Task component'ini import et

const Column = ({ column, projectId, onTaskUpdate, TaskComponent }) => {
  const { userData } = useAuth();
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;

    try {
      const newTask = {
        title: newTaskTitle,
        description: '',
        status: column.id,
        projectId: projectId,
        assignee: userData.id,
        createdBy: userData.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await addDoc(collection(db, 'tasks'), newTask);
      
      setNewTaskTitle('');
      setIsAddingTask(false);
      onTaskUpdate();
    } catch (error) {
      console.error('Görev ekleme hatası:', error);
    }
  };

  return (
    <div className="w-full">
      {/* Column Header */}
      <div className="flex justify-between items-center mb-4 p-2 bg-white rounded-lg shadow-sm">
        <h3 className="font-semibold text-gray-700 text-sm md:text-base">
          {column.title} <span className="text-gray-500">({column.tasks.length})</span>
        </h3>
        <button
          onClick={() => setIsAddingTask(true)}
          className="text-gray-500 hover:text-gray-700 text-lg p-1"
        >
          +
        </button>
      </div>

      {/* Yeni Görev Ekleme */}
      {isAddingTask && (
        <div className="mb-3 p-3 bg-white rounded-lg shadow border border-gray-200">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Görev başlığı..."
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <div className="flex space-x-2">
            <button
              onClick={handleAddTask}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded text-sm transition-colors"
            >
              Ekle
            </button>
            <button
              onClick={() => setIsAddingTask(false)}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-1 px-3 rounded text-sm transition-colors"
            >
              İptal
            </button>
          </div>
        </div>
      )}

      {/* Görev Listesi - YENİ: Task component'ini doğrudan kullan */}
      <div className="space-y-3 min-h-[100px]">
        {column.tasks.map(task => (
          <Task
            key={task.id}
            task={task}
            onUpdate={onTaskUpdate}
          />
        ))}
        
        {column.tasks.length === 0 && !isAddingTask && (
          <div className="text-center text-gray-400 text-sm py-6 bg-white rounded-lg border-2 border-dashed border-gray-300">
            📝<br />
            Görev yok
          </div>
        )}
      </div>
    </div>
  );
};

export default Column;