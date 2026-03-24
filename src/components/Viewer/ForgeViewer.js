/* global Autodesk */
import React, { useEffect, useRef, useState } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import TaskPin from './TaskPin'; 

const ForgeViewer = ({ urn, tasks, projectId, planFileId, onTaskCreated, projectMembers }) => {
  const viewerDivRef = useRef(null);
  const viewerRef = useRef(null);
  const { userData } = useAuth();
  
  const [overlayPins, setOverlayPins] = useState([]);
  const [isAddingPin, setIsAddingPin] = useState(false);
  const [tempPin, setTempPin] = useState(null);

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newAssignee, setNewAssignee] = useState('');

  const tasksRef = useRef(tasks);
  const planFileIdRef = useRef(planFileId);
  const isAddingPinRef = useRef(isAddingPin);

  useEffect(() => { 
      tasksRef.current = tasks; 
      planFileIdRef.current = planFileId;
      updatePinPositions(); 
  }, [tasks, planFileId]);

  useEffect(() => { isAddingPinRef.current = isAddingPin; }, [isAddingPin]);

  const getToken = async (callback) => {
    try { const res = await api.get('/aps/token'); callback(res.data.access_token, res.data.expires_in); } catch (err) {}
  };

  const updatePinPositions = () => {
      const viewer = viewerRef.current;
      if (!viewer || !window.THREE) return;
      const currentTasks = tasksRef.current.filter(t => t.plan_file_id === planFileIdRef.current);
      const newOverlays = currentTasks.map(task => {
          const z = task.pin_3d_data?.z || task.pin_z || 0;
          const vec = new window.THREE.Vector3(task.pin_x, task.pin_y, z);
          const pos = viewer.worldToClient(vec);
          let isVisible = true;
          try { isVisible = viewer.navigation.isPointVisible(vec); } catch(e) { }
          return { ...task, screenX: pos.x, screenY: pos.y, visible: isVisible };
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

      viewer.addEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, updatePinPositions);
      viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, updatePinPositions);
      
      viewer.container.addEventListener('click', (event) => {
          if (!isAddingPinRef.current) return; 
          const rect = viewer.container.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          
          const result = viewer.impl.hitTest(x, y, true);
          if (result && result.intersectPoint) {
              setTempPin({ point: result.intersectPoint, viewerState: viewer.getState({ viewport: true }), screenX: x, screenY: y });
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

  const handleDeleteTask = async (task) => {
    if(!window.confirm('Bu pini silmek istediğinize emin misiniz?')) return;
    try { await api.delete(`/tasks/${task.task_id || task.id}`); if (onTaskCreated) onTaskCreated(); } 
    catch(e) { alert('Silinemedi'); }
  };

  const saveTask = async () => {
    if (!newTaskTitle.trim() || !tempPin) return;
    try {
        await api.post('/tasks', {
            title: newTaskTitle, description: newTaskDesc, assignee: newAssignee,
            status: 'todo', projectId, planFileId,
            pinX: tempPin.point.x, pinY: tempPin.point.y, 
            pin3dData: { z: tempPin.point.z, viewerState: tempPin.viewerState },
            isVisibleToClient: userData?.role === 'client'
        });
        setTempPin(null); setNewTaskTitle(''); setNewTaskDesc(''); setNewAssignee('');
        if (onTaskCreated) onTaskCreated();
    } catch (error) { alert('Hata: ' + error.message); }
  };

  return (
    <div className="relative w-full h-full group overflow-hidden bg-gray-100">
      <div ref={viewerDivRef} className="w-full h-full" />

      <div className="absolute inset-0 pointer-events-none z-10 w-full h-full overflow-hidden">
          {overlayPins.map(pin => (
              pin.visible && (
                <TaskPin 
                    key={pin.task_id || pin.id} task={pin} onDelete={handleDeleteTask}
                    style={{ position: 'absolute', left: pin.screenX, top: pin.screenY, transform: 'translate(-50%, -50%)', pointerEvents: 'auto' }}
                    onClick={(t) => { if(viewerRef.current && t.pin_3d_data?.viewerState) viewerRef.current.restoreState(t.pin_3d_data.viewerState); }}
                />
              )
          ))}
      </div>

      <div className="absolute top-4 left-4 z-50 pointer-events-auto">
         <button onClick={() => setIsAddingPin(!isAddingPin)} className={`px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl transition-colors ${isAddingPin ? 'bg-red-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
            {isAddingPin ? 'İptal Et' : '📍 Yeni Pin Ekle'}
         </button>
      </div>
      
      {tempPin && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 pointer-events-auto backdrop-blur-sm animate-fade-in">
              <div className="bg-white p-8 rounded-3xl shadow-2xl w-80 animate-slide-in">
                  <h3 className="font-black text-gray-800 text-center mb-6 uppercase tracking-widest text-sm">YENİ 3D PİN EKLE</h3>
                  <input autoFocus className="w-full border-b border-gray-200 pb-3 mb-5 text-sm focus:border-blue-500 outline-none transition-colors font-semibold" placeholder="Görev Başlığı *" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} />
                  <textarea className="w-full border border-gray-200 rounded-xl p-3 mb-5 text-xs focus:border-blue-500 outline-none resize-none h-20 transition-colors custom-scrollbar" placeholder="Açıklama ve detaylar (Opsiyonel)" value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} />
                  <select className="w-full border border-gray-200 rounded-xl p-3 mb-6 text-xs focus:border-blue-500 outline-none transition-colors bg-gray-50" value={newAssignee} onChange={e => setNewAssignee(e.target.value)}>
                     <option value="">Atanacak Kişiyi Seçin...</option>
                     {projectMembers.map(m => <option key={m.user_id} value={m.user_id}>{m.name} ({m.role})</option>)}
                  </select>
                  <div className="flex gap-3">
                      <button onClick={saveTask} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-95 transition-all">Kaydet</button>
                      <button onClick={() => {setTempPin(null); setNewTaskTitle(''); setNewTaskDesc(''); setNewAssignee('');}} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 active:scale-95 transition-all">İptal</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default ForgeViewer;