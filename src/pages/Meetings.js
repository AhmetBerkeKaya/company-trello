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
  const [meetingRequests, setMeetingRequests] = useState([]); // YENİ
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showMeetingRequestModal, setShowMeetingRequestModal] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('calendar'); // 'calendar', 'list', 'requests'
  const [loadingRequests, setLoadingRequests] = useState(false); // YENİ

  const isManagerOrAdmin = userData?.role === 'admin' || userData?.role === 'manager';

  // YENİ: URL'den '?view=requests' parametresini oku
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
    // Tüm verileri çek
    fetchAllData();
  }, [userData]);

  const fetchAllData = async () => {
    if (!userData) return;
    setLoading(true);
    try {
      // Her iki API isteğini de aynı anda yap
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

  // YENİ: Toplantı İsteklerini Çek
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

  // YENİ: İsteği Onayla
  const handleApproveRequest = async (requestId) => {
    if (!window.confirm('Bu toplantı isteğini onaylayıp, ilgili proje üyeleri ve yöneticilerle bir toplantı oluşturmak istediğinizden emin misiniz?')) return;
    
    setLoadingRequests(true);
    try {
      await api.put(`/meeting-requests/${requestId}/approve`);
      await fetchMeetingRequests(); // İstek listesini yenile
      await fetchMeetings();      // Toplantı listesini yenile
      alert('✅ İstek onaylandı ve toplantı oluşturuldu!');
    } catch (error) {
      console.error('İstek onaylama hatası:', error);
      alert('İstek onaylanırken bir hata oluştu: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoadingRequests(false);
    }
  };

  // YENİ: İsteği Reddet
  const handleRejectRequest = async (requestId) => {
    if (!window.confirm('Bu toplantı isteğini reddetmek istediğinizden emin misiniz?')) return;
    
    setLoadingRequests(true);
    try {
      await api.put(`/meeting-requests/${requestId}/reject`);
      await fetchMeetingRequests(); // İstek listesini yenile
      alert('❌ İstek reddedildi.');
    } catch (error) {
      console.error('İstek reddetme hatası:', error);
      alert('İstek reddedilirken bir hata oluştu: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoadingRequests(false);
    }
  };

  // --- Modal Fonksiyonları (Artık çalışıyor) ---
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

  // Filtreleme
  const upcomingMeetings = meetings.filter(meeting => meeting.startTime && meeting.startTime > new Date());
  const pastMeetings = meetings.filter(meeting => meeting.startTime && meeting.startTime <= new Date());
  const pendingRequests = meetingRequests.filter(req => req.status === 'pending');

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="large" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Toplantılarım</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Toplantılarınızı takip edin, yönetin ve istekleri değerlendirin.
          </p>
        </div>

        <div className="flex items-center space-x-4">
          {/* YENİ: View Toggle (İstekler eklendi) */}
          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-1 flex">
            <button
              onClick={() => setView('calendar')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${view === 'calendar'
                  ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
            >
              📅 Takvim
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${view === 'list'
                  ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
            >
              📋 Ajanda
            </button>
            {isManagerOrAdmin && (
              <button
                onClick={() => setView('requests')}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors relative ${view === 'requests'
                    ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
              >
                📥 İstekler
                {pendingRequests.length > 0 && (
                   <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                     {pendingRequests.length}
                   </span>
                )}
              </button>
            )}
          </div>

          {/* Butonlar */}
          <div className="flex space-x-2">
            {userData?.role === 'user' && (
              <button
                onClick={handleCreateMeetingRequest}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
              >
                <span>📨</span>
                <span>Toplantı İsteği</span>
              </button>
            )}
            {isManagerOrAdmin && (
              <button
                onClick={handleCreateMeeting}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
              >
                <span>+</span>
                <span>Yeni Toplantı</span>
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* İstatistik Kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-4">
          <div className="flex items-center">
            <div className="p-2 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300">
              <span className="text-xl">📅</span>
            </div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Toplam Toplantı</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{meetings.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-4">
          <div className="flex items-center">
            <div className="p-2 rounded-full bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-300">
              <span className="text-xl">🕒</span>
            </div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Yaklaşan</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{upcomingMeetings.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-4">
          <div className="flex items-center">
            <div className="p-2 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
              <span className="text-xl">✅</span>
            </div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Tamamlanan</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{pastMeetings.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-4">
          <div className="flex items-center">
            <div className="p-2 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-300">
              <span className="text-xl">👥</span>
            </div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Bu Hafta</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {meetings.filter(meeting => {
                  const oneWeekAgo = new Date();
                  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                  return meeting.startTime && meeting.startTime > oneWeekAgo;
                }).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* İçerik - Takvim veya Liste Görünümü */}
      {view === 'calendar' && (
        <MeetingCalendar
          meetings={meetings.map(m => ({ ...m, start: m.startTime, end: m.endTime }))}
          onMeetingClick={handleEditMeeting}
        />
      )}
      
      {view === 'list' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Toplantı Ajandası</h2>
          </div>
          <div className="p-6">
            <div className="mb-8">
              <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-4">Yaklaşan Toplantılar</h3>
              {upcomingMeetings.length > 0 ? (
                <div className="space-y-3">
                  {upcomingMeetings.map(meeting => (
                    <MeetingListItem key={meeting.id} meeting={meeting} onEdit={handleEditMeeting} />
                  ))}
                </div>
              ) : (<p className="text-gray-500 dark:text-gray-400 text-sm">Yaklaşan toplantı bulunmuyor</p>)}
            </div>
            <div>
              <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-4">Geçmiş Toplantılar</h3>
              {pastMeetings.length > 0 ? (
                <div className="space-y-3">
                  {pastMeetings.map(meeting => (
                    <MeetingListItem key={meeting.id} meeting={meeting} onEdit={handleEditMeeting} />
                  ))}
                </div>
              ) : (<p className="text-gray-500 dark:text-gray-400 text-sm">Geçmiş toplantı bulunmuyor</p>)}
            </div>
          </div>
        </div>
      )}

      {/* YENİ: Toplantı İstekleri Görünümü */}
      {view === 'requests' && isManagerOrAdmin && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Toplantı İstekleri</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Kullanıcılardan gelen toplantı taleplerini yönetin.
            </p>
          </div>
          <div className="p-6">
            {loadingRequests ? (
               <div className="flex justify-center items-center h-48">
                  <LoadingSpinner size="large" />
                </div>
            ) : meetingRequests.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">Bekleyen toplantı isteği bulunmuyor.</p>
            ) : (
              <div className="space-y-4">
                {meetingRequests.map(request => (
                  <MeetingRequestItem 
                    key={request.id} 
                    request={request} 
                    onApprove={handleApproveRequest}
                    onReject={handleRejectRequest}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modallar */}
      <MeetingModal
        meeting={selectedMeeting}
        isOpen={showMeetingModal}
        onClose={handleCloseModal}
        onSave={fetchAllData}
      />
      <MeetingRequestModal
        isOpen={showMeetingRequestModal}
        onClose={handleCloseRequestModal}
        onSave={fetchAllData}
      />
    </div>
  );
};

// DÜZELTME: EKSİK OLAN COMPONENT BURAYA EKLENDİ
const MeetingListItem = ({ meeting, onEdit }) => {
  const startTime = meeting.startTime; // Artık bir Date objesi
  const isPast = startTime && startTime < new Date();

  return (
    <div
      className={`p-4 border rounded-lg cursor-pointer hover:shadow-md dark:hover:shadow-gray-900/70 transition-shadow ${isPast
          ? 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
        }`}
      onClick={() => onEdit(meeting)}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h4 className="font-medium text-gray-900 dark:text-white">{meeting.title}</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{meeting.description}</p>
          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500 dark:text-gray-500">
            <span>🕒 {startTime?.toLocaleString('tr-TR')}</span>
            {meeting.location && <span>📍 {meeting.location}</span>}
            {/* API'den gelen 'participants_list' (JSON dizisi) */}
            <span>👥 {meeting.participants?.length || 1} katılımcı</span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 text-xs rounded-full ${isPast
              ? 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300'
              : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
            }`}>
            {isPast ? 'Tamamlandı' : 'Planlandı'}
          </span>
          <button className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm">
            Detay
          </button>
        </div>
      </div>
    </div>
  );
};

// DÜZELTME: EKSİK OLAN COMPONENT BURAYA EKLENDİ
const MeetingRequestItem = ({ request, onApprove, onReject }) => {
  const isPending = request.status === 'pending';
  
  const getStatusClass = () => {
    if (request.status === 'approved') return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
    if (request.status === 'rejected') return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
  };
  
  const getStatusText = () => {
    if (request.status === 'approved') return 'Onaylandı';
    if (request.status === 'rejected') return 'Reddedildi';
    return 'Beklemede';
  };

  return (
    <div className={`p-4 border rounded-lg ${isPending ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700/50 opacity-70'} border-gray-200 dark:border-gray-700`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h4 className="font-medium text-gray-900 dark:text-white">{request.title}</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            <strong>Proje:</strong> {request.project_name || 'Proje Belirtilmemiş'}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            <strong>Talep Eden:</strong> {request.requested_by_name}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            <strong>Neden:</strong> {request.reason}
          </p>
          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500 dark:text-gray-500">
            {/* DÜZELTME: 'preferred_date' string'ini Date'e çevir */}
            <span>📅 <strong>İstenen Tarih:</strong> {request.preferred_date ? new Date(request.preferred_date).toLocaleDateString('tr-TR') : 'Belirtilmemiş'}</span>
            <span>🕒 <strong>İstenen Saat:</strong> {request.preferred_time || 'Belirtilmemiş'}</span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className={`px-2 py-1 text-xs rounded-full ${getStatusClass()}`}>
            {getStatusText()}
          </span>
          {isPending && (
            <div className="flex space-x-2 mt-4">
              <button 
                onClick={() => onReject(request.request_id)} // request.id -> request.request_id
                className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Reddet
              </button>
              <button 
                onClick={() => onApprove(request.request_id)} // request.id -> request.request_id
                className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                Onayla
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Meetings;