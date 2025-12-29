// src/components/Viewer/PlanUpload.js
import React, { useState, useEffect } from 'react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
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
  const [uploading, setUploading] = useState(false);

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
      console.error('Veri getirme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchInitialData();
    }
  }, [projectId]);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      alert('Sadece JPG, PNG veya PDF yükleyebilirsiniz.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Dosya boyutu 10MB\'dan küçük olmalıdır');
      return;
    }

    setSelectedFile(file);
    setDescription('');
    setSelectedTaskId('');
    event.target.value = '';
  };

  const cancelUpload = () => {
    setSelectedFile(null);
    setDescription('');
    setSelectedTaskId('');
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const fileRef = ref(storage, `projects/${projectId}/plans/${Date.now()}_${selectedFile.name}`);
      const snapshot = await uploadBytes(fileRef, selectedFile);
      const downloadURL = await getDownloadURL(snapshot.ref);

      const planDoc = {
        name: selectedFile.name,
        url: downloadURL,
        size: selectedFile.size,
        type: selectedFile.type,
        storagePath: snapshot.ref.fullPath,
        description: description,
        taskId: selectedTaskId || null
      };

      await api.post(`/projects/${projectId}/plans`, planDoc);
      
      fetchInitialData();
      cancelUpload();
      alert('Pafta ve detaylar başarıyla kaydedildi!');

    } catch (error) {
      console.error('Yükleme hatası:', error);
      alert('Hata: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePlan = async (e, fileId, storagePath) => {
    e.stopPropagation();
    if (!window.confirm('Bu paftayı silmek istediğinize emin misiniz?')) return;

    try {
      await api.delete(`/files/${fileId}`);
      const fileRef = ref(storage, storagePath);
      await deleteObject(fileRef).catch(console.warn);
      setPlans(prev => prev.filter(p => p.file_id !== fileId));
    } catch (error) {
      console.error('Silme hatası:', error);
      alert('Silinemedi.');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow h-full flex flex-col">
      <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-4 border-b pb-2">📂 Proje Paftaları</h3>
      
      <div className="mb-4">
        {!selectedFile ? (
          <>
            <input
              type="file"
              id="plan-upload"
              onChange={handleFileSelect}
              className="hidden"
              accept=".jpg,.jpeg,.png,.pdf"
            />
            <label
              htmlFor="plan-upload"
              className="block w-full border-2 border-dashed border-blue-300 dark:border-blue-800 rounded-lg p-4 text-center cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="text-2xl mb-1">🗺️</div>
              <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">Yeni Pafta Yükle</span>
            </label>
          </>
        ) : (
          <div className="bg-blue-50 dark:bg-gray-700 p-3 rounded-lg border border-blue-200 dark:border-blue-900">
            <h4 className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-2 truncate">
              📄 {selectedFile.name}
            </h4>

            <div className="mb-2">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Açıklama</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Örn: Zemin kat elektrik planı revize..."
                className="w-full p-2 text-xs border rounded dark:bg-gray-600 dark:text-white dark:border-gray-500"
                rows="2"
              />
            </div>

            <div className="mb-3">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">İlişkili Görev (Opsiyonel)</label>
              <select
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                className="w-full p-2 text-xs border rounded dark:bg-gray-600 dark:text-white dark:border-gray-500"
              >
                <option value="">-- Bir Görev Seçin --</option>
                {/* DÜZELTME: 'todo' gizlendi ve sadece Başlık gösteriliyor */}
                {tasks
                  .filter(task => task.status !== 'todo')
                  .map(task => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={handleUpload} 
                disabled={uploading}
                className="flex-1 bg-blue-600 text-white text-xs py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {uploading ? 'Yükleniyor...' : 'Kaydet ve Yükle'}
              </button>
              <button 
                onClick={cancelUpload}
                disabled={uploading}
                className="flex-1 bg-gray-300 text-gray-700 text-xs py-2 rounded hover:bg-gray-400"
              >
                İptal
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {loading ? (
          <div className="text-center py-4"><LoadingSpinner size="small" /></div>
        ) : plans.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-4">Henüz pafta yüklenmemiş.</p>
        ) : (
          plans.map(plan => (
            <div 
              key={plan.file_id} 
              onClick={() => onSelectPlan && onSelectPlan(plan)}
              className={`p-2 rounded border cursor-pointer transition-all
                ${selectedPlanId === plan.file_id 
                  ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500 dark:bg-blue-900/30 dark:border-blue-400' 
                  : 'bg-gray-50 dark:bg-gray-700/50 border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                  <span className="text-lg">{plan.type.includes('pdf') ? '📄' : '🖼️'}</span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium truncate ${selectedPlanId === plan.file_id ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200'}`} title={plan.name}>
                      {plan.name}
                    </p>
                    {plan.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        📝 {plan.description}
                      </p>
                    )}
                    {plan.task_id && (
                       <span className="inline-block bg-purple-100 text-purple-700 text-[10px] px-1 rounded mt-1">
                         🔗 Bir göreve bağlı
                       </span>
                    )}
                  </div>
                </div>
                
                <button 
                  onClick={(e) => handleDeletePlan(e, plan.file_id, plan.storage_path)} 
                  className="p-1 hover:bg-red-100 text-red-500 rounded ml-2" 
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