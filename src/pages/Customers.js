// src/pages/Customers.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios'; // YENİ
import LoadingSpinner from '../components/UI/LoadingSpinner';
import { useNavigate } from 'react-router-dom';

const Customers = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // YENİ: Proje geçmişini (aç/kapa) tutmak için state
  const [expandedCompanyId, setExpandedCompanyId] = useState(null);
  const [companyProjects, setCompanyProjects] = useState({});
  const [loadingProjects, setLoadingProjects] = useState(false);

  const canViewCustomers = userData?.role === 'admin' || userData?.role === 'manager';

  useEffect(() => {
    if (canViewCustomers) {
      fetchCompanies();
    } else {
      setLoading(false); // Yetkisi yoksa yüklemeyi durdur
    }
  }, [canViewCustomers]);

  // YENİ: fetchCompanies (Sadece firmaları çeker, istatistikler API'den gelir)
  const fetchCompanies = async () => {
    try {
      setLoading(true);
      // YENİ: N+1 yerine tek bir API isteği
      const response = await api.get('/companies');
      
      // API zaten 'totalProjects', 'activeProjects' vb. içeriyor
      setCompanies(response.data); 

    } catch (error) {
      console.error('❌ Firmaları getirme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  // SİLİNDİ: fetchCompanyProjects (Artık sayfa yüklenirken çağrılmıyor)

  // YENİ: Proje Geçmişini Getir (Tıklanınca çalışır)
  const toggleCompanyProjects = async (companyId) => {
    // Zaten açıksa kapat
    if (expandedCompanyId === companyId) {
      setExpandedCompanyId(null);
      return;
    }
    
    // Zaten yüklenmişse, tekrar API isteği atma, sadece aç
    if (companyProjects[companyId]) {
      setExpandedCompanyId(companyId);
      return;
    }

    // Yüklenmemişse, API'den proje geçmişini çek
    try {
      setLoadingProjects(true);
      setExpandedCompanyId(companyId); // Spinner'ı göstermek için hemen aç
      
      const response = await api.get(`/companies/${companyId}/projects`);
      
      setCompanyProjects(prev => ({
        ...prev,
        [companyId]: response.data
      }));
    } catch (error) {
      console.error(`❌ Projelerini getirme hatası:`, error);
      setCompanyProjects(prev => ({
        ...prev,
        [companyId]: [] // Hata durumunda boş göster
      }));
    } finally {
      setLoadingProjects(false);
    }
  };

  // Yetki yoksa (Bu kısım aynı kaldı)
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

  // Arama filtresi (Aynı kaldı)
  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // SİLİNDİ: getProjectStats (Artık gerek yok, API'den geliyor)

  // GÖRSEL: getStatusBadge (Aynı kaldı)
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

  // Yükleniyor ekranı (Aynı kaldı)
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
      {/* Başlık ve Arama (Aynı kaldı) */}
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

      {/* Firma Listesi (DÜZELTİLDİ: API'den gelen istatistikleri kullan) */}
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
            // YENİ: İstatistikler (company objesinden) ve projeler (state'ten)
            const stats = company;
            const projects = companyProjects[company.id] || [];
            const isExpanded = expandedCompanyId === company.id;

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

                  {/* Proje Listesi (DÜZELTİLDİ: Aç/Kapa) */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <button
                      onClick={() => toggleCompanyProjects(company.id)}
                      className="w-full flex justify-between items-center mb-3"
                    >
                      <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                        Proje Geçmişi ({stats.totalProjects})
                      </h4>
                      <span className="text-lg text-gray-500 transform transition-transform">
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </button>
                    
                    {/* YENİ: Açılır Kapanır İçerik */}
                    {isExpanded && (
                      loadingProjects && expandedCompanyId === company.id ? (
                        <div className="flex justify-center py-4">
                          <LoadingSpinner size="small" />
                        </div>
                      ) : projects.length === 0 ? (
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
                                  {/* DÜZELTME: PostgreSQL tarih formatı */}
                                  {project.created_at ? new Date(project.created_at).toLocaleDateString('tr-TR') : 'Tarih yok'}
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
                      )
                    )}
                  </div>

                  {/* Firma Bilgileri (DÜZELTİLDİ: PostgreSQL tarih formatı) */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                    <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                      <div className="flex justify-between">
                        <span>Oluşturulma:</span>
                        <span>
                          {company.created_at ? new Date(company.created_at).toLocaleDateString('tr-TR') : 'Bilinmiyor'}
                        </span>
                      </div>
                      {company.created_by_name && (
                        <div className="flex justify-between">
                          <span>Ekleyen:</span>
                          <span>{company.created_by_name}</span>
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