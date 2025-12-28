import React, { useState, useEffect } from 'react';
import PlanUpload from './PlanUpload';
import ImageMapper from './ImageMapper';
import PDFMapper from './PDFMapper'; // YENİ
import api from '../../api/axios';

const ViewerContainer = ({ projectId }) => {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [tasks, setTasks] = useState([]);

  const fetchTasks = async () => {
    try {
      const response = await api.get(`/projects/${projectId}/tasks`);
      setTasks(response.data);
    } catch (error) {
      console.error('Görevler yüklenemedi:', error);
    }
  };

  useEffect(() => {
    if (projectId) fetchTasks();
  }, [projectId]);

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-200px)] gap-4">
      <div className="w-full md:w-1/4 h-full min-w-[300px]">
        <PlanUpload 
          projectId={projectId} 
          onSelectPlan={(plan) => setSelectedPlan(plan)}
          selectedPlanId={selectedPlan?.file_id}
        />
      </div>

      <div className="flex-1 bg-gray-100 dark:bg-gray-900 rounded-lg border border-gray-300 relative overflow-hidden flex flex-col">
        {selectedPlan ? (
          <>
            <div className="bg-white p-2 border-b flex justify-between items-center shadow-sm z-20">
              <span className="font-semibold text-sm">👁️ {selectedPlan.name}</span>
              <a href={selectedPlan.url} target="_blank" className="text-xs text-blue-600">Orijinali İndir</a>
            </div>

            <div className="flex-1 relative overflow-hidden w-full h-full">
              {selectedPlan.type.includes('pdf') ? (
                // ARTIK PDF'DE DE PINLEME VAR!
                <PDFMapper 
                  plan={selectedPlan}
                  projectId={projectId}
                  tasks={tasks}
                  onTaskCreated={fetchTasks}
                  onTaskUpdate={fetchTasks}
                />
              ) : (
                <ImageMapper 
                  plan={selectedPlan}
                  projectId={projectId}
                  tasks={tasks}
                  onTaskCreated={fetchTasks}
                />
              )}
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400">
             <p>Pafta seçin</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewerContainer;