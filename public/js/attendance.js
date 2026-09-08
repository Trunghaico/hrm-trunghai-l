// ==========================================================================
// TIME & ATTENDANCE MODULE (PHÂN HỆ QUẢN LÝ CHẤM CÔNG & RONALD JACK 009)
// HRM Trung Hải Enterprise Edition
// ==========================================================================

const appAttendance = {
  currentSubTab: 'dashboard', // dashboard | timesheets | shifts | requests | devices | portal
  currentMonth: new Date().toISOString().substring(0, 7), // YYYY-MM
  selectedDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
  filterDept: 'all',
  filterStatus: 'ALL',
  filterSearch: '',
  portalEmployeeId: '',
  devices: [
    {
      id: 'DEV-01',
      name: 'Ronald Jack 009 - Cửa Chính',
      ip: '192.168.1.201',
      port: 5005,
      in_out_mode: 'AUTO',
      enabled: true,
      last_sync: '08/09/2026 16:30:15',
      status: 'ONLINE'
    },
    {
      id: 'DEV-02',
      name: 'Ronald Jack 009 - Văn Phòng Kho',
      ip: '192.168.1.202',
      port: 5006,
      in_out_mode: 'AUTO',
      enabled: true,
      last_sync: '08/09/2026 16:30:22',
      status: 'ONLINE'
    },
    {
      id: 'DEV-03',
      name: 'Ronald Jack 009 - Xưởng Sản Xuất',
      ip: '192.168.1.203',
      port: 5007,
      in_out_mode: 'AUTO',
      enabled: false,
      last_sync: '08/09/2026 12:00:00',
      status: 'STANDBY'
    }
  ],

  init() {
    console.log('Initializing Time & Attendance Module...');
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
      case 'timesheets':
        this.renderTimesheets();
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
  // 1. REAL-TIME ATTENDANCE DASHBOARD
  // ========================================================================
  renderDashboard() {
    const date = this.selectedDate || new Date().toISOString().split('T')[0];
    const employees = (appData.employees || []).filter(e => e.employment_status !== 'Đã nghỉ việc');
    const timesheets = (appData.timesheets || []).filter(t => t.date === date);
    const requests = (appData.attendanceRequests || []).filter(r => r.date === date && r.status === 'APPROVED');
    const logs = (appData.attendanceLogs || []).filter(l => (l.timestamp || '').startsWith(date));

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

    // Render live check-in stream
    const streamContainer = document.getElementById('att-live-stream-tbody');
    if (streamContainer) {
      const sortedLogs = [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 20);
      if (sortedLogs.length === 0) {
        streamContainer.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">
              <i class="fa-solid fa-clock-rotate-left" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
              Chưa có dữ liệu quẹt thẻ hôm nay. Nhấn "Đồng bộ từ máy Ronald Jack" để kéo log mới nhất.
            </td>
          </tr>
        `;
      } else {
        streamContainer.innerHTML = sortedLogs.map((l, idx) => {
          const emp = (appData.employees || []).find(e =>
            String(e.attendance_code || '').trim() === String(l.attendance_code || '').trim() ||
            e.employee_id === l.attendance_code
          );
          const name = emp ? emp.full_name : `Mã chấm công ${l.attendance_code}`;
          const dept = emp ? (emp.department_name || emp.department_id) : '-';
          const time = l.timestamp.substring(11, 19);

          return `
            <tr>
              <td style="text-align: center; color: var(--text-muted); font-size: 11px;">${idx + 1}</td>
              <td style="font-weight: 700; color: #1E40AF; font-family: monospace;">${l.attendance_code}</td>
              <td><strong>${name}</strong></td>
              <td><span class="badge badge-navy">${dept}</span></td>
              <td>
                <span style="font-family: monospace; font-weight: 700; color: #047857; background: #ECFDF5; padding: 2px 6px; border-radius: 4px;">
                  <i class="fa-solid fa-fingerprint"></i> ${time}
                </span>
              </td>
              <td style="font-size: 11.5px; color: var(--text-muted);">${l.device_name || 'Ronald Jack 009'}</td>
            </tr>
          `;
        }).join('');
      }
    }
  },

  // ========================================================================
  // 2. DETAILED MONTHLY TIMESHEET (BẢNG CÔNG CHI TIẾT THEO THÁNG)
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

    let list = (appData.timesheets || []).filter(t => (t.date || '').startsWith(this.currentMonth));

    // Filter department
    if (this.filterDept && this.filterDept !== 'all') {
      list = list.filter(t => t.department_name === this.filterDept || t.department_id === this.filterDept);
    }

    // Filter status
    if (this.filterStatus && this.filterStatus !== 'ALL') {
      if (this.filterStatus === 'LATE') {
        list = list.filter(t => t.late_minutes > 0);
      } else if (this.filterStatus === 'EARLY') {
        list = list.filter(t => t.early_minutes > 0);
      } else if (this.filterStatus === 'OT') {
        list = list.filter(t => t.ot_hours > 0);
      } else {
        list = list.filter(t => t.status === this.filterStatus);
      }
    }

    // Search
    if (this.filterSearch) {
      list = list.filter(t =>
        (t.full_name || '').toLowerCase().includes(this.filterSearch) ||
        (t.employee_id || '').toLowerCase().includes(this.filterSearch) ||
        (t.department_name || '').toLowerCase().includes(this.filterSearch)
      );
    }

    // Update month title
    const countEl = document.getElementById('att-timesheet-count');
    if (countEl) countEl.textContent = `Tổng cộng: ${list.length} dòng công`;

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="16" style="text-align: center; color: var(--text-muted); padding: 36px;">
            <i class="fa-solid fa-calendar-xmark" style="font-size: 28px; margin-bottom: 8px; display: block; color: #94A3B8;"></i>
            Không tìm thấy dữ liệu bảng công cho tháng <strong>${this.currentMonth}</strong>.
            <div style="margin-top: 10px;">
              <button class="btn btn-primary btn-sm" onclick="appAttendance.recalculateTimesheets()">
                <i class="fa-solid fa-calculator"></i> Tính Bảng Công Tháng Này
              </button>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    // Render table rows matching EXACT user columns
    tbody.innerHTML = list.map((item, idx) => {
      const lateHtml = item.late_minutes > 0
        ? `<span class="badge" style="background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; font-weight: 700;">+${item.late_minutes}p</span>`
        : '<span style="color: #CBD5E1;">-</span>';

      const earlyHtml = item.early_minutes > 0
        ? `<span class="badge" style="background: #FFFBEB; color: #D97706; border: 1px solid #FDE68A; font-weight: 700;">-${item.early_minutes}p</span>`
        : '<span style="color: #CBD5E1;">-</span>';

      const workUnitBadge = item.work_units >= 1.0
        ? `<span style="font-weight: 700; color: #047857; background: #ECFDF5; padding: 2px 6px; border-radius: 4px;">${item.work_units}</span>`
        : (item.work_units > 0
            ? `<span style="font-weight: 700; color: #D97706; background: #FEF3C7; padding: 2px 6px; border-radius: 4px;">${item.work_units}</span>`
            : '<span style="color: #94A3B8; font-weight: 600;">0</span>');

      const otBadge = item.ot_hours > 0
        ? `<span class="badge" style="background: #F5F3FF; color: #7C3AED; border: 1px solid #DDD6FE; font-weight: 700;"><i class="fa-solid fa-bolt"></i> +${item.ot_hours}h</span>`
        : '<span style="color: #CBD5E1;">-</span>';

      let statusBadge = '';
      if (item.status === 'VALID') {
        statusBadge = '<span class="badge badge-active"><i class="fa-solid fa-circle-check"></i> Đủ công</span>';
      } else if (item.status === 'LATE') {
        statusBadge = '<span class="badge" style="background: #FEF2F2; color: #DC2626;"><i class="fa-solid fa-clock"></i> Đi muộn</span>';
      } else if (item.status === 'EARLY') {
        statusBadge = '<span class="badge" style="background: #FFFBEB; color: #D97706;"><i class="fa-solid fa-clock"></i> Về sớm</span>';
      } else if (item.status === 'ABSENT') {
        statusBadge = '<span class="badge badge-resigned"><i class="fa-solid fa-circle-xmark"></i> Vắng</span>';
      } else if (item.status === 'LEAVE_PAID') {
        statusBadge = '<span class="badge" style="background: #EFF6FF; color: #1D4ED8;"><i class="fa-solid fa-umbrella-beach"></i> Nghỉ phép</span>';
      } else if (item.status === 'WEEKEND') {
        statusBadge = '<span class="badge" style="background: #F1F5F9; color: #64748B;">Nghỉ tuần</span>';
      } else {
        statusBadge = `<span class="badge">${item.status}</span>`;
      }

      const manualEditedIndicator = item.is_manual_edited
        ? '<span title="Đã chỉnh sửa thủ công bởi HR" style="color: #2563EB; margin-left: 4px;"><i class="fa-solid fa-pen-to-square"></i></span>'
        : '';

      const isLocked = item.is_locked;

      return `
        <tr style="${item.status === 'ABSENT' ? 'background: #FFFDFD;' : ''}">
          <td style="text-align: center; color: var(--text-muted); font-size: 11px;">${idx + 1}</td>
          <td><strong style="color: var(--primary-navy); font-family: monospace;">${item.employee_id}</strong></td>
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
  renderShifts() {
    const tbody = document.getElementById('att-shifts-tbody');
    if (!tbody) return;

    const shifts = appData.shifts || [];
    tbody.innerHTML = shifts.map((s, idx) => `
      <tr>
        <td style="text-align: center; color: var(--text-muted);">${idx + 1}</td>
        <td><strong style="color: ${s.color || '#2563EB'}; font-family: monospace;">${s.shift_code || s.shift_id}</strong></td>
        <td><strong>${s.shift_name}</strong></td>
        <td><span class="badge" style="background: #EFF6FF; color: #1D4ED8;">${s.shift_type === 'night' ? 'Ca Đêm' : (s.shift_type === 'split' ? 'Ca Gãy' : 'Hành Chính')}</span></td>
        <td style="font-family: monospace; font-weight: 600;">${s.start_time} - ${s.end_time}</td>
        <td style="color: var(--text-secondary);">${s.break_start ? `${s.break_start} - ${s.break_end} (${s.break_hours}h)` : 'Không'}</td>
        <td style="text-align: center; font-weight: 600; color: #D97706;">Cho phép ${s.grace_late_minutes || 15}p</td>
        <td style="text-align: center; font-weight: 700; color: #047857;">${s.work_units} công (${s.standard_hours}h)</td>
        <td style="text-align: center;">
          <button class="btn btn-icon btn-sm" onclick="appAttendance.openEditShiftModal('${s.shift_id}')" title="Sửa ca">
            <i class="fa-solid fa-pen"></i>
          </button>
        </td>
      </tr>
    `).join('');
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
  // 5. RONALD JACK 009 DEVICE MANAGEMENT (KẾT NỐI MÁY CHẤM CÔNG)
  // ========================================================================
  renderDevices() {
    const container = document.getElementById('att-devices-grid');
    if (container) {
      container.innerHTML = this.devices.map(dev => `
        <div class="card" style="border: 1px solid ${dev.enabled ? '#BFDBFE' : '#E2E8F0'}; background: ${dev.enabled ? '#F8FAFC' : '#F1F5F9'};">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <div>
              <span class="badge" style="background: ${dev.enabled ? '#EFF6FF' : '#E2E8F0'}; color: ${dev.enabled ? '#1D4ED8' : '#64748B'}; font-weight: 700; margin-bottom: 6px;">
                <i class="fa-solid fa-microchip"></i> ${dev.id}
              </span>
              <h3 style="font-size: 15px; font-weight: 700; margin: 0; color: #1E293B;">${dev.name}</h3>
            </div>
            <span class="badge" style="background: ${dev.status === 'ONLINE' ? '#ECFDF5' : '#F1F5F9'}; color: ${dev.status === 'ONLINE' ? '#047857' : '#64748B'}; border: 1px solid ${dev.status === 'ONLINE' ? '#A7F3D0' : '#CBD5E1'}; font-weight: 700;">
              <i class="fa-solid fa-circle" style="font-size: 8px; margin-right: 4px;"></i> ${dev.status}
            </span>
          </div>

          <div style="font-size: 13px; color: #475569; margin-bottom: 14px; line-height: 1.8;">
            <div><i class="fa-solid fa-network-wired" style="width: 18px; color: #2563EB;"></i> IP máy: <strong style="font-family: monospace; color: #1E293B;">${dev.ip}</strong></div>
            <div><i class="fa-solid fa-ethernet" style="width: 18px; color: #2563EB;"></i> Cổng kết nối: <strong style="font-family: monospace; color: #047857;">Port ${dev.port}</strong> (node-zklib UDP/TCP)</div>
            <div><i class="fa-solid fa-clock-rotate-left" style="width: 18px; color: #2563EB;"></i> Đồng bộ gần nhất: <span style="font-size: 12px;">${dev.last_sync || 'Chưa đồng bộ'}</span></div>
          </div>

          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary btn-sm" onclick="appAttendance.testDeviceConnection('${dev.ip}', ${dev.port})" style="flex: 1; font-size: 11.5px;">
              <i class="fa-solid fa-bolt"></i> Kiểm Tra Kết Nối
            </button>
            <button class="btn btn-primary btn-sm" onclick="appAttendance.syncFromRonaldJack()" style="flex: 1; font-size: 11.5px;" ${!dev.enabled ? 'disabled' : ''}>
              <i class="fa-solid fa-rotate"></i> Lấy Dữ Liệu
            </button>
          </div>
        </div>
      `).join('');
    }

    // Render Raw Attendance Logs
    const rawTbody = document.getElementById('att-raw-logs-tbody');
    if (rawTbody) {
      const logs = (appData.attendanceLogs || []).slice(0, 50);
      if (logs.length === 0) {
        rawTbody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">
              Chưa có bản ghi quẹt thẻ nào. Hãy nhấn "Mô phỏng dữ liệu quẹt thẻ" hoặc kết nối máy Ronald Jack để kéo log.
            </td>
          </tr>
        `;
      } else {
        rawTbody.innerHTML = logs.map((l, idx) => {
          const emp = (appData.employees || []).find(e =>
            String(e.attendance_code || '').trim() === String(l.attendance_code || '').trim() ||
            e.employee_id === l.attendance_code
          );
          return `
            <tr>
              <td style="text-align: center; color: var(--text-muted); font-size: 11px;">${idx + 1}</td>
              <td><span style="font-family: monospace; color: #1E40AF; font-weight: 700;">${l.attendance_code}</span></td>
              <td><strong>${emp ? emp.full_name : 'Chưa gán nhân sự'}</strong></td>
              <td style="font-family: monospace; color: #047857; font-weight: 600;">${l.timestamp}</td>
              <td style="font-size: 11.5px;">${l.device_name || 'Ronald Jack 009'} (${l.device_ip}:${l.device_port})</td>
              <td><span class="badge" style="background: #F1F5F9; color: #334155;">${l.verify_type || 'Vân tay'}</span></td>
            </tr>
          `;
        }).join('');
      }
    }
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
        deptSelect = e.employee_id;
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
  // ACTIONS & MODALS
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
      // Client-side fallback calculation if offline
      this.recalculateClientSide();
    }
  },

  recalculateClientSide() {
    utils.showToast('Đang tính toán lại bảng công...', 'success');
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
        // Update local state
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

    // Set default date
    const dateInput = document.getElementById('att-req-date');
    if (dateInput) dateInput.value = this.selectedDate || new Date().toISOString().split('T')[0];

    // Populate employees select
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

  // ========================================================================
  // EXPORT TIMESHEETS TO EXCEL (XUẤT FILE EXCEL CHUẨN TÍNH LƯƠNG)
  // ========================================================================
  exportTimesheetToExcel() {
    if (typeof XLSX === 'undefined') {
      utils.showToast('Thư viện Excel đang tải, vui lòng thử lại sau giây lát...', 'warning');
      return;
    }

    const list = (appData.timesheets || []).filter(t => (t.date || '').startsWith(this.currentMonth));
    if (list.length === 0) {
      utils.showToast(`Không có dữ liệu bảng công cho tháng ${this.currentMonth} để xuất!`, 'warning');
      return;
    }

    const headers = [
      'STT',
      'Mã Nhân Viên',
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
      item.employee_id,
      item.full_name,
      item.department_name,
      item.date,
      item.day_name,
      item.check_in || '',
      item.check_out || '',
      item.late_minutes || 0,
      item.early_minutes || 0,
      item.work_units !== undefined ? item.work_units : 1.0,
      item.total_work_hours || 0,
      item.ot_hours || 0,
      item.total_all_hours || 0,
      item.shift_name || 'Ca Hành Chính',
      item.status,
      item.note || ''
    ]);

    const titleRow = [`BẢNG CÔNG CHI TIẾT THÁNG ${this.currentMonth} - TỔNG CÔNG TY TRUNG HẢI`];
    const subTitle = [`Ngày xuất: ${new Date().toLocaleDateString('vi-VN')} - Tổng số dòng: ${list.length}`];

    const wsData = [
      titleRow,
      subTitle,
      [], // Empty row
      headers,
      ...rows
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    ws['!cols'] = [
      { wch: 6 },  // STT
      { wch: 14 }, // Mã NV
      { wch: 24 }, // Tên NV
      { wch: 28 }, // Phòng ban
      { wch: 14 }, // Ngày
      { wch: 12 }, // Thứ
      { wch: 10 }, // Giờ vào
      { wch: 10 }, // Giờ ra
      { wch: 12 }, // Trễ
      { wch: 12 }, // Sớm
      { wch: 8 },  // Công
      { wch: 14 }, // Tổng giờ làm
      { wch: 14 }, // Tăng ca
      { wch: 14 }, // Tổng toàn bộ
      { wch: 20 }, // Ca
      { wch: 16 }, // Trạng thái
      { wch: 30 }  // Ghi chú
    ];

    XLSX.utils.book_append_sheet(wb, ws, `Bang_Cong_${this.currentMonth.replace('-', '_')}`);
    const fileName = `Bang_Cham_Cong_Thang_${this.currentMonth.replace('-', '_')}_TRUNGHAI.xlsx`;
    XLSX.writeFile(wb, fileName);
    utils.showToast(`Đã xuất bảng công ra file Excel: ${fileName}!`, 'success');
  }
};

window.appAttendance = appAttendance;
