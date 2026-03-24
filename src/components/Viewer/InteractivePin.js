// src/components/Viewer/InteractivePin.js
import React from 'react';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';

const InteractivePin = ({ task, onDelete }) => {
  const { userData } = useAuth();
  const isHiddenFromClient = !task.is_visible_to_client;
  const showHiddenIcon = isHiddenFromClient && userData?.role !== 'client';

  const handleDelete = async (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!window.confirm(`"${task.title}" başlıklı görev silinsin mi?`)) return;
    try {
      await api.delete(`/tasks/${task.task_id || task.id}`);
      if (onDelete) onDelete();
    } catch (error) { alert('Silinemedi'); }
  };

  const getPinColor = () => {
    if (task.status === 'done' || task.status === 'completed') return 'bg-green-500';
    if (task.status === 'inProgress') return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div
      className="absolute transform -translate-x-1/2 -translate-y-full group z-20 cursor-pointer"
      style={{ left: `${task.pin_x}%`, top: `${task.pin_y}%` }}
      onClick={(e) => e.stopPropagation()} 
    >
      <div className={`w-8 h-8 rounded-full border-2 border-white shadow-md flex items-center justify-center text-white font-bold animate-pulse group-hover:scale-110 transition-transform ${getPinColor()} ${isHiddenFromClient ? 'opacity-75' : ''}`}>
        !
        {showHiddenIcon && <span className="absolute -top-2 -right-2 bg-gray-800 text-white text-[8px] px-1 rounded-full border border-white">👁️‍🗨️</span>}
      </div>

      {/* mb-2 YERİNE pb-3 EKLENDİ - GÖRÜNMEZ KÖPRÜ KURULDU */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 pb-3 hidden group-hover:block z-30 cursor-default">
          <div className="w-56 bg-gray-900 text-white text-xs p-4 rounded-xl shadow-2xl relative flex flex-col items-center">
              <div className="font-bold border-b border-gray-700 pb-2 mb-2 text-yellow-400 w-full text-center truncate">{task.title}</div>
              <div className="text-gray-300 mb-3 w-full text-center text-[10px] whitespace-pre-wrap">{task.description || 'Açıklama girilmemiş.'}</div>
              {isHiddenFromClient && <div className="text-[9px] text-yellow-300 italic mb-3">(Müşteriye Gizli)</div>}
              
              <div className="mt-1 pt-2 border-t border-gray-700 flex justify-center w-full">
                 <button onClick={handleDelete} className="text-red-400 font-bold hover:text-red-300 uppercase tracking-widest text-[10px] transition-colors px-4 py-1">Sil</button>
              </div>
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
          </div>
      </div>
    </div>
  );
};

export default InteractivePin;