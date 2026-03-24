import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api/axios'; 
import LoadingSpinner from '../UI/LoadingSpinner';

const MeetingRequestModal = ({ isOpen, onClose, onSave }) => {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);

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
      fetchProjects(); 
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

  const fetchProjects = async () => {
    try {
      const response = await api.get('/projects');
      setProjects(response.data);
    } catch (error) {
      console.error('Proje getirme hatası:', error);
      setError('Proje bilgileri yüklenirken hata oluştu');
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
      await api.post('/meeting-requests', {
        title: formData.title,
        description: formData.description,
        projectId: formData.projectId,
        reason: formData.reason,
        preferredDate: formData.preferredDate || null,
        preferredTime: formData.preferredTime || null
      });

      onClose();
      alert('✅ Toplantı isteğiniz başarıyla gönderildi! Yöneticilere bildirim gönderildi.');

    } catch (error) {
      console.error('Toplantı isteği oluşturma hatası:', error);
      setError('Toplantı isteği oluşturulurken bir hata oluştu: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-[3rem] shadow-2xl w-full max-w-2xl flex flex-col border border-gray-100 dark:border-gray-700 animate-slide-in overflow-hidden max-h-[90vh]">
        
        {/* HEADER */}
        <div className="px-10 py-8 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-widest">
              Toplantı İsteği Oluştur
            </h2>
            <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mt-2 uppercase tracking-widest">
              Talebiniz proje yöneticisi ve adminlere iletilecektir.
            </p>
          </div>
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

              {/* Açıklama */}
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">
                  Toplantı Açıklaması
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-medium text-sm dark:text-white resize-none"
                  placeholder="Toplantı detaylarını ve konuşulacak konuları açıklayınız..."
                  rows="3"
                />
              </div>

              {/* Proje Seçimi */}
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">
                  İlgili Proje *
                </label>
                <div className="relative">
                  <select
                    name="projectId"
                    value={formData.projectId}
                    onChange={handleInputChange}
                    className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold text-sm dark:text-white appearance-none"
                    required
                  >
                    <option value="">Proje Seçin</option>
                    {projects.map(project => (
                      <option key={project.project_id} value={project.project_id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-5 flex items-center text-gray-400">▼</div>
                </div>
              </div>

              {/* Talep Nedeni */}
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">
                  Talep Nedeni *
                </label>
                <textarea
                  name="reason"
                  value={formData.reason}
                  onChange={handleInputChange}
                  className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-medium text-sm dark:text-white resize-none"
                  placeholder="Bu toplantıyı neden talep ettiğinizi kısaca belirtin..."
                  rows="2"
                  required
                />
              </div>

              {/* Tarih ve Saat */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">
                  Tercih Edilen Tarih
                </label>
                <input
                  type="date"
                  name="preferredDate"
                  value={formData.preferredDate}
                  onChange={handleInputChange}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold text-sm dark:text-white uppercase"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">
                  Tercih Edilen Saat
                </label>
                <input
                  type="time"
                  name="preferredTime"
                  value={formData.preferredTime}
                  onChange={handleInputChange}
                  className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold text-sm dark:text-white"
                />
              </div>

              {/* Bilgilendirme */}
              <div className="md:col-span-2 bg-blue-50 dark:bg-blue-900/10 border-2 border-blue-100 dark:border-blue-800/50 rounded-[2rem] p-8">
                <h4 className="font-black text-xs text-blue-800 dark:text-blue-300 mb-4 uppercase tracking-widest flex items-center gap-3">
                  <span className="text-2xl">📨</span> Bilgilendirme
                </h4>
                <ul className="text-[10px] font-bold text-blue-600 dark:text-blue-400 space-y-2 uppercase tracking-wider">
                  <li>• İsteğiniz <strong className="font-black">proje yöneticisi</strong> ve <strong className="font-black">adminlere</strong> iletilecektir.</li>
                  <li>• Değerlendirildikten sonra size sistem üzerinden dönüş yapılacaktır.</li>
                  <li>• Zorunlu alanlar (*) ile işaretlenmiştir.</li>
                </ul>
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
              className="px-10 py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-green-500/20 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
            >
              {loading ? <LoadingSpinner size="small" color="white" /> : 'İSTEĞİ GÖNDER'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MeetingRequestModal;