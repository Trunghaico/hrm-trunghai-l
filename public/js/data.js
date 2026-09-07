// ==========================================================================
// DATA STORE & HELPER UTILITIES
// ==========================================================================

const appData = {
  isLoaded: false,
  tables: {},
  companies: [],
  employees: [],
  departments: [],
  positions: [],
  contacts: [],
  identity: [],
  emergency: [],
  education: [],
  salaries: [],
  insurance: [],
  contracts: [],
  accounts: [],
  trash: [],

  company: {},

  // Lookup maps
  companyMap: {},
  deptMap: {},
  posMap: {},
  empMap: {},

  getApiHeaders() {
    return { 'Content-Type': 'application/json' };
  },

  // Fetch all tables from API
  async init() {
    try {
      const res = await fetch('/api/data', { headers: this.getApiHeaders() });
      const json = await res.json();
      if (json.success && json.tables) {
        this.tables = json.tables;
        this.company = json.company || {};
        this.companies = json.tables['00_Companies'] || [];
        this.employees = (json.tables['03_Employees'] || []).sort((a, b) => (a.employee_id || '').localeCompare(b.employee_id || '', undefined, { numeric: true, sensitivity: 'base' }));
        this.departments = json.tables['01_Departments'] || [];
        this.positions = json.tables['02_Positions'] || [];
        this.contacts = json.tables['04_Contacts_Addresses'] || [];
        this.identity = json.tables['05_Identity_Docs'] || [];
        this.emergency = json.tables['06_Emergency_Contacts'] || [];
        this.education = json.tables['07_Education'] || [];
        this.salaries = json.tables['08_Salaries_Banks'] || [];
        this.insurance = json.tables['09_Insurance_Welfare'] || [];
        this.contracts = json.tables['10_Contracts'] || [];
        this.accounts = json.tables['11_System_Accounts'] || [];
        this.trash = json.tables['13_Recycle_Bin'] || [];
        this.masterProfiles = json.tables['00_Master_Profiles'] || [];

        // Tự động đồng bộ / bổ sung hợp đồng cho tất cả nhân sự nếu bảng hợp đồng còn thiếu
        const contractsMap = new Map((this.contracts || []).map(c => [c.employee_id, c]));
        this.contracts = (this.employees || []).map(emp => {
          const existing = contractsMap.get(emp.employee_id);
          const isResigned = emp.employment_status === 'Đã nghỉ việc';
          return {
            contract_id: existing?.contract_id || emp.contract_id || emp.employee_id,
            employee_id: emp.employee_id,
            full_name: emp.full_name,
            contract_type: existing?.contract_type || emp.contract_type || 'Hợp đồng lao động không xác định thời hạn',
            trial_start_date: utils.formatDate(existing?.trial_start_date || emp.trial_start_date || emp.probation_start_date || emp.start_date || '', ''),
            official_date: utils.formatDate(existing?.official_date || emp.official_date || emp.start_date || '', ''),
            start_date: utils.formatDate(existing?.start_date || emp.start_date || '', ''),
            end_date: utils.formatDate(existing?.end_date || emp.end_date || '', ''),
            effective_date: utils.formatDate(existing?.effective_date || emp.effective_date || emp.start_date || '', ''),
            expiry_date: utils.formatDate(existing?.expiry_date || emp.expiry_date || emp.end_date || '', ''),
            contract_status: isResigned ? 'HẾT HẠN' : (existing?.contract_status || (emp.employment_status === 'Đang làm việc' ? 'HIỆU LỰC' : 'HẾT HẠN'))
          };
        });

        // Build lookup maps
        this.buildMaps();

        // Apply Company Branding
        if (window.appCompany) {
          appCompany.applyBranding(this.company);
        }

        this.isLoaded = true;
        return true;
      }
    } catch (err) {
      console.error('Error fetching data from server:', err);
    }
    return false;
  },

  buildMaps() {
    this.companyMap = {};
    (this.companies || []).forEach(c => {
      this.companyMap[c.company_id] = c.company_name;
    });

    this.deptMap = {};
    this.departments.forEach(d => {
      this.deptMap[d.department_id] = d.department_name;
    });

    this.posMap = {};
    this.positions.forEach(p => {
      this.posMap[p.position_id] = p.position_name;
    });

    this.empMap = {};
    this.employees.forEach(e => {
      this.empMap[e.employee_id] = e;
    });

    this.masterMap = {};
    (this.masterProfiles || []).forEach(m => {
      if (m['Mã nhân viên']) {
        this.masterMap[m['Mã nhân viên']] = m;
      }
    });
  }
};

