import React, { useState, useEffect, useMemo } from 'react'; // YENİ: useMemo eklendi
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

  // YENİ: Mevcut tarih ve saat için state
  const [defaultDate, setDefaultDate] = useState(new Date());

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

  useEffect(() => {
    setDebugInfo(`${meetings.length} toplantı, ${calendarEvents.length} event`);
    console.log('🔍 Meetings data:', meetings);
    console.log('🎯 Calendar events:', calendarEvents);
  }, [meetings, calendarEvents]);

  // YENİ: View değiştiğinde tarihi güncelle
  useEffect(() => {
    const now = new Date();
    setDefaultDate(now);
    
    // Eğer hafta veya gün görünümündeyse, mevcut saate göre ayarla
    if (view === 'week' || view === 'day') {
      setCurrentDate(now);
    }
  }, [view]);

  // YENİ: Haftalık görünüm için scroll saati - useMemo ile optimize
  const scrollToTime = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0);
  }, []);

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

  // View değiştiğinde
  const handleViewChange = (newView) => {
    setView(newView);
    
    // YENİ: Hafta veya gün görünümüne geçerken mevcut tarihe git
    if (newView === 'week' || newView === 'day') {
      setCurrentDate(new Date());
    }
  };

  // Bugün butonuna tıklama
  const handleTodayClick = () => {
    const now = new Date();
    setCurrentDate(now);
    setDefaultDate(now);
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-6">
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Toplantı Takvimi</h2>
        
        {/* Görünüm Seçenekleri */}
        <div className="flex space-x-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {['month', 'week', 'day', 'agenda'].map((viewType) => (
            <button
              key={viewType}
              onClick={() => handleViewChange(viewType)}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors capitalize ${
                view === viewType 
                  ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              {messages[viewType] || viewType}
            </button>
          ))}
        </div>
      </div>

      {/* Takvim */}
      <div className="h-[500px]">
        <Calendar
          localizer={localizer}
          events={calendarEvents}
          startAccessor="start"
          endAccessor="end"
          views={['month', 'week', 'day', 'agenda']}
          view={view}
          date={currentDate}
          onView={handleViewChange}
          onNavigate={setCurrentDate}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          selectable
          popup
          eventPropGetter={eventStyleGetter}
          messages={messages}
          step={30}
          showMultiDayTimes
          defaultDate={defaultDate}
          scrollToTime={scrollToTime}
          style={{ 
            height: '100%',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}
          components={{
            event: CustomEvent,
            toolbar: (props) => <CustomToolbar {...props} onTodayClick={handleTodayClick} />
          }}
        />
      </div>

      {/* Lejant */}
      <div className="mt-4 flex flex-wrap gap-3 text-xs">
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-blue-500 rounded"></div>
          <span className="text-gray-700 dark:text-gray-300">Gelecek</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-red-500 rounded"></div>
          <span className="text-gray-700 dark:text-gray-300">Devam Eden</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-gray-500 rounded"></div>
          <span className="text-gray-700 dark:text-gray-300">Geçmiş</span>
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
      <div className="font-semibold truncate text-white text-[10px]">{event.title}</div>
      <div className="truncate text-white/90 text-[9px]">{startTime} - {endTime}</div>
      {event.location && (
        <div className="truncate text-white/80 text-[9px]" title={event.location}>📍 {event.location}</div>
      )}
    </div>
  );
};

// Özelleştirilmiş Toolbar Component'i
const CustomToolbar = ({ label, onNavigate, onView, onTodayClick }) => {
  return (
    <div className="flex justify-between items-center mb-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <div className="flex space-x-1">
        <button
          onClick={() => onNavigate('PREV')}
          className="px-2 py-1 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500"
        >
          ‹ Önceki
        </button>
        <button
          onClick={onTodayClick}
          className="px-2 py-1 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500"
        >
          Bugün
        </button>
        <button
          onClick={() => onNavigate('NEXT')}
          className="px-2 py-1 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500"
        >
          Sonraki ›
        </button>
      </div>
      
      <span className="text-md font-semibold text-gray-900 dark:text-white capitalize">
        {label.toLowerCase()}
      </span>
      
      <div className="w-20"></div>
    </div>
  );
};

export default MeetingCalendar;