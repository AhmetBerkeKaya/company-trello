import React, { useState, useEffect } from 'react'; // YENİ: useEffect eklendi
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'moment/locale/tr';

// Türkçe lokalizasyon
moment.locale('tr');
const localizer = momentLocalizer(moment);

const MeetingCalendar = ({ meetings, onMeetingClick }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month');
  const [debugInfo, setDebugInfo] = useState('');

  // Toplantıları calendar formatına çevir
  const calendarEvents = meetings.map(meeting => {
    const start = meeting.startTime?.toDate?.() || new Date();
    const end = meeting.endTime?.toDate?.() || new Date(start.getTime() + 60 * 60 * 1000);
    
    console.log('📅 Meeting:', meeting.title, 'Start:', start, 'End:', end);
    
    return {
      id: meeting.id,
      title: meeting.title,
      start: start,
      end: end,
      resource: meeting,
      description: meeting.description,
      location: meeting.location,
      participants: meeting.participants
    };
  });

  // YENİ: useEffect import edildi, artık çalışacak
  useEffect(() => {
    setDebugInfo(`${meetings.length} toplantı, ${calendarEvents.length} event`);
    console.log('🔍 Meetings data:', meetings);
    console.log('🎯 Calendar events:', calendarEvents);
  }, [meetings, calendarEvents]);

  // Takvim event stilini özelleştir
  const eventStyleGetter = (event) => {
    const now = new Date();
    const isPast = event.end < now;
    const isCurrent = event.start <= now && event.end >= now;

    let backgroundColor = '#3498db'; // Varsayılan mavi
    
    if (isPast) {
      backgroundColor = '#95a5a6'; // Gri - geçmiş
    } else if (isCurrent) {
      backgroundColor = '#e74c3c'; // Kırmızı - devam eden
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '5px',
        opacity: isPast ? 0.7 : 1,
        color: 'white',
        border: '0px',
        display: 'block'
      }
    };
  };

  // Event'a tıklama
  const handleSelectEvent = (event) => {
    onMeetingClick(event.resource);
  };

  // Tarih seçme
  const handleSelectSlot = ({ start, end }) => {
    console.log('Seçilen slot:', start, end);
  };

  // Türkçe mesajlar
  const messages = {
    allDay: 'Tüm gün',
    previous: 'Önceki',
    next: 'Sonraki',
    today: 'Bugün',
    month: 'Ay',
    week: 'Hafta',
    day: 'Gün',
    agenda: 'Ajanda',
    date: 'Tarih',
    time: 'Saat',
    event: 'Toplantı',
    noEventsInRange: 'Bu aralıkta toplantı bulunmuyor',
    showMore: (total) => `+ ${total} daha`
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Debug Bilgisi */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
        <div className="flex justify-between items-center">
          <div>
            <h4 className="text-sm font-medium text-blue-800">Debug Bilgisi</h4>
            <p className="text-sm text-blue-600">{debugInfo}</p>
          </div>
          <button
            onClick={() => console.log('Events:', calendarEvents)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
          >
            Console'da Gör
          </button>
        </div>
      </div>

      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">Toplantı Takvimi</h2>
        
        {/* Görünüm Seçenekleri */}
        <div className="flex space-x-2 bg-gray-100 rounded-lg p-1">
          {['month', 'week', 'day', 'agenda'].map((viewType) => (
            <button
              key={viewType}
              onClick={() => setView(viewType)}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors capitalize ${
                view === viewType 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {messages[viewType] || viewType}
            </button>
          ))}
        </div>
      </div>

      {/* Takvim */}
      <div className="h-[600px]">
        <Calendar
          localizer={localizer}
          events={calendarEvents}
          startAccessor="start"
          endAccessor="end"
          views={['month', 'week', 'day', 'agenda']}
          view={view}
          date={currentDate}
          onView={setView}
          onNavigate={setCurrentDate}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          selectable
          popup
          eventPropGetter={eventStyleGetter}
          messages={messages}
          step={30}
          showMultiDayTimes
          defaultDate={new Date()}
          style={{ 
            height: '100%',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}
          components={{
            event: CustomEvent,
            toolbar: CustomToolbar
          }}
        />
      </div>

      {/* Lejant */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-blue-500 rounded"></div>
          <span>Gelecek Toplantı</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-red-500 rounded"></div>
          <span>Devam Eden</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-gray-500 rounded"></div>
          <span>Geçmiş</span>
        </div>
      </div>
    </div>
  );
};

// Özelleştirilmiş Event Component'i
const CustomEvent = ({ event }) => {
  const startTime = moment(event.start).format('HH:mm');
  const endTime = moment(event.end).format('HH:mm');
  
  return (
    <div className="p-1 text-xs leading-tight">
      <div className="font-semibold truncate">{event.title}</div>
      <div className="truncate">{startTime} - {endTime}</div>
      {event.location && (
        <div className="truncate" title={event.location}>📍 {event.location}</div>
      )}
    </div>
  );
};

// Özelleştirilmiş Toolbar Component'i
const CustomToolbar = ({ label, onNavigate, onView }) => {
  return (
    <div className="flex justify-between items-center mb-4 p-2 bg-gray-50 rounded-lg">
      <div className="flex space-x-2">
        <button
          onClick={() => onNavigate('PREV')}
          className="px-3 py-1 bg-white border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          ‹ Önceki
        </button>
        <button
          onClick={() => onNavigate('TODAY')}
          className="px-3 py-1 bg-white border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Bugün
        </button>
        <button
          onClick={() => onNavigate('NEXT')}
          className="px-3 py-1 bg-white border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Sonraki ›
        </button>
      </div>
      
      <span className="text-lg font-semibold text-gray-900 capitalize">
        {label.toLowerCase()}
      </span>
      
      <div className="w-24"></div> {/* Boşluk için */}
    </div>
  );
};

export default MeetingCalendar;