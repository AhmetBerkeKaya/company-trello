// src/components/Viewer/TaskPin.js
import React, { useState, useRef } from 'react';

const TaskPin = ({ task, onClick, onDelete, style }) => {
  const [hovered, setHovered] = useState(false);
  const timeoutRef = useRef(null);

  // Kapanma toleransı (Gecikme)
  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setHovered(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setHovered(false);
    }, 300); // 300ms boyunca kutu kapanmaz, fareye yetişme payı verir
  };

  return (
    <div 
      className="absolute z-50 cursor-pointer"
      style={style} 
      onClick={(e) => { e.stopPropagation(); if (onClick) onClick(task); }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Pin İkonu */}
      <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white transform transition-transform hover:scale-110 animate-pulse">
        <span className="text-white font-bold text-lg">!</span>
      </div>

      {/* Tooltip (Siyah Kutu) - KOPUKLUK GİDERİLDİ */}
      {hovered && (
        <div 
          className="absolute bottom-full left-1/2 transform -translate-x-1/2 pb-3 z-50 cursor-default" 
          onClick={(e) => e.stopPropagation()}
        >
           {/* pb-3 (padding-bottom) ile görünmez bir köprü kurduk */}
           <div className="w-56 bg-gray-900 text-white text-xs rounded-xl py-3 px-4 shadow-2xl relative">
               <div className="font-bold border-b border-gray-700 pb-2 mb-2 text-yellow-400 text-center truncate">
                 {task.title}
               </div>
               <div className="text-gray-300 text-center mb-3 text-[10px] whitespace-pre-wrap">
                 {task.description || 'Açıklama girilmemiş.'}
               </div>
               
               <div className="flex justify-between items-center border-t border-gray-700 pt-3">
                  <button onClick={(e) => { e.stopPropagation(); if (onDelete) onDelete(task); setHovered(false); }} className="text-red-400 font-bold hover:text-red-300 text-[10px] uppercase tracking-widest transition-colors px-2 py-1">Sil</button>
                  <button onClick={(e) => { e.stopPropagation(); if (onClick) onClick(task); setHovered(false); }} className="text-blue-400 font-bold hover:text-blue-300 text-[10px] uppercase tracking-widest transition-colors px-2 py-1">Detay &gt;</button>
               </div>
               {/* Alt Ok İşareti */}
               <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
           </div>
        </div>
      )}
    </div>
  );
};

export default TaskPin;