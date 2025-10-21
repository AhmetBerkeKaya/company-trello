import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, addDoc, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import LoadingSpinner from '../UI/LoadingSpinner';
import { notifyMeetingRequest } from '../../utils/notificationHelper';

const MeetingRequestModal = ({ isOpen, onClose, onSave }) => {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [managersAndAdmins, setManagersAndAdmins] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    projectId: '',
    reason: '',
    preferredDate: '',
    preferredTime: ''
  });

  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchProjectsAndManagers();
      setFormData({
        title: '',
        description: '',
        projectId: '',
        reason: '',
        preferredDate: '',
        preferredTime: ''
      });
      setError('');
    }
  }, [isOpen]);

  const fetchProjectsAndManagers = async () => {
    try {
      // Kullanıcının üyesi olduğu projeleri getir
      const projectsQuery = query(
        collection(db, 'projects'),
        where('members', 'array-contains', userData.id)
      );

      const projectsSnapshot = await getDocs(projectsQuery);
      const projectsList = projectsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setProjects(projectsList);

      // Tüm admin ve manager'ları getir
      const usersQuery = query(
        collection(db, 'users'),
        where('role', 'in', ['admin', 'manager'])
      );

      const usersSnapshot = await getDocs(usersQuery);
      const managersAndAdminsList = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setManagersAndAdmins(managersAndAdminsList);
    } catch (error) {
      console.error('Proje ve yönetici getirme hatası:', error);
      setError('Proje ve yönetici bilgileri yüklenirken hata oluştu');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.title.trim() || !formData.reason.trim() || !formData.projectId) {
      setError('Lütfen zorunlu alanları doldurun (Başlık, Proje ve Talep Nedeni)');
      return;
    }

    setLoading(true);

    try {
      // Toplantı isteğini oluştur
      const meetingRequest = {
        title: formData.title,
        description: formData.description,
        projectId: formData.projectId,
        reason: formData.reason,
        preferredDate: formData.preferredDate || null,
        preferredTime: formData.preferredTime || null,
        requestedBy: userData.id,
        status: 'pending', // pending, approved, rejected
        createdAt: new Date(),
        type: 'request' // Normal toplantıdan ayırmak için
      };

      const docRef = await addDoc(collection(db, 'meetingRequests'), meetingRequest);

      // Proje yöneticisi ve admin'lere bildirim gönder
      await notifyMeetingRequest(
        { ...meetingRequest, id: docRef.id },
        managersAndAdmins.map(user => user.id),
        { id: userData.id, name: userData.name }
      );

      onSave();
      onClose();
      alert('✅ Toplantı isteğiniz başarıyla gönderildi! Proje yöneticisi ve adminlere bildirim gönderildi.');

    } catch (error) {
      console.error('Toplantı isteği oluşturma hatası:', error);
      setError('Toplantı isteği oluşturulurken bir hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Toplantı İsteği Oluştur</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Toplantı talebiniz proje yöneticisi ve adminlere iletilecektir.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Başlık */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Toplantı Başlığı *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Toplantı konusunu giriniz"
                required
              />
            </div>

            {/* Açıklama */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Toplantı Açıklaması
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Toplantı detaylarını açıklayınız"
                rows="3"
              />
            </div>

            {/* Proje Seçimi */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                İlgili Proje *
              </label>
              <select
                name="projectId"
                value={formData.projectId}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              >
                <option value="">Proje Seçin</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Talep Nedeni */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Talep Nedeni *
              </label>
              <textarea
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Bu toplantıyı neden talep ettiğinizi açıklayınız"
                rows="3"
                required
              />
            </div>

            {/* Tercih Edilen Tarih ve Saat */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tercih Edilen Tarih
                </label>
                <input
                  type="date"
                  name="preferredDate"
                  value={formData.preferredDate}
                  onChange={handleInputChange}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tercih Edilen Saat
                </label>
                <input
                  type="time"
                  name="preferredTime"
                  value={formData.preferredTime}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Bilgilendirme */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2">📨 Bilgilendirme</h4>
              <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                <li>• Toplantı isteğiniz <strong>proje yöneticisi</strong> ve <strong>adminlere</strong> iletilecek</li>
                <li>• İsteğiniz değerlendirildikten sonra size dönüş yapılacak</li>
                <li>• Zorunlu alanlar (*) ile işaretlenmiştir</li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 font-medium disabled:opacity-50 transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center space-x-2"
            >
              {loading && <LoadingSpinner size="small" />}
              <span>İsteği Gönder</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MeetingRequestModal;