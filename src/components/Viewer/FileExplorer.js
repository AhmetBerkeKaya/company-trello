// src/components/Viewer/FileExplorer.js
import React, { useState, useEffect } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase/config';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../UI/LoadingSpinner';

const getIcon = (file) => {
  if (file.is_folder) return '📁';
  const ext = file.name.split('.').pop().toLowerCase();
  if (file.urn) return '🧊'; 
  if (['pdf'].includes(ext)) return '📄';
  if (['jpg', 'jpeg', 'png'].includes(ext)) return '🖼️';
  return '📃';
};

const FileExplorer = ({ projectId, onSelectPlan, selectedPlanId, onUploadSuccess }) => {
  const { userData } = useAuth();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Klasör Gezinme State'leri
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);

  // Yeni Klasör UI State'i
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Versiyon Geçmişi Modalı State'i
  const [showHistoryFor, setShowHistoryFor] = useState(null); 

  // Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState('');

  // ROL KONTROLÜ
  const isObserver = userData?.role === 'observer';

  useEffect(() => {
    if (projectId) fetchFiles();
  }, [projectId]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/projects/${projectId}/plans`);
      setFiles(res.data);
      if (onUploadSuccess) onUploadSuccess(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // --- KLASÖR OLUŞTURMA ---
  const startCreateFolder = () => {
    if (isObserver) return; // Gözlemci oluşturamaz
    setIsCreatingFolder(true);
    setNewFolderName('');
  };

  const handleCreateFolderConfirm = async () => {
    if (!newFolderName.trim()) { setIsCreatingFolder(false); return; }

    const selectedItem = files.find(f => f.file_id === selectedItemId);
    let targetParentId = currentFolderId;
    if (selectedItem && selectedItem.is_folder) { targetParentId = selectedItem.file_id; }

    try {
      await api.post(`/projects/${projectId}/folders`, {
        name: newFolderName,
        parentFolderId: targetParentId
      });
      setIsCreatingFolder(false);
      setNewFolderName('');
      fetchFiles(); 
    } catch (e) {
      alert("Klasör oluşturulamadı: " + (e.response?.data?.message || e.message));
    }
  };

  // --- DOSYA YÜKLEME ---
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsUploading(true);
    setUploadStatusText('Yükleme Başlıyor...');

    const selectedItem = files.find(f => f.file_id === selectedItemId);
    let targetParentId = currentFolderId;
    if (selectedItem && selectedItem.is_folder) { targetParentId = selectedItem.file_id; }

    const extension = file.name.split('.').pop().toLowerCase();
    const isForgeFile = !['jpg', 'jpeg', 'png', 'pdf'].includes(extension);
    let urn = null;

    try {
      if (isForgeFile) {
        setUploadStatusText('3D Model İşleniyor...');
        const formData = new FormData();
        formData.append('file', file);
        const apsRes = await api.post('/aps/upload', formData);
        urn = apsRes.data.urn;
      }

      setUploadStatusText('Buluta Yükleniyor...');
      const storageRefPath = `projects/${projectId}/plans/${targetParentId || 'root'}/${Date.now()}_${file.name}`;
      const fileRef = ref(storage, storageRefPath);
      const uploadTask = uploadBytesResumable(fileRef, file);
      
      uploadTask.on('state_changed',
        (snapshot) => {
           const prog = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
           setUploadProgress(Math.round(prog));
        },
        (error) => { throw error; },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setUploadStatusText('Kaydediliyor...');
          
          await api.post(`/projects/${projectId}/plans`, {
            name: file.name,
            url: downloadURL,
            size: file.size,
            type: file.type || 'application/octet-stream',
            storagePath: storageRefPath,
            urn: urn,
            parentFolderId: targetParentId 
          });
          
          setIsUploading(false);
          setUploadStatusText('');
          fetchFiles();
        }
      );
    } catch (error) {
      console.error(error);
      alert('Yükleme hatası: ' + error.message);
      setIsUploading(false);
    }
  };

  // --- ETKİLEŞİM ---
  const handleItemClick = (file) => {
      setSelectedItemId(file.file_id);
      if (!file.is_folder) onSelectPlan && onSelectPlan(file);
  };

  const handleItemDoubleClick = (file) => {
      if (file.is_folder) {
          setCurrentFolderId(file.file_id);
          setSelectedItemId(null);
      }
  };

  const handleGoUp = () => {
      const currentFolderObj = files.find(f => f.file_id === currentFolderId);
      setCurrentFolderId(currentFolderObj ? currentFolderObj.parent_folder_id : null);
  };

  // --- SÜRÜKLE BIRAK (GÖZLEMCİYE KAPALI) ---
  const handleDragStart = (e, fileId) => {
      if (isObserver) return; // Engelle
      e.dataTransfer.setData("fileId", fileId);
  };
  const handleDrop = async (e, targetId) => {
    e.preventDefault(); 
    e.stopPropagation();
    if (isObserver) return; // Engelle

    const fileId = e.dataTransfer.getData("fileId");
    if (!fileId || fileId === targetId) return;
    try {
        await api.put(`/files/${fileId}/move`, { targetFolderId: targetId });
        fetchFiles();
    } catch (error) { console.error("Taşıma hatası", error); }
  };
  const handleDragOver = (e) => e.preventDefault();

  // --- RENDER HELPERS ---
  const getBreadcrumbs = () => {
    const path = [];
    let curr = files.find(f => f.file_id === currentFolderId);
    while (curr) {
        path.unshift(curr);
        curr = files.find(f => f.file_id === curr.parent_folder_id);
    }
    return (
        <div className="flex items-center text-xs text-gray-500 mb-2 overflow-x-auto whitespace-nowrap h-6">
            <span className="cursor-pointer hover:text-blue-600 font-bold" onClick={() => setCurrentFolderId(null)}>Ana Dizin</span>
            {path.map(folder => (
                <React.Fragment key={folder.file_id}>
                    <span className="mx-1">/</span>
                    <span className="cursor-pointer hover:text-blue-600" onClick={() => setCurrentFolderId(folder.file_id)}>{folder.name}</span>
                </React.Fragment>
            ))}
        </div>
    );
  };

  const currentFiles = files.filter(f => 
      f.parent_folder_id === currentFolderId && 
      (f.is_folder || f.is_current_version) 
  ).sort((a, b) => (a.is_folder === b.is_folder ? 0 : a.is_folder ? -1 : 1));

  const getFileHistory = (file) => {
      return files
        .filter(f => f.name === file.name && !f.is_folder && f.parent_folder_id === file.parent_folder_id)
        .sort((a, b) => b.version - a.version); 
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow h-full flex flex-col select-none relative">
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-2 pb-2 border-b dark:border-gray-700">
        <h3 className="font-bold text-gray-700 dark:text-gray-200 text-sm">Proje Dosyaları</h3>
        <div className="flex gap-1">
            {/* Gözlemci Değilse Butonları Göster */}
            {!isObserver ? (
                <>
                    <button onClick={startCreateFolder} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300" title="Yeni Klasör">📁+</button>
                    <label className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer text-gray-600 dark:text-gray-300" title="Dosya Yükle">
                        ☁️+
                        <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                    </label>
                </>
            ) : (
                <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded dark:bg-gray-700">İzleme Modu</span>
            )}
        </div>
      </div>

      {/* NAV */}
      <div className="flex items-center gap-2 min-h-[24px]">
          {currentFolderId && <button onClick={handleGoUp} className="text-lg hover:bg-gray-100 rounded px-1">🔙</button>}
          {getBreadcrumbs()}
      </div>

      {/* PROGRESS */}
      {isUploading && (
          <div className="my-2 bg-blue-50 text-blue-800 text-[10px] p-1 rounded border border-blue-200 flex justify-between">
              <span>{uploadStatusText}</span><span>%{uploadProgress}</span>
          </div>
      )}

      {/* LISTE */}
      <div className="flex-1 overflow-y-auto custom-scrollbar mt-2" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, currentFolderId)}>
        
        {isCreatingFolder && (
            <div className="flex items-center p-2 border border-blue-400 bg-blue-50 rounded mb-1">
                <span className="mr-2">📁</span>
                <input autoFocus type="text" className="flex-1 bg-transparent border-b border-blue-300 focus:outline-none text-sm"
                    value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateFolderConfirm()}
                />
                <button onClick={handleCreateFolderConfirm} className="text-green-600 ml-2 text-xs font-bold">✓</button>
                <button onClick={() => setIsCreatingFolder(false)} className="text-red-500 ml-2 text-xs">✕</button>
            </div>
        )}

        {loading ? <LoadingSpinner size="small"/> : (
            currentFiles.length === 0 && !isCreatingFolder ? (
                <div className="text-center text-gray-400 text-xs py-10">Bu klasör boş</div>
            ) : (
                <div className="space-y-0.5">
                    {currentFiles.map(file => {
                        const isSelected = selectedItemId === file.file_id;
                        const isActivePlan = !file.is_folder && selectedPlanId === file.file_id;

                        return (
                            <div key={file.file_id}
                                draggable={!isObserver} // Gözlemci taşıyamaz
                                onDragStart={(e) => handleDragStart(e, file.file_id)}
                                onDrop={(e) => file.is_folder ? handleDrop(e, file.file_id) : null} onDragOver={handleDragOver}
                                onClick={() => handleItemClick(file)} onDoubleClick={() => handleItemDoubleClick(file)}
                                className={`flex items-center justify-between p-2 rounded cursor-pointer border border-transparent text-sm group
                                    ${isSelected ? 'bg-blue-100 dark:bg-blue-900 border-blue-300' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}
                                    ${isActivePlan && !isSelected ? 'bg-gray-100 dark:bg-gray-700 border-gray-300' : ''}
                                `}
                            >
                                <div className="flex items-center gap-2 truncate flex-1">
                                    <span className="text-lg">{getIcon(file)}</span>
                                    <span className={`truncate ${file.is_folder ? 'font-medium' : ''}`}>{file.name}</span>
                                    {!file.is_folder && (
                                        <span className="text-[10px] bg-gray-200 dark:bg-gray-600 px-1 rounded text-gray-600 dark:text-gray-300">
                                            v{file.version}
                                        </span>
                                    )}
                                </div>
                                
                                {/* Geçmiş Butonu (Sadece dosyalarda) */}
                                {!file.is_folder && (
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowHistoryFor(file);
                                        }}
                                        className="p-1 hover:bg-white rounded-full text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Versiyon Geçmişi"
                                    >
                                        🕒
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )
        )}
      </div>

      {/* --- VERSİYON GEÇMİŞİ MODALI --- */}
      {showHistoryFor && (
          <div className="absolute inset-0 bg-white dark:bg-gray-800 z-10 flex flex-col p-4 rounded-lg animate-in fade-in slide-in-from-bottom-4 duration-200">
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                  <h4 className="font-bold text-sm truncate pr-2">Geçmiş: {showHistoryFor.name}</h4>
                  <button onClick={() => setShowHistoryFor(null)} className="text-gray-500 hover:text-red-500">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                  {getFileHistory(showHistoryFor).map(verFile => (
                      <div key={verFile.file_id} 
                           onClick={() => {
                               onSelectPlan && onSelectPlan(verFile);
                               setShowHistoryFor(null); // Seçince modalı kapat
                           }}
                           className={`p-2 rounded border text-sm flex justify-between items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700
                           ${verFile.is_current_version ? 'bg-green-50 border-green-200 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700 opacity-75'}
                           `}
                      >
                          <div>
                              <span className="font-bold mr-2">v{verFile.version}</span>
                              <span className="text-xs text-gray-500">
                                  {new Date(verFile.uploaded_at || verFile.created_at).toLocaleDateString('tr-TR')}
                              </span>
                          </div>
                          {verFile.is_current_version && <span className="text-[10px] bg-green-100 text-green-800 px-1 rounded">Güncel</span>}
                      </div>
                  ))}
              </div>
          </div>
      )}

      <div className="text-[10px] text-gray-400 text-center mt-1 border-t pt-1">
         {!isObserver ? 'Aynı isimle yüklenen dosyalar versiyonlanır' : 'Dosya yükleme yetkiniz yok'}
      </div>
    </div>
  );
};

export default FileExplorer;