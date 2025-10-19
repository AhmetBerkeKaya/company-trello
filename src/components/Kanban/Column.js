import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import Task from './Task';

const Column = ({ column, projectId, onTaskUpdate, TaskComponent }) => {
  const { userData } = useAuth();
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [projectMembers, setProjectMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Proje üyelerini getir
  useEffect(() => {
    if (isAddingTask && projectId) {
      fetchProjectMembers();
    }
  }, [isAddingTask, projectId]);

  const fetchProjectMembers = async () => {
    try {
      setLoadingMembers(true);
      const projectDoc = await getDoc(doc(db, 'projects', projectId));
      const projectData = projectDoc.data();

      if (projectData?.members) {
        const usersQuery = query(
          collection(db, 'users'),
          where('__name__', 'in', projectData.members.slice(0, 10))
        );

        const usersSnapshot = await getDocs(usersQuery);
        const members = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setProjectMembers(members);
      }
    } catch (error) {
      console.error('Üyeleri getirme hatası:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;

    try {
      const newTask = {
        title: newTaskTitle,
        description: '',
        status: column.id,
        projectId: projectId,
        assignee: newTaskAssignee || userData.id, // Atanan kişi veya kendisi
        createdBy: userData.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await addDoc(collection(db, 'tasks'), newTask);
      
      setNewTaskTitle('');
      setNewTaskAssignee('');
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
          
          {/* Atanan Kişi Seçimi - Sadece Admin ve Proje Yöneticisi için */}
          {(userData?.role === 'admin' || userData?.role === 'project-manager') && (
            <div className="mb-2">
              <label className="block text-xs text-gray-600 mb-1">
                Atanan Kişi:
              </label>
              <select
                value={newTaskAssignee}
                onChange={(e) => setNewTaskAssignee(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Kendim</option>
                {loadingMembers ? (
                  <option value="">Yükleniyor...</option>
                ) : (
                  projectMembers.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.name} ({member.role === 'admin' ? 'Admin' : member.role === 'project-manager' ? 'Proje Yöneticisi' : 'Kullanıcı'})
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          <div className="flex space-x-2">
            <button
              onClick={handleAddTask}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded text-sm transition-colors"
            >
              Ekle
            </button>
            <button
              onClick={() => {
                setIsAddingTask(false);
                setNewTaskAssignee('');
              }}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-1 px-3 rounded text-sm transition-colors"
            >
              İptal
            </button>
          </div>
        </div>
      )}

      {/* Görev Listesi */}
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