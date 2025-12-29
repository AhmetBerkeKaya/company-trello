// src/components/Kanban/FileUpload.js
import React, { useState } from 'react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../../firebase/config';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../UI/LoadingSpinner';

const FileUpload = ({ taskId, projectId }) => {
  const { userData } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Hangi dosyanın geçmişinin açık olduğunu tutan state
  const [expandedFileId, setExpandedFileId] = useState(null);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { // 50MB'a çıkardık
      alert('Dosya boyutu 50MB\'dan küçük olmalıdır');
      return;
    }

    setUploading(true);
    try {
      const fileRef = ref(storage, `projects/${projectId}/tasks/${taskId}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(fileRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      const fileDoc = {
        name: file.name,
        url: downloadURL,
        size: file.size,
        type: file.type,
        taskId: taskId,
        projectId: projectId,
        storagePath: snapshot.ref.fullPath
      };

      await api.post(`/tasks/${taskId}/files`, fileDoc);
      
      fetchFiles();
      alert('Dosya başarıyla yüklendi! Versiyon kontrolü yapıldı.');

    } catch (error) {
      console.error('Dosya yükleme hatası:', error);
      alert('Dosya yüklenirken hata oluştu: ' + error.message);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const fetchFiles = async () => {
    if (!taskId) return;
    try {
      setLoading(true);
      const response = await api.get(`/tasks/${taskId}/files`);
      setFiles(response.data);
    } catch (error) {
      console.error('Dosyaları getirme hatası:', error);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFile = async (fileId, storagePath) => {
    if (!window.confirm('Bu dosyayı silmek istediğinizden emin misiniz?')) return;

    try {
      const response = await api.delete(`/files/${fileId}`);
      if (response.data.storagePath) {
         const fileRef = ref(storage, response.data.storagePath);
         await deleteObject(fileRef).catch(() => {});
      } else {
         const fileRef = ref(storage, storagePath);
         await deleteObject(fileRef).catch(() => {});
      }
      setFiles(prev => prev.filter(file => file.file_id !== fileId));
    } catch (error) {
      alert('Dosya silinirken hata oluştu.');
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType) => {
    if (!fileType) return '📎';
    if (fileType.includes('image')) return '🖼️';
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📊';
    if (fileType.includes('zip') || fileType.includes('rar')) return '📦';
    return '📎';
  };

  const toggleHistory = (fileId) => {
    setExpandedFileId(expandedFileId === fileId ? null : fileId);
  };

  // İlk yükleme
  React.useEffect(() => {
    if (taskId) fetchFiles();
  }, [taskId, projectId]);

  // --- RENDER MANTIĞI: Gruplama ---
  // Sadece "Güncel" (is_current_version = true) olanları ana listede göster
  const currentFiles = files.filter(f => f.is_current_version);

  return (
    <div className="space-y-4">
      {/* Upload Butonu */}
      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
        <input
          type="file"
          id="file-upload"
          onChange={handleFileUpload}
          className="hidden"
          disabled={uploading}
        />
        <label
          htmlFor="file-upload"
          className={`cursor-pointer flex flex-col items-center justify-center space-y-2 ${
            uploading ? 'opacity-50' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
          } transition-colors p-4 rounded`}
        >
          {uploading ? (
            <>
              <LoadingSpinner size="small" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Yükleniyor...</span>
            </>
          ) : (
            <>
              <div className="text-2xl">📤</div>
              <div>
                <div className="font-medium text-gray-900 dark:text-white text-sm">
                  Yeni Versiyon / Dosya Yükle
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Aynı isimle yüklerseniz otomatik olarak <strong>v2, v3</strong> şeklinde güncellenir.
                </div>
              </div>
            </>
          )}
        </label>
      </div>

      {/* Dosya Listesi */}
      {loading ? (
        <div className="flex justify-center py-4"><LoadingSpinner size="small" /></div>
      ) : currentFiles.length > 0 ? (
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900 dark:text-white text-sm border-b pb-2 dark:border-gray-700">Güncel Dosyalar</h4>
          
          {currentFiles.map(file => {
            // Bu dosyanın geçmişini bul (Aynı isimde ama güncel olmayanlar)
            // Not: İsim değişirse zincir kopar, bu basit bir implementation.
            const historyFiles = files.filter(f => 
                f.name === file.name && !f.is_current_version
            ).sort((a, b) => b.version - a.version); // En yenisi en üstte

            const hasHistory = historyFiles.length > 0;

            return (
              <div key={file.file_id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* ÜST KISIM (Güncel Dosya) */}
                <div className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <span className="text-lg flex-shrink-0">{getFileIcon(file.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline truncate" title={file.name}>
                          {file.name}
                        </a>
                        <span className="bg-green-100 text-green-800 text-[10px] px-1.5 py-0.5 rounded border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800">
                          v{file.version}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {formatFileSize(file.size)} • {new Date(file.uploaded_at).toLocaleString('tr-TR')}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    {hasHistory && (
                        <button 
                            onClick={() => toggleHistory(file.file_id)}
                            className="text-xs flex items-center gap-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-1 rounded transition-colors mr-2"
                        >
                            <span>🕒</span>
                            <span>{expandedFileId === file.file_id ? 'Gizle' : 'Geçmiş'}</span>
                        </button>
                    )}
                    <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 p-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30" title="İndir">⬇️</a>
                    <button onClick={() => handleDeleteFile(file.file_id, file.storage_path)} className="text-red-600 hover:text-red-800 p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30" title="Sil">🗑️</button>
                  </div>
                </div>

                {/* ALT KISIM (Geçmiş - Expandable) */}
                {hasHistory && expandedFileId === file.file_id && (
                    <div className="bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 p-2 space-y-1">
                        <p className="text-[10px] text-gray-500 uppercase font-bold px-2 mb-1">Versiyon Geçmişi</p>
                        {historyFiles.map(oldFile => (
                            <div key={oldFile.file_id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-xs">
                                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                    <span className="bg-gray-200 text-gray-700 px-1 rounded text-[10px] dark:bg-gray-700 dark:text-gray-300">v{oldFile.version}</span>
                                    <span>{new Date(oldFile.uploaded_at).toLocaleString('tr-TR')}</span>
                                </div>
                                <div className="flex gap-2">
                                    <a href={oldFile.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 hover:underline">İncele</a>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center text-gray-500 dark:text-gray-400 text-sm py-4">Henüz dosya yüklenmemiş</div>
      )}
    </div>
  );
};

export default FileUpload;