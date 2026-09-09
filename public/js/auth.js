// ==========================================================================
// AUTHENTICATION & GRANULAR ROLE-BASED ACCESS CONTROL (RBAC) MODULE
// HRM Trung Hải Enterprise Edition
// ==========================================================================

const appAuth = {
  currentUser: null,
  storageKey: 'hrm_trunghai_user_session',
  tokenKey: 'hrm_trunghai_jwt_token',

  // Danh mục phân hệ chuẩn trên toàn hệ thống
  MODULES: [
    { id: 'dashboard', name: 'Tổng quan / Dashboard', icon: 'fa-gauge-high', category: 'Tổng quan' },
    { id: 'employees', name: 'Hồ sơ nhân sự', icon: 'fa-users', category: 'Nhân sự' },
    { id: 'resigned', name: 'Nhân sự nghỉ việc', icon: 'fa-user-xmark', category: 'Nhân sự' },
    { id: 'contracts', name: 'Hợp đồng lao động', icon: 'fa-file-contract', category: 'Hợp đồng' },
    { id: 'attendance', name: 'Quản lý Chấm công', icon: 'fa-clock', category: 'Chấm công' },
    { id: 'zk-devices', name: 'Máy chấm công & Kết nối', icon: 'fa-fingerprint', category: 'Chấm công' },
    { id: 'org-chart', name: 'Sơ đồ cơ cấu tổ chức', icon: 'fa-sitemap', category: 'Tổ chức' },
    { id: 'companies', name: 'Danh sách công ty', icon: 'fa-city', category: 'Tổ chức' },
    { id: 'departments', name: 'Danh sách phòng ban', icon: 'fa-building', category: 'Tổ chức' },
    { id: 'positions', name: 'Vị trí chức danh', icon: 'fa-briefcase', category: 'Tổ chức' },
    { id: 'reports', name: 'Báo cáo nhân sự & Thống kê', icon: 'fa-chart-line', category: 'Báo cáo & Hệ thống' },
    { id: 'accounts', name: 'Phân quyền tài khoản', icon: 'fa-user-shield', category: 'Báo cáo & Hệ thống' },
    { id: 'logs', name: 'Nhật ký hoạt động', icon: 'fa-clock-rotate-left', category: 'Báo cáo & Hệ thống' },
    { id: 'trash', name: 'Thùng rác & Khôi phục', icon: 'fa-trash-can', category: 'Báo cáo & Hệ thống' }
  ],

  // Danh sách các quyền thao tác
  ACTIONS: [
    { id: 'view', name: 'Xem', icon: 'fa-eye', desc: 'Truy cập danh mục & xem dữ liệu' },
    { id: 'create', name: 'Thêm', icon: 'fa-plus', desc: 'Tạo mới bản ghi' },
    { id: 'edit', name: 'Sửa', icon: 'fa-pen-to-square', desc: 'Chỉnh sửa thông tin' },
    { id: 'delete', name: 'Xóa', icon: 'fa-trash', desc: 'Xóa bản ghi' },
    { id: 'export', name: 'Xuất', icon: 'fa-file-excel', desc: 'Xuất file Excel / CSV' },
    { id: 'import', name: 'Nhập', icon: 'fa-file-import', desc: 'Nhập dữ liệu từ Excel' },
    { id: 'special', name: 'Duyệt / Khóa', icon: 'fa-shield-halved', desc: 'Khóa sổ, đồng bộ, khôi phục' }
  ],

  // Bộ mẫu phân quyền theo vai trò (Role Presets)
  ROLE_PRESETS: {
    ADMIN: {
      name: '👑 Admin (Toàn quyền hệ thống)',
      description: 'Có đầy đủ 100% tất cả các quyền trên mọi danh mục',
      permissions: null // null means full access to everything
    },
    HR_MANAGER: {
      name: '💼 Trưởng phòng Nhân sự (HR Manager)',
      description: 'Toàn quyền quản lý Nhân sự, Hợp đồng, Chấm công, Báo cáo và Tổ chức',
      permissions: {
        dashboard: { view: true, export: true },
        employees: { view: true, create: true, edit: true, delete: true, export: true, import: true, special: true },
        resigned: { view: true, delete: true, export: true, special: true },
        contracts: { view: true, create: true, edit: true, delete: true, export: true, special: true },
        attendance: { view: true, create: true, edit: true, export: true, special: true },
        'zk-devices': { view: true, export: true },
        'org-chart': { view: true, export: true },
        companies: { view: true, create: true, edit: true, export: true },
        departments: { view: true, create: true, edit: true, export: true },
        positions: { view: true, create: true, edit: true, export: true },
        reports: { view: true, export: true },
        accounts: { view: false },
        logs: { view: true, export: true },
        trash: { view: true, special: true }
      }
    },
    TIMEKEEPER: {
      name: '⏱️ Quản trị Chấm công (Timekeeper)',
      description: 'Chuyên trách quản lý Chấm công, Máy chấm công và Xem nhân sự',
      permissions: {
        dashboard: { view: true },
        employees: { view: true, export: true },
        attendance: { view: true, create: true, edit: true, export: true, special: true },
        'zk-devices': { view: true, create: true, edit: true, delete: true, special: true },
        reports: { view: true, export: true },
        departments: { view: true }
      }
    },
    ACCOUNTANT: {
      name: '📊 Kế toán tiền lương (Accountant)',
      description: 'Xem và xuất báo cáo Chấm công, Hợp đồng, Nhân sự để tính lương',
      permissions: {
        dashboard: { view: true },
        employees: { view: true, export: true },
        contracts: { view: true, export: true },
        attendance: { view: true, export: true },
        reports: { view: true, export: true },
        departments: { view: true },
        positions: { view: true }
      }
    },
    DEPT_MANAGER: {
      name: '👔 Quản lý bộ phận (Manager)',
      description: 'Xem nhân sự và quản lý chấm công, duyệt đơn thuộc bộ phận',
      permissions: {
        dashboard: { view: true },
        employees: { view: true },
        attendance: { view: true, create: true, edit: true, export: true },
        departments: { view: true },
        reports: { view: true }
      }
    },
    EMPLOYEE: {
      name: '👤 Nhân viên thông thường (Employee)',
      description: 'Chỉ xem bảng tin Dashboard, Chấm công cá nhân và Hợp đồng cá nhân',
      permissions: {
        dashboard: { view: true },
        attendance: { view: true },
        contracts: { view: true }
      }
    },
    CUSTOM: {
      name: '⚙️ Tùy chỉnh chi tiết (Custom)',
      description: 'Thiết lập ma trận phân quyền thủ công theo từng danh mục cụ thể',
      permissions: {}
    }
  },

  init() {
    this.attachEventListeners();
    this.checkSession();
  },

  getToken() {
    return localStorage.getItem(this.tokenKey) || '';
  },

  getAuthHeaders() {
    const token = this.getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  },

  getCurrentUser() {
    if (this.currentUser) return this.currentUser;
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        this.currentUser = JSON.parse(saved);
        return this.currentUser;
      }
    } catch (e) {}
    return {
      employee_id: 'TH-1948',
      full_name: 'Huỳnh Thanh Long',
      role: 'ADMIN'
    };
  },

  // ========================================================================
  // CORE PERMISSION CHECKER: appAuth.can(module, action)
  // ========================================================================
  can(module, action = 'view') {
    const user = this.getCurrentUser();
    if (!user) return false;

    // 1. ADMIN luôn có toàn quyền 100%
    if (user.role === 'ADMIN' || user.role === 'admin') {
      return true;
    }

    // 2. Kiểm tra nếu có phân quyền tường minh (explicit permissions object)
    if (user.permissions && typeof user.permissions === 'object') {
      const modPerms = user.permissions[module];
      if (modPerms) {
        // Nếu là boolean trực tiếp cho toàn module
        if (typeof modPerms === 'boolean') {
          return modPerms;
        }
        // Nếu là object chi tiết { view: true, create: false, ... }
        if (typeof modPerms === 'object') {
          if (action === 'view') {
            return modPerms.view !== false; // Mặc định true nếu có object
          }
          return Boolean(modPerms[action]);
        }
      }
      return false;
    }

    // 3. Fallback theo Role Presets
    const preset = this.ROLE_PRESETS[user.role];
    if (preset) {
      if (preset.permissions === null) return true; // Full access
      const modPerms = preset.permissions[module];
      if (modPerms) {
        if (typeof modPerms === 'boolean') return modPerms;
        if (action === 'view') return modPerms.view !== false;
        return Boolean(modPerms[action]);
      }
      return false;
    }

    // Mặc định cho USER thông thường
    if (action === 'view' && ['dashboard', 'attendance', 'contracts'].includes(module)) {
      return true;
    }
    return false;
  },

  // Helper kiểm tra nhiều quyền cùng lúc
  canAny(module, actions = []) {
    return actions.some(act => this.can(module, act));
  },

  canAll(module, actions = []) {
    return actions.every(act => this.can(module, act));
  },

  async checkSession() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      const token = localStorage.getItem(this.tokenKey);
      
      if (saved) {
        this.currentUser = JSON.parse(saved);

        // Sync with appData accounts if available for up-to-date permissions
        if (window.appData && Array.isArray(appData.accounts)) {
          const freshAcc = appData.accounts.find(a => 
            a.account_id === this.currentUser.account_id || 
            a.employee_id === this.currentUser.employee_id ||
            a.account_email === this.currentUser.account_email
          );
          if (freshAcc) {
            this.currentUser = { ...this.currentUser, ...freshAcc };
            localStorage.setItem(this.storageKey, JSON.stringify(this.currentUser));
          }
        }

        this.applyUserSession(this.currentUser);
        this.hideLoginScreen();

        // Asynchronously verify token with server
        if (token) {
          fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
          }).then(res => res.json()).then(data => {
            if (!data.success) {
              console.warn('Session expired or invalid, logging out...');
              this.confirmLogout(false);
            }
          }).catch(err => console.warn('Auth check skipped:', err.message));
        }

        return;
      }
    } catch (e) {
      console.error('Session load error:', e);
    }
    this.showLoginScreen();
  },

  showLoginScreen() {
    document.documentElement.classList.remove('user-logged-in');
    const loginEl = document.getElementById('login-screen');
    if (loginEl) {
      loginEl.classList.remove('hidden');
    }
  },

  hideLoginScreen() {
    document.documentElement.classList.add('user-logged-in');
    const loginEl = document.getElementById('login-screen');
    if (loginEl) {
      loginEl.classList.add('hidden');
    }
  },

  async login(username, password) {
    if (!username || !password) {
      utils.showToast('Vui lòng nhập tên đăng nhập và mật khẩu', 'error');
      return false;
    }

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const json = await res.json();
      if (json.success && json.user) {
        this.currentUser = json.user;
        localStorage.setItem(this.storageKey, JSON.stringify(json.user));
        if (json.token) {
          localStorage.setItem(this.tokenKey, json.token);
        }
        this.applyUserSession(json.user);
        this.hideLoginScreen();
        utils.showToast(`Chào mừng ${json.user.full_name} (${json.user.role})!`, 'success');
        if (window.recordActivityLog) {
          window.recordActivityLog('LOGIN', 'Bảo mật', `Đăng nhập thành công vào hệ thống (${json.user.full_name} - Quyền: ${json.user.role})`);
        }
        return true;
      } else {
        utils.showToast(json.message || 'Đăng nhập không thành công', 'error');
        if (window.recordActivityLog) {
          window.recordActivityLog('LOGIN_FAIL', 'Bảo mật', `Đăng nhập thất bại cho tài khoản: ${username}`);
        }
        return false;
      }
    } catch (e) {
      console.error(e);
      utils.showToast('Lỗi kết nối máy chủ', 'error');
      return false;
    }
  },

  openLogoutModal() {
    const modal = document.getElementById('modal-logout-confirm');
    if (modal) {
      modal.classList.add('active');
    }
  },

  closeLogoutModal() {
    const modal = document.getElementById('modal-logout-confirm');
    if (modal) {
      modal.classList.remove('active');
    }
  },

  confirmLogout(showNotice = true) {
    if (window.appLogs && this.currentUser) {
      appLogs.recordClientLog('LOGOUT', 'Bảo mật', `Đăng xuất khỏi hệ thống (${this.currentUser?.full_name || ''})`);
    }
    this.closeLogoutModal();
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.tokenKey);
    this.currentUser = null;
    this.showLoginScreen();
    if (showNotice) {
      utils.showToast('Đã đăng xuất khỏi hệ thống', 'info');
    }
  },

  // ========================================================================
  // APPLY GRANULAR USER PERMISSIONS TO THE ENTIRE UI
  // ========================================================================
  applyUserSession(user) {
    if (!user) return;

    // 1. Topbar user info
    const topUserName = document.getElementById('topbar-user-name');
    const topUserRole = document.getElementById('topbar-user-role');
    const topUserAvatar = document.getElementById('topbar-user-avatar');

    const initials = user.full_name ? user.full_name.split(' ').map(n => n[0]).slice(-2).join('') : 'U';
    const isAdmin = user.role === 'ADMIN';
    const preset = this.ROLE_PRESETS[user.role];
    const displayRole = preset ? preset.name.split('(')[0].trim() : (isAdmin ? 'Admin' : (user.role || 'User'));

    if (topUserName) topUserName.textContent = user.full_name;
    if (topUserRole) {
      topUserRole.textContent = displayRole;
      topUserRole.className = `badge ${isAdmin ? 'badge-red' : 'badge-navy'}`;
    }
    if (topUserAvatar) topUserAvatar.textContent = initials;

    // 2. Sidebar user info
    const sideUserName = document.getElementById('sidebar-user-name') || document.querySelector('.sidebar-user .user-name');
    const sideUserRole = document.getElementById('sidebar-user-role') || document.querySelector('.sidebar-user .user-role');
    const sideUserAvatar = document.getElementById('sidebar-user-avatar') || document.querySelector('.sidebar-user .user-avatar');

    if (sideUserName) sideUserName.textContent = user.full_name;
    if (sideUserRole) sideUserRole.textContent = `${displayRole} - ${user.employee_id || user.account_id || ''}`;
    if (sideUserAvatar) sideUserAvatar.textContent = initials;

    // 3. Dynamic Granular Sidebar Navigation Filtering
    document.querySelectorAll('.sidebar-nav .nav-item[data-view]').forEach(item => {
      const viewId = item.getAttribute('data-view');
      if (!viewId) return;

      const canView = this.can(viewId, 'view');
      item.style.display = canView ? 'flex' : 'none';
    });

    // Hide sidebar section headers if all items in that section are hidden
    document.querySelectorAll('.sidebar-nav .nav-section-title').forEach(sectionTitle => {
      let nextEl = sectionTitle.nextElementSibling;
      let hasVisibleChild = false;
      while (nextEl && !nextEl.classList.contains('nav-section-title') && !nextEl.classList.contains('sidebar-footer')) {
        if (nextEl.classList.contains('nav-item') && nextEl.style.display !== 'none') {
          hasVisibleChild = true;
          break;
        }
        nextEl = nextEl.nextElementSibling;
      }
      sectionTitle.style.display = hasVisibleChild ? 'flex' : 'none';
    });

    // 4. Check if currently active view is restricted; if so, redirect to first allowed view
    const currentActivePanel = document.querySelector('.view-panel.active');
    if (currentActivePanel) {
      const currentViewId = currentActivePanel.id.replace('view-', '');
      if (!this.can(currentViewId, 'view')) {
        // Find first permitted view
        const allowedNav = Array.from(document.querySelectorAll('.sidebar-nav .nav-item[data-view]'))
          .find(nav => nav.style.display !== 'none');
        if (allowedNav) {
          allowedNav.click();
        } else {
          const dashboardNav = document.querySelector('.sidebar-nav .nav-item[data-view="dashboard"]');
          if (dashboardNav) dashboardNav.click();
        }
      }
    }

    // 5. Dynamic Action Elements Permission Filter (data-perm-module & data-perm-action)
    this.enforceActionPermissions();
  },

  // Enforce granular action permissions across buttons in DOM
  enforceActionPermissions() {
    document.querySelectorAll('[data-perm-module][data-perm-action]').forEach(el => {
      const mod = el.getAttribute('data-perm-module');
      const act = el.getAttribute('data-perm-action');
      const allowed = this.can(mod, act);

      if (!allowed) {
        if (el.getAttribute('data-perm-mode') === 'disable') {
          el.disabled = true;
          el.classList.add('disabled');
          el.setAttribute('title', 'Bạn không có quyền thực hiện thao tác này');
        } else {
          el.style.display = 'none';
        }
      } else {
        if (el.getAttribute('data-perm-mode') === 'disable') {
          el.disabled = false;
          el.classList.remove('disabled');
        } else {
          // Restore default display if it was hidden
          if (el.style.display === 'none') {
            el.style.display = '';
          }
        }
      }
    });
  },

  attachEventListeners() {
    // Login form submit
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const u = document.getElementById('login-username').value.trim();
        const p = document.getElementById('login-password').value;
        await this.login(u, p);
      });
    }

    // Topbar Logout button opens modal
    const logoutBtn = document.getElementById('btn-topbar-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.openLogoutModal());
    }

    // Confirm logout button inside modal
    const confirmLogoutBtn = document.getElementById('btn-confirm-logout-action');
    if (confirmLogoutBtn) {
      confirmLogoutBtn.addEventListener('click', () => this.confirmLogout());
    }

    // Toggle password visibility
    const togglePassBtn = document.getElementById('btn-toggle-password');
    const passInput = document.getElementById('login-password');
    if (togglePassBtn && passInput) {
      togglePassBtn.addEventListener('click', () => {
        const isPass = passInput.type === 'password';
        passInput.type = isPass ? 'text' : 'password';
        togglePassBtn.innerHTML = isPass ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
      });
    }
  }
};

