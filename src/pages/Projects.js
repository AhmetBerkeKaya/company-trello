import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, orderBy, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import { useNavigate } from 'react-router-dom';

const Projects = () => {
  const { userData } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [debugInfo, setDebugInfo] = useState('');
  const navigate = useNavigate();
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [newProject, setNewProject] = useState({
    title: '',
    description: '',
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

  useEffect(() => {
    fetchProjects();
    fetchAllUsers();
  }, [userData, filter]);

  // Proje yöneticisi değiştiğinde, onu üye listesine otomatik ekle
  useEffect(() => {
    if (newProject.projectManager && !newProject.members.includes(newProject.projectManager)) {
      setNewProject(prev => ({
        ...prev,
        members: [...prev.members, newProject.projectManager]
      }));
    }
  }, [newProject.projectManager]);

  const fetchProjects = async () => {
    if (!userData) {
      setDebugInfo('Kullanıcı verisi yok');
      return;
    }

    try {
      setLoading(true);
      setDebugInfo(`Kullanıcı ID: ${userData.id}, Rol: ${userData.role}`);

      console.log('🔍 Kullanıcı bilgileri:', userData);

      const projectsQuery = query(
        collection(db, 'projects'),
        where('members', 'array-contains', userData.id)
      );

      console.log('📋 Firestore sorgusu hazır:', projectsQuery);

      const projectsSnapshot = await getDocs(projectsQuery);
      console.log('📊 Sorgu sonucu:', projectsSnapshot.docs.length, 'proje bulundu');

      const projectsData = projectsSnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('📄 Proje verisi:', doc.id, data);
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

  const fetchAllProjectsTest = async () => {
    try {
      const allProjectsSnapshot = await getDocs(collection(db, 'projects'));
      const allProjects = allProjectsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log('🔥 TÜM PROJELER:', allProjects);
      setDebugInfo(`Firestore'da ${allProjects.length} proje var`);
    } catch (error) {
      console.error('Tüm projeleri getirme hatası:', error);
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

  const handleAddProject = async (e) => {
    e.preventDefault();

    if (!userData || (userData.role !== 'admin' && userData.role !== 'manager')) {
      alert('Proje ekleme yetkiniz yok!');
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
        members: [...new Set([...newProject.members, newProject.projectManager])], // Tekrar edenleri kaldır
        projectManager: newProject.projectManager,
        createdBy: userData.id,
        createdAt: serverTimestamp(),
        startDate: newProject.startDate ? new Date(newProject.startDate) : null,
        endDate: newProject.endDate ? new Date(newProject.endDate) : null,
        status: 'active'
      };

      const docRef = await addDoc(collection(db, 'projects'), projectData);
      console.log('✅ Proje başarıyla eklendi:', docRef.id);

      setShowAddProjectModal(false);
      setNewProject({
        title: '',
        description: '',
        members: [],
        projectManager: '',
        startDate: '',
        endDate: '',
        status: 'active'
      });
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

  const filteredProjects = projects.filter(project => {
    if (filter === 'all') return true;
    return project.status === filter;
  });

  // Filtrelenmiş kullanıcıları hesapla
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
      {/* Debug Bilgisi */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">Debug Bilgisi</h3>
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">{debugInfo}</p>
          </div>
          <button
            onClick={fetchAllProjectsTest}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
          >
            Tüm Projeleri Gör
          </button>
        </div>
      </div>

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
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === filterOption.key
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
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddProject} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Proje Adı *
                  </label>
                  <input
                    type="text"
                    required
                    value={newProject.title}
                    onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="Proje adını giriniz"
                  />
                </div>

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

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Proje Yöneticisi *
                  </label>
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
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          user.role === 'admin' 
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
                    <br/>
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