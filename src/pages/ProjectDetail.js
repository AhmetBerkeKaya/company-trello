// src/pages/ProjectDetail.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import Board from '../components/Kanban/Board';
import ViewerContainer from '../components/Viewer/ViewerContainer';

const ProjectDetail = () => {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const { userData } = useAuth();

    const [project, setProject] = useState(null);
    const [phases, setPhases] = useState([]);
    const [activePhaseId, setActivePhaseId] = useState(null);
    const [projectMembers, setProjectMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('board');
    
    // İstatistikler
    const [projectStats, setProjectStats] = useState({
        totalTasks: 0, completedTasks: 0, inProgressTasks: 0, todoTasks: 0, phaseStats: []
    });
    const [loadingStats, setLoadingStats] = useState(false);
    
    const [canEditProject, setCanEditProject] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [showPhaseModal, setShowPhaseModal] = useState(false);
    const [newPhaseName, setNewPhaseName] = useState('');

    // ROL KONTROLLERİ
    const isClient = userData?.role === 'client';
    const canViewSettings = (userData?.role === 'admin' || userData?.role === 'manager') && !isClient;

    useEffect(() => {
        if (projectId && userData) fetchProjectData();
    }, [projectId, userData]);

    const fetchProjectData = async () => {
        try {
            setLoading(true);
            setError('');
            const [projectRes, membersRes, phasesRes] = await Promise.all([
                api.get(`/projects/${projectId}`),
                api.get(`/projects/${projectId}/members`),
                api.get(`/projects/${projectId}/phases`) 
            ]);
            setProject(projectRes.data);
            setProjectMembers(membersRes.data);
            setPhases(phasesRes.data);
            if (phasesRes.data.length > 0) setActivePhaseId(phasesRes.data[0].id);
            refreshProjectStats();
        } catch (error) {
            console.error(error);
            if (error.response && error.response.status === 403) setError('Bu projeyi görüntüleme yetkiniz yok.');
            else setError('Proje bulunamadı');
        } finally { setLoading(false); }
    };

    const refreshProjectStats = async () => {
        if (!projectId) return;
        setLoadingStats(true);
        try {
            const statsRes = await api.get(`/projects/${projectId}/stats`);
            setProjectStats(statsRes.data);
        } catch (error) { console.error(error); } finally { setLoadingStats(false); }
    };

    useEffect(() => {
        if (project && userData) {
            const canEdit = !isClient && (userData.role === 'admin' || userData.role === 'manager' || project.created_by_user_id === userData.user_id);
            setCanEditProject(canEdit);
        }
    }, [project, userData]);

    const handleAddPhase = async () => {
        if (!newPhaseName.trim()) return;
        try {
            const res = await api.post(`/projects/${projectId}/phases`, { name: newPhaseName, type: 'general' });
            setPhases([...phases, res.data]);
            setActivePhaseId(res.data.id); 
            setNewPhaseName('');
            setShowPhaseModal(false);
        } catch (error) { alert('Faz eklenirken hata oluştu'); }
    };

    const handleDeletePhase = async (phaseId) => {
        if(!window.confirm("Bu fazı ve içindeki tüm görevleri silmek istediğinize emin misiniz?")) return;
        try {
            await api.delete(`/phases/${phaseId}`);
            const newPhases = phases.filter(p => p.id !== phaseId);
            setPhases(newPhases);
            if(newPhases.length > 0) setActivePhaseId(newPhases[0].id);
            else setActivePhaseId(null);
        } catch (error) { alert('Faz silinemedi'); }
    }

    const handleUpdateProjectStatus = async (newStatus) => {
        if (!canEditProject) return;
        if (newStatus === 'completed') { setShowCompleteModal(true); return; }
        try {
            const response = await api.put(`/projects/${projectId}/status`, { status: newStatus });
            setProject(response.data);
            alert(`Durum güncellendi: ${getStatusText(newStatus)}`);
        } catch (error) { alert('Hata oluştu'); }
    };

    const handleCompleteProject = async () => {
        try {
            const response = await api.put(`/projects/${projectId}/status`, { status: 'completed' });
            setProject(response.data);
            setShowCompleteModal(false);
        } catch (error) { alert('Hata oluştu'); }
    };

    const handleDeleteProject = async () => {
        try {
            await api.delete(`/projects/${projectId}`);
            setShowDeleteModal(false);
            navigate('/projects');
        } catch (error) { alert('Hata oluştu'); }
    };

    const getStatusClass = (status) => {
        if (status === 'active') return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
        if (status === 'completed') return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
    };
    const getStatusText = (status) => (status === 'active' ? 'Aktif' : status === 'completed' ? 'Tamamlandı' : 'Beklemede');

    if (loading) return <div className="flex justify-center h-64 items-center"><LoadingSpinner size="large" /></div>;
    if (error) return <div className="text-center p-8 text-red-500">{error}</div>;
    if (!project) return null;

    return (
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="mb-6">
                <nav className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
                    <Link to="/projects">Projeler</Link> <span>›</span> <span className="text-gray-900 dark:text-white">{project.name}</span>
                </nav>
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{project.name}</h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-2">{project.description}</p>
                    </div>
                    <div className="flex items-center space-x-3">
                        <span className={`px-3 py-1 text-sm rounded-full ${getStatusClass(project.status)}`}>
                            {getStatusText(project.status)}
                        </span>
                        <button onClick={() => navigate('/projects')} className="bg-gray-100 px-4 py-2 rounded-lg">← Geri</button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
                <nav className="flex space-x-8">
                    {[
                        { id: 'board', label: 'Proje Yönetimi', icon: '📋' },
                        { id: 'viewer', label: 'Paftalar & 3D', icon: '🗺️' },
                        { id: 'overview', label: 'Genel Bakış', icon: '📊' },
                        ...(canViewSettings ? [{ id: 'settings', label: 'Ayarlar', icon: '⚙️' }] : [])
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                activeTab === tab.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <span className="mr-2">{tab.icon}</span>{tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* BOARD */}
            {activeTab === 'board' && (
                <div>
                    <div className="flex items-center mb-4 overflow-x-auto pb-2 space-x-2">
                        {phases.map(phase => (
                            <div key={phase.id} className="relative group">
                                <button
                                    onClick={() => setActivePhaseId(phase.id)}
                                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                                        activePhaseId === phase.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700'
                                    }`}
                                >
                                    {phase.name}
                                </button>
                                {canEditProject && phases.length > 1 && (
                                    <button onClick={(e) => { e.stopPropagation(); handleDeletePhase(phase.id); }} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" title="Fazı Sil">×</button>
                                )}
                            </div>
                        ))}
                        {canEditProject && (
                            <button onClick={() => setShowPhaseModal(true)} className="px-3 py-2 rounded-full text-sm font-medium text-blue-600 border border-dashed border-blue-300 hover:bg-blue-50 whitespace-nowrap">+ Disiplin Ekle</button>
                        )}
                    </div>
                    {activePhaseId ? (
                        <Board projectId={projectId} phaseId={activePhaseId} userRole={userData?.role} currentUserId={userData?.user_id} onTaskMoveSuccess={refreshProjectStats} />
                    ) : <div className="text-center py-10 text-gray-500">Henüz bir disiplin bulunmuyor.</div>}
                </div>
            )}

            {/* VIEWER */}
            {activeTab === 'viewer' && <ViewerContainer projectId={projectId} />}
            
            {/* OVERVIEW (GENEL BAKIŞ) */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* SOL KOLON: Üyeler - MÜŞTERİYE GİZLİ */}
                    {!isClient && (
                        <div className="lg:col-span-1">
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50">
                                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Proje Ekibi</h2>
                                </div>
                                <div className="p-6">
                                    {projectMembers.length === 0 ? (
                                        <p className="text-gray-500 dark:text-gray-400 text-sm">Henüz üye atanmamış</p>
                                    ) : (
                                        <div className="space-y-4">
                                            {projectMembers.map(member => (
                                                <div key={member.user_id} className="flex items-center space-x-3">
                                                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm">
                                                        {member.name?.charAt(0) || 'U'}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{member.name}</p>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{member.role} • {member.department || 'Genel'}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SAĞ KOLON: İstatistikler - MÜŞTERİYE TAM GENİŞLİK */}
                    <div className={`space-y-6 ${isClient ? 'lg:col-span-3' : 'lg:col-span-2'}`}>
                        {/* Özet Kartları */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow text-center border-b-4 border-blue-500">
                                <div className="text-3xl font-bold text-gray-800 dark:text-white">{projectStats.totalTasks}</div>
                                <div className="text-xs text-gray-500 font-medium uppercase mt-1">Toplam İş</div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow text-center border-b-4 border-green-500">
                                <div className="text-3xl font-bold text-gray-800 dark:text-white">{projectStats.completedTasks}</div>
                                <div className="text-xs text-gray-500 font-medium uppercase mt-1">Tamamlanan</div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow text-center border-b-4 border-yellow-500">
                                <div className="text-3xl font-bold text-gray-800 dark:text-white">{projectStats.inProgressTasks}</div>
                                <div className="text-xs text-gray-500 font-medium uppercase mt-1">Devam Eden</div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow text-center border-b-4 border-gray-300">
                                <div className="text-3xl font-bold text-gray-800 dark:text-white">{projectStats.todoTasks}</div>
                                <div className="text-xs text-gray-500 font-medium uppercase mt-1">Bekleyen</div>
                            </div>
                        </div>

                        {/* Faz Detayları */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Disiplin İlerlemeleri</h2>
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full dark:bg-blue-900 dark:text-blue-200">Canlı Veri</span>
                            </div>
                            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                {projectStats.phaseStats && projectStats.phaseStats.length > 0 ? (
                                    projectStats.phaseStats.map((phase) => {
                                        const total = parseInt(phase.total_tasks);
                                        const completed = parseInt(phase.completed_tasks);
                                        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
                                        return (
                                            <div key={phase.phase_id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                <div className="flex justify-between items-center mb-2">
                                                    <div>
                                                        <h3 className="font-bold text-gray-900 dark:text-white text-base">{phase.phase_name}</h3>
                                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex space-x-3">
                                                            <span>✅ {completed} Biten</span>
                                                            <span>🚀 {phase.in_progress_tasks} Süren</span>
                                                            <span>📋 {phase.todo_tasks} Bekleyen</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right"><span className="text-2xl font-bold text-gray-800 dark:text-white">{percentage}%</span></div>
                                                </div>
                                                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3 overflow-hidden">
                                                    <div className="bg-green-500 h-full rounded-full transition-all duration-500 ease-out relative" style={{ width: `${percentage}%` }}>
                                                        <div className="absolute top-0 left-0 bottom-0 right-0 bg-white opacity-20 w-full h-full animate-pulse"></div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : <div className="p-8 text-center text-gray-500">Henüz veri yok.</div>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SETTINGS (Müşteriye Gizli) */}
            {activeTab === 'settings' && canViewSettings && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded shadow">
                    <h3 className="font-bold text-red-600 mb-4">Yönetici Paneli</h3>
                    <button onClick={() => setShowDeleteModal(true)} className="bg-red-600 text-white px-4 py-2 rounded">Projeyi Sil</button>
                </div>
            )}

            {/* Modallar */}
            {showPhaseModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-96">
                        <h3 className="text-lg font-bold mb-4 dark:text-white">Yeni Disiplin Ekle</h3>
                        <input autoFocus type="text" className="w-full border p-2 rounded mb-4 dark:bg-gray-700 dark:text-white" value={newPhaseName} onChange={e => setNewPhaseName(e.target.value)} />
                        <div className="flex justify-end space-x-2">
                            <button onClick={() => setShowPhaseModal(false)} className="text-gray-500 px-3 py-1">İptal</button>
                            <button onClick={handleAddPhase} className="bg-blue-600 text-white px-4 py-1 rounded">Ekle</button>
                        </div>
                    </div>
                </div>
            )}
            
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg">
                        <p className="mb-4 dark:text-white">Silmek istediğinize emin misiniz?</p>
                        <div className="flex justify-end space-x-2">
                            <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 bg-gray-200 rounded">İptal</button>
                            <button onClick={handleDeleteProject} className="px-4 py-2 bg-red-600 text-white rounded">Sil</button>
                        </div>
                    </div>
                </div>
            )}
             {showCompleteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg">
                        <p className="mb-4 dark:text-white">Projeyi tamamlamak istiyor musunuz?</p>
                        <div className="flex justify-end space-x-2">
                            <button onClick={() => setShowCompleteModal(false)} className="px-4 py-2 bg-gray-200 rounded">İptal</button>
                            <button onClick={handleCompleteProject} className="px-4 py-2 bg-green-600 text-white rounded">Tamamla</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectDetail;