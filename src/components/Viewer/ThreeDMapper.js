// src/components/Viewer/ThreeDMapper.js
import React, { useState, useEffect, Suspense } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { Environment, OrbitControls, Html, useProgress } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { IFCLoader } from 'web-ifc-three/IFCLoader';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';

// Yükleme Ekranı
const Loader = () => {
  const { progress } = useProgress();
  return <Html center><div className="text-white bg-black/50 p-2 rounded">{progress.toFixed(0)}% yüklendi</div></Html>;
};

// --- 1. GLB MODEL ---
const GLBModel = ({ url, onModelClick }) => {
  const gltf = useLoader(GLTFLoader, url);
  return <primitive object={gltf.scene} onClick={(e) => {e.stopPropagation(); onModelClick(e.point, e.normal)}} />;
};

// --- 2. OBJ MODEL ---
const OBJModel = ({ url, onModelClick }) => {
  const obj = useLoader(OBJLoader, url);
  return <primitive object={obj} onClick={(e) => {e.stopPropagation(); onModelClick(e.point, e.normal)}} />;
};

// --- 3. STL MODEL ---
const STLModel = ({ url, onModelClick }) => {
  const geom = useLoader(STLLoader, url);
  return (
    <mesh geometry={geom} onClick={(e) => {e.stopPropagation(); onModelClick(e.point, e.normal)}} scale={0.1} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="gray" />
    </mesh>
  );
};

// --- 4. IFC MODEL (DÜZELTİLMİŞ) ---
const IFCModel = ({ url, onModelClick }) => {
  const [ifcObject, setIfcObject] = useState(null);

  useEffect(() => {
    const loader = new IFCLoader();
    
    // 👇 DÜZELTME: Dosyalar "public/wasm" klasöründe olduğu için yolu güncelledik.
    // "window.location.origin" sitenin ana adresidir (localhost:3000)
    // Sonuna "/wasm/" ekleyerek doğru klasörü işaret ediyoruz.
    const wasmPath = window.location.origin + '/wasm/';
    
    console.log("📂 IFC Motoru Yerel Klasörden Aranıyor:", wasmPath);
    loader.ifcManager.setWasmPath(wasmPath);

    loader.load(url, 
      (ifcModel) => {
        console.log("✅ IFC Modeli Başarıyla Yüklendi!");
        setIfcObject(ifcModel);
      },
      null, 
      (err) => console.error("❌ IFC Yükleme Hatası:", err)
    );
  }, [url]);

  if (!ifcObject) return null;
  return <primitive object={ifcObject} onClick={(e) => {e.stopPropagation(); onModelClick(e.point, e.normal)}} />;
};


// --- MODEL SEÇİCİ ---
const ModelSelector = ({ url, name, onModelClick }) => {
  const extension = name.split('.').pop().toLowerCase();

  if (extension === 'glb' || extension === 'gltf') return <GLBModel url={url} onModelClick={onModelClick} />;
  if (extension === 'obj') return <OBJModel url={url} onModelClick={onModelClick} />;
  if (extension === 'stl') return <STLModel url={url} onModelClick={onModelClick} />;
  if (extension === 'ifc') return <IFCModel url={url} onModelClick={onModelClick} />;
  
  return null;
};


// --- 3D PIN ---
const ThreeDPin = ({ task }) => {
  const [hovered, setHovered] = useState(false);
  const getColor = (status) => (status === 'completed' ? '#10B981' : status === 'inProgress' ? '#F59E0B' : '#EF4444');
  const z = task.pin_3d_data?.z || task.pin_z || 0;

  return (
    <group position={[task.pin_x, task.pin_y, z]}>
      <mesh 
        onClick={(e) => { e.stopPropagation(); setHovered(!hovered); }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial color={getColor(task.status)} emissive={getColor(task.status)} emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, -1, 0]}><cylinderGeometry args={[0.05, 0.02, 2, 8]} /><meshStandardMaterial color="white" /></mesh>
      {hovered && (
        <Html position={[0, 2, 0]} center>
          <div className="bg-gray-900 text-white text-xs p-2 rounded shadow-lg w-40 z-50 pointer-events-none">
            <p className="font-bold truncate">{task.title}</p>
            <p className="text-[10px] opacity-75">{task.status}</p>
          </div>
        </Html>
      )}
    </group>
  );
};

// --- ANA COMPONENT ---
const ThreeDMapper = ({ plan, projectId, tasks, onTaskCreated }) => {
  const { userData } = useAuth();
  const [tempPin, setTempPin] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const modelTasks = tasks.filter(t => t.plan_file_id === plan.file_id);

  const handleModelClick = (point, normal) => {
    setTempPin({ position: [point.x, point.y, point.z], normal: [normal.x, normal.y, normal.z] });
  };

  const handleSaveTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    try {
      await api.post('/tasks', {
        title: newTaskTitle, status: 'todo', projectId: projectId, planFileId: plan.file_id,
        pinX: tempPin.position[0], pinY: tempPin.position[1], pin3dData: { z: tempPin.position[2] },
        isVisibleToClient: userData?.role === 'client'
      });
      setTempPin(null); setNewTaskTitle('');
      if (onTaskCreated) onTaskCreated();
    } catch (error) { alert('Hata oluştu'); }
  };

  return (
    <div className="w-full h-full relative bg-gradient-to-b from-gray-800 to-gray-900">
      <Canvas camera={{ position: [10, 10, 10], fov: 50 }} shadows>
        <Suspense fallback={<Loader />}>
          <ambientLight intensity={0.6} />
          <spotLight position={[20, 20, 20]} angle={0.2} penumbra={1} intensity={1} castShadow />
          <pointLight position={[-10, -10, -10]} intensity={0.5} />
          <Environment preset="city" />

          <ModelSelector 
            url={plan.url} 
            name={plan.name} 
            onModelClick={handleModelClick} 
          />
          
          {modelTasks.map(task => <ThreeDPin key={task.id} task={task} />)}

          {tempPin && (
            <group position={tempPin.position}>
               <mesh><sphereGeometry args={[0.5, 16, 16]} /><meshStandardMaterial color="#3B82F6" opacity={0.8} transparent /></mesh>
               <Html position={[0, 2, 0]} center>
                 <div className="bg-white p-2 rounded shadow-lg w-48">
                   <input autoFocus className="w-full border p-1 text-sm mb-1 text-black" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="Görev..." />
                   <div className="flex gap-1">
                    <button onClick={handleSaveTask} className="flex-1 bg-blue-600 text-white text-xs py-1 rounded">Ekle</button>
                    <button onClick={() => setTempPin(null)} className="flex-1 bg-gray-200 text-black text-xs py-1 rounded">İptal</button>
                   </div>
                 </div>
               </Html>
            </group>
          )}
          <OrbitControls makeDefault />
        </Suspense>
      </Canvas>
      <div className="absolute top-2 left-2 bg-black/50 text-white text-xs p-2 rounded pointer-events-none">
        <p>Sol Tık: Döndür | Sağ Tık: Kaydır</p>
        <p>Desteklenenler: .GLB, .OBJ, .STL, .IFC</p>
      </div>
    </div>
  );
};

export default ThreeDMapper;