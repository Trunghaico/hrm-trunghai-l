// ==========================================================================
// ACCOUNTS & RBAC MANAGEMENT MODULE
// ==========================================================================

const appAccounts = {
  initialized: false,
  isSaving: false,
  currentPage: 1,
  pageSize: 15,
  filteredAccounts: [],
  selectedAccountId: null,
  selectedAccountIds: new Set(),

  init() {
    if (!this.initialized) {
      this.attachEventListeners();
      this.initialized = true;
    }
    this.renderKPIs();
    this.applyFilters();
  },

  renderKPIs() {
    const accounts = appData.accounts || [];
    const total = accounts.length;
    const adminCount = accounts.filter(a => a.role === 'ADMIN').length;
    const hrCount = accounts.filter(a => a.role === 'HR_MANAGER').length;
    const mgrCount = accounts.filter(a => ['MANAGER', 'DEPT_MANAGER', 'TIMEKEEPER', 'ACCOUNTANT'].includes(a.role)).length;
    const empCount = accounts.filter(a => a.role === 'EMPLOYEE' || a.role === 'USER' || !a.role).length;

    const elTotal = document.getElementById('kpi-acc-total');
    const elAdmin = document.getElementById('kpi-acc-admin');
    const elHr = document.getElementById('kpi-acc-hr');
    const elMgr = document.getElementById('kpi-acc-mgr');
    const elEmp = document.getElementById('kpi-acc-emp');

    if (elTotal) elTotal.textContent = total;
    if (elAdmin) elAdmin.textContent = adminCount;
    if (elHr) elHr.textContent = hrCount;
    if (elMgr) elMgr.textContent = mgrCount;
    if (elEmp) elEmp.textContent = empCount;
  },

  applyFilters() {
    const searchInput = document.getElementById('acc-search-input');
    const roleFilter = document.getElementById('acc-filter-role');
    const statusFilter = document.getElementById('acc-filter-status');

    const q = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const role = roleFilter ? roleFilter.value : '';
    const status = statusFilter ? statusFilter.value : '';

    this.filteredAccounts = (appData.accounts || []).filter(a => {
      // Text match
      const matchText = !q || 
        (a.account_id && a.account_id.toLowerCase().includes(q)) ||
        (a.employee_id && a.employee_id.toLowerCase().includes(q)) ||
        (a.full_name && a.full_name.toLowerCase().includes(q)) ||
        (a.account_email && a.account_email.toLowerCase().includes(q));

      // Role match
      const matchRole = !role || a.role === role;

      // Status match
      const matchStatus = !status || a.account_status === status;

      return matchText && matchRole && matchStatus;
    });

    this.renderTable();
    this.renderPagination();
  },

  getRoleBadge(role) {
    const map = {
      ADMIN: { label: '👑 Admin', style: 'background: #FEE2E2; color: #991B1B; border: 1px solid #FECACA;' },
      HR_MANAGER: { label: '💼 Trưởng phòng HR', style: 'background: #DBEAFE; color: #1E40AF; border: 1px solid #BFDBFE;' },
      TIMEKEEPER: { label: '⏱️ QL Chấm công', style: 'background: #D1FAE5; color: #065F46; border: 1px solid #A7F3D0;' },
      ACCOUNTANT: { label: '📊 Kế toán lương', style: 'background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A;' },
      DEPT_MANAGER: { label: '👔 Quản lý BP', style: 'background: #EDE9FE; color: #5B21B6; border: 1px solid #DDD6FE;' },
      EMPLOYEE: { label: '👤 Nhân viên', style: 'background: #F1F5F9; color: #334155; border: 1px solid #E2E8F0;' },
      USER: { label: '👤 Người dùng', style: 'background: #F1F5F9; color: #334155; border: 1px solid #E2E8F0;' },
      CUSTOM: { label: '⚙️ Tùy chỉnh', style: 'background: #E0F2FE; color: #0369A1; border: 1px solid #BAE6FD;' }
    };
    const r = map[role] || map.CUSTOM;
    return `<span class="badge" style="${r.style}; font-size: 11px; padding: 3px 8px; font-weight: 600;">${r.label}</span>`;
  },

  renderTable() {
    const tbody = document.getElementById('accounts-tbody');
    if (!tbody) return;

    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    const pageItems = this.filteredAccounts.slice(start, end);

    if (pageItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 24px; color: var(--text-muted);">
            <i class="fa-solid fa-user-slash" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
            Không tìm thấy tài khoản phù hợp
          </td>
        </tr>
      `;
      this.updateSelectAllHeader();
      this.updateBulkActionsUI();
      return;
    }

    tbody.innerHTML = pageItems.map(a => {
      const isChecked = this.selectedAccountIds.has(a.account_id);
      const roleBadge = this.getRoleBadge(a.role || 'USER');

      // Calculate permissions summary
      let permSummary = '';
      if (a.role === 'ADMIN') {
        permSummary = '<span style="color: #047857; font-size: 11px; font-weight: 600;"><i class="fa-solid fa-check-circle"></i> Toàn quyền (14/14 DM)</span>';
      } else if (a.permissions && typeof a.permissions === 'object') {
        const allowedCount = Object.keys(a.permissions).filter(k => a.permissions[k] && (a.permissions[k] === true || a.permissions[k].view !== false)).length;
        permSummary = `<span style="color: #2563EB; font-size: 11px; font-weight: 600;">${allowedCount}/14 danh mục</span>`;
      } else {
        const preset = appAuth.ROLE_PRESETS[a.role];
        const count = preset && preset.permissions ? Object.keys(preset.permissions).length : 3;
        permSummary = `<span style="color: #64748B; font-size: 11px;">${count}/14 danh mục</span>`;
      }

      const statusBadge = a.account_status === 'Kích hoạt' || a.account_status === 'Hoạt động' 
        ? '<span class="badge badge-active"><i class="fa-solid fa-circle-check"></i> Hoạt động</span>'
        : '<span class="badge badge-resigned"><i class="fa-solid fa-lock"></i> Đã khóa</span>';

      return `
        <tr class="${isChecked ? 'row-selected' : ''}">
          <td style="text-align: center; width: 40px;">
            <input type="checkbox" class="acc-row-checkbox" value="${a.account_id}" ${isChecked ? 'checked' : ''} onchange="appAccounts.toggleSelectAccount('${a.account_id}', this.checked)" style="accent-color: var(--primary-navy); width: 16px; height: 16px; cursor: pointer;">
          </td>
          <td><strong style="color: var(--primary-navy);">${a.account_id || ''}</strong></td>
          <td><span class="badge badge-navy">${a.employee_id || ''}</span></td>
          <td><strong>${a.full_name || ''}</strong></td>
          <td>${a.account_email || ''}</td>
          <td>
            <div style="display: flex; flex-direction: column; gap: 2px;">
              ${roleBadge}
              ${permSummary}
            </div>
          </td>
          <td><span style="font-family: monospace; color: var(--text-muted); letter-spacing: 2px;">••••••</span></td>
          <td>${statusBadge}</td>
          <td>
            <div style="display: flex; gap: 4px;">
              <button class="btn btn-sm btn-outline-navy" title="Sửa phân quyền chi tiết" onclick="appAccounts.openEditModal('${a.account_id}')">
                <i class="fa-solid fa-user-pen"></i> Sửa Phân Quyền
              </button>
              <button class="btn btn-sm btn-secondary" title="Đổi / Reset mật khẩu" onclick="appAccounts.openResetPassModal('${a.account_id}')">
                <i class="fa-solid fa-key" style="color: #D97706;"></i>
              </button>
              <button class="btn btn-sm btn-secondary" title="Xóa tài khoản" onclick="appAccounts.openDeleteModal('${a.account_id}')" style="color: var(--accent-red);">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    this.updateSelectAllHeader();
    this.updateBulkActionsUI();
  },

  renderPagination() {
    const container = document.getElementById('accounts-pagination');
    if (!container) return;

    const total = this.filteredAccounts.length;
    const totalPages = Math.ceil(total / this.pageSize) || 1;

    if (this.currentPage > totalPages) this.currentPage = totalPages;

    const start = total === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage * this.pageSize, total);

    container.innerHTML = `
      <span>Hiển thị <strong>${start} - ${end}</strong> trên tổng số <strong>${total}</strong> tài khoản</span>
      <div class="pagination-controls">
        <button class="page-btn" ${this.currentPage === 1 ? 'disabled' : ''} onclick="appAccounts.goToPage(1)"><i class="fa-solid fa-angles-left"></i></button>
        <button class="page-btn" ${this.currentPage === 1 ? 'disabled' : ''} onclick="appAccounts.goToPage(${this.currentPage - 1})"><i class="fa-solid fa-angle-left"></i></button>
        <span style="padding: 0 8px; font-weight: 600;">Trang ${this.currentPage} / ${totalPages}</span>
        <button class="page-btn" ${this.currentPage === totalPages ? 'disabled' : ''} onclick="appAccounts.goToPage(${this.currentPage + 1})"><i class="fa-solid fa-angle-right"></i></button>
        <button class="page-btn" ${this.currentPage === totalPages ? 'disabled' : ''} onclick="appAccounts.goToPage(${totalPages})"><i class="fa-solid fa-angles-right"></i></button>
      </div>
    `;
  },

  goToPage(page) {
    this.currentPage = page;
    this.renderTable();
    this.renderPagination();
  },

  // Populate Employee Options with Realtime Search & Clean Cards
  populateEmployeeOptions(filterText = '', selectedId = null) {
    const listContainer = document.getElementById('acc-emp-picker-list');
    if (!listContainer) return;

    const q = filterText.trim().toLowerCase();
    const filtered = (appData.employees || []).filter(e => {
      if (!q) return true;
      const title = (appData.posMap && appData.posMap[e.position_id]) || e.job_title || '';
      const empId = (e.employee_id || '').toLowerCase();
      const name = (e.full_name || '').toLowerCase();
      const dept = (appData.deptMap && appData.deptMap[e.department_id]) || e.department_name || '';
      return empId.includes(q) || name.includes(q) || title.toLowerCase().includes(q) || dept.toLowerCase().includes(q);
    });

    if (filtered.length === 0) {
      listContainer.innerHTML = '<div class="emp-picker-empty"><i class="fa-solid fa-user-slash"></i> Không tìm thấy nhân viên phù hợp</div>';
      return;
    }

    const currentSelected = selectedId || (filtered[0] ? filtered[0].employee_id : null);

    listContainer.innerHTML = filtered.map(e => {
      const title = (appData.posMap && appData.posMap[e.position_id]) || e.job_title || 'Nhân viên';
      const dept = (appData.deptMap && appData.deptMap[e.department_id]) || e.department_name || '';
      const initials = e.full_name ? e.full_name.split(' ').map(n => n[0]).slice(-2).join('') : 'NV';
      const isSelected = e.employee_id === currentSelected;

      return `
        <div class="emp-picker-item ${isSelected ? 'active' : ''}" data-empid="${e.employee_id}" onclick="appAccounts.selectEmployee('${e.employee_id}')">
          <div class="emp-picker-avatar">${initials}</div>
          <div class="emp-picker-info">
            <div class="emp-picker-name-row">
              <span class="emp-picker-badge">${e.employee_id}</span>
              <span class="emp-picker-name">${e.full_name}</span>
            </div>
            <div class="emp-picker-role">${title}${dept ? ' • ' + dept : ''}</div>
          </div>
          <div class="emp-picker-check"><i class="fa-solid fa-circle-check"></i></div>
        </div>
      `;
    }).join('');

    if (currentSelected) {
      this.selectEmployee(currentSelected, false);
    }
  },

  selectEmployee(empId, updateDomSelection = true) {
    const hiddenInput = document.getElementById('acc-form-emp-id');
    if (hiddenInput) hiddenInput.value = empId;
    
    if (updateDomSelection) {
      document.querySelectorAll('.emp-picker-item').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-empid') === empId);
      });
    }

    // Auto-fill email
    const emp = appData.employees.find(e => e.employee_id === empId);
    if (emp) {
      const email = emp.work_email || `${empId.toLowerCase()}@trunghaico.vn`;
      document.getElementById('acc-form-email').value = email;
    }
  },

  // ========================================================================
  // PERMISSION MATRIX RENDERER & INTERACTIVE CONTROLS
  // ========================================================================
  renderPermissionMatrix(currentPermissions = {}, currentRole = 'CUSTOM') {
    const tbody = document.getElementById('perm-matrix-tbody');
    if (!tbody) return;

    const modules = appAuth.MODULES || [];
    const actions = appAuth.ACTIONS || [];

    // If role is ADMIN, all permissions are true
    const isAdmin = currentRole === 'ADMIN';

    // If permissions object is empty and preset exists, resolve from preset
    let resolvedPerms = currentPermissions || {};
    if ((!resolvedPerms || Object.keys(resolvedPerms).length === 0) && appAuth.ROLE_PRESETS[currentRole]) {
      const preset = appAuth.ROLE_PRESETS[currentRole];
      if (preset.permissions === null) {
        // Full access
        resolvedPerms = {};
        modules.forEach(m => {
          resolvedPerms[m.id] = { view: true, create: true, edit: true, delete: true, export: true, import: true, special: true };
        });
      } else {
        resolvedPerms = preset.permissions || {};
      }
    }

    let rowsHtml = '';
    let currentCat = '';

    modules.forEach(m => {
      // Category group header
      if (m.category && m.category !== currentCat) {
        currentCat = m.category;
        rowsHtml += `
          <tr style="background: #E2E8F0; font-weight: 700; color: #334155; font-size: 11.5px;">
            <td colspan="9" style="padding: 6px 10px; text-transform: uppercase; letter-spacing: 0.5px;">
              <i class="fa-solid fa-layer-group" style="color: #64748B; margin-right: 4px;"></i> ${currentCat}
            </td>
          </tr>
        `;
      }

      const modPerms = resolvedPerms[m.id] || (isAdmin ? { view: true, create: true, edit: true, delete: true, export: true, import: true, special: true } : {});
      const isView = isAdmin || (typeof modPerms === 'boolean' ? modPerms : Boolean(modPerms.view !== false && modPerms.view !== undefined ? modPerms.view : modPerms.view));
      const isCreate = isAdmin || Boolean(modPerms.create);
      const isEdit = isAdmin || Boolean(modPerms.edit);
      const isDelete = isAdmin || Boolean(modPerms.delete);
      const isExport = isAdmin || Boolean(modPerms.export);
      const isImport = isAdmin || Boolean(modPerms.import);
      const isSpecial = isAdmin || Boolean(modPerms.special);

      const isAllChecked = isView && isCreate && isEdit && isDelete && isExport && isImport && isSpecial;

      rowsHtml += `
        <tr class="perm-row" data-module="${m.id}" style="border-bottom: 1px solid #F1F5F9;">
          <td style="padding: 8px 10px; font-weight: 600; color: #1E293B;">
            <i class="fa-solid ${m.icon}" style="width: 18px; color: #64748B; margin-right: 4px;"></i>
            ${m.name}
          </td>
          <td style="text-align: center; padding: 6px;">
            <input type="checkbox" class="perm-chk perm-chk-view" data-module="${m.id}" data-action="view" ${isView ? 'checked' : ''} onchange="appAccounts.onCheckboxChange('${m.id}', 'view', this.checked)" style="accent-color: #2563EB; width: 16px; height: 16px; cursor: pointer;">
          </td>
          <td style="text-align: center; padding: 6px;">
            <input type="checkbox" class="perm-chk perm-chk-create" data-module="${m.id}" data-action="create" ${isCreate ? 'checked' : ''} onchange="appAccounts.onCheckboxChange('${m.id}', 'create', this.checked)" style="accent-color: #16A34A; width: 16px; height: 16px; cursor: pointer;">
          </td>
          <td style="text-align: center; padding: 6px;">
            <input type="checkbox" class="perm-chk perm-chk-edit" data-module="${m.id}" data-action="edit" ${isEdit ? 'checked' : ''} onchange="appAccounts.onCheckboxChange('${m.id}', 'edit', this.checked)" style="accent-color: #D97706; width: 16px; height: 16px; cursor: pointer;">
          </td>
          <td style="text-align: center; padding: 6px;">
            <input type="checkbox" class="perm-chk perm-chk-delete" data-module="${m.id}" data-action="delete" ${isDelete ? 'checked' : ''} onchange="appAccounts.onCheckboxChange('${m.id}', 'delete', this.checked)" style="accent-color: #DC2626; width: 16px; height: 16px; cursor: pointer;">
          </td>
          <td style="text-align: center; padding: 6px;">
            <input type="checkbox" class="perm-chk perm-chk-export" data-module="${m.id}" data-action="export" ${isExport ? 'checked' : ''} onchange="appAccounts.onCheckboxChange('${m.id}', 'export', this.checked)" style="accent-color: #059669; width: 16px; height: 16px; cursor: pointer;">
          </td>
          <td style="text-align: center; padding: 6px;">
            <input type="checkbox" class="perm-chk perm-chk-import" data-module="${m.id}" data-action="import" ${isImport ? 'checked' : ''} onchange="appAccounts.onCheckboxChange('${m.id}', 'import', this.checked)" style="accent-color: #7C3AED; width: 16px; height: 16px; cursor: pointer;">
          </td>
          <td style="text-align: center; padding: 6px;">
            <input type="checkbox" class="perm-chk perm-chk-special" data-module="${m.id}" data-action="special" ${isSpecial ? 'checked' : ''} onchange="appAccounts.onCheckboxChange('${m.id}', 'special', this.checked)" style="accent-color: #4F46E5; width: 16px; height: 16px; cursor: pointer;">
          </td>
          <td style="text-align: center; padding: 6px; background: #F8FAFC;">
            <input type="checkbox" class="perm-chk-row-all" data-module="${m.id}" ${isAllChecked ? 'checked' : ''} onchange="appAccounts.toggleRowPermissions('${m.id}', this.checked)" title="Chọn tất cả quyền cho danh mục này" style="accent-color: #0F172A; width: 16px; height: 16px; cursor: pointer;">
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;
    this.syncHeaderCheckboxes();
  },

  // When Role Preset Dropdown changes
  onRoleChange(roleKey) {
    const descEl = document.getElementById('acc-role-desc');
    const preset = appAuth.ROLE_PRESETS[roleKey];
    if (descEl && preset) {
      descEl.textContent = preset.description;
    }

    if (roleKey === 'ADMIN') {
      this.toggleAllPermissions(true);
      return;
    }

    if (preset && preset.permissions) {
      this.renderPermissionMatrix(preset.permissions, roleKey);
    } else if (roleKey === 'CUSTOM') {
      // Leave current selections as is
    }
  },

  // When user clicks an individual checkbox
  onCheckboxChange(moduleId, actionId, isChecked) {
    // If checking a sub-action (create, edit, delete...), auto-check view
    if (isChecked && actionId !== 'view') {
      const viewChk = document.querySelector(`.perm-chk-view[data-module="${moduleId}"]`);
      if (viewChk && !viewChk.checked) {
        viewChk.checked = true;
      }
    }

    // Sync row master checkbox
    const rowChks = document.querySelectorAll(`.perm-chk[data-module="${moduleId}"]`);
    const allRowChecked = Array.from(rowChks).every(c => c.checked);
    const rowMaster = document.querySelector(`.perm-chk-row-all[data-module="${moduleId}"]`);
    if (rowMaster) rowMaster.checked = allRowChecked;

    this.syncHeaderCheckboxes();

    // Set role dropdown to CUSTOM if it wasn't
    const roleSelect = document.getElementById('acc-form-role');
    if (roleSelect && roleSelect.value !== 'CUSTOM' && roleSelect.value !== 'ADMIN') {
      roleSelect.value = 'CUSTOM';
      const descEl = document.getElementById('acc-role-desc');
      if (descEl) descEl.textContent = 'Thiết lập ma trận phân quyền tùy chỉnh';
    }
  },

  // Toggle all actions in a single row
  toggleRowPermissions(moduleId, isChecked) {
    document.querySelectorAll(`.perm-chk[data-module="${moduleId}"]`).forEach(chk => {
      chk.checked = isChecked;
    });
    this.syncHeaderCheckboxes();
  },

  // Toggle all modules in a single column (view, create, edit...)
  toggleColumnPermissions(actionId, isChecked) {
    document.querySelectorAll(`.perm-chk-${actionId}`).forEach(chk => {
      chk.checked = isChecked;
    });

    // If enabling any action column, also enable view column
    if (isChecked && actionId !== 'view') {
      document.querySelectorAll('.perm-chk-view').forEach(chk => {
        chk.checked = true;
      });
      const headerView = document.getElementById('perm-col-view');
      if (headerView) headerView.checked = true;
    }

    // Update row masters
    document.querySelectorAll('.perm-row').forEach(row => {
      const modId = row.getAttribute('data-module');
      const rowChks = document.querySelectorAll(`.perm-chk[data-module="${modId}"]`);
      const allRowChecked = Array.from(rowChks).every(c => c.checked);
      const rowMaster = document.querySelector(`.perm-chk-row-all[data-module="${modId}"]`);
      if (rowMaster) rowMaster.checked = allRowChecked;
    });
  },

  // Toggle All Permissions across entire matrix
  toggleAllPermissions(isChecked) {
    document.querySelectorAll('.perm-chk, .perm-chk-row-all').forEach(chk => {
      chk.checked = isChecked;
    });
    ['view', 'create', 'edit', 'delete', 'export', 'import', 'special'].forEach(col => {
      const el = document.getElementById(`perm-col-${col}`);
      if (el) el.checked = isChecked;
    });
  },

  // Sync column header checkboxes
  syncHeaderCheckboxes() {
    ['view', 'create', 'edit', 'delete', 'export', 'import', 'special'].forEach(actionId => {
      const chks = document.querySelectorAll(`.perm-chk-${actionId}`);
      const allChecked = chks.length > 0 && Array.from(chks).every(c => c.checked);
      const headerChk = document.getElementById(`perm-col-${actionId}`);
      if (headerChk) headerChk.checked = allChecked;
    });
  },

  // Collect permission matrix state into a clean JSON object
  collectPermissionMatrix() {
    const role = document.getElementById('acc-form-role')?.value || 'USER';
    if (role === 'ADMIN') {
      return null; // Full access
    }

    const permissions = {};
    document.querySelectorAll('.perm-row').forEach(row => {
      const modId = row.getAttribute('data-module');
      if (!modId) return;

      const isView = document.querySelector(`.perm-chk-view[data-module="${modId}"]`)?.checked || false;
      const isCreate = document.querySelector(`.perm-chk-create[data-module="${modId}"]`)?.checked || false;
      const isEdit = document.querySelector(`.perm-chk-edit[data-module="${modId}"]`)?.checked || false;
      const isDelete = document.querySelector(`.perm-chk-delete[data-module="${modId}"]`)?.checked || false;
      const isExport = document.querySelector(`.perm-chk-export[data-module="${modId}"]`)?.checked || false;
      const isImport = document.querySelector(`.perm-chk-import[data-module="${modId}"]`)?.checked || false;
      const isSpecial = document.querySelector(`.perm-chk-special[data-module="${modId}"]`)?.checked || false;

      // Only save if at least one permission is true
      if (isView || isCreate || isEdit || isDelete || isExport || isImport || isSpecial) {
        permissions[modId] = {
          view: isView,
          create: isCreate,
          edit: isEdit,
          delete: isDelete,
          export: isExport,
          import: isImport,
          special: isSpecial
        };
      }
    });

    return permissions;
  },

  // Open Create Modal
  openCreateModal() {
    this.selectedAccountId = null;
    document.getElementById('acc-modal-title').textContent = 'Cấp Tài Khoản Mới & Phân Quyền';
    
    // Show search wrapper and reset
    const searchWrapper = document.getElementById('acc-emp-search-wrapper');
    const searchInput = document.getElementById('acc-emp-search-input');
    if (searchWrapper) searchWrapper.style.display = 'block';
    if (searchInput) searchInput.value = '';

    // Populate employees cleanly
    this.populateEmployeeOptions('');

    const defaultRole = 'HR_MANAGER';
    document.getElementById('acc-form-role').value = defaultRole;
    document.getElementById('acc-form-status').value = 'Kích hoạt';
    document.getElementById('acc-form-password').value = '123456';
    document.getElementById('acc-password-group').style.display = 'block';

    const descEl = document.getElementById('acc-role-desc');
    if (descEl && appAuth.ROLE_PRESETS[defaultRole]) {
      descEl.textContent = appAuth.ROLE_PRESETS[defaultRole].description;
    }

    this.renderPermissionMatrix({}, defaultRole);

    document.getElementById('modal-account-form').classList.add('active');
  },

  // Open Edit Modal
  openEditModal(accId) {
    const acc = (appData.accounts || []).find(a => a.account_id === accId || a.employee_id === accId);
    if (!acc) return;

    this.selectedAccountId = acc.account_id;
    document.getElementById('acc-modal-title').textContent = `Sửa Phân Quyền - ${acc.full_name} (${acc.employee_id})`;
    
    // Hide search wrapper in edit mode
    const searchWrapper = document.getElementById('acc-emp-search-wrapper');
    if (searchWrapper) searchWrapper.style.display = 'none';

    // Show only the selected employee
    const listContainer = document.getElementById('acc-emp-picker-list');
    if (listContainer) {
      const initials = acc.full_name ? acc.full_name.split(' ').map(n => n[0]).slice(-2).join('') : 'NV';
      listContainer.innerHTML = `
        <div class="emp-picker-item active" style="cursor: default;">
          <div class="emp-picker-avatar">${initials}</div>
          <div class="emp-picker-info">
            <div class="emp-picker-name-row">
              <span class="emp-picker-badge">${acc.employee_id}</span>
              <span class="emp-picker-name">${acc.full_name}</span>
            </div>
            <div class="emp-picker-role">Tài khoản hệ thống</div>
          </div>
          <div class="emp-picker-check"><i class="fa-solid fa-circle-check"></i></div>
        </div>
      `;
    }
    document.getElementById('acc-form-emp-id').value = acc.employee_id;
    document.getElementById('acc-form-email').value = acc.account_email || '';
    
    const roleVal = acc.role || (acc.permissions ? 'CUSTOM' : 'USER');
    document.getElementById('acc-form-role').value = roleVal;
    document.getElementById('acc-form-status').value = acc.account_status || 'Kích hoạt';
    document.getElementById('acc-password-group').style.display = 'none'; // Only change via reset modal

    const descEl = document.getElementById('acc-role-desc');
    if (descEl && appAuth.ROLE_PRESETS[roleVal]) {
      descEl.textContent = appAuth.ROLE_PRESETS[roleVal].description;
    }

    this.renderPermissionMatrix(acc.permissions || {}, roleVal);

    document.getElementById('modal-account-form').classList.add('active');
  },

  closeFormModal() {
    document.getElementById('modal-account-form').classList.remove('active');
  },

  // Save Account (Create or Update)
  async saveAccount(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (this.isSaving) return;

    const empId = document.getElementById('acc-form-emp-id').value;
    const email = document.getElementById('acc-form-email').value.trim();
    const role = document.getElementById('acc-form-role').value;
    const status = document.getElementById('acc-form-status').value;
    const password = document.getElementById('acc-form-password').value;

    if (!empId || !email) {
      utils.showToast('Vui lòng điền đầy đủ mã nhân viên và email', 'error');
      return;
    }

    const emp = appData.employees.find(e => e.employee_id === empId);
    const fullName = emp ? emp.full_name : '';
    const permissions = this.collectPermissionMatrix();

    this.isSaving = true;
    const submitBtn = document.querySelector('#form-account-action button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      if (this.selectedAccountId) {
        // UPDATE
        const res = await fetch(`/api/accounts/${this.selectedAccountId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            account_email: email,
            role: role,
            account_status: status,
            permissions: permissions
          })
        }).catch(() => null);

        // Update in local array
        const idx = appData.accounts.findIndex(a => a.account_id === this.selectedAccountId);
        if (idx >= 0) {
          appData.accounts[idx] = { 
            ...appData.accounts[idx], 
            account_email: email, 
            role, 
            account_status: status,
            permissions: permissions
          };
        }

        // If updating the currently logged in user, refresh their session
        const curr = appAuth.getCurrentUser();
        if (curr && (curr.account_id === this.selectedAccountId || curr.employee_id === empId)) {
          const updatedUser = { ...curr, role, permissions };
          appAuth.currentUser = updatedUser;
          localStorage.setItem(appAuth.storageKey, JSON.stringify(updatedUser));
          appAuth.applyUserSession(updatedUser);
        }

        this.closeFormModal();
        this.renderKPIs();
        this.applyFilters();
        utils.showToast('Cập nhật phân quyền tài khoản thành công!', 'success');
        if (window.recordActivityLog) {
          window.recordActivityLog('UPDATE', 'Phân quyền', `Cập nhật phân quyền cho tài khoản: ${email} (Vai trò: ${role})`);
        }
      } else {
        // CREATE
        const newAccId = 'ACC-' + String(appData.accounts.length + 1).padStart(3, '0');
        const newAccount = {
          account_id: newAccId,
          employee_id: empId,
          full_name: fullName,
          account_email: email,
          role: role,
          account_status: status,
          password: password || '123456',
          permissions: permissions,
          created_at: new Date().toISOString()
        };

        const res = await fetch('/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newAccount)
        }).catch(() => null);

        // Prevent duplicates in frontend state
        const existsIdx = appData.accounts.findIndex(a => a.employee_id === empId);
        if (existsIdx >= 0) {
          appData.accounts[existsIdx] = newAccount;
        } else {
          appData.accounts.unshift(newAccount);
        }

        this.closeFormModal();
        this.renderKPIs();
        this.applyFilters();
        utils.showToast('Cấp tài khoản và thiết lập phân quyền thành công!', 'success');
        if (window.recordActivityLog) {
          window.recordActivityLog('CREATE', 'Phân quyền', `Cấp tài khoản mới cho nhân viên: ${fullName} (${empId}) - Vai trò: ${role}`);
        }
      }
    } catch (err) {
      console.error(err);
      utils.showToast('Lỗi máy chủ: ' + (err.message || ''), 'error');
    } finally {
      this.isSaving = false;
      if (submitBtn) submitBtn.disabled = false;
    }
  },

  // Open Reset Password Modal
  openResetPassModal(accId) {
    const acc = (appData.accounts || []).find(a => a.account_id === accId || a.employee_id === accId);
    if (!acc) return;

    this.selectedAccountId = acc.account_id;
    document.getElementById('reset-pass-user-info').textContent = `${acc.full_name} (${acc.employee_id} - ${acc.account_email})`;
    document.getElementById('reset-pass-new-input').value = '123456';
    document.getElementById('modal-account-reset-pass').classList.add('active');
  },

  closeResetPassModal() {
    document.getElementById('modal-account-reset-pass').classList.remove('active');
  },

  async confirmResetPassword(e) {
    e.preventDefault();
    const newPass = document.getElementById('reset-pass-new-input').value;
    if (!newPass) {
      utils.showToast('Vui lòng nhập mật khẩu mới', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/accounts/${this.selectedAccountId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: newPass })
      });
      const json = await res.json();
      if (json.success) {
        this.closeResetPassModal();
        utils.showToast('Đặt lại mật khẩu thành công!', 'success');
        if (window.recordActivityLog) {
          window.recordActivityLog('PASSWORD', 'Tài khoản', `Đặt lại mật khẩu cho tài khoản: ${this.selectedAccountId}`);
        }
      } else {
        utils.showToast(json.message || 'Lỗi đặt lại mật khẩu', 'error');
      }
    } catch (err) {
      console.error(err);
      utils.showToast('Lỗi máy chủ', 'error');
    }
  },

  // Open Delete Modal
  openDeleteModal(accId) {
    const acc = (appData.accounts || []).find(a => a.account_id === accId || a.employee_id === accId);
    if (!acc) return;

    this.selectedAccountId = acc.account_id;
    document.getElementById('delete-acc-user-info').textContent = `${acc.full_name} (${acc.employee_id} - ${acc.account_email})`;
    document.getElementById('modal-account-delete-confirm').classList.add('active');
  },

  closeDeleteModal() {
    document.getElementById('modal-account-delete-confirm').classList.remove('active');
  },

  async confirmDeleteAccount() {
    try {
      const user = (typeof appAuth !== 'undefined' && typeof appAuth.getCurrentUser === 'function')
        ? appAuth.getCurrentUser()
        : (typeof appAuth !== 'undefined' && appAuth?.currentUser ? appAuth.currentUser : null);

      const res = await fetch(`/api/accounts/${this.selectedAccountId}`, {
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
        this.selectedAccountIds.delete(this.selectedAccountId);
        appData.accounts = (appData.accounts || []).filter(a => a.account_id !== this.selectedAccountId);
        this.closeDeleteModal();
        this.renderKPIs();
        this.applyFilters();
        utils.showToast('Đã xóa tài khoản khỏi hệ thống!', 'success');
        if (window.recordActivityLog) {
          window.recordActivityLog('DELETE', 'Tài khoản', `Xóa tài khoản: ${this.selectedAccountId}`);
        }
      } else {
        utils.showToast(json.message || 'Lỗi xóa tài khoản', 'error');
      }
    } catch (err) {
      console.error(err);
      utils.showToast('Lỗi máy chủ', 'error');
    }
  },

  // ==========================================
  // BULK ACCOUNTS SELECTION & DELETION
  // ==========================================
  toggleSelectAccount(accId, isChecked) {
    if (isChecked) {
      this.selectedAccountIds.add(accId);
    } else {
      this.selectedAccountIds.delete(accId);
    }
    this.updateSelectAllHeader();
    this.updateBulkActionsUI();
  },

  toggleSelectAll(isChecked) {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    const pageItems = this.filteredAccounts.slice(start, end);

    pageItems.forEach(a => {
      if (isChecked) {
        this.selectedAccountIds.add(a.account_id);
      } else {
        this.selectedAccountIds.delete(a.account_id);
      }
    });

    document.querySelectorAll('.acc-row-checkbox').forEach(cb => {
      cb.checked = isChecked;
    });

    this.updateSelectAllHeader();
    this.updateBulkActionsUI();
  },

  updateSelectAllHeader() {
    const selectAllEl = document.getElementById('acc-select-all');
    if (!selectAllEl) return;

    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    const pageItems = this.filteredAccounts.slice(start, end);

    if (pageItems.length === 0) {
      selectAllEl.checked = false;
      selectAllEl.indeterminate = false;
      return;
    }

    const checkedCount = pageItems.filter(a => this.selectedAccountIds.has(a.account_id)).length;
    if (checkedCount === pageItems.length) {
      selectAllEl.checked = true;
      selectAllEl.indeterminate = false;
    } else if (checkedCount > 0) {
      selectAllEl.checked = false;
      selectAllEl.indeterminate = true;
    } else {
      selectAllEl.checked = false;
      selectAllEl.indeterminate = false;
    }
  },

  updateBulkActionsUI() {
    const bulkBtn = document.getElementById('btn-delete-selected-accounts');
    const countEl = document.getElementById('acc-selected-count');
    const count = this.selectedAccountIds.size;

    if (countEl) countEl.textContent = count;
    if (bulkBtn) {
      bulkBtn.style.display = count > 0 ? 'inline-flex' : 'none';
    }
  },

  openBulkDeleteModal() {
    if (this.selectedAccountIds.size === 0) {
      utils.showToast('Vui lòng tích chọn ít nhất một tài khoản để xóa', 'warning');
      return;
    }

    const countEl = document.getElementById('bulk-delete-acc-count');
    if (countEl) countEl.textContent = this.selectedAccountIds.size;

    const modal = document.getElementById('modal-account-bulk-delete-confirm');
    if (modal) modal.classList.add('active');
  },

  closeBulkDeleteModal() {
    const modal = document.getElementById('modal-account-bulk-delete-confirm');
    if (modal) modal.classList.remove('active');
  },

  async confirmBulkDeleteAccounts() {
    const confirmBtn = document.getElementById('btn-confirm-bulk-delete-account');
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Đang xóa...</span>';
    }

    try {
      const user = (typeof appAuth !== 'undefined' && typeof appAuth.getCurrentUser === 'function')
        ? appAuth.getCurrentUser()
        : (typeof appAuth !== 'undefined' && appAuth?.currentUser ? appAuth.currentUser : { employee_id: 'TH-1948', full_name: 'Huỳnh Thanh Long', role: 'ADMIN' });

      const ids = Array.from(this.selectedAccountIds);

      const res = await fetch('/api/accounts/delete-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_ids: ids,
          operator_id: user?.employee_id || 'TH-1948',
          operator_name: user?.full_name || 'Huỳnh Thanh Long',
          operator_role: user?.role || 'ADMIN'
        })
      });

      const json = await res.json();
      if (json.success) {
        // Remove deleted accounts from local appData
        const deletedSet = new Set(ids);
        appData.accounts = (appData.accounts || []).filter(a => !deletedSet.has(a.account_id) && !deletedSet.has(a.employee_id));
        this.selectedAccountIds.clear();
        this.closeBulkDeleteModal();
        this.renderKPIs();
        this.applyFilters();
        utils.showToast(json.message || `Đã xóa thành công ${json.count} tài khoản!`, 'success');
        if (window.recordActivityLog) {
          window.recordActivityLog('DELETE', 'Tài khoản', `Xóa hàng loạt ${ids.length} tài khoản`);
        }
      } else {
        utils.showToast(json.message || 'Lỗi khi xóa tài khoản hàng loạt', 'error');
      }
    } catch (err) {
      console.error(err);
      utils.showToast('Lỗi máy chủ khi xóa tài khoản: ' + err.message, 'error');
    } finally {
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i> <span>Xác Nhận Xóa</span>';
      }
    }
  },

  attachEventListeners() {
    // Search & Filter change
    const searchInput = document.getElementById('acc-search-input');
    const roleFilter = document.getElementById('acc-filter-role');
    const statusFilter = document.getElementById('acc-filter-status');

    if (searchInput) searchInput.addEventListener('input', () => { this.currentPage = 1; this.applyFilters(); });
    if (roleFilter) roleFilter.addEventListener('change', () => { this.currentPage = 1; this.applyFilters(); });
    if (statusFilter) statusFilter.addEventListener('change', () => { this.currentPage = 1; this.applyFilters(); });

    // Open add account
    const btnAdd = document.getElementById('btn-open-add-account');
    if (btnAdd) btnAdd.addEventListener('click', () => this.openCreateModal());

    // Form submit
    const accForm = document.getElementById('form-account-action');
    if (accForm) accForm.addEventListener('submit', (e) => this.saveAccount(e));

    // Reset password form submit
    const resetForm = document.getElementById('form-reset-password-action');
    if (resetForm) resetForm.addEventListener('submit', (e) => this.confirmResetPassword(e));

    // Confirm delete button
    const confirmDeleteBtn = document.getElementById('btn-confirm-delete-account');
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', () => this.confirmDeleteAccount());

    // Search input inside create modal
    const empSearchInput = document.getElementById('acc-emp-search-input');
    if (empSearchInput) {
      empSearchInput.addEventListener('input', (e) => {
        this.populateEmployeeOptions(e.target.value);
      });
    }

    // Auto-fill email when employee selected
    const empSelect = document.getElementById('acc-form-emp-id');
    if (empSelect) {
      empSelect.addEventListener('change', () => {
        const empId = empSelect.value;
        if (empId) {
          document.getElementById('acc-form-email').value = `${empId.toLowerCase()}@trunghaico.vn`;
        }
      });
    }

    // Select all accounts checkbox
    const selectAllEl = document.getElementById('acc-select-all');
    if (selectAllEl) {
      selectAllEl.addEventListener('change', (e) => this.toggleSelectAll(e.target.checked));
    }
  }
};
