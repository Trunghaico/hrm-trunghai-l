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
  // 4. SƠ ĐỒ CƠ CẤU TỔ CHỨC CÂY PHÂN NHÁNH CHUẨN QUỐC TẾ (4 CÔNG TY)
  // ========================================================================
  selectedCompanyTab: 'ALL', // 'ALL' | 'THG' | 'TP' | 'TN' | 'PM'
  expandedDeptNodes: new Set(),
  zoomLevel: 1.0,

  selectCompanyTab(compId) {
    this.selectedCompanyTab = compId;
    this.renderOrgChart();
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

  // Phân loại phòng ban vào các tầng thứ bậc chuẩn hóa
  classifyDepartmentTier(dept) {
    const name = (dept.department_name || '').toUpperCase().trim();
    const id = (dept.department_id || '').toUpperCase().trim();

    // 1. Tầng 1: Ban Tổng Giám Đốc / HĐQT
    if (name.includes('BAN TỔNG GIÁM ĐỐC') || name.includes('BAN TONG GIAM') || id.startsWith('BTGD') || name.includes('HỘI ĐỒNG QUẢN TRỊ') || name.includes('HĐQT')) {
      return {
        tier: 1,
        tierCode: 'BTGD',
        tierName: 'Ban Tổng Giám Đốc',
        badgeClass: 'badge-tier-1',
        icon: 'fa-crown',
        color: '#991B1B',
        bgColor: '#FEF2F2',
        borderColor: '#DC2626'
      };
    }

    // 2. Tầng 2: Ban Giám Đốc
    if (name.includes('BAN GIÁM ĐỐC') || name.includes('BAN GIAM DOC') || id.startsWith('BGD') || name.includes('BAN LÃNH ĐẠO')) {
      return {
        tier: 2,
        tierCode: 'BGD',
        tierName: 'Ban Giám Đốc',
        badgeClass: 'badge-tier-2',
        icon: 'fa-building-columns',
        color: '#3730A3',
        bgColor: '#EEF2FF',
        borderColor: '#4F46E5'
      };
    }

    // 3. Tầng Dưới Phòng (Tier 5): Ban Điều Hành Dự Án & Các Khối Vận Hành Công Trường
    // Ban Điều Hành Dự Án Phú Minh (BDHDA.PM) và các khối trực tiếp / gián tiếp nằm DƯỚI PHÒNG
    if (id.includes('BDHDA.PM') || name.includes('BAN ĐIỀU HÀNH DỰ ÁN PHÚ MINH') || name.startsWith('KHỐI') || name.startsWith('KHOI') || id.includes('GIANTIEP') || id.includes('TRUCTIEP') || id.includes('VP_')) {
      const isBdhda = id.includes('BDHDA') || name.includes('ĐIỀU HÀNH DỰ ÁN');
      return {
        tier: 5,
        tierCode: 'DUOI_PHONG',
        tierName: isBdhda ? 'Ban Điều Hành Dự Án' : 'Khối Đơn Vị',
        badgeClass: 'badge-tier-5',
        icon: isBdhda ? 'fa-trowel-bricks' : 'fa-cubes-stacked',
        color: '#0F766E',
        bgColor: '#F0FDFA',
        borderColor: '#0D9488'
      };
    }

    // 4. Tầng 3: Các Ban Chuyên Môn Trực Thuộc Hội Sở / Tổng Công Ty (BTCHC, BTCKT, BKHTH, BQLTB, BPC...)
    if ((name.startsWith('BAN ') || id.startsWith('B')) && !id.startsWith('P')) {
      return {
        tier: 3,
        tierCode: 'BAN',
        tierName: 'Ban Chuyên Môn',
        badgeClass: 'badge-tier-3',
        icon: 'fa-sitemap',
        color: '#0369A1',
        bgColor: '#F0F9FF',
        borderColor: '#0284C7'
      };
    }

    // 5. Tầng 4: Các Phòng Ban Chức Năng (PHCNS, PTCKT, PKHTH, PKDTM...)
    return {
      tier: 4,
      tierCode: 'PHONG',
      tierName: 'Phòng Ban Chức Năng',
      badgeClass: 'badge-tier-4-phong',
      icon: 'fa-folder-open',
      color: '#047857',
      bgColor: '#ECFDF5',
      borderColor: '#059669'
    };
  },

  // Mở rộng hoặc thu gọn tất cả vị trí chức danh
  expandAllNodes(expand = true) {
    if (expand) {
      (appData.departments || []).forEach(d => this.expandedDeptNodes.add(d.department_id));
    } else {
      this.expandedDeptNodes.clear();
    }
    this.renderOrgChart();
  },

  toggleNodeExpand(deptId) {
    if (this.expandedDeptNodes.has(deptId)) {
      this.expandedDeptNodes.delete(deptId);
    } else {
      this.expandedDeptNodes.add(deptId);
    }
    this.renderOrgChart();
  },

  printOrgChart() {
    window.print();
  },

  renderOrgChart() {
    const container = document.getElementById('org-chart-tree-container');
    const tabsContainer = document.getElementById('org-company-tabs-container');
    if (!container) return;

    const companies = appData.companies || [];
    const departments = appData.departments || [];
    const positions = appData.positions || [];
    const employees = appData.employees || [];

    // Map staff counts
    const deptStaffCount = {};
    const posStaffCount = {};
    employees.forEach(e => {
      if (e.department_id) deptStaffCount[e.department_id] = (deptStaffCount[e.department_id] || 0) + 1;
      if (e.position_id) posStaffCount[e.position_id] = (posStaffCount[e.position_id] || 0) + 1;
    });

    // 1. Render Company Tabs Selector
    if (tabsContainer) {
      let tabsHtml = `
        <button class="btn btn-sm ${this.selectedCompanyTab === 'ALL' ? 'btn-primary' : 'btn-secondary'}" onclick="appOrganization.selectCompanyTab('ALL')" style="white-space: nowrap; font-weight: 700; ${this.selectedCompanyTab === 'ALL' ? 'background: var(--primary-navy); border-color: var(--primary-navy);' : ''}">
          <i class="fa-solid fa-layer-group"></i> Tất Cả 4 Công Ty
        </button>
      `;

      companies.forEach(comp => {
        const isSelected = this.selectedCompanyTab === comp.company_id;
        const compDepts = departments.filter(d => (d.company_id || 'THG') === comp.company_id);
        let compStaff = 0;
        compDepts.forEach(d => { compStaff += (deptStaffCount[d.department_id] || 0); });

        const shortName = comp.company_name.replace('CÔNG TY CỔ PHẦN', 'CTCP').replace('CÔNG TY CP', 'CTCP').replace('CÔNG TY TNHH', 'TNHH');

        tabsHtml += `
          <button class="btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}" onclick="appOrganization.selectCompanyTab('${comp.company_id}')" style="white-space: nowrap; font-weight: 600; ${isSelected ? 'background: var(--primary-navy); border-color: var(--primary-navy);' : ''}" title="${comp.company_name}">
            <i class="fa-solid fa-city"></i> ${comp.company_id} - ${shortName}
            <span class="badge" style="background: rgba(0,0,0,0.12); color: inherit; font-size: 10px; margin-left: 4px;">${compStaff} NS</span>
          </button>
        `;
      });

      tabsContainer.innerHTML = tabsHtml;
    }

    if (companies.length === 0) {
      container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 40px;">Chưa có dữ liệu công ty</div>';
      return;
    }

    // Filter displayed companies
    const displayedCompanies = this.selectedCompanyTab === 'ALL' 
      ? companies 
      : companies.filter(c => c.company_id === this.selectedCompanyTab);

    let html = '<div class="org-charts-wrapper">';

    // Helper function to render a single department card node
    const renderDeptCard = (item, levelLabel, isRoot = false) => {
      const dept = item;
      const numEmps = deptStaffCount[dept.department_id] || 0;
      const deptPositions = positions.filter(p => p.department_id === dept.department_id);
      const isExpanded = this.expandedDeptNodes.has(dept.department_id);

      return `
        <div class="org-node-card ${isRoot ? 'org-node-root' : ''}" style="border-top-color: ${item.info.borderColor} !important;">
          <!-- Level Indicator Badge -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span class="badge" style="background: ${item.info.bgColor}; color: ${item.info.color}; font-size: 10.5px; font-weight: 700; border: 1px solid ${item.info.borderColor}; padding: 2px 7px;">
              <i class="fa-solid ${item.info.icon}"></i> ${levelLabel}
            </span>
            <button class="badge" onclick="appOrganization.filterEmployeesByDept('${dept.department_id}')" title="Xem ${numEmps} nhân sự thuộc đơn vị này" style="background: #047857; color: #FFFFFF; font-size: 11px; font-weight: 800; padding: 2px 8px; border: none; cursor: pointer;">
              <i class="fa-solid fa-users" style="font-size: 10px; margin-right: 3px;"></i> ${numEmps} NS
            </button>
          </div>

          <!-- Department Title -->
          <div style="font-size: 13.5px; font-weight: 700; color: #1E293B; line-height: 1.35; margin-bottom: 4px;">
            ${dept.department_name}
          </div>
          <div style="font-size: 11px; color: #64748B; font-family: monospace; margin-bottom: 8px;">
            Mã: ${dept.department_id}
          </div>

          <!-- Position Summary / Expandable Section -->
          <div style="border-top: 1px dashed #E2E8F0; padding-top: 6px; font-size: 11.5px; margin-top: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none;" onclick="appOrganization.toggleNodeExpand('${dept.department_id}')">
              <span style="color: #475569; font-weight: 600; font-size: 11px;">
                <i class="fa-solid fa-briefcase" style="color: #64748B; font-size: 10px;"></i> Vị trí / Chức danh (${deptPositions.length})
              </span>
              <span style="color: #2563EB; font-size: 11px;">
                <i class="fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}"></i>
              </span>
            </div>

            ${isExpanded ? `
              <div class="org-pos-list">
                ${deptPositions.length === 0 ? `
                  <div style="color: #94A3B8; font-style: italic; font-size: 10.5px; text-align: center; padding: 4px;">Chưa thiết lập chức danh</div>
                ` : deptPositions.map(pos => {
                  const posCount = posStaffCount[pos.position_id] || 0;
                  return `
                    <div class="org-pos-item">
                      <span style="color: #334155; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${pos.position_name}">${pos.position_name}</span>
                      <span style="font-weight: 700; color: #059669; font-size: 10.5px; margin-left: 6px;">${posCount}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    };

    // Recursive Tree Branch Renderer with Full CSS Branching Connectors
    const renderTreeBranch = (branch) => {
      const isRoot = branch.isRoot;
      const nodeCardHtml = renderDeptCard(branch.item, branch.label, isRoot);
      const hasChildren = branch.children && branch.children.length > 0;

      return `
        <div class="org-tree-branch">
          <div class="org-tree-node-box">
            ${nodeCardHtml}
          </div>
          ${hasChildren ? `
            <div class="org-tree-children">
              ${branch.children.map(child => renderTreeBranch(child)).join('')}
            </div>
          ` : ''}
        </div>
      `;
    };

    displayedCompanies.forEach(comp => {
      // Find departments belonging to this company (Lọc bỏ các bản ghi không hợp lệ)
      const compDepts = departments.filter(d => {
        if ((d.company_id || 'THG') !== comp.company_id) return false;
        // Trung Nam không có Ban điều hành
        if (comp.company_id === 'TN' && (d.department_id === 'BĐHDA.TN' || d.department_id === 'BDHDA.TN' || (d.department_name || '').includes('ĐIỀU HÀNH'))) return false;
        return true;
      });

      let totalCompStaff = 0;
      compDepts.forEach(d => { totalCompStaff += (deptStaffCount[d.department_id] || 0); });

      // Group departments into tiers
      const tier1_BTGD = [];
      const tier2_BGD = [];
      const tier3_BAN = [];
      const tier4_PHONG = [];
      const tier5_DUOI_PHONG = [];

      compDepts.forEach(d => {
        const info = this.classifyDepartmentTier(d);
        if (info.tier === 1) tier1_BTGD.push({ ...d, info });
        else if (info.tier === 2) tier2_BGD.push({ ...d, info });
        else if (info.tier === 3) tier3_BAN.push({ ...d, info });
        else if (info.tier === 4) tier4_PHONG.push({ ...d, info });
        else tier5_DUOI_PHONG.push({ ...d, info });
      });

      // Build True Tree Hierarchy Data Structure for this company
      // Rule: Ban Tổng giám đốc lớn nhất -> Ban giám đốc -> 5 ban khác ngang nhau -> phòng -> Khối trực tiếp/gián tiếp ở dưới cùng không liên kết.
      let rootTreeBranch = null;
      let bottomUnits = [];

      if (tier1_BTGD.length > 0) {
        // CÔNG TY CÓ BAN TỔNG GIÁM ĐỐC (THG - TRUNG HẢI)
        const rootItem = tier1_BTGD[0];
        
        // Sắp xếp 5 Ban chuyên môn theo thứ tự chuẩn hóa: TCHC, TCKT, KHTH, QLTB, PC
        const banOrder = ['BTCHC', 'BTCKT', 'BKHTH', 'BQLTB', 'BPC'];
        tier3_BAN.sort((a, b) => {
          const codeA = (a.department_id || '').toUpperCase();
          const codeB = (b.department_id || '').toUpperCase();
          const idxA = banOrder.findIndex(k => codeA.includes(k));
          const idxB = banOrder.findIndex(k => codeB.includes(k));
          return (idxA >= 0 ? idxA : 99) - (idxB >= 0 ? idxB : 99);
        });

        // 1. Nhánh các Ban chuyên môn: Chính xác 5 Ban của Trung Hải nằm ngang hàng với nhau trên 1 dòng
        const banBranches = tier3_BAN.map(b => ({
          item: b,
          label: 'Ban Chuyên Môn',
          children: []
        }));

        // BGD là con của BTGD, 5 Ban chuyên môn là con của BGD nằm cùng 1 hàng ngang
        let bgdBranch = null;
        if (tier2_BGD.length > 0) {
          bgdBranch = {
            item: tier2_BGD[0],
            label: 'Ban Giám Đốc',
            children: banBranches
          };
        } else {
          bgdBranch = {
            item: {
              department_id: 'BGD.TH',
              department_name: 'BAN GIÁM ĐỐC TRUNG HẢI',
              company_id: 'THG',
              info: {
                tier: 2,
                tierCode: 'BGD',
                tierName: 'Ban Giám Đốc',
                badgeClass: 'badge-tier-2',
                icon: 'fa-building-columns',
                color: '#3730A3',
                bgColor: '#EEF2FF',
                borderColor: '#4F46E5'
              }
            },
            label: 'Ban Giám Đốc',
            children: banBranches
          };
        }

        rootTreeBranch = {
          item: rootItem,
          label: 'Ban Tổng Giám Đốc',
          isRoot: true,
          children: [bgdBranch]
        };

        // Các khối trực tiếp & gián tiếp, văn phòng dự án nằm ở dưới cùng không nối dây lên trên
        bottomUnits = tier5_DUOI_PHONG;

      } else if (tier2_BGD.length > 0) {
        // CÔNG TY CÓ BAN GIÁM ĐỐC LÀM ROOT (PM, TP, TN)
        const rootItem = tier2_BGD[0];

        // Sắp xếp các Phòng ban: HCNS, KHTH/KDTM, TCKT
        const phongOrder = ['PHCNS', 'PKHTH', 'PKDTM', 'PTCKT'];
        tier4_PHONG.sort((a, b) => {
          const codeA = (a.department_id || '').toUpperCase();
          const codeB = (b.department_id || '').toUpperCase();
          const idxA = phongOrder.findIndex(k => codeA.includes(k));
          const idxB = phongOrder.findIndex(k => codeB.includes(k));
          return (idxA >= 0 ? idxA : 99) - (idxB >= 0 ? idxB : 99);
        });

        // Level 2 Branches: Các Phòng ban chức năng
        const phongBranches = tier4_PHONG.map(p => ({
          item: p,
          label: 'Phòng Ban',
          children: []
        }));

        // Nếu có Ban Điều Hành Dự Án (như PM), xếp ngang hàng cùng các phòng ở cấp 2
        const bdhdaItem = tier5_DUOI_PHONG.find(d => d.department_id === 'BDHDA.PM' || (d.department_name || '').includes('BAN ĐIỀU HÀNH DỰ ÁN'));
        const directIndirectUnits = tier5_DUOI_PHONG.filter(d => d !== bdhdaItem);

        const level2Children = [...phongBranches];
        if (bdhdaItem) {
          level2Children.push({
            item: bdhdaItem,
            label: 'Ban Điều Hành Dự Án',
            children: []
          });
        }

        rootTreeBranch = {
          item: rootItem,
          label: 'Ban Giám Đốc',
          isRoot: true,
          children: level2Children
        };

        // Các khối trực tiếp & gián tiếp còn lại nằm ở dưới cùng độc lập
        bottomUnits = directIndirectUnits;

      } else if (tier4_PHONG.length > 0 || tier3_BAN.length > 0) {
        // Fallback root if neither BTGD nor BGD exists
        const allUpper = [...tier3_BAN, ...tier4_PHONG];
        const rootItem = allUpper[0];
        rootTreeBranch = {
          item: rootItem,
          label: 'Đơn Vị Trực Thuộc',
          isRoot: true,
          children: allUpper.slice(1).map(item => ({ item, label: 'Đơn Vị', children: [] }))
        };
        bottomUnits = tier5_DUOI_PHONG;
      }

      html += `
        <div class="org-company-block">
          <!-- Company Header Banner -->
          <div class="org-company-header">
            <div style="display: flex; align-items: center; gap: 14px;">
              <div style="width: 44px; height: 44px; border-radius: 8px; background: rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; font-size: 20px;">
                <i class="fa-solid fa-city"></i>
              </div>
              <div>
                <div style="font-size: 16px; font-weight: 800; letter-spacing: 0.3px;">${comp.company_name}</div>
                <div style="font-size: 12px; opacity: 0.85; font-family: monospace;">Mã đơn vị: <strong>${comp.company_id}</strong></div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <span class="badge" style="background: rgba(255,255,255,0.18); color: #FFFFFF; font-size: 12px; padding: 5px 12px; font-weight: 600;">
                <i class="fa-solid fa-sitemap"></i> ${compDepts.length} đơn vị cơ cấu
              </span>
              <span class="badge" style="background: #10B981; color: #FFFFFF; font-size: 12px; padding: 5px 12px; font-weight: 700;">
                <i class="fa-solid fa-users"></i> ${totalCompStaff} nhân sự
              </span>
            </div>
          </div>

          <!-- Tree Hierarchy Canvas with Branching Connectors -->
          <div class="org-tree-canvas">
            ${!rootTreeBranch ? `
              <div style="text-align: center; color: var(--text-muted); padding: 40px;">
                <i class="fa-solid fa-folder-open" style="font-size: 32px; opacity: 0.4; margin-bottom: 10px; display: block;"></i>
                Chưa có phòng ban / đơn vị trực thuộc công ty này.
              </div>
            ` : `
              <div class="org-tree-root-container">
                ${renderTreeBranch(rootTreeBranch)}
              </div>
              ${bottomUnits.length > 0 ? `
                <div class="org-bottom-units-container" style="margin-top: 36px; padding-top: 24px; border-top: 1px dashed #CBD5E1; display: flex; flex-direction: column; align-items: center; width: 100%;">
                  <div style="font-size: 11.5px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 14px; display: flex; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-cubes-stacked"></i> Khối Trực Tiếp &amp; Gián Tiếp
                  </div>
                  <div style="display: flex; gap: 14px; justify-content: center; flex-wrap: wrap;">
                    ${bottomUnits.map(unit => renderDeptCard(unit, 'Khối Đơn Vị')).join('')}
                  </div>
                </div>
              ` : ''}
            `}
          </div>
        </div>
      `;
    });

    html += '</div>';
    container.innerHTML = html;
    this.applyZoom();
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
