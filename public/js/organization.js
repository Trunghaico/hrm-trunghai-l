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
    if (!window.appContracts) {
      this.renderContractsTable();
    }
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

    if (!window.appContracts) {
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
          if (window.recordActivityLog) {
            window.recordActivityLog('UPDATE', 'Cơ cấu', `Cập nhật thông tin công ty: ${name} (${this.selectedCompanyId})`);
          }
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
          if (window.recordActivityLog) {
            window.recordActivityLog('CREATE', 'Cơ cấu', `Thêm mới công ty: ${name} (${id})`);
          }
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
        if (window.recordActivityLog) {
          window.recordActivityLog('DELETE', 'Cơ cấu', `Xóa công ty: ${comp.company_name} (${compId})`);
        }
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
          if (window.recordActivityLog) {
            window.recordActivityLog('UPDATE', 'Cơ cấu', `Cập nhật phòng ban: ${name} (${this.selectedDeptId})`);
          }
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
          if (window.recordActivityLog) {
            window.recordActivityLog('CREATE', 'Cơ cấu', `Thêm mới phòng ban: ${name} (${id})`);
          }
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
        if (window.recordActivityLog) {
          window.recordActivityLog('DELETE', 'Cơ cấu', `Xóa phòng ban: ${dept.department_name} (${deptId})`);
        }
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
          if (window.recordActivityLog) {
            window.recordActivityLog('UPDATE', 'Cơ cấu', `Cập nhật chức vụ/vị trí: ${name} (${this.selectedPosId})`);
          }
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
          if (window.recordActivityLog) {
            window.recordActivityLog('CREATE', 'Cơ cấu', `Thêm mới chức vụ/vị trí: ${name} (${id})`);
          }
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
        if (window.recordActivityLog) {
          window.recordActivityLog('DELETE', 'Cơ cấu', `Xóa chức vụ/vị trí: ${pos.position_name} (${posId})`);
        }
      } else {
        utils.showToast(json.message || 'Không thể xóa vị trí', 'error');
      }
    } catch (err) {
      console.error(err);
      utils.showToast('Lỗi máy chủ', 'error');
    }
  },

  // ========================================================================
  // 4. SƠ ĐỒ CƠ CẤU TỔ CHỨC & MÔ HÌNH QUẢN TRỊ HỆ THỐNG
  // ========================================================================
  chartMode: 'standard', // 'standard' (Sơ đồ Chuẩn Tập Đoàn) | 'governance' (Mô Hình Quản Trị Hệ Thống)
  zoomLevel: 1.0,

  switchChartMode(mode) {
    this.chartMode = mode;
    const btnStandard = document.getElementById('btn-org-mode-standard');
    const btnGov = document.getElementById('btn-org-mode-governance');

    if (btnStandard && btnGov) {
      if (mode === 'standard') {
        btnStandard.className = 'btn btn-sm btn-primary';
        btnStandard.style.background = 'var(--primary-navy)';
        btnStandard.style.borderColor = 'var(--primary-navy)';
        btnStandard.style.color = '#FFFFFF';

        btnGov.className = 'btn btn-sm btn-secondary';
        btnGov.style.background = '#FFFFFF';
        btnGov.style.borderColor = 'var(--border-color)';
        btnGov.style.color = 'var(--text-primary)';
      } else {
        btnGov.className = 'btn btn-sm btn-primary';
        btnGov.style.background = 'var(--primary-navy)';
        btnGov.style.borderColor = 'var(--primary-navy)';
        btnGov.style.color = '#FFFFFF';

        btnStandard.className = 'btn btn-sm btn-secondary';
        btnStandard.style.background = '#FFFFFF';
        btnStandard.style.borderColor = 'var(--border-color)';
        btnStandard.style.color = 'var(--text-primary)';
      }
    }
    this.renderOrgChart();
  },

  searchEmployeeByName(name) {
    if (!name) return;
    const cleanName = name.split('-')[0].trim();
    const empNavBtn = document.querySelector('[data-view="employees"]');
    if (empNavBtn) {
      empNavBtn.click();
      setTimeout(() => {
        const searchInput = document.getElementById('emp-search-input');
        if (searchInput) {
          searchInput.value = cleanName;
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (window.utils && utils.showToast) {
          utils.showToast(`Đang mở hồ sơ: ${cleanName}`, 'info');
        }
      }, 120);
    }
  },

  filterByDeptKeyword(keyword, deptTitle) {
    const empNavBtn = document.querySelector('[data-view="employees"]');
    if (empNavBtn) {
      empNavBtn.click();
      setTimeout(() => {
        const deptSelect = document.getElementById('emp-filter-dept');
        if (deptSelect) {
          let matchedVal = '';
          for (let i = 0; i < deptSelect.options.length; i++) {
            if (deptSelect.options[i].text.toLowerCase().includes(keyword.toLowerCase())) {
              matchedVal = deptSelect.options[i].value;
              break;
            }
          }
          if (matchedVal) {
            deptSelect.value = matchedVal;
            deptSelect.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            const searchInput = document.getElementById('emp-search-input');
            if (searchInput) {
              searchInput.value = deptTitle || keyword;
              searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }
        }
        if (window.utils && utils.showToast) {
          utils.showToast(`Đang lọc nhân sự: ${deptTitle || keyword}`, 'info');
        }
      }, 120);
    }
  },

  changeZoom(delta) {
    this.zoomLevel = Math.max(0.5, Math.min(1.5, Math.round((this.zoomLevel + delta) * 10) / 10));
    this.applyZoom();
  },

  resetZoom() {
    this.zoomLevel = 1.0;
    this.applyZoom();
  },

  applyZoom() {
    const container = document.getElementById('org-chart-tree-container');
    const indicator = document.getElementById('org-zoom-indicator');
    if (container) {
      container.style.transform = `scale(${this.zoomLevel})`;
    }
    if (indicator) {
      indicator.textContent = `${Math.round(this.zoomLevel * 100)}%`;
    }
  },

  printOrgChart() {
    window.print();
  },

  renderOrgChart() {
    if (this.chartMode === 'standard') {
      this.renderStandardOrgChart();
    } else {
      this.renderDynamicTreeChart();
    }
  },

  renderStandardOrgChart() {
    const container = document.getElementById('org-chart-tree-container');
    const tabsContainer = document.getElementById('org-company-tabs-container');
    if (!container) return;

    if (tabsContainer) {
      tabsContainer.style.display = 'none';
    }

    const html = `
      <div class="org-standard-wrapper">
        <!-- SVG Vector Connector Layer -->
        <svg class="org-standard-svg-layer" viewBox="0 0 1180 755">
          <defs>
            <marker id="org-arr-solid" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#000000" />
            </marker>
            <marker id="org-arr-solid-left" viewBox="0 0 10 10" refX="3" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 8 1.5 L 0 5 L 8 8.5 z" fill="#000000" />
            </marker>
            <marker id="org-arr-dotted" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#000000" />
            </marker>
            <marker id="org-arr-dotted-left" viewBox="0 0 10 10" refX="3" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 8 1.5 L 0 5 L 8 8.5 z" fill="#000000" />
            </marker>
            <marker id="org-arr-dashed-up" viewBox="0 0 10 10" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 1.5 8 L 5 0 L 8.5 8 z" fill="#000000" />
            </marker>
            <marker id="org-arr-dashed-down" viewBox="0 0 10 10" refX="5" refY="7" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 1.5 0 L 5 8 L 8.5 0 z" fill="#000000" />
            </marker>
          </defs>

          <!-- 1. Chỉ đạo: Chủ tịch HĐQT -> Phó chủ tịch HĐQT -->
          <line x1="590" y1="101" x2="590" y2="131" stroke="#000000" stroke-width="2" marker-end="url(#org-arr-solid)" />

          <!-- 2. Nhánh ngang từ HĐQT sang 2 cánh: Văn phòng HĐQT & Ban kiểm soát -->
          <path d="M 590 118 L 175 118 L 175 164" fill="none" stroke="#000000" stroke-width="2" marker-end="url(#org-arr-solid)" />
          <path d="M 590 118 L 1005 118 L 1005 164" fill="none" stroke="#000000" stroke-width="2" marker-end="url(#org-arr-solid)" />

          <!-- 3. Phối hợp: Văn phòng HĐQT <-> Khung vận hành -->
          <line x1="175" y1="244" x2="175" y2="266" stroke="#000000" stroke-width="2" stroke-dasharray="4,3" marker-start="url(#org-arr-dashed-up)" marker-end="url(#org-arr-dashed-down)" />

          <!-- 4. Giám sát: Ban kiểm soát nội bộ -> Tổng Giám Đốc -->
          <line x1="915" y1="205" x2="594" y2="205" stroke="#000000" stroke-width="1.8" stroke-dasharray="3,3" marker-end="url(#org-arr-dotted-left)" />

          <!-- 5. Giám sát: Ban kiểm soát nội bộ -> Khung vận hành -->
          <line x1="1005" y1="244" x2="1005" y2="266" stroke="#000000" stroke-width="1.8" stroke-dasharray="3,3" marker-end="url(#org-arr-dotted)" />

          <!-- 6. Chỉ đạo: Phó chủ tịch HĐQT -> Tổng Giám Đốc -->
          <line x1="590" y1="221" x2="590" y2="284" stroke="#000000" stroke-width="2" marker-end="url(#org-arr-solid)" />

          <!-- 7. Chỉ đạo: Tổng Giám Đốc -> Phó Tổng Giám Đốc Thi Công -->
          <line x1="590" y1="334" x2="590" y2="350" stroke="#000000" stroke-width="2" marker-end="url(#org-arr-solid)" />

          <!-- 8. Chỉ đạo: Phó TGĐ Thi Công -> 6 Ban chuyên môn (Bus ngang & 6 drop arrows) -->
          <line x1="590" y1="400" x2="590" y2="420" stroke="#000000" stroke-width="2" />
          <line x1="145" y1="420" x2="1035" y2="420" stroke="#000000" stroke-width="2" />
          <line x1="145" y1="420" x2="145" y2="438" stroke="#000000" stroke-width="2" marker-end="url(#org-arr-solid)" />
          <line x1="323" y1="420" x2="323" y2="438" stroke="#000000" stroke-width="2" marker-end="url(#org-arr-solid)" />
          <line x1="501" y1="420" x2="501" y2="438" stroke="#000000" stroke-width="2" marker-end="url(#org-arr-solid)" />
          <line x1="679" y1="420" x2="679" y2="438" stroke="#000000" stroke-width="2" marker-end="url(#org-arr-solid)" />
          <line x1="857" y1="420" x2="857" y2="438" stroke="#000000" stroke-width="2" marker-end="url(#org-arr-solid)" />
          <line x1="1035" y1="420" x2="1035" y2="438" stroke="#000000" stroke-width="2" marker-end="url(#org-arr-solid)" />

          <!-- 9. Giám sát & liên kết: Dưới 6 Ban -> Các Công Ty Thành Viên -->
          <line x1="145" y1="575" x2="1035" y2="575" stroke="#000000" stroke-width="1.8" stroke-dasharray="3,3" />
          <line x1="145" y1="540" x2="145" y2="575" stroke="#000000" stroke-width="1.8" stroke-dasharray="3,3" />
          <line x1="323" y1="540" x2="323" y2="575" stroke="#000000" stroke-width="1.8" stroke-dasharray="3,3" />
          <line x1="501" y1="548" x2="501" y2="575" stroke="#000000" stroke-width="1.8" stroke-dasharray="3,3" />
          <line x1="679" y1="540" x2="679" y2="575" stroke="#000000" stroke-width="1.8" stroke-dasharray="3,3" />
          <line x1="857" y1="548" x2="857" y2="575" stroke="#000000" stroke-width="1.8" stroke-dasharray="3,3" />
          <line x1="1035" y1="540" x2="1035" y2="575" stroke="#000000" stroke-width="1.8" stroke-dasharray="3,3" />

          <!-- Drop dotted arrows into bottom level -->
          <line x1="145" y1="575" x2="145" y2="618" stroke="#000000" stroke-width="1.8" stroke-dasharray="3,3" marker-end="url(#org-arr-dotted)" />
          <line x1="501" y1="575" x2="501" y2="618" stroke="#000000" stroke-width="1.8" stroke-dasharray="3,3" marker-end="url(#org-arr-dotted)" />
          <line x1="679" y1="575" x2="679" y2="618" stroke="#000000" stroke-width="1.8" stroke-dasharray="3,3" marker-end="url(#org-arr-dotted)" />
          <line x1="857" y1="575" x2="857" y2="618" stroke="#000000" stroke-width="1.8" stroke-dasharray="3,3" marker-end="url(#org-arr-dotted)" />
          <line x1="1035" y1="575" x2="1035" y2="618" stroke="#000000" stroke-width="1.8" stroke-dasharray="3,3" marker-end="url(#org-arr-dotted)" />

          <!-- 10. Mũi tên 2 chiều: Các Công Ty Thành Viên <-> Khung vận hành -->
          <line x1="36" y1="642" x2="381" y2="642" stroke="#000000" stroke-width="2" marker-start="url(#org-arr-solid-left)" marker-end="url(#org-arr-solid)" />
          <line x1="799" y1="642" x2="1144" y2="642" stroke="#000000" stroke-width="2" marker-start="url(#org-arr-solid-left)" marker-end="url(#org-arr-solid)" />
        </svg>

        <!-- TOP LEFT: LOGO & CORPORATE TITLE -->
        <div style="position: absolute; left: 30px; top: 16px; display: flex; align-items: center; gap: 8px;">
          <svg width="24" height="24" viewBox="0 0 24 24">
            <polygon points="12,2 22,20 2,20" fill="#DC2626" stroke="#991B1B" stroke-width="1.5" />
          </svg>
          <span style="font-size: 14px; font-weight: 700; color: #475569; letter-spacing: 0.5px; text-transform: uppercase;">
            CÔNG TY CỔ PHẦN XÂY DỰNG VÀ ĐẦU TƯ TRUNG HẢI
          </span>
        </div>

        <!-- TOP LEFT BADGE -->
        <div style="position: absolute; left: 30px; top: 48px; display: inline-flex; flex-direction: column; border-radius: 2px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.12);">
          <div style="background: #1E1B4B; color: #FFFFFF; font-weight: 800; font-size: 16px; padding: 4px 18px; letter-spacing: 0.5px; text-transform: uppercase;">
            THÔNG TIN CHUNG
          </div>
          <div style="background: #020617; color: #FFFFFF; font-weight: 800; font-size: 17px; padding: 4px 18px; letter-spacing: 0.5px; text-transform: uppercase;">
            SƠ ĐỒ TỔ CHỨC NHÂN SỰ
          </div>
        </div>

        <!-- TOP RIGHT LEGEND (CHÚ THÍCH) -->
        <div style="position: absolute; right: 35px; top: 18px; display: flex; flex-direction: column; gap: 5px; font-size: 12.5px; font-weight: 600; color: #1E293B;">
          <div style="display: flex; align-items: center; gap: 12px; justify-content: flex-end;">
            <svg width="36" height="12"><line x1="3" y1="6" x2="33" y2="6" stroke="#000" stroke-width="1.8" stroke-dasharray="4,3" marker-start="url(#org-arr-dotted-left)" marker-end="url(#org-arr-dotted)"/></svg>
            <span style="min-width: 60px;">Phối hợp</span>
          </div>
          <div style="display: flex; align-items: center; gap: 12px; justify-content: flex-end;">
            <svg width="36" height="12"><line x1="3" y1="6" x2="33" y2="6" stroke="#000" stroke-width="1.8" marker-end="url(#org-arr-solid)"/></svg>
            <span style="min-width: 60px;">Chỉ đạo</span>
          </div>
          <div style="display: flex; align-items: center; gap: 12px; justify-content: flex-end;">
            <svg width="36" height="12"><line x1="3" y1="6" x2="33" y2="6" stroke="#000" stroke-width="1.8" stroke-dasharray="2.5,2.5" marker-end="url(#org-arr-dotted)"/></svg>
            <span style="min-width: 60px;">Giám sát</span>
          </div>
        </div>

        <!-- 1. CHỦ TỊCH HĐQT TRUNG HẢI GROUP -->
        <div class="org-hdqt-chair org-node-interactive" style="position: absolute; left: 465px; top: 35px; z-index: 3;" onclick="appOrganization.searchEmployeeByName('Văn Phú Thành')" title="Bấm để xem hồ sơ Chủ tịch HĐQT Văn Phú Thành">
          <div class="org-hdr">CHỦ TỊCH HĐQT TRUNG HẢI GROUP</div>
          <div class="org-body">Văn Phú Thành</div>
        </div>

        <!-- 2. PHÓ CHỦ TỊCH HĐQT -->
        <div class="org-hdqt-vice org-node-interactive" style="position: absolute; left: 415px; top: 135px; z-index: 3;">
          <div class="org-hdr">PHÓ CHỦ TỊCH HĐQT</div>
          <div class="org-body">
            <div style="width: 50%; padding-right: 8px; border-right: 1px solid #FCA5A5; text-align: center; cursor: pointer;" onclick="appOrganization.searchEmployeeByName('Lê Việt Anh')" title="Bấm để xem hồ sơ Lê Việt Anh">
              <div style="font-weight: 800; font-size: 13px; color: #0F172A;">Lê Việt Anh</div>
              <div style="font-size: 10.5px; color: #334155; line-height: 1.3; margin-top: 2px;">Phụ trách tài chính kiêm TGĐ Thành Phát</div>
            </div>
            <div style="width: 50%; padding-left: 8px; text-align: center; cursor: pointer;" onclick="appOrganization.searchEmployeeByName('Trần Minh Tuấn')" title="Bấm để xem hồ sơ Trần Minh Tuấn">
              <div style="font-weight: 800; font-size: 13px; color: #0F172A;">Trần Minh Tuấn</div>
              <div style="font-size: 10.5px; color: #334155; line-height: 1.3; margin-top: 2px;">Phụ trách thi công cầu, đường kiêm Giám đốc BĐH DA Ngọc Hồi</div>
            </div>
          </div>
        </div>

        <!-- LEFT WING: VĂN PHÒNG HĐQT -->
        <div class="org-wing-card org-node-interactive" style="position: absolute; left: 85px; top: 168px; z-index: 3;" onclick="appOrganization.searchEmployeeByName('Đào Phước Minh Thông')" title="Bấm để xem hồ sơ Chánh Văn phòng Đào Phước Minh Thông">
          <div class="org-hdr">VĂN PHÒNG HĐQT</div>
          <div class="org-body">
            <div style="font-weight: 800; font-size: 13px; color: #0F172A;">Đào Phước Minh Thông</div>
            <div style="font-size: 11px; color: #334155; margin-top: 2px;">Chánh Văn phòng</div>
          </div>
        </div>

        <!-- RIGHT WING: BAN KIỂM SOÁT NỘI BỘ -->
        <div class="org-wing-card org-node-interactive" style="position: absolute; left: 915px; top: 168px; z-index: 3;" onclick="appOrganization.searchEmployeeByName('Nguyễn Tấn Minh')" title="Bấm để xem hồ sơ Trưởng ban Kiểm soát Nguyễn Tấn Minh">
          <div class="org-hdr">BAN KIỂM SOÁT NỘI BỘ</div>
          <div class="org-body">
            <div style="font-weight: 800; font-size: 13px; color: #0F172A;">Nguyễn Tấn Minh</div>
            <div style="font-size: 11px; color: #334155; margin-top: 2px;">Trưởng ban</div>
          </div>
        </div>

        <!-- OPERATIONAL BOUNDARY (KHUNG VIỀN NÉT ĐỨT PHỐI HỢP) -->
        <div style="position: absolute; left: 30px; top: 270px; width: 1120px; height: 425px; border: 2px dashed #000000; border-radius: 4px; pointer-events: none; z-index: 1;"></div>

        <!-- 3. TỔNG GIÁM ĐỐC -->
        <div class="org-tgd-card org-node-interactive" style="position: absolute; left: 492px; top: 288px; z-index: 3;" onclick="appOrganization.searchEmployeeByName('Nguyễn Anh Minh')" title="Bấm để xem hồ sơ Tổng Giám Đốc Nguyễn Anh Minh">
          <div style="font-weight: 800; font-size: 12px; color: #DC2626; text-transform: uppercase;">TỔNG GIÁM ĐỐC</div>
          <div style="font-weight: 800; font-size: 14.5px; color: #0F172A; margin-top: 1px;">Nguyễn Anh Minh</div>
        </div>

        <!-- 4. PHÓ TỔNG GIÁM ĐỐC THI CÔNG -->
        <div class="org-ptgd-card org-node-interactive" style="position: absolute; left: 470px; top: 354px; z-index: 3;" onclick="appOrganization.filterByDeptKeyword('TỔNG GIÁM ĐỐC', 'Ban TGĐ')" title="Bấm để xem nhân sự Ban TGĐ">
          <div style="font-weight: 800; font-size: 11.5px; color: #0F172A; text-transform: uppercase;">PHÓ TỔNG GIÁM ĐỐC THI CÔNG</div>
          <div style="font-weight: 800; font-size: 13px; color: #0F172A; margin-top: 1px;">Lê Hồng Thạch - Trương Công Đạt</div>
        </div>

        <!-- 5. 6 BAN CHUYÊN MÔN -->
        <!-- Ban 1: Kế hoạch tổng hợp -->
        <div class="org-ban-card org-node-interactive" style="position: absolute; left: 65px; top: 442px; z-index: 3;" onclick="appOrganization.filterByDeptKeyword('KẾ HOẠCH', 'Ban Kế Hoạch Tổng Hợp')" title="Xem nhân sự Ban Kế Hoạch Tổng Hợp">
          <div class="org-hdr">BAN KẾ HOẠCH TỔNG HỢP</div>
          <div class="org-body">
            <div>
              <div style="font-weight: 700; color: #0F172A;">Nguyễn Văn Đạo</div>
              <div style="font-size: 10px; color: #475569;">Trưởng ban</div>
            </div>
            <div>
              <div style="font-weight: 700; color: #0F172A;">Dương Thái Thịnh</div>
              <div style="font-size: 10px; color: #475569;">Phó ban</div>
            </div>
          </div>
        </div>

        <!-- Ban 2: Quản lý thiết bị -->
        <div class="org-ban-card org-node-interactive" style="position: absolute; left: 243px; top: 442px; z-index: 3;" onclick="appOrganization.filterByDeptKeyword('THIẾT BỊ', 'Ban Quản Lý Thiết Bị')" title="Xem nhân sự Ban Quản Lý Thiết Bị">
          <div class="org-hdr">BAN QUẢN LÝ THIẾT BỊ</div>
          <div class="org-body">
            <div>
              <div style="font-weight: 700; color: #0F172A;">Đào Phước Minh Thông</div>
              <div style="font-size: 10px; color: #475569;">Trưởng ban</div>
            </div>
            <div>
              <div style="font-weight: 700; color: #0F172A;">Trần Nguyên Hải</div>
              <div style="font-size: 10px; color: #475569;">Phó ban</div>
            </div>
          </div>
        </div>

        <!-- Ban 3: Điều hành dự án -->
        <div class="org-ban-card org-node-interactive" style="position: absolute; left: 421px; top: 442px; z-index: 3;" onclick="appOrganization.filterByDeptKeyword('ĐIỀU HÀNH', 'Ban Điều Hành Dự Án')" title="Xem nhân sự Ban Điều Hành Dự Án">
          <div class="org-hdr">BAN ĐIỀU HÀNH DỰ ÁN</div>
          <div class="org-body" style="gap: 2px;">
            <div style="font-size: 10.5px; line-height: 1.25;">
              <span style="font-weight: 700; color: #0F172A;">Lê Hồng Thạch</span>
              <div style="font-size: 9.5px; color: #475569;">Giám đốc BĐH Núi Vung</div>
            </div>
            <div style="font-size: 10.5px; line-height: 1.25;">
              <span style="font-weight: 700; color: #0F172A;">Trương Công Đạt</span>
              <div style="font-size: 9.5px; color: #475569;">Giám đốc BĐH CTVP, KHBMT</div>
            </div>
            <div style="font-size: 10.5px; line-height: 1.25;">
              <span style="font-weight: 700; color: #0F172A;">Nguyễn Vũ Anh</span>
              <div style="font-size: 9.5px; color: #475569;">Giám đốc BĐH TLMT</div>
            </div>
          </div>
        </div>

        <!-- Ban 4: Tổ chức hành chính -->
        <div class="org-ban-card org-node-interactive" style="position: absolute; left: 599px; top: 442px; z-index: 3;" onclick="appOrganization.filterByDeptKeyword('HÀNH CHÍNH', 'Ban Tổ Chức Hành Chính')" title="Xem nhân sự Ban Tổ Chức Hành Chính">
          <div class="org-hdr">BAN TỔ CHỨC HÀNH CHÍNH</div>
          <div class="org-body">
            <div>
              <div style="font-weight: 700; color: #0F172A;">Hoàng Văn Chung</div>
              <div style="font-size: 10.5px; color: #475569; margin-top: 2px;">Trưởng ban</div>
            </div>
          </div>
        </div>

        <!-- Ban 5: Tài chính - Kế toán -->
        <div class="org-ban-card org-node-interactive" style="position: absolute; left: 777px; top: 442px; z-index: 3;" onclick="appOrganization.filterByDeptKeyword('KẾ TOÁN', 'Ban Tài Chính - Kế Toán')" title="Xem nhân sự Ban Tài Chính - Kế Toán">
          <div class="org-hdr">BAN TÀI CHÍNH - KẾ TOÁN</div>
          <div class="org-body" style="gap: 2px;">
            <div style="font-size: 10.5px; line-height: 1.2;">
              <span style="font-weight: 700; color: #0F172A;">Phan Thành Trung</span>
              <div style="font-size: 9.5px; color: #475569;">Kế toán trưởng</div>
            </div>
            <div style="font-size: 10.5px; line-height: 1.2;">
              <span style="font-weight: 700; color: #0F172A;">Nguyễn Thị Quỳnh Hương</span>
              <div style="font-size: 9.5px; color: #475569;">Phó ban</div>
            </div>
            <div style="font-size: 10.5px; line-height: 1.2;">
              <span style="font-weight: 700; color: #0F172A;">Vũ Thị Thanh Hoa</span>
              <div style="font-size: 9.5px; color: #475569;">Phó ban</div>
            </div>
          </div>
        </div>

        <!-- Ban 6: Pháp chế -->
        <div class="org-ban-card org-node-interactive" style="position: absolute; left: 955px; top: 442px; z-index: 3;" onclick="appOrganization.filterByDeptKeyword('PHÁP CHẾ', 'Ban Pháp Chế')" title="Xem nhân sự Ban Pháp Chế">
          <div class="org-hdr">BAN PHÁP CHẾ</div>
          <div class="org-body">
            <div>
              <div style="font-weight: 700; color: #0F172A;">Hoàng Văn Chung</div>
              <div style="font-size: 10px; color: #475569;">Trưởng ban</div>
            </div>
            <div>
              <div style="font-weight: 700; color: #0F172A;">Nguyễn Hữu Tiên</div>
              <div style="font-size: 10px; color: #475569;">Phó ban</div>
            </div>
          </div>
        </div>

        <!-- 6. CÁC CÔNG TY THÀNH VIÊN/ĐƠN VỊ TRỰC THUỘC -->
        <div class="org-subsidiaries-bar org-node-interactive" style="position: absolute; left: 385px; top: 622px; z-index: 3;" onclick="appOrganization.switchChartMode('governance')" title="Bấm để xem Mô Hình Quản Trị Hệ Thống">
          CÁC CÔNG TY THÀNH VIÊN/ĐƠN VỊ TRỰC THUỘC
        </div>

        <!-- FOOTER: LƯU HÀNH NỘI BỘ & TRANG 5 -->
        <div style="position: absolute; left: 30px; bottom: 12px; font-size: 12px; font-style: italic; color: #64748B;">
          Lưu hành nội bộ
        </div>
        <div style="position: absolute; right: 35px; bottom: 10px; font-size: 16px; font-weight: 700; color: #0F172A;">
          5
        </div>
      </div>
    `;

    container.innerHTML = html;
    this.applyZoom();
  },

  renderGovernanceModelChart() {
    const container = document.getElementById('org-chart-tree-container');
    if (!container) return;

    const html = `
      <div class="org-governance-wrapper" style="background: #FFFFFF; border-radius: 8px; border: 1px solid #CBD5E1; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); width: 1120px; min-width: 1120px; max-width: 1120px; padding: 28px 36px 32px 36px; margin: 0 auto; box-sizing: border-box; text-align: left;">
        <!-- Header Section -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; border-bottom: 2px solid #F1F5F9; padding-bottom: 16px;">
          <div>
            <div style="font-size: 22px; font-weight: 800; color: #DC2626; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 10px;">
              <i class="fa-solid fa-network-wired" style="color: #DC2626;"></i>
              <span>MÔ HÌNH QUẢN TRỊ HỆ THỐNG</span>
            </div>
            <div style="font-size: 13px; color: #64748B; margin-top: 4px;">
              Cơ cấu sở hữu &amp; quản trị điều hành Trung Hải Group và 3 công ty thành viên (Phú Minh &bull; Thành Phát &bull; Trung Nam)
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <a href="assets/mo_hinh_quan_tri_he_thong.png" target="_blank" class="btn btn-sm btn-secondary" style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600;">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> Mở Ảnh Gốc
            </a>
          </div>
        </div>

        <!-- Official Governance Model Chart Image (High Resolution) -->
        <div style="background: #FFFFFF; border-radius: 8px; overflow: hidden; display: flex; justify-content: center; align-items: center; padding: 6px 0; border: 1px solid #F1F5F9; box-shadow: inset 0 1px 4px rgba(0,0,0,0.03);">
          <img src="assets/mo_hinh_quan_tri_he_thong.png" alt="Mô Hình Quản Trị Hệ Thống - Trung Hải Group" style="max-width: 100%; height: auto; display: block; border-radius: 6px;" />
        </div>

        <!-- Quick Access To Member Companies -->
        <div style="margin-top: 28px; padding-top: 20px; border-top: 1px dashed #CBD5E1;">
          <div style="font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-building"></i> Danh Sách 4 Công Ty Trong Hệ Thống:
          </div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px;">
            <!-- THG -->
            <div class="org-node-interactive" style="background: #F8FAFC; border: 1.5px solid #CBD5E1; border-radius: 8px; padding: 14px; cursor: pointer; transition: all 0.2s ease;" onclick="appOrganization.filterByCompany('THG')" title="Xem nhân sự Trung Hải Group">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span class="badge" style="background: #1E3A8A; color: #FFF; font-weight: 800; font-size: 11px; padding: 3px 8px;">THG</span>
                <span style="font-weight: 700; font-size: 13px; color: #0F172A;">TRUNG HẢI GROUP</span>
              </div>
              <div style="font-size: 11.5px; color: #475569; line-height: 1.45;">
                Chủ tịch HĐQT: <strong style="color: #DC2626;">Văn Phú Thành</strong>
              </div>
              <div style="font-size: 11px; color: #2563EB; font-weight: 600; margin-top: 10px; display: flex; align-items: center; gap: 4px;">
                <span>Xem nhân sự</span> <i class="fa-solid fa-arrow-right" style="font-size: 10px;"></i>
              </div>
            </div>

            <!-- Phú Minh -->
            <div class="org-node-interactive" style="background: #F8FAFC; border: 1.5px solid #CBD5E1; border-radius: 8px; padding: 14px; cursor: pointer; transition: all 0.2s ease;" onclick="appOrganization.filterByCompany('PM')" title="Xem nhân sự Phú Minh">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span class="badge" style="background: #DC2626; color: #FFF; font-weight: 800; font-size: 11px; padding: 3px 8px;">PM</span>
                <span style="font-weight: 700; font-size: 12.5px; color: #0F172A;">CTCP XDGT PHÚ MINH</span>
              </div>
              <div style="font-size: 11.5px; color: #475569; line-height: 1.45;">
                CT HĐQT: <strong>Nguyễn Anh Minh</strong><br>
                Giám đốc: <strong>Lê Hồng Thạch</strong>
              </div>
              <div style="font-size: 11px; color: #2563EB; font-weight: 600; margin-top: 10px; display: flex; align-items: center; gap: 4px;">
                <span>Xem nhân sự</span> <i class="fa-solid fa-arrow-right" style="font-size: 10px;"></i>
              </div>
            </div>

            <!-- Thành Phát -->
            <div class="org-node-interactive" style="background: #F8FAFC; border: 1.5px solid #CBD5E1; border-radius: 8px; padding: 14px; cursor: pointer; transition: all 0.2s ease;" onclick="appOrganization.filterByCompany('TP')" title="Xem nhân sự Thành Phát">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span class="badge" style="background: #0284C7; color: #FFF; font-weight: 800; font-size: 11px; padding: 3px 8px;">TP</span>
                <span style="font-weight: 700; font-size: 12.5px; color: #0F172A;">CTCP CẦU ĐƯỜNG THÀNH PHÁT</span>
              </div>
              <div style="font-size: 11.5px; color: #475569; line-height: 1.45;">
                TGĐ: <strong>Lê Việt Anh</strong><br>
                Phó TGĐ: <strong>Ngô Hữu Khoa</strong>
              </div>
              <div style="font-size: 11px; color: #2563EB; font-weight: 600; margin-top: 10px; display: flex; align-items: center; gap: 4px;">
                <span>Xem nhân sự</span> <i class="fa-solid fa-arrow-right" style="font-size: 10px;"></i>
              </div>
            </div>

            <!-- Trung Nam -->
            <div class="org-node-interactive" style="background: #F8FAFC; border: 1.5px solid #CBD5E1; border-radius: 8px; padding: 14px; cursor: pointer; transition: all 0.2s ease;" onclick="appOrganization.filterByCompany('TN')" title="Xem nhân sự Trung Nam">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span class="badge" style="background: #059669; color: #FFF; font-weight: 800; font-size: 11px; padding: 3px 8px;">TN</span>
                <span style="font-weight: 700; font-size: 12.5px; color: #0F172A;">TNHH ĐT&amp;KD TRUNG NAM</span>
              </div>
              <div style="font-size: 11.5px; color: #475569; line-height: 1.45;">
                TGĐ: <strong>Nguyễn Thị Tuyết Nhung</strong><br>
                Phó TGĐ: <strong>Lê Trần Bội Uyên</strong>
              </div>
              <div style="font-size: 11px; color: #2563EB; font-weight: 600; margin-top: 10px; display: flex; align-items: center; gap: 4px;">
                <span>Xem nhân sự</span> <i class="fa-solid fa-arrow-right" style="font-size: 10px;"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
    this.applyZoom();
  },

  filterByCompany(compId) {
    const empNavBtn = document.querySelector('[data-view="employees"]');
    if (empNavBtn) {
      empNavBtn.click();
      setTimeout(() => {
        const deptSelect = document.getElementById('emp-filter-dept');
        if (deptSelect) {
          for (let i = 0; i < deptSelect.options.length; i++) {
            if (deptSelect.options[i].value.includes(compId) || deptSelect.options[i].text.includes(compId)) {
              deptSelect.value = deptSelect.options[i].value;
              deptSelect.dispatchEvent(new Event('change', { bubbles: true }));
              break;
            }
          }
        }
        if (window.utils && utils.showToast) {
          utils.showToast(`Đang lọc nhân sự công ty: ${compId}`, 'info');
        }
      }, 120);
    }
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
    if (window.appContracts && typeof appContracts.render === 'function') {
      appContracts.render();
      return;
    }
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
