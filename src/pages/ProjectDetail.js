// src/pages/ProjectDetail.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import Board from '../components/Kanban/Board';
import ViewerContainer from '../components/Viewer/ViewerContainer';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
const ProjectDetail = () => {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const { userData } = useAuth();


    const [initialRouted, setInitialRouted] = useState(false);
    // --- STATE TANIMLARI (KORUNDU) ---
    const [project, setProject] = useState(null);
    const [phases, setPhases] = useState([]);
    const [activePhaseId, setActivePhaseId] = useState(null);
    const [projectMembers, setProjectMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('board');

    const [projectStats, setProjectStats] = useState({
        totalTasks: 0, completedTasks: 0, inProgressTasks: 0, todoTasks: 0,
        phaseStats: [], budget: { total: 0, spent: 0, remaining: 0 }
    });

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [showPhaseModal, setShowPhaseModal] = useState(false);
    const [newPhaseName, setNewPhaseName] = useState('');
    
    const [showReportModal, setShowReportModal] = useState(false);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [reportOptions, setReportOptions] = useState({
        financials: true, risks: true, phases: true, weekly: true
    });

    // --- ROL VE YETKİ KONTROLLERİ (KORUNDU) ---
    const isClient = userData?.role === 'client';
    const isObserver = userData?.role === 'observer';
    const canEditProject = !isClient && !isObserver && (userData?.role === 'admin' || userData?.role === 'manager');
    const canViewSettings = canEditProject;

    useEffect(() => {
        if (projectId && userData) fetchProjectData();
    }, [projectId, userData]);

    // YENİ: Yönlendirme bilgisini (State) dinleyip sekmeyi ve fazı ayarlayan zeka
    useEffect(() => {
        if (phases.length > 0 && location.state && !initialRouted) {
            const { targetPhaseId, targetTab } = location.state;
            
            if (targetPhaseId) setActivePhaseId(targetPhaseId);
            if (targetTab) setActiveTab(targetTab);
            else if (targetPhaseId) setActiveTab('board');
            
            setInitialRouted(true);
            
            // Rota bilgisini temizle ki sayfayı yenileyince tekrar aynı faza zorlamasın
            window.history.replaceState({}, document.title);
        }
    }, [phases, location.state, initialRouted]);

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
            
            // DÜZELTME: Sadece normal girişlerde varsayılan fazı ata. 
            // Yönlendirme varsa yukarıdaki useEffect halledecek.
            if (phRes.data.length > 0 && !activePhaseId && !location.state?.targetPhaseId) {
                setActivePhaseId(phRes.data[0].id);
            }
            refreshProjectStats();
        } catch (e) {
            if (e.response?.status === 403) setError('Yetkisiz erişim'); else setError('Proje bulunamadı');
        } finally { setLoading(false); }
    };

    const refreshProjectStats = async () => {
        try { const res = await api.get(`/projects/${projectId}/stats`); setProjectStats(res.data); } catch(e){}
    };

    // --- AKSİYONLAR (KORUNDU) ---
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

    const handleStatusChange = async (e) => {
        const newStatus = e.target.value;
        if (newStatus === 'completed') setShowCompleteModal(true);
        else updateStatusAPI(newStatus);
    };

    const updateStatusAPI = async (status) => {
        try {
            const res = await api.put(`/projects/${projectId}/status`, { status });
            setProject(res.data);
            setShowCompleteModal(false);
        } catch (e) { alert('Durum güncellenemedi'); }
    };

    const handleDeleteProject = async () => {
        try { await api.delete(`/projects/${projectId}`); navigate('/projects'); } catch(e){ alert('Silinemedi'); }
    };

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

    const getStatusColor = (s) => {
        switch(s) {
            case 'active': return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800';
            case 'completed': return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
            case 'on-hold': return 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
            default: return 'bg-gray-50 text-gray-700 border-gray-200';
        }
    };

    if (loading) return <div className="min-h-screen flex justify-center items-center"><LoadingSpinner size="large"/></div>;
    if (error) return <div className="min-h-screen flex items-center justify-center p-8 text-center text-red-500 font-bold">{error}</div>;
    if (!project) return null;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
            {/* --- MODERN HEADER SECTION --- */}
            <div className="max-w-7xl mx-auto mb-8 bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 animate-fade-in relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-5 select-none pointer-events-none text-8xl font-black italic uppercase">Project</div>
                
                <nav className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">
                    <Link to="/projects" className="hover:text-blue-600 transition-colors">Projelerim</Link> 
                    <span className="opacity-50">/</span> 
                    <span className="text-blue-600 truncate max-w-[200px]">{project.name}</span>
                </nav>
                
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 relative z-10">
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-4 mb-3">
                            <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight leading-tight">{project.name}</h1>
                            {isObserver && (
                                <span className="px-4 py-1.5 bg-purple-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-purple-500/20">
                                    Gözlemci Modu
                                </span>
                            )}
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 text-lg font-medium leading-relaxed max-w-3xl">{project.description || 'Proje için henüz detaylı bir açıklama girilmemiş.'}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 shrink-0">
                        {canEditProject ? (
                            <div className="relative group">
                                <select
                                    value={project.status}
                                    onChange={handleStatusChange}
                                    className={`appearance-none pl-6 pr-12 py-4 rounded-2xl font-black text-xs uppercase tracking-widest border-2 focus:outline-none focus:ring-0 cursor-pointer transition-all shadow-sm ${getStatusColor(project.status)}`}
                                >
                                    <option value="active">🟢 Aktif</option>
                                    <option value="on-hold">🟡 Beklemede</option>
                                    <option value="completed">⚫ Tamamlandı</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                                    <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                </div>
                            </div>
                        ) : (
                            <div className={`px-6 py-4 rounded-2xl border-2 font-black text-xs uppercase tracking-widest ${getStatusColor(project.status)}`}>
                                {project.status === 'active' ? '🟢 Aktif' : project.status === 'completed' ? '⚫ Tamamlandı' : '🟡 Beklemede'}
                            </div>
                        )}

                        <button onClick={() => navigate('/projects')} className="bg-gray-900 hover:bg-black text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95">
                            ← Geri
                        </button>
                    </div>
                </div>
            </div>

            {/* --- NAVIGATION TABS --- */}
            <div className="max-w-7xl mx-auto flex items-center gap-3 mb-10 overflow-x-auto pb-4 custom-scrollbar">
                {[
                    {id:'board', l:'Proje Yönetimi', i:'📋'}, 
                    {id:'viewer', l:'Paftalar & 3D', i:'🗺️'}, 
                    {id:'overview', l:'Genel Bakış', i:'📊'}
                ].concat(canViewSettings ? [{id:'settings', l:'Proje Ayarları', i:'⚙️'}] : []).map(t => (
                    <button 
                        key={t.id} 
                        onClick={() => setActiveTab(t.id)} 
                        className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all whitespace-nowrap ${
                            activeTab === t.id 
                            ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/30 translate-y-[-2px]' 
                            : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-50 dark:text-gray-400 border border-gray-100 dark:border-gray-700 shadow-sm'
                        }`}
                    >
                        <span className="text-xl">{t.i}</span>{t.l}
                    </button>
                ))}
            </div>

            {/* --- CONTENT AREA --- */}
            <div className="max-w-7xl mx-auto animate-fade-in">
                {activeTab === 'board' && (
                    <div className="h-[calc(100vh-320px)] flex flex-col">
                        <div className="flex flex-wrap items-center mb-6 gap-3 shrink-0">
                            {phases.map(p => (
                                <div key={p.id} className="relative group">
                                    <button 
                                        onClick={() => setActivePhaseId(p.id)} 
                                        className={`px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-wider border-2 transition-all ${
                                            activePhaseId === p.id 
                                            ? 'bg-white border-blue-600 text-blue-600 shadow-md dark:bg-gray-800' 
                                            : 'bg-transparent border-gray-200 text-gray-400 hover:border-gray-300 dark:border-gray-700'
                                        }`}
                                    >
                                        {p.name}
                                    </button>
                                    {canEditProject && phases.length > 1 && (
                                        <button onClick={(e) => { e.stopPropagation(); handleDeletePhase(p.id); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex justify-center items-center opacity-0 group-hover:opacity-100 shadow-lg transition-all scale-75 group-hover:scale-100" title="Fazı Sil">✕</button>
                                    )}
                                </div>
                            ))}
                            {canEditProject && (
                                <button onClick={() => setShowPhaseModal(true)} className="px-6 py-3 rounded-xl border-2 border-dashed border-blue-400 text-blue-600 text-[11px] font-black uppercase tracking-wider hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
                                    + Yeni Disiplin
                                </button>
                            )}
                        </div>
                        {activePhaseId ? (
                            <div className="flex-1 overflow-hidden bg-gray-100/50 dark:bg-gray-900/50 rounded-[2rem] border border-gray-200 dark:border-gray-800">
                                <Board projectId={projectId} phaseId={activePhaseId} userRole={userData?.role} currentUserId={userData?.user_id} onTaskMoveSuccess={refreshProjectStats} isObserver={isObserver} /> 
                            </div>
                        ) : <div className="text-center py-32 text-gray-400 font-bold uppercase tracking-widest bg-white dark:bg-gray-800 rounded-[3rem]">Henüz bir disiplin tanımlanmadı.</div>}
                    </div>
                )}

                {activeTab === 'viewer' && (
                    <div className="h-[calc(100vh-320px)] bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <ViewerContainer projectId={projectId} />
                    </div>
                )}

                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Sol Panel: Ekip */}
                        {!isClient && (
                            <div className="lg:col-span-4 bg-white dark:bg-gray-800 rounded-[2rem] shadow-sm p-8 border border-gray-100 dark:border-gray-700 h-fit">
                                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-8 uppercase tracking-widest">📋 Proje Ekibi</h3>
                                <div className="space-y-5 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                                    {projectMembers.map(m => (
                                        <div key={m.user_id} className="flex items-center gap-4 p-4 hover:bg-blue-50 dark:hover:bg-gray-700/50 rounded-2xl transition-all border border-transparent hover:border-blue-100">
                                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-500/20">{m.name[0]}</div>
                                            <div className="min-w-0">
                                                <div className="text-sm font-black text-gray-900 dark:text-white truncate uppercase">{m.name}</div>
                                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{m.role} • {m.department||'Genel'}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {/* Sağ Panel: Analiz */}
                        <div className={`space-y-8 ${isClient ? 'lg:col-span-12' : 'lg:col-span-8'}`}>
                            {/* Rapor Butonu */}
                            <div className="flex justify-between items-center px-4">
                                <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-widest">📈 Performans Verileri</h3>
                                <button onClick={() => setShowReportModal(true)} className="bg-gray-900 hover:bg-black text-white px-8 py-4 rounded-2xl shadow-xl hover:shadow-2xl transition-all flex items-center gap-3 font-black text-xs uppercase tracking-widest active:scale-95">
                                    <span>📄</span> Rapor Sihirbazı
                                </button>
                            </div>
                            
                            {/* İstatistik Kartları */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-2">
                                {[
                                    {l:'Toplam İş', v:projectStats.totalTasks, c:'blue'},
                                    {l:'Tamamlanan', v:projectStats.completedTasks, c:'green'},
                                    {l:'Sürüyor', v:projectStats.inProgressTasks, c:'yellow'},
                                    {l:'Bekleyen', v:projectStats.todoTasks, c:'red'}
                                ].map((s, i) => (
                                    <div key={i} className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 text-center transform hover:scale-105 transition-transform">
                                        <div className={`text-4xl font-black text-${s.c}-600 mb-2`}>{s.v}</div>
                                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{s.l}</div>
                                    </div>
                                ))}
                            </div>
                            
                            {/* Finansal Analiz */}
                            {!isClient && (userData?.role==='admin' || userData?.role==='manager' || isObserver) && projectStats.budget && (
                                <div className="bg-gray-900 dark:bg-gray-800 p-10 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16"></div>
                                    <h3 className="text-lg font-black uppercase tracking-[0.3em] mb-10 flex items-center gap-4"><span className="text-3xl">💰</span> Finansal Özet</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
                                        <div className="space-y-2"><div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Planlanan Bütçe</div><div className="text-3xl font-black">{projectStats.budget.total.toLocaleString()} ₺</div></div>
                                        <div className="space-y-2"><div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-indigo-400">Gerçekleşen Maliyet</div><div className="text-3xl font-black text-indigo-400">{projectStats.budget.spent.toLocaleString()} ₺</div></div>
                                        <div className="space-y-2"><div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Kalan Kaynak</div><div className={`text-3xl font-black ${projectStats.budget.remaining < 0 ? 'text-red-400' : 'text-green-400'}`}>{projectStats.budget.remaining.toLocaleString()} ₺</div></div>
                                    </div>
                                </div>
                            )}

                            {/* Disiplin Bazlı İlerleme */}
                            <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                                <div className="px-10 py-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex justify-between items-center">
                                    <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-[0.2em]">Disiplin Durum Analizi</h2>
                                    <span className="px-4 py-1 bg-blue-100 text-blue-700 text-[10px] font-black uppercase rounded-lg">Real-Time</span>
                                </div>
                                <div className="p-4 divide-y divide-gray-50 dark:divide-gray-700/50">
                                    {projectStats.phaseStats && projectStats.phaseStats.length > 0 ? (
                                        projectStats.phaseStats.map((phase) => {
                                            const total = parseInt(phase.total_tasks);
                                            const completed = parseInt(phase.completed_tasks);
                                            const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
                                            return (
                                                <div key={phase.phase_id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/20 rounded-3xl transition-all">
                                                    <div className="flex justify-between items-end mb-4">
                                                        <div>
                                                            <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wider">{phase.phase_name}</h3>
                                                            <div className="text-[10px] font-bold text-gray-400 mt-2 flex gap-4">
                                                                <span>✅ {completed} Biten</span>
                                                                <span>🚀 {phase.in_progress_tasks} Süren</span>
                                                                <span>📋 {phase.todo_tasks} Bekleyen</span>
                                                            </div>
                                                        </div>
                                                        <div className="text-3xl font-black text-gray-900 dark:text-white">{percentage}%</div>
                                                    </div>
                                                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden shadow-inner">
                                                        <div className="bg-blue-600 h-full rounded-full transition-all duration-1000 ease-out relative shadow-lg shadow-blue-500/20" style={{ width: `${percentage}%` }}>
                                                            <div className="absolute top-0 left-0 bottom-0 right-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-full"></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : <div className="p-16 text-center text-gray-400 font-bold uppercase tracking-widest text-xs">Analiz verisi bulunamadı.</div>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'settings' && canViewSettings && (
                    <div className="bg-white dark:bg-gray-800 p-12 rounded-[3rem] shadow-sm border-2 border-red-50 dark:border-red-900/20 max-w-2xl mx-auto mt-12 animate-slide-in">
                        <h3 className="text-2xl font-black text-red-600 mb-8 uppercase tracking-widest flex items-center gap-4">⚠️ Kritik Bölge</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-10 text-lg font-medium leading-relaxed italic">Bu işlem projenin tüm tarihçesini, dosyalarını ve iletişim kayıtlarını sunucudan kalıcı olarak kaldıracaktır.</p>
                        <div className="flex justify-end">
                            <button onClick={() => setShowDeleteModal(true)} className="bg-red-50 hover:bg-red-600 hover:text-white text-red-600 border-2 border-red-100 px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-red-500/10 active:scale-95">
                                Projeyi Tamamen İmha Et
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* --- MODALS (CİLALANDI) --- */}
            
            {/* 1. Faz Ekleme */}
            {showPhaseModal && (
                <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-lg flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 p-10 rounded-[2.5rem] w-[400px] shadow-2xl border border-gray-100 dark:border-gray-700">
                        <h3 className="text-xl font-black text-gray-900 dark:text-white mb-8 uppercase tracking-[0.2em]">Yeni Disiplin</h3>
                        <input autoFocus className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl font-bold dark:text-white outline-none focus:border-blue-500 transition-all mb-8" placeholder="Örn: Statik Projeler" value={newPhaseName} onChange={e=>setNewPhaseName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAddPhase()}/>
                        <div className="flex gap-4">
                            <button onClick={()=>setShowPhaseModal(false)} className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">İptal</button>
                            <button onClick={handleAddPhase} className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95">Ekle</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. Rapor Sihirbazı */}
            {showReportModal && (
                <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-xl flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-[3rem] shadow-2xl w-full max-w-md border border-gray-100 dark:border-gray-700 overflow-hidden animate-slide-in">
                        <div className="p-10 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                            <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-widest">Rapor Parametreleri</h3>
                            <button onClick={() => setShowReportModal(false)} className="w-10 h-10 rounded-full bg-white dark:bg-gray-700 shadow-sm flex items-center justify-center text-gray-400 hover:text-red-500">✕</button>
                        </div>
                        <div className="p-10 space-y-4">
                            {[
                                {k:'financials', l:'Bütçe Analizi', d:'Nakit akışı ve maliyet verileri', i:'💰'},
                                {k:'weekly', l:'Haftalık İvme', d:'İş yükü ve hız grafikleri', i:'📅'},
                                {k:'risks', l:'Risk & Kritik Yol', d:'Geciken işlerin tespiti', i:'⚠️'},
                                {k:'phases', l:'Disiplin Kırılımı', d:'Bölüm bazlı detaylı döküm', i:'🏗️'}
                            ].map(opt => (
                                <label key={opt.k} className={`flex items-center p-5 border-2 rounded-[1.5rem] cursor-pointer transition-all group ${reportOptions[opt.k] ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-transparent border-gray-100 dark:border-gray-700 hover:bg-gray-50'}`}>
                                    <input type="checkbox" checked={reportOptions[opt.k]} onChange={e => setReportOptions({...reportOptions, [opt.k]: e.target.checked})} className="w-6 h-6 text-blue-600 rounded-lg focus:ring-0" />
                                    <div className="ml-5">
                                        <span className={`block font-black text-xs uppercase tracking-wider ${reportOptions[opt.k] ? 'text-blue-700 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>{opt.i} {opt.l}</span>
                                        <span className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-tight">{opt.d}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                        <div className="p-10 border-t dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex flex-col gap-3">
                            <button onClick={confirmDownloadReport} disabled={isGeneratingReport} className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-blue-500/30 active:scale-95 disabled:opacity-50 flex justify-center items-center gap-3">
                                {isGeneratingReport ? <LoadingSpinner size="small" color="white"/> : 'PDF Dokümanı Üret'}
                            </button>
                            <button onClick={() => setShowReportModal(false)} className="w-full py-4 text-gray-400 font-black text-[10px] uppercase tracking-widest hover:text-gray-600">İptal</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. Proje Tamamlama Onayı */}
            {showCompleteModal && (
                <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-lg flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 p-10 rounded-[3rem] max-w-sm w-full shadow-2xl border border-gray-100 dark:border-gray-700 text-center animate-slide-in">
                        <div className="text-6xl mb-6">🏆</div>
                        <h3 className="text-2xl font-black dark:text-white uppercase tracking-widest mb-4">Harika İş!</h3>
                        <p className="text-gray-500 dark:text-gray-400 font-medium mb-10 leading-relaxed italic text-sm">Bu projeyi başarıyla tamamlandı olarak işaretlemek istediğinizden emin misiniz?</p>
                        <div className="flex flex-col gap-3">
                            <button onClick={() => updateStatusAPI('completed')} className="w-full py-5 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-green-500/20 active:scale-95 transition-all">Evet, Teslim Et</button>
                            <button onClick={() => setShowCompleteModal(false)} className="w-full py-4 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">Vazgeç</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 4. Silme Onayı */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-red-900/20 backdrop-blur-xl flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 p-12 rounded-[3rem] max-w-sm w-full shadow-2xl border-4 border-red-100 dark:border-red-900 text-center animate-slide-in">
                        <div className="text-5xl mb-6">🗑️</div>
                        <h3 className="text-xl font-black text-red-600 uppercase tracking-widest mb-4">Geri Dönüş Yok</h3>
                        <p className="text-gray-500 dark:text-gray-300 font-bold mb-10 text-sm">Tüm verileri silmek istediğinize emin misiniz? Bu işlem iptal edilemez.</p>
                        <div className="flex flex-col gap-3">
                            <button onClick={handleDeleteProject} className="w-full py-5 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-red-500/20 active:scale-95 transition-all">Kalıcı Olarak Sil</button>
                            <button onClick={() => setShowDeleteModal(false)} className="w-full py-4 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">İptal</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectDetail;