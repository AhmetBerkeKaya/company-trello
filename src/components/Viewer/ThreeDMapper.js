// src/components/Viewer/ThreeDMapper.js
import React, { useState, Suspense } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { Environment, OrbitControls, Html, useProgress } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as THREE from 'three'; // THREE'yi import etmeyi unutma
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import TaskPin from './TaskPin'; // YENİ BİLEŞEN

const Loader = () => <Html center><div className="bg-black/80 text-white px-4 py-2 rounded-lg backdrop-blur">Yükleniyor... {useProgress().progress.toFixed(0)}%</div></Html>;

const GenericModel = ({ url, name, onModelClick }) => {
  const gltf = useLoader(GLTFLoader, url);
  return <primitive object={gltf.scene} onClick={onModelClick} />;
};

// --- YENİ 3D HTML PIN YAPISI ---
const ThreeDPinHtml = ({ task, onPinClick }) => {
  const z = task.pin_3d_data?.z || task.pin_z || 0;

  return (
    <Html 
      position={[task.pin_x, task.pin_y, z]} // 3D uzaydaki konumu
      zIndexRange={[100, 0]} // Uzaktakiler arkada kalsın
      center // Div'in merkezi koordinatın tam üstüne gelsin
    >
       <TaskPin 
          task={task} 
          onClick={onPinClick} 
          style={{ position: 'relative' }} // Html bileşeni zaten konumlandırıyor
       />
    </Html>
  );
};

const ThreeDMapper = ({ plan, projectId, tasks, onTaskCreated }) => {
  const { userData } = useAuth();
  const [tempPin, setTempPin] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  
  const modelTasks = tasks.filter(t => t.plan_file_id === plan.file_id);
  const [isAddingPin, setIsAddingPin] = useState(false);

  const handleModelClick = (event) => {
    if (!isAddingPin) return;
    event.stopPropagation();
    const { point, camera } = event;

    setTempPin({
        position: [point.x, point.y, point.z],
        cameraState: { position: [camera.position.x, camera.position.y, camera.position.z], target: [point.x, point.y, point.z] }
    });
    setIsAddingPin(false);
  };

  const handleSaveTask = async () => {
    if (!newTaskTitle.trim() || !tempPin) return;
    try {
      await api.post('/tasks', {
        title: newTaskTitle, status: 'todo', projectId, planFileId: plan.file_id,
        pinX: tempPin.position[0], pinY: tempPin.position[1], 
        pin3dData: { z: tempPin.position[2], cameraState: tempPin.cameraState },
        isVisibleToClient: userData?.role === 'client'
      });
      setTempPin(null); setNewTaskTitle('');
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

          <GenericModel url={plan.url} name={plan.name} onModelClick={handleModelClick} />
          
          {/* HTML PİNLER */}
          {modelTasks.map(task => (
             <ThreeDPinHtml 
                key={task.id} 
                task={task} 
                onPinClick={(t) => console.log("Task tıklandı:", t.title)} 
             />
          ))}

          {/* Geçici Pin (Eklerken) */}
          {tempPin && (
            <Html position={tempPin.position} center>
                <div className="w-4 h-4 bg-blue-500 rounded-full animate-bounce border-2 border-white"></div>
            </Html>
          )}

          <OrbitControls makeDefault />
        </Suspense>
      </Canvas>

      <div className="absolute top-4 left-4 z-10">
         <button onClick={() => setIsAddingPin(!isAddingPin)} className={`px-4 py-2 rounded-lg font-bold shadow-lg transition-colors ${isAddingPin ? 'bg-red-600 text-white' : 'bg-white text-gray-800 hover:bg-gray-100'}`}>
            {isAddingPin ? 'İptal' : '📍 Pin Ekle'}
         </button>
      </div>

      {tempPin && (
         <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
             <div className="bg-white p-5 rounded-xl shadow-2xl w-80">
                <h3 className="font-bold mb-4 text-gray-800">Yeni Görev</h3>
                <input autoFocus className="w-full border p-2 mb-4 rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Görev adı..." value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSaveTask()} />
                <div className="flex gap-2">
                    <button onClick={handleSaveTask} className="flex-1 bg-blue-600 text-white py-2 rounded font-medium">Kaydet</button>
                    <button onClick={() => setTempPin(null)} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded font-medium">İptal</button>
                </div>
             </div>
         </div>
      )}
    </div>
  );
};

export default ThreeDMapper;