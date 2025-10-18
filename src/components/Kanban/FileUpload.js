import React, { useState } from 'react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { storage, db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../UI/LoadingSpinner';

const FileUpload = ({ taskId, projectId }) => {
  const { userData } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dosya yükleme
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Dosya boyutu kontrolü (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Dosya boyutu 5MB\'dan küçük olmalıdır');
      return;
    }

    setUploading(true);

    try {
      // Storage'a yükle
      const fileRef = ref(storage, `projects/${projectId}/tasks/${taskId}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(fileRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      // Firestore'a dosya bilgisini kaydet
      const fileDoc = {
        name: file.name,
        url: downloadURL,
        size: file.size,
        type: file.type,
        taskId: taskId,
        projectId: projectId,
        uploadedBy: userData.id,
        uploadedAt: new Date(),
        storagePath: snapshot.ref.fullPath
      };

      await addDoc(collection(db, 'files'), fileDoc);
      
      // Dosya listesini yenile
      fetchFiles();
      
      alert('Dosya başarıyla yüklendi!');

    } catch (error) {
      console.error('Dosya yükleme hatası:', error);
      alert('Dosya yüklenirken hata oluştu: ' + error.message);
    } finally {
      setUploading(false);
      // Input'u temizle
      event.target.value = '';
    }
  };

  // Dosyaları getir
  const fetchFiles = async () => {
    try {
      setLoading(true);
      const filesQuery = query(
        collection(db, 'files'),
        where('taskId', '==', taskId),
        where('projectId', '==', projectId)
      );
      
      const filesSnapshot = await getDocs(filesQuery);
      const filesData = filesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setFiles(filesData);
    } catch (error) {
      console.error('Dosyaları getirme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  // Dosya silme
  const handleDeleteFile = async (fileId, storagePath) => {
    if (!window.confirm('Bu dosyayı silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      // Storage'dan dosyayı sil
      const fileRef = ref(storage, storagePath);
      await deleteObject(fileRef);

      // Firestore'dan dosya kaydını sil
      await deleteDoc(doc(db, 'files', fileId));

      // Listeyi güncelle
      setFiles(prev => prev.filter(file => file.id !== fileId));
      
      alert('Dosya başarıyla silindi!');

    } catch (error) {
      console.error('Dosya silme hatası:', error);
      alert('Dosya silinirken hata oluştu: ' + error.message);
    }
  };

  // Dosya boyutunu formatla
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Dosya ikonunu belirle
  const getFileIcon = (fileType) => {
    if (fileType.includes('image')) return '🖼️';
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📊';
    if (fileType.includes('zip') || fileType.includes('rar')) return '📦';
    return '📎';
  };

  // İlk yüklemede dosyaları getir
  React.useEffect(() => {
    fetchFiles();
  }, [taskId, projectId]);

  return (
    <div className="space-y-4">
      {/* Dosya Yükleme Butonu */}
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

      {/* Dosya Listesi */}
      {loading ? (
        <div className="flex justify-center py-4">
          <LoadingSpinner size="small" />
        </div>
      ) : files.length > 0 ? (
        <div className="space-y-2">
          <h4 className="font-medium text-gray-900 text-sm">Yüklenen Dosyalar</h4>
          {files.map(file => (
            <div
              key={file.id}
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
                    {file.uploadedAt?.toDate?.().toLocaleDateString('tr-TR')}
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
                  onClick={() => handleDeleteFile(file.id, file.storagePath)}
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