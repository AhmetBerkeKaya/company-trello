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

    // --- STATE TANIMLARI ---
    const [project, setProject] = useState(null);
    const [phases, setPhases] = useState([]);
    const [activePhaseId, setActivePhaseId] = useState(null);
    const [projectMembers, setProjectMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('board');

    // İstatistikler
    const [projectStats, setProjectStats] = useState({
        totalTasks: 0, completedTasks: 0, inProgressTasks: 0, todoTasks: 0,
        phaseStats: [], budget: { total: 0, spent: 0, remaining: 0 }
    });

    // Modal State'leri
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showCompleteModal, setShowCompleteModal] = useState(false); // Proje Tamamlama Onayı
    const [showPhaseModal, setShowPhaseModal] = useState(false);
    const [newPhaseName, setNewPhaseName] = useState('');
    
    // Rapor Modalı State'leri
    const [showReportModal, setShowReportModal] = useState(false);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [reportOptions, setReportOptions] = useState({
        financials: true, risks: true, phases: true, weekly: true
    });

    // --- ROL VE YETKİ KONTROLLERİ ---
    const isClient = userData?.role === 'client';
    const isObserver = userData?.role === 'observer';
    
    // Proje Düzenleme Yetkisi (Status değiştirme, Faz ekleme vb.)
    // Sadece Admin ve Manager yapabilir.
    const canEditProject = !isClient && !isObserver && (userData?.role === 'admin' || userData?.role === 'manager');

    // Ayarlar Sekmesi Görünürlüğü
    const canViewSettings = canEditProject;

    useEffect(() => {
        if (projectId && userData) fetchProjectData();
    }, [projectId, userData]);

    const fetchProjectData = async () => {
        try {
            setLoading(true);
            const [pRes, mRes, phRes] = await Promise.all([
                api.get(`/projects/${projectId}`),
                api.get(`/projects/${projectId}/members`),
                api.get(`/projects/${projectId}/phases`)
            ]);
            setProject(pRes.data);
            setProjectMembers(mRes.data);
            setPhases(phRes.data);
            if (phRes.data.length > 0 && !activePhaseId) setActivePhaseId(phRes.data[0].id);
            refreshProjectStats();
        } catch (e) {
            if (e.response?.status === 403) setError('Yetkisiz erişim'); else setError('Proje bulunamadı');
        } finally { setLoading(false); }
    };

    const refreshProjectStats = async () => {
        try { const res = await api.get(`/projects/${projectId}/stats`); setProjectStats(res.data); } catch(e){}
    };

    // --- AKSİYONLAR ---

    // 1. Faz (Disiplin) Yönetimi
    const handleAddPhase = async () => {
        if (!newPhaseName.trim()) return;
        try {
            const res = await api.post(`/projects/${projectId}/phases`, { name: newPhaseName, type: 'general' });
            setPhases([...phases, res.data]);
            setActivePhaseId(res.data.id);
            setNewPhaseName('');
            setShowPhaseModal(false);
        } catch (e) { alert('Hata oluştu'); }
    };

    const handleDeletePhase = async (pid) => {
        if(!window.confirm('Bu disiplini ve içindeki görevleri silmek istiyor musunuz?')) return;
        try {
            await api.delete(`/phases/${pid}`);
            setPhases(prev => prev.filter(p => p.id !== pid));
            if(phases.length > 1) setActivePhaseId(phases[0].id); else setActivePhaseId(null);
        } catch(e) { alert('Silinemedi'); }
    };

    // 2. Proje Durum Güncelleme (Header Dropdown'ı için)
    const handleStatusChange = async (e) => {
        const newStatus = e.target.value;
        if (newStatus === 'completed') {
            setShowCompleteModal(true); // Onay modalı aç
        } else {
            // Direkt güncelle
            updateStatusAPI(newStatus);
        }
    };

    const updateStatusAPI = async (status) => {
        try {
            const res = await api.put(`/projects/${projectId}/status`, { status });
            setProject(res.data);
            setShowCompleteModal(false);
        } catch (e) { alert('Durum güncellenemedi'); }
    };

    // 3. Proje Silme
    const handleDeleteProject = async () => {
        try { await api.delete(`/projects/${projectId}`); navigate('/projects'); } catch(e){ alert('Silinemedi'); }
    };

    // 4. Rapor İndirme
    const confirmDownloadReport = async () => {
        setIsGeneratingReport(true);
        try {
            const query = new URLSearchParams({
                includeFinancials: reportOptions.financials,
                includeRisks: reportOptions.risks,
                includePhases: reportOptions.phases,
                includeWeekly: reportOptions.weekly
            }).toString();

            const response = await api.get(`/reports/project/${projectId}?${query}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `ProjeRaporu-${project.name.replace(/\s+/g,'_')}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            setShowReportModal(false);
        } catch (error) { alert("Rapor hatası: " + error.message); } 
        finally { setIsGeneratingReport(false); }
    };

    // Görsel Yardımcılar
    const getStatusColor = (s) => {
        switch(s) {
            case 'active': return 'bg-green-100 text-green-800 border-green-200';
            case 'completed': return 'bg-gray-100 text-gray-800 border-gray-200';
            case 'on-hold': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    if (loading) return <div className="h-64 flex justify-center items-center"><LoadingSpinner size="large"/></div>;
    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
    if (!project) return null;

    return (
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            {/* --- HEADER (PROFESYONEL GÖRÜNÜM GERİ GELDİ) --- */}
            <div className="mb-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <nav className="text-xs text-gray-500 mb-4 uppercase tracking-wider font-semibold">
                    <Link to="/projects" className="hover:text-blue-600 transition-colors">Projeler</Link> <span className="mx-1">/</span> <span className="text-gray-900 dark:text-white">{project.name}</span>
                </nav>
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white leading-tight">{project.name}</h1>
                            {isObserver && (
                                <span className="px-3 py-1 bg-purple-100 text-purple-800 text-xs font-bold rounded-full dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200">
                                    👁️ Gözlemci Modu
                                </span>
                            )}
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm max-w-2xl">{project.description}</p>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* DURUM DEĞİŞTİRME DROPDOWN'I (Sadece Yetkililere) */}
                        {canEditProject ? (
                            <div className="relative">
                                <select
                                    value={project.status}
                                    onChange={handleStatusChange}
                                    className={`appearance-none pl-4 pr-10 py-2 rounded-lg font-medium text-sm border focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 cursor-pointer transition-colors ${getStatusColor(project.status)} dark:bg-gray-700 dark:border-gray-600 dark:text-white`}
                                >
                                    <option value="active">🟢 Aktif</option>
                                    <option value="on-hold">🟡 Beklemede</option>
                                    <option value="completed">⚫ Tamamlandı</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-600 dark:text-gray-300">
                                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                </div>
                            </div>
                        ) : (
                            <span className={`px-4 py-2 rounded-lg text-sm font-medium border ${getStatusColor(project.status)}`}>
                                {project.status === 'active' ? '🟢 Aktif' : project.status === 'completed' ? '⚫ Tamamlandı' : '🟡 Beklemede'}
                            </span>
                        )}

                        <button onClick={() => navigate('/projects')} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">
                            ← Geri
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b dark:border-gray-700 mb-6 flex space-x-6 overflow-x-auto">
                {[{id:'board',l:'Yönetim',i:'📋'}, {id:'viewer',l:'Paftalar',i:'🗺️'}, {id:'overview',l:'Genel',i:'📊'}]
                  .concat(canViewSettings ? [{id:'settings',l:'Ayarlar',i:'⚙️'}] : [])
                  .map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)} className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${activeTab===t.id?'border-blue-600 text-blue-600 dark:text-blue-400':'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                        <span className="mr-2">{t.i}</span>{t.l}
                    </button>
                ))}
            </div>

            {/* --- İÇERİK ALANLARI --- */}

            {/* 1. BOARD (KANBAN) */}
            {activeTab === 'board' && (
                <div className="h-[calc(100vh-280px)] flex flex-col">
                    <div className="flex items-center mb-4 gap-2 overflow-x-auto pb-2 shrink-0">
                        {phases.map(p => (
                            <div key={p.id} className="relative group">
                                <button onClick={() => setActivePhaseId(p.id)} className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${activePhaseId===p.id?'bg-blue-600 text-white shadow-md':'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600'}`}>
                                    {p.name}
                                </button>
                                {canEditProject && phases.length > 1 && (
                                    <button onClick={(e) => { e.stopPropagation(); handleDeletePhase(p.id); }} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex justify-center items-center opacity-0 group-hover:opacity-100 shadow-sm transition-opacity" title="Sil">×</button>
                                )}
                            </div>
                        ))}
                        {canEditProject && (
                            <button onClick={() => setShowPhaseModal(true)} className="px-3 py-2 rounded-full border border-dashed border-blue-400 text-blue-600 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors whitespace-nowrap">
                                + Disiplin Ekle
                            </button>
                        )}
                    </div>
                    {activePhaseId ? 
                        <div className="flex-1 overflow-hidden">
                            <Board projectId={projectId} phaseId={activePhaseId} userRole={userData?.role} currentUserId={userData?.user_id} onTaskMoveSuccess={refreshProjectStats} isObserver={isObserver} /> 
                        </div>
                    : <div className="text-center py-20 text-gray-500">Henüz bir disiplin/faz bulunmuyor.</div>}
                </div>
            )}

            {/* 2. VIEWER */}
            {activeTab === 'viewer' && <ViewerContainer projectId={projectId} />}

            {/* 3. OVERVIEW */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {!isClient && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-700">
                            <h3 className="font-bold mb-4 dark:text-white text-lg">Proje Ekibi</h3>
                            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                                {projectMembers.map(m => (
                                    <div key={m.user_id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors">
                                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold shadow-sm">{m.name[0]}</div>
                                        <div>
                                            <div className="text-sm font-medium dark:text-white">{m.name}</div>
                                            <div className="text-xs text-gray-500">{m.role} • {m.department||'Genel'}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    <div className={`space-y-6 ${isClient ? 'lg:col-span-3' : 'lg:col-span-2'}`}>
                        {/* Rapor Butonu */}
                        <div className="flex justify-end">
                            <button onClick={() => setShowReportModal(true)} className="bg-gray-900 hover:bg-black text-white px-5 py-2.5 rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center gap-2 font-medium">
                                <span className="text-xl">📄</span> Profesyonel Rapor Oluştur
                            </button>
                        </div>
                        
                        {/* İstatistikler */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border-b-4 border-blue-500"><div className="text-3xl font-bold text-gray-900 dark:text-white">{projectStats.totalTasks}</div><div className="text-xs text-gray-500 font-bold uppercase tracking-wide mt-1">Toplam İş</div></div>
                            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border-b-4 border-green-500"><div className="text-3xl font-bold text-gray-900 dark:text-white">{projectStats.completedTasks}</div><div className="text-xs text-gray-500 font-bold uppercase tracking-wide mt-1">Tamamlanan</div></div>
                            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border-b-4 border-yellow-500"><div className="text-3xl font-bold text-gray-900 dark:text-white">{projectStats.inProgressTasks}</div><div className="text-xs text-gray-500 font-bold uppercase tracking-wide mt-1">Süren</div></div>
                            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border-b-4 border-red-500"><div className="text-3xl font-bold text-gray-900 dark:text-white">{projectStats.todoTasks}</div><div className="text-xs text-gray-500 font-bold uppercase tracking-wide mt-1">Bekleyen</div></div>
                        </div>
                        
                        {/* Bütçe Kartı */}
                        {!isClient && (userData?.role==='admin' || userData?.role==='manager' || isObserver) && projectStats.budget && (
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                                <h3 className="font-bold mb-6 dark:text-white text-lg flex items-center gap-2">💰 Finansal Genel Bakış</h3>
                                <div className="grid grid-cols-3 gap-6 text-center">
                                    <div><div className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Toplam Bütçe</div><div className="text-xl font-bold text-gray-900 dark:text-white">{projectStats.budget.total.toLocaleString()} ₺</div></div>
                                    <div><div className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Harcanan</div><div className="text-xl font-bold text-indigo-600">{projectStats.budget.spent.toLocaleString()} ₺</div></div>
                                    <div><div className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Kalan</div><div className={`text-xl font-bold ${projectStats.budget.remaining<0?'text-red-600':'text-green-600'}`}>{projectStats.budget.remaining.toLocaleString()} ₺</div></div>
                                </div>
                            </div>
                        )}

                        {/* 3. DİSİPLİN (FAZ) İLERLEMELERİ - BURASI GERİ GELDİ */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Disiplin İlerlemeleri</h2>
                                <span className="text-xs bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full font-medium dark:bg-blue-900 dark:text-blue-200">Canlı Veri</span>
                            </div>
                            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                {projectStats.phaseStats && projectStats.phaseStats.length > 0 ? (
                                    projectStats.phaseStats.map((phase) => {
                                        const total = parseInt(phase.total_tasks);
                                        const completed = parseInt(phase.completed_tasks);
                                        // Yüzdelik hesaplama
                                        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
                                        
                                        return (
                                            <div key={phase.phase_id} className="p-5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                                <div className="flex justify-between items-center mb-2">
                                                    <div>
                                                        <h3 className="font-bold text-gray-900 dark:text-white">{phase.phase_name}</h3>
                                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex space-x-3">
                                                            <span>✅ {completed} Biten</span>
                                                            <span>🚀 {phase.in_progress_tasks} Süren</span>
                                                            <span>📋 {phase.todo_tasks} Bekleyen</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-2xl font-bold text-gray-800 dark:text-white">{percentage}%</span>
                                                    </div>
                                                </div>
                                                
                                                {/* Progress Bar */}
                                                <div className="w-full bg-gray-100 dark:bg-gray-600 rounded-full h-2.5 overflow-hidden">
                                                    <div 
                                                        className="bg-green-500 h-full rounded-full transition-all duration-700 ease-out relative" 
                                                        style={{ width: `${percentage}%` }}
                                                    >
                                                        {/* Parlama efekti */}
                                                        <div className="absolute top-0 left-0 bottom-0 right-0 bg-white opacity-20 w-full h-full"></div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : <div className="p-8 text-center text-gray-500">Henüz disiplin verisi yok.</div>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 4. SETTINGS */}
            {activeTab === 'settings' && canViewSettings && (
                <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 max-w-2xl mx-auto mt-8">
                    <h3 className="text-xl font-bold text-red-600 mb-6 flex items-center gap-2">⚠️ Tehlikeli Bölge</h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">Bu projeyi sildiğinizde, projeye ait tüm görevler, dosyalar ve geçmiş veriler kalıcı olarak silinecektir. Bu işlem geri alınamaz.</p>
                    <div className="flex justify-end">
                        <button onClick={() => setShowDeleteModal(true)} className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-6 py-3 rounded-lg font-bold transition-colors">
                            Projeyi Kalıcı Olarak Sil
                        </button>
                    </div>
                </div>
            )}

            {/* --- MODALLAR --- */}
            
            {/* Rapor Seçenekleri Modalı */}
            {showReportModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Rapor Sihirbazı</h3>
                            <button onClick={() => setShowReportModal(false)} className="text-gray-400 hover:text-red-500 text-2xl">×</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Rapora dahil etmek istediğiniz bölümleri seçin:</p>
                            
                            {[
                                {k:'financials', l:'Finansal Özet', d:'Bütçe, harcanan ve kalan tutarlar', i:'💰'},
                                {k:'weekly', l:'Haftalık Analiz', d:'Son 12 haftanın iş dökümü', i:'📅'},
                                {k:'risks', l:'Risk Analizi', d:'Geciken ve yaklaşan kritik görevler', i:'⚠️'},
                                {k:'phases', l:'Disiplin Detayları', d:'Her disiplin için görev sayıları', i:'🏗️'}
                            ].map(opt => (
                                <label key={opt.k} className="flex items-center p-3 border rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                                    <input type="checkbox" checked={reportOptions[opt.k]} onChange={e => setReportOptions({...reportOptions, [opt.k]: e.target.checked})} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" />
                                    <div className="ml-4">
                                        <span className="block font-bold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">{opt.i} {opt.l}</span>
                                        <span className="text-xs text-gray-500">{opt.d}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                        <div className="p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl flex justify-end gap-3">
                            <button onClick={() => setShowReportModal(false)} className="px-5 py-2.5 text-gray-600 hover:text-gray-800 font-medium">İptal</button>
                            <button onClick={confirmDownloadReport} disabled={isGeneratingReport} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-500/30">
                                {isGeneratingReport ? <LoadingSpinner size="small" color="white"/> : 'Raporu Oluştur ve İndir'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Faz Ekleme Modalı */}
            {showPhaseModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl w-96 shadow-xl">
                        <h3 className="font-bold mb-4 text-lg dark:text-white">Yeni Disiplin Oluştur</h3>
                        <input autoFocus className="border w-full p-3 mb-6 rounded-lg dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="Örn: Mimari, Statik..." value={newPhaseName} onChange={e=>setNewPhaseName(e.target.value)} />
                        <div className="flex justify-end gap-2">
                            <button onClick={()=>setShowPhaseModal(false)} className="text-gray-500 px-4 py-2 hover:bg-gray-100 rounded-lg">İptal</button>
                            <button onClick={handleAddPhase} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium">Ekle</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Proje Tamamlama Modalı */}
            {showCompleteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl max-w-sm w-full shadow-2xl">
                        <div className="text-center mb-6">
                            <div className="text-4xl mb-2">🎉</div>
                            <h3 className="text-xl font-bold dark:text-white">Projeyi Tamamla?</h3>
                            <p className="text-gray-500 mt-2 text-sm">Bu projeyi tamamlandı olarak işaretlemek üzeresiniz. Harika iş!</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowCompleteModal(false)} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium">Vazgeç</button>
                            <button onClick={() => updateStatusAPI('completed')} className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-lg shadow-green-500/30">Evet, Tamamla</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Silme Modalı */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl max-w-sm w-full shadow-2xl border-2 border-red-100 dark:border-red-900">
                        <h3 className="text-xl font-bold text-red-600 mb-2">Projeyi Sil?</h3>
                        <p className="text-gray-600 dark:text-gray-300 mb-6">Bu işlem geri alınamaz. Emin misiniz?</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 bg-gray-100 rounded-lg font-medium">İptal</button>
                            <button onClick={handleDeleteProject} className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700">Evet, Sil</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectDetail;