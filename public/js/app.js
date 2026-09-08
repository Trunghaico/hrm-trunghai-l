// ==========================================================================
// MAIN APPLICATION ROUTER & CONTROLLER
// ==========================================================================

const app = {
  async init() {
    console.log('Initializing TRUNG HAI HRM WebApp...');
    

    // 1. Initialize Auth Session immediately (Synchronous from LocalStorage)
    appAuth.init();

    // 2. Load Data from Backend
    const loaded = await appData.init();
    if (!loaded) {
      utils.showToast('Không thể kết nối CSDL máy chủ', 'error');
    }

    // 3. Initialize Sub-modules
    appCompany.init();
    appDashboard.init();
    appEmployees.init();
    appImport.init();
    appResigned.init();
    appOrganization.init();
    appReports.init();
    appAccounts.init();
    appLogs.init();
    appTrash.init();
    if (window.appContracts) {
      appContracts.init();
      appContracts.render();
    }

    // 4. Update sidebar count badges
    const sideCompCount = document.getElementById('sidebar-company-count');
    if (sideCompCount) sideCompCount.textContent = (appData.companies || []).length;
    const sideDeptCount = document.getElementById('sidebar-dept-count');
    if (sideDeptCount) sideDeptCount.textContent = (appData.departments || []).length;
    const sidePosCount = document.getElementById('sidebar-pos-count');
    if (sidePosCount) sidePosCount.textContent = (appData.positions || []).length;
    const sideResignedCount = document.getElementById('sidebar-resigned-count');
    if (sideResignedCount) sideResignedCount.textContent = (appData.employees || []).filter(e => e.employment_status === 'Đã nghỉ việc').length;
    const sideContractCount = document.getElementById('sidebar-contract-count');
    if (sideContractCount) {
      const expiringCount = (appData.contracts || []).filter(c => {
        const d = (window.appContracts && appContracts.getDaysRemaining) ? appContracts.getDaysRemaining(c.expiry_date || c.end_date) : null;
        return d !== null && d >= 0 && d <= 30;
      }).length;
      if (expiringCount > 0) {
        sideContractCount.textContent = expiringCount;
        sideContractCount.style.display = 'inline-block';
        sideContractCount.style.background = '#F59E0B';
      }
    }

    // 5. Navigation setup
    this.setupNavigation();
    this.setupSidebarToggle();
    this.setupGlobalSearch();
    this.setupQuickActions();

    // Global listener: Click on modal backdrop or outside popovers
    document.addEventListener('click', (e) => {
      if (e.target && e.target.classList && e.target.classList.contains('modal-backdrop')) {
        this.closeAllModalsAndOverlays();
      }
      // Click outside department multi-select dropdown closes it
      const deptWrapper = document.querySelector('.dept-multiselect-wrapper');
      if (deptWrapper && !deptWrapper.contains(e.target)) {
        const deptDropdown = document.getElementById('dept-multiselect-dropdown');
        if (deptDropdown && deptDropdown.classList.contains('show')) {
          deptDropdown.classList.remove('show');
        }
      }
    });

    // Global listener: Pressing Escape closes active modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const activeModal = document.querySelector('.modal-backdrop.active');
        if (activeModal) {
          this.closeAllModalsAndOverlays();
        }
      }
    });

    // Window resize handler
    window.addEventListener('resize', () => {
      if (document.getElementById('view-dashboard')?.classList.contains('active')) {
        appDashboard.renderCharts();
      }
      if (document.getElementById('view-reports')?.classList.contains('active')) {
        appReports.renderCharts();
      }
    });

    utils.showToast('Hệ thống HRM TRUNG HẢI đã sẵn sàng!', 'success');
  },

  // ========================================================================
  // CENTRALIZED MODAL & OVERLAY DISMISSAL
  // ========================================================================
  closeAllModalsAndOverlays() {
    // 1. Hide all active modal backdrops
    try {
      const activeModals = document.querySelectorAll('.modal-backdrop.active');
      activeModals.forEach(modal => {
        modal.classList.remove('active');
      });
    } catch (e) {
      console.warn('Error closing active modals:', e);
    }

    // 2. Call module-specific modal close handlers to reset internal states
    try {
      if (window.appEmployees) {
        if (typeof appEmployees.closeDetailModal === 'function') appEmployees.closeDetailModal();
        if (typeof appEmployees.closeFormModal === 'function') appEmployees.closeFormModal();
        if (typeof appEmployees.closeBulkDeleteModal === 'function') appEmployees.closeBulkDeleteModal();
        if (typeof appEmployees.closeDeleteAllModal === 'function') appEmployees.closeDeleteAllModal();
      }
    } catch (e) {
      console.warn('Error closing employee modals:', e);
    }

    try {
      if (window.appContracts) {
        if (typeof appContracts.closeFormModal === 'function') appContracts.closeFormModal();
        if (typeof appContracts.closeDetailModal === 'function') appContracts.closeDetailModal();
        if (typeof appContracts.closeAppendicesModal === 'function') appContracts.closeAppendicesModal();
        if (typeof appContracts.closeTerminateModal === 'function') appContracts.closeTerminateModal();
        if (typeof appContracts.closeTemplatesModal === 'function') appContracts.closeTemplatesModal();
        if (typeof appContracts.closeMergeModal === 'function') appContracts.closeMergeModal();
        if (typeof appContracts.closePrintPreviewModal === 'function') appContracts.closePrintPreviewModal();
      }
    } catch (e) {
      console.warn('Error closing contract modals:', e);
    }

    try {
      if (window.appImport && typeof appImport.closeModal === 'function') {
        appImport.closeModal();
      }
      if (window.appOrgImport && typeof appOrgImport.closeModal === 'function') {
        appOrgImport.closeModal();
      }
      if (window.appOrganization) {
        if (typeof appOrganization.closeCompanyModal === 'function') appOrganization.closeCompanyModal();
        if (typeof appOrganization.closeDeptModal === 'function') appOrganization.closeDeptModal();
        if (typeof appOrganization.closePosModal === 'function') appOrganization.closePosModal();
      }
      if (window.appAccounts) {
        if (typeof appAccounts.closeFormModal === 'function') appAccounts.closeFormModal();
        if (typeof appAccounts.closeResetModal === 'function') appAccounts.closeResetModal();
        if (typeof appAccounts.closeDeleteModal === 'function') appAccounts.closeDeleteModal();
        if (typeof appAccounts.closeBulkDeleteModal === 'function') appAccounts.closeBulkDeleteModal();
      }
      if (window.appPWA && typeof appPWA.closeIosModal === 'function') {
        appPWA.closeIosModal();
      }
    } catch (e) {
      console.warn('Error closing other modals:', e);
    }

    // 3. Reset internal modal tabs to first tab
    try {
      const firstDetBtn = document.querySelector('#modal-employee-detail .modal-tab-btn, #modal-employee-detail .det-tab-btn');
      if (firstDetBtn && !firstDetBtn.classList.contains('active')) {
        firstDetBtn.click();
      }
      const firstFormBtn = document.querySelector('#modal-employee-form .form-tab-btn');
      if (firstFormBtn && !firstFormBtn.classList.contains('active')) {
        firstFormBtn.click();
      }
    } catch (e) {}

    // 4. Close dropdown menus
    try {
      document.querySelectorAll('.dropdown-menu.show, .action-dropdown.show, .export-dropdown-menu.show, #emp-action-dropdown.show, #dept-multiselect-dropdown.show').forEach(el => {
        el.classList.remove('show');
      });
      const colConfigDropdown = document.getElementById('col-config-dropdown');
      if (colConfigDropdown) colConfigDropdown.style.display = 'none';
    } catch (e) {}

    // 5. Close mobile drawer if open
    try {
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.remove('mobile-open');
      const sidebarBackdrop = document.getElementById('sidebar-backdrop');
      if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
    } catch (e) {}

    // 6. Restore body scrolling
    document.body.style.overflow = '';
  },

  setupSidebarToggle() {
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebar = document.getElementById('sidebar');
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        // On mobile screen (<= 768px), sidebar collapse is disabled; drawer is managed by pwa.js
        if (window.innerWidth <= 768) return;

        sidebar.classList.toggle('collapsed');
        setTimeout(() => {
          if (document.getElementById('view-dashboard')?.classList.contains('active')) {
            appDashboard.renderCharts();
          }
          if (document.getElementById('view-reports')?.classList.contains('active')) {
            appReports.renderCharts();
          }
        }, 250);
      });
    }
  },

  setupNavigation() {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    const viewPanels = document.querySelectorAll('.view-panel');
    const pageTitle = document.getElementById('current-page-title');

    const titles = {
      'dashboard': '<i class="fa-solid fa-chart-pie"></i> <span>Dashboard</span>',
      'employees': '<i class="fa-solid fa-users"></i> <span>Quản Lý Nhân Sự</span>',
      'companies': '<i class="fa-solid fa-city"></i> <span>Danh Sách Công Ty</span>',
      'departments': '<i class="fa-solid fa-building"></i> <span>Danh Sách Phòng Ban</span>',
      'positions': '<i class="fa-solid fa-briefcase"></i> <span>Vị Trí Công Việc</span>',
      'org-chart': '<i class="fa-solid fa-sitemap"></i> <span>Sơ Đồ Cơ Cấu Tổ Chức</span>',
      'contracts': '<i class="fa-solid fa-file-contract"></i> <span>Hợp Đồng & Cảnh Báo</span>',
      'resigned': '<i class="fa-solid fa-user-xmark"></i> <span>Quản Lý Nhân Sự Nghỉ Việc</span>',
      'reports': '<i class="fa-solid fa-chart-line"></i> <span>Báo Cáo Biến Động Nhân Sự</span>',
      'accounts': '<i class="fa-solid fa-user-shield"></i> <span>Tài Khoản & Phân Quyền</span>',
      'logs': '<i class="fa-solid fa-clock-rotate-left"></i> <span>Nhật Ký Hoạt Động Hệ Thống</span>',
      'trash': '<i class="fa-solid fa-trash-can"></i> <span>Thùng Rác & Khôi Phục Nhân Sự</span>'
    };

    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const viewId = item.getAttribute('data-view');
        if (!viewId) return;

        // Auto close all modals, tabs, popups, and dropdowns when switching views
        this.closeAllModalsAndOverlays();

        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');

        viewPanels.forEach(panel => {
          panel.classList.remove('active');
          if (panel.id === `view-${viewId}`) {
            panel.classList.add('active');
          }
        });

        if (pageTitle && titles[viewId]) {
          pageTitle.innerHTML = titles[viewId];
        }

        // Trigger dynamic renders on view activation
        if (viewId === 'dashboard') {
          setTimeout(() => appDashboard.renderCharts(), 50);
        } else if (viewId === 'reports') {
          appReports.render();
        } else if (viewId === 'resigned') {
          appResigned.render();
        } else if (viewId === 'companies') {
          appOrganization.renderCompaniesTable();
        } else if (viewId === 'departments') {
          appOrganization.renderDepartmentsTable();
        } else if (viewId === 'positions') {
          appOrganization.renderPositionsTable();
        } else if (viewId === 'org-chart') {
          appOrganization.renderOrgChart();
        } else if (viewId === 'contracts') {
          if (window.appContracts) {
            appContracts.render();
          } else {
            appOrganization.renderContractsTable();
          }
        } else if (viewId === 'accounts') {
          appAccounts.init();
        } else if (viewId === 'logs') {
          appLogs.fetchLogs();
        } else if (viewId === 'trash') {
          appTrash.render();
        }
      });
    });
  },

  setupGlobalSearch() {
    const globalSearch = document.getElementById('global-search-input');
    if (!globalSearch) return;

    globalSearch.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const query = globalSearch.value.trim();
        if (query) {
          // Auto close any active modals before navigating
          this.closeAllModalsAndOverlays();
          // Switch to employees view and search
          document.querySelector('.nav-item[data-view="employees"]').click();
          const empSearch = document.getElementById('emp-search-input');
          if (empSearch) {
            empSearch.value = query;
            appEmployees.currentPage = 1;
            appEmployees.applyFilters();
          }
        }
      }
    });
  },

  setupQuickActions() {
    const quickExportBtn = document.getElementById('btn-quick-export');
    if (quickExportBtn) {
      quickExportBtn.addEventListener('click', () => {
        appReports.exportCompleteWorkbook();
      });
    }
  }
};

// Global helper to dismiss all modals & overlays from anywhere
window.closeAllModalsAndOverlays = () => {
  if (window.app && typeof app.closeAllModalsAndOverlays === 'function') {
    app.closeAllModalsAndOverlays();
  }
};

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
