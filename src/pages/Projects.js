import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, orderBy, addDoc, serverTimestamp, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import { useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';

// Proje Tipleri ve Kodları
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
    title: '',
    description: '',
    company: '',
    projectType: '',
    members: [],
    projectManager: '',
    startDate: '',
    endDate: '',
    status: 'active'
  });
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showProjectSettingsModal, setShowProjectSettingsModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectMembers, setProjectMembers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [companies, setCompanies] = useState([]);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [newCompany, setNewCompany] = useState('');
  const [showCompanyInfoModal, setShowCompanyInfoModal] = useState(false);
  const [selectedCompanyInfo, setSelectedCompanyInfo] = useState(null);
  const [isProjectTypeOpen, setIsProjectTypeOpen] = useState(false);
  const [projectCode, setProjectCode] = useState('');

  useEffect(() => {
    fetchProjects();
    fetchAllUsers();
    fetchCompanies();
  }, [userData, filter]);

  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
    }
  }, [location.state]);

  useEffect(() => {
    setFilter(activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (newProject.projectManager && !newProject.members.includes(newProject.projectManager)) {
      setNewProject(prev => ({
        ...prev,
        members: [...prev.members, newProject.projectManager]
      }));
    }
  }, [newProject.projectManager]);

  useEffect(() => {
    if (userData?.role === 'manager' && !newProject.projectManager) {
      setNewProject(prev => ({
        ...prev,
        projectManager: userData.id
      }));
    }
  }, [userData, newProject.projectManager]);

  useEffect(() => {
    if (newProject.projectType) {
      const generateCode = async () => {
        const code = await generateProjectCode(newProject.projectType);
        setProjectCode(code);
      };
      generateCode();
    } else {
      setProjectCode('');
    }
  }, [newProject.projectType]);

  const fetchProjects = async () => {
    if (!userData) {
      setDebugInfo('Kullanıcı verisi yok');
      return;
    }

    try {
      setLoading(true);
      setDebugInfo(`Kullanıcı ID: ${userData.id}, Rol: ${userData.role}`);

      const projectsQuery = query(
        collection(db, 'projects'),
        where('members', 'array-contains', userData.id)
      );

      const projectsSnapshot = await getDocs(projectsQuery);
      console.log('📊 Sorgu sonucu:', projectsSnapshot.docs.length, 'proje bulundu');

      const projectsData = projectsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data
        };
      });

      projectsData.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB - dateA;
      });

      setProjects(projectsData);
      setDebugInfo(`${projectsData.length} proje bulundu`);

    } catch (error) {
      console.error('❌ Projeleri getirme hatası:', error);
      setDebugInfo(`Hata: ${error.message}`);

      try {
        const allProjectsSnapshot = await getDocs(collection(db, 'projects'));
        const allProjects = allProjectsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        const userProjects = allProjects.filter(project =>
          project.members?.includes(userData.id)
        );

        userProjects.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateB - dateA;
        });

        setProjects(userProjects);
        setDebugInfo(`${userProjects.length} proje bulundu (geçici çözüm)`);

      } catch (fallbackError) {
        console.error('Geçici çözüm de başarısız:', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      setLoadingUsers(true);
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);

      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setAllUsers(usersData);
    } catch (error) {
      console.error('Kullanıcıları getirme hatası:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const companiesQuery = query(
        collection(db, 'companies'),
        orderBy('name')
      );
      const companiesSnapshot = await getDocs(companiesQuery);
      
      const companiesData = companiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setCompanies(companiesData);
      console.log('✅ Firmalar yüklendi:', companiesData.length);
    } catch (error) {
      console.error('❌ Firmaları getirme hatası:', error);
      setCompanies([]);
    }
  };

  const generateProjectCode = async (projectType) => {
    if (!projectType) return '';

    const selectedType = PROJECT_TYPES[projectType];
    if (!selectedType) return '';

    try {
      const projectsQuery = query(
        collection(db, 'projects'),
        where('projectType', '==', projectType)
      );
      const projectsSnapshot = await getDocs(projectsQuery);
      const projectCount = projectsSnapshot.size + 1;

      const year = new Date().getFullYear();
      const sequence = projectCount.toString().padStart(3, '0');
      
      return `${selectedType.prefix}-${year}-${sequence}`;
    } catch (error) {
      console.error('❌ Proje kodu oluşturma hatası:', error);
      const year = new Date().getFullYear();
      return `${selectedType.prefix}-${year}-001`;
    }
  };

  const handleAddProject = async (e) => {
    e.preventDefault();

    if (!userData || (userData.role !== 'admin' && userData.role !== 'manager')) {
      alert('Proje ekleme yetkiniz yok!');
      return;
    }

    if (!newProject.projectType) {
      alert('Proje tipi seçmelisiniz!');
      return;
    }

    if (!newProject.company) {
      alert('Firma seçmelisiniz!');
      return;
    }

    if (!newProject.projectManager) {
      alert('Proje yöneticisi seçmelisiniz!');
      return;
    }

    try {
      const projectData = {
        title: newProject.title,
        description: newProject.description,
        company: newProject.company,
        projectType: newProject.projectType,
        projectCode: projectCode,
        members: [...new Set([...newProject.members, newProject.projectManager])],
        projectManager: newProject.projectManager,
        createdBy: userData.id,
        createdAt: serverTimestamp(),
        startDate: newProject.startDate ? new Date(newProject.startDate) : null,
        endDate: newProject.endDate ? new Date(newProject.endDate) : null,
        status: 'active'
      };

      const docRef = await addDoc(collection(db, 'projects'), projectData);
      console.log('✅ Proje başarıyla eklendi:', docRef.id, 'Kod:', projectCode);

      setShowAddProjectModal(false);
      setNewProject({
        title: '',
        description: '',
        company: '',
        projectType: '',
        members: [],
        projectManager: '',
        startDate: '',
        endDate: '',
        status: 'active'
      });
      setProjectCode('');
      setUserSearch('');

      await fetchProjects();

    } catch (error) {
      console.error('❌ Proje ekleme hatası:', error);
      alert('Proje eklenirken hata oluştu: ' + error.message);
    }
  };

  const handleOpenProjectSettings = async (project) => {
    if (userData.role !== 'admin' && userData.role !== 'manager' && project.createdBy !== userData.id) {
      alert('Proje ayarlarını değiştirme yetkiniz yok!');
      return;
    }

    setSelectedProject(project);
    setProjectMembers(project.members || []);
    setShowProjectSettingsModal(true);
  };

  const handleUpdateProjectMembers = async () => {
    if (!selectedProject) return;

    try {
      const projectRef = doc(db, 'projects', selectedProject.id);
      await updateDoc(projectRef, {
        members: projectMembers
      });

      await fetchProjects();
      setShowProjectSettingsModal(false);
      alert('Proje üyeleri güncellendi!');
    } catch (error) {
      console.error('Üye güncelleme hatası:', error);
      alert('Üye güncelleme başarısız: ' + error.message);
    }
  };

  const handleAddCompany = async () => {
    if (!newCompany.trim()) {
      alert('Firma adı girmelisiniz!');
      return;
    }

    try {
      const existingCompany = companies.find(company => 
        company.name.toLowerCase() === newCompany.trim().toLowerCase()
      );

      if (existingCompany) {
        setNewProject(prev => ({ ...prev, company: existingCompany.name }));
        setShowCompanyModal(false);
        setNewCompany('');
        alert('✅ Bu firma zaten listede mevcut! Seçili hale getirildi.');
        return;
      }

      const companyData = {
        name: newCompany.trim(),
        createdAt: serverTimestamp(),
        createdBy: userData.id,
        createdByName: userData.name,
        projects: []
      };

      const docRef = await addDoc(collection(db, 'companies'), companyData);
      
      const newCompanyWithId = { id: docRef.id, ...companyData };
      setCompanies(prev => [...prev, newCompanyWithId]);
      
      setNewProject(prev => ({ ...prev, company: newCompany.trim() }));
      
      setShowCompanyModal(false);
      setNewCompany('');
      
      console.log('✅ Firma başarıyla eklendi:', newCompany.trim());
      
    } catch (error) {
      console.error('❌ Firma ekleme hatası:', error);
      alert('Firma eklenirken bir hata oluştu. Lütfen tekrar deneyin.');
    }
  };

  const fetchCompanyDetails = async (companyId) => {
    try {
      const companyDoc = await getDoc(doc(db, 'companies', companyId));
      if (companyDoc.exists()) {
        const companyData = companyDoc.data();

        const projectsQuery = query(
          collection(db, 'projects'),
          where('company', '==', companyData.name)
        );
        const projectsSnapshot = await getDocs(projectsQuery);
        const projectsData = projectsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        return {
          ...companyData,
          id: companyId,
          projects: projectsData
        };
      }
      return null;
    } catch (error) {
      console.error('❌ Firma detayları getirme hatası:', error);
      return null;
    }
  };

  const handleShowCompanyInfo = async (company) => {
    try {
      const companyDetails = await fetchCompanyDetails(company.id);
      if (companyDetails) {
        setSelectedCompanyInfo(companyDetails);
        setShowCompanyInfoModal(true);
      }
    } catch (error) {
      console.error('❌ Firma bilgileri gösterilirken hata:', error);
      alert('Firma bilgileri yüklenirken bir hata oluştu.');
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
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'completed':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'on-hold':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active':
        return 'Aktif';
      case 'completed':
        return 'Tamamlandı';
      case 'on-hold':
        return 'Beklemede';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="large" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Başlık ve Filtreler */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Projelerim</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Tüm projelerinizi buradan yönetebilirsiniz.
            </p>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{projects.length}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Toplam Proje</div>
            </div>

            {(userData?.role === 'admin' || userData?.role === 'manager') && (
              <button
                onClick={() => setShowAddProjectModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2"
              >
                <span>+</span>
                <span>Proje Ekle</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex space-x-2">
          {[
            { key: 'all', label: 'Tüm Projeler', count: projects.length },
            { key: 'active', label: 'Aktif', count: projects.filter(p => p.status === 'active').length },
            { key: 'completed', label: 'Tamamlanan', count: projects.filter(p => p.status === 'completed').length },
          ].map((filterOption) => (
            <button
              key={filterOption.key}
              onClick={() => setFilter(filterOption.key)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === filterOption.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
            >
              {filterOption.label} ({filterOption.count})
            </button>
          ))}
        </div>
      </div>

      {/* Proje Ekleme Modalı */}
      {showAddProjectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Yeni Proje Oluştur
                </h3>
                <button
                  onClick={() => {
                    setShowAddProjectModal(false);
                    setUserSearch('');
                    setIsProjectTypeOpen(false);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddProject} className="space-y-4">
                {/* Açılır Liste Overlay */}
                {isProjectTypeOpen && (
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsProjectTypeOpen(false)}
                  ></div>
                )}

                {/* Proje Tipi ve Adı - AYNI SATIRDA */}
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Proje Tipi */}
                  <div className="sm:flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Proje Tipi *
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsProjectTypeOpen(!isProjectTypeOpen)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-left flex justify-between items-center"
                      >
                        <span className="truncate">
                          {newProject.projectType 
                            ? PROJECT_TYPES[newProject.projectType]?.name 
                            : 'Tip seçin...'
                          }
                        </span>
                        <span className="text-gray-400 flex-shrink-0 ml-2">▼</span>
                      </button>

                      {isProjectTypeOpen && (
                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                          <div className="py-1">
                            {Object.entries(PROJECT_TYPES).map(([key, type]) => (
                              <button
                                key={key}
                                type="button"
                                onClick={() => {
                                  setNewProject({ ...newProject, projectType: key });
                                  setIsProjectTypeOpen(false);
                                }}
                                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                                  newProject.projectType === key
                                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                                    : 'text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="truncate">{type.name}</span>
                                  <span className="text-xs text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded flex-shrink-0 ml-2">
                                    {type.prefix}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Proje Adı */}
                  <div className="sm:flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Proje Adı *
                    </label>
                    <input
                      type="text"
                      required
                      value={newProject.title}
                      onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      placeholder="Proje adı..."
                    />
                  </div>
                </div>

                {/* Seçilen Proje Tipi ve Kodu Gösterimi */}
                {newProject.projectType && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium text-blue-700 dark:text-blue-300">
                          {PROJECT_TYPES[newProject.projectType]?.name}
                        </span>
                        <span className="text-sm text-blue-600 dark:text-blue-400 ml-2">
                          ({PROJECT_TYPES[newProject.projectType]?.prefix})
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-blue-700 dark:text-blue-300">
                          {projectCode || 'Kod oluşturuluyor...'}
                        </div>
                        <div className="text-xs text-blue-600 dark:text-blue-400">Proje Kodu</div>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Açıklama
                  </label>
                  <textarea
                    value={newProject.description}
                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="Proje açıklaması"
                  />
                </div>

                {/* Firma Seçim Kısmı */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Firma *
                  </label>
                  <div className="flex space-x-2">
                    <div className="flex-1 relative">
                      <select
                        required
                        value={newProject.company}
                        onChange={(e) => setNewProject({ ...newProject, company: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      >
                        <option value="">Bir firma seçin...</option>
                        {companies.map(company => (
                          <option key={company.id} value={company.name}>
                            {company.name}
                          </option>
                        ))}
                      </select>
                      
                      {/* Seçili firma için info butonu */}
                      {newProject.company && (
                        <button
                          type="button"
                          onClick={() => {
                            const selectedCompany = companies.find(c => c.name === newProject.company);
                            if (selectedCompany) {
                              handleShowCompanyInfo(selectedCompany);
                            }
                          }}
                          className="absolute right-10 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          title="Firma bilgilerini görüntüle"
                        >
                          ℹ️
                        </button>
                      )}
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => setShowCompanyModal(true)}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center space-x-2 font-medium"
                    >
                      <span className="text-lg">+</span>
                      <span className="hidden sm:inline">Yeni</span>
                    </button>
                  </div>
                  
                  {/* Tüm firmalar için hızlı info butonları */}
                  {companies.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Hızlı erişim:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {companies.slice(0, 5).map(company => (
                          <button
                            key={company.id}
                            type="button"
                            onClick={() => handleShowCompanyInfo(company)}
                            className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                          >
                            <span className="truncate max-w-20">{company.name}</span>
                            <span className="ml-1">ℹ️</span>
                          </button>
                        ))}
                        {companies.length > 5 && (
                          <span className="text-xs text-gray-400 px-2 py-1">
                            +{companies.length - 5} firma daha...
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Proje Yöneticisi */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Proje Yöneticisi *
                  </label>
                  
                  {userData?.role === 'admin' ? (
                    // ADMIN: Tüm manager ve admin'leri seçebilir
                    <select
                      required
                      value={newProject.projectManager}
                      onChange={(e) => setNewProject({ ...newProject, projectManager: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">Proje Yöneticisi Seçin</option>
                      {allUsers
                        .filter(user => user.role === 'admin' || user.role === 'manager')
                        .map(user => (
                          <option key={user.id} value={user.id}>
                            {user.name} ({user.role === 'admin' ? 'Admin' : 'Proje Yöneticisi'})
                          </option>
                        ))
                      }
                    </select>
                  ) : userData?.role === 'manager' ? (
                    // MANAGER: Sadece kendisini seçebilir
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-blue-700 dark:text-blue-300">
                            {userData.name}
                          </p>
                          <p className="text-sm text-blue-600 dark:text-blue-400">
                            Proje Yöneticisi (Siz)
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={true}
                          readOnly
                          className="h-4 w-4 text-blue-600 rounded"
                        />
                      </div>
                      <input
                        type="hidden"
                        value={userData.id}
                        onChange={(e) => setNewProject({ ...newProject, projectManager: userData.id })}
                      />
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                        📝 Proje yöneticisi olarak otomatik atandınız
                      </p>
                    </div>
                  ) : (
                    // USER: Proje oluşturamaz
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                      <p className="text-red-700 dark:text-red-300 text-sm">
                        ⚠️ Proje oluşturma yetkiniz bulunmamaktadır.
                      </p>
                    </div>
                  )}
                </div>

                {/* Üyeler - Yeni Checkbox Sistemi */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Proje Üyeleri
                  </label>

                  {/* Seçilen Üye Sayısı */}
                  <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      {newProject.members.length} üye seçildi
                    </p>
                  </div>

                  {/* Arama Kutusu */}
                  <div className="mb-3">
                    <input
                      type="text"
                      placeholder="Kullanıcı ara..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
                    />
                  </div>

                  {/* Üye Listesi */}
                  <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md p-3">
                    {filteredUsers.map(user => (
                      <div key={user.id} className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded">
                        <div className="flex items-center space-x-3 flex-1">
                          <input
                            type="checkbox"
                            checked={newProject.members.includes(user.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewProject({
                                  ...newProject,
                                  members: [...newProject.members, user.id]
                                });
                              } else {
                                setNewProject({
                                  ...newProject,
                                  members: newProject.members.filter(memberId => memberId !== user.id)
                                });
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 dark:text-white">{user.name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {user.role} {user.email && `- ${user.email}`}
                            </p>
                          </div>
                        </div>

                        {/* Rol Badge */}
                        <span className={`px-2 py-1 text-xs rounded-full ${user.role === 'admin'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                          : user.role === 'manager'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                          {user.role === 'admin' ? 'Admin' : user.role === 'manager' ? 'Proje Yöneticisi' : 'Kullanıcı'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Toplu Seçim Butonları */}
                  <div className="flex space-x-2 mt-3">
                    <button
                      type="button"
                      onClick={() => {
                        const allUserIds = allUsers.map(user => user.id);
                        setNewProject({
                          ...newProject,
                          members: allUserIds
                        });
                      }}
                      className="flex-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
                    >
                      Tümünü Seç
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewProject({
                          ...newProject,
                          members: newProject.projectManager ? [newProject.projectManager] : []
                        });
                      }}
                      className="flex-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                    >
                      Seçimi Temizle
                    </button>
                  </div>

                  {/* Bilgilendirme */}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    • Proje yöneticisi otomatik olarak üye olarak eklenecek
                    <br />
                    • İstediğiniz kullanıcıları işaretleyerek projeye ekleyebilirsiniz
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Başlangıç Tarihi
                    </label>
                    <input
                      type="date"
                      value={newProject.startDate}
                      onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Bitiş Tarihi
                    </label>
                    <input
                      type="date"
                      value={newProject.endDate}
                      onChange={(e) => setNewProject({ ...newProject, endDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddProjectModal(false);
                      setUserSearch('');
                      setIsProjectTypeOpen(false);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Proje Oluştur
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Firma Ekleme Modalı */}
      {showCompanyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-60">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Yeni Firma Ekle
                </h3>
                <button
                  onClick={() => {
                    setShowCompanyModal(false);
                    setNewCompany('');
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Firma Adı *
                  </label>
                  <input
                    type="text"
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
                    placeholder="Firma adını yazın..."
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCompany();
                      }
                    }}
                  />
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    💡 Firma eklendikten sonra listeden seçebilirsiniz.
                  </p>
                </div>

                <div className="flex space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCompanyModal(false);
                      setNewCompany('');
                    }}
                    className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                  >
                    İptal
                  </button>
                  <button
                    type="button"
                    onClick={handleAddCompany}
                    disabled={!newCompany.trim()}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Firma Ekle
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Firma Bilgileri Modalı */}
      {showCompanyInfoModal && selectedCompanyInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 modal-overlay">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto model-container">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  🏢 {selectedCompanyInfo.name}
                </h3>
                <button
                  onClick={() => setShowCompanyInfoModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                {/* Firma İstatistikleri */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {selectedCompanyInfo.projects?.length || 0}
                    </div>
                    <div className="text-sm text-blue-600 dark:text-blue-400 mt-1">Toplam Proje</div>
                  </div>
                  
                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {selectedCompanyInfo.projects?.filter(p => p.status === 'active').length || 0}
                    </div>
                    <div className="text-sm text-green-600 dark:text-green-400 mt-1">Aktif Proje</div>
                  </div>
                  
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                      {selectedCompanyInfo.projects?.filter(p => p.status === 'completed').length || 0}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Tamamlanan</div>
                  </div>
                </div>

                {/* Firma Bilgileri */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Firma Bilgileri</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Oluşturulma Tarihi:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {selectedCompanyInfo.createdAt?.toDate?.().toLocaleDateString('tr-TR') || 'Bilinmiyor'}
                      </span>
                    </div>
                    
                    {selectedCompanyInfo.createdByName && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Ekleyen:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {selectedCompanyInfo.createdByName}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Proje Geçmişi */}
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                    Proje Geçmişi ({selectedCompanyInfo.projects?.length || 0})
                  </h4>
                  
                  {selectedCompanyInfo.projects?.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                      <div className="text-4xl mb-2">📁</div>
                      <p>Henüz proje bulunmuyor</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {selectedCompanyInfo.projects?.map(project => (
                        <div
                          key={project.id}
                          className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <div className="flex-1">
                            <h5 className="font-medium text-gray-900 dark:text-white">
                              {project.title}
                            </h5>
                            <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                              <span>Başlangıç: {project.startDate?.toDate?.().toLocaleDateString('tr-TR') || '-'}</span>
                              <span>Bitiş: {project.endDate?.toDate?.().toLocaleDateString('tr-TR') || '-'}</span>
                            </div>
                          </div>
                          
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            project.status === 'active' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                              : project.status === 'completed'
                              ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
                          }`}>
                            {project.status === 'active' ? 'Aktif' : 
                             project.status === 'completed' ? 'Tamamlandı' : 'Beklemede'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Modal Kapatma Butonu */}
                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => setShowCompanyInfoModal(false)}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                  >
                    Tamam
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Proje Ayarları Modalı */}
      {showProjectSettingsModal && selectedProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Proje Ayarları - {selectedProject.title}
                </h3>
                <button
                  onClick={() => setShowProjectSettingsModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Proje Üyeleri
                  </label>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {allUsers.map(user => (
                      <div key={user.id} className="flex items-center justify-between p-2 border border-gray-200 dark:border-gray-600 rounded">
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={projectMembers.includes(user.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setProjectMembers([...projectMembers, user.id]);
                              } else {
                                if (user.id === selectedProject.projectManager) {
                                  alert('Proje yöneticisini kaldıramazsınız!');
                                  return;
                                }
                                setProjectMembers(projectMembers.filter(memberId => memberId !== user.id));
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            disabled={user.id === selectedProject.projectManager}
                          />
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{user.name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {user.role} {user.id === selectedProject.projectManager && '(Proje Yöneticisi)'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowProjectSettingsModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleUpdateProjectMembers}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Üyeleri Güncelle
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Proje Listesi */}
      {filteredProjects.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-12 text-center">
          <div className="text-6xl mb-4">📁</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {filter === 'all' ? 'Henüz hiç projeniz yok' : 'Bu filtrede proje bulunamadı'}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {filter === 'all'
              ? 'İlk projenizi oluşturarak başlayın veya bir projeye davet edilmeyi bekleyin.'
              : 'Farklı bir filtre seçmeyi deneyin.'
            }
          </p>
          {filter === 'all' && (userData?.role === 'admin' || userData?.role === 'manager') && (
            <button
              onClick={() => setShowAddProjectModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              İlk Projeni Oluştur
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 hover:shadow-md dark:hover:shadow-gray-900/70 transition-shadow border border-gray-200 dark:border-gray-700"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2">
                    {project.title}
                  </h3>
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusClass(project.status)}`}>
                    {getStatusText(project.status)}
                  </span>
                </div>

                {project.description && (
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-3">
                    {project.description}
                  </p>
                )}

                <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex justify-between">
                    <span>Üye Sayısı:</span>
                    <span className="font-medium">{project.members?.length || 1}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Oluşturulma:</span>
                    <span className="font-medium">
                      {project.createdAt?.toDate?.().toLocaleDateString('tr-TR') || 'Bilinmiyor'}
                    </span>
                  </div>

                  {project.createdBy === userData.id && (
                    <div className="flex justify-between">
                      <span>Rolünüz:</span>
                      <span className="font-medium text-blue-600 dark:text-blue-400">Proje Sahibi</span>
                    </div>
                  )}
                </div>

                <div className="flex space-x-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <button
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded text-sm font-medium transition-colors"
                  >
                    Projeyi Aç
                  </button>

                  <button
                    onClick={() => handleOpenProjectSettings(project)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
                  >
                    ⚙️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Projects;