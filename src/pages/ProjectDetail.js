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
    const [loadingStats, setLoadingStats] = useState(false); // Kullanılmıyordu ama dursun
    
    // Yetki State'leri
    const [canEditDetails, setCanEditDetails] = useState(false);
    const [canChangeStatus, setCanChangeStatus] = useState(false);
    
    // Modallar
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showPhaseModal, setShowPhaseModal] = useState(false);
    const [newPhaseName, setNewPhaseName] = useState('');

    // Form State (Ayarlar için)
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        start_date: '',
        end_date: '',
        status: 'active'
    });

    // ROL KONTROLLERİ
    const isClient = userData?.role === 'client';
    // Admin veya Manager ayarları görebilir
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
            
            const p = projectRes.data;
            setProject(p);
            
            // Form verilerini doldur
            setFormData({
                name: p.name || '',
                description: p.description || '',
                start_date: p.start_date ? p.start_date.split('T')[0] : '', // YYYY-MM-DD formatı
                end_date: p.end_date ? p.end_date.split('T')[0] : '',
                status: p.status || 'active'
            });

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
        try {
            const statsRes = await api.get(`/projects/${projectId}/stats`);
            setProjectStats(statsRes.data);
        } catch (error) { console.error(error); }
    };

    // Yetki Hesaplamaları
    useEffect(() => {
        if (project && userData) {
            const isAdmin = userData.role === 'admin';
            const isManager = userData.role === 'manager';
            const isCreator = project.created_by_user_id === userData.user_id;
            const isProjectManager = project.project_manager === userData.user_id;

            // Detayları (İsim, Açıklama) Kim Düzenler? -> Admin, Oluşturan veya Proje Yöneticisi
            setCanEditDetails(!isClient && (isAdmin || isManager || isCreator || isProjectManager));

            // Durumu Kim Değiştirir? -> Sadece Admin
            setCanChangeStatus(isAdmin);
        }
    }, [project, userData, isClient]);

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
        if(!window.confirm("Bu disiplini ve içindeki tüm görevleri silmek istediğinize emin misiniz?")) return;
        try {
            await api.delete(`/phases/${phaseId}`);
            const newPhases = phases.filter(p => p.id !== phaseId);
            setPhases(newPhases);
            if(newPhases.length > 0) setActivePhaseId(newPhases[0].id);
            else setActivePhaseId(null);
        } catch (error) { alert('Faz silinemedi'); }
    }

    // Genel Ayarları Güncelleme (İsim, Açıklama, Tarih)
    const handleUpdateSettings = async (e) => {
        e.preventDefault();
        try {
            // 1. Temel Bilgileri Güncelle
            if (canEditDetails) {
                const res = await api.put(`/projects/${projectId}`, {
                    name: formData.name,
                    description: formData.description,
                    start_date: formData.start_date || null,
                    end_date: formData.end_date || null
                });
                setProject(prev => ({...prev, ...res.data}));
            }

            // 2. Durum Değişikliği Varsa (Ve Yetkisi Varsa)
            if (canChangeStatus && formData.status !== project.status) {
                const statusRes = await api.put(`/projects/${projectId}/status`, { status: formData.status });
                setProject(prev => ({...prev, status: statusRes.data.status}));
            }

            alert('Proje ayarları güncellendi.');
        } catch (error) {
            console.error(error);
            alert('Güncelleme sırasında hata oluştu: ' + (error.response?.data?.message || error.message));
        }
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
    const getStatusText = (status) => {
        switch(status) {
            case 'active': return 'Aktif';
            case 'completed': return 'Tamamlandı';
            case 'pending': return 'Beklemede';
            default: return status;
        }
    };

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
                        <button onClick={() => navigate('/projects')} className="bg-gray-100 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors">← Geri</button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
                <nav className="flex space-x-8 overflow-x-auto">
                    {[
                        { id: 'board', label: 'Proje Yönetimi', icon: '📋' },
                        { id: 'viewer', label: 'Paftalar & 3D', icon: '🗺️' },
                        { id: 'overview', label: 'Genel Bakış', icon: '📊' },
                        ...(canViewSettings ? [{ id: 'settings', label: 'Ayarlar', icon: '⚙️' }] : [])
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                                activeTab === tab.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                            }`}
                        >
                            <span className="mr-2">{tab.icon}</span>{tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* --- TAB İÇERİKLERİ --- */}

            {/* 1. BOARD */}
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
                                {canEditDetails && phases.length > 1 && (
                                    <button onClick={(e) => { e.stopPropagation(); handleDeletePhase(phase.id); }} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" title="Fazı Sil">×</button>
                                )}
                            </div>
                        ))}
                        {canEditDetails && (
                            <button onClick={() => setShowPhaseModal(true)} className="px-3 py-2 rounded-full text-sm font-medium text-blue-600 border border-dashed border-blue-300 hover:bg-blue-50 whitespace-nowrap">+ Disiplin Ekle</button>
                        )}
                    </div>
                    {activePhaseId ? (
                        <Board projectId={projectId} phaseId={activePhaseId} userRole={userData?.role} currentUserId={userData?.user_id} onTaskMoveSuccess={refreshProjectStats} />
                    ) : <div className="text-center py-10 text-gray-500">Henüz bir disiplin bulunmuyor.</div>}
                </div>
            )}

            {/* 2. VIEWER */}
            {activeTab === 'viewer' && <ViewerContainer projectId={projectId} />}
            
            {/* 3. OVERVIEW (GENEL BAKIŞ) */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
                    <div className={`space-y-6 ${isClient ? 'lg:col-span-3' : 'lg:col-span-2'}`}>
                        {/* İstatistik Kartları */}
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
                        {/* Faz İlerlemeleri */}
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
                                                    <div className="bg-green-500 h-full rounded-full transition-all duration-500 ease-out relative" style={{ width: `${percentage}%` }}></div>
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

            {/* 4. SETTINGS (AYARLAR - GÜNCELLENDİ) */}
            {activeTab === 'settings' && canViewSettings && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Proje Bilgilerini Düzenle Formu */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                         <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Proje Ayarları</h2>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleUpdateSettings}>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Proje Adı</label>
                                    <input 
                                        type="text" 
                                        value={formData.name} 
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                        disabled={!canEditDetails}
                                        className="w-full border rounded p-2 dark:bg-gray-700 dark:text-white dark:border-gray-600 disabled:opacity-50"
                                    />
                                </div>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Açıklama</label>
                                    <textarea 
                                        value={formData.description} 
                                        onChange={e => setFormData({...formData, description: e.target.value})}
                                        disabled={!canEditDetails}
                                        rows="3"
                                        className="w-full border rounded p-2 dark:bg-gray-700 dark:text-white dark:border-gray-600 disabled:opacity-50"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Başlangıç Tarihi</label>
                                        <input 
                                            type="date" 
                                            value={formData.start_date} 
                                            onChange={e => setFormData({...formData, start_date: e.target.value})}
                                            disabled={!canEditDetails}
                                            className="w-full border rounded p-2 dark:bg-gray-700 dark:text-white dark:border-gray-600 disabled:opacity-50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bitiş Tarihi</label>
                                        <input 
                                            type="date" 
                                            value={formData.end_date} 
                                            onChange={e => setFormData({...formData, end_date: e.target.value})}
                                            disabled={!canEditDetails}
                                            className="w-full border rounded p-2 dark:bg-gray-700 dark:text-white dark:border-gray-600 disabled:opacity-50"
                                        />
                                    </div>
                                </div>
                                
                                {/* DURUM SEÇİCİ - Sadece Admin değiştirebilir */}
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Proje Durumu {canChangeStatus ? '' : '(Sadece Admin)'}
                                    </label>
                                    <select 
                                        value={formData.status} 
                                        onChange={e => setFormData({...formData, status: e.target.value})}
                                        disabled={!canChangeStatus}
                                        className="w-full border rounded p-2 dark:bg-gray-700 dark:text-white dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <option value="active">🟢 Aktif</option>
                                        <option value="pending">🟡 Beklemede</option>
                                        <option value="completed">⚫ Tamamlandı</option>
                                    </select>
                                </div>

                                {(canEditDetails || canChangeStatus) && (
                                    <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors">
                                        Değişiklikleri Kaydet
                                    </button>
                                )}
                            </form>
                        </div>
                    </div>

                    {/* Tehlikeli Bölge */}
                    {canEditDetails && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow h-fit">
                            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                                <h2 className="text-lg font-semibold text-red-600">Tehlikeli Bölge</h2>
                            </div>
                            <div className="p-6">
                                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                                    Bu işlem geri alınamaz. Projeyi, tüm görevleri ve dosyaları kalıcı olarak siler.
                                </p>
                                <button onClick={() => setShowDeleteModal(true)} className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded hover:bg-red-100 transition-colors w-full text-left flex justify-between items-center">
                                    <span>Projeyi Kalıcı Olarak Sil</span>
                                    <span>🗑️</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Modallar */}
            {showPhaseModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-96">
                        <h3 className="text-lg font-bold mb-4 dark:text-white">Yeni Disiplin Ekle</h3>
                        <input autoFocus type="text" className="w-full border p-2 rounded mb-4 dark:bg-gray-700 dark:text-white dark:border-gray-600" value={newPhaseName} onChange={e => setNewPhaseName(e.target.value)} />
                        <div className="flex justify-end space-x-2">
                            <button onClick={() => setShowPhaseModal(false)} className="text-gray-500 px-3 py-1">İptal</button>
                            <button onClick={handleAddPhase} className="bg-blue-600 text-white px-4 py-1 rounded">Ekle</button>
                        </div>
                    </div>
                </div>
            )}
            
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-96">
                        <h3 className="text-lg font-bold mb-2 text-red-600">Projeyi Sil?</h3>
                        <p className="mb-6 text-gray-600 dark:text-gray-300">Bu işlem geri alınamaz. Emin misiniz?</p>
                        <div className="flex justify-end space-x-2">
                            <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 bg-gray-200 rounded text-gray-700">İptal</button>
                            <button onClick={handleDeleteProject} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Evet, Sil</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectDetail;