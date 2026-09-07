// ==========================================================================
// EMPLOYEE MANAGEMENT MODULE
// ==========================================================================

const appEmployees = {
  initialized: false,
  currentPage: 1,
  pageSize: 25,
  filteredList: [],
  selectedEmployee: null,
  selectionMode: false,
  selectedEmpIds: new Set(),

  init() {
    this.populateFilterDropdowns();
    if (typeof buildDetailModalTabsHtml === 'function') {
      buildDetailModalTabsHtml();
    }
    if (typeof buildFormModalTabsHtml === 'function') {
      buildFormModalTabsHtml();
    }
    if (typeof initModalTabSwitching === 'function') {
      initModalTabSwitching();
    }
    if (!this.initialized) {
      this.attachEventListeners();
      this.initialized = true;
    }
    this.applyFilters();
  },

  populateFilterDropdowns() {
    // Dept filter for table
    const deptSelect = document.getElementById('emp-filter-dept');
    if (deptSelect) {
      const opts = appData.departments.map(d => `<option value="${d.department_id}">${d.department_name}</option>`).join('');
      deptSelect.innerHTML = `<option value="">-- Tất cả Đơn vị / Phòng ban --</option>` + opts;
    }

    // Pos filter for table
    const posSelect = document.getElementById('emp-filter-pos');
    if (posSelect) {
      const opts = appData.positions.map(p => `<option value="${p.position_id}">${p.position_name}</option>`).join('');
      posSelect.innerHTML = `<option value="">-- Tất cả Vị trí --</option>` + opts;
    }

    // Direct manager dropdown for form
    const formMgrSelect = document.getElementById('form-direct-mgr');
    if (formMgrSelect) {
      const activeEmps = appData.employees.filter(e => e.employment_status === 'Đang làm việc');
      const opts = activeEmps.map(e => `<option value="${e.employee_id}">${e.full_name} (${e.employee_id})</option>`).join('');
      formMgrSelect.innerHTML = `<option value="">-- Không có / Tự quản lý --</option>` + opts;
    }

    // Initialize cascading Company -> Department -> Position in Employee Form
    this.populateCompanyDeptPosDropdowns();
  },

  populateCompanyDeptPosDropdowns(selectedCompId = '', selectedDeptId = '', selectedPosId = '') {
    const formCompSelect = document.getElementById('form-company-id');
    const formDeptSelect = document.getElementById('form-dept-id');
    const formPosSelect = document.getElementById('form-pos-id');
    if (!formCompSelect || !formDeptSelect || !formPosSelect) return;

    // 1. Populate Companies
    const companies = appData.companies || [];
    let compOpts = `<option value="">-- Chọn Công Ty Trực Thuộc --</option>`;
    companies.forEach(c => {
      compOpts += `<option value="${c.company_id}" ${c.company_id === selectedCompId ? 'selected' : ''}>${c.company_name} (${c.company_id})</option>`;
    });
    formCompSelect.innerHTML = compOpts;
    if (selectedCompId) formCompSelect.value = selectedCompId;

    // 2. Populate Departments (filtered by selected company if chosen)
    const departments = appData.departments || [];
    let filteredDepts = selectedCompId 
      ? departments.filter(d => {
          if (d.company_id === selectedCompId) return true;
          // Fallback prefix / suffix match (e.g. TP-KT matches TP, BGD.PM matches PM)
          if (d.department_id && (d.department_id.startsWith(selectedCompId + '-') || d.department_id.startsWith(selectedCompId + '_') || d.department_id.endsWith('.' + selectedCompId))) return true;
          return false;
        })
      : [...departments];

    // Ensure selectedDeptId is included if it exists in master departments so it is never dropped
    if (selectedDeptId && !filteredDepts.some(d => d.department_id === selectedDeptId)) {
      const matchDept = departments.find(d => d.department_id === selectedDeptId);
      if (matchDept) {
        filteredDepts.unshift(matchDept);
      }
    }

    // Auto-select if there's only 1 department in this company and none explicitly chosen
    let activeDeptId = selectedDeptId;
    if (!activeDeptId && selectedCompId && filteredDepts.length === 1) {
      activeDeptId = filteredDepts[0].department_id;
    }

    let deptOpts = `<option value="">-- Chọn Phòng Ban --</option>`;
    filteredDepts.forEach(d => {
      const compLabel = (!selectedCompId && appData.companyMap[d.company_id]) ? ` [${appData.companyMap[d.company_id]}]` : '';
      deptOpts += `<option value="${d.department_id}" ${d.department_id === activeDeptId ? 'selected' : ''}>${d.department_name}${compLabel}</option>`;
    });
    formDeptSelect.innerHTML = deptOpts;
    if (activeDeptId) formDeptSelect.value = activeDeptId;

    // 3. Populate Positions (Danh mục chức danh độc lập, không phụ thuộc phòng ban và công ty)
    const positions = appData.positions || [];
    let activePosId = selectedPosId;

    let posOpts = `<option value="">-- Chọn Vị Trí Công Việc --</option>`;
    positions.forEach(p => {
      posOpts += `<option value="${p.position_id}" ${p.position_id === activePosId ? 'selected' : ''}>${p.position_name} (${p.position_id})</option>`;
    });
    if (activePosId && !positions.some(p => p.position_id === activePosId)) {
      posOpts += `<option value="${activePosId}" selected>${activePosId}</option>`;
    }
    formPosSelect.innerHTML = posOpts;
    if (activePosId) formPosSelect.value = activePosId;

    // Auto fill Job Title
    if (activePosId) {
      const posObj = positions.find(p => p.position_id === activePosId);
      const titleInput = document.getElementById('form-job-title');
      if (titleInput && (!titleInput.value.trim() || titleInput.dataset.autofilled === '1') && posObj) {
        titleInput.value = posObj.position_name;
        titleInput.dataset.autofilled = '1';
      }
    }
  },

  attachEventListeners() {
    // Search input
    const searchInput = document.getElementById('emp-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.currentPage = 1;
        this.applyFilters();
      });
    }

    // Filters
    ['emp-filter-dept', 'emp-filter-pos', 'emp-filter-status', 'emp-filter-nature'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => {
          this.currentPage = 1;
          this.applyFilters();
        });
      }
    });

    // Reset filters
    const resetBtn = document.getElementById('btn-reset-filters');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        document.getElementById('emp-search-input').value = '';
        document.getElementById('emp-filter-dept').value = '';
        document.getElementById('emp-filter-pos').value = '';
        document.getElementById('emp-filter-status').value = '';
        document.getElementById('emp-filter-nature').value = '';
        this.currentPage = 1;
        this.applyFilters();
      });
    }

    // Detail Modal Tabs Navigation
    document.querySelectorAll('#modal-employee-detail .modal-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetTab = e.currentTarget.getAttribute('data-tab');
        document.querySelectorAll('#modal-employee-detail .modal-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('#modal-employee-detail .tab-pane').forEach(p => p.classList.remove('active'));
        
        e.currentTarget.classList.add('active');
        const pane = document.getElementById(targetTab);
        if (pane) pane.classList.add('active');
      });
    });

    // Form Modal Tabs Navigation
    document.querySelectorAll('.form-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetTab = e.currentTarget.getAttribute('data-tab');
        document.querySelectorAll('.form-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.form-tab-pane').forEach(p => {
          p.classList.remove('active');
          p.style.display = 'none';
        });
        
        e.currentTarget.classList.add('active');
        const pane = document.getElementById(targetTab);
        if (pane) {
          pane.classList.add('active');
          pane.style.display = 'block';
        }
      });
    });

    // Add Employee Button
    const addBtn = document.getElementById('btn-open-add-modal');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.openAddModal());
    }

    // Form Submit
    const form = document.getElementById('employee-crud-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleFormSubmit(e));
    }

    // Edit from Detail
    const editFromDetBtn = document.getElementById('btn-edit-from-detail');
    if (editFromDetBtn) {
      editFromDetBtn.addEventListener('click', () => {
        if (this.selectedEmployee) {
          this.closeDetailModal();
          this.openEditModal(this.selectedEmployee.employee_id);
        }
      });
    }

    // Page size filter
    const pageSizeSelect = document.getElementById('emp-page-size');
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', (e) => {
        this.pageSize = parseInt(e.target.value, 10) || 25;
        this.currentPage = 1;
        this.renderTable();
        this.renderPagination();
      });
    }

    // Export Filtered
    const exportFilteredBtn = document.getElementById('btn-export-filtered-emp');
    if (exportFilteredBtn) {
      exportFilteredBtn.addEventListener('click', () => this.exportFilteredExcel());
    }

    // Quick Action Dropdown Menu Button
    const actionMenuBtn = document.getElementById('btn-emp-action-menu');
    if (actionMenuBtn) {
      actionMenuBtn.addEventListener('click', (e) => this.toggleActionDropdown(e));
    }

    // Quick Action: Hiện ô tích / Ẩn ô tích
    const toggleCbBtn = document.getElementById('btn-action-toggle-cb');
    if (toggleCbBtn) {
      toggleCbBtn.addEventListener('click', () => this.toggleSelectionMode());
    }

    // Quick Action: Chọn tất cả trang này
    const selectPageBtn = document.getElementById('btn-action-select-page');
    if (selectPageBtn) {
      selectPageBtn.addEventListener('click', () => this.selectAllCurrentPage());
    }

    // Quick Action: Chọn tất cả danh sách lọc
    const selectFilteredBtn = document.getElementById('btn-action-select-filtered');
    if (selectFilteredBtn) {
      selectFilteredBtn.addEventListener('click', () => this.selectAllFiltered());
    }

    // Quick Action: Xóa các nhân sự đã chọn
    const deleteSelectedBtn = document.getElementById('btn-action-delete-selected');
    if (deleteSelectedBtn) {
      deleteSelectedBtn.addEventListener('click', () => this.deleteSelectedEmployees());
    }

    // Header Select-all checkbox
    const selectAllCheck = document.getElementById('emp-select-all');
    if (selectAllCheck) {
      selectAllCheck.addEventListener('change', (e) => this.toggleSelectAllCurrentPage(e.target.checked));
    }

    // Close action dropdown on outside click, scroll or resize
    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('emp-action-dropdown');
      const actionBtn = document.getElementById('btn-emp-action-menu');
      if (dropdown && dropdown.classList.contains('show')) {
        if (!dropdown.contains(e.target) && !actionBtn?.contains(e.target)) {
          this.closeActionDropdown();
        }
      }
    });

    window.addEventListener('scroll', () => {
      const dropdown = document.getElementById('emp-action-dropdown');
      if (dropdown && dropdown.classList.contains('show')) {
        this.closeActionDropdown();
      }
    }, true);

    window.addEventListener('resize', () => {
      const dropdown = document.getElementById('emp-action-dropdown');
      if (dropdown && dropdown.classList.contains('show')) {
        this.closeActionDropdown();
      }
    });

    // Delete All Employees (fallback legacy)
    const deleteAllBtn = document.getElementById('btn-delete-all-emp');
    if (deleteAllBtn) {
      deleteAllBtn.addEventListener('click', () => this.openDeleteAllModal());
    }

    // Delete All Confirmation Input Listener
    const deleteAllInput = document.getElementById('delete-all-confirm-input');
    if (deleteAllInput) {
      deleteAllInput.addEventListener('input', (e) => {
        const val = (e.target.value || '').trim().toUpperCase();
        const confirmBtn = document.getElementById('btn-confirm-delete-all-action');
        if (confirmBtn) {
          const isValid = val === 'XOA TOAN BO';
          confirmBtn.disabled = !isValid;
          confirmBtn.style.opacity = isValid ? '1' : '0.5';
          confirmBtn.style.cursor = isValid ? 'pointer' : 'not-allowed';
        }
      });
    }

    // Delete All Action Confirm Button
    const confirmDeleteAllBtn = document.getElementById('btn-confirm-delete-all-action');
    if (confirmDeleteAllBtn) {
      confirmDeleteAllBtn.addEventListener('click', () => this.confirmDeleteAll());
    }

    // Cascading Company -> Department -> Position in Employee Form
    const formCompSelect = document.getElementById('form-company-id');
    const formDeptSelect = document.getElementById('form-dept-id');
    const formPosSelect = document.getElementById('form-pos-id');

    if (formCompSelect) {
      formCompSelect.addEventListener('change', (e) => {
        const compId = e.target.value;
        const currentDeptId = formDeptSelect ? formDeptSelect.value : '';
        const currentPosId = formPosSelect ? formPosSelect.value : '';
        
        // Keep department if it belongs to selected company, otherwise reset
        const dept = (appData.departments || []).find(d => d.department_id === currentDeptId);
        const keepDept = dept && (dept.company_id === compId || !compId);
        
        this.populateCompanyDeptPosDropdowns(compId, keepDept ? currentDeptId : '', currentPosId);
      });
    }

    if (formDeptSelect) {
      formDeptSelect.addEventListener('change', (e) => {
        const deptId = e.target.value;
        const dept = (appData.departments || []).find(d => d.department_id === deptId);
        const currentCompId = formCompSelect ? formCompSelect.value : '';
        const compId = dept?.company_id || currentCompId || (appData.companies && appData.companies[0]?.company_id) || 'THG';
        const currentPosId = formPosSelect ? formPosSelect.value : '';

        // Sync company if department belongs to a company, and PRESERVE current position
        this.populateCompanyDeptPosDropdowns(compId, deptId, currentPosId);
      });
    }

    if (formPosSelect) {
      formPosSelect.addEventListener('change', (e) => {
        const posId = e.target.value;
        const pos = (appData.positions || []).find(p => p.position_id === posId);
        if (pos) {
          // 1. Auto fill Job Title
          const titleInput = document.getElementById('form-job-title');
          if (titleInput) {
            titleInput.value = pos.position_name;
            titleInput.dataset.autofilled = '1';
          }

          // 2. IMPORTANT: NEVER clear or overwrite an already selected department!
          // Only if department has NOT been chosen yet AND position defines a department:
          const currentDeptId = formDeptSelect ? formDeptSelect.value : '';
          if (!currentDeptId && pos.department_id) {
            const dept = (appData.departments || []).find(d => d.department_id === pos.department_id);
            const currentCompId = (formCompSelect && formCompSelect.value) || (dept ? dept.company_id : '') || 'THG';
            this.populateCompanyDeptPosDropdowns(currentCompId, pos.department_id, posId);
          }
        }
      });
    }

    const titleInput = document.getElementById('form-job-title');
    if (titleInput) {
      titleInput.addEventListener('input', () => {
        titleInput.dataset.autofilled = '0';
      });
    }
  },

  applyFilters() {
    const searchVal = (document.getElementById('emp-search-input')?.value || '').toLowerCase().trim();
    const deptVal = document.getElementById('emp-filter-dept')?.value || '';
    const posVal = document.getElementById('emp-filter-pos')?.value || '';
    const statusVal = document.getElementById('emp-filter-status')?.value || '';
    const natureVal = document.getElementById('emp-filter-nature')?.value || '';

    const contactMap = {};
    appData.contacts.forEach(c => contactMap[c.employee_id] = c);
    const idMap = {};
    appData.identity.forEach(i => idMap[i.employee_id] = i);

    this.filteredList = appData.employees.filter(e => {
      if (deptVal && e.department_id !== deptVal) return false;
      if (posVal && e.position_id !== posVal) return false;
      if (statusVal && e.employment_status !== statusVal) return false;
      if (natureVal && e.labor_nature !== natureVal) return false;

      if (searchVal) {
        const c = contactMap[e.employee_id] || {};
        const idDoc = idMap[e.employee_id] || {};
        const dName = (appData.deptMap[e.department_id] || '').toLowerCase();
        const pName = (appData.posMap[e.position_id] || '').toLowerCase();

        const match = (
          (e.employee_id || '').toLowerCase().includes(searchVal) ||
          (e.full_name || '').toLowerCase().includes(searchVal) ||
          (c.mobile_phone || '').includes(searchVal) ||
          (c.work_email || '').toLowerCase().includes(searchVal) ||
          (idDoc.id_number || '').includes(searchVal) ||
          dName.includes(searchVal) ||
          pName.includes(searchVal)
        );
        if (!match) return false;
      }

      return true;
    });

    // Mặc định sắp xếp theo mã nhân viên (A-Z tự nhiên)
    this.filteredList.sort((a, b) => (a.employee_id || '').localeCompare(b.employee_id || '', undefined, { numeric: true, sensitivity: 'base' }));

    this.renderTable();
    this.renderPagination();
  },

  renderTable() {
    const tbody = document.getElementById('employees-tbody');
    if (!tbody) return;

    if (this.filteredList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; padding: 32px; color: var(--text-muted);">
        <i class="fa-solid fa-folder-open" style="font-size: 32px; margin-bottom: 8px; display: block;"></i>
        Không tìm thấy nhân sự phù hợp với điều kiện lọc.
      </td></tr>`;
      return;
    }

    const start = (this.currentPage - 1) * this.pageSize;
    const paginated = this.filteredList.slice(start, start + this.pageSize);

    const contactMap = {};
    appData.contacts.forEach(c => contactMap[c.employee_id] = c);

    tbody.innerHTML = paginated.map((e, index) => {
      const stt = start + index + 1;
      const c = contactMap[e.employee_id] || {};
      const isChecked = this.selectedEmpIds.has(e.employee_id);
      const rowSelectedClass = isChecked ? 'row-selected' : '';

      const statusBadge = e.employment_status === 'Đang làm việc'
        ? '<span class="badge badge-active"><i class="fa-solid fa-check"></i> Đang làm việc</span>'
        : '<span class="badge badge-resigned"><i class="fa-solid fa-xmark"></i> Đã nghỉ việc</span>';

      const natureBadge = e.labor_nature === 'Chính thức'
        ? '<span class="badge badge-navy">Chính thức</span>'
        : e.labor_nature === 'Thử việc'
        ? '<span class="badge badge-probation">Thử việc</span>'
        : `<span class="badge" style="background:#F1F5F9; color:#475569;">${e.labor_nature || '-'}</span>`;

      return `
        <tr class="${rowSelectedClass}" data-emp-id="${e.employee_id}">
          <td class="col-sticky-cb">
            <input type="checkbox" class="emp-row-cb" value="${e.employee_id}" ${isChecked ? 'checked' : ''} onchange="appEmployees.toggleRowSelect('${e.employee_id}', this.checked)" style="accent-color: #2563EB; width: 16px; height: 16px; cursor: pointer; vertical-align: middle;">
          </td>
          <td class="col-sticky-stt" style="color: var(--text-muted); font-size: 12px; font-weight: 500;">${stt}</td>
          <td class="col-sticky-id"><strong style="color: var(--primary-navy); cursor: pointer;" onclick="appEmployees.openDetailModal('${e.employee_id}')">${e.employee_id}</strong></td>
          <td class="col-sticky-name">
            <div style="font-weight: 600; color: var(--text-primary); cursor: pointer;" onclick="appEmployees.openDetailModal('${e.employee_id}')">${e.full_name}</div>
            <div style="font-size: 11px; color: var(--text-muted);">${e.time_attendance_code ? 'MCC: ' + e.time_attendance_code : ''}</div>
          </td>
          <td>${e.gender || '-'}</td>
          <td>${appData.posMap[e.position_id] || e.position_id || '-'}</td>
          <td style="max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${appData.deptMap[e.department_id] || e.department_id}">
            ${appData.deptMap[e.department_id] || e.department_id}
          </td>
          <td>${c.mobile_phone || '-'}</td>
          <td>${c.work_email ? `<a href="mailto:${c.work_email}" style="color: var(--primary-navy); text-decoration: none;">${c.work_email}</a>` : '-'}</td>
          <td>${natureBadge}</td>
          <td>${statusBadge}</td>
          <td class="col-sticky-action">
            <div style="display: flex; gap: 4px; justify-content: center;">
              <button class="btn btn-icon btn-sm" title="Xem Chi Tiết 8 Tab" onclick="appEmployees.openDetailModal('${e.employee_id}')">
                <i class="fa-solid fa-eye" style="color: var(--primary-navy);"></i>
              </button>
              <button class="btn btn-icon btn-sm" title="Chỉnh Sửa 34 Cột" onclick="appEmployees.openEditModal('${e.employee_id}')">
                <i class="fa-solid fa-pen-to-square" style="color: #2563EB;"></i>
              </button>
              <button class="btn btn-icon btn-sm" title="Xóa Nhân Viên" onclick="appEmployees.showDeletePopover(event, '${e.employee_id}')">
                <i class="fa-solid fa-trash" style="color: var(--accent-red);"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    const table = document.getElementById('emp-main-table');
    if (table) {
      if (this.selectionMode) table.classList.add('has-checkbox');
      else table.classList.remove('has-checkbox');
    }
    this.updateSelectionUI();
  },

  renderPagination() {
    const total = this.filteredList.length;
    const totalPages = Math.ceil(total / this.pageSize) || 1;
    if (this.currentPage > totalPages) {
      this.currentPage = totalPages;
    }
    const start = total === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage * this.pageSize, total);

    const infoEl = document.getElementById('pagination-info');
    if (infoEl) {
      infoEl.innerHTML = `Hiển thị <strong>${start} - ${end}</strong> trên tổng số <strong>${total}</strong> nhân sự`;
    }

    const container = document.getElementById('pagination-controls');
    if (!container) return;

    let html = '';
    html += `<button class="page-btn ${this.currentPage === 1 ? 'disabled' : ''}" onclick="appEmployees.goToPage(${this.currentPage - 1})"><i class="fa-solid fa-angle-left"></i></button>`;

    const maxPagesToShow = 5;
    let startPage = Math.max(1, this.currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      html += `<button class="page-btn ${i === this.currentPage ? 'active' : ''}" onclick="appEmployees.goToPage(${i})">${i}</button>`;
    }

    html += `<button class="page-btn ${this.currentPage === totalPages ? 'disabled' : ''}" onclick="appEmployees.goToPage(${this.currentPage + 1})"><i class="fa-solid fa-angle-right"></i></button>`;
    container.innerHTML = html;
  },

  goToPage(page) {
    const totalPages = Math.ceil(this.filteredList.length / this.pageSize) || 1;
    if (page < 1 || page > totalPages) return;
    this.currentPage = page;
    this.renderTable();
    this.renderPagination();
    window.scrollTo({ top: 300, behavior: 'smooth' });
  },

  // ==========================================
  // THAO TÁC CHỌN NHANH & XÓA NHÂN SỰ ĐÃ CHỌN
  // ==========================================
  toggleActionDropdown(e) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const menu = document.getElementById('emp-action-dropdown');
    const btn = document.getElementById('btn-emp-action-menu');
    if (!menu || !btn) return;

    if (menu.classList.contains('show')) {
      this.closeActionDropdown();
      return;
    }

    // Đưa menu ra trực tiếp dưới document.body để thoát khỏi mọi container (view-employees, card, table-responsive)
    if (menu.parentElement !== document.body) {
      document.body.appendChild(menu);
    }

    const rect = btn.getBoundingClientRect();
    const rightOffset = Math.max(10, window.innerWidth - rect.right);
    menu.style.position = 'fixed';
    menu.style.top = `${rect.bottom + 6}px`;
    menu.style.right = `${rightOffset}px`;
    menu.style.left = 'auto';
    menu.style.zIndex = '999999';

    menu.classList.add('show');
  },

  closeActionDropdown() {
    const menu = document.getElementById('emp-action-dropdown');
    if (menu) {
      menu.classList.remove('show');
    }
  },

  enableSelectionMode() {
    this.selectionMode = true;
    const table = document.getElementById('emp-main-table');
    if (table) {
      table.classList.add('has-checkbox');
    }
  },

  toggleSelectionMode() {
    this.closeActionDropdown();
    this.selectionMode = !this.selectionMode;
    const table = document.getElementById('emp-main-table');
    if (table) {
      if (this.selectionMode) {
        table.classList.add('has-checkbox');
        utils.showToast('Đã hiện ô tích chọn nhân sự', 'info');
      } else {
        table.classList.remove('has-checkbox');
        this.selectedEmpIds.clear();
        this.updateSelectionUI();
        utils.showToast('Đã ẩn ô tích chọn nhân sự', 'info');
      }
    }
  },

  getCurrentPageItems() {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredList.slice(start, start + this.pageSize);
  },

  selectAllCurrentPage() {
    this.closeActionDropdown();
    this.enableSelectionMode();
    const pageItems = this.getCurrentPageItems();
    pageItems.forEach(e => this.selectedEmpIds.add(e.employee_id));
    this.updateSelectionUI();
    utils.showToast(`Đã chọn tất cả ${pageItems.length} nhân sự trên trang này`, 'success');
  },

  selectAllFiltered() {
    this.closeActionDropdown();
    this.enableSelectionMode();
    this.filteredList.forEach(e => this.selectedEmpIds.add(e.employee_id));
    this.updateSelectionUI();
    utils.showToast(`Đã chọn tất cả ${this.selectedEmpIds.size} nhân sự trong danh sách lọc`, 'success');
  },

  toggleRowSelect(empId, isChecked) {
    if (isChecked) {
      this.selectedEmpIds.add(empId);
    } else {
      this.selectedEmpIds.delete(empId);
    }
    this.updateSelectionUI();
  },

  toggleSelectAllCurrentPage(isChecked) {
    const pageItems = this.getCurrentPageItems();
    pageItems.forEach(e => {
      if (isChecked) {
        this.selectedEmpIds.add(e.employee_id);
      } else {
        this.selectedEmpIds.delete(e.employee_id);
      }
    });
    this.updateSelectionUI();
  },

  updateSelectionUI() {
    const pageItems = this.getCurrentPageItems();
    const selectAllCheck = document.getElementById('emp-select-all');
    if (selectAllCheck && pageItems.length > 0) {
      const pageSelectedCount = pageItems.filter(e => this.selectedEmpIds.has(e.employee_id)).length;
      selectAllCheck.checked = pageSelectedCount === pageItems.length;
      selectAllCheck.indeterminate = pageSelectedCount > 0 && pageSelectedCount < pageItems.length;
    }

    // Update row checkboxes & highlight styles
    document.querySelectorAll('.emp-row-cb').forEach(cb => {
      const isChecked = this.selectedEmpIds.has(cb.value);
      cb.checked = isChecked;
      const tr = cb.closest('tr');
      if (tr) {
        if (isChecked) tr.classList.add('row-selected');
        else tr.classList.remove('row-selected');
      }
    });

    // Update button text
    const textEl = document.getElementById('btn-emp-action-text');
    if (textEl) {
      textEl.textContent = this.selectedEmpIds.size > 0
        ? `Hành động (${this.selectedEmpIds.size})`
        : 'Hành động';
    }
  },

  deleteSelectedEmployees() {
    this.closeActionDropdown();
    const count = this.selectedEmpIds.size;
    if (count === 0) {
      utils.showToast('Vui lòng chọn ít nhất 1 nhân sự để xóa!', 'warning');
      return;
    }
    this.openBulkDeleteModal();
  },

  openBulkDeleteModal() {
    const count = this.selectedEmpIds.size;
    const countEl = document.getElementById('bulk-delete-emp-count');
    if (countEl) countEl.textContent = utils.formatNumber(count);
    const modal = document.getElementById('modal-emp-bulk-delete-confirm');
    if (modal) modal.classList.add('active');
  },

  closeBulkDeleteModal() {
    const modal = document.getElementById('modal-emp-bulk-delete-confirm');
    if (modal) modal.classList.remove('active');
  },

  async confirmBulkDeleteEmployees() {
    const confirmBtn = document.getElementById('btn-confirm-bulk-delete-emp');
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Đang xử lý...</span>';
    }

    const empIdsArray = Array.from(this.selectedEmpIds);
    const user = (typeof appAuth !== 'undefined' && typeof appAuth.getCurrentUser === 'function')
      ? appAuth.getCurrentUser()
      : { employee_id: 'TH-1948', full_name: 'Huỳnh Thanh Long', role: 'ADMIN' };

    try {
      const res = await fetch('/api/employees/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_ids: empIdsArray,
          operator_id: user?.employee_id || 'TH-1948',
          operator_name: user?.full_name || 'Huỳnh Thanh Long',
          operator_role: user?.role || 'ADMIN'
        })
      });

      const result = await res.json().catch(() => ({}));
      if (res.ok && result.success) {
        utils.showToast(result.message || `Đã chuyển ${empIdsArray.length} nhân sự vào Thùng rác thành công!`, 'success');
        this.selectedEmpIds.clear();
        this.closeBulkDeleteModal();
        this.updateSelectionUI();
        await appData.init();
        if (typeof appDashboard !== 'undefined') appDashboard.init();
        if (typeof appTrash !== 'undefined') appTrash.render();
        this.applyFilters();
      } else {
        // Fallback: delete sequentially if bulk route is unavailable
        let successCount = 0;
        for (const id of empIdsArray) {
          try {
            const r = await fetch(`/api/employees/${encodeURIComponent(id)}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                operator_id: user?.employee_id || 'TH-1948',
                operator_name: user?.full_name || 'Huỳnh Thanh Long',
                operator_role: user?.role || 'ADMIN'
              })
            });
            const j = await r.json().catch(() => ({}));
            if (j.success) successCount++;
          } catch (e) {
            console.error('Lỗi khi xóa nhân sự ' + id, e);
          }
        }

        if (successCount > 0) {
          utils.showToast(`Đã chuyển ${successCount} nhân sự vào Thùng rác thành công!`, 'success');
          this.selectedEmpIds.clear();
          this.closeBulkDeleteModal();
          this.updateSelectionUI();
          await appData.init();
          if (typeof appDashboard !== 'undefined') appDashboard.init();
          if (typeof appTrash !== 'undefined') appTrash.render();
          this.applyFilters();
        } else {
          utils.showToast(result.message || 'Không thể xóa các nhân sự đã chọn', 'error');
        }
      }
    } catch (err) {
      utils.showToast('Lỗi kết nối máy chủ: ' + err.message, 'error');
    } finally {
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i> <span>Xác Nhận Xóa</span>';
      }
    }
  },

  // Open Full 115 Fields Detail Modal
  async openDetailModal(empId) {
    try {
      let masterData = (appData.masterMap && appData.masterMap[empId]) ? { ...appData.masterMap[empId] } : null;
      const res = await fetch(`/api/employees/${encodeURIComponent(empId)}`);
      const json = await res.json();
      if (json.success && json.data) {
        if (json.data.master_profile) {
          masterData = { ...json.data.master_profile };
        }
        this.selectedEmployee = json.data.employee || json.data;
      }
      if (!masterData) {
        masterData = { 'Mã nhân viên': empId };
      }

      if (typeof fillDetailModalData === 'function') {
        fillDetailModalData(masterData);
      }

      const titleEl = document.getElementById('detail-modal-emp-name');
      if (titleEl) {
        titleEl.textContent = `Hồ Sơ Nhân Viên: ${masterData['Họ và tên'] || empId} (${empId})`;
      }

      // Reset to Tab 1
      const defaultTabBtn = document.querySelector('#modal-employee-detail .modal-tab-btn');
      if (defaultTabBtn) defaultTabBtn.click();

      // Show modal
      const modalEl = document.getElementById('modal-employee-detail');
      if (modalEl) modalEl.classList.add('active');
    } catch (e) {
      console.error(e);
      utils.showToast('Lỗi khi mở hồ sơ nhân viên', 'error');
    }
  },

  closeDetailModal() {
    const modalEl = document.getElementById('modal-employee-detail');
    if (modalEl) modalEl.classList.remove('active');
  },

  openAddModal() {
    document.getElementById('form-is-edit').value = '0';
    const oldInput = document.getElementById('form-old-emp-id');
    if (oldInput) oldInput.value = '';

    const titleEl = document.getElementById('form-modal-title');
    if (titleEl) titleEl.textContent = 'Thêm Nhân Sự Mới (115 Trường Dữ Liệu)';
    const iconEl = document.getElementById('form-modal-icon');
    if (iconEl) iconEl.className = 'fa-solid fa-user-plus';

    const form = document.getElementById('employee-crud-form');
    if (form) form.reset();

    if (typeof fillFormModalData === 'function') {
      fillFormModalData({}, false);
    }

    // Switch to Tab 1
    const firstTabBtn = document.querySelector('#modal-employee-form .form-tab-btn');
    if (firstTabBtn) firstTabBtn.click();

    const modalEl = document.getElementById('modal-employee-form');
    if (modalEl) modalEl.classList.add('active');
  },

  async openEditModal(empId) {
    try {
      let masterData = (appData.masterMap && appData.masterMap[empId]) ? { ...appData.masterMap[empId] } : null;
      const res = await fetch(`/api/employees/${encodeURIComponent(empId)}`);
      const json = await res.json();
      if (json.success && json.data) {
        if (json.data.master_profile) {
          masterData = { ...json.data.master_profile };
        }
      }
      if (!masterData) {
        masterData = { 'Mã nhân viên': empId };
      }

      document.getElementById('form-is-edit').value = '1';
      const oldInput = document.getElementById('form-old-emp-id');
      if (oldInput) oldInput.value = empId;

      const titleEl = document.getElementById('form-modal-title');
      if (titleEl) titleEl.textContent = `Chỉnh Sửa Hồ Sơ: ${masterData['Họ và tên'] || empId} (${empId})`;
      const iconEl = document.getElementById('form-modal-icon');
      if (iconEl) iconEl.className = 'fa-solid fa-user-pen';

      if (typeof fillFormModalData === 'function') {
        fillFormModalData(masterData, true);
      }

      // Switch to Tab 1
      const firstTabBtn = document.querySelector('#modal-employee-form .form-tab-btn');
      if (firstTabBtn) firstTabBtn.click();

      const modalEl = document.getElementById('modal-employee-form');
      if (modalEl) modalEl.classList.add('active');
    } catch (e) {
      console.error(e);
      utils.showToast('Lỗi khi mở form chỉnh sửa', 'error');
    }
  },

  closeFormModal() {
    const modalEl = document.getElementById('modal-employee-form');
    if (modalEl) modalEl.classList.remove('active');
  },

  async handleFormSubmit(e) {
    if (e) e.preventDefault();
    const isEdit = document.getElementById('form-is-edit').value === '1';
    const oldEmpId = (document.getElementById('form-old-emp-id')?.value || '').trim();

    const masterData = typeof collectFormModalData === 'function' ? collectFormModalData() : {};
    const empId = (masterData['Mã nhân viên'] || '').trim();
    const fullName = (masterData['Họ và tên'] || '').trim();

    if (!empId) {
      utils.showToast('Vui lòng nhập Mã nhân viên (*)', 'error');
      return;
    }
    if (!fullName) {
      utils.showToast('Vui lòng nhập Họ và tên (*)', 'error');
      return;
    }

    const payload = {
      master_profile: masterData,
      employee_id: empId,
      full_name: fullName,
      gender: masterData['Giới tính'] || 'Nam',
      date_of_birth: masterData['Ngày sinh'] || null,
      birth_place: masterData['Nơi sinh'] || '',
      native_place: masterData['Nguyên quán'] || '',
      ethnicity: masterData['Dân tộc'] || 'Kinh',
      religion: masterData['Tôn giáo'] || 'Không',
      marital_status: masterData['Tình trạng hôn nhân'] || 'Độc thân',
      tax_code: masterData['MST cá nhân'] || '',
      department_id: masterData['Mã đơn vị công tác'] || masterData['Đơn vị công tác'] || '',
      department_name: masterData['Đơn vị công tác'] || '',
      position_id: masterData['Mã vị trí công việc'] || masterData['Vị trí công việc'] || '',
      position_name: masterData['Vị trí công việc'] || '',
      job_rank: masterData['Bậc'] || masterData['Bậc lương'] || 'Cấp 3',
      job_title: masterData['Chức danh'] || masterData['Vị trí công việc'] || '',
      work_location: masterData['Địa điểm làm việc'] || '',
      direct_manager_name: masterData['Quản lý trực tiếp'] || '',
      labor_nature: masterData['Tính chất lao động'] || 'Chính thức',
      employment_status: masterData['Trạng thái lao động'] || 'Đang làm việc',
      contract_type: masterData['Loại hợp đồng'] || 'Hợp đồng lao động không xác định thời hạn',
      start_date: masterData['Ngày học việc'] || masterData['Ngày thử việc'] || masterData['Ngày chính thức'] || '',
      end_date: masterData['Ngày hết hiệu lực'] || masterData['Ngày nghỉ việc'] || 'Không xác định',
      mobile_phone: masterData['ĐT di động'] || '',
      work_email: masterData['Email cơ quan'] || '',
      personal_email: masterData['Email cá nhân'] || '',
      permanent_address_full: masterData['Hộ khẩu thường trú'] || '',
      current_address_full: masterData['Chỗ ở hiện nay'] || '',
      id_number: masterData['Số CMND'] || '',
      id_issue_date: masterData['Ngày cấp giấy tờ'] || null,
      id_issue_place: masterData['Nơi cấp giấy tờ'] || '',
      passport_number: masterData['Số Hộ chiếu'] || '',
      emergency_name: masterData['Họ và tên (LHKC)'] || '',
      emergency_relation: masterData['Quan hệ (LHKC)'] || '',
      emergency_phone: masterData['ĐT di động (LHKC)'] || '',
      base_salary: parseFloat(masterData['Lương cơ bản']) || 0,
      total_salary: parseFloat(masterData['Tổng lương']) || 0,
      bank_account_number: masterData['TK ngân hàng'] || '',
      bank_name: masterData['Ngân hàng'] || 'Vietcombank',
      bank_branch: masterData['Chi nhánh'] || '',
      social_insurance_book_no: masterData['Số sổ BHXH'] || '',
      hospital_registered: masterData['Nơi đăng ký KCB'] || '',
      education_level: masterData['Trình độ đào tạo'] || '',
      major: masterData['Chuyên ngành'] || '',
      other_certificates: masterData['Bằng cấp chuyên môn khác'] || ''
    };

    try {
      const targetIdForUrl = (isEdit && oldEmpId) ? oldEmpId : empId;
      const url = isEdit ? `/api/employees/${encodeURIComponent(targetIdForUrl)}` : '/api/employees';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (json.success) {
        utils.showToast(isEdit ? 'Cập nhật nhân sự thành công!' : 'Thêm nhân sự mới thành công!', 'success');
        this.closeFormModal();
        await appData.init();
        appDashboard.init();
        this.applyFilters();
      } else {
        utils.showToast(json.message || 'Lỗi khi lưu dữ liệu', 'error');
      }
    } catch (err) {
      console.error(err);
      utils.showToast('Lỗi kết nối tới máy chủ', 'error');
    }
  },

  showDeletePopover(event, empId) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    this.hideDeletePopover();

    const emp = appData.empMap[empId];
    const name = emp ? emp.full_name : empId;
    const triggerBtn = event.currentTarget || event.target.closest('button');

    const popover = document.createElement('div');
    popover.id = 'hrm-emp-delete-popover';
    popover.className = 'hrm-delete-popover';
    popover.innerHTML = `
      <div class="hrm-popover-header">
        <i class="fa-solid fa-triangle-exclamation" style="color: var(--accent-red); font-size: 13px;"></i>
        <span>Xác nhận xóa nhân sự</span>
      </div>
      <div class="hrm-popover-body">
        Chuyển nhân viên <strong style="color: var(--primary-navy);">${name}</strong> (<span style="color: var(--accent-red); font-weight: 600;">${empId}</span>) vào <strong>Thùng rác</strong>? Bạn có thể khôi phục bất cứ lúc nào.
      </div>
      <div class="hrm-popover-actions">
        <button type="button" class="btn btn-secondary hrm-popover-btn-cancel" onclick="appEmployees.hideDeletePopover()">Hủy</button>
        <button type="button" class="btn btn-accent hrm-popover-btn-confirm" id="btn-popover-confirm-del-${empId}">
          <i class="fa-solid fa-trash-can"></i> Xóa
        </button>
      </div>
      <div class="hrm-popover-arrow"></div>
    `;

    document.body.appendChild(popover);

    if (triggerBtn) {
      const rect = triggerBtn.getBoundingClientRect();
      const popoverWidth = 280;
      const popoverHeight = popover.offsetHeight || 135;

      let left = rect.left - popoverWidth - 10;
      let top = rect.top + (rect.height / 2) - (popoverHeight / 2);
      let placement = 'left';

      if (left < 10) {
        left = rect.right + 10;
        placement = 'right';
      }

      if (top < 10) top = 10;
      if (top + popoverHeight > window.innerHeight - 10) {
        top = window.innerHeight - popoverHeight - 10;
      }

      popover.style.left = `${left}px`;
      popover.style.top = `${top}px`;
      popover.setAttribute('data-placement', placement);
    }

    const confirmBtn = document.getElementById(`btn-popover-confirm-del-${empId}`);
    if (confirmBtn) {
      confirmBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.confirmDelete(empId, confirmBtn);
      });
    }

    const outsideClickListener = (e) => {
      if (!popover.contains(e.target) && triggerBtn && !triggerBtn.contains(e.target)) {
        this.hideDeletePopover();
      }
    };
    const escListener = (e) => {
      if (e.key === 'Escape') {
        this.hideDeletePopover();
      }
    };
    const scrollListener = () => {
      this.hideDeletePopover();
    };

    this._popoverCleanup = () => {
      document.removeEventListener('click', outsideClickListener);
      document.removeEventListener('keydown', escListener);
      window.removeEventListener('scroll', scrollListener, true);
    };

    setTimeout(() => {
      document.addEventListener('click', outsideClickListener);
      document.addEventListener('keydown', escListener);
      window.addEventListener('scroll', scrollListener, true);
    }, 10);
  },

  hideDeletePopover() {
    const existing = document.getElementById('hrm-emp-delete-popover');
    if (existing) {
      existing.remove();
    }
    if (this._popoverCleanup) {
      this._popoverCleanup();
      this._popoverCleanup = null;
    }
  },

  async confirmDelete(empId, btnElement) {
    if (btnElement) {
      btnElement.disabled = true;
      btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xóa...';
    }

    try {
      const user = (typeof appAuth !== 'undefined' && typeof appAuth.getCurrentUser === 'function')
        ? appAuth.getCurrentUser()
        : (typeof appAuth !== 'undefined' && appAuth?.currentUser ? appAuth.currentUser : { employee_id: 'TH-1948', full_name: 'Huỳnh Thanh Long', role: 'ADMIN' });

      const res = await fetch(`/api/employees/${empId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operator_id: user?.employee_id || 'TH-1948',
          operator_name: user?.full_name || 'Huỳnh Thanh Long',
          operator_role: user?.role || 'ADMIN'
        })
      });
      const json = await res.json();
      if (json.success) {
        utils.showToast(json.message || `Đã chuyển nhân sự ${empId} vào Thùng rác`, 'success');
        this.hideDeletePopover();
        await appData.init();
        appDashboard.init();
        if (typeof appTrash !== 'undefined') appTrash.render();
        this.applyFilters();
      } else {
        utils.showToast(json.message || 'Không thể xóa nhân viên', 'error');
        if (btnElement) {
          btnElement.disabled = false;
          btnElement.innerHTML = '<i class="fa-solid fa-trash-can"></i> Xóa';
        }
      }
    } catch (e) {
      utils.showToast('Lỗi khi xóa nhân viên: ' + e.message, 'error');
      if (btnElement) {
        btnElement.disabled = false;
        btnElement.innerHTML = '<i class="fa-solid fa-trash-can"></i> Xóa';
      }
    }
  },

  async deleteEmployee(empId) {
    this.showDeletePopover(window.event, empId);
  },

  exportFilteredExcel() {
    if (this.filteredList.length === 0) {
      utils.showToast('Không có dữ liệu để xuất', 'error');
      return;
    }

    const contactMap = {};
    appData.contacts.forEach(c => contactMap[c.employee_id] = c);
    const salMap = {};
    appData.salaries.forEach(s => salMap[s.employee_id] = s);
    const idMap = {};
    appData.identity.forEach(i => idMap[i.employee_id] = i);

    const exportData = this.filteredList.map((e, idx) => ({
      "STT": idx + 1,
      "Mã nhân viên": e.employee_id,
      "Họ và tên": e.full_name,
      "Giới tính": e.gender,
      "Ngày sinh": e.date_of_birth,
      "Vị trí công việc": appData.posMap[e.position_id] || e.position_id,
      "Đơn vị công tác": appData.deptMap[e.department_id] || e.department_id,
      "Quản lý trực tiếp": e.direct_manager_name || '',
      "Tính chất lao động": e.labor_nature,
      "Trạng thái lao động": e.employment_status,
      "Số ĐT di động": contactMap[e.employee_id]?.mobile_phone || '',
      "Email công việc": contactMap[e.employee_id]?.work_email || '',
      "Số CMND/CCCD": idMap[e.employee_id]?.id_number || '',
      "Lương cơ bản": salMap[e.employee_id]?.base_salary || 0,
      "Số TK ngân hàng": salMap[e.employee_id]?.bank_account_number || '',
      "Ngân hàng": salMap[e.employee_id]?.bank_name || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DanhSachNhanSu");
    XLSX.writeFile(wb, `Danh_Sach_Nhan_Su_Trung_Hai_${new Date().toISOString().slice(0,10)}.xlsx`);
    utils.showToast('Xuất danh sách nhân sự Excel thành công!', 'success');
  },

  openDeleteAllModal() {
    const totalEmployees = (appData.employees || []).length;
    if (totalEmployees === 0) {
      utils.showToast('Hiện không có hồ sơ nhân sự nào trong hệ thống', 'info');
      return;
    }

    const countEl = document.getElementById('delete-all-total-count');
    if (countEl) countEl.textContent = utils.formatNumber(totalEmployees);

    // Calculate employees with accounts
    const accountEmpIds = new Set((appData.accounts || []).map(a => a.employee_id).filter(Boolean));
    accountEmpIds.add('TH-0001');
    accountEmpIds.add('TH-1948');
    const keptEmployees = appData.employees.filter(e => accountEmpIds.has(e.employee_id));
    const actualDeleteCount = Math.max(0, totalEmployees - keptEmployees.length);

    const keptEl = document.getElementById('delete-all-kept-count');
    if (keptEl) keptEl.textContent = utils.formatNumber(keptEmployees.length);

    const actualEl = document.getElementById('delete-all-actual-count');
    if (actualEl) actualEl.textContent = utils.formatNumber(actualDeleteCount);

    const keepCheckbox = document.getElementById('delete-all-keep-accounts');
    if (keepCheckbox) {
      keepCheckbox.checked = true;
      keepCheckbox.onchange = () => {
        if (actualEl) {
          actualEl.textContent = utils.formatNumber(keepCheckbox.checked ? actualDeleteCount : totalEmployees);
        }
      };
    }

    const inputEl = document.getElementById('delete-all-confirm-input');
    if (inputEl) inputEl.value = '';

    const confirmBtn = document.getElementById('btn-confirm-delete-all-action');
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.style.opacity = '0.5';
      confirmBtn.style.cursor = 'not-allowed';
      confirmBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i> <span>Xóa Toàn Bộ</span>';
    }

    // Reset radio to default (recycle)
    const recycleRadio = document.querySelector('input[name="delete-all-mode"][value="recycle"]');
    if (recycleRadio) recycleRadio.checked = true;

    const modal = document.getElementById('modal-delete-all-employees');
    if (modal) modal.classList.add('active');
  },

  closeDeleteAllModal() {
    const modal = document.getElementById('modal-delete-all-employees');
    if (modal) modal.classList.remove('active');
    const inputEl = document.getElementById('delete-all-confirm-input');
    if (inputEl) inputEl.value = '';
  },

  async confirmDeleteAll() {
    const confirmBtn = document.getElementById('btn-confirm-delete-all-action');
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Đang xử lý...</span>';
    }

    const mode = document.querySelector('input[name="delete-all-mode"]:checked')?.value;
    const isPermanent = mode === 'permanent';
    const keepAccounts = document.getElementById('delete-all-keep-accounts')?.checked !== false;

    try {
      const user = (typeof appAuth !== 'undefined' && typeof appAuth.getCurrentUser === 'function')
        ? appAuth.getCurrentUser()
        : (typeof appAuth !== 'undefined' && appAuth?.currentUser ? appAuth.currentUser : { employee_id: 'TH-1948', full_name: 'Huỳnh Thanh Long', role: 'ADMIN' });

      const res = await fetch('/api/employees/all', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permanent: isPermanent,
          keep_accounts: keepAccounts,
          operator_id: user?.employee_id || 'TH-1948',
          operator_name: user?.full_name || 'Huỳnh Thanh Long',
          operator_role: user?.role || 'ADMIN'
        })
      });

      const json = await res.json();

      if (json.success) {
        utils.showToast(json.message || `Đã xóa thành công ${json.count || ''} nhân sự`, 'success');
        this.closeDeleteAllModal();
        
        // Reload all cached application data
        await appData.init();

        // Refresh views and dashboards
        if (typeof appDashboard !== 'undefined' && typeof appDashboard.init === 'function') {
          appDashboard.init();
        }
        if (typeof appTrash !== 'undefined' && typeof appTrash.render === 'function') {
          appTrash.render();
        }
        if (typeof appLogs !== 'undefined' && typeof appLogs.render === 'function') {
          appLogs.render();
        }

        // Reapply filter for empty state display
        this.currentPage = 1;
        this.applyFilters();
      } else {
        utils.showToast(json.message || 'Lỗi khi xóa toàn bộ nhân sự', 'error');
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i> <span>Xóa Toàn Bộ</span>';
        }
      }
    } catch (e) {
      utils.showToast('Lỗi kết nối khi xóa nhân sự: ' + e.message, 'error');
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i> <span>Xóa Toàn Bộ</span>';
      }
    }
  }
};
