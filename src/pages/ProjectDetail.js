import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
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

    // YENİ: Kullanıcı rolüne göre ayarlar sekmesini kontrol et
    const canViewSettings = userData?.role === 'admin' || userData?.role === 'manager';

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

            // Proje istatistiklerini getir
            await fetchProjectStats();

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

            // Firestore kuralları izin vermiyorsa, hata yakala ve devam et
            try {
                const usersQuery = query(
                    collection(db, 'users'),
                    where('__name__', 'in', memberIds.slice(0, 10))
                );

                const usersSnapshot = await getDocs(usersQuery);
                const members = usersSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                setProjectMembers(members);
            } catch (firestoreError) {
                console.warn('Firestore üye getirme hatası, sadece ID\'ler gösterilecek:', firestoreError);
                // Hata durumunda sadece ID'leri göster
                const membersWithIdsOnly = memberIds.map(id => ({
                    id: id,
                    name: 'Kullanıcı Yüklenemedi',
                    role: 'unknown'
                }));
                setProjectMembers(membersWithIdsOnly);
            }
        } catch (error) {
            console.error('Üyeleri getirme hatası:', error);
        }
    };
    // Proje istatistiklerini getir
    const fetchProjectStats = async () => {
        if (!projectId) return;

        try {
            setLoadingStats(true);

            const stats = {
                totalTasks: 0,
                completedTasks: 0,
                inProgressTasks: 0,
                todoTasks: 0
            };

            // Projeye ait görevleri getir
            const tasksQuery = query(
                collection(db, 'tasks'),
                where('projectId', '==', projectId)
            );

            const tasksSnapshot = await getDocs(tasksQuery);
            const tasks = tasksSnapshot.docs.map(doc => doc.data());

            stats.totalTasks = tasks.length;
            stats.completedTasks = tasks.filter(task => task.status === 'done').length;
            stats.inProgressTasks = tasks.filter(task => task.status === 'inProgress').length;
            stats.todoTasks = tasks.filter(task => task.status === 'todo').length;

            setProjectStats(stats);
        } catch (error) {
            console.error('Proje istatistikleri getirme hatası:', error);
        } finally {
            setLoadingStats(false);
        }
    };

    // Proje düzenleme yetkisi kontrolü
    useEffect(() => {
        if (project && userData) {
            const canEdit = userData.role === 'admin' || project.createdBy === userData.id;
            setCanEditProject(canEdit);
        }
    }, [project, userData]);

    // Proje durumunu güncelle
    const handleUpdateProjectStatus = async (newStatus) => {
        if (!canEditProject) return;

        // Tamamlandı durumuna geçişte onay iste
        if (newStatus === 'completed') {
            setShowCompleteModal(true);
            return;
        }

        try {
            await updateDoc(doc(db, 'projects', projectId), {
                status: newStatus,
                updatedAt: new Date()
            });

            // Local state'i güncelle
            setProject(prev => ({ ...prev, status: newStatus }));

            alert(`Proje durumu "${getStatusText(newStatus)}" olarak güncellendi!`);
        } catch (error) {
            console.error('Proje durumu güncelleme hatası:', error);
            alert('Proje durumu güncellenirken hata oluştu: ' + error.message);
        }
    };

    // Projeyi tamamlama onayı
    const handleCompleteProject = async () => {
        try {
            await updateDoc(doc(db, 'projects', projectId), {
                status: 'completed',
                completedAt: new Date(),
                updatedAt: new Date()
            });

            // Local state'i güncelle
            setProject(prev => ({ ...prev, status: 'completed' }));

            setShowCompleteModal(false);
            alert('✅ Proje başarıyla tamamlandı olarak işaretlendi!');
        } catch (error) {
            console.error('Proje tamamlama hatası:', error);
            alert('Proje tamamlanırken hata oluştu: ' + error.message);
        }
    };

    // Proje silme fonksiyonu
    const handleDeleteProject = async () => {
        try {
            // Önce projeye ait tüm görevleri sil
            const tasksQuery = query(
                collection(db, 'tasks'),
                where('projectId', '==', projectId)
            );
            const tasksSnapshot = await getDocs(tasksQuery);

            const deletePromises = tasksSnapshot.docs.map(doc =>
                deleteDoc(doc(db, 'tasks', doc.id))
            );

            await Promise.all(deletePromises);

            // Projeyi sil
            await deleteDoc(doc(db, 'projects', projectId));

            setShowDeleteModal(false);
            alert('Proje başarıyla silindi!');
            navigate('/projects');
        } catch (error) {
            console.error('Proje silme hatası:', error);
            alert('Proje silinirken hata oluştu: ' + error.message);
        }
    };

    // Proje durumuna göre stil
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

    // Proje tamamlandı mı kontrolü
    const isProjectCompleted = project?.status === 'completed';

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
        return (
            <div className="max-w-7xl mx-auto py-6 px-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-8 text-center">
                    <div className="text-6xl mb-4">📁</div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Proje Bulunamadı</h2>
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
                <nav className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
                    <Link to="/projects" className="hover:text-gray-700 dark:hover:text-gray-300">
                        Projeler
                    </Link>
                    <span>›</span>
                    <span className="text-gray-900 dark:text-white font-medium">{project.title}</span>
                </nav>

                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{project.title}</h1>
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

            {/* Tab Navigation - GÜNCELLENDİ: Kullanıcılar için Ayarlar sekmesini gizle */}
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
                            Proje: <strong>{project?.title}</strong>
                            {isProjectCompleted && (
                                <span className="ml-2 text-yellow-600 dark:text-yellow-400">(Tamamlandı)</span>
                            )}
                        </div>
                    </div>

                    {/* Kanban Board - GÜNCELLENDİ: Kullanıcı yetkisi prop'u eklendi */}
                    <Board
                        projectId={projectId}
                        userRole={userData?.role}
                        currentUserId={userData?.id}
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
                                            <div key={member.id} className="flex items-center space-x-3">
                                                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                                                    {member.name?.charAt(0) || 'U'}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                        {member.name}
                                                        {member.id === project.createdBy && (
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
                                            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                                    {projectStats.totalTasks}
                                                </div>
                                                <div className="text-sm text-gray-600 dark:text-gray-400">Toplam Görev</div>
                                            </div>
                                            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                                    {projectStats.completedTasks}
                                                </div>
                                                <div className="text-sm text-gray-600 dark:text-gray-400">Tamamlanan</div>
                                            </div>
                                            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                                                    {projectStats.inProgressTasks}
                                                </div>
                                                <div className="text-sm text-gray-600 dark:text-gray-400">Devam Eden</div>
                                            </div>
                                            <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                                    {projectStats.todoTasks}
                                                </div>
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

            {activeTab === 'settings' && canViewSettings && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Proje Ayarları</h2>
                    </div>

                    <div className="p-6">
                        {/* Proje Durumu */}
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

                        {/* Tehlikeli İşlemler */}
                        {(userData.role === 'admin' || project.createdBy === userData.id) && (
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

            {/* Silme Onay Modal'ı */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Projeyi Sil</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            "{project.title}" projesini silmek istediğinizden emin misiniz?
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
                            "{project.title}" projesini tamamlandı olarak işaretlemek üzeresiniz.
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