import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

// --- SABİT ŞEMA TANIMI ---
// Bu şema hem validasyon için hem de kullanıcıya bilgi vermek için kullanılır
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

  // Yeni Müşteri Ekleme State'leri
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
      name: '', tax_no: '', tax_office: '', mersis_no: '', phone: '', email: '', address: '', authorized_person: ''
  });
  const [isAdding, setIsAdding] = useState(false);

  const canView = userData?.role === 'admin' || userData?.role === 'manager';

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

  // --- MANUEL EKLEME ---
  const handleAddInputChange = (e) => {
      const { name, value } = e.target;
      setNewCustomer(prev => ({ ...prev, [name]: value }));
  };

  const handleManualSubmit = async (e) => {
      e.preventDefault();
      if (!newCustomer.name.trim()) { alert('Firma adı zorunludur.'); return; }
      
      setIsAdding(true);
      try {
          await api.post('/companies', newCustomer);
          alert('Müşteri başarıyla eklendi.');
          setShowAddModal(false);
          setNewCustomer({ name: '', tax_no: '', tax_office: '', mersis_no: '', phone: '', email: '', address: '', authorized_person: '' });
          fetchCompanies();
      } catch (error) {
          alert(error.response?.data?.message || 'Ekleme sırasında hata oluştu.');
      } finally {
          setIsAdding(false);
      }
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
        if (value && field.type === 'Sayı (10 Hane)' && isNaN(Number(value))) { rowHasError = true; rowErrors.push(`${field.label} sayı olmalı`); } // Basit sayı kontrolü
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

  if (!canView) return <div className="p-10 text-center text-red-500">Yetkiniz yok.</div>;
  if (loading) return <LoadingSpinner />;

  const filteredCompanies = companies.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="max-w-7xl mx-auto py-6 px-4">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div>
           <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Müşteri Kartları</h1>
           <p className="text-gray-500">Müşterilerinizi yönetin.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
            <input type="text" placeholder="Firma ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="border p-2 rounded flex-1 md:w-64 dark:bg-gray-700 dark:text-white dark:border-gray-600"
            />
            <button onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2 whitespace-nowrap">
                <span>➕</span> Yeni Ekle
            </button>
            <button onClick={() => { setShowImportModal(true); resetImport(); }} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center gap-2 whitespace-nowrap">
                <span>📄</span> Excel'den Yükle
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".xlsx,.csv" />
        </div>
      </div>

      {/* LİSTELEME */}
      <div className="bg-white dark:bg-gray-800 rounded shadow overflow-hidden">
          {filteredCompanies.length === 0 ? <div className="p-12 text-center text-gray-500">Kayıt bulunamadı.</div> : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Firma Adı</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vergi No</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">İletişim</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proje</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">İşlem</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredCompanies.map(c => (
                            <React.Fragment key={c.company_id}>
                                <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{c.name}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{c.tax_no || '-'}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{c.phone || c.email || '-'}</td>
                                    <td className="px-6 py-4 text-sm text-blue-600 font-bold">{c.totalProjects || 0}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <button onClick={() => toggleCompanyProjects(c.company_id)} className="text-blue-600 hover:underline text-xs">
                                            {expandedCompanyId === c.company_id ? 'Gizle' : 'Projeler'}
                                        </button>
                                    </td>
                                </tr>
                                {expandedCompanyId === c.company_id && (
                                    <tr>
                                        <td colSpan="5" className="bg-gray-50 dark:bg-gray-900/50 p-4">
                                            {loadingProjects ? <div className="text-center text-xs">Yükleniyor...</div> : 
                                            (companyProjects[c.company_id] || []).length === 0 ? <div className="text-center text-xs text-gray-400">Proje yok</div> :
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {(companyProjects[c.company_id] || []).map(p => (
                                                    <div key={p.id} onClick={() => navigate(`/projects/${p.id}`)} className="bg-white dark:bg-gray-800 p-2 rounded border cursor-pointer hover:border-blue-500">
                                                        <div className="font-medium text-sm">{p.title}</div>
                                                        <div className="text-xs text-gray-500">{new Date(p.created_at).toLocaleDateString()}</div>
                                                    </div>
                                                ))}
                                            </div>
                                            }
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

      {/* --- MANUEL EKLEME MODAL --- */}
      {showAddModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl animate-in fade-in zoom-in duration-200">
                  <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center">
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">Yeni Müşteri Ekle</h2>
                      <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-red-500 text-2xl">×</button>
                  </div>
                  <form onSubmit={handleManualSubmit} className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {DB_SCHEMA.map(field => (
                              <div key={field.key} className={field.key === 'address' ? 'md:col-span-2' : ''}>
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                      {field.label} {field.required && <span className="text-red-500">*</span>}
                                  </label>
                                  {field.key === 'address' ? (
                                      <textarea name={field.key} value={newCustomer[field.key]} onChange={handleAddInputChange} rows="2" className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                  ) : (
                                      <input type={field.type.includes('Sayı') ? 'number' : field.type === 'E-Posta' ? 'email' : 'text'} name={field.key} value={newCustomer[field.key]} onChange={handleAddInputChange} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" required={field.required} />
                                  )}
                              </div>
                          ))}
                      </div>
                      <div className="mt-6 flex justify-end gap-3">
                          <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">İptal</button>
                          <button type="submit" disabled={isAdding} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50">{isAdding ? <LoadingSpinner size="small" color="white" /> : 'Kaydet'}</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* --- IMPORT MODAL (STEP 1: BİLGİLENDİRME VE YÜKLEME) --- */}
      {showImportModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col">
                  {/* Header */}
                  <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900 rounded-t-xl">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Toplu Müşteri Yükleme</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${step >= 1 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100'}`}>1. Dosya & Bilgi</span>
                            <span className="text-gray-400">›</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${step >= 2 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100'}`}>2. Eşleştirme</span>
                            <span className="text-gray-400">›</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${step >= 3 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100'}`}>3. Onay</span>
                        </div>
                      </div>
                      <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-red-500 text-2xl">×</button>
                  </div>

                  {/* Body */}
                  <div className="flex-1 p-6 overflow-y-auto">
                      {step === 1 && (
                          <div className="space-y-6">
                              {/* 1. BÖLÜM: BİLGİLENDİRME TABLOSU (İSTEĞİN ÜZERİNE EKLENDİ) */}
                              <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-xl border border-blue-100 dark:border-blue-800">
                                  <div className="flex items-center gap-2 mb-3">
                                      <span className="text-2xl">ℹ️</span>
                                      <h3 className="font-bold text-blue-800 dark:text-blue-300">Excel Hazırlama Rehberi</h3>
                                  </div>
                                  <p className="text-sm text-blue-700 dark:text-blue-400 mb-4">
                                      Excel dosyanızda aşağıdaki verilerin bulunması önerilir. Sütun isimleri birebir aynı olmak zorunda değildir, sonraki adımda eşleştirme yapabilirsiniz.
                                  </p>
                                  
                                  <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
                                      <table className="min-w-full text-sm text-left">
                                          <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200">
                                              <tr>
                                                  <th className="px-3 py-2">Alan Adı</th>
                                                  <th className="px-3 py-2">Durum</th>
                                                  <th className="px-3 py-2">Veri Tipi</th>
                                                  <th className="px-3 py-2">Açıklama</th>
                                              </tr>
                                          </thead>
                                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                              {DB_SCHEMA.map((field) => (
                                                  <tr key={field.key} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                      <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-300">{field.label}</td>
                                                      <td className="px-3 py-2">
                                                          {field.required ? 
                                                              <span className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full font-bold">Zorunlu</span> : 
                                                              <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">Opsiyonel</span>
                                                          }
                                                      </td>
                                                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400 font-mono text-xs">{field.type}</td>
                                                      <td className="px-3 py-2 text-gray-500 dark:text-gray-400 italic">{field.description}</td>
                                                  </tr>
                                              ))}
                                          </tbody>
                                      </table>
                                  </div>
                              </div>

                              {/* 2. BÖLÜM: YÜKLEME ALANI */}
                              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 bg-gray-50 dark:bg-gray-800/50 hover:bg-blue-50 transition-colors cursor-pointer text-center" onClick={() => fileInputRef.current.click()}>
                                  <div className="text-5xl mb-3">📊</div>
                                  <h3 className="text-lg font-semibold mb-1 dark:text-white">Excel dosyanızı buraya sürükleyin veya tıklayın</h3>
                                  <p className="text-sm text-gray-500 mb-4">.xlsx veya .csv formatında</p>
                                  <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 shadow-sm">Dosya Seç</button>
                              </div>
                              <div className="text-center">
                                <button onClick={downloadTemplate} className="text-blue-600 hover:underline text-sm font-medium flex items-center justify-center gap-1 mx-auto">
                                    <span>📥</span> Örnek Excel Şablonunu İndir
                                </button>
                              </div>
                          </div>
                      )}

                      {/* STEP 2: EŞLEŞTİRME */}
                      {step === 2 && (
                          <div>
                              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded mb-4 text-sm">
                                  Lütfen sol taraftaki sistem alanlarını, sağ tarafta Excel dosyanızdaki ilgili sütunlarla eşleştirin.
                              </div>
                              <div className="grid gap-3">
                                  {DB_SCHEMA.map(field => (
                                      <div key={field.key} className="flex items-center justify-between p-3 border rounded bg-white dark:bg-gray-700 dark:border-gray-600 shadow-sm">
                                          <div className="w-1/3">
                                              <span className="font-bold text-gray-700 dark:text-gray-200">{field.label}</span>
                                              {field.required && <span className="text-red-500 ml-1" title="Zorunlu">*</span>}
                                          </div>
                                          <div className="text-gray-400">➡</div>
                                          <div className="w-1/2">
                                              <select className={`border p-2 rounded w-full dark:bg-gray-800 dark:text-white dark:border-gray-600 ${!columnMapping[field.key] && field.required ? 'border-red-300 ring-1 ring-red-200' : ''}`} value={columnMapping[field.key] || ''} onChange={(e) => handleMappingChange(field.key, e.target.value)}>
                                                  <option value="">-- Seçiniz --</option>
                                                  {excelHeaders.map((h, i) => <option key={i} value={h}>{h}</option>)}
                                              </select>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}

                      {/* STEP 3: ONAY */}
                      {step === 3 && (
                          <div>
                              <div className="flex gap-4 mb-4">
                                  <div className="flex-1 bg-green-50 border border-green-200 p-3 rounded text-center">
                                      <div className="text-2xl font-bold text-green-600">{previewData.length}</div>
                                      <div className="text-xs text-green-800">Geçerli Kayıt</div>
                                  </div>
                                  <div className="flex-1 bg-red-50 border border-red-200 p-3 rounded text-center">
                                      <div className="text-2xl font-bold text-red-600">{validationErrorList.length}</div>
                                      <div className="text-xs text-red-800">Hatalı Kayıt (Atlanacak)</div>
                                  </div>
                              </div>
                              <h4 className="font-bold mb-2 dark:text-white text-sm">Veri Önizleme:</h4>
                              <div className="overflow-x-auto border rounded dark:border-gray-700 bg-white dark:bg-gray-800">
                                  <table className="min-w-full text-xs divide-y divide-gray-200 dark:divide-gray-700">
                                      <thead className="bg-gray-100 dark:bg-gray-900">
                                          <tr>{DB_SCHEMA.map(f => <th key={f.key} className="px-2 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{f.label}</th>)}</tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                          {previewData.slice(0, 10).map((row, i) => (
                                              <tr key={i}>
                                                  {DB_SCHEMA.map(f => <td key={f.key} className="px-2 py-2 text-gray-800 dark:text-gray-300 truncate max-w-[150px]">{row[f.key] || '-'}</td>)}
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                          </div>
                      )}
                  </div>

                  {/* Footer */}
                  <div className="p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-xl flex justify-between">
                      <button onClick={() => step > 1 ? setStep(step - 1) : setShowImportModal(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium">{step === 1 ? 'İptal' : 'Geri Dön'}</button>
                      {step === 2 && <button onClick={proceedToValidation} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 font-medium">Kontrol Et & İlerle ➡</button>}
                      {step === 3 && <button onClick={handleFinalSubmit} disabled={isSubmitting || previewData.length === 0} className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 font-medium">{isSubmitting ? 'Yükleniyor...' : '✅ Onayla ve Yükle'}</button>}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Customers;