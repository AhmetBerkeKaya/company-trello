// src/components/Viewer/PlanUpload.js
import React, { useState, useEffect } from 'react';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
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
  
  // Yükleme Durumları
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState(''); // Kullanıcıya bilgi vermek için

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
    } catch (error) { 
        console.error('Veri çekme hatası', error); 
    } finally { 
        setLoading(false); 
    }
  };

  useEffect(() => { if (projectId) fetchInitialData(); }, [projectId]);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Desteklenen Uzantılar
    const validExtensions = [
        // Görsel & Doküman
        'jpg', 'jpeg', 'png', 'pdf', 
        // Web 3D
        'glb', 'gltf', 'obj', 'stl',
        // Autodesk Forge (CAD/BIM)
        'rvt', 'dwg', 'dxf', 'ipt', 'iam', 'f3d', 'ifc', 'nwc', 'skp', 'step', 'stp'
    ];
    
    const extension = file.name.split('.').pop().toLowerCase();

    if (!validExtensions.includes(extension)) {
      alert('Bu dosya formatı desteklenmemektedir.');
      return;
    }
    
    // 2GB Sınırı
    if (file.size > 2 * 1024 * 1024 * 1024) {
      alert('Dosya boyutu 2GB\'dan küçük olmalıdır');
      return;
    }

    setSelectedFile(file);
    setDescription('');
    setSelectedTaskId('');
    setUploadProgress(0);
    setUploadStatusText('');
    event.target.value = '';
  };

  const cancelUpload = () => {
    setSelectedFile(null);
    setDescription('');
    setSelectedTaskId('');
    setUploadProgress(0);
    setIsUploading(false);
    setUploadStatusText('');
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadStatusText('Yükleme başlatılıyor...');

    // 1. Dosya Uzantısını ve Tipini Belirle
    const extension = selectedFile.name.split('.').pop().toLowerCase();
    
    // Autodesk Forge destekleyen formatlar
    const forgeFormats = ['rvt', 'dwg', 'dxf', 'ipt', 'iam', 'f3d', 'ifc', 'nwc', 'skp', 'step', 'stp'];
    const isForgeFile = forgeFormats.includes(extension);

    let urn = null; // Autodesk ID'si (Varsa buraya dolacak)

    try {
        // --- ADIM A: EĞER CAD/BIM DOSYASIYSA AUTODESK'E GÖNDER ---
        if (isForgeFile) {
            setUploadStatusText('Autodesk sunucularına gönderiliyor ve çeviri başlatılıyor... (Bu işlem biraz sürebilir)');
            
            const formData = new FormData();
            formData.append('file', selectedFile);

            // Backend'deki /api/aps/upload endpoint'ine gönderiyoruz
            const apsResponse = await api.post('/aps/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    // Autodesk upload yüzdesi (0-50% arası gösterelim)
                    const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(Math.floor(percent / 2)); 
                }
            });

            if (apsResponse.data && apsResponse.data.urn) {
                urn = apsResponse.data.urn;
                console.log("✅ Autodesk URN alındı:", urn);
            } else {
                throw new Error("Autodesk URN üretilemedi.");
            }
        }

        // --- ADIM B: FIREBASE STORAGE'A YÜKLE (Yedekleme ve İndirme İçin) ---
        setUploadStatusText('Dosya sunucuya yedekleniyor...');
        
        const fileRef = ref(storage, `projects/${projectId}/plans/${Date.now()}_${selectedFile.name}`);
        const uploadTask = uploadBytesResumable(fileRef, selectedFile);

        uploadTask.on('state_changed', 
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            // Eğer Autodesk yüklemesi varsa %50'den başlat, yoksa %0'dan
            const baseProgress = isForgeFile ? 50 : 0;
            const factor = isForgeFile ? 0.5 : 1;
            setUploadProgress(baseProgress + Math.round(progress * factor));
          }, 
          (error) => {
            console.error('Firebase Yükleme hatası:', error);
            alert('Dosya yüklenirken hata oluştu.');
            setIsUploading(false);
          }, 
          async () => {
            // Yükleme Başarılı
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              
              // Veritabanı için Dosya Tipi
              let fileType = selectedFile.type;
              if (isForgeFile) fileType = 'application/cad';
              else if (!fileType) fileType = 'application/octet-stream';

              // --- ADIM C: VERİTABANINA KAYDET ---
              setUploadStatusText('Veritabanına kaydediliyor...');

              const planDoc = {
                name: selectedFile.name,
                url: downloadURL,
                size: selectedFile.size,
                type: fileType, 
                storagePath: uploadTask.snapshot.ref.fullPath,
                description: description,
                taskId: selectedTaskId || null,
                urn: urn // 👇 KRİTİK: Autodesk URN bilgisini gönderiyoruz!
              };

              await api.post(`/projects/${projectId}/plans`, planDoc);
              
              fetchInitialData();
              cancelUpload();
              alert('Dosya başarıyla yüklendi ve işlem sırasına alındı!');
            } catch (error) {
              console.error('DB Kayıt hatası:', error);
              alert('Dosya yüklendi ama veritabanına kaydedilemedi.');
            } finally {
              setIsUploading(false);
              setUploadStatusText('');
            }
          }
        );

    } catch (err) {
        console.error("Genel Yükleme Hatası:", err);
        alert("Yükleme sırasında bir hata oluştu: " + (err.response?.data?.message || err.message));
        setIsUploading(false);
        setUploadStatusText('');
    }
  };

  const handleDeletePlan = async (e, fileId, storagePath) => {
    e.stopPropagation();
    if (!window.confirm('Silmek istediğinize emin misiniz?')) return;
    try {
      await api.delete(`/files/${fileId}`);
      // Firebase'den de sil (Opsiyonel, yer kazanmak için iyi olur)
      if (storagePath) {
          const fileRef = ref(storage, storagePath);
          await deleteObject(fileRef).catch(console.warn);
      }
      setPlans(prev => prev.filter(p => p.file_id !== fileId));
    } catch (error) { 
        alert('Silme işlemi başarısız.'); 
    }
  };

  const getFileIcon = (name) => {
      const ext = name.split('.').pop().toLowerCase();
      if (['pdf'].includes(ext)) return '📄';
      if (['jpg', 'jpeg', 'png'].includes(ext)) return '🖼️';
      if (['glb', 'gltf', 'obj', 'stl'].includes(ext)) return '🧊';
      if (['rvt', 'dwg', 'dxf', 'ipt', 'iam', 'f3d', 'ifc', 'nwc'].includes(ext)) return '🏗️';
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
              accept=".jpg,.jpeg,.png,.pdf,.glb,.gltf,.obj,.stl,.rvt,.dwg,.dxf,.ipt,.iam,.f3d,.ifc,.nwc,.skp,.step,.stp"
            />
            <label
              htmlFor="plan-upload"
              className="block w-full border-2 border-dashed border-blue-300 dark:border-blue-800 rounded-lg p-4 text-center cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="text-2xl mb-1">☁️</div>
              <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">Dosya Yükle</span>
              <span className="block text-[10px] text-gray-400 mt-1 max-w-[220px] mx-auto">
                (PDF, Resim, RVT, DWG, IFC, IPT, IAM...)
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
                    placeholder="Açıklama (Opsiyonel)..." 
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
            
            {/* Progress Bar & Durum Metni */}
            {isUploading && (
                <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1 dark:text-gray-300 font-semibold">
                        <span>{uploadStatusText}</span>
                        <span>%{uploadProgress}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-600">
                        <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                </div>
            )}

            <div className="flex gap-2">
              <button onClick={handleUpload} disabled={isUploading} className="flex-1 bg-blue-600 text-white text-xs py-2 rounded disabled:opacity-50 hover:bg-blue-700 transition">
                {isUploading ? 'İşleniyor...' : 'Yükle ve Çevir'}
              </button>
              <button onClick={cancelUpload} disabled={isUploading} className="flex-1 bg-gray-300 text-gray-700 text-xs py-2 rounded hover:bg-gray-400 transition">İptal</button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {loading ? (
          <div className="text-center py-4"><LoadingSpinner size="small" /></div>
        ) : plans.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-4">Henüz dosya yüklenmemiş.</p>
        ) : (
          plans.map(plan => (
            <div 
              key={plan.file_id} 
              onClick={() => onSelectPlan && onSelectPlan(plan)}
              className={`p-2 rounded border cursor-pointer transition-all relative group
                ${selectedPlanId === plan.file_id 
                  ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500 dark:bg-blue-900/40 dark:border-blue-500' 
                  : 'bg-white dark:bg-gray-700/50 border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                  <span className="text-xl">{getFileIcon(plan.name)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate dark:text-gray-200">{plan.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                        {plan.is_current_version && <span className="text-[10px] bg-green-100 text-green-800 px-1.5 rounded-sm font-bold">v{plan.version}</span>}
                        {plan.urn && <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 rounded-sm font-bold">3D</span>}
                    </div>
                  </div>
                </div>
                <button 
                    onClick={(e) => handleDeletePlan(e, plan.file_id, plan.storage_path)} 
                    className="text-gray-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition opacity-0 group-hover:opacity-100"
                    title="Sil"
                >
                    🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PlanUpload;