// UI Utilities
const utils = {
  formatCurrency(num) {
    if (!num || isNaN(num)) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  },

  formatNumber(num) {
    if (!num || isNaN(num)) return '0';
    return new Intl.NumberFormat('vi-VN').format(num);
  },

  parseDate(dateVal) {
    if (!dateVal || dateVal === '-' || dateVal === 'null' || dateVal === 'undefined') return null;
    const num = Number(dateVal);
    if (!isNaN(num) && num > 10000 && num < 90000) {
      const d = new Date(Math.round((num - 25569) * 86400 * 1000));
      return isNaN(d.getTime()) ? null : d;
    }
    const str = String(dateVal).trim();
    const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) {
      return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    }
    const ymd = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (ymd) {
      return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    }
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        if (year >= 1900 && year <= 2100) return d;
      }
    } catch (e) {}
    return null;
  },

  formatDate(dateVal, fallback = '-') {
    if (!dateVal || dateVal === '-' || dateVal === 'null' || dateVal === 'undefined') return fallback;
    
    // 1. Xử lý số serial ngày của Excel (ví dụ: 44972 -> 15/02/2023)
    const num = Number(dateVal);
    if (!isNaN(num) && num > 10000 && num < 90000) {
      const d = new Date(Math.round((num - 25569) * 86400 * 1000));
      if (!isNaN(d.getTime())) {
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = d.getUTCFullYear();
        return `${day}/${month}/${year}`;
      }
    }

    const str = String(dateVal).trim();

    // 2. Chuỗi đã có định dạng DD/MM/YYYY hoặc D/M/YYYY
    const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) {
      return `${dmy[1].padStart(2, '0')}/${dmy[2].padStart(2, '0')}/${dmy[3]}`;
    }

    // 3. Chuỗi định dạng ISO YYYY-MM-DD hoặc YYYY/MM/DD
    const ymd = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (ymd) {
      return `${ymd[3].padStart(2, '0')}/${ymd[2].padStart(2, '0')}/${ymd[1]}`;
    }

    // 4. Fallback chuyển đổi qua new Date (chỉ nhận năm hợp lý 1900 - 2100 để tránh bug năm 44972)
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        if (year >= 1900 && year <= 2100) {
          const day = String(d.getDate()).padStart(2, '0');
          const month = String(d.getMonth() + 1).padStart(2, '0');
          return `${day}/${month}/${year}`;
        }
      }
    } catch (e) {}

    return str;
  },

  toInputDate(dateVal) {
    if (!dateVal || dateVal === '-' || dateVal === 'null' || dateVal === 'undefined') return '';
    const num = Number(dateVal);
    if (!isNaN(num) && num > 10000 && num < 90000) {
      const d = new Date(Math.round((num - 25569) * 86400 * 1000));
      if (!isNaN(d.getTime())) {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
    }
    const str = String(dateVal).trim();
    const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) {
      return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    }
    const ymd = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (ymd) {
      return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
    }
    return '';
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-circle-exclamation';

    toast.innerHTML = `
      <i class="fa-solid ${icon}" style="font-size: 16px; color: ${type === 'success' ? '#10B981' : type === 'error' ? '#E52125' : '#1C3381'};"></i>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
};
