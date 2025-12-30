/* global Autodesk, THREE */
import React, { useEffect, useRef, useState } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';

const ForgeViewer = ({ urn, tasks, projectId, planFileId, onTaskCreated }) => {
  const viewerDivRef = useRef(null);
  const viewerRef = useRef(null);
  const { userData } = useAuth();
  
  const [isAddingPin, setIsAddingPin] = useState(false);
  const [newPinTempData, setNewPinTempData] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Pinleme modunu bir Ref ile takip edelim ki event listener içinde güncel kalsın
  const isPinModeActiveRef = useRef(false);

  const getToken = async (callback) => {
    try {
      const res = await api.get('/aps/token');
      callback(res.data.access_token, res.data.expires_in);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (!window.Autodesk || !viewerDivRef.current || viewerRef.current) return;

    const options = { env: 'AutodeskProduction', api: 'derivativeV2', getAccessToken: getToken };

    Autodesk.Viewing.Initializer(options, () => {
      const viewer = new Autodesk.Viewing.GuiViewer3D(viewerDivRef.current);
      viewer.start();
      viewerRef.current = viewer;

      // Use the viewer's container to ensure the click isn't swallowed
      viewer.container.addEventListener('click', (event) => {
          // Check if the pin mode is active before processing
          if (!isAddingPin) return; 

          const result = viewer.impl.hitTest(event.clientX, event.clientY, true);
          
          if (result && result.intersectPoint) {
              console.log("3D Nokta Yakalandı:", result.intersectPoint);
              setNewPinTempData(result.intersectPoint);
              // Deactivate pin mode once the location is selected
              setIsAddingPin(false); 
          }
      });

      const documentId = 'urn:' + urn;
      Autodesk.Viewing.Document.load(documentId, (doc) => {
        const rootNode = doc.getRoot();
        const geometries = rootNode.search({ type: 'geometry', role: '3d' });
        let modelNode = geometries.length > 0 ? geometries[0] : rootNode.getDefaultGeometry();
        if (modelNode) viewer.loadDocumentNode(doc, modelNode);
      });
    });

    return () => { if (viewerRef.current) { viewerRef.current.finish(); viewerRef.current = null; } };
  }, [urn]);

  // TIKLAMA YAKALAYICI (Viewer'ın üzerine binen şeffaf bir katman gibi çalışır)
  const handleMouseClick = (event) => {
    if (!viewerRef.current || !isPinModeActiveRef.current) return;

    // Viewer'ın konteynırına göre koordinatları al
    const rect = viewerRef.current.container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Hit test: Tıklanan 3D noktayı bul
    const result = viewerRef.current.impl.hitTest(x, y, true);
    
    if (result && result.intersectPoint) {
      console.log("3D Nokta Yakalandı:", result.intersectPoint);
      setNewPinTempData(result.intersectPoint);
      // Pin modunu hemen kapat ki yanlışlıkla başka yere tıklanmasın
      togglePinMode(false);
    }
  };

  const togglePinMode = (active) => {
    setIsAddingPin(active);
    isPinModeActiveRef.current = active;
    if (viewerRef.current) {
        // Pin modundayken Viewer'ın seçim yapmasını engelleyelim
        viewerRef.current.setNavigationLock(active);
    }
  };

  const drawPins = (taskList, viewer) => {
    if (!viewer || !viewer.overlays) return;
    const overlayName = 'custom-pins-overlay';
    if (!viewer.overlays.hasScene(overlayName)) viewer.overlays.addScene(overlayName);
    viewer.overlays.clearScene(overlayName);

    taskList.forEach(task => {
        if(task.plan_file_id !== planFileId) return;
        const geometry = new THREE.SphereGeometry(2, 32, 32); 
        const material = new THREE.MeshBasicMaterial({ color: task.status === 'completed' ? 0x10B981 : 0xEF4444 });
        const sphere = new THREE.Mesh(geometry, material);
        // Backend'den gelen Z koordinatını kullanıyoruz
        const z = task.pin_3d_data?.z || 0;
        sphere.position.set(task.pin_x, task.pin_y, z);
        viewer.overlays.addMesh(sphere, overlayName);
    });
    viewer.impl.invalidate(true);
  };
  
  useEffect(() => { if (viewerRef.current) drawPins(tasks, viewerRef.current); }, [tasks]);

  const saveTask = async () => {
    if (!newTaskTitle.trim() || !newPinTempData) return;
    try {
        await api.post('/tasks', {
            title: newTaskTitle,
            status: 'todo',
            projectId,
            planFileId,
            pinX: newPinTempData.x,
            pinY: newPinTempData.y,
            pin3dData: { z: newPinTempData.z }, // Z koordinatı burada gidiyor
            isVisibleToClient: userData?.role === 'client'
        });
        setNewPinTempData(null);
        setNewTaskTitle('');
        if (onTaskCreated) onTaskCreated();
    } catch (error) { alert('Hata: ' + error.message); }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Viewer'ın üzerine tıklamayı yakalayan katmanı ekledik */}
      <div 
        ref={viewerDivRef} 
        style={{ width: '100%', height: '100%' }} 
        onClick={handleMouseClick}
      />

      <div className="absolute top-4 left-4 flex gap-2" style={{ zIndex: 1000 }}>
         <button 
            onClick={() => togglePinMode(!isAddingPin)}
            className={`px-4 py-2 rounded shadow text-white font-bold transition ${isAddingPin ? 'bg-red-600' : 'bg-blue-600'}`}
         >
            {isAddingPin ? '📍 Tıkla ve Bırak' : '📍 Pin Ekle'}
         </button>
      </div>

      {newPinTempData && (
         <div 
           className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-4 rounded-lg shadow-2xl w-64 border-2 border-blue-500"
           style={{ zIndex: 9999 }} // Çok yüksek z-index
         >
            <h3 className="text-sm font-bold mb-2 text-black">📍 Yeni Görev Noktası</h3>
            <input 
              autoFocus 
              className="w-full border p-2 mb-2 text-sm rounded text-black" 
              placeholder="Görev adı..." 
              value={newTaskTitle} 
              onChange={e => setNewTaskTitle(e.target.value)} 
            />
            <div className="flex gap-2">
                <button onClick={saveTask} className="flex-1 bg-green-600 text-white py-1 rounded text-sm hover:bg-green-700">Kaydet</button>
                <button onClick={() => setNewPinTempData(null)} className="flex-1 bg-gray-300 text-gray-700 py-1 rounded text-sm">Vazgeç</button>
            </div>
         </div>
      )}
    </div>
  );
};

export default ForgeViewer;