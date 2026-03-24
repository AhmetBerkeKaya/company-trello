// src/components/Viewer/ViewerContainer.js
import React, { useState, useEffect } from 'react';
import FileExplorer from './FileExplorer';
import ImageMapper from './ImageMapper'; 
import PDFMapper from './PDFMapper';
import ForgeViewer from './ForgeViewer'; 
import ThreeDMapper from './ThreeDMapper'; 
import api from '../../api/axios';

const ViewerContainer = ({ projectId }) => {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]); // YENİ

  const fetchTasksAndMembers = async () => {
    try {
      if (!projectId) return;
      const [tasksRes, membersRes] = await Promise.all([
        api.get(`/projects/${projectId}/tasks`),
        api.get(`/projects/${projectId}/members`)
      ]);
      setTasks(tasksRes.data);
      setProjectMembers(membersRes.data);
    } catch (error) { 
      console.error('Veriler yüklenemedi:', error); 
    }
  };

  useEffect(() => { 
    if (projectId) fetchTasksAndMembers(); 
  }, [projectId]);

  const renderMapper = () => {
    if (!selectedPlan) {
      return (
        <div className="h-full flex items-center justify-center text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <div className="text-center">
            <span className="text-4xl block mb-2">📂</span>
            <p>Görüntülemek için soldan bir dosya seçin</p>
          </div>
        </div>
      );
    }

    const name = selectedPlan.name.toLowerCase();

    if (selectedPlan.urn) return <ForgeViewer urn={selectedPlan.urn} tasks={tasks} projectId={projectId} planFileId={selectedPlan.file_id} onTaskCreated={fetchTasksAndMembers} projectMembers={projectMembers} />;
    if (selectedPlan.type?.includes('pdf') || name.endsWith('.pdf')) return <PDFMapper plan={selectedPlan} projectId={projectId} tasks={tasks} onTaskCreated={fetchTasksAndMembers} projectMembers={projectMembers} />;
    if (name.match(/\.(jpg|jpeg|png|webp)$/)) return <ImageMapper plan={selectedPlan} projectId={projectId} tasks={tasks} onTaskCreated={fetchTasksAndMembers} projectMembers={projectMembers} />;
    if (name.match(/\.(gltf|glb)$/)) return <ThreeDMapper plan={selectedPlan} projectId={projectId} tasks={tasks} onTaskCreated={fetchTasksAndMembers} projectMembers={projectMembers} />;

    return (
        <div className="h-full flex flex-col items-center justify-center text-gray-500 bg-gray-50 dark:bg-gray-800/50">
            <div className="text-6xl mb-4">🏗️</div>
            <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300">Görüntüleme Hazır Değil</h3>
            <p className="text-sm mt-2 mb-6 max-w-md text-center">Bu dosya formatı önizlenemez. Lütfen dosyayı indirin.</p>
            <a href={selectedPlan.url} target="_blank" rel="noreferrer" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-colors">⬇️ Dosyayı İndir</a>
        </div>
    );
  };

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-200px)] gap-4">
      <div className="w-full md:w-1/4 h-full min-w-[300px]">
        <FileExplorer projectId={projectId} onSelectPlan={(plan) => setSelectedPlan(plan)} selectedPlanId={selectedPlan?.file_id} onUploadSuccess={() => {}} />
      </div>
      <div className="flex-1 bg-gray-100 dark:bg-gray-900 rounded-lg border border-gray-300 relative overflow-hidden flex flex-col shadow-inner">
        {selectedPlan && (
            <div className="bg-white dark:bg-gray-800 p-2 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center shadow-sm z-20">
              <span className="font-semibold text-sm flex items-center gap-2 text-gray-700 dark:text-gray-200">{selectedPlan.urn ? '🧊 3D Model' : '📄 Dosya'}: {selectedPlan.name}</span>
              <a href={selectedPlan.url} target="_blank" rel="noreferrer" className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded border transition">⬇️ İndir</a>
            </div>
        )}
        <div className="flex-1 relative overflow-hidden w-full h-full">
          {renderMapper()}
        </div>
      </div>
    </div>
  );
};

export default ViewerContainer;