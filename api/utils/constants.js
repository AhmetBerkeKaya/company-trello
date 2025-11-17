// api/utils/constants.js
// React (Projects.js) dosyanızdaki objenin aynısı
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

module.exports = {
  PROJECT_TYPES
};