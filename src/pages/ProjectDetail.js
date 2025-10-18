import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import Board from '../components/Kanban/Board';

const ProjectDetail = () => {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const { userData } = useAuth();

    const [project, setProject] = useState(null);
    const [projectMembers, setProjectMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('board');
    useEffect(() => {
        if (projectId) {
            fetchProjectDetail();
        }
    }, [projectId, userData]);

    const fetchProjectDetail = async () => {
        try {
            setLoading(true);
            setError('');

            // Proje detaylarını getir
            const projectDoc = await getDoc(doc(db, 'projects', projectId));

            if (!projectDoc.exists()) {
                setError('Proje bulunamadı');
                return;
            }

            const projectData = {
                id: projectDoc.id,
                ...projectDoc.data()
            };

            // Kullanıcı bu projenin üyesi mi kontrol et
            if (!projectData.members?.includes(userData.id)) {
                setError('Bu projeyi görüntüleme yetkiniz yok');
                return;
            }

            setProject(projectData);

            // Proje üyelerinin detaylarını getir
            await fetchProjectMembers(projectData.members);

        } catch (error) {
            console.error('Proje detay getirme hatası:', error);
            setError('Proje yüklenirken bir hata oluştu');
        } finally {
            setLoading(false);
        }
    };

    const fetchProjectMembers = async (memberIds) => {
        try {
            if (!memberIds || memberIds.length === 0) return;

            const usersQuery = query(
                collection(db, 'users'),
                where('__name__', 'in', memberIds.slice(0, 10)) // Firestore 'in' sorgusu max 10 item
            );

            const usersSnapshot = await getDocs(usersQuery);
            const members = usersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setProjectMembers(members);
        } catch (error) {
            console.error('Üyeleri getirme hatası:', error);
        }
    };

    // Proje durumuna göre stil
    const getStatusClass = (status) => {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-green-800';
            case 'completed':
                return 'bg-gray-100 text-gray-800';
            case 'on-hold':
                return 'bg-yellow-100 text-yellow-800';
            default:
                return 'bg-gray-100 text-gray-800';
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

    if (error) {
        return (
            <div className="max-w-7xl mx-auto py-6 px-4">
                <div className="bg-white rounded-lg shadow p-8 text-center">
                    <div className="text-6xl mb-4">❌</div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Hata</h2>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <Link
                        to="/projects"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                    >
                        Projelere Dön
                    </Link>
                </div>
            </div>
        );
    }

    if (!project) {
        return (
            <div className="max-w-7xl mx-auto py-6 px-4">
                <div className="bg-white rounded-lg shadow p-8 text-center">
                    <div className="text-6xl mb-4">📁</div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Proje Bulunamadı</h2>
                    <Link
                        to="/projects"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                    >
                        Projelere Dön
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            {/* Üst Bilgi ve Navigasyon */}
            <div className="mb-6">
                <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
                    <Link to="/projects" className="hover:text-gray-700">
                        Projeler
                    </Link>
                    <span>›</span>
                    <span className="text-gray-900 font-medium">{project.title}</span>
                </nav>

                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{project.title}</h1>
                        <p className="text-gray-600 mt-2">{project.description}</p>
                    </div>

                    <div className="flex items-center space-x-3">
                        <span className={`px-3 py-1 text-sm rounded-full ${getStatusClass(project.status)}`}>
                            {getStatusText(project.status)}
                        </span>
                        <button
                            onClick={() => navigate('/projects')}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                            ← Geri
                        </button>
                    </div>
                </div>
            </div>

            {/* Proje İstatistikleri */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-2xl font-bold text-blue-600 mb-2">{projectMembers.length}</div>
                    <div className="text-sm text-gray-600">Proje Üyesi</div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-2xl font-bold text-green-600 mb-2">0</div>
                    <div className="text-sm text-gray-600">Tamamlanan Görev</div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-2xl font-bold text-yellow-600 mb-2">0</div>
                    <div className="text-sm text-gray-600">Devam Eden Görev</div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-2xl font-bold text-purple-600 mb-2">0</div>
                    <div className="text-sm text-gray-600">Toplantı</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Proje Üyeleri */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-lg shadow">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h2 className="text-lg font-semibold text-gray-900">Proje Üyeleri</h2>
                        </div>
                        <div className="p-6">
                            {projectMembers.length === 0 ? (
                                <p className="text-gray-500 text-sm">Henüz üye bulunmuyor</p>
                            ) : (
                                <div className="space-y-3">
                                    {projectMembers.map(member => (
                                        <div key={member.id} className="flex items-center space-x-3">
                                            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                                                {member.name?.charAt(0) || 'U'}
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {member.name}
                                                    {member.id === project.createdBy && (
                                                        <span className="ml-2 text-xs text-blue-600">(Sahip)</span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-500 capitalize">
                                                    {member.role} • {member.department}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Proje İçeriği - Gelecek Özellikler */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-lg shadow">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h2 className="text-lg font-semibold text-gray-900">Proje Panosu</h2>
                        </div>
                        <div className="p-6">
                            <div className="text-center py-12">
                                <div className="text-6xl mb-4">🚀</div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                    Kanban Tahtası Yakında Gelecek!
                                </h3>
                                <p className="text-gray-600 mb-4">
                                    Bu proje için görev tahtası, ilerleme takibi ve iş birliği özellikleri yakında eklenecek.
                                </p>
                                <div className="grid grid-cols-3 gap-4 text-sm text-gray-500">
                                    <div>📋 Görev Yönetimi</div>
                                    <div>📊 İlerleme Takibi</div>
                                    <div>💬 Geri Bildirim</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
  {/* YENİ: Tab Navigation */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'board', label: 'Kanban Board', icon: '📋' },
            { id: 'overview', label: 'Genel Bakış', icon: '📊' },
            { id: 'settings', label: 'Ayarlar', icon: '⚙️' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab İçeriği */}
      {activeTab === 'board' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Görev Tahtası</h2>
            <div className="text-sm text-gray-500">
              Proje: <strong>{project?.title}</strong>
            </div>
          </div>
          
          {/* YENİ: Kanban Board */}
          <Board projectId={projectId} />
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Proje Üyeleri - AYNI */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Proje Üyeleri</h2>
              </div>
              <div className="p-6">
                {projectMembers.length === 0 ? (
                  <p className="text-gray-500 text-sm">Henüz üye bulunmuyor</p>
                ) : (
                  <div className="space-y-3">
                    {projectMembers.map(member => (
                      <div key={member.id} className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                          {member.name?.charAt(0) || 'U'}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {member.name}
                            {member.id === project.createdBy && (
                              <span className="ml-2 text-xs text-blue-600">(Sahip)</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 capitalize">
                            {member.role} • {member.department}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Proje İstatistikleri - AYNI */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Proje İstatistikleri</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">0</div>
                    <div className="text-sm text-gray-600">Toplam Görev</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">0</div>
                    <div className="text-sm text-gray-600">Tamamlanan</div>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">0</div>
                    <div className="text-sm text-gray-600">Devam Eden</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">0</div>
                    <div className="text-sm text-gray-600">Yapılacak</div>
                  </div>
                </div>
                
                <div className="text-center py-8 text-gray-500">
                  İstatistikler yakında eklenecek...
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-6xl mb-4">⚙️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Proje Ayarları</h2>
          <p className="text-gray-600">Proje ayarları yakında eklenecek...</p>
        </div>
      )}
    </div>
  );
};

export default ProjectDetail;