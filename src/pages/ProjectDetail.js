// src/pages/ProjectDetail.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios';
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
    const [projectStats, setProjectStats] = useState({
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        todoTasks: 0
    });
    const [loadingStats, setLoadingStats] = useState(false);
    const [canEditProject, setCanEditProject] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showCompleteModal, setShowCompleteModal] = useState(false);

    const canViewSettings = userData?.role === 'admin' || userData?.role === 'manager';

    // Proje detaylarını, üyeleri ve istatistikleri çeker
    useEffect(() => {
        if (projectId && userData) {
            fetchProjectDetail();
        }
    }, [projectId, userData]);

    const fetchProjectDetail = async () => {
        try {
            setLoading(true);
            setError('');

            const [projectRes, membersRes, _] = await Promise.all([
                api.get(`/projects/${projectId}`),
                api.get(`/projects/${projectId}/members`),
                refreshProjectStats() // Stats'ları ayrı fonksiyonla çek
            ]);

            const projectData = projectRes.data;
            const membersData = membersRes.data;
            
            setProject(projectData);
            setProjectMembers(membersData);

        } catch (error) {
            console.error('Proje detay getirme hatası:', error);
            if (error.response && error.response.status === 404) {
                setError('Proje bulunamadı');
            } else if (error.response && error.response.status === 403) {
                setError('Bu projeyi görüntüleme yetkiniz yok');
            } else {
                setError('Proje yüklenirken bir hata oluştu');
            }
        } finally {
            setLoading(false);
        }
    };

    // Sadece istatistikleri yenileyen fonksiyon (Board.js'e yollanacak)
    const refreshProjectStats = async () => {
      if (!projectId) return;
      setLoadingStats(true);
      try {
        const statsRes = await api.get(`/projects/${projectId}/stats`);
        setProjectStats(statsRes.data);
      } catch (error) {
        console.error('Proje istatistikleri yenileme hatası:', error);
      } finally {
        setLoadingStats(false);
      }
    };

    // Proje düzenleme yetkisini ayarlar
    useEffect(() => {
        if (project && userData) {
            const canEdit = userData.role === 'admin' || project.created_by_user_id === userData.user_id;
            setCanEditProject(canEdit);
        }
    }, [project, userData]);

    // YENİ: handleUpdateProjectStatus (DÜZELTİLDİ: setProject eklendi)
    const handleUpdateProjectStatus = async (newStatus) => {
        if (!canEditProject) return;

        if (newStatus === 'completed') {
            setShowCompleteModal(true);
            return;
        }

        try {
            const response = await api.put(`/projects/${projectId}/status`, {
              status: newStatus
            });
            
            // DÜZELTME: API'den dönen güncel proje ile state'i GÜNCELLE
            setProject(response.data); 

            alert(`Proje durumu "${getStatusText(newStatus)}" olarak güncellendi!`);
        } catch (error) {
            console.error('Proje durumu güncelleme hatası:', error);
            alert('Proje durumu güncellenirken hata oluştu: ' + (error.response?.data?.message || error.message));
        }
    };

    // YENİ: handleCompleteProject (API'ye bağlandı)
    const handleCompleteProject = async () => {
        try {
            const response = await api.put(`/projects/${projectId}/status`, {
              status: 'completed'
            });
            
            setProject(response.data); // State'i güncelle
            setShowCompleteModal(false);
            alert('✅ Proje başarıyla tamamlandı olarak işaretlendi!');
        } catch (error) {
            console.error('Proje tamamlama hatası:', error);
            alert('Proje tamamlanırken hata oluştu: ' + (error.response?.data?.message || error.message));
        }
    };

    // YENİ: handleDeleteProject (API'ye bağlandı)
    const handleDeleteProject = async () => {
        try {
            await api.delete(`/projects/${projectId}`);
            setShowDeleteModal(false);
            alert('Proje başarıyla silindi!');
            navigate('/projects'); // Projeler listesine geri dön
        } catch (error) {
            console.error('Proje silme hatası:', error);
            alert('Proje silinirken hata oluştu: ' + (error.response?.data?.message || error.message));
        }
    };
    
    // --- GÖRSEL FONKSİYONLAR (DEĞİŞMEDİ) ---
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
    const isProjectCompleted = project?.status === 'completed';

    // --- RENDER (YÜKLENİYOR / HATA) ---
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
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-8 text-center">
                    <div className="text-6xl mb-4">❌</div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Hata</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
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
        return null; 
    }

    // --- RENDER (ANA SAYFA) ---
    return (
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            {/* Üst Bilgi ve Navigasyon */}
            <div className="mb-6">
                <nav className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
                    <Link to="/projects" className="hover:text-gray-700 dark:hover:text-gray-300">
                        Projeler
                    </Link>
                    <span>›</span>
                    <span className="text-gray-900 dark:text-white font-medium">{project.name}</span>
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
                        <button
                            onClick={() => navigate('/projects')}
                            className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                            ← Geri
                        </button>
                    </div>
                </div>
                {/* Proje Tamamlandı Uyarısı */}
                {isProjectCompleted && (
                    <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                        <div className="flex items-center">
                            <div className="text-yellow-600 dark:text-yellow-400 mr-3">⚠️</div>
                            <div>
                                <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Proje Tamamlandı</h4>
                                <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                                    Bu proje tamamlandı olarak işaretlendi. Yeni görev eklenemez ve mevcut görevler düzenlenemez.
                                    {canEditProject && ' Proje durumunu değiştirmek için ayarlar sekmesini kullanabilirsiniz.'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Tab Navigation */}
            <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
                <nav className="flex space-x-8">
                    {[
                        { id: 'board', label: 'Kanban Board', icon: '📋' },
                        { id: 'overview', label: 'Genel Bakış', icon: '📊' },
                        ...(canViewSettings ? [{ id: 'settings', label: 'Ayarlar', icon: '⚙️' }] : [])
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
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
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Görev Tahtası</h2>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                            Proje: <strong>{project?.name}</strong>
                            {isProjectCompleted && (
                                <span className="ml-2 text-yellow-600 dark:text-yellow-400">(Tamamlandı)</span>
                            )}
                        </div>
                    </div>
                    {/* Kanban Board (refreshProjectStats prop'u eklendi) */}
                    <Board
                        projectId={projectId}
                        userRole={userData?.role}
                        currentUserId={userData?.user_id}
                        onTaskMoveSuccess={refreshProjectStats}
                    />
                </div>
            )}

            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Proje Üyeleri */}
                    <div className="lg:col-span-1">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50">
                            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Proje Üyeleri</h2>
                            </div>
                            <div className="p-6">
                                {projectMembers.length === 0 ? (
                                    <p className="text-gray-500 dark:text-gray-400 text-sm">Henüz üye bulunmuyor</p>
                                ) : (
                                    <div className="space-y-3">
                                        {projectMembers.map(member => (
                                            <div key={member.user_id} className="flex items-center space-x-3">
                                                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                                                    {member.name?.charAt(0) || 'U'}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                        {member.name}
                                                        {member.user_id === project.created_by_user_id && (
                                                            <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(Sahip)</span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
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

                    {/* Proje İstatistikleri */}
                    <div className="lg:col-span-2">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50">
                            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Proje İstatistikleri</h2>
                            </div>
                            <div className="p-6">
                                {loadingStats ? (
                                    <div className="flex justify-center py-8">
                                        <LoadingSpinner size="small" />
                                    </div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                            {/* Kartlar */}
                                            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{projectStats.totalTasks}</div>
                                                <div className="text-sm text-gray-600 dark:text-gray-400">Toplam Görev</div>
                                            </div>
                                            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{projectStats.completedTasks}</div>
                                                <div className="text-sm text-gray-600 dark:text-gray-400">Tamamlanan</div>
                                            </div>
                                            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{projectStats.inProgressTasks}</div>
                                                <div className="text-sm text-gray-600 dark:text-gray-400">Devam Eden</div>
                                            </div>
                                            <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{projectStats.todoTasks}</div>
                                                <div className="text-sm text-gray-600 dark:text-gray-400">Yapılacak</div>
                                            </div>
                                        </div>
                                        {/* İlerleme Çubuğu */}
                                        {projectStats.totalTasks > 0 && (
                                            <div className="mt-6">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">İlerleme Durumu</span>
                                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                                        {Math.round((projectStats.completedTasks / projectStats.totalTasks) * 100)}%
                                                    </span>
                                                </div>
                                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                    <div
                                                        className="bg-green-600 h-2 rounded-full transition-all duration-300"
                                                        style={{ width: `${(projectStats.completedTasks / projectStats.totalTasks) * 100}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Ayarlar Sekmesi (DÜZELTİLDİ: JSX Eklendi) */}
            {activeTab === 'settings' && canViewSettings && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Proje Ayarları</h2>
                    </div>

                    <div className="p-6">
                        {/* Proje Durumu (DÜZELTİLDİ: JSX Eklendi) */}
                        <div className="mb-6">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Proje Durumu</h3>
                            <div className="flex space-x-4">
                                {[
                                    { value: 'active', label: 'Aktif', color: 'green', icon: '🚀' },
                                    { value: 'on-hold', label: 'Beklemede', color: 'yellow', icon: '⏸️' },
                                    { value: 'completed', label: 'Tamamlandı', color: 'gray', icon: '✅' }
                                ].map(status => (
                                    <button
                                        key={status.value}
                                        onClick={() => handleUpdateProjectStatus(status.value)}
                                        disabled={project.status === status.value || !canEditProject}
                                        className={`flex-1 p-4 border-2 rounded-lg text-center transition-colors ${project.status === status.value
                                                ? status.value === 'active'
                                                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                                    : status.value === 'on-hold'
                                                        ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                                                        : 'border-gray-500 bg-gray-50 dark:bg-gray-900/20'
                                                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                                            } ${!canEditProject ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <div className={`text-2xl mb-2 ${status.value === 'active' ? 'text-green-600' :
                                                status.value === 'on-hold' ? 'text-yellow-600' :
                                                    'text-gray-600'
                                            }`}>
                                            {status.icon}
                                        </div>
                                        <div className="font-medium text-gray-900 dark:text-white">{status.label}</div>
                                        {project.status === status.value && (
                                            <div className="text-xs text-gray-500 mt-1">Mevcut Durum</div>
                                        )}
                                    </button>
                                ))}
                            </div>
                            {!canEditProject && (
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                                    * Proje durumunu değiştirmek için proje sahibi veya yönetici olmalısınız
                                </p>
                            )}
                        </div>

                        {/* Tehlikeli İşlemler (DÜZELTİLDİ: JSX Eklendi) */}
                        {(userData.role === 'admin' || project.created_by_user_id === userData.user_id) && (
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                                <h3 className="text-lg font-medium text-red-600 dark:text-red-400 mb-4">Tehlikeli İşlemler</h3>
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-medium text-red-800 dark:text-red-300">Projeyi Sil</h4>
                                            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                                                Bu işlem geri alınamaz. Proje ve tüm görevler silinecek.
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setShowDeleteModal(true)}
                                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                                        >
                                            Projeyi Sil
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* DÜZELTME: EKSİK MODALLAR EKLENDİ */}

            {/* Silme Onay Modal'ı */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Projeyi Sil</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            "{project.name}" projesini silmek istediğinizden emin misiniz?
                            Bu işlem geri alınamaz ve tüm görevler silinecek.
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 font-medium"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleDeleteProject}
                                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                            >
                                Projeyi Sil
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Tamamlama Onay Modal'ı */}
            {showCompleteModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
                        <div className="text-2xl mb-4 text-center">🎉</div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 text-center">Projeyi Tamamla</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-4 text-center">
                            "{project.name}" projesini tamamlandı olarak işaretlemek üzeresiniz.
                        </p>
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                            <h4 className="font-medium text-yellow-800 dark:text-yellow-300 mb-2">⚠️ Önemli Uyarı</h4>
                            <ul className="text-sm text-yellow-700 dark:text-yellow-400 space-y-1">
                                <li>• Yeni görev <strong>eklenemez</strong></li>
                                <li>• Mevcut görevler <strong>düzenlenemez</strong></li>
                                <li>• Görevler <strong>taşınamaz</strong></li>
                                <li>• Proje sadece <strong>okuma modunda</strong> olacak</li>
                            </ul>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center">
                            Bu işlemi onaylıyor musunuz?
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setShowCompleteModal(false)}
                                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 font-medium"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleCompleteProject}
                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                            >
                                Evet, Projeyi Tamamla
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectDetail;