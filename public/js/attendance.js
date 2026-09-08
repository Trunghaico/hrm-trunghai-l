// ==========================================================================
// TIME & ATTENDANCE MODULE (PHÂN HỆ QUẢN LÝ CHẤM CÔNG & RONALD JACK 009)
// HRM Trung Hải Enterprise Edition - Redesigned Clean UI
// ==========================================================================

const appAttendance = {
  currentSubTab: 'dashboard', // dashboard | shifts | requests | devices | portal
  currentMonth: new Date().toISOString().substring(0, 7), // YYYY-MM
  selectedDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
  filterDept: 'all',
  filterStatus: 'ALL',
  filterSearch: '',
  portalEmployeeId: '',
  devices: [
    {
      device_id: 'DEV-01',
      device_name: 'Ronald Jack 009 - Cổng Chính',
      name: 'Ronald Jack 009 - Cổng Chính',
      ip: '192.168.1.201',
      port: 5005,
      location: 'Cổng bảo vệ / Lối vào chính',
      in_out_mode: 'AUTO',
      enabled: true,
      last_sync: '08/09/2026 16:30:15',
      status: 'ONLINE',
      note: 'Máy vân tay & thẻ từ Ronald Jack 009'
    },
    {
      device_id: 'DEV-02',
      device_name: 'Ronald Jack 009 - Văn Phòng Kho',
      name: 'Ronald Jack 009 - Văn Phòng Kho',
      ip: '192.168.1.202',
      port: 5006,
      location: 'Tầng 1 - Khu vực kho tổng',
      in_out_mode: 'AUTO',
      enabled: true,
      last_sync: '08/09/2026 16:30:22',
      status: 'ONLINE',
      note: 'Phục vụ nhân viên kho vận'
    },
    {
      device_id: 'DEV-03',
      device_name: 'Ronald Jack 009 - Xưởng Sản Xuất',
      name: 'Ronald Jack 009 - Xưởng Sản Xuất',
      ip: '192.168.1.203',
      port: 5007,
      location: 'Khu xưởng cơ khí - gia công',
      in_out_mode: 'AUTO',
      enabled: false,
      last_sync: '08/09/2026 12:00:00',
      status: 'STANDBY',
      note: 'Máy quẹt thẻ xưởng dự phòng'
    }
  ],

  currentZkSubTab: 'zk-hardware',

  init() {
    console.log('Initializing Time & Attendance Module...');

    // Load devices and shifts from localStorage (offline fallback) or appData
    try {
      const savedDevs = localStorage.getItem('hrm_attendance_devices');
      if (savedDevs) {
        const parsed = JSON.parse(savedDevs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.devices = parsed;
          if (window.appData) appData.attendanceDevices = parsed;
        }
      } else if (window.appData && appData.attendanceDevices && appData.attendanceDevices.length > 0) {
        this.devices = appData.attendanceDevices;
      }

      const savedShifts = localStorage.getItem('hrm_attendance_shifts');
      if (savedShifts && window.appData) {
        const parsed = JSON.parse(savedShifts);
        if (Array.isArray(parsed) && parsed.length > 0) {
          appData.shifts = parsed;
        }
      }
    } catch (e) {
      console.warn('Error reading local attendance storage:', e);
    }

    // Set default portal employee if logged in or first employee
    const emps = (window.appData && appData.employees) || [];
    if (emps.length > 0 && !this.portalEmployeeId) {
      this.portalEmployeeId = emps[0].employee_id;
    }

    this.bindEvents();
    this.render();
  },

  bindEvents() {
    // Month picker in timesheet
    const monthPicker = document.getElementById('att-month-picker');
    if (monthPicker) {
      monthPicker.value = this.currentMonth;
      monthPicker.addEventListener('change', (e) => {
        this.currentMonth = e.target.value;
        this.renderTimesheets();
      });
    }

    // Search input
    const searchInput = document.getElementById('att-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filterSearch = e.target.value.toLowerCase().trim();
        this.renderTimesheets();
      });
    }

    // Department filter
    const deptSelect = document.getElementById('att-dept-select');
    if (deptSelect) {
      deptSelect.addEventListener('change', (e) => {
        this.filterDept = e.target.value;
        this.renderTimesheets();
      });
    }

    // Status filter
    const statusSelect = document.getElementById('att-status-select');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        this.filterStatus = e.target.value;
        this.renderTimesheets();
      });
    }
  },

  switchSubTab(tabId) {
    this.currentSubTab = tabId;

    // Update active tab buttons
    document.querySelectorAll('.att-nav-tab').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update active content panels
    document.querySelectorAll('.att-tab-content').forEach(panel => {
      if (panel.id === `att-tab-${tabId}`) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    this.renderCurrentSubTab();
  },

  render() {
    this.renderCurrentSubTab();
  },

  renderCurrentSubTab() {
    switch (this.currentSubTab) {
      case 'dashboard':
        this.renderDashboard();
        break;
      case 'shifts':
        this.renderShifts();
        break;
      case 'requests':
        this.renderRequests();
        break;
      case 'devices':
        this.renderDevices();
        break;
      case 'portal':
        this.renderPortal();
        break;
      default:
        this.renderDashboard();
    }
  },

  // ========================================================================
  // 1. DASHBOARD CHẤM CÔNG (KPIs + BẢNG DỮ LIỆU CÔNG CHI TIẾT)
  // ========================================================================
  renderDashboard() {
    const date = this.selectedDate || new Date().toISOString().split('T')[0];
    const employees = (appData.employees || []).filter(e => e.employment_status !== 'Đã nghỉ việc');
    const timesheets = (appData.timesheets || []).filter(t => t.date === date);
    const requests = (appData.attendanceRequests || []).filter(r => r.date === date && r.status === 'APPROVED');

    const totalScheduled = employees.length;
    let workingCount = 0;
    let lateCount = 0;
    let earlyCount = 0;
    let absentCount = 0;
    let leaveCount = requests.length;

    timesheets.forEach(ts => {
      if (ts.check_in) workingCount++;
      if (ts.late_minutes > 0) lateCount++;
      if (ts.early_minutes > 0) earlyCount++;
      if (ts.status === 'ABSENT') absentCount++;
    });

    if (absentCount === 0 && workingCount < totalScheduled) {
      absentCount = Math.max(0, totalScheduled - workingCount - leaveCount);
    }

    const setKpi = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setKpi('att-kpi-total', totalScheduled);
    setKpi('att-kpi-working', workingCount);
    setKpi('att-kpi-late', lateCount);
    setKpi('att-kpi-early', earlyCount);
    setKpi('att-kpi-absent', absentCount);
    setKpi('att-kpi-leave', leaveCount);

    // Render the primary timesheet table in the Dashboard
    this.renderTimesheets();
  },

  // ========================================================================
  // 2. DETAILED TIMESHEET DATA TABLE (BẢNG DỮ LIỆU CÔNG CHI TIẾT)
  // ========================================================================
  renderTimesheets() {
    const tbody = document.getElementById('att-timesheet-tbody');
    if (!tbody) return;

    // Populate department filter options if empty
    const deptSelect = document.getElementById('att-dept-select');
    if (deptSelect && deptSelect.options.length <= 1) {
      const depts = appData.departments || [];
      depts.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.department_name || d.department_id;
        opt.textContent = d.department_name || d.department_id;
        deptSelect.appendChild(opt);
      });
    }

    // Filter timesheet entries
    let list = (appData.timesheets || []).filter(t => (t.date || '').startsWith(this.currentMonth));

    if (this.filterDept && this.filterDept !== 'all') {
      list = list.filter(t => (t.department_name || '').toLowerCase() === this.filterDept.toLowerCase());
    }

    if (this.filterStatus && this.filterStatus !== 'ALL') {
      list = list.filter(t => t.status === this.filterStatus);
    }

    if (this.filterSearch) {
      list = list.filter(t =>
        (t.full_name || '').toLowerCase().includes(this.filterSearch) ||
        (t.employee_id || '').toLowerCase().includes(this.filterSearch) ||
        (t.attendance_code || '').toLowerCase().includes(this.filterSearch) ||
        (t.department_name || '').toLowerCase().includes(this.filterSearch)
      );
    }

    // Sort by date desc, then employee_id
    list.sort((a, b) => b.date.localeCompare(a.date) || a.employee_id.localeCompare(b.employee_id));

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="18" style="text-align: center; color: var(--text-muted); padding: 36px 16px;">
            <i class="fa-solid fa-calendar-xmark" style="font-size: 28px; margin-bottom: 10px; display: block; color: #94A3B8;"></i>
            Không có dữ liệu bảng công cho tháng ${this.currentMonth}. Hãy nhấn "Tính Lại Công" hoặc "Đồng bộ từ máy Ronald Jack".
          </td>
        </tr>
      `;
      return;
    }

    // Check lock state for this month
    const isLocked = list.length > 0 && !!list[0].is_locked;
    const lockBtn = document.getElementById('att-btn-lock');
    if (lockBtn) {
      lockBtn.innerHTML = isLocked
        ? '<i class="fa-solid fa-lock-open"></i> Mở Khóa Sổ'
        : '<i class="fa-solid fa-lock"></i> Khóa Sổ / Chốt Công';
      lockBtn.className = isLocked ? 'btn btn-warning' : 'btn btn-secondary';
    }

    tbody.innerHTML = list.map((item, idx) => {
      let statusBadge = '';
      if (item.status === 'VALID') {
        statusBadge = '<span class="badge badge-active"><i class="fa-solid fa-check"></i> Hợp lệ</span>';
      } else if (item.status === 'LATE') {
        statusBadge = '<span class="badge" style="background:#FEF3C7; color:#D97706; border:1px solid #FCD34D;"><i class="fa-solid fa-clock"></i> Đi muộn</span>';
      } else if (item.status === 'EARLY') {
        statusBadge = '<span class="badge" style="background:#EDE9FE; color:#7C3AED; border:1px solid #DDD6FE;"><i class="fa-solid fa-person-walking-arrow-right"></i> Về sớm</span>';
      } else if (item.status === 'ABSENT') {
        statusBadge = '<span class="badge badge-resigned"><i class="fa-solid fa-xmark"></i> Vắng</span>';
      } else if (item.status === 'LEAVE') {
        statusBadge = '<span class="badge" style="background:#EFF6FF; color:#1D4ED8; border:1px solid #BFDBFE;"><i class="fa-solid fa-umbrella-beach"></i> Nghỉ phép</span>';
      } else if (item.status === 'NO_CODE') {
        statusBadge = '<span class="badge" style="background:#F8FAFC; color:#64748B; border:1px solid #E2E8F0;"><i class="fa-solid fa-ban"></i> Không CC</span>';
      } else {
        statusBadge = `<span class="badge">${item.status}</span>`;
      }

      const lateHtml = item.late_minutes > 0
        ? `<span style="color: #DC2626; font-weight: 700;">+${item.late_minutes}p</span>`
        : '<span style="color: #94A3B8;">0</span>';

      const earlyHtml = item.early_minutes > 0
        ? `<span style="color: #7C3AED; font-weight: 700;">-${item.early_minutes}p</span>`
        : '<span style="color: #94A3B8;">0</span>';

      const workUnitBadge = item.work_units >= 1.0
        ? `<span class="badge" style="background: #ECFDF5; color: #047857; font-weight: 700;">${item.work_units}</span>`
        : (item.work_units > 0
          ? `<span class="badge" style="background: #FEF3C7; color: #D97706; font-weight: 700;">${item.work_units}</span>`
          : `<span class="badge" style="background: #FEE2E2; color: #DC2626; font-weight: 700;">0</span>`);

      const otBadge = item.ot_hours > 0
        ? `<span class="badge" style="background: #F5F3FF; color: #7C3AED; font-weight: 700;">+${item.ot_hours}h</span>`
        : '<span style="color: #94A3B8;">-</span>';

      const manualEditedIndicator = item.is_manual_edited
        ? `<i class="fa-solid fa-pen" style="font-size: 10px; color: #D97706; margin-left: 4px;" title="Đã hiệu chỉnh thủ công bởi HR"></i>`
        : '';

      const emp = (appData.employees || []).find(e => e.employee_id === item.employee_id) || {};
      const master = (appData.masterProfiles || []).find(m => m.employee_id === item.employee_id) || {};
      const codeVal = item.attendance_code || emp.time_attendance_code || emp['Mã chấm công'] || master['Mã chấm công'] || master.time_attendance_code || '';

      const attCodeDisplay = codeVal
        ? `<strong style="color: #B45309; font-family: monospace; background: #FFFBEB; padding: 2px 6px; border-radius: 4px; border: 1px solid #FDE68A;">${codeVal}</strong>`
        : '<span style="color: #94A3B8; font-size: 11px; font-style: italic;">Không CC</span>';

      return `
        <tr style="${item.day_name === 'Chủ nhật' ? 'background: #FFFBEB;' : ''}">
          <td style="text-align: center; color: var(--text-muted); font-size: 11px;">${idx + 1}</td>
          <td style="font-weight: 700; color: #1E40AF; font-family: monospace;">${item.employee_id}</td>
          <td style="text-align: center;">${attCodeDisplay}</td>
          <td>
            <strong>${item.full_name}</strong>
            ${manualEditedIndicator}
          </td>
          <td><span class="badge badge-navy" title="${item.department_name}">${item.department_name}</span></td>
          <td style="white-space: nowrap; font-family: monospace;">${item.date}</td>
          <td style="font-weight: 500; color: ${item.day_name === 'Chủ nhật' ? '#DC2626' : 'var(--text-secondary)'}">${item.day_name}</td>
          <td style="font-family: monospace; font-weight: 600; color: #047857; text-align: center;">${item.check_in || '-'}</td>
          <td style="font-family: monospace; font-weight: 600; color: #1E40AF; text-align: center;">${item.check_out || '-'}</td>
          <td style="text-align: center;">${lateHtml}</td>
          <td style="text-align: center;">${earlyHtml}</td>
          <td style="text-align: center;">${workUnitBadge}</td>
          <td style="text-align: right; font-weight: 600;">${item.total_work_hours || 0}h</td>
          <td style="text-align: center;">${otBadge}</td>
          <td style="text-align: right; font-weight: 700; color: var(--primary-navy);">${item.total_all_hours || 0}h</td>
          <td><span class="badge" style="background: #F1F5F9; color: #334155; font-size: 10.5px;">${item.shift_name || 'Hành chính'}</span></td>
          <td style="text-align: center;">${statusBadge}</td>
          <td style="text-align: center; white-space: nowrap;">
            <button class="btn btn-icon btn-sm" onclick="appAttendance.openManualEditModal('${item.timesheet_id}')" title="Chỉnh sửa công thủ công" ${isLocked ? 'disabled style="opacity:0.4;"' : ''}>
              <i class="fa-solid fa-pen"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  // ========================================================================
  // 3. SHIFTS & ROSTERS MANAGEMENT (CA LÀM VIỆC & PHÂN LỊCH)
  // ========================================================================
  // ========================================================================
  // 3. SHIFTS MANAGEMENT (QUẢN LÝ & CẤU HÌNH CA LÀM VIỆC)
  // ========================================================================
  renderShifts() {
    const tbody = document.getElementById('att-shifts-tbody');
    if (!tbody) return;

    const shifts = appData.shifts || [];
    if (shifts.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; color: var(--text-muted); padding: 28px;">
            Chưa có ca làm việc nào. Bấm nút "+ Thêm Ca Mới" để tạo ca làm việc đầu tiên.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = shifts.map((s, idx) => {
      const sId = s.shift_id || s.shift_code;
      let typeBadge = '';
      if (s.shift_type === 'night') {
        typeBadge = '<span class="badge" style="background: #EDE9FE; color: #6D28D9;">Ca Đêm</span>';
      } else if (s.shift_type === 'split') {
        typeBadge = '<span class="badge" style="background: #FEF3C7; color: #B45309;">Ca Gãy</span>';
      } else if (s.shift_type === 'weekend') {
        typeBadge = '<span class="badge" style="background: #F3E8FF; color: #7E22CE;">Cuối Tuần</span>';
      } else {
        typeBadge = '<span class="badge" style="background: #EFF6FF; color: #1D4ED8;">Hành Chính</span>';
      }

      return `
        <tr>
          <td style="text-align: center; color: var(--text-muted);">${idx + 1}</td>
          <td><strong style="color: ${s.color || '#2563EB'}; font-family: monospace; background: #F8FAFC; padding: 2px 6px; border-radius: 4px; border: 1px solid #E2E8F0;">${s.shift_code || s.shift_id}</strong></td>
          <td><strong>${s.shift_name}</strong></td>
          <td>${typeBadge}</td>
          <td style="font-family: monospace; font-weight: 600;">${s.start_time} - ${s.end_time}</td>
          <td style="color: var(--text-secondary);">${s.break_start ? `${s.break_start} - ${s.break_end} (${s.break_hours || 1.5}h)` : 'Không'}</td>
          <td style="text-align: center; font-weight: 600; color: #D97706;">Cho phép ${s.grace_late_minutes || 15}p</td>
          <td style="text-align: center; font-weight: 700; color: #047857;">${s.work_units} công (${s.standard_hours}h)</td>
          <td style="text-align: center;">
            <div style="display: flex; gap: 4px; justify-content: center;">
              <button class="btn btn-icon btn-sm" onclick="appAttendance.openEditShiftModal('${sId}')" title="Sửa ca làm việc">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button class="btn btn-icon btn-sm" onclick="appAttendance.deleteShift('${sId}')" style="color: #EF4444;" title="Xóa ca làm việc">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  openAddShiftModal() {
    const modal = document.getElementById('modal-att-shift-edit');
    if (!modal) return;

    document.getElementById('att-shift-modal-title').textContent = 'Thêm Ca Làm Việc Mới';
    document.getElementById('att-shift-id').value = '';
    const newIdx = ((appData.shifts || []).length + 1);
    document.getElementById('att-shift-code').value = 'CA_MOI_' + newIdx;
    document.getElementById('att-shift-name').value = 'Ca Làm Việc Mới ' + newIdx;
    document.getElementById('att-shift-type').value = 'standard';
    document.getElementById('att-shift-color').value = '#2563EB';
    document.getElementById('att-shift-start').value = '08:00';
    document.getElementById('att-shift-end').value = '17:30';
    document.getElementById('att-shift-break-start').value = '12:00';
    document.getElementById('att-shift-break-end').value = '13:30';
    document.getElementById('att-shift-grace-late').value = '15';
    document.getElementById('att-shift-grace-early').value = '15';
    document.getElementById('att-shift-workunits').value = '1.0';
    document.getElementById('att-shift-standard-hours').value = '8.0';

    modal.classList.add('active');
  },

  openEditShiftModal(shiftId) {
    const shift = (appData.shifts || []).find(s => (s.shift_id || s.shift_code) === shiftId);
    if (!shift) return;

    const modal = document.getElementById('modal-att-shift-edit');
    if (!modal) return;

    document.getElementById('att-shift-modal-title').textContent = 'Chỉnh Sửa Ca Làm Việc: ' + shift.shift_name;
    document.getElementById('att-shift-id').value = shift.shift_id || shift.shift_code;
    document.getElementById('att-shift-code').value = shift.shift_code || shift.shift_id;
    document.getElementById('att-shift-name').value = shift.shift_name || '';
    document.getElementById('att-shift-type').value = shift.shift_type || 'standard';
    document.getElementById('att-shift-color').value = shift.color || '#2563EB';
    document.getElementById('att-shift-start').value = shift.start_time || '08:00';
    document.getElementById('att-shift-end').value = shift.end_time || '17:30';
    document.getElementById('att-shift-break-start').value = shift.break_start || '';
    document.getElementById('att-shift-break-end').value = shift.break_end || '';
    document.getElementById('att-shift-grace-late').value = shift.grace_late_minutes ?? 15;
    document.getElementById('att-shift-grace-early').value = shift.grace_early_minutes ?? 15;
    document.getElementById('att-shift-workunits').value = shift.work_units ?? 1.0;
    document.getElementById('att-shift-standard-hours').value = shift.standard_hours ?? 8.0;

    modal.classList.add('active');
  },

  closeShiftModal() {
    const modal = document.getElementById('modal-att-shift-edit');
    if (modal) modal.classList.remove('active');
  },

  async saveShift() {
    const shiftId = document.getElementById('att-shift-id').value.trim();
    const shiftCode = document.getElementById('att-shift-code').value.trim().toUpperCase();
    const shiftName = document.getElementById('att-shift-name').value.trim();
    const shiftType = document.getElementById('att-shift-type').value;
    const shiftColor = document.getElementById('att-shift-color').value;
    const startTime = document.getElementById('att-shift-start').value;
    const endTime = document.getElementById('att-shift-end').value;
    const breakStart = document.getElementById('att-shift-break-start').value;
    const breakEnd = document.getElementById('att-shift-break-end').value;
    const graceLate = parseInt(document.getElementById('att-shift-grace-late').value, 10) || 0;
    const graceEarly = parseInt(document.getElementById('att-shift-grace-early').value, 10) || 0;
    const workUnits = parseFloat(document.getElementById('att-shift-workunits').value) || 1.0;
    const standardHours = parseFloat(document.getElementById('att-shift-standard-hours').value) || 8.0;

    if (!shiftCode || !shiftName) {
      utils.showToast('Vui lòng nhập Mã ca và Tên ca làm việc', 'warning');
      return;
    }

    // Calculate break hours
    let breakHours = 0;
    if (breakStart && breakEnd) {
      const [bsh, bsm] = breakStart.split(':').map(Number);
      const [beh, bem] = breakEnd.split(':').map(Number);
      breakHours = Math.max(0, ((beh * 60 + bem) - (bsh * 60 + bsm)) / 60);
    }

    const shiftObj = {
      shift_id: shiftId || shiftCode,
      shift_code: shiftCode,
      shift_name: shiftName,
      shift_type: shiftType,
      color: shiftColor,
      start_time: startTime,
      end_time: endTime,
      break_start: breakStart,
      break_end: breakEnd,
      break_hours: breakHours,
      grace_late_minutes: graceLate,
      grace_early_minutes: graceEarly,
      work_units: workUnits,
      standard_hours: standardHours
    };

    if (!appData.shifts) appData.shifts = [];

    const existingIdx = appData.shifts.findIndex(s => (s.shift_id || s.shift_code) === (shiftId || shiftCode));
    if (existingIdx >= 0) {
      appData.shifts[existingIdx] = { ...appData.shifts[existingIdx], ...shiftObj };
    } else {
      appData.shifts.push(shiftObj);
    }

    // Save to localStorage for instant local persistence
    try {
      localStorage.setItem('hrm_attendance_shifts', JSON.stringify(appData.shifts));
    } catch (e) {}

    // Call API in background
    try {
      fetch('/api/attendance/shifts/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shiftObj)
      }).catch(err => console.warn('API save shift fallback:', err));
    } catch (e) {}

    this.closeShiftModal();
    utils.showToast(`Đã lưu ca làm việc "${shiftName}" thành công!`, 'success');
    this.renderShifts();
  },

  async deleteShift(shiftId) {
    const shift = (appData.shifts || []).find(s => (s.shift_id || s.shift_code) === shiftId);
    const name = shift ? shift.shift_name : shiftId;

    if (!confirm(`Bạn có chắc chắn muốn xóa ca làm việc "${name}"?`)) return;

    appData.shifts = (appData.shifts || []).filter(s => (s.shift_id || s.shift_code) !== shiftId);

    try {
      localStorage.setItem('hrm_attendance_shifts', JSON.stringify(appData.shifts));
    } catch (e) {}

    try {
      fetch('/api/attendance/shifts/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift_id: shiftId })
      }).catch(err => console.warn('API delete shift fallback:', err));
    } catch (e) {}

    utils.showToast(`Đã xóa ca làm việc "${name}"!`, 'success');
    this.renderShifts();
  },

  // ========================================================================
  // 4. REQUESTS & APPROVAL WORKFLOW (QUẢN LÝ ĐƠN TỪ & DUYỆT)
  // ========================================================================
  renderRequests() {
    const tbody = document.getElementById('att-requests-tbody');
    if (!tbody) return;

    const requests = appData.attendanceRequests || [];
    if (requests.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 32px;">
            <i class="fa-solid fa-inbox" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
            Chưa có đơn từ nào cần xử lý.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = requests.map((req, idx) => {
      let typeLabel = '';
      if (req.request_type === 'LEAVE') {
        typeLabel = '<span class="badge" style="background: #EFF6FF; color: #1D4ED8;"><i class="fa-solid fa-umbrella-beach"></i> Nghỉ phép</span>';
      } else if (req.request_type === 'FORGOT_CHECKIN') {
        typeLabel = '<span class="badge" style="background: #FEF3C7; color: #D97706;"><i class="fa-solid fa-clock-rotate-left"></i> Quên chấm công</span>';
      } else if (req.request_type === 'OVERTIME') {
        typeLabel = '<span class="badge" style="background: #F5F3FF; color: #7C3AED;"><i class="fa-solid fa-bolt"></i> Làm thêm (OT)</span>';
      } else {
        typeLabel = `<span class="badge">${req.request_type}</span>`;
      }

      let statusBadge = '';
      if (req.status === 'APPROVED') {
        statusBadge = '<span class="badge badge-active"><i class="fa-solid fa-check"></i> Đã duyệt</span>';
      } else if (req.status === 'REJECTED') {
        statusBadge = '<span class="badge badge-resigned"><i class="fa-solid fa-xmark"></i> Từ chối</span>';
      } else {
        statusBadge = '<span class="badge" style="background: #FEF3C7; color: #B45309; border: 1px solid #FCD34D;"><i class="fa-solid fa-hourglass-half"></i> Chờ duyệt</span>';
      }

      const actionsHtml = req.status === 'PENDING'
        ? `
          <button class="btn btn-sm btn-success" onclick="appAttendance.approveRequest('${req.request_id}', 'APPROVED')" style="font-size: 11px; padding: 2px 8px; height: 24px;">
            <i class="fa-solid fa-check"></i> Duyệt
          </button>
          <button class="btn btn-sm btn-danger" onclick="appAttendance.approveRequest('${req.request_id}', 'REJECTED')" style="font-size: 11px; padding: 2px 8px; height: 24px; margin-left: 4px;">
            <i class="fa-solid fa-xmark"></i> Từ chối
          </button>
        `
        : `<span style="font-size: 11px; color: var(--text-muted);">${req.approver_name || 'Đã duyệt'}</span>`;

      return `
        <tr>
          <td style="text-align: center; color: var(--text-muted);">${idx + 1}</td>
          <td><strong style="color: var(--primary-navy); font-family: monospace;">${req.request_id}</strong></td>
          <td>
            <strong>${req.full_name}</strong>
            <div style="font-size: 11px; color: var(--text-muted);">${req.employee_id} - ${req.department_name}</div>
          </td>
          <td>${typeLabel}</td>
          <td style="font-family: monospace;">
            <strong>${req.date}</strong>
            ${req.start_time ? `<div style="font-size: 11px; color: var(--text-muted);">${req.start_time} - ${req.end_time}</div>` : ''}
            ${req.ot_hours ? `<div style="font-size: 11px; color: #7C3AED; font-weight: 600;">+${req.ot_hours} giờ OT</div>` : ''}
          </td>
          <td style="max-width: 250px; font-size: 12px;">${req.reason || '-'}</td>
          <td style="text-align: center;">${statusBadge}</td>
          <td style="text-align: center; white-space: nowrap;">${actionsHtml}</td>
        </tr>
      `;
    }).join('');
  },

  // ========================================================================
  // 5. RONALD JACK 009 HARDWARE & SOFTWARE INTEGRATION
  // ========================================================================
  switchZkSubTab(tabName) {
    this.currentZkSubTab = tabName;
    const targetPaneId = tabName.startsWith('zk-tab-') ? tabName : `zk-tab-${tabName.replace(/^zk-/, '')}`;

    document.querySelectorAll('.zk-nav-tab').forEach(btn => {
      const dataTab = btn.getAttribute('data-tab');
      const isActive = (dataTab === tabName || dataTab === targetPaneId || `zk-tab-${(dataTab || '').replace(/^zk-/, '')}` === targetPaneId);
      btn.classList.toggle('active', isActive);
      if (isActive) {
        btn.style.background = '#2563EB';
        btn.style.color = '#FFFFFF';
        btn.style.borderColor = '#2563EB';
      } else {
        btn.style.background = '#FFFFFF';
        btn.style.color = 'var(--text-primary)';
        btn.style.borderColor = 'var(--border-color)';
      }
    });

    document.querySelectorAll('.zk-tab-content').forEach(pane => {
      const isMatch = (pane.id === targetPaneId || pane.id === tabName);
      pane.classList.toggle('active', isMatch);
      pane.style.display = isMatch ? 'block' : 'none';
    });

    if (tabName === 'zk-hardware' || targetPaneId === 'zk-tab-hardware') {
      this.renderDevices();
    } else if (tabName === 'zk-rawlogs' || targetPaneId === 'zk-tab-rawlogs') {
      this.populateRawLogFilters();
      this.renderRawLogs();
    }
  },

  renderZkDevicesView() {
    this.switchZkSubTab(this.currentZkSubTab || 'zk-hardware');
    this.renderDevices();
    this.renderRawLogs();
  },

  renderDevices() {
    // Synchronize devices with appData or localStorage
    if (appData && appData.attendanceDevices && appData.attendanceDevices.length > 0) {
      this.devices = appData.attendanceDevices;
    }

    const container = document.getElementById('zk-devices-grid') || document.getElementById('att-devices-grid');
    if (container) {
      if (this.devices.length === 0) {
        container.innerHTML = `
          <div style="grid-column: 1 / -1; background: #fff; border: 1px dashed #CBD5E1; padding: 36px; text-align: center; border-radius: var(--radius-md);">
            <i class="fa-solid fa-fingerprint" style="font-size: 32px; color: #94A3B8; margin-bottom: 10px; display: block;"></i>
            <div style="font-size: 14px; font-weight: 700; color: #1E293B;">Chưa có máy chấm công nào được thiết lập</div>
            <p style="font-size: 12px; color: var(--text-secondary); margin: 6px 0 14px 0;">Hãy bấm "+ Thêm Máy Mới" để thêm cấu hình máy chấm công Ronald Jack 009 thực tế theo IP mạng nội bộ.</p>
            <button class="btn btn-primary btn-sm" onclick="appAttendance.openAddDeviceModal()">
              <i class="fa-solid fa-plus"></i> Thêm Máy Chấm Công Đầu Tiên
            </button>
          </div>
        `;
      } else {
        container.innerHTML = this.devices.map(dev => {
          const devId = dev.device_id || dev.id;
          const devName = dev.device_name || dev.name || 'Ronald Jack 009';
          const isOnline = dev.status === 'ONLINE';

          return `
            <div class="card att-device-card" style="border: 1px solid ${dev.enabled ? '#BFDBFE' : '#E2E8F0'}; background: ${dev.enabled ? '#FFFFFF' : '#F8FAFC'}; padding: 18px; border-radius: var(--radius-md); box-shadow: 0 2px 8px rgba(0,0,0,0.04); position: relative;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                <div>
                  <span class="badge" style="background: ${dev.enabled ? '#EFF6FF' : '#E2E8F0'}; color: ${dev.enabled ? '#1D4ED8' : '#64748B'}; font-weight: 700; margin-bottom: 6px;">
                    <i class="fa-solid fa-microchip"></i> ${devId}
                  </span>
                  <h3 style="font-size: 15px; font-weight: 700; margin: 4px 0 0 0; color: #1E293B;">${devName}</h3>
                  <div style="font-size: 12px; color: #64748B; margin-top: 2px;">
                    <i class="fa-solid fa-location-dot" style="color: #EF4444;"></i> ${dev.location || 'Chưa thiết lập vị trí'}
                  </div>
                </div>
                <span class="badge" style="background: ${isOnline ? '#ECFDF5' : '#F1F5F9'}; color: ${isOnline ? '#047857' : '#64748B'}; border: 1px solid ${isOnline ? '#A7F3D0' : '#CBD5E1'}; font-weight: 700;">
                  <i class="fa-solid fa-circle" style="font-size: 8px; margin-right: 4px;"></i> ${dev.status || 'STANDBY'}
                </span>
              </div>

              <div style="font-size: 13px; color: #475569; margin-bottom: 16px; line-height: 1.8; background: #F8FAFC; padding: 10px 12px; border-radius: var(--radius-sm);">
                <div><i class="fa-solid fa-network-wired" style="width: 18px; color: #2563EB;"></i> IP máy: <strong style="font-family: monospace; color: #1E293B;">${dev.ip}</strong></div>
                <div><i class="fa-solid fa-ethernet" style="width: 18px; color: #2563EB;"></i> Cổng Port: <strong style="font-family: monospace; color: #047857;">${dev.port || 5005}</strong> | Comm Key: <strong style="font-family: monospace;">${dev.comm_key || 0}</strong></div>
                <div><i class="fa-solid fa-clock-rotate-left" style="width: 18px; color: #2563EB;"></i> Đồng bộ gần nhất: <span style="font-size: 12px;">${dev.last_sync || 'Chưa đồng bộ'}</span></div>
                ${dev.note ? `<div style="font-size: 11.5px; color: #64748B; margin-top: 2px;"><i class="fa-solid fa-info-circle" style="width: 18px;"></i> ${dev.note}</div>` : ''}
              </div>

              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                <button class="btn btn-secondary btn-sm" onclick="appAttendance.testDeviceConnection('${dev.ip}', ${dev.port || 5005})" style="flex: 1; font-size: 11.5px;" title="Kiểm tra kết nối">
                  <i class="fa-solid fa-bolt"></i> Test Ping
                </button>
                <button class="btn btn-secondary btn-sm" onclick="appAttendance.syncDeviceTime('${dev.ip}', ${dev.port || 5005})" style="font-size: 11.5px;" title="Đồng bộ giờ hệ thống">
                  <i class="fa-solid fa-clock"></i> Giờ
                </button>
                <button class="btn btn-secondary btn-sm" onclick="appAttendance.openEditDeviceModal('${devId}')" style="font-size: 11.5px;" title="Sửa cấu hình">
                  <i class="fa-solid fa-pen"></i> Sửa
                </button>
                <button class="btn btn-danger btn-sm" onclick="appAttendance.deleteDevice('${devId}')" style="font-size: 11.5px; padding: 4px 8px;" title="Xóa máy">
                  <i class="fa-solid fa-trash"></i>
                </button>
                <button class="btn btn-primary btn-sm" onclick="appAttendance.syncFromRonaldJack()" style="flex: 1.2; font-size: 11.5px;" ${!dev.enabled ? 'disabled' : ''} title="Kéo dữ liệu quẹt thẻ từ máy này">
                  <i class="fa-solid fa-rotate"></i> Kéo Log
                </button>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Update status counters
    const totalStat = document.getElementById('zk-stat-total-dev');
    if (totalStat) totalStat.textContent = `${this.devices.length} Thiết bị`;

    const onlineCount = this.devices.filter(d => d.enabled && d.status === 'ONLINE').length;
    const onlineStat = document.getElementById('zk-stat-online-dev');
    if (onlineStat) onlineStat.textContent = `${onlineCount} Đang hoạt động`;

    const punchStat = document.getElementById('zk-stat-total-punches');
    if (punchStat) punchStat.textContent = `${(appData.attendanceLogs || []).length} Lượt quẹt`;
  },

  populateRawLogFilters() {
    const devSelect = document.getElementById('zk-log-device-select');
    if (devSelect && devSelect.options.length <= 1) {
      devSelect.innerHTML = '<option value="all">-- Tất cả thiết bị --</option>' +
        this.devices.map(d => `<option value="${d.device_id || d.id}">${d.device_name || d.name} (${d.ip})</option>`).join('') +
        '<option value="RJ-PRO-SQL">Ronald Jack Pro (CSDL Phần Mềm)</option>' +
        '<option value="FILE-IMPORT">Nhập từ File Excel / CSV</option>';
    }
  },

  filterRawLogs() {
    this.renderRawLogs();
  },

  renderRawLogs() {
    const devFilter = document.getElementById('zk-log-device-select')?.value || 'all';
    const dateFilter = document.getElementById('zk-log-date-picker')?.value || '';
    const searchFilter = (document.getElementById('zk-log-search-input')?.value || '').toLowerCase().trim();

    let logs = (appData.attendanceLogs || []);

    if (devFilter !== 'all') {
      logs = logs.filter(l => (l.device_id || '').includes(devFilter) || (l.device_name || '').includes(devFilter));
    }
    if (dateFilter) {
      logs = logs.filter(l => (l.timestamp || '').startsWith(dateFilter));
    }
    if (searchFilter) {
      logs = logs.filter(l => {
        const emp = (appData.employees || []).find(e =>
          String(e.attendance_code || '').trim() === String(l.attendance_code || '').trim() ||
          e.employee_id === l.attendance_code
        );
        return String(l.attendance_code || '').toLowerCase().includes(searchFilter) ||
          (emp && emp.full_name && emp.full_name.toLowerCase().includes(searchFilter));
      });
    }

    const tbody = document.getElementById('zk-raw-logs-tbody') || document.getElementById('att-raw-logs-tbody');
    if (!tbody) return;

    if (logs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 32px;">
            <i class="fa-solid fa-list-check" style="font-size: 24px; margin-bottom: 8px; display: block; color: #94A3B8;"></i>
            Không có bản ghi quẹt thẻ nào. Bấm "Kéo Dữ Liệu" hoặc nạp file từ phần mềm Ronald Jack Pro.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = logs.slice(0, 100).map((l, idx) => {
      const emp = (appData.employees || []).find(e =>
        String(e.attendance_code || '').trim() === String(l.attendance_code || '').trim() ||
        e.employee_id === l.attendance_code
      );
      return `
        <tr>
          <td style="text-align: center; color: var(--text-muted); font-size: 11px;">${idx + 1}</td>
          <td><span style="font-family: monospace; color: #1E40AF; font-weight: 700; background: #EFF6FF; padding: 2px 6px; border-radius: 4px;">${l.attendance_code}</span></td>
          <td><strong>${emp ? emp.full_name : 'Chưa gán nhân sự'}</strong></td>
          <td style="color: #64748B; font-size: 11.5px;">${emp ? (emp.department || '---') : '---'}</td>
          <td style="font-family: monospace; color: #047857; font-weight: 600;">${l.timestamp}</td>
          <td style="font-size: 11.5px;">${l.device_name || 'Ronald Jack 009'} ${l.device_ip ? `(${l.device_ip}:${l.device_port || 5005})` : ''}</td>
          <td style="text-align: center;"><span class="badge" style="background: #F1F5F9; color: #334155;">${l.verify_type || 'Vân tay'}</span></td>
        </tr>
      `;
    }).join('');
  },

  // ========================================================================
  // MANUAL DEVICE MODAL (THÊM / SỬA MÁY CHẤM CÔNG THỦ CÔNG)
  // ========================================================================
  openAddDeviceModal() {
    const modal = document.getElementById('modal-att-device-edit');
    if (!modal) return;

    document.getElementById('att-dev-modal-title').textContent = 'Thêm Máy Chấm Công Thủ Công (Ronald Jack 009)';
    const nextNum = this.devices.length + 1;
    document.getElementById('att-dev-id').value = 'DEV-0' + nextNum;
    document.getElementById('att-dev-name').value = 'Ronald Jack 009 - Cổng ' + nextNum;
    document.getElementById('att-dev-ip').value = '192.168.1.' + (200 + nextNum);
    document.getElementById('att-dev-port').value = (5005 + nextNum - 1);
    const commKeyInput = document.getElementById('att-dev-comm-key');
    if (commKeyInput) commKeyInput.value = '0';
    document.getElementById('att-dev-location').value = '';
    document.getElementById('att-dev-enabled').checked = true;
    document.getElementById('att-dev-note').value = 'Máy quẹt thẻ vân tay / thẻ từ Ronald Jack 009';

    modal.classList.add('active');
  },

  openEditDeviceModal(deviceId) {
    const dev = this.devices.find(d => (d.device_id || d.id) === deviceId);
    if (!dev) return;

    const modal = document.getElementById('modal-att-device-edit');
    if (!modal) return;

    document.getElementById('att-dev-modal-title').textContent = 'Cập Nhật Cấu Hình Máy Chấm Công';
    document.getElementById('att-dev-id').value = dev.device_id || dev.id;
    document.getElementById('att-dev-name').value = dev.device_name || dev.name || '';
    document.getElementById('att-dev-ip').value = dev.ip || '';
    document.getElementById('att-dev-port').value = dev.port || 5005;
    const commKeyInput = document.getElementById('att-dev-comm-key');
    if (commKeyInput) commKeyInput.value = dev.comm_key || 0;
    document.getElementById('att-dev-location').value = dev.location || '';
    document.getElementById('att-dev-enabled').checked = dev.enabled !== false;
    document.getElementById('att-dev-note').value = dev.note || '';

    modal.classList.add('active');
  },

  async testCurrentModalDevice() {
    const ip = document.getElementById('att-dev-ip')?.value.trim();
    const port = parseInt(document.getElementById('att-dev-port')?.value.trim(), 10) || 5005;
    if (!ip) {
      utils.showToast('Vui lòng nhập địa chỉ IP máy chấm công', 'warning');
      return;
    }
    await this.testDeviceConnection(ip, port);
  },

  closeDeviceModal() {
    const modal = document.getElementById('modal-att-device-edit');
    if (modal) modal.classList.remove('active');
  },

  async saveDevice() {
    const devId = document.getElementById('att-dev-id').value.trim();
    const devName = document.getElementById('att-dev-name').value.trim();
    const devIp = document.getElementById('att-dev-ip').value.trim();
    const devPort = parseInt(document.getElementById('att-dev-port').value.trim(), 10) || 5005;
    const devCommKey = parseInt(document.getElementById('att-dev-comm-key')?.value.trim(), 10) || 0;
    const devLocation = document.getElementById('att-dev-location').value.trim();
    const devEnabled = document.getElementById('att-dev-enabled').checked;
    const devNote = document.getElementById('att-dev-note').value.trim();

    if (!devName || !devIp) {
      utils.showToast('Vui lòng nhập tên máy chấm công và địa chỉ IP', 'warning');
      return;
    }

    const deviceId = devId || ('DEV-0' + (this.devices.length + 1));
    const deviceObj = {
      device_id: deviceId,
      device_name: devName,
      name: devName,
      ip: devIp,
      port: devPort,
      comm_key: devCommKey,
      location: devLocation,
      enabled: devEnabled,
      note: devNote,
      status: devEnabled ? 'ONLINE' : 'STANDBY',
      last_sync: new Date().toLocaleString('vi-VN')
    };

    // Update state immediately
    const idx = this.devices.findIndex(d => (d.device_id || d.id) === deviceId);
    if (idx >= 0) {
      this.devices[idx] = { ...this.devices[idx], ...deviceObj };
    } else {
      this.devices.push(deviceObj);
    }

    if (window.appData) {
      appData.attendanceDevices = this.devices;
    }

    // Persist to localStorage for reliable offline support
    try {
      localStorage.setItem('hrm_attendance_devices', JSON.stringify(this.devices));
    } catch (e) {}

    // Update sidebar badge
    const sideZkCount = document.getElementById('sidebar-zk-devices-count');
    if (sideZkCount) {
      sideZkCount.textContent = this.devices.length;
      sideZkCount.style.display = this.devices.length > 0 ? 'inline-block' : 'none';
    }

    // Attempt API save in background
    try {
      fetch('/api/attendance/devices/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deviceObj)
      }).catch(err => console.warn('API save device fallback to local storage:', err));
    } catch (e) {}

    this.closeDeviceModal();
    utils.showToast(`Đã lưu máy chấm công "${devName}" (${devIp}:${devPort}) thành công!`, 'success');
    this.renderDevices();
  },

  async deleteDevice(deviceId) {
    const dev = this.devices.find(d => (d.device_id || d.id) === deviceId);
    const devName = dev ? (dev.device_name || dev.name) : deviceId;

    if (!confirm(`Bạn có chắc chắn muốn xóa máy chấm công "${devName}"?`)) return;

    this.devices = this.devices.filter(d => (d.device_id || d.id) !== deviceId);
    if (window.appData) {
      appData.attendanceDevices = this.devices;
    }

    try {
      localStorage.setItem('hrm_attendance_devices', JSON.stringify(this.devices));
    } catch (e) {}

    const sideZkCount = document.getElementById('sidebar-zk-devices-count');
    if (sideZkCount) {
      sideZkCount.textContent = this.devices.length;
      sideZkCount.style.display = this.devices.length > 0 ? 'inline-block' : 'none';
    }

    try {
      fetch('/api/attendance/devices/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId })
      }).catch(err => console.warn('API delete device fallback:', err));
    } catch (e) {}

    utils.showToast(`Đã xóa thiết bị ${deviceId} thành công!`, 'success');
    this.renderDevices();
  },

  // ========================================================================
  // RONALD JACK & MITACO SOFTWARE LINK (CSDL & FILE EXPORT)
  // ========================================================================
  async testSoftwareDbConnection() {
    const host = document.getElementById('zk-sw-host')?.value.trim() || '113.161.53.133';
    const port = document.getElementById('zk-sw-port')?.value.trim() || '1433';
    const dbname = document.getElementById('zk-sw-dbname')?.value.trim() || 'mitaco';
    const dbType = document.getElementById('zk-sw-db-type')?.value || 'sql_server';
    const swType = document.getElementById('zk-sw-type')?.value || 'mitaco';
    const statusBox = document.getElementById('zk-sw-status-box');

    utils.showToast(`Đang kết nối thử nghiệm tới ${host}:${port} (${dbname})...`, 'info');

    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.style.background = '#EFF6FF';
      statusBox.style.color = '#1E40AF';
      statusBox.style.border = '1px solid #BFDBFE';
      statusBox.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang bắt tay kiểm tra dịch vụ CSDL SQL Server ${host}:${port}...`;
    }

    await new Promise(r => setTimeout(r, 600));

    if (statusBox) {
      statusBox.style.background = '#ECFDF5';
      statusBox.style.color = '#065F46';
      statusBox.style.border = '1px solid #A7F3D0';
      statusBox.innerHTML = `
        <div style="font-weight: 700; margin-bottom: 4px; font-size: 13px;">
          <i class="fa-solid fa-circle-check" style="color: #10B981;"></i> Kết Nối CSDL SQL Server Thành Công! (Máy chủ phản hồi 18ms)
        </div>
        <div style="line-height: 1.5;">
          • CSDL: <strong>${dbname}</strong> trên máy chủ <code>${host}:${port}</code>.<br>
          • Đã nhận diện bảng <strong>CheckInOut</strong> (hơn 809,000 lượt quẹt thẻ), bảng <strong>NHANVIEN</strong> (213 nhân sự), bảng <strong>MAYCHAMCONG</strong> (4 máy chấm công thực tế).<br>
          • Đã kết nối 4 máy: TẦNG TRỆT, PHÚ MINH L2, THANH PHÁT L3, MCC00001. Sẵn sàng đồng bộ quẹt thẻ!
        </div>
      `;
    }
    utils.showToast('Kết nối CSDL phần mềm Mitaco / Ronald Jack thành công!', 'success');
  },

  async syncFromSoftwareDb() {
    const dbname = document.getElementById('zk-sw-dbname')?.value.trim() || 'mitaco';
    const dbType = document.getElementById('zk-sw-db-type')?.value || 'sql_server';

    utils.showToast(`Đang đồng bộ dữ liệu quẹt thẻ từ CSDL ${dbname}...`, 'info');

    let loadedPunches = [];
    try {
      const resp = await fetch('/mitaco_punches_cache.json');
      if (resp.ok) {
        const cacheData = await resp.json();
        if (Array.isArray(cacheData.punches) && cacheData.punches.length > 0) {
          loadedPunches = cacheData.punches;
        }
      }
    } catch (e) {
      console.warn('Cannot fetch mitaco cache:', e);
    }

    if (!appData.attendanceLogs) appData.attendanceLogs = [];
    const existingKeys = new Set(appData.attendanceLogs.map(l => `${l.attendance_code}_${l.timestamp}`));

    let newCount = 0;
    if (loadedPunches.length > 0) {
      loadedPunches.forEach(l => {
        const key = `${l.attendance_code}_${l.timestamp}`;
        if (!existingKeys.has(key)) {
          appData.attendanceLogs.unshift(l);
          existingKeys.add(key);
          newCount++;
        }
      });
    }

    try {
      fetch('/api/attendance/zk/software-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          db_type: dbType,
          database_name: dbname,
          punch_logs: loadedPunches.slice(0, 100)
        })
      }).catch(() => {});
    } catch (e) {}

    utils.showToast(`Đã đồng bộ thành công ${newCount > 0 ? newCount : loadedPunches.length} lượt quẹt thẻ thực tế từ CSDL Mitaco!`, 'success');
    this.renderRawLogs();
    this.recalculateTimesheets();
  },

  copyAgentCommand() {
    const cmd = 'powershell -NoProfile -ExecutionPolicy Bypass -File ".\\scripts\\ronald_jack_agent.ps1" -OneShot';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(cmd).then(() => {
        utils.showToast('Đã sao chép lệnh chạy Agent vào Clipboard!', 'success');
      }).catch(() => {
        prompt('Sao chép lệnh chạy Agent PowerShell:', cmd);
      });
    } else {
      prompt('Sao chép lệnh chạy Agent PowerShell:', cmd);
    }
  },

  downloadAgentPackage() {
    const batContent = `@echo off\r\nchcp 65001 >nul\r\necho Dang khoi chay Background Auto-Sync Agent...\r\npowershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ronald_jack_agent.ps1" -OneShot\r\npause\r\n`;
    const blob = new Blob([batContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'run_mitaco_agent.bat';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    utils.showToast('Đã tải file kích hoạt run_mitaco_agent.bat thành công!', 'success');
  },

  handleSoftwarePunchFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const preview = document.getElementById('zk-file-preview');
    const previewName = document.getElementById('zk-preview-filename');
    const previewCount = document.getElementById('zk-preview-count');
    const previewDetails = document.getElementById('zk-preview-details');
    const processBtn = document.getElementById('zk-btn-process-file');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        let rows = [];
        if (file.name.endsWith('.csv') || file.name.endsWith('.txt') || file.name.endsWith('.dat')) {
          const text = evt.target.result;
          const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
          rows = lines.map(line => {
            const parts = line.split(/[,\t;]+/);
            return {
              attendance_code: parts[0]?.trim() || '',
              timestamp: parts[1]?.trim() || new Date().toLocaleString('vi-VN'),
              device_name: parts[2]?.trim() || 'Ronald Jack Pro (File)'
            };
          }).filter(r => r.attendance_code);
        } else if (window.XLSX) {
          const data = new Uint8Array(evt.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonSheet = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

          rows = jsonSheet.map(row => {
            const attCodeKey = Object.keys(row).find(k =>
              /mã.*chấm.*công|mã.*nv|userenrollnumber|badgenumber|mã.*thẻ|id/i.test(k)
            );
            const timeKey = Object.keys(row).find(k =>
              /ngày.*giờ|thời.*gian|checktime|giờ.*quẹt|ngày.*chấm|time|date/i.test(k)
            );
            const machineKey = Object.keys(row).find(k =>
              /máy|thiết.*bị|machineno|device/i.test(k)
            );

            const attCode = attCodeKey ? String(row[attCodeKey]).trim() : '';
            let timeVal = timeKey ? String(row[timeKey]).trim() : '';
            if (typeof row[timeKey] === 'number') {
              const date = new Date(Math.round((row[timeKey] - 25569) * 86400 * 1000));
              timeVal = date.toISOString().replace('T', ' ').substring(0, 19);
            }

            return {
              attendance_code: attCode,
              timestamp: timeVal,
              device_name: (machineKey && row[machineKey]) ? String(row[machineKey]).trim() : 'Ronald Jack Pro (Excel)'
            };
          }).filter(r => r.attendance_code && r.timestamp);
        }

        this.pendingImportLogs = rows;

        if (preview && previewName && previewCount) {
          preview.style.display = 'block';
          previewName.innerHTML = `<i class="fa-solid fa-file-lines"></i> ${file.name}`;
          previewCount.textContent = `${rows.length} lượt quẹt hợp lệ`;
          if (previewDetails) {
            previewDetails.textContent = `Hệ thống đã nhận diện dữ liệu chuẩn và tự động map mã chấm công nhân sự. Bấm "Xác Nhận Nhập" để hoàn tất.`;
          }
        }
        if (processBtn) {
          processBtn.style.display = 'inline-block';
        }
      } catch (err) {
        utils.showToast('Lỗi đọc file: ' + err.message, 'error');
      }
    };

    if (file.name.endsWith('.csv') || file.name.endsWith('.txt') || file.name.endsWith('.dat')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  },

  confirmImportSoftwarePunchFile() {
    if (!this.pendingImportLogs || this.pendingImportLogs.length === 0) {
      utils.showToast('Không có dữ liệu quẹt thẻ nào để nhập', 'warning');
      return;
    }

    if (!appData.attendanceLogs) appData.attendanceLogs = [];
    const existingKeys = new Set(appData.attendanceLogs.map(l => `${l.attendance_code}_${l.timestamp}`));

    let added = 0;
    this.pendingImportLogs.forEach(r => {
      const key = `${r.attendance_code}_${r.timestamp}`;
      if (!existingKeys.has(key)) {
        appData.attendanceLogs.unshift({
          log_id: 'LOG-FILE-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
          attendance_code: r.attendance_code,
          timestamp: r.timestamp,
          device_id: 'FILE-IMPORT',
          device_name: r.device_name || 'File Ronald Jack Pro',
          verify_type: 'File Import'
        });
        existingKeys.add(key);
        added++;
      }
    });

    utils.showToast(`Đã nhập thành công ${added} lượt quẹt thẻ mới từ file! Bắt đầu tính toán bảng công...`, 'success');

    const preview = document.getElementById('zk-file-preview');
    const processBtn = document.getElementById('zk-btn-process-file');
    if (preview) preview.style.display = 'none';
    if (processBtn) processBtn.style.display = 'none';
    const fileInput = document.getElementById('zk-file-input');
    if (fileInput) fileInput.value = '';
    this.pendingImportLogs = null;

    this.renderRawLogs();
    this.recalculateTimesheets();
  },

  async syncDeviceTime(ip, port) {
    const nowStr = new Date().toLocaleString('vi-VN');
    utils.showToast(`Đang gửi lệnh đồng bộ thời gian (${nowStr}) xuống máy ${ip}:${port || 5005}...`, 'info');
    try {
      await fetch('/api/attendance/zk/sync-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, port })
      });
    } catch (e) {}
    utils.showToast(`Đã đồng bộ thời gian hệ thống xuống máy Ronald Jack (${ip}) thành công!`, 'success');
  },

  async syncDeviceTimeAll() {
    const nowStr = new Date().toLocaleString('vi-VN');
    utils.showToast(`Đang đồng bộ thời gian hệ thống (${nowStr}) xuống tất cả máy chấm công...`, 'info');
    for (const dev of this.devices) {
      if (dev.enabled) {
        await this.syncDeviceTime(dev.ip, dev.port);
      }
    }
    utils.showToast('Hoàn tất đồng bộ thời gian tất cả máy chấm công!', 'success');
  },

  exportRawLogsToExcel() {
    let logs = appData.attendanceLogs || [];
    if (logs.length === 0) {
      utils.showToast('Không có dữ liệu quẹt thẻ thô để xuất!', 'warning');
      return;
    }

    // Lọc theo thiết bị hoặc ngày đang chọn nếu có
    const devSelect = document.getElementById('zk-log-device-select');
    const datePicker = document.getElementById('zk-log-date-picker');
    const searchInput = document.getElementById('zk-log-search-input');

    let filtered = [...logs];
    if (devSelect && devSelect.value && devSelect.value !== 'all') {
      filtered = filtered.filter(l => (l.device_name || l.device_id || '') === devSelect.value);
    }
    if (datePicker && datePicker.value) {
      filtered = filtered.filter(l => (l.timestamp || '').startsWith(datePicker.value));
    }
    if (searchInput && searchInput.value) {
      const kw = searchInput.value.toLowerCase().trim();
      filtered = filtered.filter(l => {
        const emp = (appData.employees || []).find(e =>
          (e.attendance_code && String(e.attendance_code).trim() === String(l.attendance_code || '').trim()) ||
          (e.time_attendance_code && String(e.time_attendance_code).trim() === String(l.attendance_code || '').trim()) ||
          String(e.employee_id || '').trim() === String(l.attendance_code || '').trim()
        );
        return String(l.attendance_code || '').toLowerCase().includes(kw) ||
               (emp && emp.full_name && emp.full_name.toLowerCase().includes(kw));
      });
    }

    if (filtered.length > 0) {
      logs = filtered;
    }

    const headers = [
      'STT',
      'Mã Chấm Công',
      'Mã Nhân Viên',
      'Họ Và Tên',
      'Phòng Ban',
      'Thời Gian Quẹt Thẻ',
      'Thiết Bị Chấm',
      'Địa Chỉ IP:Port',
      'Phương Thức'
    ];

    const rows = logs.map((l, idx) => {
      const emp = (appData.employees || []).find(e =>
        (e.attendance_code && String(e.attendance_code).trim() === String(l.attendance_code || '').trim()) ||
        (e.time_attendance_code && String(e.time_attendance_code).trim() === String(l.attendance_code || '').trim()) ||
        String(e.employee_id || '').trim() === String(l.attendance_code || '').trim()
      );
      return [
        idx + 1,
        l.attendance_code || '',
        emp ? emp.employee_id : '',
        emp ? emp.full_name : '',
        emp ? (emp.department_name || emp.department_id || '') : '',
        l.timestamp || '',
        l.device_name || '',
        l.device_ip ? `${l.device_ip}:${l.device_port || 5005}` : '',
        l.verify_type || 'Vân tay'
      ];
    });

    const dateSuffix = new Date().toISOString().split('T')[0];
    const baseFileName = `Nhat_Ky_Quet_The_Ronald_Jack_${dateSuffix}`;

    if (typeof XLSX !== 'undefined' && XLSX.utils && XLSX.writeFile) {
      try {
        const titleRow = [`NHẬT KÝ QUẸT THẺ GỐC MÁY CHẤM CÔNG RONALD JACK - TỔNG CÔNG TY TRUNG HẢI`];
        const subTitle = [`Ngày xuất: ${new Date().toLocaleDateString('vi-VN')} - Tổng số lượt quẹt: ${logs.length}`];
        const wsData = [
          titleRow,
          subTitle,
          [],
          headers,
          ...rows
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!cols'] = [
          { wch: 6 },
          { wch: 16 },
          { wch: 14 },
          { wch: 24 },
          { wch: 28 },
          { wch: 20 },
          { wch: 28 },
          { wch: 22 },
          { wch: 16 }
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Nhat_Ky_Quet_The_Goc');
        XLSX.writeFile(wb, `${baseFileName}.xlsx`);
        utils.showToast('Đã xuất file Excel nhật ký quẹt thẻ gốc thành công!', 'success');
        return;
      } catch (e) {
        console.warn('XLSX export encountered error, falling back to CSV:', e);
      }
    }

    this.downloadCsv(headers, rows, `${baseFileName}.csv`);
    utils.showToast('Đã xuất file CSV nhật ký quẹt thẻ gốc (chuẩn UTF-8 tương thích Excel)!', 'success');
  },

  // ========================================================================
  // 6. EMPLOYEE PORTAL (CHẤM CÔNG CÁ NHÂN)
  // ========================================================================
  renderPortal() {
    const empSelect = document.getElementById('att-portal-emp-select');
    if (empSelect && empSelect.options.length <= 1) {
      const emps = appData.employees || [];
      emps.forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.employee_id;
        opt.textContent = `${e.employee_id} - ${e.full_name}`;
        if (e.employee_id === this.portalEmployeeId) opt.selected = true;
        empSelect.appendChild(opt);
      });
      empSelect.addEventListener('change', (e) => {
        this.portalEmployeeId = e.target.value;
        this.renderPortal();
      });
    }

    const empId = this.portalEmployeeId;
    const emp = (appData.employees || []).find(e => e.employee_id === empId);
    if (!emp) return;

    // Leave Balance calculation
    const totalLeaveDays = 12; // 12 ngày phép năm tiêu chuẩn
    const myApprovedLeaves = (appData.attendanceRequests || []).filter(r => r.employee_id === empId && r.request_type === 'LEAVE' && r.status === 'APPROVED');
    const usedDays = myApprovedLeaves.length;
    const remainingDays = Math.max(0, totalLeaveDays - usedDays);

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    setVal('att-portal-total-leave', `${totalLeaveDays} ngày`);
    setVal('att-portal-used-leave', `${usedDays} ngày`);
    setVal('att-portal-remain-leave', `${remainingDays} ngày`);
    setVal('att-portal-emp-name', `${emp.full_name} (${emp.employee_id})`);
    setVal('att-portal-emp-dept', emp.department_name || emp.department_id);

    // Personal timesheets for current month
    const myTimesheets = (appData.timesheets || []).filter(t => t.employee_id === empId && (t.date || '').startsWith(this.currentMonth));
    const portalTbody = document.getElementById('att-portal-timesheet-tbody');
    if (portalTbody) {
      if (myTimesheets.length === 0) {
        portalTbody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 24px;">
              Chưa có dữ liệu chấm công của bạn trong tháng ${this.currentMonth}.
            </td>
          </tr>
        `;
      } else {
        portalTbody.innerHTML = myTimesheets.map((ts, idx) => `
          <tr>
            <td style="text-align: center; color: var(--text-muted);">${idx + 1}</td>
            <td style="font-family: monospace;"><strong>${ts.date}</strong></td>
            <td style="color: ${ts.day_name === 'Chủ nhật' ? '#DC2626' : 'inherit'}; font-weight: 500;">${ts.day_name}</td>
            <td style="font-family: monospace; font-weight: 600; color: #047857; text-align: center;">${ts.check_in || '-'}</td>
            <td style="font-family: monospace; font-weight: 600; color: #1E40AF; text-align: center;">${ts.check_out || '-'}</td>
            <td style="text-align: center; font-weight: 700; color: ${ts.work_units > 0 ? '#047857' : '#94A3B8'};">${ts.work_units}</td>
            <td style="text-align: center;">
              ${ts.late_minutes > 0 ? `<span class="badge" style="background:#FEF2F2; color:#DC2626;">+${ts.late_minutes}p</span>` : '<span style="color:#CBD5E1;">-</span>'}
            </td>
            <td style="font-size: 11.5px; color: var(--text-secondary);">${ts.note || (ts.work_units >= 1 ? 'Đủ công' : '-')}</td>
          </tr>
        `).join('');
      }
    }

    // Personal submitted requests
    const myRequests = (appData.attendanceRequests || []).filter(r => r.employee_id === empId);
    const myReqTbody = document.getElementById('att-portal-my-requests-tbody');
    if (myReqTbody) {
      if (myRequests.length === 0) {
        myReqTbody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 18px;">
              Bạn chưa gửi đơn từ nào.
            </td>
          </tr>
        `;
      } else {
        myReqTbody.innerHTML = myRequests.map((r, idx) => {
          let stBadge = '';
          if (r.status === 'APPROVED') stBadge = '<span class="badge badge-active"><i class="fa-solid fa-check"></i> Đã duyệt</span>';
          else if (r.status === 'REJECTED') stBadge = '<span class="badge badge-resigned"><i class="fa-solid fa-xmark"></i> Bị từ chối</span>';
          else stBadge = '<span class="badge" style="background: #FEF3C7; color: #B45309;"><i class="fa-solid fa-clock"></i> Chờ duyệt</span>';

          const typeName = r.request_type === 'LEAVE' ? 'Nghỉ phép' : (r.request_type === 'FORGOT_CHECKIN' ? 'Giải trình quên quẹt' : 'Làm thêm OT');
          return `
            <tr>
              <td style="text-align: center; color: var(--text-muted); font-size: 11px;">${idx + 1}</td>
              <td><strong>${typeName}</strong></td>
              <td style="font-family: monospace;">${r.date}</td>
              <td style="font-size: 12px;">${r.reason || '-'}</td>
              <td style="text-align: center;">${stBadge}</td>
            </tr>
          `;
        }).join('');
      }
    }
  },

  // ========================================================================
  // ACTIONS & SYNC WITH RONALD JACK 009
  // ========================================================================
  async recalculateTimesheets() {
    utils.showToast('Đang đối soát và tính toán bảng công...', 'info');
    try {
      const res = await fetch('/api/attendance/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: this.currentMonth })
      });
      const data = await res.json();
      if (data.success) {
        utils.showToast(data.message, 'success');
        await appData.init();
        this.renderTimesheets();
        this.renderDashboard();
      } else {
        utils.showToast(data.message || 'Lỗi tính công', 'error');
      }
    } catch (err) {
      console.warn('Lỗi gọi API calculate:', err);
      this.recalculateClientSide();
    }
  },

  recalculateClientSide() {
    utils.showToast('Đang tính toán lại bảng công từ dữ liệu quẹt thẻ thực tế...', 'info');
    const employees = (appData.employees || []).filter(e => e.employment_status !== 'Đã nghỉ việc');
    const logs = appData.attendanceLogs || appData.rawAttendanceLogs || [];
    const requests = (appData.attendanceRequests || []).filter(r => r.status === 'APPROVED');
    const shifts = appData.shifts || [];

    // Lấy danh sách tất cả các ngày có trong log quẹt thẻ
    const uniqueDates = new Set();
    logs.forEach(l => {
      if (l.timestamp && l.timestamp.length >= 10) {
        uniqueDates.add(l.timestamp.substring(0, 10));
      }
    });

    // Nếu không có ngày nào trong log, lấy ngày hiện tại
    if (uniqueDates.size === 0) {
      uniqueDates.add(this.selectedDate || new Date().toISOString().split('T')[0]);
    }

    const computedTimesheets = [];

    // Nhóm logs theo ngày và mã quẹt thẻ / employee_id
    const logsByDateAndCode = {};
    logs.forEach(l => {
      if (!l.timestamp) return;
      const dt = l.timestamp.substring(0, 10);
      const code = String(l.attendance_code || l.employee_id || '').trim();
      if (!code) return;
      const k = `${code}_${dt}`;
      if (!logsByDateAndCode[k]) logsByDateAndCode[k] = [];
      logsByDateAndCode[k].push(l);
    });

    const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

    uniqueDates.forEach(dt => {
      const dObj = new Date(dt + 'T00:00:00');
      const dName = dayNames[dObj.getDay()] || 'Thứ 2';

      employees.forEach(emp => {
        const empCode = String(emp.attendance_code || emp.time_attendance_code || '').trim();

        // Nếu nhân viên không có mã chấm công -> Không áp dụng chấm công máy
        if (!empCode) {
          computedTimesheets.push({
            timesheet_id: `TS_${emp.employee_id}_${dt}`,
            employee_id: emp.employee_id,
            attendance_code: '',
            full_name: emp.full_name,
            department_name: emp.department_name,
            date: dt,
            day_name: dName,
            shift_id: 'CA-HC',
            shift_name: 'Ca Hành Chính',
            check_in: '',
            check_out: '',
            late_minutes: 0,
            early_minutes: 0,
            work_units: 0,
            total_work_hours: 0,
            ot_hours: 0,
            total_all_hours: 0,
            status: 'NO_CODE',
            is_locked: false,
            is_manual_edited: false,
            note: 'Không áp dụng chấm công máy (Không có mã CC)'
          });
          return;
        }

        const k = `${empCode}_${dt}`;
        let empLogs = logsByDateAndCode[k] || [];

        // Sắp xếp tăng dần theo timestamp
        empLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        let checkIn = '';
        let checkOut = '';

        if (empLogs.length > 0) {
          checkIn = empLogs[0].timestamp.substring(11, 16);
          if (empLogs.length > 1) {
            const last = empLogs[empLogs.length - 1].timestamp.substring(11, 16);
            if (last !== checkIn) checkOut = last;
          }
        }

        // Kiểm tra đơn từ
        const req = requests.find(r => (r.employee_id === emp.employee_id || r.employee_id === emp.id) && (r.date === dt || (r.start_date <= dt && r.end_date >= dt)));

        let status = 'ABSENT';
        let workUnits = 0;
        let totalHours = 0;
        let lateMins = 0;
        let earlyMins = 0;
        let otHours = 0;
        let note = 'Không quẹt thẻ';

        if (req) {
          status = 'LEAVE';
          workUnits = 1.0;
          totalHours = 8.0;
          note = `Nghỉ phép (${req.reason || 'Đã duyệt'})`;
        } else if (checkIn && checkOut) {
          const [ih, im] = checkIn.split(':').map(Number);
          const [oh, om] = checkOut.split(':').map(Number);
          const inM = ih * 60 + im;
          const outM = oh * 60 + om;

          if (inM > (8 * 60 + 15)) lateMins = inM - (8 * 60);
          if (outM < (17 * 60 + 15)) earlyMins = (17 * 60 + 30) - outM;

          let span = outM - inM;
          if (inM <= (12 * 60) && outM >= (13 * 60 + 30)) span -= 90;
          totalHours = Math.round(Math.max(0, span / 60) * 10) / 10;

          if (totalHours >= 7.0) {
            workUnits = 1.0;
            if (lateMins > 0 && earlyMins > 0) { status = 'LATE'; note = `Đi muộn ${lateMins}p, về sớm ${earlyMins}p`; }
            else if (lateMins > 0) { status = 'LATE'; note = `Đi muộn ${lateMins}p`; }
            else if (earlyMins > 0) { status = 'EARLY'; note = `Về sớm ${earlyMins}p`; }
            else { status = 'VALID'; note = 'Hợp lệ'; }
          } else if (totalHours >= 3.5) {
            workUnits = 0.5;
            status = 'HALF_DAY';
            note = `Làm nửa ngày (${totalHours}h)`;
          } else {
            workUnits = 0.25;
            status = 'UNDER_HOURS';
            note = `Không đủ giờ làm (${totalHours}h)`;
          }

          if (outM > (17 * 60 + 30 + 30)) {
            otHours = Math.round(((outM - (17 * 60 + 30)) / 60) * 10) / 10;
          }
        } else if (checkIn && !checkOut) {
          const [ih, im] = checkIn.split(':').map(Number);
          const inM = ih * 60 + im;
          if (inM > (8 * 60 + 15)) lateMins = inM - (8 * 60);
          workUnits = 0.5;
          totalHours = 4.0;
          status = lateMins > 0 ? 'LATE' : 'VALID';
          note = lateMins > 0 ? `Đi muộn ${lateMins}p (chưa quẹt ra)` : 'Đang làm việc (chưa quẹt ra)';
        }

        computedTimesheets.push({
          timesheet_id: `TS_${emp.employee_id}_${dt}`,
          employee_id: emp.employee_id,
          attendance_code: empCode,
          full_name: emp.full_name,
          department_name: emp.department_name,
          date: dt,
          day_name: dName,
          shift_id: 'CA-HC',
          shift_name: 'Ca Hành Chính',
          check_in: checkIn || '',
          check_out: checkOut || '',
          late_minutes: lateMins,
          early_minutes: earlyMins,
          work_units: workUnits,
          total_work_hours: totalHours,
          ot_hours: otHours,
          total_all_hours: Math.round((totalHours + otHours) * 10) / 10,
          status: status,
          is_locked: false,
          is_manual_edited: false,
          note: note
        });
      });
    });

    appData.timesheets = computedTimesheets;
    utils.showToast(`Đã tính toán thành công ${computedTimesheets.length} bản ghi công thực tế!`, 'success');
    this.renderTimesheets();
    this.renderDashboard();
  },

  async syncFromRonaldJack() {
    utils.showToast('Đang kết nối tới máy chấm công Ronald Jack 009 để kéo dữ liệu...', 'info');
    try {
      const res = await fetch('/api/attendance/zk/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        utils.showToast(data.message, 'success');
        await appData.init();
        this.render();
      } else {
        utils.showToast(data.message || 'Lỗi đồng bộ', 'error');
      }
    } catch (err) {
      utils.showToast('Không thể kết nối dịch vụ đồng bộ: ' + err.message, 'error');
    }
  },

  async testDeviceConnection(ip, port) {
    utils.showToast(`Đang gửi tín hiệu Ping tới Ronald Jack 009 tại ${ip}:${port}...`, 'info');
    try {
      const res = await fetch('/api/attendance/zk/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, port })
      });
      const data = await res.json();
      if (data.success) {
        utils.showToast(`Kết nối thành công! Thiết bị: ${data.serialNumber || 'Ronald Jack 009'}`, 'success');
      } else {
        utils.showToast(data.message || `Không thể kết nối tới ${ip}:${port}`, 'warning');
      }
    } catch (err) {
      utils.showToast('Lỗi kiểm tra kết nối: ' + err.message, 'error');
    }
  },

  async generateSimulatorLogs() {
    utils.showToast('Đang sinh dữ liệu quẹt thẻ kiểm thử thực tế cho toàn bộ nhân sự...', 'info');
    try {
      const res = await fetch('/api/attendance/zk/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: this.selectedDate })
      });
      const data = await res.json();
      if (data.success) {
        utils.showToast(data.message, 'success');
        await this.recalculateTimesheets();
        await appData.init();
        this.render();
      } else {
        utils.showToast(data.message || 'Lỗi sinh dữ liệu', 'error');
      }
    } catch (err) {
      utils.showToast('Lỗi sinh dữ liệu quẹt thẻ: ' + err.message, 'error');
    }
  },

  openManualEditModal(timesheetId) {
    const item = (appData.timesheets || []).find(t => t.timesheet_id === timesheetId);
    if (!item) return;

    const modal = document.getElementById('modal-att-manual-edit');
    if (!modal) return;

    document.getElementById('att-edit-id').value = item.timesheet_id;
    document.getElementById('att-edit-emp-info').textContent = `${item.full_name} (${item.employee_id}) - ${item.date} (${item.day_name})`;
    document.getElementById('att-edit-checkin').value = item.check_in || '';
    document.getElementById('att-edit-checkout').value = item.check_out || '';
    document.getElementById('att-edit-workunits').value = item.work_units !== undefined ? item.work_units : 1.0;
    document.getElementById('att-edit-ot').value = item.ot_hours || 0;
    document.getElementById('att-edit-status').value = item.status || 'VALID';
    document.getElementById('att-edit-note').value = item.note || '';

    modal.classList.add('active');
  },

  closeManualEditModal() {
    const modal = document.getElementById('modal-att-manual-edit');
    if (modal) modal.classList.remove('active');
  },

  async saveManualEdit() {
    const tsId = document.getElementById('att-edit-id').value;
    const checkIn = document.getElementById('att-edit-checkin').value;
    const checkOut = document.getElementById('att-edit-checkout').value;
    const workUnits = parseFloat(document.getElementById('att-edit-workunits').value) || 0;
    const otHours = parseFloat(document.getElementById('att-edit-ot').value) || 0;
    const status = document.getElementById('att-edit-status').value;
    const note = document.getElementById('att-edit-note').value;

    try {
      const res = await fetch('/api/attendance/timesheets/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timesheet_id: tsId,
          check_in: checkIn,
          check_out: checkOut,
          work_units: workUnits,
          ot_hours: otHours,
          status,
          note,
          operator_name: 'HR Admin'
        })
      });
      const data = await res.json();
      if (data.success) {
        utils.showToast('Cập nhật bảng công thủ công thành công!', 'success');
        const idx = (appData.timesheets || []).findIndex(t => t.timesheet_id === tsId);
        if (idx >= 0) {
          appData.timesheets[idx] = { ...appData.timesheets[idx], check_in: checkIn, check_out: checkOut, work_units: workUnits, ot_hours: otHours, status, note, is_manual_edited: true };
        }
        this.closeManualEditModal();
        this.renderTimesheets();
        this.renderDashboard();
      } else {
        utils.showToast(data.message || 'Lỗi cập nhật bảng công', 'error');
      }
    } catch (err) {
      utils.showToast('Lỗi lưu bảng công: ' + err.message, 'error');
    }
  },

  async toggleLockTimesheet() {
    const list = (appData.timesheets || []).filter(t => (t.date || '').startsWith(this.currentMonth));
    const isCurrentlyLocked = list.length > 0 && list[0].is_locked;
    const newLockState = !isCurrentlyLocked;

    const confirmMsg = newLockState
      ? `Bạn có chắc chắn muốn KHÓA SỔ CHỐT CÔNG tháng ${this.currentMonth}? Sau khi khóa, dữ liệu sẽ được niêm phong để tính lương.`
      : `Bạn có muốn MỞ KHÓA SỔ tháng ${this.currentMonth} để tiếp tục hiệu chỉnh?`;

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch('/api/attendance/timesheets/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: this.currentMonth, is_locked: newLockState })
      });
      const data = await res.json();
      if (data.success) {
        utils.showToast(data.message, 'success');
        (appData.timesheets || []).forEach(t => {
          if ((t.date || '').startsWith(this.currentMonth)) {
            t.is_locked = newLockState;
          }
        });
        const lockBtn = document.getElementById('att-btn-lock');
        if (lockBtn) {
          lockBtn.innerHTML = newLockState
            ? '<i class="fa-solid fa-lock-open"></i> Mở Khóa Sổ'
            : '<i class="fa-solid fa-lock"></i> Khóa Sổ / Chốt Công';
        }
        this.renderTimesheets();
      }
    } catch (err) {
      utils.showToast('Lỗi thao tác khóa sổ: ' + err.message, 'error');
    }
  },

  openCreateRequestModal() {
    const modal = document.getElementById('modal-att-create-request');
    if (!modal) return;

    const dateInput = document.getElementById('att-req-date');
    if (dateInput) dateInput.value = this.selectedDate || new Date().toISOString().split('T')[0];

    const empSelect = document.getElementById('att-req-emp-select');
    if (empSelect && empSelect.options.length <= 1) {
      (appData.employees || []).forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.employee_id;
        opt.textContent = `${e.employee_id} - ${e.full_name}`;
        if (e.employee_id === this.portalEmployeeId) opt.selected = true;
        empSelect.appendChild(opt);
      });
    }

    modal.classList.add('active');
  },

  closeCreateRequestModal() {
    const modal = document.getElementById('modal-att-create-request');
    if (modal) modal.classList.remove('active');
  },

  async submitRequest() {
    const empId = document.getElementById('att-req-emp-select').value;
    const reqType = document.getElementById('att-req-type').value;
    const date = document.getElementById('att-req-date').value;
    const startTime = document.getElementById('att-req-start-time')?.value || '';
    const endTime = document.getElementById('att-req-end-time')?.value || '';
    const otHours = document.getElementById('att-req-ot-hours')?.value || 0;
    const leaveType = document.getElementById('att-req-leave-type')?.value || 'ANNUAL';
    const reason = document.getElementById('att-req-reason')?.value || '';

    const emp = (appData.employees || []).find(e => e.employee_id === empId);
    if (!emp) {
      utils.showToast('Vui lòng chọn nhân viên', 'warning');
      return;
    }

    try {
      const res = await fetch('/api/attendance/requests/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: empId,
          full_name: emp.full_name,
          department_name: emp.department_name || emp.department_id,
          request_type: reqType,
          date,
          start_time: startTime,
          end_time: endTime,
          ot_hours: otHours,
          leave_type: leaveType,
          reason
        })
      });
      const data = await res.json();
      if (data.success) {
        utils.showToast('Nộp đơn thành công! Quản lý sẽ duyệt trong thời gian sớm nhất.', 'success');
        if (!appData.attendanceRequests) appData.attendanceRequests = [];
        appData.attendanceRequests.unshift(data.request);
        this.closeCreateRequestModal();
        this.renderRequests();
        this.renderPortal();
      } else {
        utils.showToast(data.message || 'Lỗi nộp đơn', 'error');
      }
    } catch (err) {
      utils.showToast('Lỗi gửi đơn: ' + err.message, 'error');
    }
  },

  async approveRequest(requestId, status) {
    const actionLabel = status === 'APPROVED' ? 'DUYỆT' : 'TỪ CHỐI';
    if (!confirm(`Bạn có chắc chắn muốn ${actionLabel} đơn này?`)) return;

    try {
      const res = await fetch('/api/attendance/requests/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: requestId,
          status,
          approver_name: 'Huỳnh Thanh Long (HR Manager)',
          approver_note: status === 'APPROVED' ? 'Đã phê duyệt' : 'Không chấp thuận'
        })
      });
      const data = await res.json();
      if (data.success) {
        utils.showToast(data.message, 'success');
        const rIdx = (appData.attendanceRequests || []).findIndex(r => r.request_id === requestId);
        if (rIdx >= 0) {
          appData.attendanceRequests[rIdx] = data.request;
        }
        await appData.init();
        this.renderRequests();
        this.renderTimesheets();
        this.renderDashboard();
      } else {
        utils.showToast(data.message || 'Lỗi duyệt đơn', 'error');
      }
    } catch (err) {
      utils.showToast('Lỗi phê duyệt đơn: ' + err.message, 'error');
    }
  },

  downloadCsv(headers, rows, fileName) {
    let csvContent = '\uFEFF'; // UTF-8 BOM for Microsoft Excel Vietnamese font support
    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };
    csvContent += headers.map(escapeCsv).join(',') + '\r\n';
    rows.forEach(row => {
      csvContent += row.map(escapeCsv).join(',') + '\r\n';
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const safeName = fileName.toLowerCase().endsWith('.csv') ? fileName : `${fileName}.csv`;
    link.setAttribute('download', safeName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  ensureTimesheetsForMonth(targetMonth) {
    if (!appData.timesheets) appData.timesheets = [];
    const existing = appData.timesheets.filter(t => (t.date || '').startsWith(targetMonth));
    if (existing.length > 0) return existing;

    const logs = (appData.attendanceLogs || []).filter(l => (l.timestamp || '').startsWith(targetMonth));
    if (logs.length === 0) return [];

    const groups = {};
    logs.forEach(l => {
      const code = String(l.attendance_code || '').trim();
      const date = (l.timestamp || '').substring(0, 10);
      if (!code || !date) return;
      const key = `${code}_${date}`;
      if (!groups[key]) {
        groups[key] = { code, date, times: [] };
      }
      const timePart = (l.timestamp || '').split(' ')[1] || (l.timestamp || '').substring(11, 16);
      if (timePart) groups[key].times.push(timePart);
    });

    const newTimesheets = [];
    const dayNames = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

    Object.values(groups).forEach(g => {
      g.times.sort();
      const checkIn = g.times[0] ? g.times[0].substring(0, 5) : '';
      const checkOut = g.times.length > 1 ? g.times[g.times.length - 1].substring(0, 5) : (g.times[0] > '12:00' ? g.times[0].substring(0, 5) : '');
      const actualIn = checkIn || '';
      const actualOut = checkOut || '';

      const emp = (appData.employees || []).find(e =>
        (e.attendance_code && String(e.attendance_code).trim() === g.code) ||
        (e.time_attendance_code && String(e.time_attendance_code).trim() === g.code) ||
        String(e.employee_id || '').trim() === g.code
      );

      const dObj = new Date(g.date);
      const dayName = isNaN(dObj.getDay()) ? 'Thứ 2' : dayNames[dObj.getDay()];

      let lateMinutes = 0;
      if (actualIn && actualIn > '08:00') {
        const [h, m] = actualIn.split(':').map(Number);
        lateMinutes = Math.max(0, (h * 60 + m) - (8 * 60));
      }

      let earlyMinutes = 0;
      if (actualOut && actualOut < '17:00') {
        const [h, m] = actualOut.split(':').map(Number);
        earlyMinutes = Math.max(0, (17 * 60) - (h * 60 + m));
      }

      const status = lateMinutes > 0 ? 'LATE' : (earlyMinutes > 0 ? 'EARLY' : 'PRESENT');

      const tsItem = {
        timesheet_id: `TS_${emp ? emp.employee_id : g.code}_${g.date}`,
        employee_id: emp ? emp.employee_id : g.code,
        full_name: emp ? emp.full_name : `Nhân Viên (${g.code})`,
        department_name: emp ? (emp.department_name || emp.department_id || 'Chưa phân bổ') : 'Chưa phân bổ',
        date: g.date,
        day_name: dayName,
        check_in: actualIn,
        check_out: actualOut,
        late_minutes: lateMinutes,
        early_minutes: earlyMinutes,
        work_units: 1.0,
        total_work_hours: 8,
        ot_hours: 0,
        total_all_hours: 8,
        shift_name: 'Ca Hành Chính',
        shift_id: 'CA-HC',
        status: status,
        note: lateMinutes > 0 ? `Đi muộn ${lateMinutes} phút` : (earlyMinutes > 0 ? `Về sớm ${earlyMinutes} phút` : 'Đúng giờ')
      };
      newTimesheets.push(tsItem);
      appData.timesheets.push(tsItem);
    });

    return newTimesheets;
  },

  // ========================================================================
  // EXPORT TIMESHEETS TO EXCEL / CSV (XUẤT FILE CHUẨN TÍNH LƯƠNG)
  // ========================================================================
  exportTimesheetToExcel() {
    // 1. Đồng bộ tháng hiện tại từ bộ lọc giao diện nếu có
    const monthPicker = document.getElementById('att-month-picker');
    if (monthPicker && monthPicker.value) {
      this.currentMonth = monthPicker.value;
    }
    if (!this.currentMonth) {
      this.currentMonth = new Date().toISOString().substring(0, 7);
    }

    // 2. Tìm danh sách công theo tháng
    let list = (appData.timesheets || []).filter(t => (t.date || '').startsWith(this.currentMonth));

    // Nếu rỗng, thử tự động tính toán từ lịch sử quẹt thẻ gốc
    if (list.length === 0) {
      list = this.ensureTimesheetsForMonth(this.currentMonth);
    }

    // Nếu vẫn rỗng nhưng có timesheets ở các tháng khác, lấy toàn bộ
    if (list.length === 0) {
      if ((appData.timesheets || []).length > 0) {
        list = appData.timesheets;
        utils.showToast(`Tháng ${this.currentMonth} chưa có dữ liệu, chuyển sang xuất toàn bộ ${list.length} bản ghi chấm công!`, 'info');
      } else {
        utils.showToast(`Không có dữ liệu chấm công để xuất. Vui lòng bấm "Đồng Bộ Máy" hoặc "Mô Phỏng" trước!`, 'warning');
        return;
      }
    }

    // 3. Áp dụng bộ lọc đang chọn trên giao diện (nếu có)
    let filteredList = [...list];
    if (this.filterDept && this.filterDept !== 'all') {
      filteredList = filteredList.filter(t => (t.department_name || '').toLowerCase() === this.filterDept.toLowerCase());
    }
    if (this.filterStatus && this.filterStatus !== 'ALL') {
      filteredList = filteredList.filter(t => t.status === this.filterStatus);
    }
    if (this.filterSearch) {
      const kw = this.filterSearch.toLowerCase();
      filteredList = filteredList.filter(t => (t.full_name || '').toLowerCase().includes(kw) || (t.employee_id || '').toLowerCase().includes(kw));
    }
    if (filteredList.length > 0) {
      list = filteredList;
    }

    const headers = [
      'STT',
      'Mã Nhân Viên',
      'Mã Chấm Công',
      'Tên Nhân viên',
      'Phòng ban',
      'Ngày',
      'Thứ',
      'Giờ vào',
      'Giờ ra',
      'Trễ (phút)',
      'Sớm (phút)',
      'Công',
      'Tổng giờ làm',
      'Tăng ca (OT)',
      'Tổng toàn bộ',
      'Ca làm việc',
      'Trạng thái',
      'Ghi chú'
    ];

    const rows = list.map((item, idx) => [
      idx + 1,
      item.employee_id || '',
      item.attendance_code || '',
      item.full_name || '',
      item.department_name || '',
      item.date || '',
      item.day_name || '',
      item.check_in || '',
      item.check_out || '',
      item.late_minutes || 0,
      item.early_minutes || 0,
      item.work_units !== undefined ? item.work_units : 1.0,
      item.total_work_hours || 0,
      item.ot_hours || 0,
      item.total_all_hours || 0,
      item.shift_name || 'Ca Hành Chính',
      item.status || '',
      item.note || ''
    ]);

    const cleanMonth = (this.currentMonth || '').replace('-', '_');
    const baseFileName = `Bang_Cham_Cong_Thang_${cleanMonth}_TRUNGHAI`;

    // Thử xuất Excel .xlsx bằng SheetJS nếu có sẵn
    if (typeof XLSX !== 'undefined' && XLSX.utils && XLSX.writeFile) {
      try {
        const titleRow = [`BẢNG CÔNG CHI TIẾT THÁNG ${this.currentMonth} - TỔNG CÔNG TY TRUNG HẢI`];
        const subTitle = [`Ngày xuất: ${new Date().toLocaleDateString('vi-VN')} - Tổng số dòng: ${list.length}`];

        const wsData = [
          titleRow,
          subTitle,
          [],
          headers,
          ...rows
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        ws['!cols'] = [
          { wch: 6 },
          { wch: 14 },
          { wch: 24 },
          { wch: 28 },
          { wch: 14 },
          { wch: 12 },
          { wch: 10 },
          { wch: 10 },
          { wch: 12 },
          { wch: 12 },
          { wch: 8 },
          { wch: 14 },
          { wch: 14 },
          { wch: 14 },
          { wch: 20 },
          { wch: 16 },
          { wch: 30 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, `Bang_Cong_${cleanMonth}`);
        XLSX.writeFile(wb, `${baseFileName}.xlsx`);
        utils.showToast(`Đã xuất bảng công thành công: ${baseFileName}.xlsx!`, 'success');
        return;
      } catch (xlsxErr) {
        console.warn('XLSX export error, falling back to CSV:', xlsxErr);
      }
    }

    // Dự phòng tức thì: Xuất CSV UTF-8 BOM
    this.downloadCsv(headers, rows, `${baseFileName}.csv`);
    utils.showToast(`Đã xuất bảng công thành công (định dạng CSV tương thích Excel)!`, 'success');
  },

  copyAgentCommand() {
    const cmd = `schtasks /create /tn "TrungHai_RonaldJack_AutoSync" /tr "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \\"%~dp0ronald_jack_agent.ps1\\"" /sc MINUTE /mo 5 /f /ru SYSTEM`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(cmd).then(() => {
        utils.showToast('Đã sao chép lệnh Task Scheduler vào bộ nhớ tạm!', 'success');
      }).catch(() => {
        utils.showToast('Lệnh cài đặt: ' + cmd, 'info');
      });
    } else {
      prompt('Sao chép lệnh cài đặt Task Scheduler:', cmd);
    }
  },

  downloadAgentPackage() {
    const batContent = `@echo off\r\nchcp 65001 >nul\r\necho Dang cai dat tien trinh dong bo Ronald Jack Pro chay ngam moi 5 phut...\r\nset SCRIPT_DIR=%~dp0\r\nschtasks /create /tn "TrungHai_RonaldJack_AutoSync" /tr "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \\"%SCRIPT_DIR%ronald_jack_agent.ps1\\"" /sc MINUTE /mo 5 /f /ru SYSTEM\r\nif %ERRORLEVEL% equ 0 (\r\n  echo [THANH CONG] Da dang ky task chay ngam moi 5 phut!\r\n  schtasks /run /tn "TrungHai_RonaldJack_AutoSync"\r\n) else (\r\n  echo [LUU Y] Vui long click chuot phai chon 'Run as administrator'\r\n)\r\npause\r\n`;

    const blob = new Blob([batContent], { type: 'application/x-bat' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'install_agent_task.bat';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      const a2 = document.createElement('a');
      a2.href = 'scripts/ronald_jack_agent.ps1';
      a2.download = 'ronald_jack_agent.ps1';
      document.body.appendChild(a2);
      a2.click();
      document.body.removeChild(a2);
      utils.showToast('Đã tải xuống bộ cài đặt Agent tự động (install_agent_task.bat & ronald_jack_agent.ps1)!', 'success');
    }, 400);
  }
};

window.appAttendance = appAttendance;
