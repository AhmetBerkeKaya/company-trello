import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, addDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import LoadingSpinner from '../UI/LoadingSpinner';

const MeetingModal = ({ meeting, isOpen, onClose, onSave }) => {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [projectMembers, setProjectMembers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const modalRef = useRef();

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    location: '',
    meetingLink: '',
    projectId: '',
    agenda: ['']
  });

  // Edit modunda mı?
  const isEditMode = !!meeting;

  // Modal dışına tıklayarak kapatma
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Klavye kısayolları
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.keyCode === 27) onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      fetchProjectsAndMembers();
      
      if (isEditMode) {
        const startTime = meeting.startTime?.toDate?.();
        const endTime = meeting.endTime?.toDate?.();
        
        setFormData({
          title: meeting.title || '',
          description: meeting.description || '',
          startTime: startTime ? formatDateTimeForInput(startTime) : '',
          endTime: endTime ? formatDateTimeForInput(endTime) : '',
          location: meeting.location || '',
          meetingLink: meeting.meetingLink || '',
          projectId: meeting.projectId || '',
          agenda: meeting.agenda?.length > 0 ? meeting.agenda : ['']
        });
        
        setSelectedUsers(meeting.participants || []);
      } else {
        setFormData({
          title: '',
          description: '',
          startTime: '',
          endTime: '',
          location: '',
          meetingLink: '',
          projectId: '',
          agenda: ['']
        });
        setSelectedUsers([userData.id]);
      }
      setError('');
      setSearchTerm('');
    }
  }, [isOpen, meeting, userData, isEditMode]);

  const formatDateTimeForInput = (date) => {
    return date.toISOString().slice(0, 16);
  };

  const fetchProjectsAndMembers = async () => {
    try {
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

      const allMemberIds = new Set();
      projectsList.forEach(project => {
        project.members?.forEach(memberId => allMemberIds.add(memberId));
      });

      if (allMemberIds.size > 0) {
        const usersQuery = query(
          collection(db, 'users'),
          where('__name__', 'in', Array.from(allMemberIds))
        );
        
        const usersSnapshot = await getDocs(usersQuery);
        const members = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setProjectMembers(members);
      }
    } catch (error) {
      console.error('Proje ve üye getirme hatası:', error);
      setError('Proje ve üye bilgileri yüklenirken hata oluştu');
    }
  };

  const filteredMembers = projectMembers.filter(member =>
    member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Form input'larını handle et
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAgendaChange = (index, value) => {
    const newAgenda = [...formData.agenda];
    newAgenda[index] = value;
    setFormData(prev => ({
      ...prev,
      agenda: newAgenda
    }));
  };

  const addAgendaItem = () => {
    setFormData(prev => ({
      ...prev,
      agenda: [...prev.agenda, '']
    }));
  };

  const removeAgendaItem = (index) => {
    if (formData.agenda.length > 1) {
      const newAgenda = formData.agenda.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        agenda: newAgenda
      }));
    }
  };

  const handleUserSelection = (userId) => {
    setSelectedUsers(prev => {
      const isSelected = prev.includes(userId);
      if (isSelected) {
        return prev.filter(id => id !== userId && id !== userData.id);
      } else {
        return [...prev, userId];
      }
    });
  };

  const toggleSelectAll = () => {
    if (selectedUsers.length === filteredMembers.length + 1) {
      setSelectedUsers([userData.id]);
    } else {
      const allUserIds = filteredMembers.map(member => member.id);
      setSelectedUsers([...new Set([...allUserIds, userData.id])]);
    }
  };

  const generateMeetingLink = () => {
    const randomId = Math.random().toString(36).substring(2, 15);
    const baseUrl = 'https://meet.google.com/';
    const meetingCode = `${randomId.slice(0, 3)}-${randomId.slice(3, 7)}-${randomId.slice(7, 11)}`;
    setFormData(prev => ({
      ...prev,
      meetingLink: `${baseUrl}${meetingCode}`
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!formData.title.trim() || !formData.startTime || !formData.endTime) {
      setError('Lütfen zorunlu alanları doldurun (Başlık, Başlangıç ve Bitiş zamanı)');
      return;
    }

    const startTime = new Date(formData.startTime);
    const endTime = new Date(formData.endTime);

    if (endTime <= startTime) {
      setError('Bitiş zamanı başlangıç zamanından sonra olmalıdır');
      return;
    }

    const now = new Date();
    if (startTime < now && !isEditMode) {
      setError('Başlangıç zamanı geçmiş bir tarih olamaz');
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
        meetingLink: formData.meetingLink,
        projectId: formData.projectId || null,
        participants: [...new Set([...selectedUsers, userData.id])],
        organizer: userData.id,
        agenda: formData.agenda.filter(item => item.trim() !== ''),
        createdAt: isEditMode ? meeting.createdAt : new Date(),
        updatedAt: new Date()
      };

      if (isEditMode) {
        await updateDoc(doc(db, 'meetings', meeting.id), meetingData);
      } else {
        await addDoc(collection(db, 'meetings'), meetingData);
      }

      onSave();
      onClose();
      
    } catch (error) {
      console.error('Toplantı kaydetme hatası:', error);
      setError('Toplantı kaydedilirken bir hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div 
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {isEditMode ? 'Toplantıyı Düzenle' : 'Yeni Toplantı Oluştur'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 text-2xl font-bold"
            aria-label="Kapat"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[70vh]">
          {error && (
            <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

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

            {/* Proje Seçimi */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Proje
              </label>
              <select
                name="projectId"
                value={formData.projectId}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Proje Seçin</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Toplantıyı bir projeye bağlayabilirsiniz
              </div>
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
                Fiziksel Lokasyon
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Ofis, Toplantı Odası, vs."
              />
            </div>

            {/* Toplantı Linki */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Online Toplantı Linki
                </label>
                <button
                  type="button"
                  onClick={generateMeetingLink}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Link Oluştur
                </button>
              </div>
              <input
                type="url"
                name="meetingLink"
                value={formData.meetingLink}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="https://meet.google.com/xxx-xxxx-xxx"
              />
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Google Meet, Zoom, Teams vb. online toplantı linki
              </div>
            </div>

            {/* Katılımcılar */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Katılımcılar
                </label>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {selectedUsers.length === filteredMembers.length + 1 ? 'Tümünü Kaldır' : 'Tümünü Seç'}
                </button>
              </div>
              
              {/* Arama */}
              <div className="mb-2">
                <input
                  type="text"
                  placeholder="İsim, departman veya rol ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="border border-gray-300 dark:border-gray-600 rounded-lg max-h-48 overflow-y-auto p-2 bg-white dark:bg-gray-700">
                {filteredMembers.map(member => (
                  <div key={member.id} className="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-600 rounded">
                    <input
                      type="checkbox"
                      id={`user-${member.id}`}
                      checked={selectedUsers.includes(member.id)}
                      onChange={() => handleUserSelection(member.id)}
                      className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                      disabled={member.id === userData.id}
                    />
                    <label
                      htmlFor={`user-${member.id}`}
                      className="ml-3 flex-1 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {member.name}
                          {member.id === userData.id && (
                            <span className="ml-1 text-xs text-blue-600 dark:text-blue-400">(Siz)</span>
                          )}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                          {member.role}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                        {member.department}
                      </span>
                    </label>
                  </div>
                ))}
                {filteredMembers.length === 0 && (
                  <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
                    {searchTerm ? 'Aranan kriterlere uygun katılımcı bulunamadı' : 'Katılımcı bulunamadı'}
                  </div>
                )}
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
                        aria-label="Gündem maddesini sil"
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
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 font-medium disabled:opacity-50 transition-colors"
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