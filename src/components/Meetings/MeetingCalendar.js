import React, { useState, useEffect, useMemo } from 'react';
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
  
  // YENİ: Mevcut tarih ve saat için state
  const [defaultDate, setDefaultDate] = useState(new Date());

  // Toplantıları calendar formatına çevir
  const calendarEvents = useMemo(() => {
    return meetings.map(meeting => {
      // DÜZELTME BURADA YAPILDI:
      // Meetings.js zaten 'start' ve 'end' prop'larını Date objesi olarak gönderiyor.
      // .toDate() firebase metodudur, burada kullanmaya gerek yok.
      // Eğer string gelirse diye new Date() içine alıyoruz.
      
      const start = meeting.start ? new Date(meeting.start) : new Date();
      const end = meeting.end ? new Date(meeting.end) : new Date(start.getTime() + 60 * 60 * 1000);
      
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
  }, [meetings]);

  // View değiştiğinde tarihi güncelle
  useEffect(() => {
    const now = new Date();
    setDefaultDate(now);
    
    if (view === 'week' || view === 'day') {
      setCurrentDate(now);
    }
  }, [view]);

  // Haftalık görünüm için scroll saati
  const scrollToTime = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0); // Sabah 08:00'e odaklan
  }, []);

  // Takvim event stilini özelleştir
  const eventStyleGetter = (event) => {
    const now = new Date();
    const isPast = event.end < now;
    const isCurrent = event.start <= now && event.end >= now;

    let backgroundColor = '#3B82F6'; // Mavi (Gelecek)
    
    if (isPast) {
      backgroundColor = '#6B7280'; // Gri (Geçmiş)
    } else if (isCurrent) {
      backgroundColor = '#EF4444'; // Kırmızı (Şu an)
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '6px',
        opacity: isPast ? 0.8 : 1,
        color: 'white',
        border: '0px',
        display: 'block',
        fontSize: '0.85em'
      }
    };
  };

  const handleSelectEvent = (event) => {
    onMeetingClick(event.resource);
  };

  const handleViewChange = (newView) => {
    setView(newView);
    if (newView === 'week' || newView === 'day') {
      setCurrentDate(new Date());
    }
  };

  const handleTodayClick = () => {
    const now = new Date();
    setCurrentDate(now);
  };

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
      <div className="mb-4 flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Toplantı Takvimi</h2>
        
        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {['month', 'week', 'day', 'agenda'].map((viewType) => (
            <button
              key={viewType}
              onClick={() => handleViewChange(viewType)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
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

      <div className="h-[600px]">
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
          eventPropGetter={eventStyleGetter}
          messages={messages}
          step={30}
          timeslots={2}
          showMultiDayTimes
          defaultDate={defaultDate}
          scrollToTime={scrollToTime}
          style={{ 
            height: '100%',
            fontFamily: 'inherit'
          }}
          components={{
            event: CustomEvent,
            toolbar: (props) => <CustomToolbar {...props} onTodayClick={handleTodayClick} />
          }}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <span className="text-gray-600 dark:text-gray-400">Planlanan</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <span className="text-gray-600 dark:text-gray-400">Şu An / Devam Eden</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
          <span className="text-gray-600 dark:text-gray-400">Tamamlanan / Geçmiş</span>
        </div>
      </div>
    </div>
  );
};

const CustomEvent = ({ event }) => {
  const startTime = moment(event.start).format('HH:mm');
  const endTime = moment(event.end).format('HH:mm');
  
  return (
    <div className="flex flex-col h-full justify-center px-1">
      <div className="font-bold text-[11px] leading-tight truncate">{event.title}</div>
      <div className="text-[10px] opacity-90 truncate">{startTime} - {endTime}</div>
      {event.location && (
        <div className="text-[9px] opacity-80 truncate flex items-center gap-1">
          <span>📍</span> {event.location}
        </div>
      )}
    </div>
  );
};

const CustomToolbar = ({ label, onNavigate, onTodayClick }) => {
  return (
    <div className="flex justify-between items-center mb-4 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-700">
      <div className="flex items-center space-x-1">
        <button
          onClick={() => onNavigate('PREV')}
          className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full text-gray-600 dark:text-gray-300 transition-colors"
          title="Önceki"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <button
          onClick={onTodayClick}
          className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-600 rounded-md border border-transparent hover:border-gray-200 dark:hover:border-gray-500 transition-all"
        >
          Bugün
        </button>
        <button
          onClick={() => onNavigate('NEXT')}
          className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full text-gray-600 dark:text-gray-300 transition-colors"
          title="Sonraki"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
      
      <span className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wide">
        {label}
      </span>
      
      {/* Düzen için boş div */}
      <div className="w-16"></div>
    </div>
  );
};

export default MeetingCalendar;