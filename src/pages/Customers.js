// src/pages/Customers.js
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

// --- SABİT ŞEMA TANIMI ---
const DB_SCHEMA = [
  { key: 'name', label: 'Firma Adı', required: true, type: 'Metin', description: 'Şirketin ticari ünvanı (Örn: ABC A.Ş.)' },
  { key: 'tax_no', label: 'Vergi No', required: false, type: 'Sayı (10 Hane)', description: 'Vergi kimlik numarası' },
  { key: 'tax_office', label: 'Vergi Dairesi', required: false, type: 'Metin', description: 'Bağlı olunan vergi dairesi' },
  { key: 'mersis_no', label: 'Mersis No', required: false, type: 'Sayı (16 Hane)', description: 'Mersis numarası' },
  { key: 'phone', label: 'Telefon', required: false, type: 'Metin', description: '05XX... veya 0212... formatında' },
  { key: 'email', label: 'E-Posta', required: false, type: 'E-Posta', description: 'Geçerli bir şirket e-postası' },
  { key: 'address', label: 'Adres', required: false, type: 'Metin', description: 'Firma açık adresi' },
  { key: 'authorized_person', label: 'Yetkili Kişi', required: false, type: 'Metin', description: 'İletişim kurulacak yetkili ad soyad' },
];

// SİLME ONAY MODALI (PREMIUM)
const ConfirmDeleteModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-md flex items-center justify-center z-[300] animate-fade-in p-4">
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-10 w-full max-w-sm shadow-2xl border border-gray-100 dark:border-gray-700 animate-slide-in text-center">
        <div className="text-5xl mb-6">🗑️</div>
        <h3 className="text-xl font-black text-gray-900 dark:text-white mb-3 uppercase tracking-widest">{title}</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-10 font-medium leading-relaxed italic">{message}</p>
        <div className="flex flex-col gap-3">
          <button onClick={onConfirm} className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-red-500/20 active:scale-95 transition-all">Evet, Kalıcı Olarak Sil</button>
          <button onClick={onClose} className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">Vazgeç</button>
        </div>
      </div>
    </div>
  );
};

