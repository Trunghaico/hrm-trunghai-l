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

        // Tự động đồng bộ / tự chữa lành (auto-heal) danh bạ liên hệ nếu thiếu
        if ((this.contacts || []).length < (this.employees || []).length) {
          const contactMap = new Map((this.contacts || []).map(c => [c.employee_id, c]));
          this.employees.forEach(e => {
            if (e.employee_id && !contactMap.has(e.employee_id)) {
              contactMap.set(e.employee_id, {
                employee_id: e.employee_id,
                mobile_phone: e.mobile_phone || e['ĐT di động'] || '',
                work_email: e.work_email || e['Email cơ quan'] || '',
                permanent_address_full: e.permanent_address || e['Hộ khẩu thường trú'] || '',
                current_address_full: e.current_address || e['Chỗ ở hiện nay'] || ''
              });
            }
          });
          this.contacts = Array.from(contactMap.values());
        }

        // Tự động đồng bộ giấy tờ tùy thân nếu thiếu
        if ((this.identity || []).length < (this.employees || []).length) {
          const idMap = new Map((this.identity || []).map(i => [i.employee_id, i]));
          this.employees.forEach(e => {
            if (e.employee_id && !idMap.has(e.employee_id)) {
              idMap.set(e.employee_id, {
                employee_id: e.employee_id,
                id_number: e.id_number || e.tax_code || e['Số CMND'] || '',
                doc_type: e.doc_type || e['Loại giấy tờ'] || 'CCCD'
              });
            }
          });
          this.identity = Array.from(idMap.values());
        }

        // Tự động đồng bộ hợp đồng nếu thiếu
        const contractsMap = new Map((this.contracts || []).map(c => [c.employee_id, c]));
        this.contracts = (this.employees || []).map(emp => {
          const existing = contractsMap.get(emp.employee_id);
          const isResigned = emp.employment_status === 'Đã nghỉ việc';
          return {
            ...(existing || {}),
            contract_id: existing?.contract_id || emp.contract_id || emp.employee_id,
            employee_id: emp.employee_id,
            full_name: emp.full_name,
            contract_type: existing?.contract_type || emp.contract_type || emp['Loại hợp đồng'] || 'Hợp đồng lao động không xác định thời hạn',
            trial_start_date: existing?.trial_start_date || emp.trial_start_date || emp.probation_start_date || emp.start_date || '',
            official_date: existing?.official_date || emp.official_date || emp.start_date || '',
            start_date: existing?.start_date || emp.start_date || '',
            end_date: existing?.end_date || emp.end_date || '',
            effective_date: existing?.effective_date || emp.effective_date || emp.start_date || '',
            expiry_date: existing?.expiry_date || emp.expiry_date || emp.end_date || '',
            contract_status: isResigned ? 'HẾT HẠN' : (existing?.contract_status || (emp.employment_status === 'Đang làm việc' ? 'HIỆU LỰC' : 'HẾT HẠN'))
          };
        });

        // Tự động chuẩn hóa năm sinh & ngày tháng dạng serial Excel (ví dụ: 33317, 28629, "01/01/33317")
        const fixSerialDate = (val) => {
          if (val === undefined || val === null || val === '' || val === '-') return val;
          if (typeof val === 'number' && val >= 10000 && val <= 65000) {
            return utils.formatDate(val);
          }
          if (typeof val === 'string') {
            const trimmed = val.trim();
            if (/^\d{5}$/.test(trimmed) || /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{5}$/.test(trimmed) || /^\d{5}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}/.test(trimmed)) {
              return utils.formatDate(trimmed);
            }
          }
          return val;
        };

        this.employees.forEach(e => {
          if (e.date_of_birth) e.date_of_birth = fixSerialDate(e.date_of_birth);
          if (e['Ngày sinh']) e['Ngày sinh'] = fixSerialDate(e['Ngày sinh']);
          if (e.start_date) e.start_date = fixSerialDate(e.start_date);
          if (e.trial_start_date) e.trial_start_date = fixSerialDate(e.trial_start_date);
          if (e.official_date) e.official_date = fixSerialDate(e.official_date);
          if (e.effective_date) e.effective_date = fixSerialDate(e.effective_date);
          if (e.end_date) e.end_date = fixSerialDate(e.end_date);
          if (e.resignation_date) e.resignation_date = fixSerialDate(e.resignation_date);
        });

        this.masterProfiles.forEach(m => {
          for (const k of Object.keys(m)) {
            if (k.startsWith('Ngày') || k.includes('ngày') || k.includes('Ngày') || k === 'date_of_birth') {
              m[k] = fixSerialDate(m[k]);
            }
          }
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
      const id = m['Mã nhân viên'] || m.employee_id;
      if (id) {
        this.masterMap[id] = m;
        if (m['Mã nhân viên']) this.masterMap[m['Mã nhân viên']] = m;
        if (m.employee_id) this.masterMap[m.employee_id] = m;
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

  // Helper converting Excel serial number (10000..65000) to UTC Date DD/MM/YYYY
  excelSerialToDate(serial) {
    const num = Number(serial);
    if (isNaN(num) || num < 10000 || num > 65000) return null;
    const ms = Math.round((num - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (isNaN(d.getTime())) return null;
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return { day, month, year, str: `${day}/${month}/${year}`, iso: `${year}-${month}-${day}` };
  },

  formatDate(dateStr) {
    if (dateStr === undefined || dateStr === null || dateStr === '' || dateStr === '-') return '-';

    // 1. Raw number Excel serial date (e.g. 33317, 28629, 35287, 38335, 31048)
    if (typeof dateStr === 'number') {
      const res = this.excelSerialToDate(dateStr);
      if (res) return res.str;
    }

    if (typeof dateStr === 'string') {
      const trimmed = dateStr.trim();
      if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') {
        return '-';
      }
      if (trimmed.toLowerCase() === 'không xác định' || trimmed.toLowerCase() === 'vô thời hạn' || trimmed.toLowerCase() === 'hiện tại') {
        return trimmed;
      }

      // 2. Pure 5-digit string serial (e.g. "33317", "28629")
      if (/^\d{5}$/.test(trimmed)) {
        const res = this.excelSerialToDate(trimmed);
        if (res) return res.str;
      }

      // 3. String with 5-digit year caused by previous new Date("33317") formatting: e.g. "01/01/33317" or "33317-01-01"
      const serialYearMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{5})$/);
      if (serialYearMatch) {
        const res = this.excelSerialToDate(serialYearMatch[3]);
        if (res) return res.str;
      }

      const serialYmdMatch = trimmed.match(/^(\d{5})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
      if (serialYmdMatch) {
        const res = this.excelSerialToDate(serialYmdMatch[1]);
        if (res) return res.str;
      }

      // 4. Standard DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (exactly 4-digit year)
      const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})(?!\d)/);
      if (dmyMatch) {
        const d = dmyMatch[1].padStart(2, '0');
        const m = dmyMatch[2].padStart(2, '0');
        const y = dmyMatch[3];
        return `${d}/${m}/${y}`;
      }

      // 5. Standard YYYY-MM-DD or YYYY/MM/DD (with optional time, exactly 4-digit year)
      const ymdMatch = trimmed.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})(?!\d)/);
      if (ymdMatch) {
        const y = ymdMatch[1];
        const m = ymdMatch[2].padStart(2, '0');
        const d = ymdMatch[3].padStart(2, '0');
        return `${d}/${m}/${y}`;
      }

      // 6. 4-digit pure year (e.g. "1991")
      if (/^\d{4}$/.test(trimmed)) {
        return trimmed;
      }
    }

    // 7. Fallback using Date object
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      const year = d.getFullYear();
      // Guard: if year is 5 digits (e.g. year 33317), treat year itself as Excel serial!
      if (year > 2100 && year >= 10000 && year <= 65000) {
        const res = this.excelSerialToDate(year);
        if (res) return res.str;
      }
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      return `${day}/${month}/${year}`;
    } catch (e) {
      return String(dateStr);
    }
  },

  formatDateTime(dateStr) {
    if (dateStr === undefined || dateStr === null || dateStr === '' || dateStr === '-') return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      const secs = String(d.getSeconds()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${mins}:${secs}`;
    } catch (e) {
      return String(dateStr);
    }
  },

  parseToIsoDate(dateStr) {
    if (!dateStr) return '';

    // 1. Raw number Excel serial date
    if (typeof dateStr === 'number') {
      const res = this.excelSerialToDate(dateStr);
      if (res) return res.iso;
    }

    if (typeof dateStr === 'string') {
      const trimmed = dateStr.trim();

      // 2. Pure 5-digit string serial
      if (/^\d{5}$/.test(trimmed)) {
        const res = this.excelSerialToDate(trimmed);
        if (res) return res.iso;
      }

      // 3. String with 5-digit year (e.g. "01/01/33317" or "33317-01-01")
      const serialYearMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{5})$/);
      if (serialYearMatch) {
        const res = this.excelSerialToDate(serialYearMatch[3]);
        if (res) return res.iso;
      }

      const serialYmdMatch = trimmed.match(/^(\d{5})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
      if (serialYmdMatch) {
        const res = this.excelSerialToDate(serialYmdMatch[1]);
        if (res) return res.iso;
      }

      // 4. DD/MM/YYYY or DD-MM-YYYY (4-digit year)
      const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})(?!\d)/);
      if (dmyMatch) {
        return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
      }

      // 5. YYYY-MM-DD or YYYY/MM/DD (4-digit year)
      const ymdMatch = trimmed.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})(?!\d)/);
      if (ymdMatch) {
        return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
      }
    }
    return String(dateStr);
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
