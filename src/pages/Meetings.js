import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, addDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import MeetingCalendar from '../components/Meetings/MeetingCalendar';
import MeetingModal from '../components/Meetings/MeetingModal';

const Meetings = () => {
  const { userData } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('calendar'); // 'calendar' or 'list'

  useEffect(() => {
    fetchMeetings();
  }, [userData]);

  const fetchMeetings = async () => {
    if (!userData) return;

    try {
      setLoading(true);

      // GEÇİCİ: Sadece participants ile sorgula (orderBy olmadan)
      const meetingsQuery = query(
        collection(db, 'meetings'),
        where('participants', 'array-contains', userData.id)
        // orderBy kaldırıldı - index gerektirmesin diye
      );

      console.log('🔍 Meetings sorgusu hazır');

      const meetingsSnapshot = await getDocs(meetingsQuery);
      console.log('📊 Meetings sorgu sonucu:', meetingsSnapshot.docs.length, 'toplantı');

      const meetingsData = meetingsSnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('📄 Meeting verisi:', doc.id, data);
        return {
          id: doc.id,
          ...data
        };
      });

      // GEÇİCİ: İstemci tarafında sırala
      meetingsData.sort((a, b) => {
        const dateA = a.startTime?.toDate?.() || new Date(0);
        const dateB = b.startTime?.toDate?.() || new Date(0);
        return dateA - dateB;
      });

      setMeetings(meetingsData);

    } catch (error) {
      console.error('❌ Toplantıları getirme hatası:', error);

      // GEÇİCİ: Hata durumunda tüm toplantıları getir ve filtrele
      try {
        const allMeetingsSnapshot = await getDocs(collection(db, 'meetings'));
        const allMeetings = allMeetingsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // İstemci tarafında filtrele
        const userMeetings = allMeetings.filter(meeting =>
          meeting.participants?.includes(userData.id)
        );

        // İstemci tarafında sırala
        userMeetings.sort((a, b) => {
          const dateA = a.startTime?.toDate?.() || new Date(0);
          const dateB = b.startTime?.toDate?.() || new Date(0);
          return dateA - dateB;
        });

        setMeetings(userMeetings);
        console.log('🔄 Geçici çözüm:', userMeetings.length, 'toplantı');

      } catch (fallbackError) {
        console.error('Geçici çözüm de başarısız:', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMeeting = () => {
    setSelectedMeeting(null);
    setShowMeetingModal(true);
  };

  const handleEditMeeting = (meeting) => {
    setSelectedMeeting(meeting);
    setShowMeetingModal(true);
  };

  const handleCloseModal = () => {
    setShowMeetingModal(false);
    setSelectedMeeting(null);
  };

  // Yaklaşan toplantıları filtrele
  const upcomingMeetings = meetings.filter(meeting => {
    const meetingTime = meeting.startTime?.toDate?.();
    return meetingTime && meetingTime > new Date();
  });

  // Geçmiş toplantıları filtrele
  const pastMeetings = meetings.filter(meeting => {
    const meetingTime = meeting.startTime?.toDate?.();
    return meetingTime && meetingTime <= new Date();
  });

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
          <h1 className="text-3xl font-bold text-gray-900">Toplantılarım</h1>
          <p className="text-gray-600 mt-2">
            Toplantılarınızı takvim üzerinden takip edin ve yönetin.
          </p>
        </div>

        <div className="flex items-center space-x-4">
          {/* View Toggle */}
          <div className="bg-gray-100 rounded-lg p-1 flex">
            <button
              onClick={() => setView('calendar')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${view === 'calendar'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              📅 Takvim
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${view === 'list'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              📋 Liste
            </button>
          </div>

          {/* Yeni Toplantı Butonu */}
          <button
            onClick={handleCreateMeeting}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
          >
            <span>+</span>
            <span>Yeni Toplantı</span>
          </button>
        </div>
      </div>

      {/* İstatistik Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <span className="text-2xl">📅</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Toplam Toplantı</p>
              <p className="text-2xl font-semibold text-gray-900">{meetings.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              <span className="text-2xl">🕒</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Yaklaşan</p>
              <p className="text-2xl font-semibold text-gray-900">{upcomingMeetings.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-gray-100 text-gray-600">
              <span className="text-2xl">✅</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Tamamlanan</p>
              <p className="text-2xl font-semibold text-gray-900">{pastMeetings.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 text-purple-600">
              <span className="text-2xl">👥</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Bu Hafta</p>
              <p className="text-2xl font-semibold text-gray-900">
                {meetings.filter(meeting => {
                  const meetingTime = meeting.startTime?.toDate?.();
                  const oneWeekAgo = new Date();
                  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                  return meetingTime && meetingTime > oneWeekAgo;
                }).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* İçerik - Takvim veya Liste Görünümü */}
      {view === 'calendar' ? (
        <MeetingCalendar
          meetings={meetings}
          onMeetingClick={handleEditMeeting}
        />
      ) : (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Toplantı Listesi</h2>
          </div>
          <div className="p-6">
            {/* Yaklaşan Toplantılar */}
            <div className="mb-8">
              <h3 className="text-md font-semibold text-gray-900 mb-4">Yaklaşan Toplantılar</h3>
              {upcomingMeetings.length > 0 ? (
                <div className="space-y-3">
                  {upcomingMeetings.map(meeting => (
                    <MeetingListItem
                      key={meeting.id}
                      meeting={meeting}
                      onEdit={handleEditMeeting}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Yaklaşan toplantı bulunmuyor</p>
              )}
            </div>

            {/* Geçmiş Toplantılar */}
            <div>
              <h3 className="text-md font-semibold text-gray-900 mb-4">Geçmiş Toplantılar</h3>
              {pastMeetings.length > 0 ? (
                <div className="space-y-3">
                  {pastMeetings.map(meeting => (
                    <MeetingListItem
                      key={meeting.id}
                      meeting={meeting}
                      onEdit={handleEditMeeting}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Geçmiş toplantı bulunmuyor</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toplantı Modal'ı */}
      <MeetingModal
        meeting={selectedMeeting}
        isOpen={showMeetingModal}
        onClose={handleCloseModal}
        onSave={fetchMeetings}
      />
    </div>
  );
};

// Toplantı Listesi Item Component'i
const MeetingListItem = ({ meeting, onEdit }) => {
  const startTime = meeting.startTime?.toDate?.();
  const endTime = meeting.endTime?.toDate?.();
  const isPast = startTime && startTime < new Date();

  return (
    <div
      className={`p-4 border rounded-lg cursor-pointer hover:shadow-md transition-shadow ${isPast ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'
        }`}
      onClick={() => onEdit(meeting)}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h4 className="font-medium text-gray-900">{meeting.title}</h4>
          <p className="text-sm text-gray-600 mt-1">{meeting.description}</p>

          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
            <span>🕒 {startTime?.toLocaleString('tr-TR')}</span>
            {meeting.location && <span>📍 {meeting.location}</span>}
            <span>👥 {meeting.participants?.length || 1} katılımcı</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 text-xs rounded-full ${isPast ? 'bg-gray-100 text-gray-800' : 'bg-green-100 text-green-800'
            }`}>
            {isPast ? 'Tamamlandı' : 'Planlandı'}
          </span>
          <button className="text-blue-600 hover:text-blue-800 text-sm">
            Detay
          </button>
        </div>
      </div>
    </div>
  );
};

export default Meetings;