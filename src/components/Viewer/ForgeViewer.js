/* global Autodesk */
import React, { useEffect, useRef, useState } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import TaskPin from './TaskPin'; 

const ForgeViewer = ({ urn, tasks, projectId, planFileId, onTaskCreated }) => {
  const viewerDivRef = useRef(null);
  const viewerRef = useRef(null);
  const { userData } = useAuth();
  
  // HTML PİN POZİSYONLARI
  const [overlayPins, setOverlayPins] = useState([]);
  
  const [isAddingPin, setIsAddingPin] = useState(false);
  const [tempPin, setTempPin] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const getToken = async (callback) => {
    try { const res = await api.get('/aps/token'); callback(res.data.access_token, res.data.expires_in); } catch (err) { console.error(err); }
  };

  // --- KRİTİK DÜZELTME BURADA ---
  const updatePinPositions = () => {
      const viewer = viewerRef.current;
      // window.THREE kontrolü ekledik, hata vermesin diye
      if (!viewer || !window.THREE) return;

      const currentTasks = tasks.filter(t => t.plan_file_id === planFileId);
      
      const newOverlays = currentTasks.map(task => {
          const z = task.pin_3d_data?.z || task.pin_z || 0;
          
          // DÜZELTME: window.THREE.Vector3 kullanıyoruz
          const vec = new window.THREE.Vector3(task.pin_x, task.pin_y, z);
          
          // 3D -> 2D Çevrimi
          const pos = viewer.worldToClient(vec);

          // Görünürlük kontrolü (Kameranın arkasında kalanları gizle)
          // navigation.isPointVisible bazen hata verebilir, try-catch bloğuna alalım
          let isVisible = true;
          try {
             isVisible = viewer.navigation.isPointVisible(vec);
          } catch(e) { isVisible = true; }

          return {
              ...task,
              screenX: pos.x,
              screenY: pos.y,
              visible: isVisible
          };
      });
      
      setOverlayPins(newOverlays);
  };

  useEffect(() => {
    if (!window.Autodesk || !viewerDivRef.current) return;

    const options = { env: 'AutodeskProduction', api: 'derivativeV2', getAccessToken: getToken };

    Autodesk.Viewing.Initializer(options, () => {
      const viewer = new Autodesk.Viewing.GuiViewer3D(viewerDivRef.current);
      viewer.start();
      viewerRef.current = viewer;
      viewer.setTheme('light-theme');

      // EVENTS: Kamera hareket ettiğinde pinleri güncelle
      viewer.addEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, updatePinPositions);
      viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, updatePinPositions);
      
      // Tıklama (Pin Ekleme)
      viewer.container.addEventListener('click', (event) => {
          if (!isAddingPin) return; 

          const rect = viewer.container.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          
          const result = viewer.impl.hitTest(x, y, true);
          if (result && result.intersectPoint) {
              const viewerState = viewer.getState({ viewport: true });
              setTempPin({
                  point: result.intersectPoint,
                  viewerState: viewerState,
                  screenX: x,
                  screenY: y
              });
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

    return () => {
        if (viewerRef.current) {
            viewerRef.current.removeEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, updatePinPositions);
            viewerRef.current.finish();
            viewerRef.current = null;
        }
    };
  }, [urn]);

  // Task listesi değişince pozisyonları tekrar hesapla
  useEffect(() => { updatePinPositions(); }, [tasks]);

  const saveTask = async () => {
    if (!newTaskTitle.trim() || !tempPin) return;
    try {
        await api.post('/tasks', {
            title: newTaskTitle, status: 'todo', projectId, planFileId,
            pinX: tempPin.point.x, pinY: tempPin.point.y, 
            pin3dData: { z: tempPin.point.z, viewerState: tempPin.viewerState },
            isVisibleToClient: userData?.role === 'client'
        });
        setTempPin(null); setNewTaskTitle('');
        if (onTaskCreated) onTaskCreated();
    } catch (error) { alert('Hata: ' + error.message); }
  };

  return (
    <div className="relative w-full h-full group overflow-hidden bg-gray-100">
      <div ref={viewerDivRef} className="w-full h-full" />

      {/* HTML PİN KATMANI */}
      <div className="absolute inset-0 pointer-events-none z-10 w-full h-full overflow-hidden">
          {overlayPins.map(pin => (
              pin.visible && (
                <TaskPin 
                    key={pin.task_id}
                    task={pin}
                    style={{
                        position: 'absolute',
                        left: pin.screenX,
                        top: pin.screenY,
                        transform: 'translate(-50%, -50%)', // Tam ortaya hizala
                        pointerEvents: 'auto'
                    }}
                    onClick={(t) => {
                        console.log("Pin tıklandı, kamera restore ediliyor...");
                        if(viewerRef.current && t.pin_3d_data?.viewerState) {
                             viewerRef.current.restoreState(t.pin_3d_data.viewerState);
                        }
                    }}
                />
              )
          ))}
      </div>

      <div className="absolute top-4 left-4 z-50 pointer-events-auto">
         <button onClick={() => setIsAddingPin(!isAddingPin)} className={`px-4 py-2 rounded shadow font-bold text-white transition-colors ${isAddingPin ? 'bg-red-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {isAddingPin ? 'İptal' : 'Pin Ekle'}
         </button>
      </div>
      
      {tempPin && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 pointer-events-auto backdrop-blur-sm">
              <div className="bg-white p-4 rounded-xl shadow-2xl w-80 border border-gray-200">
                  <h3 className="font-bold mb-3 text-gray-800">Yeni Görev</h3>
                  <input autoFocus className="border border-gray-300 p-2 w-full mb-3 rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Görev Adı..." value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveTask()}/>
                  <div className="flex gap-2">
                      <button onClick={saveTask} className="bg-blue-600 text-white flex-1 py-2 rounded font-medium hover:bg-blue-700">Kaydet</button>
                      <button onClick={() => setTempPin(null)} className="bg-gray-200 text-gray-700 flex-1 py-2 rounded font-medium hover:bg-gray-300">İptal</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default ForgeViewer;