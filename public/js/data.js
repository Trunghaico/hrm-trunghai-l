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
  shifts: [],
  schedules: [],
  attendanceLogs: [],
  attendanceRequests: [],
  timesheets: [],

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
      let json = null;
      try {
        const res = await fetch('/api/data', { headers: this.getApiHeaders() });
        if (res.ok) json = await res.json();
      } catch (e) {}

      if (!json || !json.tables) {
        try {
          const fbRes = await fetch('sample_database.json');
          if (fbRes.ok) json = await fbRes.json();
        } catch (e) {}
      }

      if (json && json.tables) {
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
        this.allowances = json.tables['14_Allowances_Deductions'] || [];
        this.contracts = json.tables['10_Contracts'] || [];
        this.accounts = json.tables['11_System_Accounts'] || [];
        this.trash = json.tables['13_Recycle_Bin'] || [];
        this.masterProfiles = json.tables['00_Master_Profiles'] || [];
        this.shifts = json.tables['15_Attendance_Shifts'] || [];
        this.schedules = json.tables['16_Attendance_Schedules'] || [];
        this.attendanceLogs = json.tables['17_Attendance_Logs'] || [];
        this.attendanceRequests = json.tables['18_Attendance_Requests'] || [];
        this.timesheets = json.tables['19_Attendance_Timesheets'] || [];

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

        // Auto-heal department codes and positions across employees and masterProfiles
        this.employees.forEach(e => {
          if (e.department_id) {
            const cleanDept = this.getDepartmentId(e.department_id);
            if (cleanDept) e.department_id = cleanDept;
          }
          if (!e.department_name && e.department_id) {
            e.department_name = this.getDepartmentName(e.department_id);
          }
          if (e.position_id) {
            const cleanPos = this.getPositionId(e.position_id);
            if (cleanPos) e.position_id = cleanPos;
          }
        });

        this.masterProfiles.forEach(m => {
          const rawDept = m['Mã đơn vị công tác'] || m.department_id || m['Đơn vị công tác'] || m.department_name;
          if (rawDept) {
            const cleanDeptId = this.getDepartmentId(rawDept);
            if (cleanDeptId) {
              m['Mã đơn vị công tác'] = cleanDeptId;
              m.department_id = cleanDeptId;
            }
            const cleanDeptName = this.getDepartmentName(m['Đơn vị công tác'] || rawDept);
            if (cleanDeptName && cleanDeptName !== '-') {
              m['Đơn vị công tác'] = cleanDeptName;
              m.department_name = cleanDeptName;
            }
          }
          const rawPos = m['Mã vị trí công việc'] || m.position_id || m['Vị trí công việc'] || m.job_title;
          if (rawPos) {
            const cleanPosId = this.getPositionId(rawPos);
            if (cleanPosId) {
              m['Mã vị trí công việc'] = cleanPosId;
              m.position_id = cleanPosId;
            }
            const cleanPosName = this.getPositionName(m['Vị trí công việc'] || rawPos);
            if (cleanPosName && cleanPosName !== '-') {
              m['Vị trí công việc'] = cleanPosName;
              m.job_title = cleanPosName;
            }
          }
        });

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
    this.deptIdMap = {};

    // Filter out dummy department entries that clone the company
    if (Array.isArray(this.departments)) {
      this.departments = this.departments.filter(d => {
        if (!d) return false;
        if (d.department_id === 'TN' || d.department_id === 'THG' || d.department_id === 'CTY') return false;
        const comp = (this.companies || []).find(c => c.company_id === d.company_id);
        if (comp && d.department_name && d.department_name.trim().toLowerCase() === comp.company_name.trim().toLowerCase()) return false;
        return true;
      });
      // Ensure BGD.TN exists
      if (!this.departments.some(d => d.department_id === 'BGD.TN')) {
        this.departments.push({
          department_id: 'BGD.TN',
          department_name: 'BAN GIÁM ĐỐC TRUNG NAM',
          company_id: 'TN'
        });
      }
    }

    (this.departments || []).forEach(d => {
      if (!d) return;
      if (d.department_id && d.department_name) {
        this.deptMap[d.department_id] = d.department_name;
        this.deptMap[d.department_id.toUpperCase()] = d.department_name;
        this.deptMap[d.department_id.toLowerCase()] = d.department_name;
        this.deptMap[d.department_name] = d.department_name;
        this.deptMap[d.department_name.toLowerCase()] = d.department_name;

        this.deptIdMap[d.department_id] = d.department_id;
        this.deptIdMap[d.department_id.toUpperCase()] = d.department_id;
        this.deptIdMap[d.department_id.toLowerCase()] = d.department_id;
        this.deptIdMap[d.department_name] = d.department_id;
        this.deptIdMap[d.department_name.toLowerCase()] = d.department_id;
      }
    });

    this.posMap = {};
    const extraPosMap = {
      'TPB_HC': 'Trưởng ban Tổ chức Hành chính',
      'TPB_KHKT': 'Trưởng phòng Kế hoạch Kỹ thuật',
      'PB_QLTB': 'Phó ban Quản lý thiết bị',
      'KS_XDCB': 'Kỹ sư Xây dựng cơ bản',
      'THG_TPB_HC': 'Trưởng ban Tổ chức Hành chính',
      'THG_TPB_KHKT': 'Trưởng phòng Kế hoạch Kỹ thuật',
      'THG_PB_QLTB': 'Phó ban Quản lý thiết bị',
      'THG_KS_XDCB': 'Kỹ sư Xây dựng cơ bản'
    };
    Object.assign(this.posMap, extraPosMap);

    (this.positions || []).forEach(p => {
      if (!p) return;
      const pid = p.position_id;
      const pname = p.position_name;
      if (pid && pname) {
        this.posMap[pid] = pname;
        this.posMap[pid.toUpperCase()] = pname;
        this.posMap[pid.toLowerCase()] = pname;
        const stripped = pid.replace(/^THG_/i, '');
        this.posMap[stripped] = pname;
        this.posMap[stripped.toUpperCase()] = pname;
        this.posMap[stripped.toLowerCase()] = pname;
        this.posMap[pname] = pname;
        this.posMap[pname.toLowerCase()] = pname;
      }
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

    this.allowanceMap = {};
    (this.allowances || []).forEach(a => {
      const id = a.employee_id;
      if (id) {
        if (!this.allowanceMap[id]) this.allowanceMap[id] = [];
        this.allowanceMap[id].push(a);
      }
    });
  },

  getDepartmentName(codeOrName) {
    if (!codeOrName) return '-';
    const s = String(codeOrName).trim();
    if (!s || s === '-') return '-';
    
    if (this.deptMap && this.deptMap[s]) return this.deptMap[s];
    if (this.deptMap && this.deptMap[s.toUpperCase()]) return this.deptMap[s.toUpperCase()];

    const found = (this.departments || []).find(d => 
      (d.department_name && d.department_name.toLowerCase() === s.toLowerCase()) ||
      (d.department_id && d.department_id.toLowerCase() === s.toLowerCase())
    );
    if (found && found.department_name) return found.department_name;

    const low = s.toLowerCase();
    if (low.includes('tổng giám đốc') || low === 'bgd' || low === 'btgd' || low === 'btgd.th') return 'BAN TỔNG GIÁM ĐỐC TRUNG HẢI';
    if (low.includes('tổ chức hành chính') || low === 'btchc' || low === 'btchc.th') return 'BAN TỔ CHỨC HÀNH CHÍNH TRUNG HẢI';
    if (low.includes('tài chính kế toán') && (low.includes('trung hải') || low.includes('.th'))) return 'BAN TÀI CHÍNH KẾ TOÁN TRUNG HẢI';
    if (low.includes('kế hoạch tổng hợp') && (low.includes('trung hải') || low.includes('.th'))) return 'BAN KẾ HOẠCH TỔNG HỢP TRUNG HẢI';
    if (low.includes('pháp chế')) return 'BAN PHÁP CHẾ TRUNG HẢI';
    if (low.includes('thiết bị')) return 'BAN QUẢN LÝ THIẾT BỊ TRUNG HẢI';
    if (low.includes('trực tiếp') && (low.includes('trung hải') || low.includes('.th'))) return 'KHỐI TRỰC TIẾP-DỰ ÁN TRUNG HẢI';
    if (low.includes('gián tiếp') && (low.includes('trung hải') || low.includes('.th'))) return 'KHỐI GIÁN TIẾP- DỰ ÁN TRUNG HẢI';
    if (low.includes('văn phòng') && (low.includes('trung hải') || low.includes('.th'))) return 'KHỐI VĂN PHÒNG-DỰ ÁN TRUNG HẢI';
    if (low === 'cty' || low === 'thg' || (low.includes('trung hải') && !low.includes('dự án') && !low.includes('ban') && !low.includes('phòng'))) return 'KHỐI VĂN PHÒNG-DỰ ÁN TRUNG HẢI';

    if (low.includes('phú minh') || low.includes('.pm')) {
      if (low.includes('giám đốc') || low === 'bgd.pm') return 'BAN GIÁM ĐỐC PHÚ MINH';
      if (low.includes('điều hành dự án') || low === 'bdhda.pm') return 'BAN ĐIỀU HÀNH DỰ ÁN PHÚ MINH';
      if (low.includes('hành chính nhân sự') || low === 'phcns.pm') return 'PHÒNG HÀNH CHÍNH NHÂN SỰ PHÚ MINH';
      if (low.includes('kế hoạch') || low === 'pkhth.pm') return 'PHÒNG KẾ HOẠCH TỔNG HỢP PHÚ MINH';
      if (low.includes('kế toán') || low === 'ptckt.pm') return 'PHÒNG TÀI CHÍNH KẾ TOÁN PHÚ MINH';
      if (low.includes('trực tiếp') || low.includes('tructiep')) return 'KHỐI TRỰC TIẾP-DỰ ÁN PHÚ MINH';
      if (low.includes('gián tiếp') || low.includes('giantiep')) return 'KHỐI GIÁN TIẾP_DỰ ÁN PHÚ MINH';
    }

    if (low.includes('thành phát') || low.includes('.tp')) {
      if (low.includes('hành chính nhân sự') || low === 'phcns.tp') return 'PHÒNG HÀNH CHÍNH NHÂN SỰ THÀNH PHÁT';
      if (low.includes('kế hoạch') || low === 'pkhth.tp') return 'PHÒNG KẾ HOẠCH TỔNG HỢP THÀNH PHÁT';
      if (low.includes('kế toán') || low === 'ptckt.tp') return 'PHÒNG TÀI CHÍNH KẾ TOÁN THÀNH PHÁT';
      if (low.includes('trực tiếp') || low.includes('tructiep')) return 'KHỐI TRỰC TIẾP-DỰ ÁN THÀNH PHÁT';
      if (low.includes('gián tiếp') || low.includes('giantiep')) return 'KHỐI GIÁN TIẾP-DỰ ÁN THÀNH PHÁT';
    }

    if (low.includes('trung nam') || low.includes('.tn')) {
      if (low.includes('giám đốc') || low === 'bgd.tn') return 'BAN GIÁM ĐỐC TRUNG NAM';
      if (low.includes('điều hành dự án') || low === 'bđhda.tn') return 'BAN ĐIỀU HÀNH DỰ ÁN TRUNG NAM';
      if (low.includes('hành chính nhân sự') || low === 'phcns.tn') return 'PHÒNG HÀNH CHÍNH NHÂN SỰ TRUNG NAM';
      if (low.includes('thương mại') || low.includes('kinh doanh') || low === 'pkdtm.tn') return 'PHÒNG KINH DOANH THƯƠNG MẠI TRUNG NAM';
      if (low.includes('kế toán') || low === 'ptckt.tn') return 'PHÒNG TÀI CHÍNH KẾ TOÁN TRUNG NAM';
      if (low === 'tn' || low.includes('công ty')) return 'BAN ĐIỀU HÀNH DỰ ÁN TRUNG NAM';
    }

    return s;
  },

  getDepartmentId(nameOrCode) {
    if (!nameOrCode) return '';
    const s = String(nameOrCode).trim();
    if (!s || s === '-') return '';

    // Fast map match
    if (this.deptIdMap && this.deptIdMap[s]) return this.deptIdMap[s];
    if (this.deptIdMap && this.deptIdMap[s.toLowerCase()]) return this.deptIdMap[s.toLowerCase()];

    // Direct match by department_id
    const exactId = (this.departments || []).find(d => d.department_id && d.department_id.toLowerCase() === s.toLowerCase());
    if (exactId) return exactId.department_id;

    // Direct match by department_name
    const exactName = (this.departments || []).find(d => d.department_name && d.department_name.toLowerCase() === s.toLowerCase());
    if (exactName) return exactName.department_id;

    // Standard mappings
    const low = s.toLowerCase();
    if (low.includes('tổng giám đốc') || low === 'bgd' || low === 'btgd' || low === 'btgd.th') return 'BTGD.TH';
    if (low.includes('tổ chức hành chính') || low === 'btchc' || low === 'btchc.th') return 'BTCHC.TH';
    if (low.includes('tài chính kế toán') && (low.includes('trung hải') || low.includes('.th'))) return 'BTCKT.TH';
    if (low.includes('kế hoạch tổng hợp') && (low.includes('trung hải') || low.includes('.th'))) return 'BKHTH.TH';
    if (low.includes('pháp chế')) return 'BPC.TH';
    if (low.includes('thiết bị')) return 'BQLTB.TH';
    if (low.includes('trực tiếp') && (low.includes('trung hải') || low.includes('.th'))) return 'TRUCTIEP_BDHDA.TH';
    if (low.includes('gián tiếp') && (low.includes('trung hải') || low.includes('.th'))) return 'GIANTIEP_BDHDA.TH';
    if (low.includes('văn phòng') && (low.includes('trung hải') || low.includes('.th'))) return 'VP_BDHDA.TH';
    if (low === 'cty' || low === 'thg' || (low.includes('trung hải') && !low.includes('dự án') && !low.includes('ban') && !low.includes('phòng'))) return 'VP_BDHDA.TH';

    if (low.includes('phú minh') || low.includes('.pm')) {
      if (low.includes('giám đốc') || low === 'bgd.pm') return 'BGD.PM';
      if (low.includes('điều hành dự án') || low === 'bdhda.pm') return 'BDHDA.PM';
      if (low.includes('hành chính nhân sự') || low === 'phcns.pm') return 'PHCNS.PM';
      if (low.includes('kế hoạch') || low === 'pkhth.pm') return 'PKHTH.PM';
      if (low.includes('kế toán') || low === 'ptckt.pm') return 'PTCKT.PM';
      if (low.includes('trực tiếp') || low.includes('tructiep')) return 'TRUCTIEP_BDHDA.PM';
      if (low.includes('gián tiếp') || low.includes('giantiep')) return 'GIANTIEP_BDHDA.PM';
    }

    if (low.includes('thành phát') || low.includes('.tp')) {
      if (low.includes('hành chính nhân sự') || low === 'phcns.tp') return 'PHCNS.TP';
      if (low.includes('kế hoạch') || low === 'pkhth.tp') return 'PKHTH.TP';
      if (low.includes('kế toán') || low === 'ptckt.tp') return 'PTCKT.TP';
      if (low.includes('trực tiếp') || low.includes('tructiep')) return 'TRUCTIEP_BDHDA.TP';
      if (low.includes('gián tiếp') || low.includes('giantiep')) return 'GIANTIEP_BDHDA.TP';
    }

    if (low.includes('trung nam') || low.includes('.tn')) {
      if (low.includes('giám đốc') || low === 'bgd.tn') return 'BGD.TN';
      if (low.includes('điều hành dự án') || low === 'bđhda.tn') return 'BĐHDA.TN';
      if (low.includes('hành chính nhân sự') || low === 'phcns.tn') return 'PHCNS.TN';
      if (low.includes('thương mại') || low.includes('kinh doanh') || low === 'pkdtm.tn') return 'PKDTM.TN';
      if (low.includes('kế toán') || low === 'ptckt.tn') return 'PTCKT.TN';
      if (low === 'tn' || low.includes('công ty')) return 'BĐHDA.TN';
    }

    return s;
  },

  getPositionName(codeOrName) {
    if (!codeOrName) return '-';
    const s = String(codeOrName).trim();
    if (!s || s === '-') return '-';
    if (this.posMap && this.posMap[s]) return this.posMap[s];
    if (this.posMap && this.posMap[s.toUpperCase()]) return this.posMap[s.toUpperCase()];
    const clean = s.replace(/^THG_/i, '');
    if (this.posMap && this.posMap[clean]) return this.posMap[clean];
    if (this.posMap && this.posMap[clean.toUpperCase()]) return this.posMap[clean.toUpperCase()];
    const found = (this.positions || []).find(p =>
      (p.position_id && p.position_id.toLowerCase() === s.toLowerCase()) ||
      (p.position_name && p.position_name.toLowerCase() === s.toLowerCase()) ||
      (p.position_id && p.position_id.replace(/^THG_/i, '').toLowerCase() === clean.toLowerCase())
    );
    if (found && found.position_name) return found.position_name;
    return s;
  },

  getPositionId(nameOrCode) {
    if (!nameOrCode) return '';
    const s = String(nameOrCode).trim();
    if (!s || s === '-') return '';
    const clean = s.replace(/^THG_/i, '');
    const found = (this.positions || []).find(p =>
      (p.position_id && p.position_id.toLowerCase() === s.toLowerCase()) ||
      (p.position_name && p.position_name.toLowerCase() === s.toLowerCase()) ||
      (p.position_id && p.position_id.replace(/^THG_/i, '').toLowerCase() === clean.toLowerCase())
    );
    if (found && found.position_id) {
      return found.position_id;
    }
    return s.startsWith('THG_') ? s : ('THG_' + clean);
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
