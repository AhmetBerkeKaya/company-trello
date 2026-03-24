import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api/axios';
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

  // Veri çekme ve state ayarları
  useEffect(() => {
    if (isOpen) {
      fetchModalData();

      if (isEditMode) {
        const startTime = meeting.startTime ? new Date(meeting.startTime) : null;
        const endTime = meeting.endTime ? new Date(meeting.endTime) : null;
        
        setFormData({
          title: meeting.title || '',
          description: meeting.description || '',
          startTime: startTime ? formatDateTimeForInput(startTime) : '',
          endTime: endTime ? formatDateTimeForInput(endTime) : '',
          location: meeting.location || '',
          meetingLink: meeting.meeting_link || '',
          projectId: meeting.project_id || '',
          agenda: meeting.agenda?.length > 0 ? meeting.agenda : ['']
        });
        
        setSelectedUsers(meeting.participants?.map(p => p.user_id) || []); 
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
        setSelectedUsers([userData.user_id]);
      }
      setError('');
      setSearchTerm('');
    }
  }, [isOpen, meeting, userData, isEditMode]);

  const formatDateTimeForInput = (date) => {
    return date.toISOString().slice(0, 16);
  };

  const fetchModalData = async () => {
    try {
      const [projectsRes, usersRes] = await Promise.all([
        api.get('/projects'), 
        api.get('/users')    
      ]);
      
      setProjects(projectsRes.data);
      setProjectMembers(usersRes.data);

    } catch (error) {
      console.error('Proje ve üye getirme hatası:', error);
      setError('Proje ve üye bilgileri yüklenirken hata oluştu');
    }
  };

  const filteredMembers = projectMembers.filter(member =>
    member.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAgendaChange = (index, value) => {
    const newAgenda = [...formData.agenda];
    newAgenda[index] = value;
    setFormData(prev => ({ ...prev, agenda: newAgenda }));
  };
  
  const addAgendaItem = () => {
    setFormData(prev => ({ ...prev, agenda: [...prev.agenda, ''] }));
  };
  
  const removeAgendaItem = (index) => {
    if (formData.agenda.length > 1) {
      const newAgenda = formData.agenda.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, agenda: newAgenda }));
    }
  };

  const handleUserSelection = (userId) => {
    setSelectedUsers(prev => {
      const isSelected = prev.includes(userId);
      if (isSelected) {
        if (userId === userData.user_id) return prev;
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  const toggleSelectAll = () => {
    if (selectedUsers.length === filteredMembers.length) {
      setSelectedUsers([userData.user_id]); 
    } else {
      const allUserIds = filteredMembers.map(member => member.user_id);
      setSelectedUsers([...new Set([...allUserIds, userData.user_id])]); 
    }
  };

  const generateMeetingLink = () => {
    const randomId = Math.random().toString(36).substring(2, 15);
    const baseUrl = 'https://meet.google.com/';
    const meetingCode = `${randomId.slice(0, 3)}-${randomId.slice(3, 7)}-${randomId.slice(7, 11)}`;
    setFormData(prev => ({ ...prev, meetingLink: `${baseUrl}${meetingCode}` }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if ((userData.role === 'manager' || userData.role === 'admin') && !formData.projectId) {
      setError('Proje yöneticisi ve adminler toplantı oluştururken proje seçmek zorundadır!');
      return;
    }
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
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        location: formData.location,
        meetingLink: formData.meetingLink,
        projectId: formData.projectId || null,
        participants: [...new Set([...selectedUsers, userData.user_id])], 
        agenda: formData.agenda.filter(item => item.trim() !== '')
      };

      if (isEditMode) {
        await api.put(`/meetings/${meeting.meeting_id}`, meetingData);
      } else {
        await api.post('/meetings', meetingData);
      }

      onSave(); 
      onClose();

    } catch (error) {
      console.error('Toplantı kaydetme hatası:', error);
      setError('Toplantı kaydedilirken bir hata oluştu: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-fade-in">
      <div
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-[3rem] shadow-2xl w-full max-w-3xl flex flex-col border border-gray-100 dark:border-gray-700 animate-slide-in overflow-hidden max-h-[90vh]"
      >
        {/* HEADER */}
        <div className="px-10 py-8 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-widest">
            {isEditMode ? 'Toplantıyı Düzenle' : 'Yeni Toplantı Planla'}
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-gray-700 shadow-sm text-gray-400 hover:text-red-500 transition-colors"
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-10 overflow-y-auto custom-scrollbar flex-1 space-y-8">
            
            {error && (
              <div className="p-5 rounded-[1.5rem] bg-red-50 text-red-700 border-2 border-red-200 font-bold text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Başlık */}
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">
                  Toplantı Başlığı *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold text-sm dark:text-white"
                  placeholder="Örn: Proje Kick-off Toplantısı"
                  required
                />
              </div>

              {/* Proje Seçimi */}
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">
                  İlgili Proje {(userData.role === 'manager' || userData.role === 'admin') && '*'}
                </label>
                <div className="relative">
                  <select
                    name="projectId"
                    value={formData.projectId}
                    onChange={handleInputChange}
                    className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold text-sm dark:text-white appearance-none"
                    required={userData.role === 'manager' || userData.role === 'admin'}
                  >
                    <option value="">Proje Bağımsız (Genel Toplantı)</option>
                    {projects.map(project => (
                      <option key={project.project_id} value={project.project_id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-5 flex items-center text-gray-400">▼</div>
                </div>
                <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mt-2 ml-1 uppercase tracking-widest">
                  {userData.role === 'user' ? 'Toplantıyı bir projeye bağlayabilirsiniz (Opsiyonel)' : <span className="text-orange-500">Yöneticiler için proje seçimi zorunludur.</span>}
                </div>
              </div>

              {/* Zamanlar */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Başlangıç *</label>
                <input
                  type="datetime-local"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleInputChange}
                  className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold text-sm dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Bitiş *</label>
                <input
                  type="datetime-local"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleInputChange}
                  className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold text-sm dark:text-white"
                  required
                />
              </div>

              {/* Lokasyon */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Fiziksel Lokasyon</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold text-sm dark:text-white"
                  placeholder="Örn: 2. Kat Toplantı Odası"
                />
              </div>

              {/* Online Link */}
              <div>
                <div className="flex justify-between items-center mb-3 ml-1 pr-1">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Online Bağlantı</label>
                  <button type="button" onClick={generateMeetingLink} className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest hover:text-blue-800 transition-colors">
                    OTOMATİK OLUŞTUR ⚡
                  </button>
                </div>
                <input
                  type="url"
                  name="meetingLink"
                  value={formData.meetingLink}
                  onChange={handleInputChange}
                  className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold text-sm dark:text-white"
                  placeholder="https://meet.google.com/..."
                />
              </div>

              {/* Katılımcılar */}
              <div className="md:col-span-2">
                <div className="flex justify-between items-center mb-3 ml-1 pr-1">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Davetliler ({selectedUsers.length})</label>
                  <button type="button" onClick={toggleSelectAll} className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest hover:text-blue-800 transition-colors">
                    {selectedUsers.length === filteredMembers.length ? 'TÜMÜNÜ KALDIR' : 'TÜMÜNÜ SEÇ'}
                  </button>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900/50 border-2 border-gray-100 dark:border-gray-700 rounded-[2rem] p-4">
                  <input
                    type="text"
                    placeholder="İsim veya departman ara..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-5 py-3 mb-4 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-xl focus:border-blue-500 outline-none font-bold text-sm dark:text-white"
                  />
                  <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                    {filteredMembers.map(member => (
                      <label key={member.user_id} className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all border-2 ${selectedUsers.includes(member.user_id) ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-white border-transparent dark:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-600'}`}>
                        <div className="flex items-center gap-4">
                          <input
                            type="checkbox"
                            checked={selectedUsers.includes(member.user_id)}
                            onChange={() => handleUserSelection(member.user_id)}
                            disabled={member.user_id === userData.user_id}
                            className="w-5 h-5 text-blue-600 rounded-md focus:ring-blue-500 border-gray-300"
                          />
                          <div>
                            <p className="font-black text-sm text-gray-900 dark:text-white">
                              {member.name} {member.user_id === userData.user_id && <span className="text-blue-500 ml-1">(Siz)</span>}
                            </p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{member.department || 'Departman Yok'} • {member.role}</p>
                          </div>
                        </div>
                      </label>
                    ))}
                    {filteredMembers.length === 0 && (
                      <div className="text-center text-[10px] font-black text-gray-400 uppercase tracking-widest py-6">Kayıt bulunamadı.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Açıklama */}
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Toplantı Notu / Açıklama</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-medium text-sm dark:text-white resize-none"
                  placeholder="Genel bir açıklama yazın..."
                  rows="3"
                />
              </div>

              {/* Gündem */}
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Gündem Maddeleri</label>
                <div className="space-y-3">
                  {formData.agenda.map((item, index) => (
                    <div key={index} className="flex gap-3">
                      <div className="w-12 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-2xl font-black text-gray-400 border-2 border-gray-100 dark:border-gray-700">{index + 1}</div>
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => handleAgendaChange(index, e.target.value)}
                        className="flex-1 px-6 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold text-sm dark:text-white"
                        placeholder="Konu başlığı..."
                      />
                      {formData.agenda.length > 1 && (
                        <button type="button" onClick={() => removeAgendaItem(index)} className="px-5 bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 rounded-2xl font-black transition-colors" title="Sil">
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={addAgendaItem} className="w-full py-4 mt-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/50 dark:hover:bg-gray-800 border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">
                    + YENİ GÜNDEM MADDESİ EKLE
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* FOOTER */}
          <div className="px-10 py-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex justify-end gap-4 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-8 py-4 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-2xl border-2 border-gray-100 dark:border-gray-600 font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all"
            >
              İPTAL ET
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-10 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
            >
              {loading ? <LoadingSpinner size="small" color="white" /> : (isEditMode ? 'GÜNCELLEMELERİ KAYDET' : 'TOPLANTIYI PLANLA')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MeetingModal;