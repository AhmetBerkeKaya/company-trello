import React, { useState } from 'react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../../firebase/config'; // Sadece 'storage' kaldı
import api from '../../api/axios'; // YENİ
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../UI/LoadingSpinner';

const FileUpload = ({ taskId, projectId }) => {
  const { userData } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dosya yükleme (YENİ: Hibrit - Firebase Storage + Bizim API)
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Dosya boyutu 5MB\'dan küçük olmalıdır');
      return;
    }

    setUploading(true);
    try {
      // 1. Storage'a yükle (Hala Firebase)
      const fileRef = ref(storage, `projects/${projectId}/tasks/${taskId}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(fileRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      // 2. YENİ: Bizim API'mize (PostgreSQL) kaydet
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
      
      fetchFiles(); // Listeyi yenile
      alert('Dosya başarıyla yüklendi!');

    } catch (error) {
      console.error('Dosya yükleme hatası:', error);
      alert('Dosya yüklenirken hata oluştu: ' + error.message);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  // YENİ: Dosyaları getir (API'den)
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

  // YENİ: Dosya silme (API + Firebase Storage)
  const handleDeleteFile = async (fileId, storagePath) => {
    if (!window.confirm('Bu dosyayı silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      // 1. Bizim API'mizden (PostgreSQL) kaydı sil
      // (Bebek Adımı 7.D'de eklediğimiz API yolu)
      const response = await api.delete(`/files/${fileId}`);
      
      // 2. API başarılı olursa, Storage'dan dosyayı sil
      // (API'den storagePath'i geri aldık)
      if (response.data.storagePath) {
         const fileRef = ref(storage, response.data.storagePath);
         await deleteObject(fileRef);
      } else {
         // storagePath API'den gelmezse (eski hata) diye manuel sil
         const fileRef = ref(storage, storagePath);
         await deleteObject(fileRef);
      }

      setFiles(prev => prev.filter(file => file.file_id !== fileId));
      alert('Dosya başarıyla silindi!');

    } catch (error) {
      console.error('Dosya silme hatası:', error);
      alert('Dosya silinirken hata oluştu: '+(error.response?.data?.message || error.message));
    }
  };

  // Dosya boyutunu formatla (Aynen kaldı)
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Dosya ikonunu belirle (Aynen kaldı)
  const getFileIcon = (fileType) => {
    if (!fileType) return '📎';
    if (fileType.includes('image')) return '🖼️';
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📊';
    if (fileType.includes('zip') || fileType.includes('rar')) return '📦';
    return '📎';
  };

  // İlk yüklemede dosyaları getir
  React.useEffect(() => {
    if (taskId) {
       fetchFiles();
    }
  }, [taskId, projectId]);

  return (
    <div className="space-y-4">
      {/* Dosya Yükleme Butonu (Aynen kaldı) */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
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
            uploading ? 'opacity-50' : 'hover:bg-gray-50'
          } transition-colors p-4 rounded`}
        >
          {uploading ? (
            <>
              <LoadingSpinner size="small" />
              <span className="text-sm text-gray-600">Yükleniyor...</span>
            </>
          ) : (
            <>
              <div className="text-2xl">📤</div>
              <div>
                <div className="font-medium text-gray-900 text-sm">
                  Dosya Yükle
                </div>
                <div className="text-xs text-gray-500">
                  PNG, JPG, PDF, DOCX (max 5MB)
                </div>
              </div>
            </>
          )}
        </label>
      </div>

      {/* Dosya Listesi (Veritabanı sütun adları güncellendi) */}
      {loading ? (
        <div className="flex justify-center py-4">
          <LoadingSpinner size="small" />
        </div>
      ) : files.length > 0 ? (
        <div className="space-y-2">
          <h4 className="font-medium text-gray-900 text-sm">Yüklenen Dosyalar</h4>
          {files.map(file => (
            <div
              key={file.file_id}
              className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <span className="text-lg flex-shrink-0">
                  {getFileIcon(file.type)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 truncate"
                      title={file.name}
                    >
                      {file.name}
                    </a>
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatFileSize(file.size)} • 
                    {new Date(file.uploaded_at).toLocaleDateString('tr-TR')}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 flex-shrink-0">
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 p-1"
                  title="İndir"
                >
                  ⬇️
                </a>
                <button
                  onClick={() => handleDeleteFile(file.file_id, file.storage_path)}
                  className="text-red-600 hover:text-red-800 p-1"
                  title="Sil"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-500 text-sm py-4">
          Henüz dosya yüklenmemiş
        </div>
      )}
    </div>
  );
};

export default FileUpload;