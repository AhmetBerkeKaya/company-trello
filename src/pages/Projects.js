import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import { useNavigate } from 'react-router-dom';

const Projects = () => {
  const { userData } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [debugInfo, setDebugInfo] = useState(''); // YENİ: Debug bilgisi
  const navigate = useNavigate();
  
  useEffect(() => {
    fetchProjects();
  }, [userData, filter]);

  const fetchProjects = async () => {
    if (!userData) {
      setDebugInfo('Kullanıcı verisi yok');
      return;
    }

    try {
      setLoading(true);
      setDebugInfo(`Kullanıcı ID: ${userData.id}, Rol: ${userData.role}`);

      console.log('🔍 Kullanıcı bilgileri:', userData);

      // GEÇİCİ: Sadece members filtresi ile sorgula (sıralama yapma)
      const projectsQuery = query(
        collection(db, 'projects'),
        where('members', 'array-contains', userData.id)
        // orderBy kaldırıldı - index gerektirmesin diye
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

      // GEÇİCİ: İstemci tarafında sırala
      projectsData.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB - dateA; // Yeniden eskiye
      });

      setProjects(projectsData);
      setDebugInfo(`${projectsData.length} proje bulundu`);

    } catch (error) {
      console.error('❌ Projeleri getirme hatası:', error);
      setDebugInfo(`Hata: ${error.message}`);

      // GEÇİCİ: Hata durumunda tüm projeleri getir ve filtrele
      try {
        const allProjectsSnapshot = await getDocs(collection(db, 'projects'));
        const allProjects = allProjectsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // İstemci tarafında filtrele
        const userProjects = allProjects.filter(project =>
          project.members?.includes(userData.id)
        );

        // İstemci tarafında sırala
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

  // Firestore'daki tüm projeleri görmek için test fonksiyonu
  const fetchAllProjects = async () => {
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

  // Filtrelenmiş projeleri hesapla
  const filteredProjects = projects.filter(project => {
    if (filter === 'all') return true;
    return project.status === filter;
  });

  // Proje durumuna göre stil class'ı
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

  // Proje durumuna göre Türkçe metin
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
            onClick={fetchAllProjects}
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

          {/* Proje Sayısı */}
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{projects.length}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Toplam Proje</div>
          </div>
        </div>

        {/* Filtre Butonları */}
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
          {filter === 'all' && userData?.role !== 'user' && (
            <button
              onClick={() => window.location.href = '/'}
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
                {/* Proje Başlığı ve Durumu */}
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2">
                    {project.title}
                  </h3>
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusClass(project.status)}`}>
                    {getStatusText(project.status)}
                  </span>
                </div>

                {/* Proje Açıklaması */}
                {project.description && (
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-3">
                    {project.description}
                  </p>
                )}

                {/* Proje Bilgileri */}
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

                {/* Aksiyon Butonları */}
                <div className="flex space-x-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <button
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded text-sm font-medium transition-colors"
                  >
                    Projeyi Aç
                  </button>

                  <button
                    onClick={() => alert('Proje ayarları yakında eklenecek!')}
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