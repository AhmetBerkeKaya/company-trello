// src/pages/Projects.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import { useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';

const PROJECT_TYPES = {
  CAD: { code: 'CAD', name: 'CAD Tasarım', prefix: 'CAD', sequence: 1 },
  CAM: { code: 'CAM', name: 'CAM İmalat', prefix: 'CAM', sequence: 2 },
  CAE: { code: 'CAE', name: 'CAE Analiz', prefix: 'CAE', sequence: 3 },
  BIM: { code: 'BIM', name: 'BIM Modelleme', prefix: 'BIM', sequence: 4 },
  MES: { code: 'MES', name: 'MES Sistemi', prefix: 'MES', sequence: 5 },
  PLM: { code: 'PLM', name: 'PLM Yönetimi', prefix: 'PLM', sequence: 6 },
  PDM: { code: 'PDM', name: 'PDM Veri Yönetimi', prefix: 'PDM', sequence: 7 },
  ERP: { code: 'ERP', name: 'ERP Planlama', prefix: 'ERP', sequence: 8 },
  MRP: { code: 'MRP', name: 'MRP Üretim', prefix: 'MRP', sequence: 9 },
  CMMS: { code: 'CMMS', name: 'CMMS Bakım', prefix: 'CMM', sequence: 10 },
  SCM: { code: 'SCM', name: 'SCM Tedarik', prefix: 'SCM', sequence: 11 },
  CRM: { code: 'CRM', name: 'CRM Müşteri', prefix: 'CRM', sequence: 12 },
  APS: { code: 'APS', name: 'APS Planlama', prefix: 'APS', sequence: 13 },
  QMS: { code: 'QMS', name: 'QMS Kalite', prefix: 'QMS', sequence: 14 },
  EAM: { code: 'EAM', name: 'EAM Varlık', prefix: 'EAM', sequence: 15 },
  WMS: { code: 'WMS', name: 'WMS Depo', prefix: 'WMS', sequence: 16 },
  DMS: { code: 'DMS', name: 'DMS Doküman', prefix: 'DMS', sequence: 17 },
  HCM: { code: 'HCM', name: 'HCM İnsan Kaynakları', prefix: 'HCM', sequence: 18 },
  LIMS: { code: 'LIMS', name: 'LIMS Laboratuvar', prefix: 'LMS', sequence: 19 },
  MOM: { code: 'MOM', name: 'MOM Operasyon', prefix: 'MOM', sequence: 20 }
};

