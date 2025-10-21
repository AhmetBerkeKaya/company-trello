import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, addDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import MeetingCalendar from '../components/Meetings/MeetingCalendar';
import MeetingModal from '../components/Meetings/MeetingModal';
import MeetingRequestModal from '../components/Meetings/MeetingRequestModal'; // YENİ: Toplantı isteği modal'ı
import { useLocation } from 'react-router-dom';

const Meetings = () => {
  const { userData } = useAuth();
  const location = useLocation();
  const [meetings, setMeetings] = useState([]);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showMeetingRequestModal, setShowMeetingRequestModal] = useState(false); // YENİ: Toplantı isteği modal state'i
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('calendar');

  useEffect(() => {
    if (location.state?.activeTab === 'agenda') {
      setView('list');
    }
  }, [location.state]);

  useEffect(() => {
    fetchMeetings();
  }, [userData]);

  const fetchMeetings = async () => {
    if (!userData) return;

    try {
      setLoading(true);
      const meetingsQuery = query(
        collection(db, 'meetings'),
        where('participants', 'array-contains', userData.id)
      );

      const meetingsSnapshot = await getDocs(meetingsQuery);
      const meetingsData = meetingsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data
        };
      });

      meetingsData.sort((a, b) => {
        const dateA = a.startTime?.toDate?.() || new Date(0);
        const dateB = b.startTime?.toDate?.() || new Date(0);
        return dateA - dateB;
      });

      setMeetings(meetingsData);
    } catch (error) {
      console.error('❌ Toplantıları getirme hatası:', error);
      try {
        const allMeetingsSnapshot = await getDocs(collection(db, 'meetings'));
        const allMeetings = allMeetingsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        const userMeetings = allMeetings.filter(meeting =>
          meeting.participants?.includes(userData.id)
        );

        userMeetings.sort((a, b) => {
          const dateA = a.startTime?.toDate?.() || new Date(0);
          const dateB = b.startTime?.toDate?.() || new Date(0);
          return dateA - dateB;
        });

        setMeetings(userMeetings);
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

  // YENİ: Toplantı isteği oluşturma
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

  // YENİ: Toplantı isteği modal'ını kapatma
  const handleCloseRequestModal = () => {
    setShowMeetingRequestModal(false);
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Toplantılarım</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Toplantılarınızı takvim üzerinden takip edin ve yönetin.
          </p>
        </div>

        <div className="flex items-center space-x-4">
          {/* View Toggle */}
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
          </div>

          {/* Butonlar - YENİ: Kullanıcılar için toplantı isteği butonu */}
          <div className="flex space-x-2">
            {/* Kullanıcılar için Toplantı İsteği Butonu */}
            {userData?.role === 'user' && (
              <button
                onClick={handleCreateMeetingRequest}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
              >
                <span>📨</span>
                <span>Toplantı İsteği</span>
              </button>
            )}

            {/* Admin ve Manager için Normal Toplantı Oluşturma Butonu */}
            {(userData?.role === 'admin' || userData?.role === 'manager') && (
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

      {/* İstatistik Kartları - Kompakt versiyon */}
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Toplantı Ajandası</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Tüm toplantılarınızın listesi
            </p>
          </div>
          <div className="p-6">
            {/* Yaklaşan Toplantılar */}
            <div className="mb-8">
              <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-4">Yaklaşan Toplantılar</h3>
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
                <p className="text-gray-500 dark:text-gray-400 text-sm">Yaklaşan toplantı bulunmuyor</p>
              )}
            </div>

            {/* Geçmiş Toplantılar */}
            <div>
              <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-4">Geçmiş Toplantılar</h3>
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
                <p className="text-gray-500 dark:text-gray-400 text-sm">Geçmiş toplantı bulunmuyor</p>
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

      {/* YENİ: Toplantı İsteği Modal'ı */}
      <MeetingRequestModal
        isOpen={showMeetingRequestModal}
        onClose={handleCloseRequestModal}
        onSave={fetchMeetings}
      />
    </div>
  );
};

// MeetingListItem component'i
const MeetingListItem = ({ meeting, onEdit }) => {
  const startTime = meeting.startTime?.toDate?.();
  const endTime = meeting.endTime?.toDate?.();
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

export default Meetings;