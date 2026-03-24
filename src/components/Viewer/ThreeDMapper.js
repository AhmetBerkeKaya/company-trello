// src/components/Viewer/ThreeDMapper.js
import React, { useState, Suspense } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { Environment, OrbitControls, Html, useProgress } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as THREE from 'three'; 
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import TaskPin from './TaskPin'; 

const Loader = () => <Html center><div className="bg-black/80 text-white px-4 py-2 rounded-lg backdrop-blur">Yükleniyor... {useProgress().progress.toFixed(0)}%</div></Html>;

const GenericModel = ({ url, onModelClick }) => {
  const gltf = useLoader(GLTFLoader, url);
  return <primitive object={gltf.scene} onClick={onModelClick} />;
};

const ThreeDPinHtml = ({ task, onDelete }) => {
  const z = task.pin_3d_data?.z || task.pin_z || 0;
  return (
    <Html position={[task.pin_x, task.pin_y, z]} zIndexRange={[100, 0]} center>
       <TaskPin task={task} onDelete={onDelete} style={{ position: 'relative' }} />
    </Html>
  );
};

const ThreeDMapper = ({ plan, projectId, tasks, onTaskCreated, projectMembers }) => {
  const { userData } = useAuth();
  const [tempPin, setTempPin] = useState(null);
  const [isAddingPin, setIsAddingPin] = useState(false);
  
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  
  const modelTasks = tasks.filter(t => t.plan_file_id === plan.file_id);

  const handleModelClick = (event) => {
    if (!isAddingPin) return;
    event.stopPropagation();
    setTempPin({
        position: [event.point.x, event.point.y, event.point.z],
        cameraState: { position: [event.camera.position.x, event.camera.position.y, event.camera.position.z], target: [event.point.x, event.point.y, event.point.z] }
    });
    setIsAddingPin(false);
  };

  const handleDeleteTask = async (task) => {
    if(!window.confirm('Bu pini silmek istediğinize emin misiniz?')) return;
    try { await api.delete(`/tasks/${task.task_id || task.id}`); if (onTaskCreated) onTaskCreated(); } 
    catch(e) { alert('Silinemedi'); }
  };

  const handleSaveTask = async () => {
    if (!newTaskTitle.trim() || !tempPin) return;
    try {
      await api.post('/tasks', {
        title: newTaskTitle, description: newTaskDesc, assignee: newAssignee,
        status: 'todo', projectId, planFileId: plan.file_id,
        pinX: tempPin.position[0], pinY: tempPin.position[1], 
        pin3dData: { z: tempPin.position[2], cameraState: tempPin.cameraState },
        isVisibleToClient: userData?.role === 'client'
      });
      setTempPin(null); setNewTaskTitle(''); setNewTaskDesc(''); setNewAssignee('');
      if (onTaskCreated) onTaskCreated();
    } catch (error) { alert('Hata: ' + error.message); }
  };

  return (
    <div className="w-full h-full relative bg-gray-900">
      <Canvas shadows camera={{ position: [15, 15, 15], fov: 50 }}>
        <Suspense fallback={<Loader />}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <Environment preset="city" />

          <GenericModel url={plan.url} onModelClick={handleModelClick} />
          
          {modelTasks.map(task => <ThreeDPinHtml key={task.id} task={task} onDelete={handleDeleteTask} /> )}

          {tempPin && (
            <Html position={tempPin.position} center>
                <div className="w-4 h-4 bg-blue-500 rounded-full animate-bounce border-2 border-white"></div>
            </Html>
          )}

          <OrbitControls makeDefault />
        </Suspense>
      </Canvas>

      <div className="absolute top-4 left-4 z-10">
         <button onClick={() => setIsAddingPin(!isAddingPin)} className={`px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl transition-colors ${isAddingPin ? 'bg-red-600 text-white' : 'bg-white text-gray-800 hover:bg-gray-100'}`}>
            {isAddingPin ? 'İptal Et' : '📍 Yeni Pin Ekle'}
         </button>
      </div>

      {tempPin && (
         <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
             <div className="bg-white p-8 rounded-3xl shadow-2xl w-80 animate-slide-in">
                <h3 className="font-black text-gray-800 text-center mb-6 uppercase tracking-widest text-sm">YENİ 3D PİN EKLE</h3>
                <input autoFocus className="w-full border-b border-gray-200 pb-3 mb-5 text-sm focus:border-blue-500 outline-none transition-colors font-semibold" placeholder="Görev Başlığı *" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} />
                <textarea className="w-full border border-gray-200 rounded-xl p-3 mb-5 text-xs focus:border-blue-500 outline-none resize-none h-20 transition-colors custom-scrollbar" placeholder="Açıklama ve detaylar (Opsiyonel)" value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} />
                <select className="w-full border border-gray-200 rounded-xl p-3 mb-6 text-xs focus:border-blue-500 outline-none transition-colors bg-gray-50" value={newAssignee} onChange={e => setNewAssignee(e.target.value)}>
                   <option value="">Atanacak Kişiyi Seçin...</option>
                   {projectMembers.map(m => <option key={m.user_id} value={m.user_id}>{m.name} ({m.role})</option>)}
                </select>
                <div className="flex gap-3">
                    <button onClick={handleSaveTask} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-95 transition-all">Kaydet</button>
                    <button onClick={() => {setTempPin(null); setNewTaskTitle(''); setNewTaskDesc(''); setNewAssignee('');}} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 active:scale-95 transition-all">İptal</button>
                </div>
             </div>
         </div>
      )}
    </div>
  );
};

export default ThreeDMapper;