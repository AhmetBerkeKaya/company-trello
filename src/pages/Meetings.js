// src/pages/Meetings.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import MeetingCalendar from '../components/Meetings/MeetingCalendar';
import MeetingModal from '../components/Meetings/MeetingModal';
import MeetingRequestModal from '../components/Meetings/MeetingRequestModal';
import { useLocation, useNavigate } from 'react-router-dom';

const Meetings = () => {
  const { userData } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [meetingRequests, setMeetingRequests] = useState([]); 
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showMeetingRequestModal, setShowMeetingRequestModal] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('calendar'); 
  const [loadingRequests, setLoadingRequests] = useState(false); 

  const isManagerOrAdmin = userData?.role === 'admin' || userData?.role === 'manager';

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const viewParam = params.get('view');
    if (viewParam === 'requests' && isManagerOrAdmin) {
      setView('requests');
    }
  }, [location.search, isManagerOrAdmin]);

  useEffect(() => {
    if (location.state?.activeTab === 'agenda') {
      setView('list');
    }
  }, [location.state]);

  useEffect(() => {
    fetchAllData();
  }, [userData]);

  const fetchAllData = async () => {
    if (!userData) return;
    setLoading(true);
    try {
      const promises = [fetchMeetings()];
      if (isManagerOrAdmin) {
        promises.push(fetchMeetingRequests());
      }
      await Promise.all(promises);
    } catch (error) {
      console.error('Tüm toplantı verilerini çekerken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeetings = async () => {
    try {
      const response = await api.get('/meetings');
      const meetingsData = response.data.map(meeting => ({
        ...meeting,
        startTime: meeting.start_time ? new Date(meeting.start_time) : null,
        endTime: meeting.end_time ? new Date(meeting.end_time) : null,
        start_time: meeting.start_time,
        end_time: meeting.end_time
      }));
      meetingsData.sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
      setMeetings(meetingsData);
    } catch (error) {
      console.error('❌ Toplantıları getirme hatası:', error);
    }
  };

  const fetchMeetingRequests = async () => {
    if (!isManagerOrAdmin) return;
    setLoadingRequests(true);
    try {
      const response = await api.get('/meeting-requests');
      setMeetingRequests(response.data);
    } catch (error) {
      console.error('❌ Toplantı isteklerini getirme hatası:', error);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleApproveRequest = async (requestId) => {
    if (!window.confirm('Bu toplantı isteğini onaylayıp, ilgili proje üyeleri ve yöneticilerle bir toplantı oluşturmak istediğinizden emin misiniz?')) return;
    
    setLoadingRequests(true);
    try {
      await api.put(`/meeting-requests/${requestId}/approve`);
      await fetchMeetingRequests(); 
      await fetchMeetings();      
      alert('✅ İstek onaylandı ve toplantı oluşturuldu!');
    } catch (error) {
      console.error('İstek onaylama hatası:', error);
      alert('İstek onaylanırken bir hata oluştu: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleRejectRequest = async (requestId) => {
    if (!window.confirm('Bu toplantı isteğini reddetmek istediğinizden emin misiniz?')) return;
    
    setLoadingRequests(true);
    try {
      await api.put(`/meeting-requests/${requestId}/reject`);
      await fetchMeetingRequests(); 
      alert('❌ İstek reddedildi.');
    } catch (error) {
      console.error('İstek reddetme hatası:', error);
      alert('İstek reddedilirken bir hata oluştu: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleCreateMeeting = () => {
    setSelectedMeeting(null);
    setShowMeetingModal(true);
  };
  const handleCreateMeetingRequest = () => {
    setShowMeetingRequestModal(true);
  };
  const handleEditMeeting = (meeting) => {
    setSelectedMeeting(meeting);
    setShowMeetingModal(true);
  };
  const handleCloseModal = () => {
    setShowMeetingModal(false);
    setSelectedMeeting(null);
  };
  const handleCloseRequestModal = () => {
    setShowMeetingRequestModal(false);
  };

  const upcomingMeetings = meetings.filter(meeting => meeting.startTime && meeting.startTime > new Date());
  const pastMeetings = meetings.filter(meeting => meeting.startTime && meeting.startTime <= new Date());
  const pendingRequests = meetingRequests.filter(req => req.status === 'pending');

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center">
        <LoadingSpinner size="large" />
        <p className="mt-4 font-black text-[10px] uppercase tracking-[0.3em] text-gray-400">Veriler Yükleniyor</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      
      {/* --- MODERN HEADER SECTION --- */}
      <div className="max-w-7xl mx-auto mb-10 bg-white dark:bg-gray-800 p-8 sm:p-10 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 animate-fade-in relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 select-none pointer-events-none text-8xl font-black italic uppercase">MEETINGS</div>
        
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 relative z-10">
          <div className="flex-1 min-w-0">
            <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight leading-tight uppercase mb-3">Toplantılarım</h1>
            <p className="text-gray-500 dark:text-gray-400 text-lg font-medium leading-relaxed max-w-2xl">
              Takviminizi yönetin, toplantı isteklerini değerlendirin ve ekip iletişimini buradan organize edin.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto shrink-0">
            {/* View Toggles */}
            <div className="bg-gray-100 dark:bg-gray-900/50 p-1.5 rounded-[1.5rem] flex w-full sm:w-auto">
              <button onClick={() => setView('calendar')} className={`flex-1 sm:flex-none px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${view === 'calendar' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-md' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                📅 Takvim
              </button>
              <button onClick={() => setView('list')} className={`flex-1 sm:flex-none px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${view === 'list' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-md' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                📋 Ajanda
              </button>
              {isManagerOrAdmin && (
                <button onClick={() => setView('requests')} className={`relative flex-1 sm:flex-none px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${view === 'requests' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-md' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                  📥 İstekler
                  {pendingRequests.length > 0 && (
                     <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
                       {pendingRequests.length}
                     </span>
                  )}
                </button>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex w-full sm:w-auto gap-3">
              {(userData?.role === 'user' || userData?.role === 'client') && (
                <button onClick={handleCreateMeetingRequest} className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-green-500/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                  <span>📨</span> İSTEK OLUŞTUR
                </button>
              )}
              {isManagerOrAdmin && (
                <button onClick={handleCreateMeeting} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                  <span>➕</span> YENİ TOPLANTI
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* --- İSTATİSTİK KARTLARI --- */}
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
        {[
            {l: 'Toplam Toplantı', v: meetings.length, i: '📅', c: 'blue'},
            {l: 'Yaklaşan', v: upcomingMeetings.length, i: '🕒', c: 'green'},
            {l: 'Tamamlanan', v: pastMeetings.length, i: '✅', c: 'gray'},
            {l: 'Bu Hafta', v: meetings.filter(m => { const d=new Date(); d.setDate(d.getDate()-7); return m.startTime && m.startTime > d; }).length, i: '👥', c: 'purple'}
        ].map((s, idx) => (
            <div key={idx} className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-5 transform hover:scale-105 transition-transform cursor-default">
              <div className={`w-14 h-14 rounded-2xl bg-${s.c}-50 dark:bg-${s.c}-900/20 flex items-center justify-center text-2xl`}>{s.i}</div>
              <div>
                <div className={`text-3xl font-black text-${s.c}-600 dark:text-${s.c}-400 leading-none`}>{s.v}</div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">{s.l}</div>
              </div>
            </div>
        ))}
      </div>

      {/* --- İÇERİK ALANI --- */}
      <div className="max-w-7xl mx-auto animate-fade-in">
          
        {view === 'calendar' && (
          <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
             <MeetingCalendar meetings={meetings.map(m => ({ ...m, start: m.startTime, end: m.endTime }))} onMeetingClick={handleEditMeeting} />
          </div>
        )}
        
        {view === 'list' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Yaklaşan */}
              <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col h-[700px]">
                  <div className="px-10 py-8 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
                      <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-widest">Yaklaşan Toplantılar</h2>
                  </div>
                  <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                      {upcomingMeetings.length > 0 ? (
                          upcomingMeetings.map(meeting => <MeetingListItem key={meeting.id} meeting={meeting} onEdit={handleEditMeeting} />)
                      ) : (
                          <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-70">
                              <span className="text-6xl mb-4">📭</span>
                              <span className="font-black text-xs uppercase tracking-widest">Yaklaşan kayıt yok</span>
                          </div>
                      )}
                  </div>
              </div>

              {/* Geçmiş */}
              <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col h-[700px]">
                  <div className="px-10 py-8 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
                      <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-widest">Geçmiş Toplantılar</h2>
                  </div>
                  <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-4 opacity-80">
                      {pastMeetings.length > 0 ? (
                          pastMeetings.map(meeting => <MeetingListItem key={meeting.id} meeting={meeting} onEdit={handleEditMeeting} />)
                      ) : (
                          <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-70">
                              <span className="text-6xl mb-4">📭</span>
                              <span className="font-black text-xs uppercase tracking-widest">Geçmiş kayıt yok</span>
                          </div>
                      )}
                  </div>
              </div>
          </div>
        )}

        {view === 'requests' && isManagerOrAdmin && (
          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-10 py-8 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
              <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-widest">Gelen İstekler</h2>
            </div>
            <div className="p-10 bg-gray-50/30 dark:bg-gray-900/30">
              {loadingRequests ? (
                 <div className="flex justify-center items-center h-48"><LoadingSpinner size="large" /></div>
              ) : meetingRequests.length === 0 ? (
                 <div className="py-20 text-center flex flex-col items-center">
                    <span className="text-6xl mb-4 opacity-50">📥</span>
                    <span className="font-black text-xs text-gray-400 uppercase tracking-widest">Bekleyen istek bulunmuyor</span>
                 </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {meetingRequests.map(request => (
                    <MeetingRequestItem key={request.id} request={request} onApprove={handleApproveRequest} onReject={handleRejectRequest} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modallar */}
      <MeetingModal meeting={selectedMeeting} isOpen={showMeetingModal} onClose={handleCloseModal} onSave={fetchAllData} />
      <MeetingRequestModal isOpen={showMeetingRequestModal} onClose={handleCloseRequestModal} onSave={fetchAllData} />
    </div>
  );
};

// --- CİLALANMIŞ COMPONENTLER ---

const MeetingListItem = ({ meeting, onEdit }) => {
  const startTime = meeting.startTime; 
  const isPast = startTime && startTime < new Date();

  return (
    <div
      className={`p-6 border-2 rounded-[2rem] cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group ${isPast ? 'bg-gray-50/80 border-gray-100 dark:bg-gray-900/40 dark:border-gray-800/50' : 'bg-white border-blue-50 dark:bg-gray-800 dark:border-gray-700'}`}
      onClick={() => onEdit(meeting)}
    >
      <div className="flex justify-between items-start gap-4 mb-4">
          <h4 className={`text-lg font-black tracking-tight flex-1 uppercase ${isPast ? 'text-gray-500' : 'text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors'}`}>{meeting.title}</h4>
          <span className={`shrink-0 px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg ${isPast ? 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
            {isPast ? 'TAMAMLANDI' : 'PLANLANDI'}
          </span>
      </div>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 line-clamp-2 mb-6">{meeting.description || 'Açıklama girilmedi.'}</p>
      
      <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-gray-100 dark:border-gray-700/50">
        <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
            <span className="text-base">🕒</span> {startTime?.toLocaleString('tr-TR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
        </div>
        {meeting.location && (
            <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <span className="text-base">📍</span> <span className="truncate max-w-[120px]">{meeting.location}</span>
            </div>
        )}
        <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest ml-auto">
            <span className="text-base">👥</span> {meeting.participants?.length || 1} KİŞİ
        </div>
      </div>
    </div>
  );
};

const MeetingRequestItem = ({ request, onApprove, onReject }) => {
  const isPending = request.status === 'pending';
  
  const getStatusClass = () => {
    if (request.status === 'approved') return 'bg-green-100 text-green-700 border-green-200';
    if (request.status === 'rejected') return 'bg-red-100 text-red-700 border-red-200';
    return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  };

  return (
    <div className={`p-8 border-2 rounded-[2rem] shadow-sm flex flex-col ${isPending ? 'bg-white border-blue-100 dark:bg-gray-800 dark:border-gray-700' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
      <div className="flex justify-between items-start mb-6">
          <div className="flex-1 pr-4">
              <span className={`inline-block px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg border-2 mb-3 ${getStatusClass()}`}>
                  {request.status === 'approved' ? 'ONAYLANDI' : request.status === 'rejected' ? 'REDDEDİLDİ' : 'BEKLEMEDE'}
              </span>
              <h4 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{request.title}</h4>
          </div>
      </div>
      
      <div className="space-y-4 mb-8 flex-1">
          <div>
              <span className="block text-[9px] font-black text-gray-400 uppercase tracking-widest">İlgili Proje</span>
              <span className="block text-sm font-bold text-gray-800 dark:text-gray-200">{request.project_name || '—'}</span>
          </div>
          <div>
              <span className="block text-[9px] font-black text-gray-400 uppercase tracking-widest">Talep Eden</span>
              <span className="block text-sm font-bold text-gray-800 dark:text-gray-200">{request.requested_by_name}</span>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
              <span className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Gündem / Neden</span>
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 italic">{request.reason || '—'}</span>
          </div>
      </div>

      <div className="flex flex-wrap gap-4 pt-6 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-widest">
            <span className="text-lg">📅</span> {request.preferred_date ? new Date(request.preferred_date).toLocaleDateString('tr-TR') : 'BELİRTİLMEDİ'}
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-widest">
            <span className="text-lg">🕒</span> {request.preferred_time || 'BELİRTİLMEDİ'}
          </div>
      </div>

      {isPending && (
        <div className="flex gap-3 mt-8">
            <button onClick={() => onReject(request.request_id)} className="flex-1 py-4 bg-gray-100 hover:bg-red-600 hover:text-white text-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">REDDET</button>
            <button onClick={() => onApprove(request.request_id)} className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all">ONAYLA & KUR</button>
        </div>
      )}
    </div>
  );
};

export default Meetings;