import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import { useNavigate } from 'react-router-dom';

const Customers = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [companyProjects, setCompanyProjects] = useState({});

  // Yetki kontrolü - sadece admin ve manager görebilir
  const canViewCustomers = userData?.role === 'admin' || userData?.role === 'manager';

  useEffect(() => {
    if (canViewCustomers) {
      fetchCompanies();
    }
  }, [canViewCustomers]);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
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
      
      // Her firma için projeleri getir
      for (const company of companiesData) {
        await fetchCompanyProjects(company.id, company.name);
      }

    } catch (error) {
      console.error('❌ Firmaları getirme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanyProjects = async (companyId, companyName) => {
    try {
      const projectsQuery = query(
        collection(db, 'projects'),
        where('company', '==', companyName)
      );
      const projectsSnapshot = await getDocs(projectsQuery);
      
      const projectsData = projectsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setCompanyProjects(prev => ({
        ...prev,
        [companyId]: projectsData
      }));

    } catch (error) {
      console.error(`❌ ${companyName} projelerini getirme hatası:`, error);
      // Hata durumunda boş array ile devam et
      setCompanyProjects(prev => ({
        ...prev,
        [companyId]: []
      }));
    }
  };

  // Yetki yoksa erişim engellendi mesajı göster
  if (!canViewCustomers) {
    return (
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-12 text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Erişim Engellendi
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Müşteri kartlarını görüntüleme yetkiniz bulunmamaktadır.
            <br />
            Sadece Proje Yöneticileri ve Adminler bu sayfaya erişebilir.
          </p>
          <button
            onClick={() => navigate('/projects')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Projelere Dön
          </button>
        </div>
      </div>
    );
  }

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getProjectStats = (companyId) => {
    const projects = companyProjects[companyId] || [];
    const activeProjects = projects.filter(p => p.status === 'active').length;
    const completedProjects = projects.filter(p => p.status === 'completed').length;
    const totalProjects = projects.length;

    return { totalProjects, activeProjects, completedProjects };
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'active': { class: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300', text: 'Aktif' },
      'completed': { class: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', text: 'Tamamlandı' },
      'on-hold': { class: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300', text: 'Beklemede' }
    };
    
    const config = statusConfig[status] || statusConfig.completed;
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${config.class}`}>
        {config.text}
      </span>
    );
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
      {/* Başlık ve Arama */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Müşteri Kartları</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Tüm firmaların detaylı bilgileri ve proje geçmişi
              <br />
              <span className="text-sm text-blue-600 dark:text-blue-400">
                📊 Sadece yöneticiler ve proje yöneticileri görebilir
              </span>
            </p>
          </div>

          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{companies.length}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Toplam Firma</div>
          </div>
        </div>

        {/* Arama Kutusu */}
        <div className="max-w-md">
          <input
            type="text"
            placeholder="Firma ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      {/* Firma Listesi */}
      {filteredCompanies.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-12 text-center">
          <div className="text-6xl mb-4">🏢</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {searchTerm ? 'Aranan firma bulunamadı' : 'Henüz hiç firma eklenmemiş'}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {searchTerm 
              ? 'Farklı bir arama terimi deneyin.'
              : 'İlk firmanızı proje oluştururken ekleyebilirsiniz.'
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredCompanies.map((company) => {
            const stats = getProjectStats(company.id);
            const projects = companyProjects[company.id] || [];

            return (
              <div
                key={company.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 hover:shadow-md dark:hover:shadow-gray-900/70 transition-shadow border border-gray-200 dark:border-gray-700"
              >
                <div className="p-6">
                  {/* Firma Başlığı */}
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {company.name}
                    </h3>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {stats.totalProjects}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Proje</div>
                    </div>
                  </div>

                  {/* İstatistikler */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="text-lg font-bold text-green-600 dark:text-green-400">
                        {stats.activeProjects}
                      </div>
                      <div className="text-xs text-green-600 dark:text-green-400">Aktif</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="text-lg font-bold text-gray-600 dark:text-gray-400">
                        {stats.completedProjects}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Tamamlanan</div>
                    </div>
                  </div>

                  {/* Proje Listesi */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-3 text-sm">
                      Proje Geçmişi ({projects.length})
                    </h4>
                    
                    {projects.length === 0 ? (
                      <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">
                        Henüz proje bulunmuyor
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {projects.slice(0, 5).map(project => (
                          <div
                            key={project.id}
                            className="flex justify-between items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
                            onClick={() => navigate(`/projects/${project.id}`)}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {project.title}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {project.createdAt?.toDate?.().toLocaleDateString('tr-TR') || 'Tarih yok'}
                              </p>
                            </div>
                            <div className="ml-2">
                              {getStatusBadge(project.status)}
                            </div>
                          </div>
                        ))}
                        {projects.length > 5 && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2">
                            +{projects.length - 5} proje daha...
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Firma Bilgileri */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                    <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                      <div className="flex justify-between">
                        <span>Oluşturulma:</span>
                        <span>
                          {company.createdAt?.toDate?.().toLocaleDateString('tr-TR') || 'Bilinmiyor'}
                        </span>
                      </div>
                      {company.createdByName && (
                        <div className="flex justify-between">
                          <span>Ekleyen:</span>
                          <span>{company.createdByName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Customers;