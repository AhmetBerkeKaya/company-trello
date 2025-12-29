// src/components/Viewer/PlanUpload.js
import React, { useState, useEffect } from 'react';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'; // Chunk upload için Resumable eklendi
import { storage } from '../../firebase/config';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../UI/LoadingSpinner';

const PlanUpload = ({ projectId, onUploadSuccess, onSelectPlan, selectedPlanId }) => {
  const { userData } = useAuth();
  
  const [plans, setPlans] = useState([]);
  const [tasks, setTasks] = useState([]); 
  const [loading, setLoading] = useState(true);

  const [selectedFile, setSelectedFile] = useState(null);
  const [description, setDescription] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  
  // Yükleme Durumu (Progress Bar için)
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [plansRes, tasksRes] = await Promise.all([
        api.get(`/projects/${projectId}/plans`),
        api.get(`/projects/${projectId}/tasks`)
      ]);
      setPlans(plansRes.data);
      setTasks(tasksRes.data);
      if (onUploadSuccess) onUploadSuccess(plansRes.data);
    } catch (error) { console.error('Hata', error); } finally { setLoading(false); }
  };

  useEffect(() => { if (projectId) fetchInitialData(); }, [projectId]);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // GENİŞLETİLMİŞ FORMAT LİSTESİ (CAD ve Mühendislik Dosyaları Eklendi)
    const validExtensions = [
        // Görsel & Doküman
        'jpg', 'jpeg', 'png', 'pdf', 
        // Web Dostu 3D
        'glb', 'gltf', 'obj', 'ifc', 'stl',
        // Profesyonel CAD (Sadece Depolama)
        'rvt', 'dwg', 'dxf', 'ipt', 'iam', 'f3d', 'cad', 'step', 'stp'
    ];
    
    const extension = file.name.split('.').pop().toLowerCase();

    if (!validExtensions.includes(extension)) {
      alert('Bu dosya formatı desteklenmemektedir.');
      return;
    }
    
    // Büyük dosya desteği (Chunk upload sayesinde 2GB'a kadar çıkabiliriz)
    if (file.size > 2 * 1024 * 1024 * 1024) {
      alert('Dosya boyutu 2GB\'dan küçük olmalıdır');
      return;
    }

    setSelectedFile(file);
    setDescription('');
    setSelectedTaskId('');
    setUploadProgress(0);
    event.target.value = '';
  };

  const cancelUpload = () => {
    setSelectedFile(null);
    setDescription('');
    setSelectedTaskId('');
    setUploadProgress(0);
    setIsUploading(false);
  };

  // CHUNK / RESUMABLE UPLOAD
  const handleUpload = () => {
    if (!selectedFile) return;
    setIsUploading(true);

    const fileRef = ref(storage, `projects/${projectId}/plans/${Date.now()}_${selectedFile.name}`);
    
    // uploadBytesResumable: Dosyayı parçalara bölerek yükler, kesilirse devam edebilir
    const uploadTask = uploadBytesResumable(fileRef, selectedFile);

    uploadTask.on('state_changed', 
      (snapshot) => {
        // İlerleme yüzdesi hesaplama
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(Math.round(progress));
      }, 
      (error) => {
        console.error('Yükleme hatası:', error);
        alert('Yükleme başarısız oldu.');
        setIsUploading(false);
      }, 
      async () => {
        // Yükleme tamamlandı
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          
          // Dosya tipini belirleme
          const extension = selectedFile.name.split('.').pop().toLowerCase();
          let fileType = selectedFile.type;
          
          // Manuel Tip Atamaları
          if (['glb', 'gltf', 'obj', 'ifc', 'stl'].includes(extension)) fileType = `model/${extension}`;
          else if (['rvt', 'dwg', 'ipt', 'iam', 'f3d'].includes(extension)) fileType = `application/cad`; // Genel CAD tipi
          else if (!fileType) fileType = 'application/octet-stream';

          const planDoc = {
            name: selectedFile.name,
            url: downloadURL,
            size: selectedFile.size,
            type: fileType, 
            storagePath: uploadTask.snapshot.ref.fullPath,
            description: description,
            taskId: selectedTaskId || null
          };

          await api.post(`/projects/${projectId}/plans`, planDoc);
          
          fetchInitialData();
          cancelUpload();
          alert('Dosya başarıyla yüklendi!');
        } catch (error) {
          console.error('Veritabanı kayıt hatası:', error);
          alert('Dosya yüklendi ama veritabanına yazılamadı.');
        } finally {
          setIsUploading(false);
        }
      }
    );
  };

  const handleDeletePlan = async (e, fileId, storagePath) => {
    e.stopPropagation();
    if (!window.confirm('Silmek istediğinize emin misiniz?')) return;
    try {
      await api.delete(`/files/${fileId}`);
      const fileRef = ref(storage, storagePath);
      await deleteObject(fileRef).catch(console.warn);
      setPlans(prev => prev.filter(p => p.file_id !== fileId));
    } catch (error) { alert('Silinemedi.'); }
  };

  const getFileIcon = (name) => {
      const ext = name.split('.').pop().toLowerCase();
      if (['pdf'].includes(ext)) return '📄';
      if (['jpg', 'jpeg', 'png'].includes(ext)) return '🖼️';
      if (['glb', 'gltf', 'obj', 'ifc', 'stl'].includes(ext)) return '🧊';
      if (['rvt', 'dwg', 'dxf', 'ipt', 'iam', 'f3d'].includes(ext)) return '🏗️'; // CAD ikonu
      return '📁';
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow h-full flex flex-col">
      <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-4 border-b pb-2">📂 Proje Dosyaları</h3>
      
      <div className="mb-4">
        {!selectedFile ? (
          <>
            <input
              type="file"
              id="plan-upload"
              onChange={handleFileSelect}
              className="hidden"
              // Tüm uzantıları kabul et
              accept=".jpg,.jpeg,.png,.pdf,.glb,.gltf,.obj,.ifc,.stl,.rvt,.dwg,.dxf,.ipt,.iam,.f3d,.cad,.step,.stp"
            />
            <label
              htmlFor="plan-upload"
              className="block w-full border-2 border-dashed border-blue-300 dark:border-blue-800 rounded-lg p-4 text-center cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="text-2xl mb-1">☁️</div>
              <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">Dosya Yükle</span>
              <span className="block text-[10px] text-gray-400 mt-1 max-w-[200px] mx-auto">
                (PDF, Resim, 3D Model, DWG, RVT, IPT, IAM...)
              </span>
            </label>
          </>
        ) : (
          <div className="bg-blue-50 dark:bg-gray-700 p-3 rounded-lg border border-blue-200 dark:border-blue-900">
            <h4 className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-2 truncate">
              📄 {selectedFile.name}
            </h4>
            <div className="mb-2">
                <textarea 
                    value={description} 
                    onChange={e => setDescription(e.target.value)} 
                    placeholder="Açıklama..." 
                    className="w-full p-2 text-xs border rounded dark:bg-gray-600 dark:text-white" 
                />
            </div>
            <div className="mb-3">
              <select value={selectedTaskId} onChange={e => setSelectedTaskId(e.target.value)} className="w-full p-2 text-xs border rounded dark:bg-gray-600 dark:text-white">
                <option value="">-- İlişkili Görev (Opsiyonel) --</option>
                {tasks.filter(t => t.status !== 'todo').map(task => (
                    <option key={task.id} value={task.id}>{task.title}</option>
                ))}
              </select>
            </div>
            
            {/* Progress Bar */}
            {isUploading && (
                <div className="mb-2">
                    <div className="flex justify-between text-xs mb-1 dark:text-gray-300">
                        <span>Yükleniyor...</span>
                        <span>%{uploadProgress}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-600">
                        <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                </div>
            )}

            <div className="flex gap-2">
              <button onClick={handleUpload} disabled={isUploading} className="flex-1 bg-blue-600 text-white text-xs py-2 rounded disabled:opacity-50">
                {isUploading ? 'Yükleniyor...' : 'Yükle'}
              </button>
              <button onClick={cancelUpload} disabled={isUploading} className="flex-1 bg-gray-300 text-gray-700 text-xs py-2 rounded hover:bg-gray-400">İptal</button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {loading ? (
          <div className="text-center py-4"><LoadingSpinner size="small" /></div>
        ) : plans.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-4">Dosya yok.</p>
        ) : (
          plans.map(plan => (
            <div 
              key={plan.file_id} 
              onClick={() => onSelectPlan && onSelectPlan(plan)}
              className={`p-2 rounded border cursor-pointer transition-all
                ${selectedPlanId === plan.file_id 
                  ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500 dark:bg-blue-900/30' 
                  : 'bg-gray-50 dark:bg-gray-700/50 border-gray-100 dark:border-gray-700 hover:bg-gray-100'
                }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                  <span className="text-lg">{getFileIcon(plan.name)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate dark:text-gray-200">{plan.name}</p>
                    {plan.is_current_version && <span className="text-[10px] bg-green-100 text-green-800 px-1 rounded">v{plan.version}</span>}
                  </div>
                </div>
                <button onClick={(e) => handleDeletePlan(e, plan.file_id, plan.storage_path)} className="text-red-500 hover:bg-red-100 p-1 rounded">🗑️</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PlanUpload;