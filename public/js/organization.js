// ==========================================================================
// ORGANIZATION MODULE: COMPANIES, DEPARTMENTS, POSITIONS & ORG CHART
// Quản lý Cơ cấu Tổ chức: Công ty -> Phòng ban -> Chức vụ / Vị trí
// ==========================================================================

const appOrganization = {
  initialized: false,
  isSavingCompany: false,
  isSavingDept: false,
  isSavingPos: false,
  selectedCompanyId: null,
  selectedDeptId: null,
  selectedPosId: null,
  companySearchQuery: '',
  deptSearchQuery: '',
  posSearchQuery: '',
  contractSearchQuery: '',
  contractPage: 1,
  contractPageSize: 25,
  contractFilterType: '',
  contractFilterStatus: '',
  deptCompanyFilter: '',
  posDeptFilter: '',

  init() {
    if (!this.initialized) {
      this.attachEventListeners();
      this.initialized = true;
    }
    this.populateFilterDropdowns();
    this.renderCompaniesTable();
    this.renderDepartmentsTable();
    this.renderPositionsTable();
    this.renderContractsTable();
    this.renderOrgChart();
    this.updateAllDropdowns();
  },

  attachEventListeners() {
    // Search Inputs
    const compSearch = document.getElementById('company-search-input');
    if (compSearch) {
      compSearch.addEventListener('input', (e) => {
        this.companySearchQuery = e.target.value.trim().toLowerCase();
        this.renderCompaniesTable();
      });
    }

    const deptSearch = document.getElementById('dept-search-input');
    if (deptSearch) {
      deptSearch.addEventListener('input', (e) => {
        this.deptSearchQuery = e.target.value.trim().toLowerCase();
        this.renderDepartmentsTable();
      });
    }

    const posSearch = document.getElementById('pos-search-input');
    if (posSearch) {
      posSearch.addEventListener('input', (e) => {
        this.posSearchQuery = e.target.value.trim().toLowerCase();
        this.renderPositionsTable();
      });
    }

    const contractSearch = document.getElementById('contract-search-input');
    if (contractSearch) {
      contractSearch.addEventListener('input', (e) => {
        this.contractSearchQuery = e.target.value.trim().toLowerCase();
        this.contractPage = 1;
        this.renderContractsTable();
      });
    }

    const contractTypeFilter = document.getElementById('contract-filter-type');
    if (contractTypeFilter) {
      contractTypeFilter.addEventListener('change', (e) => {
        this.contractFilterType = e.target.value.trim().toLowerCase();
        this.contractPage = 1;
        this.renderContractsTable();
      });
    }

    const contractStatusFilter = document.getElementById('contract-filter-status');
    if (contractStatusFilter) {
      contractStatusFilter.addEventListener('change', (e) => {
        this.contractFilterStatus = e.target.value.trim();
        this.contractPage = 1;
        this.renderContractsTable();
      });
    }

    const contractPageSize = document.getElementById('contract-page-size');
    if (contractPageSize) {
      contractPageSize.addEventListener('change', (e) => {
        this.contractPageSize = parseInt(e.target.value, 10) || 25;
        this.contractPage = 1;
        this.renderContractsTable();
      });
    }

    // Forms Submit
    const compForm = document.getElementById('form-company-action');
    if (compForm) {
      compForm.addEventListener('submit', (e) => this.saveCompany(e));
    }

    const deptForm = document.getElementById('form-dept-action');
    if (deptForm) {
      deptForm.addEventListener('submit', (e) => this.saveDept(e));
    }

    const posForm = document.getElementById('form-pos-action');
    if (posForm) {
      posForm.addEventListener('submit', (e) => this.savePos(e));
    }
  },

  populateFilterDropdowns() {
    // Dept filter by Company
    const deptCompSelect = document.getElementById('dept-filter-company');
    if (deptCompSelect) {
      const current = deptCompSelect.value;
      deptCompSelect.innerHTML = '<option value="">-- Tất cả Công Ty --</option>' +
        (appData.companies || []).map(c => `<option value="${c.company_id}" ${c.company_id === current ? 'selected' : ''}>${c.company_name} (${c.company_id})</option>`).join('');
    }
  },

  filterDeptByCompany(compId) {
    this.deptCompanyFilter = compId || '';
    this.renderDepartmentsTable();
  },

  // ========================================================================
  // 1. COMPANIES MANAGEMENT (QUẢN LÝ CÔNG TY)
  // ========================================================================
  renderCompaniesTable() {
    const tbody = document.getElementById('companies-tbody');
    if (!tbody) return;

    // Count departments per company
    const deptCounts = {};
    (appData.departments || []).forEach(d => {
      const cId = d.company_id || 'TH-CORP';
      deptCounts[cId] = (deptCounts[cId] || 0) + 1;
    });

    // Count employees per company (via employee's department)
    const empCounts = {};
    (appData.employees || []).forEach(e => {
      const dept = (appData.departments || []).find(d => d.department_id === e.department_id);
      const cId = dept ? (dept.company_id || 'TH-CORP') : 'TH-CORP';
      empCounts[cId] = (empCounts[cId] || 0) + 1;
    });

    const filtered = (appData.companies || []).filter(c => {
      if (!this.companySearchQuery) return true;
      const id = (c.company_id || '').toLowerCase();
      const name = (c.company_name || '').toLowerCase();
      return id.includes(this.companySearchQuery) || name.includes(this.companySearchQuery);
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 24px; color: var(--text-muted);">
            <i class="fa-solid fa-city" style="font-size: 24px; margin-bottom: 8px; display: block; opacity: 0.5;"></i>
            Không tìm thấy công ty phù hợp
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(c => {
      const numDepts = deptCounts[c.company_id] || 0;
      const numEmps = empCounts[c.company_id] || 0;
      return `
        <tr>
          <td><strong style="color: var(--primary-navy); font-family: monospace; font-size: 13px;">${c.company_id}</strong></td>
          <td><strong style="color: var(--text-primary); font-size: 13px;">${c.company_name}</strong></td>
          <td style="text-align: center;">
            <span class="badge badge-navy" style="font-size: 11.5px; font-weight: 700;">
              <i class="fa-solid fa-building"></i> ${numDepts} phòng ban
            </span>
          </td>
          <td style="text-align: center;">
            <span class="badge badge-navy" style="font-size: 11.5px; font-weight: 700;">
              <i class="fa-solid fa-users"></i> ${numEmps} nhân sự
            </span>
          </td>
          <td style="text-align: center;">
            <div style="display: flex; justify-content: center; gap: 6px;">
              <button class="btn btn-sm btn-secondary" onclick="appOrganization.openEditCompanyModal('${c.company_id}')" title="Chỉnh sửa công ty">
                <i class="fa-solid fa-pen-to-square" style="color: var(--primary-navy);"></i>
              </button>
              <button class="btn btn-sm btn-secondary" onclick="appOrganization.deleteCompany('${c.company_id}')" title="Xóa công ty">
                <i class="fa-solid fa-trash-can" style="color: var(--accent-red);"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  openAddCompanyModal() {
    this.selectedCompanyId = null;
    document.getElementById('company-modal-title').textContent = 'Thêm Công Ty Mới';
    
    const idInput = document.getElementById('company-form-id');
    idInput.value = '';
    idInput.disabled = false;
    
    document.getElementById('company-form-name').value = '';
    document.getElementById('modal-company-form').classList.add('active');
  },

  openEditCompanyModal(compId) {
    const comp = (appData.companies || []).find(c => c.company_id === compId);
    if (!comp) return;

    this.selectedCompanyId = compId;
    document.getElementById('company-modal-title').textContent = `Chỉnh Sửa Công Ty (${compId})`;

    const idInput = document.getElementById('company-form-id');
    idInput.value = comp.company_id;
    idInput.disabled = true;

    document.getElementById('company-form-name').value = comp.company_name || '';
    document.getElementById('modal-company-form').classList.add('active');
  },

  closeCompanyModal() {
    const modal = document.getElementById('modal-company-form');
    if (modal) modal.classList.remove('active');
  },

  async saveCompany(e) {
    e.preventDefault();
    if (this.isSavingCompany) return;

    const id = document.getElementById('company-form-id').value.trim().toUpperCase();
    const name = document.getElementById('company-form-name').value.trim();

    if (!id || !name) {
      utils.showToast('Vui lòng điền đầy đủ Mã công ty và Tên công ty', 'error');
      return;
    }

    this.isSavingCompany = true;
    const submitBtn = document.getElementById('btn-save-company');
    if (submitBtn) submitBtn.disabled = true;

    try {
      if (this.selectedCompanyId) {
        // UPDATE
        const res = await fetch(`/api/companies/${this.selectedCompanyId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company_name: name,
            operator_id: appAuth.currentUser?.employee_id || 'TH-0001',
            operator_name: appAuth.currentUser?.full_name || 'Admin',
            operator_role: appAuth.currentUser?.role || 'ADMIN'
          })
        });
        const json = await res.json();
        if (json.success) {
          const idx = appData.companies.findIndex(c => c.company_id === this.selectedCompanyId);
          if (idx >= 0) appData.companies[idx] = json.company;
          appData.companyMap[this.selectedCompanyId] = name;

          this.updateAllDropdowns();
          this.renderCompaniesTable();
          this.renderDepartmentsTable();
          this.renderOrgChart();
          this.closeCompanyModal();
          utils.showToast('Cập nhật công ty thành công!', 'success');
        } else {
          utils.showToast(json.message || 'Lỗi cập nhật công ty', 'error');
        }
      } else {
        // CREATE
        const res = await fetch('/api/companies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company_id: id,
            company_name: name,
            operator_id: appAuth.currentUser?.employee_id || 'TH-0001',
            operator_name: appAuth.currentUser?.full_name || 'Admin',
            operator_role: appAuth.currentUser?.role || 'ADMIN'
          })
        });
        const json = await res.json();
        if (json.success) {
          if (!appData.companies) appData.companies = [];
          appData.companies.push(json.company);
          appData.companyMap[json.company.company_id] = json.company.company_name;

          this.updateAllDropdowns();
          this.renderCompaniesTable();
          this.renderOrgChart();
          this.closeCompanyModal();
          utils.showToast(`Thêm mới công ty "${name}" thành công!`, 'success');
        } else {
          utils.showToast(json.message || 'Lỗi tạo công ty', 'error');
        }
      }
    } catch (err) {
      console.error(err);
      utils.showToast('Lỗi máy chủ: ' + err.message, 'error');
    } finally {
      this.isSavingCompany = false;
      if (submitBtn) submitBtn.disabled = false;
    }
  },

  async deleteCompany(compId) {
    const comp = (appData.companies || []).find(c => c.company_id === compId);
    if (!comp) return;

    if (!confirm(`Bạn có chắc chắn muốn xóa công ty "${comp.company_name}" (${compId}) không?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/companies/${compId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operator_id: appAuth.currentUser?.employee_id || 'TH-0001',
          operator_name: appAuth.currentUser?.full_name || 'Admin',
          operator_role: appAuth.currentUser?.role || 'ADMIN'
        })
      });
      const json = await res.json();
      if (json.success) {
        appData.companies = appData.companies.filter(c => c.company_id !== compId);
        delete appData.companyMap[compId];

        this.updateAllDropdowns();
        this.renderCompaniesTable();
        this.renderOrgChart();
        utils.showToast(`Đã xóa công ty "${comp.company_name}"!`, 'success');
      } else {
        utils.showToast(json.message || 'Không thể xóa công ty', 'error');
      }
    } catch (err) {
      console.error(err);
      utils.showToast('Lỗi máy chủ', 'error');
    }
  },

  // ========================================================================
  // 2. DEPARTMENTS MANAGEMENT (QUẢN LÝ PHÒNG BAN)
  // ========================================================================
  renderDepartmentsTable() {
    const tbody = document.getElementById('departments-tbody');
    if (!tbody) return;

    const deptCounts = {};
    (appData.employees || []).forEach(e => {
      deptCounts[e.department_id] = (deptCounts[e.department_id] || 0) + 1;
    });

    const filtered = (appData.departments || []).filter(d => {
      if (this.deptCompanyFilter && (d.company_id || 'TH-CORP') !== this.deptCompanyFilter) {
        return false;
      }
      if (!this.deptSearchQuery) return true;
      const id = (d.department_id || '').toLowerCase();
      const name = (d.department_name || '').toLowerCase();
      return id.includes(this.deptSearchQuery) || name.includes(this.deptSearchQuery);
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 24px; color: var(--text-muted);">
            <i class="fa-solid fa-building-circle-xmark" style="font-size: 24px; margin-bottom: 8px; display: block; opacity: 0.5;"></i>
            Không tìm thấy phòng ban phù hợp
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(d => {
      const count = deptCounts[d.department_id] || 0;
      const compName = appData.companyMap[d.company_id] || (appData.companies && appData.companies[0]?.company_name) || 'Tổng Công Ty Trung Hải';
      return `
        <tr>
          <td><strong style="color: var(--primary-navy); font-family: monospace; font-size: 13px;">${d.department_id}</strong></td>
          <td><strong style="color: var(--text-primary); font-size: 13px;">${d.department_name}</strong></td>
          <td><span style="font-size: 12px; color: var(--text-secondary);"><i class="fa-solid fa-city" style="color: var(--primary-navy); margin-right: 4px;"></i>${compName}</span></td>
          <td style="text-align: center;">
            <span class="badge badge-navy" style="font-size: 11.5px; font-weight: 700;">
              <i class="fa-solid fa-users"></i> ${count} nhân sự
            </span>
          </td>
          <td style="text-align: center;">
            <div style="display: flex; justify-content: center; gap: 6px;">
              <button class="btn btn-sm btn-outline-navy" onclick="appOrganization.filterEmployeesByDept('${d.department_id}')" title="Xem danh sách nhân viên">
                <i class="fa-solid fa-users"></i>
              </button>
              <button class="btn btn-sm btn-secondary" onclick="appOrganization.openEditDeptModal('${d.department_id}')" title="Chỉnh sửa phòng ban">
                <i class="fa-solid fa-pen-to-square" style="color: var(--primary-navy);"></i>
              </button>
              <button class="btn btn-sm btn-secondary" onclick="appOrganization.deleteDept('${d.department_id}')" title="Xóa phòng ban">
                <i class="fa-solid fa-trash-can" style="color: var(--accent-red);"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  openAddDeptModal() {
    this.selectedDeptId = null;
    document.getElementById('dept-modal-title').textContent = 'Thêm Phòng Ban Mới';
    
    const idInput = document.getElementById('dept-form-id');
    idInput.value = '';
    idInput.disabled = false;
    
    document.getElementById('dept-form-name').value = '';

    // Populate Company Dropdown
    const compSelect = document.getElementById('dept-form-company');
    if (compSelect) {
      compSelect.innerHTML = (appData.companies || []).map(c => `<option value="${c.company_id}">${c.company_name} (${c.company_id})</option>`).join('');
    }

    document.getElementById('modal-dept-form').classList.add('active');
  },

  openEditDeptModal(deptId) {
    const dept = (appData.departments || []).find(d => d.department_id === deptId);
    if (!dept) return;

    this.selectedDeptId = deptId;
    document.getElementById('dept-modal-title').textContent = `Chỉnh Sửa Phòng Ban (${deptId})`;

    const idInput = document.getElementById('dept-form-id');
    idInput.value = dept.department_id;
    idInput.disabled = true;

    document.getElementById('dept-form-name').value = dept.department_name || '';

    // Populate Company Dropdown
    const compSelect = document.getElementById('dept-form-company');
    if (compSelect) {
      compSelect.innerHTML = (appData.companies || []).map(c => 
        `<option value="${c.company_id}" ${c.company_id === dept.company_id ? 'selected' : ''}>${c.company_name} (${c.company_id})</option>`
      ).join('');
    }

    document.getElementById('modal-dept-form').classList.add('active');
  },

  closeDeptModal() {
    const modal = document.getElementById('modal-dept-form');
    if (modal) modal.classList.remove('active');
  },

  async saveDept(e) {
    e.preventDefault();
    if (this.isSavingDept) return;

    const id = document.getElementById('dept-form-id').value.trim().toUpperCase();
    const name = document.getElementById('dept-form-name').value.trim();
    const companyId = document.getElementById('dept-form-company')?.value || 'TH-CORP';

    if (!id || !name) {
      utils.showToast('Vui lòng điền đầy đủ Mã và Tên phòng ban', 'error');
      return;
    }

    this.isSavingDept = true;
    const submitBtn = document.getElementById('btn-save-dept');
    if (submitBtn) submitBtn.disabled = true;

    try {
      if (this.selectedDeptId) {
        // UPDATE
        const res = await fetch(`/api/departments/${this.selectedDeptId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            department_name: name,
            company_id: companyId,
            operator_id: appAuth.currentUser?.employee_id || 'TH-0001',
            operator_name: appAuth.currentUser?.full_name || 'Admin',
            operator_role: appAuth.currentUser?.role || 'ADMIN'
          })
        });
        const json = await res.json();
        if (json.success) {
          const idx = appData.departments.findIndex(d => d.department_id === this.selectedDeptId);
          if (idx >= 0) appData.departments[idx] = { ...appData.departments[idx], ...json.department, company_id: companyId };
          appData.deptMap[this.selectedDeptId] = name;

          // Update department_name on local employees list
          (appData.employees || []).forEach(emp => {
            if (emp.department_id === this.selectedDeptId) emp.department_name = name;
          });

          this.updateAllDropdowns();
          this.renderDepartmentsTable();
          this.renderOrgChart();
          this.closeDeptModal();
          utils.showToast('Cập nhật phòng ban thành công!', 'success');
        } else {
          utils.showToast(json.message || 'Lỗi cập nhật phòng ban', 'error');
        }
      } else {
        // CREATE
        const res = await fetch('/api/departments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            department_id: id,
            department_name: name,
            company_id: companyId,
            operator_id: appAuth.currentUser?.employee_id || 'TH-0001',
            operator_name: appAuth.currentUser?.full_name || 'Admin',
            operator_role: appAuth.currentUser?.role || 'ADMIN'
          })
        });
        const json = await res.json();
        if (json.success) {
          const newDept = { ...json.department, company_id: companyId };
          appData.departments.push(newDept);
          appData.deptMap[newDept.department_id] = newDept.department_name;

          this.updateAllDropdowns();
          this.renderDepartmentsTable();
          this.renderOrgChart();
          this.closeDeptModal();
          utils.showToast(`Thêm mới phòng ban ${name} thành công!`, 'success');
        } else {
          utils.showToast(json.message || 'Lỗi tạo phòng ban', 'error');
        }
      }
    } catch (err) {
      console.error(err);
      utils.showToast('Lỗi máy chủ: ' + err.message, 'error');
    } finally {
      this.isSavingDept = false;
      if (submitBtn) submitBtn.disabled = false;
    }
  },

  async deleteDept(deptId) {
    const dept = (appData.departments || []).find(d => d.department_id === deptId);
    if (!dept) return;

    if (!confirm(`Bạn có chắc chắn muốn xóa phòng ban "${dept.department_name}" (${deptId}) không?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/departments/${deptId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operator_id: appAuth.currentUser?.employee_id || 'TH-0001',
          operator_name: appAuth.currentUser?.full_name || 'Admin',
          operator_role: appAuth.currentUser?.role || 'ADMIN'
        })
      });
      const json = await res.json();
      if (json.success) {
        appData.departments = appData.departments.filter(d => d.department_id !== deptId);
        delete appData.deptMap[deptId];

        this.updateAllDropdowns();
        this.renderDepartmentsTable();
        this.renderOrgChart();
        utils.showToast(`Đã xóa phòng ban "${dept.department_name}"!`, 'success');
      } else {
        utils.showToast(json.message || 'Không thể xóa phòng ban', 'error');
      }
    } catch (err) {
      console.error(err);
      utils.showToast('Lỗi máy chủ', 'error');
    }
  },

  // ========================================================================
  // 3. POSITIONS MANAGEMENT (QUẢN LÝ VỊ TRÍ)
  // ========================================================================
  renderPositionsTable() {
    const tbody = document.getElementById('positions-tbody');
    if (!tbody) return;

    const posCounts = {};
    (appData.employees || []).forEach(e => {
      posCounts[e.position_id] = (posCounts[e.position_id] || 0) + 1;
    });

    const filtered = (appData.positions || []).filter(p => {
      if (!this.posSearchQuery) return true;
      const id = (p.position_id || '').toLowerCase();
      const name = (p.position_name || '').toLowerCase();
      return id.includes(this.posSearchQuery) || name.includes(this.posSearchQuery);
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 24px; color: var(--text-muted);">
            <i class="fa-solid fa-briefcase" style="font-size: 24px; margin-bottom: 8px; display: block; opacity: 0.5;"></i>
            Không tìm thấy vị trí / chức danh phù hợp
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(p => {
      const count = posCounts[p.position_id] || 0;
      return `
        <tr>
          <td><strong style="color: var(--primary-navy); font-family: monospace; font-size: 13px;">${p.position_id}</strong></td>
          <td><strong style="color: var(--text-primary); font-size: 13px;">${p.position_name}</strong></td>
          <td style="text-align: center;">
            <span class="badge badge-navy" style="font-size: 11.5px; font-weight: 700;">
              <i class="fa-solid fa-user-tag"></i> ${count} nhân sự
            </span>
          </td>
          <td style="text-align: center;">
            <div style="display: flex; justify-content: center; gap: 6px;">
              <button class="btn btn-sm btn-outline-navy" onclick="appOrganization.filterEmployeesByPosition('${p.position_id}')" title="Xem danh sách nhân sự giữ chức danh này">
                <i class="fa-solid fa-users"></i>
              </button>
              <button class="btn btn-sm btn-secondary" onclick="appOrganization.openEditPosModal('${p.position_id}')" title="Chỉnh sửa vị trí chức danh">
                <i class="fa-solid fa-pen-to-square" style="color: var(--primary-navy);"></i>
              </button>
              <button class="btn btn-sm btn-secondary" onclick="appOrganization.deletePos('${p.position_id}')" title="Xóa vị trí chức danh">
                <i class="fa-solid fa-trash-can" style="color: var(--accent-red);"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  openAddPosModal() {
    this.selectedPosId = null;
    document.getElementById('pos-modal-title').textContent = 'Thêm Vị Trí Mới';

    const idInput = document.getElementById('pos-form-id');
    idInput.value = '';
    idInput.disabled = false;

    document.getElementById('pos-form-name').value = '';
    document.getElementById('modal-pos-form').classList.add('active');
  },

  openEditPosModal(posId) {
    const pos = (appData.positions || []).find(p => p.position_id === posId);
    if (!pos) return;

    this.selectedPosId = posId;
    document.getElementById('pos-modal-title').textContent = `Chỉnh Sửa Vị Trí (${posId})`;

    const idInput = document.getElementById('pos-form-id');
    idInput.value = pos.position_id;
    idInput.disabled = true;

    document.getElementById('pos-form-name').value = pos.position_name || '';
    document.getElementById('modal-pos-form').classList.add('active');
  },

  closePosModal() {
    const modal = document.getElementById('modal-pos-form');
    if (modal) modal.classList.remove('active');
  },

  async savePos(e) {
    e.preventDefault();
    if (this.isSavingPos) return;

    const id = document.getElementById('pos-form-id').value.trim().toUpperCase();
    const name = document.getElementById('pos-form-name').value.trim();

    if (!id || !name) {
      utils.showToast('Vui lòng điền đầy đủ Mã và Tên vị trí', 'error');
      return;
    }

    this.isSavingPos = true;
    const submitBtn = document.getElementById('btn-save-pos');
    if (submitBtn) submitBtn.disabled = true;

    try {
      if (this.selectedPosId) {
        // UPDATE
        const res = await fetch(`/api/positions/${this.selectedPosId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            position_name: name,
            operator_id: appAuth.currentUser?.employee_id || 'TH-0001',
            operator_name: appAuth.currentUser?.full_name || 'Admin',
            operator_role: appAuth.currentUser?.role || 'ADMIN'
          })
        });
        const json = await res.json();
        if (json.success) {
          const idx = appData.positions.findIndex(p => p.position_id === this.selectedPosId);
          if (idx >= 0) appData.positions[idx] = { ...appData.positions[idx], ...json.position, position_name: name };
          appData.posMap[this.selectedPosId] = name;

          this.updateAllDropdowns();
          this.renderPositionsTable();
          this.renderOrgChart();
          this.closePosModal();
          utils.showToast('Cập nhật vị trí thành công!', 'success');
        } else {
          utils.showToast(json.message || 'Lỗi cập nhật vị trí', 'error');
        }
      } else {
        // CREATE
        const res = await fetch('/api/positions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            position_id: id,
            position_name: name,
            operator_id: appAuth.currentUser?.employee_id || 'TH-0001',
            operator_name: appAuth.currentUser?.full_name || 'Admin',
            operator_role: appAuth.currentUser?.role || 'ADMIN'
          })
        });
        const json = await res.json();
        if (json.success) {
          const newPos = { ...json.position, position_id: id, position_name: name };
          appData.positions.push(newPos);
          appData.posMap[newPos.position_id] = newPos.position_name;

          this.updateAllDropdowns();
          this.renderPositionsTable();
          this.renderOrgChart();
          this.closePosModal();
          utils.showToast(`Thêm mới vị trí "${name}" thành công!`, 'success');
        } else {
          utils.showToast(json.message || 'Lỗi tạo vị trí', 'error');
        }
      }
    } catch (err) {
      console.error(err);
      utils.showToast('Lỗi máy chủ: ' + err.message, 'error');
    } finally {
      this.isSavingPos = false;
      if (submitBtn) submitBtn.disabled = false;
    }
  },

  async deletePos(posId) {
    const pos = (appData.positions || []).find(p => p.position_id === posId);
    if (!pos) return;

    if (!confirm(`Bạn có chắc chắn muốn xóa vị trí "${pos.position_name}" (${posId}) không?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/positions/${posId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operator_id: appAuth.currentUser?.employee_id || 'TH-0001',
          operator_name: appAuth.currentUser?.full_name || 'Admin',
          operator_role: appAuth.currentUser?.role || 'ADMIN'
        })
      });
      const json = await res.json();
      if (json.success) {
        appData.positions = appData.positions.filter(p => p.position_id !== posId);
        delete appData.posMap[posId];

        this.updateAllDropdowns();
        this.renderPositionsTable();
        this.renderOrgChart();
        utils.showToast(`Đã xóa vị trí "${pos.position_name}"!`, 'success');
      } else {
        utils.showToast(json.message || 'Không thể xóa vị trí', 'error');
      }
    } catch (err) {
      console.error(err);
      utils.showToast('Lỗi máy chủ', 'error');
    }
  },

  // ========================================================================
  // 4. SƠ ĐỒ CƠ CẤU TỔ CHỨC HIERARCHY (CÔNG TY -> PHÒNG BAN -> CHỨC VỤ)
  // ========================================================================
  renderOrgChart() {
    const container = document.getElementById('org-chart-tree-container');
    if (!container) return;

    const companies = appData.companies || [];
    const departments = appData.departments || [];
    const positions = appData.positions || [];
    const employees = appData.employees || [];

    // Map counts
    const deptStaffCount = {};
    const posStaffCount = {};
    employees.forEach(e => {
      if (e.department_id) deptStaffCount[e.department_id] = (deptStaffCount[e.department_id] || 0) + 1;
      if (e.position_id) posStaffCount[e.position_id] = (posStaffCount[e.position_id] || 0) + 1;
    });

    if (companies.length === 0) {
      container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 40px;">Chưa có dữ liệu công ty</div>';
      return;
    }

    let html = '<div class="org-tree" style="display: flex; flex-direction: column; gap: 24px;">';

    companies.forEach(comp => {
      // Find departments belonging to this company
      const compDepts = departments.filter(d => (d.company_id || 'TH-CORP') === comp.company_id);
      let totalCompStaff = 0;
      compDepts.forEach(d => { totalCompStaff += (deptStaffCount[d.department_id] || 0); });

      html += `
        <div class="org-company-card" style="background: #FFFFFF; border: 1px solid var(--border-color); border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.04); overflow: hidden;">
          <!-- Company Header -->
          <div style="background: linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%); color: #FFFFFF; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 36px; height: 36px; border-radius: 6px; background: rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; font-size: 18px;">
                <i class="fa-solid fa-city"></i>
              </div>
              <div>
                <div style="font-size: 15px; font-weight: 700; letter-spacing: 0.3px;">${comp.company_name}</div>
                <div style="font-size: 11.5px; opacity: 0.85; font-family: monospace;">Mã: ${comp.company_id}</div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge" style="background: rgba(255,255,255,0.2); color: #FFFFFF; font-size: 11.5px; padding: 4px 10px;">
                <i class="fa-solid fa-building"></i> ${compDepts.length} phòng ban
              </span>
              <span class="badge" style="background: #10B981; color: #FFFFFF; font-size: 11.5px; padding: 4px 10px;">
                <i class="fa-solid fa-users"></i> ${totalCompStaff} nhân sự
              </span>
            </div>
          </div>

          <!-- Departments Grid inside Company -->
          <div style="padding: 18px; background: #F8FAFC;">
            ${compDepts.length === 0 ? `
              <div style="font-size: 12.5px; color: var(--text-muted); font-style: italic; padding: 10px;">Chưa có phòng ban nào trực thuộc công ty này. Bấm "Thêm Phòng Ban" để gán.</div>
            ` : `
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;">
                ${compDepts.map(dept => {
                  const numEmps = deptStaffCount[dept.department_id] || 0;
                  // Positions in this department
                  const deptPositions = positions.filter(p => p.department_id === dept.department_id);

                  return `
                    <div class="org-dept-card" style="background: #FFFFFF; border: 1px solid var(--border-color); border-radius: 6px; padding: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                      <!-- Department Title -->
                      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px dashed var(--border-color); padding-bottom: 8px;">
                        <div>
                          <strong style="font-size: 13.5px; color: var(--primary-navy); display: block;">
                            <i class="fa-solid fa-building" style="color: #2563EB; margin-right: 5px;"></i>
                            ${dept.department_name}
                          </strong>
                          <span style="font-size: 11px; color: var(--text-muted); font-family: monospace;">${dept.department_id}</span>
                        </div>
                        <span class="badge badge-navy" style="font-size: 11px; font-weight: 700;">
                          ${numEmps} nhân sự
                        </span>
                      </div>

                      <!-- Positions List inside Department -->
                      <div style="margin-top: 8px;">
                        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 6px;">
                          Chức vụ / Vị trí (${deptPositions.length})
                        </div>
                        ${deptPositions.length === 0 ? `
                          <div style="font-size: 11.5px; color: var(--text-muted); font-style: italic;">Chưa gán chức vụ cụ thể</div>
                        ` : `
                          <div style="display: flex; flex-direction: column; gap: 4px;">
                            ${deptPositions.map(pos => {
                              const posCount = posStaffCount[pos.position_id] || 0;
                              return `
                                <div style="display: flex; align-items: center; justify-content: space-between; background: #F1F5F9; padding: 5px 8px; border-radius: 4px; font-size: 12px;">
                                  <span style="color: var(--text-primary); font-weight: 500;">
                                    <i class="fa-solid fa-briefcase" style="font-size: 10px; color: #475569; margin-right: 4px;"></i>
                                    ${pos.position_name}
                                  </span>
                                  <span style="font-size: 11px; color: #059669; font-weight: 700;">
                                    ${posCount} NS
                                  </span>
                                </div>
                              `;
                            }).join('')}
                          </div>
                        `}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>
        </div>
      `;
    });

    html += '</div>';
    container.innerHTML = html;
  },

  // ========================================================================
  // 5. GLOBAL DROPDOWNS SYNCHRONIZER
  // ========================================================================
  updateAllDropdowns() {
    this.populateFilterDropdowns();

    // 1. Employee Form & Filters
    if (window.appEmployees && typeof appEmployees.populateFilterDropdowns === 'function') {
      appEmployees.populateFilterDropdowns();
    }

    // 2. Resigned Filters
    if (window.appResigned && typeof appResigned.populateFilterDropdowns === 'function') {
      appResigned.populateFilterDropdowns();
    }

    // 3. Reports Dept Dropdown
    if (window.appReports && typeof appReports.populateDeptDropdown === 'function') {
      appReports.populateDeptDropdown();
    }

    // 4. Trash Filter Dropdown
    if (window.appTrash && typeof appTrash.populateFilterDropdowns === 'function') {
      appTrash.populateFilterDropdowns();
    }

    // 5. Update Sidebar Count badges
    const sideCompCount = document.getElementById('sidebar-company-count');
    if (sideCompCount) sideCompCount.textContent = (appData.companies || []).length;

    const sideDeptCount = document.getElementById('sidebar-dept-count');
    if (sideDeptCount) sideDeptCount.textContent = (appData.departments || []).length;
    
    const sidePosCount = document.getElementById('sidebar-pos-count');
    if (sidePosCount) sidePosCount.textContent = (appData.positions || []).length;
  },

  // ========================================================================
  // 6. CONTRACTS TABLE
  // ========================================================================
  renderContractsTable() {
    const tbody = document.getElementById('contracts-tbody');
    if (!tbody) return;

    const filtered = (appData.contracts || []).filter(c => {
      // 1. Search Query filter
      if (this.contractSearchQuery) {
        const cid = (c.contract_id || '').toLowerCase();
        const eid = (c.employee_id || '').toLowerCase();
        const name = (c.full_name || '').toLowerCase();
        const type = (c.contract_type || '').toLowerCase();
        const matchSearch = cid.includes(this.contractSearchQuery) || 
                            eid.includes(this.contractSearchQuery) || 
                            name.includes(this.contractSearchQuery) ||
                            type.includes(this.contractSearchQuery);
        if (!matchSearch) return false;
      }

      // 2. Contract Type Filter
      if (this.contractFilterType) {
        const type = (c.contract_type || '').toLowerCase();
        if (!type.includes(this.contractFilterType)) return false;
      }

      // 3. Contract Status Filter
      if (this.contractFilterStatus) {
        const st = (c.contract_status || '').toUpperCase();
        if (st !== this.contractFilterStatus.toUpperCase()) return false;
      }

      return true;
    });

    const total = filtered.length;
    const pageSize = this.contractPageSize || 25;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (this.contractPage > totalPages) {
      this.contractPage = totalPages;
    }
    const page = Math.max(1, this.contractPage);
    const start = (page - 1) * pageSize;
    const pageData = filtered.slice(start, start + pageSize);

    // Update pagination UI
    const infoEl = document.getElementById('contracts-pagination-info');
    if (infoEl) {
      if (total === 0) {
        infoEl.textContent = 'Hiển thị 0 / 0 hợp đồng';
      } else {
        const end = Math.min(start + pageSize, total);
        infoEl.textContent = `Hiển thị ${start + 1} - ${end} trên tổng số ${total} hợp đồng (Trang ${page}/${totalPages})`;
      }
    }

    const controlsEl = document.getElementById('contracts-pagination-controls');
    if (controlsEl) {
      if (totalPages <= 1) {
        controlsEl.innerHTML = '';
      } else {
        let buttonsHtml = '';
        buttonsHtml += `<button class="btn btn-sm btn-secondary" onclick="appOrganization.goContractPage(1)" ${page === 1 ? 'disabled' : ''} title="Trang đầu"><i class="fa-solid fa-angles-left"></i></button>`;
        buttonsHtml += `<button class="btn btn-sm btn-secondary" onclick="appOrganization.goContractPage(${page - 1})" ${page === 1 ? 'disabled' : ''} title="Trang trước"><i class="fa-solid fa-angle-left"></i></button>`;

        const startP = Math.max(1, page - 2);
        const endP = Math.min(totalPages, startP + 4);
        for (let p = startP; p <= endP; p++) {
          buttonsHtml += `<button class="btn btn-sm ${p === page ? 'btn-primary' : 'btn-secondary'}" onclick="appOrganization.goContractPage(${p})">${p}</button>`;
        }

        buttonsHtml += `<button class="btn btn-sm btn-secondary" onclick="appOrganization.goContractPage(${page + 1})" ${page === totalPages ? 'disabled' : ''} title="Trang sau"><i class="fa-solid fa-angle-right"></i></button>`;
        buttonsHtml += `<button class="btn btn-sm btn-secondary" onclick="appOrganization.goContractPage(${totalPages})" ${page === totalPages ? 'disabled' : ''} title="Trang cuối"><i class="fa-solid fa-angles-right"></i></button>`;
        controlsEl.innerHTML = buttonsHtml;
      }
    }

    if (pageData.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 24px; color: var(--text-muted);">
            <i class="fa-solid fa-file-excel" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
            Không tìm thấy hợp đồng phù hợp
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = pageData.map(c => {
      // Mã hợp đồng chính là mã nhân sự
      const contractCode = c.employee_id || c.contract_id || '-';
      const empId = c.employee_id || c.contract_id || '-';
      const isOfficial = c.contract_type && (c.contract_type.includes('KXD') || c.contract_type.toLowerCase().includes('không xác định'));
      const badgeType = isOfficial ? 'badge-active' : 'badge-navy';
      const statusBadge = (c.contract_status === 'HIỆU LỰC' || !c.contract_status)
        ? '<span class="badge badge-active"><i class="fa-solid fa-circle-check"></i> HIỆU LỰC</span>'
        : '<span class="badge badge-resigned"><i class="fa-solid fa-ban"></i> HẾT HẠN</span>';

      return `
        <tr>
          <td><strong style="color: var(--primary-navy); font-family: monospace;">${contractCode}</strong></td>
          <td>
            <span class="badge badge-navy" style="cursor: pointer;" onclick="appEmployees.openDetailModal('${empId}')" title="Xem chi tiết nhân viên">
              ${empId}
            </span>
          </td>
          <td><strong style="color: var(--text-primary); cursor: pointer;" onclick="appEmployees.openDetailModal('${empId}')">${c.full_name || '-'}</strong></td>
          <td><span class="badge ${badgeType}">${c.contract_type || '-'}</span></td>
          <td>${utils.formatDate(c.trial_start_date) || '-'}</td>
          <td>${utils.formatDate(c.official_date) || '-'}</td>
          <td>${statusBadge}</td>
        </tr>
      `;
    }).join('');
  },

  goContractPage(page) {
    this.contractPage = page;
    this.renderContractsTable();
    const tableEl = document.getElementById('view-contracts');
    if (tableEl) tableEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  // ========================================================================
  // 7. NAVIGATION HELPERS
  // ========================================================================
  filterEmployeesByDept(deptId) {
    const navEmp = document.querySelector('.nav-item[data-view="employees"]');
    if (navEmp) navEmp.click();
    
    setTimeout(() => {
      const select = document.getElementById('emp-filter-dept');
      if (select) {
        select.value = deptId;
        appEmployees.applyFilters();
      }
    }, 50);
  },

  filterEmployeesByPosition(posId) {
    const navEmp = document.querySelector('.nav-item[data-view="employees"]');
    if (navEmp) navEmp.click();

    setTimeout(() => {
      const search = document.getElementById('emp-search-input');
      if (search) {
        search.value = posId;
        appEmployees.applyFilters();
      }
    }, 50);
  }
};
