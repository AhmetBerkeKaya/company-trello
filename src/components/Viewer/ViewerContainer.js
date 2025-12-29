// src/components/Viewer/ViewerContainer.js
import React, { useState, useEffect } from 'react';
import PlanUpload from './PlanUpload';
import ImageMapper from './ImageMapper';
import PDFMapper from './PDFMapper';
import ThreeDMapper from './ThreeDMapper';
import api from '../../api/axios';
import LoadingSpinner from '../UI/LoadingSpinner'; // Spinner importu

const ViewerContainer = ({ projectId }) => {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [tasks, setTasks] = useState([]);

  // Dosya durumunu canlı takip etmek için polling (süreli kontrol) yapabiliriz
  useEffect(() => {
    let interval;
    if (selectedPlan && (selectedPlan.conversion_status === 'pending' || selectedPlan.conversion_status === 'processing')) {
        interval = setInterval(async () => {
            try {
                // Dosyanın güncel durumunu çek
                // (Bunun için backend'de tekil dosya getiren endpoint lazım veya listeyi yenileyebiliriz)
                // Basitlik için listeyi yenileyen bir fonksiyon varmış gibi davranacağız 
                // veya PlanUpload'dan gelen yenileme sinyalini kullanacağız.
                // Şimdilik kullanıcıya "Sayfayı yenile" dedirtmemek için basit bir reload:
                const res = await api.get(`/files/${selectedPlan.file_id}`); // Bu endpoint'i fileController'a eklemeliyiz*
                if (res.data.conversion_status === 'completed') {
                    setSelectedPlan(res.data);
                    clearInterval(interval);
                }
            } catch (e) { clearInterval(interval); }
        }, 3000); // 3 saniyede bir kontrol et
    }
    return () => clearInterval(interval);
  }, [selectedPlan]);

  const fetchTasks = async () => {
    try {
      const response = await api.get(`/projects/${projectId}/tasks`);
      setTasks(response.data);
    } catch (error) { console.error('Görevler yüklenemedi:', error); }
  };

  useEffect(() => { if (projectId) fetchTasks(); }, [projectId]);

  const renderMapper = () => {
    if (!selectedPlan) return <div className="h-full flex items-center justify-center text-gray-400"><p>Dosya seçin</p></div>;

    // 0. DÖNÜŞTÜRME DURUMU KONTROLÜ (YENİ)
    if (selectedPlan.conversion_status === 'pending' || selectedPlan.conversion_status === 'processing') {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800/50">
                <LoadingSpinner size="large" />
                <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 mt-4">Dosya İşleniyor...</h3>
                <p className="text-sm text-gray-500 mt-2">Bu dosya 3D görüntüleme için optimize ediliyor.</p>
                <p className="text-xs text-gray-400 mt-1">Bu işlem dosya boyutuna göre birkaç dakika sürebilir.</p>
            </div>
        );
    }
    
    if (selectedPlan.conversion_status === 'failed') {
        return (
            <div className="h-full flex flex-col items-center justify-center text-red-500">
                <span className="text-4xl mb-2">⚠️</span>
                <p>Dönüştürme Başarısız Oldu.</p>
                <a href={selectedPlan.url} className="mt-4 text-blue-600 underline text-sm">Orijinal dosyayı indir</a>
            </div>
        );
    }

    // Eğer dönüştürme bittiyse ve elimizde converted_url varsa onu göster, yoksa orijinal url
    const displayUrl = selectedPlan.converted_url || selectedPlan.url;
    const name = selectedPlan.name.toLowerCase();

    // 1. 3D MODELLER (Artık converted_url ile çalışabilir)
    // Eğer orijinali CAD ise ama converted_url varsa (glb), 3D Mapper'ı aç
    if (name.match(/\.(glb|gltf|obj|ifc|stl)$/) || (selectedPlan.converted_url && selectedPlan.converted_url.endsWith('.glb'))) {
      return (
        <ThreeDMapper 
          plan={{...selectedPlan, url: displayUrl, name: selectedPlan.converted_url ? 'converted.glb' : selectedPlan.name}} // İsmi GLB gibi göster ki mapper anlasın
          projectId={projectId}
          tasks={tasks}
          onTaskCreated={fetchTasks}
        />
      );
    }

    // 2. PDF
    if (selectedPlan.type.includes('pdf')) {
      return <PDFMapper plan={selectedPlan} projectId={projectId} tasks={tasks} onTaskCreated={fetchTasks} onTaskUpdate={fetchTasks} />;
    }

    // 3. Resim
    if (name.match(/\.(jpg|jpeg|png)$/)) {
      return <ImageMapper plan={selectedPlan} projectId={projectId} tasks={tasks} onTaskCreated={fetchTasks} />;
    }

    // 4. DESTEKLENMEYEN / İNDİRİLEBİLİR
    return (
        <div className="h-full flex flex-col items-center justify-center text-gray-500 bg-gray-50 dark:bg-gray-800/50">
            <div className="text-6xl mb-4">🏗️</div>
            <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300">Görüntüleme Hazır Değil</h3>
            <p className="text-sm mt-2 mb-6 max-w-md text-center">
                Bu dosya ({name}) şu an için sadece indirilebilir.
                {/* Eğer entegrasyonu tamamlarsak burada "3D Önizleme" butonu çıkacak */}
            </p>
            <a href={selectedPlan.url} target="_blank" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-colors">
                ⬇️ Dosyayı İndir
            </a>
        </div>
    );
  };

  return (
    // ... (Aynen kalıyor)
    <div className="flex flex-col md:flex-row h-[calc(100vh-200px)] gap-4">
      <div className="w-full md:w-1/4 h-full min-w-[300px]">
        <PlanUpload 
          projectId={projectId} 
          onSelectPlan={(plan) => setSelectedPlan(plan)}
          selectedPlanId={selectedPlan?.file_id}
          onUploadSuccess={(data) => {
             // Upload sonrası listeyi yenileyince seçili planı güncellemek gerekebilir
          }}
        />
      </div>

      <div className="flex-1 bg-gray-100 dark:bg-gray-900 rounded-lg border border-gray-300 relative overflow-hidden flex flex-col">
        {selectedPlan && (
            <div className="bg-white p-2 border-b flex justify-between items-center shadow-sm z-20">
              <span className="font-semibold text-sm">
                 {selectedPlan.conversion_status === 'processing' ? '⏳ ' : ''}
                 {selectedPlan.name}
              </span>
              <a href={selectedPlan.url} target="_blank" className="text-xs text-blue-600 font-medium">Orijinali İndir</a>
            </div>
        )}
        <div className="flex-1 relative overflow-hidden w-full h-full">
          {renderMapper()}
        </div>
      </div>
    </div>
  );
};

export default ViewerContainer;