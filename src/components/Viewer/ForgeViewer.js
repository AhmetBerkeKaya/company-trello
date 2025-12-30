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
  const [loadingMsg, setLoadingMsg] = useState('Autodesk Viewer Başlatılıyor...');

  // Token Alma
  const getToken = async (callback) => {
    try {
      const res = await api.get('/aps/token');
      callback(res.data.access_token, res.data.expires_in);
    } catch (err) {
      console.error("Token Hatası:", err);
    }
  };

  useEffect(() => {
    if (!window.Autodesk || !viewerDivRef.current || viewerRef.current) return;

    const options = {
      env: 'AutodeskProduction',
      api: 'derivativeV2',
      getAccessToken: getToken,
    };

    Autodesk.Viewing.Initializer(options, () => {
      const viewer = new Autodesk.Viewing.GuiViewer3D(viewerDivRef.current);
      viewer.start();
      viewerRef.current = viewer;
      
      // Hata yakalama
      viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, () => {
          setLoadingMsg(''); // Yükleme bitti, yazıyı kaldır
      });

      const documentId = 'urn:' + urn;
      
      Autodesk.Viewing.Document.load(documentId, (doc) => {
        // 👇 GÜNCELLEME: Senin orijinal kodundaki daha sağlam geometri bulma yöntemi
        const rootNode = doc.getRoot();
        
        // 1. Önce 3D Geometri Ara
        const viewables = rootNode.search({ type: 'geometry', role: '3d' });
        
        // 2. Bulamazsa Varsayılanı Dene
        let modelNode = viewables.length > 0 ? viewables[0] : rootNode.getDefaultGeometry();

        if (!modelNode) {
            console.error("⚠️ Model geometrisi bulunamadı. Çeviri işlemi devam ediyor olabilir.");
            setLoadingMsg("Model işleniyor... Lütfen biraz bekleyip sayfayı yenileyin.");
            return;
        }

        viewer.loadDocumentNode(doc, modelNode).then((model) => {
             console.log("✅ Model yüklendi");
             drawPins(tasks, viewer);
        }).catch(err => {
            console.error("Node yükleme hatası:", err);
            setLoadingMsg("Model açılırken hata oluştu.");
        });

      }, (errorCode, errorMsg) => {
          console.error("Manifest Yükleme Hatası:", errorCode, errorMsg);
          setLoadingMsg("Autodesk belgesi yüklenemedi (Erişim hatası veya çeviri bitmedi).");
      });

      // Tıklama Listener
      viewer.container.addEventListener('click', handleCanvasClick);
    });

    return () => {
      if (viewerRef.current) {
        viewerRef.current.finish();
        viewerRef.current = null;
      }
    };
  }, [urn]);

  // --- PIN ÇİZME ---
  const drawPins = (taskList, viewer) => {
    if (!viewer || !viewer.overlays) return;
    const overlayName = 'custom-pins-overlay';
    if (!viewer.overlays.hasScene(overlayName)) viewer.overlays.addScene(overlayName);
    viewer.overlays.clearScene(overlayName);

    taskList.forEach(task => {
        if(task.plan_file_id !== planFileId) return;

        const geometry = new THREE.SphereGeometry(2, 32, 32); // Boyutu sahneye göre ayarlanabilir
        const material = new THREE.MeshBasicMaterial({ color: task.status === 'completed' ? 0x10B981 : 0xEF4444 });
        const sphere = new THREE.Mesh(geometry, material);
        
        // Z koordinatı kontrolü
        const z = (task.pin_3d_data && task.pin_3d_data.z) ? task.pin_3d_data.z : 0;
        sphere.position.set(task.pin_x, task.pin_y, z);
        
        viewer.overlays.addMesh(sphere, overlayName);
    });
    viewer.impl.invalidate(true);
  };

  useEffect(() => { if (viewerRef.current) drawPins(tasks, viewerRef.current); }, [tasks]);

  // --- TIKLAMA VE KAYDETME ---
  const handleCanvasClick = (event) => {
    if (!viewerRef.current || !window.isPinModeActive) return;
    
    const viewer = viewerRef.current;
    const result = viewer.impl.hitTest(event.clientX, event.clientY, true);
    
    if (result) {
        setNewPinTempData(result.intersectPoint);
    }
  };

  const saveTask = async () => {
    if (!newTaskTitle.trim() || !newPinTempData) return;
    try {
        await api.post('/tasks', {
            title: newTaskTitle, status: 'todo', projectId, planFileId,
            pinX: newPinTempData.x, pinY: newPinTempData.y, pin3dData: { z: newPinTempData.z },
            isVisibleToClient: userData?.role === 'client'
        });
        setNewPinTempData(null); setNewTaskTitle(''); setIsAddingPin(false); window.isPinModeActive = false;
        if (onTaskCreated) onTaskCreated();
    } catch (error) { alert('Hata: ' + error.message); }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {loadingMsg && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50 text-white flex-col">
              <div className="text-xl mb-2">🏗️</div>
              <p>{loadingMsg}</p>
          </div>
      )}

      <div ref={viewerDivRef} style={{ width: '100%', height: '100%' }} />

      <div className="absolute top-4 left-4 z-40 flex gap-2">
         <button 
            onClick={() => {
                const isActive = !isAddingPin;
                setIsAddingPin(isActive);
                window.isPinModeActive = isActive; 
            }}
            className={`px-4 py-2 rounded shadow text-white font-bold transition ${isAddingPin ? 'bg-red-600' : 'bg-blue-600'}`}
         >
            {isAddingPin ? '📍 İptal Et' : '📍 Pin Ekle'}
         </button>
      </div>

      {newPinTempData && (
         <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-4 rounded-lg shadow-2xl z-50 w-64">
            <h3 className="text-sm font-bold mb-2 text-black">Yeni Görev</h3>
            <input autoFocus className="w-full border p-2 mb-2 text-sm rounded text-black" placeholder="Görev adı..." value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} />
            <div className="flex gap-2">
                <button onClick={saveTask} className="flex-1 bg-green-600 text-white py-1 rounded text-sm">Kaydet</button>
                <button onClick={() => setNewPinTempData(null)} className="flex-1 bg-gray-300 text-gray-700 py-1 rounded text-sm">Vazgeç</button>
            </div>
         </div>
      )}
    </div>
  );
};

export default ForgeViewer;