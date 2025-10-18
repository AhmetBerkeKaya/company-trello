import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, addDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import LoadingSpinner from '../UI/LoadingSpinner';

const MeetingModal = ({ meeting, isOpen, onClose, onSave }) => {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [projectMembers, setProjectMembers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    location: '',
    projectId: '',
    agenda: ['']
  });

  // Edit modunda mı?
  const isEditMode = !!meeting;

  useEffect(() => {
    if (isOpen) {
      // Modal açılınca proje üyelerini getir
      fetchProjectMembers();
      
      if (isEditMode) {
        // Edit modunda: mevcut meeting verilerini yükle
        const startTime = meeting.startTime?.toDate?.();
        const endTime = meeting.endTime?.toDate?.();
        
        setFormData({
          title: meeting.title || '',
          description: meeting.description || '',
          startTime: startTime ? formatDateTimeForInput(startTime) : '',
          endTime: endTime ? formatDateTimeForInput(endTime) : '',
          location: meeting.location || '',
          projectId: meeting.projectId || '',
          agenda: meeting.agenda?.length > 0 ? meeting.agenda : ['']
        });
        
        setSelectedUsers(meeting.participants || []);
      } else {
        // Yeni toplantı: formu temizle
        setFormData({
          title: '',
          description: '',
          startTime: '',
          endTime: '',
          location: '',
          projectId: '',
          agenda: ['']
        });
        setSelectedUsers([userData.id]); // Kullanıcıyı otomatik ekle
      }
    }
  }, [isOpen, meeting, userData]);

  // Tarih formatı için yardımcı fonksiyon
  const formatDateTimeForInput = (date) => {
    return date.toISOString().slice(0, 16);
  };

  // Proje üyelerini getir
  const fetchProjectMembers = async () => {
    try {
      // Önce projeleri getir (basit versiyon - ileride geliştirilebilir)
      const projectsQuery = query(
        collection(db, 'projects'),
        where('members', 'array-contains', userData.id)
      );
      
      const projectsSnapshot = await getDocs(projectsQuery);
      const projects = projectsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Tüm proje üyelerini topla
      const allMemberIds = new Set();
      projects.forEach(project => {
        project.members?.forEach(memberId => allMemberIds.add(memberId));
      });

      // Üye detaylarını getir
      if (allMemberIds.size > 0) {
        const usersQuery = query(
          collection(db, 'users'),
          where('__name__', 'in', Array.from(allMemberIds).slice(0, 10))
        );
        
        const usersSnapshot = await getDocs(usersQuery);
        const members = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setProjectMembers(members);
      }
    } catch (error) {
      console.error('Proje üyelerini getirme hatası:', error);
    }
  };

  // Form input'larını handle et
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Agenda item'ını güncelle
  const handleAgendaChange = (index, value) => {
    const newAgenda = [...formData.agenda];
    newAgenda[index] = value;
    setFormData(prev => ({
      ...prev,
      agenda: newAgenda
    }));
  };

  // Yeni agenda item'ı ekle
  const addAgendaItem = () => {
    setFormData(prev => ({
      ...prev,
      agenda: [...prev.agenda, '']
    }));
  };

  // Agenda item'ını sil
  const removeAgendaItem = (index) => {
    if (formData.agenda.length > 1) {
      const newAgenda = formData.agenda.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        agenda: newAgenda
      }));
    }
  };

  // Kullanıcı seçimini handle et
  const handleUserSelection = (userId) => {
    setSelectedUsers(prev => {
      const isSelected = prev.includes(userId);
      if (isSelected) {
        return prev.filter(id => id !== userId && id !== userData.id); // Kendi kullanıcıyı kaldıramaz
      } else {
        return [...prev, userId];
      }
    });
  };

  // Form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.startTime || !formData.endTime) {
      alert('Lütfen zorunlu alanları doldurun (Başlık, Başlangıç ve Bitiş zamanı)');
      return;
    }

    const startTime = new Date(formData.startTime);
    const endTime = new Date(formData.endTime);

    if (endTime <= startTime) {
      alert('Bitiş zamanı başlangıç zamanından sonra olmalıdır');
      return;
    }

    setLoading(true);

    try {
      const meetingData = {
        title: formData.title,
        description: formData.description,
        startTime: startTime,
        endTime: endTime,
        location: formData.location,
        participants: [...new Set([...selectedUsers, userData.id])], // Kendi kullanıcıyı da ekle
        organizer: userData.id,
        agenda: formData.agenda.filter(item => item.trim() !== ''),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      if (isEditMode) {
        // Güncelleme
        await updateDoc(doc(db, 'meetings', meeting.id), meetingData);
      } else {
        // Yeni toplantı
        await addDoc(collection(db, 'meetings'), meetingData);
      }

      onSave(); // Listeyi yenile
      onClose(); // Modal'ı kapat
      
    } catch (error) {
      console.error('Toplantı kaydetme hatası:', error);
      alert('Toplantı kaydedilirken bir hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {isEditMode ? 'Toplantıyı Düzenle' : 'Yeni Toplantı Oluştur'}
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[70vh]">
          <div className="space-y-6">
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
                placeholder="Toplantı başlığını girin"
                required
              />
            </div>

            {/* Açıklama */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Açıklama
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Toplantı açıklaması"
                rows="3"
              />
            </div>

            {/* Zaman */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Başlangıç Zamanı *
                </label>
                <input
                  type="datetime-local"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Bitiş Zamanı *
                </label>
                <input
                  type="datetime-local"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
            </div>

            {/* Lokasyon */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Lokasyon
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Fiziksel adres veya online meeting link"
              />
            </div>

            {/* Katılımcılar */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Katılımcılar
              </label>
              <div className="border border-gray-300 dark:border-gray-600 rounded-lg max-h-32 overflow-y-auto p-2 bg-white dark:bg-gray-700">
                {projectMembers.map(member => (
                  <div key={member.id} className="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-600 rounded">
                    <input
                      type="checkbox"
                      id={`user-${member.id}`}
                      checked={selectedUsers.includes(member.id)}
                      onChange={() => handleUserSelection(member.id)}
                      className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                      disabled={member.id === userData.id} // Kendi kullanıcı disable
                    />
                    <label
                      htmlFor={`user-${member.id}`}
                      className="ml-3 flex-1 flex items-center justify-between"
                    >
                      <div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {member.name}
                          {member.id === userData.id && (
                            <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(Siz)</span>
                          )}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 capitalize">
                          ({member.role})
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {member.department}
                      </span>
                    </label>
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {selectedUsers.length} kişi seçildi
              </div>
            </div>

            {/* Gündem */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Gündem Maddeleri
              </label>
              <div className="space-y-2">
                {formData.agenda.map((item, index) => (
                  <div key={index} className="flex space-x-2">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => handleAgendaChange(index, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder={`Gündem maddesi ${index + 1}`}
                    />
                    {formData.agenda.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAgendaItem(index)}
                        className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        Sil
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addAgendaItem}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors text-sm"
                >
                  + Gündem Maddesi Ekle
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 font-medium disabled:opacity-50"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center space-x-2"
            >
              {loading && <LoadingSpinner size="small" />}
              <span>{isEditMode ? 'Güncelle' : 'Oluştur'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MeetingModal;