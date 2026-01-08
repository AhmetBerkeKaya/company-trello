// src/components/Viewer/TaskPin.js
import React, { useState } from 'react';

const TaskPin = ({ task, onClick, style }) => {
  const [hovered, setHovered] = useState(false);

  // PDF'teki görselin aynısı: Kırmızı yuvarlak, beyaz ünlem
  return (
    <div 
      className="absolute z-50 group cursor-pointer"
      style={style} 
      onClick={(e) => { e.stopPropagation(); onClick(task); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Pin İkonu */}
      <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white transform transition-transform hover:scale-110 animate-pulse">
        <span className="text-white font-bold text-lg">!</span>
      </div>

      {/* Tooltip (Siyah Kutu) */}
      {hovered && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-xl z-50">
           {/* Tooltip Başlığı (Sarımsı renk PDF'teki gibi) */}
           <div className="font-bold border-b border-gray-700 pb-1 mb-1 text-yellow-400">
             {task.title}
           </div>
           
           <div className="text-gray-300">
             {task.description ? task.description.substring(0, 30) + '...' : 'Açıklama yok'}
           </div>
           
           {/* Alt Ok İşareti */}
           <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
           
           {/* Buton (Varsa) */}
           <div className="mt-2 pt-1 border-t border-gray-700 text-center text-red-400 font-bold">
              DETAY GÖR &gt;
           </div>
        </div>
      )}
    </div>
  );
};

export default TaskPin;