const Customers = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Proje Geçmişi
  const [expandedCompanyId, setExpandedCompanyId] = useState(null);
  const [companyProjects, setCompanyProjects] = useState({});
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Import State'leri
  const [showImportModal, setShowImportModal] = useState(false);
  const [excelHeaders, setExcelHeaders] = useState([]); 
  const [excelRows, setExcelRows] = useState([]);       
  const [columnMapping, setColumnMapping] = useState({}); 
  const [step, setStep] = useState(1); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [validationErrorList, setValidationErrorList] = useState([]);

  // Yeni/Düzenleme Müşteri State'leri
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false); // Ekleme mi Düzenleme mi?
  const [editingId, setEditingId] = useState(null);
  const [newCustomer, setNewCustomer] = useState({
      name: '', tax_no: '', tax_office: '', mersis_no: '', phone: '', email: '', address: '', authorized_person: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  // Silme State'leri
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // ROL KONTROLÜ
  const isObserver = userData?.role === 'observer';
  const canView = userData?.role === 'admin' || userData?.role === 'manager' || isObserver;
  const canEdit = userData?.role === 'admin' || userData?.role === 'manager'; // Sadece yetkililer düzenleyip silebilir

  useEffect(() => {
    if (canView) fetchCompanies();
    else setLoading(false);
  }, [canView]);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const res = await api.get('/companies');
      setCompanies(res.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const toggleCompanyProjects = async (companyId) => {
    if (expandedCompanyId === companyId) { setExpandedCompanyId(null); return; }
    if (companyProjects[companyId]) { setExpandedCompanyId(companyId); return; }

    try {
      setLoadingProjects(true);
      setExpandedCompanyId(companyId);
      const response = await api.get(`/companies/${companyId}/projects`);
      setCompanyProjects(prev => ({ ...prev, [companyId]: response.data }));
    } catch (error) {
      setCompanyProjects(prev => ({ ...prev, [companyId]: [] }));
    } finally { setLoadingProjects(false); }
  };

  // --- MANUEL EKLEME & DÜZENLEME ---
  const handleAddInputChange = (e) => {
      const { name, value } = e.target;
      setNewCustomer(prev => ({ ...prev, [name]: value }));
  };

  const openAddModal = () => {
    setIsEditing(false);
    setEditingId(null);
    setNewCustomer({ name: '', tax_no: '', tax_office: '', mersis_no: '', phone: '', email: '', address: '', authorized_person: '' });
    setShowAddModal(true);
  };

  const openEditModal = (company) => {
    setIsEditing(true);
    setEditingId(company.company_id || company.id);
    setNewCustomer({
      name: company.name || '',
      tax_no: company.tax_no || '',
      tax_office: company.tax_office || '',
      mersis_no: company.mersis_no || '',
      phone: company.phone || '',
      email: company.email || '',
      address: company.address || '',
      authorized_person: company.authorized_person || ''
    });
    setShowAddModal(true);
  };

  const handleManualSubmit = async (e) => {
      e.preventDefault();
      if (!newCustomer.name.trim()) { alert('Firma adı zorunludur.'); return; }
      
      setIsSaving(true);
      try {
          if (isEditing && editingId) {
             await api.put(`/companies/${editingId}`, newCustomer);
          } else {
             await api.post('/companies', newCustomer);
          }
          setShowAddModal(false);
          fetchCompanies();
      } catch (error) {
          alert(error.response?.data?.message || 'İşlem sırasında hata oluştu.');
      } finally {
          setIsSaving(false);
      }
  };

  // --- SİLME ---
  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await api.delete(`/companies/${deletingId}`);
      setShowDeleteModal(false);
      setDeletingId(null);
      fetchCompanies();
    } catch (error) {
      alert(error.response?.data?.message || 'Silme işlemi başarısız oldu.');
      setShowDeleteModal(false);
    }
  };

  const handleDeleteClick = (id) => {
    setDeletingId(id);
    setShowDeleteModal(true);
  };

  // --- EXCEL IMPORT ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (data.length < 2) { alert('Dosya boş veya başlık yok.'); return; }
      const headers = data[0];
      const rows = data.slice(1).filter(r => r && r.length > 0);

      setExcelHeaders(headers);
      setExcelRows(rows);
      
      const initialMap = {};
      DB_SCHEMA.forEach(field => {
        const match = headers.find(h => h && field.label && h.toString().toLowerCase().trim() === field.label.toLowerCase().trim());
        if (match) initialMap[field.key] = match;
      });
      setColumnMapping(initialMap);
      setStep(2);
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleMappingChange = (dbKey, excelHeader) => setColumnMapping(prev => ({ ...prev, [dbKey]: excelHeader }));

  const proceedToValidation = () => {
    const missingRequired = DB_SCHEMA.filter(field => field.required && !columnMapping[field.key]);
    if (missingRequired.length > 0) { alert(`Zorunlu alan eksik: ${missingRequired.map(f => f.label).join(', ')}`); return; }

    const { validRows, errors } = calculateValidation();
    if (validRows.length === 0 && errors.length > 0) alert("Tüm satırlarda hata var.");
    
    setPreviewData(validRows);
    setValidationErrorList(errors);
    setStep(3);
  };

  const calculateValidation = () => {
    const errors = [];
    const validRows = [];

    excelRows.forEach((row, rowIndex) => {
      const mappedRow = {};
      let rowHasError = false;
      const rowErrors = [];

      DB_SCHEMA.forEach(field => {
        const headerIndex = excelHeaders.indexOf(columnMapping[field.key]);
        let value = headerIndex !== -1 ? row[headerIndex] : null;
        if (typeof value === 'string') value = value.trim();

        if (field.required && (!value || value === '')) { rowHasError = true; rowErrors.push(`${field.label} boş`); }
        if (value && field.type === 'Sayı (10 Hane)' && isNaN(Number(value))) { rowHasError = true; rowErrors.push(`${field.label} sayı olmalı`); } 
        if (value && field.type === 'E-Posta' && !value.toString().includes('@')) { rowHasError = true; rowErrors.push(`Geçersiz Email`); }

        mappedRow[field.key] = value;
      });

      if (rowHasError) errors.push({ rowIndex: rowIndex + 2, errors: rowErrors });
      else if(mappedRow.name) validRows.push(mappedRow);
    });
    return { validRows, errors };
  };

  const handleFinalSubmit = async () => {
    if (previewData.length === 0) return;
    setIsSubmitting(true);
    try {
        const res = await api.post('/companies/bulk', { companies: previewData });
        alert(`İşlem Başarılı!\n✅ Eklenen: ${res.data.successCount}\n⚠️ Hatalı: ${res.data.failCount}`);
        setShowImportModal(false);
        resetImport();
        fetchCompanies();
    } catch (error) { alert("Sunucu hatası"); } finally { setIsSubmitting(false); }
  };

  const resetImport = () => {
    setStep(1); setExcelHeaders([]); setExcelRows([]); setColumnMapping({}); setValidationErrorList([]); setPreviewData([]);
  };
  
  const downloadTemplate = () => {
      const headerRow = {};
      DB_SCHEMA.forEach(f => headerRow[f.label] = f.key === 'name' ? 'Örnek Firma A.Ş.' : '');
      const ws = XLSX.utils.json_to_sheet([headerRow]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sablon");
      XLSX.writeFile(wb, "Musteri_Sablon.xlsx");
  };

  if (!canView) return <div className="min-h-screen flex items-center justify-center text-red-500 font-bold tracking-widest uppercase">Yetkisiz Erişim</div>;
  if (loading) return <div className="min-h-screen flex justify-center items-center"><LoadingSpinner size="large"/></div>;

  const filteredCompanies = companies.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      
      {/* MODERN HEADER SECTION */}
      <div className="max-w-7xl mx-auto mb-10 bg-white dark:bg-gray-800 p-8 sm:p-10 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 animate-fade-in relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 select-none pointer-events-none text-8xl font-black italic uppercase">CLIENTS</div>
        
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 relative z-10">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-4 mb-3">
              <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight leading-tight uppercase">Müşteri Kartları</h1>
              {isObserver && (
                <span className="px-4 py-1.5 bg-purple-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-purple-500/20">
                  Gözlemci Modu
                </span>
              )}
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-lg font-medium leading-relaxed max-w-2xl">
              Sistemdeki tüm müşterilerinizi, iletişim bilgilerini ve proje geçmişlerini buradan yönetin.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto shrink-0">
            <div className="relative w-full sm:w-64">
              <input 
                type="text" 
                placeholder="FİRMA ARA..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-5 pr-10 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl font-black text-xs uppercase tracking-widest outline-none focus:border-blue-500 transition-all dark:text-white"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            </div>
            
            {!isObserver && (
              <>
                <button onClick={() => { setShowImportModal(true); resetImport(); }} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-green-500/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                  <span>📄</span> EXCEL İLE YÜKLE
                </button>
                <button onClick={openAddModal} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                  <span>➕</span> YENİ EKLE
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".xlsx,.csv" />
              </>
            )}
          </div>
        </div>
      </div>

      {/* LİSTELEME ALANI (PREMIUM TABLO) */}
      <div className="max-w-7xl mx-auto bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden animate-fade-in">
          {filteredCompanies.length === 0 ? (
            <div className="p-20 text-center flex flex-col items-center justify-center">
              <div className="text-6xl mb-6 opacity-50">🏢</div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-widest">Kayıt Bulunamadı</h3>
              <p className="text-gray-400 mt-2 font-medium">Arama kriterlerinize uygun veya sistemde kayıtlı müşteri yok.</p>
            </div>
          ) : (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="min-w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                            <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Firma Ünvanı</th>
                            <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Vergi / Mersis</th>
                            <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">İletişim</th>
                            <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">İş Hacmi</th>
                            <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-right">Aksiyon</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                        {filteredCompanies.map(c => (
                            <React.Fragment key={c.company_id}>
                                <tr className="hover:bg-blue-50/50 dark:hover:bg-gray-700/30 transition-colors group">
                                    <td className="px-8 py-6">
                                      <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/40 dark:to-blue-800/40 flex items-center justify-center text-blue-600 dark:text-blue-300 font-black text-lg shadow-inner">
                                          {c.name.charAt(0)}
                                        </div>
                                        <div className="font-black text-sm text-gray-900 dark:text-white uppercase tracking-tight">{c.name}</div>
                                      </div>
                                    </td>
                                    <td className="px-8 py-6">
                                      <div className="text-xs font-bold text-gray-600 dark:text-gray-300">{c.tax_no || '—'}</div>
                                      <div className="text-[10px] font-bold text-gray-400 mt-1">{c.tax_office || '—'}</div>
                                    </td>
                                    <td className="px-8 py-6">
                                      <div className="text-xs font-bold text-gray-600 dark:text-gray-300">{c.phone || '—'}</div>
                                      <div className="text-[10px] font-bold text-gray-400 mt-1">{c.email || '—'}</div>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-black text-xs">
                                        {c.totalProjects || 0}
                                      </span>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                      <div className="flex items-center justify-end gap-2">
                                        {canEdit && (
                                            <>
                                              <button onClick={() => openEditModal(c)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 hover:bg-blue-50 dark:bg-gray-700 dark:hover:bg-blue-900/30 text-gray-400 hover:text-blue-600 transition-colors" title="Firmayı Düzenle">
                                                ✏️
                                              </button>
                                              <button onClick={() => handleDeleteClick(c.company_id || c.id)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 hover:bg-red-50 dark:bg-gray-700 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-600 transition-colors" title="Firmayı Sil">
                                                🗑️
                                              </button>
                                            </>
                                        )}
                                        <button onClick={() => toggleCompanyProjects(c.company_id)} className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 ml-2">
                                            {expandedCompanyId === c.company_id ? 'Gizle' : 'Projeler'}
                                        </button>
                                      </div>
                                    </td>
                                </tr>
                                
                                {/* EXPANDED AREA: PROJE GEÇMİŞİ */}
                                {expandedCompanyId === c.company_id && (
                                    <tr>
                                        <td colSpan="5" className="bg-gray-50/80 dark:bg-gray-900/40 p-8 border-b-4 border-blue-500/20">
                                            {loadingProjects ? (
                                              <div className="flex justify-center py-4"><LoadingSpinner size="small" /></div>
                                            ) : (companyProjects[c.company_id] || []).length === 0 ? (
                                              <div className="text-center py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Bu firmaya ait kayıtlı proje bulunamadı.</div>
                                            ) : (
                                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                  {(companyProjects[c.company_id] || []).map(p => (
                                                      <div key={p.id} onClick={() => navigate(`/projects/${p.id}`)} className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 cursor-pointer transition-all group">
                                                          <h4 className="font-black text-xs text-gray-900 dark:text-white uppercase tracking-wider mb-2 group-hover:text-blue-600 transition-colors">{p.title}</h4>
                                                          <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                                                            <span className="text-gray-400">{new Date(p.created_at).toLocaleDateString('tr-TR')}</span>
                                                            <span className={`px-2 py-1 rounded-md ${p.status === 'active' ? 'bg-green-100 text-green-700' : p.status === 'completed' ? 'bg-gray-200 text-gray-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                              {p.status === 'active' ? 'Aktif' : p.status === 'completed' ? 'Biten' : 'Beklemede'}
                                                            </span>
                                                          </div>
                                                      </div>
                                                  ))}
                                              </div>
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
              </div>
          )}
      </div>

      {/* --- MODALLAR --- */}

      {/* YENİ/DÜZENLE MÜŞTERİ MODALI */}
      {showAddModal && !isObserver && (
          <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-fade-in">
              <div className="bg-white dark:bg-gray-800 rounded-[3rem] shadow-2xl w-full max-w-3xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-slide-in flex flex-col max-h-[90vh]">
                  <div className="px-10 py-8 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex justify-between items-center shrink-0">
                      <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-widest">
                        {isEditing ? 'Firma Kartını Düzenle' : 'Yeni Firma Kartı'}
                      </h2>
                      <button onClick={() => setShowAddModal(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-gray-700 shadow-sm text-gray-400 hover:text-red-500 transition-colors">✕</button>
                  </div>
                  
                  <form onSubmit={handleManualSubmit} className="flex flex-col flex-1 overflow-hidden">
                      <div className="p-10 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {DB_SCHEMA.map(field => (
                                <div key={field.key} className={field.key === 'address' ? 'md:col-span-2' : ''}>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 ml-1">
                                        {field.label} {field.required && <span className="text-red-500">*</span>}
                                    </label>
                                    {field.key === 'address' ? (
                                        <textarea name={field.key} value={newCustomer[field.key]} onChange={handleAddInputChange} rows="3" className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-medium text-sm dark:text-white resize-none" placeholder={`${field.label} giriniz...`} />
                                    ) : (
                                        <input type={field.type.includes('Sayı') ? 'number' : field.type === 'E-Posta' ? 'email' : 'text'} name={field.key} value={newCustomer[field.key]} onChange={handleAddInputChange} required={field.required} className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-medium text-sm dark:text-white" placeholder={`${field.label} giriniz...`} />
                                    )}
                                </div>
                            ))}
                        </div>
                      </div>
                      
                      <div className="px-10 py-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex justify-end gap-4 shrink-0">
                          <button type="button" onClick={() => setShowAddModal(false)} className="px-8 py-4 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-2xl border-2 border-gray-100 dark:border-gray-600 font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all">İptal</button>
                          <button type="submit" disabled={isSaving} className="px-10 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center">
                              {isSaving ? <LoadingSpinner size="small" color="white" /> : (isEditing ? 'GÜNCELLE' : 'SİSTEME KAYDET')}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* SİLME ONAY MODALI */}
      <ConfirmDeleteModal 
        isOpen={showDeleteModal} 
        onClose={() => setShowDeleteModal(false)} 
        onConfirm={confirmDelete} 
        title="Firmayı Sil" 
        message="Bu firma ve eğer veritabanı kısıtlaması yoksa bağlı bilgileri silinecektir. Emin misiniz?" 
      />

      {/* EXCEL IMPORT MODAL */}
      {showImportModal && !isObserver && (
          <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-fade-in">
              <div className="bg-white dark:bg-gray-800 rounded-[3rem] shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col border border-gray-100 dark:border-gray-700 animate-slide-in overflow-hidden">
                  
                  {/* Header */}
                  <div className="px-10 py-8 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex justify-between items-center shrink-0">
                      <div>
                        <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-widest">Toplu Veri Aktarımı</h2>
                        <div className="flex items-center gap-3 mt-3">
                            <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${step >= 1 ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 text-gray-500 dark:bg-gray-700'}`}>1. Yükleme</span>
                            <span className="text-gray-300">━</span>
                            <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${step >= 2 ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 text-gray-500 dark:bg-gray-700'}`}>2. Eşleştirme</span>
                            <span className="text-gray-300">━</span>
                            <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${step >= 3 ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 text-gray-500 dark:bg-gray-700'}`}>3. Onay</span>
                        </div>
                      </div>
                      <button onClick={() => setShowImportModal(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-gray-700 shadow-sm text-gray-400 hover:text-red-500 transition-colors">✕</button>
                  </div>

                  {/* Body */}
                  <div className="flex-1 p-10 overflow-y-auto custom-scrollbar bg-white dark:bg-gray-800">
                      
                      {/* ADIM 1: Yükleme */}
                      {step === 1 && (
                          <div className="space-y-8 animate-fade-in">
                              <div className="bg-blue-50 dark:bg-blue-900/10 p-8 rounded-[2rem] border-2 border-blue-100 dark:border-blue-800/50">
                                  <h3 className="font-black text-sm text-blue-800 dark:text-blue-300 uppercase tracking-widest mb-4 flex items-center gap-3"><span className="text-2xl">📊</span> Şablon Yönergeleri</h3>
                                  <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-6 leading-relaxed">
                                      Excel dosyanızda aşağıdaki verilerin bulunması önerilir. Sütun isimleri birebir aynı olmak zorunda değildir, sonraki adımda akıllı eşleştirme yapabilirsiniz.
                                  </p>
                                  
                                  <div className="overflow-hidden rounded-2xl border-2 border-blue-100 dark:border-blue-800/50 bg-white dark:bg-gray-800">
                                      <table className="min-w-full text-left">
                                          <thead className="bg-blue-50/50 dark:bg-blue-900/30 border-b-2 border-blue-100 dark:border-blue-800/50">
                                              <tr>
                                                  <th className="px-5 py-4 text-[10px] font-black text-blue-600 dark:text-blue-300 uppercase tracking-widest">Alan Adı</th>
                                                  <th className="px-5 py-4 text-[10px] font-black text-blue-600 dark:text-blue-300 uppercase tracking-widest">Durum</th>
                                                  <th className="px-5 py-4 text-[10px] font-black text-blue-600 dark:text-blue-300 uppercase tracking-widest">Veri Tipi</th>
                                              </tr>
                                          </thead>
                                          <tbody className="divide-y divide-blue-50 dark:divide-blue-900/20 text-xs font-bold">
                                              {DB_SCHEMA.map((field) => (
                                                  <tr key={field.key}>
                                                      <td className="px-5 py-3 text-gray-800 dark:text-gray-200">{field.label}</td>
                                                      <td className="px-5 py-3">
                                                          {field.required ? <span className="text-red-500 uppercase tracking-wider text-[9px] bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded-md">Zorunlu</span> : <span className="text-gray-400 uppercase tracking-wider text-[9px]">Opsiyonel</span>}
                                                      </td>
                                                      <td className="px-5 py-3 text-blue-500 font-mono text-[10px]">{field.type}</td>
                                                  </tr>
                                              ))}
                                          </tbody>
                                      </table>
                                  </div>
                              </div>

                              <div className="border-4 border-dashed border-gray-200 dark:border-gray-700 rounded-[2.5rem] p-12 bg-gray-50/50 dark:bg-gray-800/30 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors cursor-pointer text-center group" onClick={() => fileInputRef.current.click()}>
                                  <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">📥</div>
                                  <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-widest mb-2">Tıkla veya Sürükle</h3>
                                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">SADECE .XLSX VEYA .CSV</p>
                                  <button className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg group-hover:bg-blue-700 transition-colors">Dosya Seç</button>
                              </div>
                              <div className="text-center">
                                <button onClick={downloadTemplate} className="text-blue-600 hover:text-blue-800 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 mx-auto underline underline-offset-4">
                                    ÖRNEK ŞABLONU İNDİR
                                </button>
                              </div>
                          </div>
                      )}

                      {/* ADIM 2: Eşleştirme */}
                      {step === 2 && (
                          <div className="animate-fade-in space-y-6">
                              <div className="bg-yellow-50 dark:bg-yellow-900/10 border-2 border-yellow-200 dark:border-yellow-800/50 text-yellow-800 dark:text-yellow-400 p-6 rounded-[1.5rem] font-bold text-sm">
                                  Lütfen sistemin veritabanı alanlarını, yüklediğiniz dosyadaki sütun başlıkları ile eşleştirin.
                              </div>
                              <div className="grid gap-4">
                                  {DB_SCHEMA.map(field => (
                                      <div key={field.key} className="flex items-center justify-between p-5 border-2 border-gray-100 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 shadow-sm hover:border-blue-200 transition-colors">
                                          <div className="w-1/3">
                                              <span className="font-black text-xs text-gray-800 dark:text-gray-200 uppercase tracking-wider">{field.label}</span>
                                              {field.required && <span className="text-red-500 ml-2" title="Zorunlu">*</span>}
                                          </div>
                                          <div className="text-2xl text-gray-300">➡</div>
                                          <div className="w-1/2">
                                              <select 
                                                className={`w-full px-5 py-4 bg-gray-50 dark:bg-gray-900 border-2 rounded-xl font-bold text-sm dark:text-white outline-none focus:border-blue-500 transition-all appearance-none ${!columnMapping[field.key] && field.required ? 'border-red-400 ring-2 ring-red-100 dark:ring-red-900/30' : 'border-gray-100 dark:border-gray-700'}`} 
                                                value={columnMapping[field.key] || ''} 
                                                onChange={(e) => handleMappingChange(field.key, e.target.value)}
                                              >
                                                  <option value="">-- Eşleştirilmedi --</option>
                                                  {excelHeaders.map((h, i) => <option key={i} value={h}>{h}</option>)}
                                              </select>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}

                      {/* ADIM 3: Onay */}
                      {step === 3 && (
                          <div className="animate-fade-in space-y-8">
                              <div className="flex gap-6">
                                  <div className="flex-1 bg-green-50 dark:bg-green-900/10 border-2 border-green-200 dark:border-green-800/50 p-8 rounded-[2rem] text-center">
                                      <div className="text-5xl font-black text-green-600 mb-2">{previewData.length}</div>
                                      <div className="text-[10px] font-black text-green-800 dark:text-green-400 uppercase tracking-widest">Geçerli Kayıt</div>
                                  </div>
                                  <div className="flex-1 bg-red-50 dark:bg-red-900/10 border-2 border-red-200 dark:border-red-800/50 p-8 rounded-[2rem] text-center">
                                      <div className="text-5xl font-black text-red-600 mb-2">{validationErrorList.length}</div>
                                      <div className="text-[10px] font-black text-red-800 dark:text-red-400 uppercase tracking-widest">Hatalı (Atlanacak)</div>
                                  </div>
                              </div>
                              
                              <div>
                                <h4 className="font-black text-xs uppercase tracking-widest mb-4 dark:text-white ml-2">Önizleme (İlk 10 Kayıt)</h4>
                                <div className="overflow-hidden border-2 border-gray-100 dark:border-gray-700 rounded-[2rem] bg-white dark:bg-gray-800">
                                    <div className="overflow-x-auto custom-scrollbar">
                                        <table className="min-w-full text-left">
                                            <thead className="bg-gray-50/50 dark:bg-gray-900/50 border-b-2 border-gray-100 dark:border-gray-700">
                                                <tr>{DB_SCHEMA.map(f => <th key={f.key} className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-wider whitespace-nowrap">{f.label}</th>)}</tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50 text-xs font-bold">
                                                {previewData.slice(0, 10).map((row, i) => (
                                                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                        {DB_SCHEMA.map(f => <td key={f.key} className="px-6 py-4 text-gray-800 dark:text-gray-300 truncate max-w-[150px]">{row[f.key] || '—'}</td>)}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                              </div>
                          </div>
                      )}
                  </div>

                  {/* Footer */}
                  <div className="px-10 py-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex justify-between shrink-0">
                      <button onClick={() => step > 1 ? setStep(step - 1) : setShowImportModal(false)} className="px-8 py-4 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-2xl border-2 border-gray-100 dark:border-gray-600 font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all">
                        {step === 1 ? 'İPTAL' : 'GERİ DÖN'}
                      </button>
                      {step === 2 && (
                        <button onClick={proceedToValidation} className="px-10 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all">
                            KONTROL ET & İLERLE ➡
                        </button>
                      )}
                      {step === 3 && (
                        <button onClick={handleFinalSubmit} disabled={isSubmitting || previewData.length === 0} className="px-10 py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-green-500/20 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center">
                            {isSubmitting ? <LoadingSpinner size="small" color="white" /> : '✅ ONAYLA VE YÜKLE'}
                        </button>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Customers;