const Projects = () => {
  const { userData } = useAuth();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('all');
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [debugInfo, setDebugInfo] = useState('');
  const navigate = useNavigate();
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [newProject, setNewProject] = useState({
    title: '', description: '', company: '', projectType: '',
    members: [], projectManager: '', startDate: '', endDate: '', status: 'active'
  });
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showProjectSettingsModal, setShowProjectSettingsModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectMembers, setProjectMembers] = useState([]);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [companies, setCompanies] = useState([]);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [newCompany, setNewCompany] = useState('');

  const [showCompanyInfoModal, setShowCompanyInfoModal] = useState(false);
  const [selectedCompanyInfo, setSelectedCompanyInfo] = useState(null);
  const [loadingCompanyInfo, setLoadingCompanyInfo] = useState(false);

  const [isProjectTypeOpen, setIsProjectTypeOpen] = useState(false);
  const [projectCode, setProjectCode] = useState('');

  const isObserver = userData?.role === 'observer';
  const canCreateProject = !isObserver && (userData?.role === 'admin' || userData?.role === 'manager');

  useEffect(() => {
    if (userData) {
      const loadAllData = async () => {
        setLoading(true);
        try {
          await Promise.all([fetchProjects(), fetchAllUsers(), fetchCompanies()]);
          setDebugInfo('Tüm veriler yüklendi');
        } catch (error) {
          console.error('Sayfa verisi yüklenirken hata:', error);
          setDebugInfo('Veri yüklenirken hata oluştu');
        } finally {
          setLoading(false);
        }
      };
      loadAllData();
    }
  }, [userData]);

  useEffect(() => { if (location.state?.activeTab) setActiveTab(location.state.activeTab); }, [location.state]);
  useEffect(() => { setFilter(activeTab); }, [activeTab]);

  useEffect(() => {
    if (newProject.projectManager && !newProject.members.includes(newProject.projectManager)) {
      setNewProject(prev => ({ ...prev, members: [...prev.members, newProject.projectManager] }));
    }
  }, [newProject.projectManager]);

  useEffect(() => {
    if (userData?.role === 'manager' && !newProject.projectManager) {
      setNewProject(prev => ({ ...prev, projectManager: userData.user_id }));
    }
  }, [userData, newProject.projectManager]);

  useEffect(() => {
    if (newProject.projectType) {
      const selectedType = PROJECT_TYPES[newProject.projectType];
      if (!selectedType) return;
      const year = new Date().getFullYear();
      setProjectCode(`${selectedType.prefix}-${year}-XXX`);
    } else {
      setProjectCode('');
    }
  }, [newProject.projectType]);

  const fetchProjects = async () => {
    setDebugInfo('Projeler yükleniyor...');
    try {
      const response = await api.get('/projects');
      setProjects(response.data);
      setDebugInfo(`${response.data.length} proje bulundu`);
    } catch (error) {
      console.error('❌ Projeleri getirme hatası:', error);
      setDebugInfo(`Hata: ${error.message}`);
    }
  };

  const fetchAllUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await api.get('/users');
      setAllUsers(response.data);
    } catch (error) {
      console.error('Kullanıcıları getirme hatası:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const response = await api.get('/companies');
      setCompanies(response.data);
    } catch (error) {
      console.error('❌ Firmaları getirme hatası:', error);
      setCompanies([]);
    }
  };

  const handleAddCompany = async () => {
    if (!newCompany.trim()) return alert('Firma adı girmelisiniz!');
    try {
      const response = await api.post('/companies', { name: newCompany.trim() });
      const addedCompany = response.data;
      const companyId = addedCompany.company_id || addedCompany.id;
      if (!addedCompany.company_id) addedCompany.company_id = companyId;

      const newCompanyWithStats = { ...addedCompany, id: companyId, totalProjects: 0, activeProjects: 0, completedProjects: 0 };

      setCompanies(prev => [...prev, newCompanyWithStats].sort((a, b) => a.name.localeCompare(b.name)));
      setNewProject(prev => ({ ...prev, company: companyId }));
      setShowCompanyModal(false);
      setNewCompany('');
    } catch (error) {
      console.error('❌ Firma ekleme hatası:', error);
      if (error.response?.status === 409) alert('Bu isimde bir firma zaten mevcut');
      else alert('Firma eklenirken hata oluştu');
    }
  };

  const handleAddProject = async (e) => {
    e.preventDefault();
    if (!canCreateProject) return alert('Proje ekleme yetkiniz yok!');
    if (!newProject.projectType) return alert('Proje tipi seçmelisin!');
    if (!newProject.company) return alert('Firma seçmelisiniz!');
    if (!newProject.projectManager) return alert('Proje yöneticisi seçmelisin!');

    try {
      const response = await api.post('/projects', {
        title: newProject.title, description: newProject.description, company: newProject.company,
        projectType: newProject.projectType, members: newProject.members, projectManager: newProject.projectManager,
        startDate: newProject.startDate || null, endDate: newProject.endDate || null, status: newProject.status
      });

      const addedProject = response.data;
      setShowAddProjectModal(false);
      setNewProject({ title: '', description: '', company: '', projectType: '', members: [], projectManager: '', startDate: '', endDate: '', status: 'active' });
      setProjectCode('');
      setUserSearch('');
      setProjects(prev => [addedProject, ...prev]);

      setCompanies(prev => prev.map(c =>
        c.id === addedProject.company_id
          ? { ...c, totalProjects: (c.totalProjects || 0) + 1, activeProjects: (c.activeProjects || 0) + 1 }
          : c
      ));
    } catch (error) {
      console.error('❌ Proje ekleme hatası:', error);
      alert('Proje eklenirken hata oluştu: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleOpenProjectSettings = async (project) => {
    if (isObserver) return;
    if (userData.role !== 'admin' && userData.role !== 'manager') {
      alert('Proje ayarlarını değiştirme yetkiniz yok!');
      return;
    }
    setSelectedProject(project);
    setLoadingSettings(true);
    setShowProjectSettingsModal(true);
    try {
      const response = await api.get(`/projects/${project.project_id}/members`);
      setProjectMembers(response.data.map(member => member.user_id));
    } catch (error) {
      console.error('Proje üyeleri getirilemedi:', error);
      setShowProjectSettingsModal(false);
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleUpdateProjectMembers = async () => {
    if (!selectedProject || isObserver) return;
    setLoadingSettings(true);
    try {
      await api.put(`/projects/${selectedProject.project_id}/members`, {
        members: projectMembers,
        projectManager: selectedProject.project_manager
      });
      await fetchProjects();
      setShowProjectSettingsModal(false);
      setSelectedProject(null);
      alert('Proje üyeleri güncellendi!');
    } catch (error) {
      console.error('Üye güncelleme hatası:', error);
      alert('Hata: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleShowCompanyInfo = async (company) => {
    setLoadingCompanyInfo(true);
    setShowCompanyInfoModal(true);
    try {
      const companyDetails = companies.find(c => c.id === company.id);
      const projectsRes = await api.get(`/companies/${company.id}/projects`);
      setSelectedCompanyInfo({ ...companyDetails, projects: projectsRes.data });
    } catch (error) {
      console.error('❌ Firma detayları getirme hatası:', error);
      setShowCompanyInfoModal(false);
    } finally {
      setLoadingCompanyInfo(false);
    }
  };

  const filteredProjects = projects.filter(project => {
    if (filter === 'all') return true;
    return project.status === filter;
  });

  const filteredUsers = allUsers.filter(user =>
    user.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    user.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const getStatusClass = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'completed': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'on-hold': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active': return 'Aktif';
      case 'completed': return 'Tamamlandı';
      case 'on-hold': return 'Beklemede';
      default: return status;
    }
  };

  const getRoleClass = (role) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'manager': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getRoleText = (role) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'manager': return 'Proje Yöneticisi';
      default: return 'Kullanıcı';
    }
  };

  if (loading) return (
    <div className="max-w-7xl mx-auto py-6 px-4">
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="large" />
      </div>
    </div>
  );

  // --- PROJE KARTI ---
  const ProjectCard = ({ project }) => (
    <div className="group bg-white dark:bg-gray-800 rounded-3xl shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-gray-900/50 transition-all duration-300 border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col h-full transform hover:-translate-y-1">
      <div className="p-7 flex-1 flex flex-col">

        <div className="flex justify-between items-start gap-4 mb-4">
          <h3 className="text-xl font-extrabold text-gray-900 dark:text-white line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {project.name}
          </h3>
          <span className={`shrink-0 px-3.5 py-1 text-xs font-bold rounded-full ${getStatusClass(project.status)}`}>
            {getStatusText(project.status)}
          </span>
        </div>

        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 line-clamp-3 flex-1 leading-relaxed">
          {project.description || 'Bu proje için henüz bir açıklama girilmemiş.'}
        </p>

        <div className="space-y-3 mb-6 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-700/50">
          <div className="flex items-center gap-3.5 text-sm">
            <div className="w-8 h-8 rounded-full bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center text-base shrink-0">🏢</div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Firma</span>
              <span className="font-bold text-gray-900 dark:text-white truncate">{project.company_name || 'Bilinmiyor'}</span>
            </div>
          </div>
          <div className="flex items-center gap-3.5 text-sm">
            <div className="w-8 h-8 rounded-full bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center text-base shrink-0">📅</div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Oluşturulma</span>
              <span className="font-bold text-gray-900 dark:text-white truncate">
                {project.created_at ? new Date(project.created_at).toLocaleDateString('tr-TR') : 'Bilinmiyor'}
              </span>
            </div>
          </div>
          {/* Eski koddan: Proje Sahibi rozeti */}
          {project.created_by_user_id === userData?.user_id && (
            <div className="flex items-center gap-3.5 text-sm">
              <div className="w-8 h-8 rounded-full bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center text-base shrink-0">👑</div>
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Rolünüz</span>
                <span className="font-bold text-blue-600 dark:text-blue-400 truncate">Proje Sahibi</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 mt-auto">
          <button
            onClick={() => navigate(`/projects/${project.project_id}`)}
            className="flex-1 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 text-blue-600 dark:text-blue-400 py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
          >
            Projeyi Aç
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>

          {!isObserver && (userData.role === 'admin' || userData.role === 'manager') && (
            <button
              onClick={() => handleOpenProjectSettings(project)}
              className="p-3 bg-gray-50 hover:bg-gray-200 dark:bg-gray-700/50 dark:hover:bg-gray-600 rounded-xl text-gray-600 dark:text-gray-300 transition-colors shrink-0"
              title="Proje Ayarları"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6 border-b border-gray-200 dark:border-gray-800 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">Projelerim</h1>
              {isObserver && (
                <span className="px-3.5 py-1.5 bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300 text-xs font-bold rounded-full shadow-sm">
                  👁️ Gözlemci Modu
                </span>
              )}
            </div>
            <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium text-lg">Tüm projelerinizi ve detaylarını buradan yönetin.</p>
          </div>

          <div className="flex items-center gap-6 w-full md:w-auto">
            <div className="hidden sm:block text-right pr-6 border-r border-gray-200 dark:border-gray-700">
              <div className="text-3xl font-extrabold text-gray-900 dark:text-white leading-none">{projects.length}</div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">Toplam Proje</div>
            </div>

            {canCreateProject && (
              <button
                onClick={() => setShowAddProjectModal(true)}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 rounded-xl font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                </svg>
                Yeni Proje Ekle
              </button>
            )}
          </div>
        </div>

        {/* FİLTRE ÇUBUĞU */}
        <div className="flex overflow-x-auto custom-scrollbar pb-2 mb-8">
          <div className="flex p-1.5 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 shrink-0">
            {[
              { key: 'all', label: 'Tüm Projeler', count: projects.length },
              { key: 'active', label: 'Aktif', count: projects.filter(p => p.status === 'active').length },
              { key: 'completed', label: 'Tamamlanan', count: projects.filter(p => p.status === 'completed').length },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center gap-2 ${
                  filter === f.key
                    ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                {f.label}
                <span className={`px-2 py-0.5 rounded-full text-xs ${filter === f.key ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* PROJE LİSTESİ VEYA BOŞ DURUM */}
        {filteredProjects.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-16 text-center animate-fade-in">
            <div className="w-24 h-24 bg-gray-50 dark:bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl opacity-50">📁</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              {filter === 'all' ? 'Henüz hiç projeniz yok' : 'Bu filtrede proje bulunamadı'}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
              {filter === 'all'
                ? 'Sisteme yeni bir proje ekleyerek çalışmaya başlayın veya bir projeye davet edilmeyi bekleyin.'
                : 'Farklı bir durum filtresi seçerek diğer projelerinizi görüntüleyebilirsiniz.'}
            </p>
            {filter === 'all' && canCreateProject && (
              <button
                onClick={() => setShowAddProjectModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-xl font-bold transition-all shadow-md active:scale-95"
              >
                İlk Projeni Oluştur
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {filteredProjects.map((project) => (
              <ProjectCard key={project.project_id} project={project} />
            ))}
          </div>
        )}
      </div>

      {/* ===================== MODALLAR ===================== */}

      {/* 1. Proje Ekleme Modalı */}
      {showAddProjectModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col animate-slide-in overflow-hidden border border-gray-200 dark:border-gray-700">

            <div className="p-6 md:px-8 md:py-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50 shrink-0">
              <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Yeni Proje Oluştur</h3>
              <button
                onClick={() => { setShowAddProjectModal(false); setUserSearch(''); setIsProjectTypeOpen(false); }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
              >✕</button>
            </div>

            <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1">
              <form id="add-project-form" onSubmit={handleAddProject} className="space-y-6">

                {isProjectTypeOpen && (
                  <div className="fixed inset-0 z-[70]" onClick={() => setIsProjectTypeOpen(false)} />
                )}

                {/* Proje Tipi + Proje Adı */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 ml-1">Proje Tipi *</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsProjectTypeOpen(!isProjectTypeOpen)}
                        className="w-full px-4 py-3.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 bg-gray-50 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 dark:text-white text-left flex justify-between items-center transition-colors"
                      >
                        <span className="font-semibold">{newProject.projectType ? PROJECT_TYPES[newProject.projectType]?.name : 'Tip seçin...'}</span>
                        <span className="text-gray-400">▼</span>
                      </button>
                      {isProjectTypeOpen && (
                        <div className="absolute z-[80] w-full mt-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-2xl max-h-64 overflow-y-auto custom-scrollbar py-2">
                          {Object.entries(PROJECT_TYPES).map(([key, type]) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => { setNewProject({ ...newProject, projectType: key }); setIsProjectTypeOpen(false); }}
                              className={`w-full text-left px-5 py-3 text-sm hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors ${newProject.projectType === key ? 'bg-blue-50 dark:bg-gray-700 text-blue-700 dark:text-blue-300 font-bold' : 'text-gray-700 dark:text-gray-300 font-medium'}`}
                            >
                              <div className="flex justify-between items-center">
                                <span>{type.name}</span>
                                <span className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded-md">{type.prefix}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 ml-1">Proje Adı *</label>
                    <input
                      type="text"
                      required
                      value={newProject.title}
                      onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                      className="w-full px-4 py-3.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 dark:text-white font-medium placeholder-gray-400"
                      placeholder="Örn: B Blok Şantiye"
                    />
                  </div>
                </div>

                {/* Proje Kodu Gösterimi */}
                {newProject.projectType && (
                  <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-blue-800 dark:text-blue-300">{PROJECT_TYPES[newProject.projectType]?.name}</span>
                      <span className="text-sm text-blue-600 dark:text-blue-400 ml-2">({PROJECT_TYPES[newProject.projectType]?.prefix})</span>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-extrabold text-blue-700 dark:text-blue-400 tracking-wider bg-white dark:bg-gray-800 px-3 py-1 rounded-lg border border-blue-200 dark:border-gray-700">
                        {projectCode || 'API'}
                      </div>
                      <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">Proje Kodu</div>
                    </div>
                  </div>
                )}

                {/* Firma */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 ml-1">Firma *</label>
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <select
                        required
                        value={newProject.company}
                        onChange={(e) => setNewProject({ ...newProject, company: e.target.value })}
                        className="w-full px-4 py-3.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 dark:text-white font-medium appearance-none cursor-pointer"
                      >
                        <option value="">Firma seçin...</option>
                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-10 flex items-center text-gray-400">▼</div>
                      {newProject.company && (
                        <button
                          type="button"
                          onClick={() => handleShowCompanyInfo(companies.find(c => c.id === newProject.company))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/40 dark:hover:bg-blue-800 text-blue-600 dark:text-blue-300 rounded-lg flex items-center justify-center transition-colors"
                          title="Detaylar"
                        >ℹ️</button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Proje Yöneticisi */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 ml-1">Proje Yöneticisi *</label>
                  {userData?.role === 'admin' ? (
                    <div className="relative">
                      <select
                        required
                        value={newProject.projectManager}
                        onChange={(e) => setNewProject({ ...newProject, projectManager: e.target.value })}
                        className="w-full px-4 py-3.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 dark:text-white font-medium appearance-none cursor-pointer"
                      >
                        <option value="">Yönetici Seçin</option>
                        {allUsers.filter(u => u.role === 'admin' || u.role === 'manager').map(u => (
                          <option key={u.user_id} value={u.user_id}>{u.name} ({u.role === 'admin' ? 'Admin' : 'Proje Yöneticisi'})</option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-gray-400">▼</div>
                    </div>
                  ) : userData?.role === 'manager' ? (
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white">{userData.name}</p>
                        <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mt-1">Otomatik Atandı</p>
                        <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">📝 Proje yöneticisi olarak otomatik atandınız</p>
                      </div>
                      <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs">✓</div>
                    </div>
                  ) : (
                    <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm font-bold">⚠️ Proje oluşturma yetkiniz bulunmamaktadır.</div>
                  )}
                </div>

                {/* Proje Ekibi */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 ml-1 flex justify-between">
                    <span>Proje Ekibi ({newProject.members.length} üye seçildi)</span>
                  </label>
                  <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-2">
                    <div className="mb-2 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                      <input
                        type="text"
                        placeholder="İsim veya e-posta ara..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm dark:text-white"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1 p-1">
                      {filteredUsers.map(user => (
                        <label
                          key={user.user_id}
                          className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors border border-transparent ${newProject.members.includes(user.user_id) ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50' : 'hover:bg-white dark:hover:bg-gray-800'}`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={newProject.members.includes(user.user_id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewProject({ ...newProject, members: [...newProject.members, user.user_id] });
                                } else {
                                  setNewProject({ ...newProject, members: newProject.members.filter(id => id !== user.user_id) });
                                }
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <div>
                              <p className="font-bold text-sm text-gray-900 dark:text-white">{user.name}</p>
                              <p className="text-xs text-gray-500">{user.role}{user.email && ` - ${user.email}`}</p>
                            </div>
                          </div>
                          {/* Eski koddan: Rol badge'leri */}
                          <span className={`px-2 py-1 text-xs rounded-full font-medium ${getRoleClass(user.role)}`}>
                            {getRoleText(user.role)}
                          </span>
                        </label>
                      ))}
                    </div>
                    {/* Eski koddan: Tümünü Seç / Seçimi Temizle */}
                    <div className="flex gap-2 mt-2 px-1">
                      <button
                        type="button"
                        onClick={() => setNewProject({ ...newProject, members: allUsers.map(u => u.user_id) })}
                        className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl transition-colors"
                      >
                        Tümünü Seç
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewProject({ ...newProject, members: newProject.projectManager ? [newProject.projectManager] : [] })}
                        className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors"
                      >
                        Seçimi Temizle
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-2 px-1">• Proje yöneticisi otomatik olarak üye olarak eklenecek</p>
                  </div>
                </div>

                {/* Açıklama */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 ml-1">Proje Açıklaması</label>
                  <textarea
                    value={newProject.description}
                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                    rows="3"
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 dark:text-white resize-none"
                    placeholder="Projenin amacı, kapsamı vb."
                  />
                </div>

                {/* Eski koddan: Başlangıç / Bitiş Tarihi */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 ml-1">Başlangıç Tarihi</label>
                    <input
                      type="date"
                      value={newProject.startDate}
                      onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 ml-1">Bitiş Tarihi</label>
                    <input
                      type="date"
                      value={newProject.endDate}
                      onChange={(e) => setNewProject({ ...newProject, endDate: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 dark:text-white"
                    />
                  </div>
                </div>

              </form>
            </div>

            <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex gap-4 shrink-0">
              <button
                type="button"
                onClick={() => { setShowAddProjectModal(false); setUserSearch(''); setIsProjectTypeOpen(false); }}
                className="flex-1 px-6 py-3.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >İptal</button>
              <button
                type="submit"
                form="add-project-form"
                className="flex-1 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/30 transition-all active:scale-95"
              >Projeyi Oluştur</button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Firma Ekleme Modalı */}
      {showCompanyModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-md w-full animate-slide-in overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">Yeni Firma Ekle</h3>
              <button
                onClick={() => { setShowCompanyModal(false); setNewCompany(''); }}
                className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center"
              >✕</button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 ml-1">Firma Adı (Resmi Ünvan) *</label>
                <input
                  autoFocus
                  type="text"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCompany()}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 dark:text-white font-medium"
                  placeholder="Örn: ProAEC Yazılım A.Ş."
                />
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
                <p className="text-xs text-blue-600 dark:text-blue-400">💡 Firma eklendikten sonra listeden seçebilirsiniz.</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowCompanyModal(false); setNewCompany(''); }}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-bold transition-colors"
                >İptal</button>
                <button
                  type="button"
                  onClick={handleAddCompany}
                  disabled={!newCompany.trim()}
                  className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold disabled:opacity-50 shadow-md shadow-green-500/20 transition-all active:scale-95"
                >Firmayı Kaydet</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Firma Bilgileri Modalı */}
      {showCompanyInfoModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col animate-slide-in overflow-hidden border border-gray-200 dark:border-gray-700">
            {loadingCompanyInfo ? (
              <div className="flex justify-center items-center h-64"><LoadingSpinner size="large" /></div>
            ) : selectedCompanyInfo ? (
              <>
                <div className="p-6 md:p-8 border-b border-gray-100 dark:border-gray-700 flex justify-between items-start bg-gray-50/50 dark:bg-gray-800/50 shrink-0">
                  <div>
                    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-bold rounded-lg mb-3 uppercase tracking-wider">Müşteri Kartı</span>
                    <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white leading-tight">🏢 {selectedCompanyInfo.name}</h3>
                  </div>
                  <button
                    onClick={() => setShowCompanyInfoModal(false)}
                    className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center shrink-0"
                  >✕</button>
                </div>

                <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                  {/* İstatistikler */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl">
                      <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">{selectedCompanyInfo.totalProjects || 0}</div>
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-2">Toplam</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl">
                      <div className="text-3xl font-extrabold text-green-500">{selectedCompanyInfo.activeProjects || 0}</div>
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-2">Aktif</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl">
                      <div className="text-3xl font-extrabold text-gray-400">{selectedCompanyInfo.completedProjects || 0}</div>
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-2">Biten</div>
                    </div>
                  </div>

                  {/* Firma Bilgileri - Eski koddan */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
                    <h4 className="font-bold text-gray-900 dark:text-white mb-3">Firma Bilgileri</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Oluşturulma Tarihi:</span>
                        <span className="font-bold text-gray-900 dark:text-white">
                          {selectedCompanyInfo.created_at ? new Date(selectedCompanyInfo.created_at).toLocaleDateString('tr-TR') : 'Bilinmiyor'}
                        </span>
                      </div>
                      {selectedCompanyInfo.created_by_name && (
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">Ekleyen:</span>
                          <span className="font-bold text-gray-900 dark:text-white">{selectedCompanyInfo.created_by_name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Proje Geçmişi */}
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white mb-4 text-lg">
                      Proje Geçmişi ({selectedCompanyInfo.projects?.length || 0})
                    </h4>
                    {selectedCompanyInfo.projects?.length === 0 ? (
                      <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
                        <span className="text-4xl opacity-50 block mb-2">📁</span>
                        <span className="text-sm font-medium text-gray-500">Kayıtlı proje yok</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedCompanyInfo.projects?.map(project => (
                          <div key={project.id} className="flex items-center justify-between p-4 border border-gray-100 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow">
                            <div>
                              <h5 className="font-bold text-gray-900 dark:text-white text-base">{project.title}</h5>
                              {/* Eski koddan: başlangıç ve bitiş tarihleri */}
                              <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 font-medium">
                                <span>Başlangıç: {project.start_date ? new Date(project.start_date).toLocaleDateString('tr-TR') : '-'}</span>
                                <span>Bitiş: {project.end_date ? new Date(project.end_date).toLocaleDateString('tr-TR') : '-'}</span>
                              </div>
                            </div>
                            <span className={`px-3 py-1 text-xs font-bold rounded-full ${getStatusClass(project.status)}`}>
                              {getStatusText(project.status)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Eski koddan: Tamam butonu */}
                <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-end shrink-0">
                  <button
                    onClick={() => setShowCompanyInfoModal(false)}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all active:scale-95"
                  >
                    Tamam
                  </button>
                </div>
              </>
            ) : (
              <div className="p-6 text-center text-gray-500">Hata: Firma bilgileri yüklenemedi.</div>
            )}
          </div>
        </div>
      )}

      {/* 4. Proje Ayarları (Üye Yönetimi) Modalı */}
      {showProjectSettingsModal && selectedProject && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-lg w-full flex flex-col max-h-[90vh] animate-slide-in overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50 shrink-0">
              <div>
                <h3 className="text-xl font-extrabold text-gray-900 dark:text-white truncate pr-4">Ekip: {selectedProject.name}</h3>
                {!loadingSettings && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{projectMembers.length} üye seçili</p>
                )}
              </div>
              <button
                onClick={() => setShowProjectSettingsModal(false)}
                className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center shrink-0"
              >✕</button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              {loadingSettings ? (
                <div className="flex justify-center py-10"><LoadingSpinner size="large" /></div>
              ) : (
                <div className="space-y-2">
                  {allUsers.map(user => {
                    const isManager = user.user_id === selectedProject.project_manager;
                    const isSelected = projectMembers.includes(user.user_id);
                    return (
                      <label
                        key={user.user_id}
                        className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors border ${isSelected ? 'bg-blue-50/50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-white border-gray-100 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700'}`}
                      >
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setProjectMembers([...projectMembers, user.user_id]);
                              } else {
                                if (isManager) return alert('Proje yöneticisini kaldıramazsınız!');
                                setProjectMembers(projectMembers.filter(id => id !== user.user_id));
                              }
                            }}
                            disabled={isManager}
                            className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
                          />
                          <div>
                            <p className="font-bold text-sm text-gray-900 dark:text-white">{user.name}</p>
                            <p className="text-xs text-gray-500 font-medium">
                              {user.role}
                              {isManager && <span className="text-blue-600 dark:text-blue-400 ml-1">(Proje Yöneticisi)</span>}
                            </p>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex gap-4 shrink-0">
              <button
                type="button"
                onClick={() => setShowProjectSettingsModal(false)}
                className="flex-1 px-4 py-3.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-bold transition-colors"
              >İptal</button>
              <button
                onClick={handleUpdateProjectMembers}
                disabled={loadingSettings}
                className="flex-1 px-4 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                {loadingSettings ? 'Güncelleniyor...' : 'Ekibi Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Projects;