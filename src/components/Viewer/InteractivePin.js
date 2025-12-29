// src/components/Viewer/InteractivePin.js
import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext'; // YENİ

const InteractivePin = ({ task, containerRef, onUpdate, onDelete, onDragStart, onDragEnd }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: task.pin_x, y: task.pin_y });
  const { userData } = useAuth(); // YENİ

  // Müşteriye gizli mi kontrolü (Yetkililer için görsel ipucu)
  const isHiddenFromClient = !task.is_visible_to_client;
  const showHiddenIcon = isHiddenFromClient && userData?.role !== 'client';

  const handleMouseDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);
    if (onDragStart) onDragStart();
  };

  const handleMouseUp = async (e) => {
    if (!isDragging) return;
    setIsDragging(false);
    if (onDragEnd) onDragEnd();
    e.stopPropagation();

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const xPercent = (x / rect.width) * 100;
      const yPercent = (y / rect.height) * 100;

      const finalX = Math.max(0, Math.min(100, xPercent));
      const finalY = Math.max(0, Math.min(100, yPercent));

      setPosition({ x: finalX, y: finalY });

      try {
        await api.put(`/tasks/${task.id}/location`, { pinX: finalX, pinY: finalY });
        if (onUpdate) onUpdate(); 
      } catch (error) {
        console.error('Pin taşınamadı:', error);
      }
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setPosition({ x: (x / rect.width) * 100, y: (y / rect.height) * 100 });
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleDelete = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`"${task.title}" silinsin mi?`)) return;
    
    try {
      await api.delete(`/tasks/${task.id}`);
      if (onDelete) onDelete(task.id);
    } catch (error) {
      alert('Silinemedi');
    }
  };

  const handleTooltipClick = (e) => e.stopPropagation();

  const getPinColor = () => {
    if (task.status === 'done' || task.status === 'completed') return 'bg-green-500';
    if (task.status === 'inProgress') return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div
      className="absolute transform -translate-x-1/2 -translate-y-full group z-20"
      style={{ left: `${position.x}%`, top: `${position.y}%` }}
      onMouseDown={handleMouseDown}
      onClick={(e) => e.stopPropagation()} 
    >
      <div className={`w-8 h-8 rounded-full border-2 border-white shadow-md flex items-center justify-center text-white font-bold cursor-grab active:cursor-grabbing ${getPinColor()} ${isHiddenFromClient ? 'opacity-75' : ''}`}>
        !
        {/* Gizli İkonu (Sadece yetkililere) */}
        {showHiddenIcon && (
            <span className="absolute -top-2 -right-2 bg-gray-800 text-white text-[8px] px-1 rounded-full border border-white">
                👁️‍🗨️
            </span>
        )}
      </div>

      {!isDragging && (
        <div 
            className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center w-40 bg-gray-900 text-white text-xs p-2 rounded shadow-lg z-30"
            onMouseDown={(e) => e.stopPropagation()} 
            onClick={handleTooltipClick}
        >
          <p className="font-bold truncate w-full text-center mb-1">{task.title}</p>
          {isHiddenFromClient && <p className="text-[10px] text-yellow-300 italic mb-1">(Müşteriye Gizli)</p>}
          <div className="flex gap-2 w-full">
            <button onClick={handleDelete} className="flex-1 bg-red-600 hover:bg-red-700 py-1 rounded text-[10px] text-white">Sil</button>
          </div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
};

export default InteractivePin;