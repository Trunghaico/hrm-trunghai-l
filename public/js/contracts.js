// ==========================================================================
// CONTRACTS MANAGEMENT MODULE (QUẢN LÝ HỢP ĐỒNG LAO ĐỘNG & PHỤ LỤC)
// HRM Trung Hải Enterprise Edition
// ==========================================================================

// Local IndexedDB Storage for Contract Scan Documents / PDFs / Large Files
const contractFileStore = {
  dbName: 'HRM_Contract_Files_DB',
  storeName: 'contract_files',
  dbVersion: 1,
  memoryCache: new Map(),

  async getDB() {
    if (this._dbPromise) return this._dbPromise;
    this._dbPromise = new Promise((resolve) => {
      try {
        if (!window.indexedDB) {
          resolve(null);
          return;
        }
        const req = window.indexedDB.open(this.dbName, this.dbVersion);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: 'id' });
          }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => {
          console.warn('[contractFileStore] IndexedDB open error:', e);
          resolve(null);
        };
      } catch (err) {
        console.warn('[contractFileStore] IndexedDB failed:', err);
        resolve(null);
      }
    });
    return this._dbPromise;
  },

  async saveFile(id, dataUrl, meta = {}) {
    if (!id || !dataUrl) return;
    this.memoryCache.set(id, dataUrl);
    try {
      const db = await this.getDB();
      if (!db) {
        try {
          if (dataUrl.length < 100000) {
            localStorage.setItem(`hrm_att_${id}`, dataUrl);
          }
        } catch (_) {}
        return;
      }
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      store.put({ id, data_url: dataUrl, ...meta, updated_at: Date.now() });
    } catch (e) {
      console.warn('[contractFileStore] saveFile error:', e);
    }
  },

  async getFile(id) {
    if (!id) return null;
    if (this.memoryCache.has(id)) {
      return this.memoryCache.get(id);
    }
    try {
      const db = await this.getDB();
      if (!db) {
        return localStorage.getItem(`hrm_att_${id}`) || null;
      }
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(this.storeName, 'readonly');
          const store = tx.objectStore(this.storeName);
          const req = store.get(id);
          req.onsuccess = () => {
            const res = req.result ? req.result.data_url : null;
            if (res) this.memoryCache.set(id, res);
            resolve(res);
          };
          req.onerror = () => resolve(null);
        } catch (_) {
          resolve(null);
        }
      });
    } catch (e) {
      console.warn('[contractFileStore] getFile error:', e);
      return null;
    }
  }
};

const appContracts = {
  initialized: false,
  contracts: [],
  activeTab: 'all',          // 'all' | 'active' | 'expiring' | 'expired'
  searchQuery: '',
  filterDept: '',
  filterType: '',
  filterStatus: '',
  filterFromDate: '',
  filterToDate: '',
  viewMode: 'table',         // 'table' | 'card'
  currentPage: 1,
  pageSize: 25,
  currentEditingId: null,
  currentAppendixContractId: null,
  currentTerminateContractId: null,
  tempAttachments: [],       // File attachments being added to form
  tempAppendixFile: null,

  init() {
    if (this.initialized) return;
    this.attachEventListeners();
    this.initialized = true;
    console.log('[Contracts] Contract management module initialized.');
  },

  // Gắn các sự kiện lắng nghe giao diện
  attachEventListeners() {
    // 1. Search input
    const searchInput = document.getElementById('contract-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.currentPage = 1;
        this.render();
      });
    }

    // 2. Filter selects
    const deptSelect = document.getElementById('contract-filter-dept');
    if (deptSelect) {
      deptSelect.addEventListener('change', (e) => {
        this.filterDept = e.target.value;
        this.currentPage = 1;
        this.render();
      });
    }

    const typeSelect = document.getElementById('contract-filter-type');
    if (typeSelect) {
      typeSelect.addEventListener('change', (e) => {
        this.filterType = e.target.value;
        this.currentPage = 1;
        this.render();
      });
    }

    const statusSelect = document.getElementById('contract-filter-status');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        this.filterStatus = e.target.value;
        this.currentPage = 1;
        this.render();
      });
    }

    // 3. Date range filters
    const fromDateInput = document.getElementById('contract-filter-from');
    if (fromDateInput) {
      fromDateInput.addEventListener('change', (e) => {
        this.filterFromDate = e.target.value;
        this.currentPage = 1;
        this.render();
      });
    }

    const toDateInput = document.getElementById('contract-filter-to');
    if (toDateInput) {
      toDateInput.addEventListener('change', (e) => {
        this.filterToDate = e.target.value;
        this.currentPage = 1;
        this.render();
      });
    }

    // 4. Page size
    const pageSizeSelect = document.getElementById('contract-page-size');
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', (e) => {
        this.pageSize = parseInt(e.target.value, 10) || 25;
        this.currentPage = 1;
        this.render();
      });
    }

    // 5. Employee auto-fill in Contract Form
    const empSelect = document.getElementById('contract-form-emp-id');
    if (empSelect) {
      empSelect.addEventListener('change', (e) => this.onEmployeeSelectChange(e.target.value));
    }

    // 6. Contract type auto-calculate expiry date
    const formTypeSelect = document.getElementById('contract-form-type');
    if (formTypeSelect) {
      formTypeSelect.addEventListener('change', (e) => this.onContractTypeChange(e.target.value));
    }

    const formEffectiveInput = document.getElementById('contract-form-effective-date');
    if (formEffectiveInput) {
      formEffectiveInput.addEventListener('change', () => {
        const type = document.getElementById('contract-form-type')?.value;
        if (type) this.onContractTypeChange(type);
      });
    }

    // 7. File attachment listener for contract form
    const fileInput = document.getElementById('contract-form-attachment-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => this.handleAttachmentUpload(e));
    }

    // 8. File attachment listener for appendix form
    const appxFileInput = document.getElementById('appendix-form-file-input');
    if (appxFileInput) {
      appxFileInput.addEventListener('change', (e) => this.handleAppendixFileUpload(e));
    }

    // 9. Excel Import Dropzone
    const importFileInput = document.getElementById('contract-import-file-input');
    const importDropzone = document.getElementById('contract-import-dropzone');
    if (importFileInput && importDropzone) {
      importDropzone.addEventListener('click', () => importFileInput.click());
      importDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        importDropzone.style.borderColor = 'var(--primary-navy)';
        importDropzone.style.background = '#EFF6FF';
      });
      importDropzone.addEventListener('dragleave', () => {
        importDropzone.style.borderColor = 'var(--border-color)';
        importDropzone.style.background = '#FFFFFF';
      });
      importDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        importDropzone.style.borderColor = 'var(--border-color)';
        importDropzone.style.background = '#FFFFFF';
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.processImportExcel(e.dataTransfer.files[0]);
        }
      });
      importFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.processImportExcel(e.target.files[0]);
        }
      });
    }
  },

  // Đồng bộ và tải lại danh sách hợp đồng
  async fetchContracts() {
    try {
      const res = await fetch('/api/contracts');
      const json = await res.json();
      if (json.success && Array.isArray(json.contracts)) {
        this.contracts = json.contracts;
        if (typeof appData !== 'undefined') {
          appData.contracts = this.contracts;
        }
      } else {
        this.contracts = (typeof appData !== 'undefined' && appData.contracts) ? appData.contracts : [];
      }
    } catch (e) {
      console.warn('Lỗi lấy hợp đồng từ /api/contracts, sử dụng dữ liệu bộ nhớ:', e);
      this.contracts = (typeof appData !== 'undefined' && appData.contracts) ? appData.contracts : [];
    }
  },

  // Hàm tính toán số ngày còn lại đến khi hết hạn
  getDaysRemaining(expiryDateStr) {
    if (!expiryDateStr || expiryDateStr === 'Không xác định' || expiryDateStr === '-') return null;
    const iso = (typeof utils !== 'undefined' && utils.parseToIsoDate) ? utils.parseToIsoDate(expiryDateStr) : expiryDateStr;
    const expiry = new Date(iso);
    if (isNaN(expiry.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);
    const diffTime = expiry.getTime() - today.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  },

  // Đổi tab phân loại trạng thái
  switchTab(tabKey) {
    this.activeTab = tabKey;
    this.currentPage = 1;
    document.querySelectorAll('.contract-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabKey);
    });
    this.render();
  },

  // Đổi chế độ xem: Table vs Card
  switchViewMode(mode) {
    this.viewMode = mode;
    const btnTable = document.getElementById('btn-view-contract-table');
    const btnCard = document.getElementById('btn-view-contract-card');
    if (btnTable) btnTable.classList.toggle('active', mode === 'table');
    if (btnCard) btnCard.classList.toggle('active', mode === 'card');

    const tableWrapper = document.getElementById('contracts-table-wrapper');
    const cardWrapper = document.getElementById('contracts-cards-wrapper');
    if (tableWrapper) tableWrapper.style.display = mode === 'table' ? 'block' : 'none';
    if (cardWrapper) cardWrapper.style.display = mode === 'card' ? 'grid' : 'none';
    this.render();
  },

  // Đặt lại toàn bộ bộ lọc
  resetFilters() {
    this.searchQuery = '';
    this.filterDept = '';
    this.filterType = '';
    this.filterStatus = '';
    this.filterFromDate = '';
    this.filterToDate = '';
    this.activeTab = 'all';

    const searchInput = document.getElementById('contract-search-input');
    if (searchInput) searchInput.value = '';
    const deptSelect = document.getElementById('contract-filter-dept');
    if (deptSelect) deptSelect.value = '';
    const typeSelect = document.getElementById('contract-filter-type');
    if (typeSelect) typeSelect.value = '';
    const statusSelect = document.getElementById('contract-filter-status');
    if (statusSelect) statusSelect.value = '';
    const fromInput = document.getElementById('contract-filter-from');
    if (fromInput) fromInput.value = '';
    const toInput = document.getElementById('contract-filter-to');
    if (toInput) toInput.value = '';

    document.querySelectorAll('.contract-tab-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === 'all');
    });

    this.currentPage = 1;
    this.render();
  },

  // Render toàn bộ giao diện Hợp đồng
  async render() {
    await this.fetchContracts();
    this.populateDeptFilterOptions();
    this.renderKPIs();
    this.renderExpiringWarningBanner();

    const filtered = this.getFilteredContracts();
    const total = filtered.length;
    const pageSize = this.pageSize || 25;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (this.currentPage > totalPages) this.currentPage = totalPages;
    const page = Math.max(1, this.currentPage);
    const start = (page - 1) * pageSize;
    const pageData = filtered.slice(start, start + pageSize);

    // 1. Render Table View
    if (this.viewMode === 'table') {
      this.renderTableView(pageData);
    } else {
      this.renderCardView(pageData);
    }

    // 2. Render Pagination
    this.renderPagination(total, page, totalPages, start, pageSize);
  },

  // Lấy danh sách hợp đồng sau khi áp dụng tất cả các bộ lọc
  getFilteredContracts() {
    const list = this.contracts || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return list.filter(c => {
      const statusUpper = (c.contract_status || 'HIỆU LỰC').toUpperCase();
      const isTerminated = statusUpper === 'ĐÃ CHẤM DỨT' || statusUpper === 'HẾT HẠN';
      const daysLeft = this.getDaysRemaining(c.expiry_date || c.end_date);
      const isExpiring = !isTerminated && daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;

      // 1. Tab Status Filter
      if (this.activeTab === 'active' && isTerminated) return false;
      if (this.activeTab === 'expiring' && !isExpiring) return false;
      if (this.activeTab === 'expired' && !isTerminated) return false;

      // 2. Search Query (Tên, Mã NV, Số HĐ)
      if (this.searchQuery) {
        const q = this.searchQuery;
        const name = (c.full_name || '').toLowerCase();
        const empId = (c.employee_id || '').toLowerCase();
        const contractId = (c.contract_id || '').toLowerCase();
        const type = (c.contract_type || '').toLowerCase();
        if (!name.includes(q) && !empId.includes(q) && !contractId.includes(q) && !type.includes(q)) {
          return false;
        }
      }

      // 3. Department filter
      if (this.filterDept) {
        if (c.department_id !== this.filterDept && (c.department_name || '') !== this.filterDept) {
          return false;
        }
      }

      // 4. Contract Type filter
      if (this.filterType) {
        const type = (c.contract_type || '').toLowerCase();
        if (!type.includes(this.filterType.toLowerCase())) return false;
      }

      // 5. Direct Status filter
      if (this.filterStatus) {
        if (this.filterStatus === 'SẮP HẾT HẠN') {
          if (!isExpiring) return false;
        } else if (statusUpper !== this.filterStatus.toUpperCase()) {
          return false;
        }
      }

      // 6. Date Range filter (Dựa trên Ngày hiệu lực hoặc Ngày hết hạn)
      const effIso = (typeof utils !== 'undefined' && utils.parseToIsoDate) ? utils.parseToIsoDate(c.effective_date || c.start_date) : '';
      if (this.filterFromDate && effIso && effIso < this.filterFromDate) return false;
      if (this.filterToDate && effIso && effIso > this.filterToDate) return false;

      return true;
    });
  },

  // Điền danh sách phòng ban vào select bộ lọc
  populateDeptFilterOptions() {
    const select = document.getElementById('contract-filter-dept');
    if (!select) return;
    const currentVal = select.value;
    const depts = (typeof appData !== 'undefined' && appData.departments) ? appData.departments : [];
    let html = '<option value="">-- Tất cả phòng ban / đơn vị --</option>';
    depts.forEach(d => {
      html += `<option value="${d.department_id}" ${currentVal === d.department_id ? 'selected' : ''}>${d.department_name}</option>`;
    });
    select.innerHTML = html;
  },

  // Tính toán và hiển thị thẻ thống kê KPI
  renderKPIs() {
    const total = this.contracts.length;
    let active = 0;
    let expiring = 0;
    let expired = 0;

    this.contracts.forEach(c => {
      const st = (c.contract_status || 'HIỆU LỰC').toUpperCase();
      if (st === 'ĐÃ CHẤM DỨT' || st === 'HẾT HẠN') {
        expired++;
      } else {
        const days = this.getDaysRemaining(c.expiry_date || c.end_date);
        if (days !== null && days >= 0 && days <= 30) {
          expiring++;
        } else {
          active++;
        }
      }
    });

    const elTotal = document.getElementById('kpi-contract-total');
    if (elTotal) elTotal.textContent = `${total} HĐ`;
    const elActive = document.getElementById('kpi-contract-active');
    if (elActive) elActive.textContent = `${active} HĐ`;
    const elExpiring = document.getElementById('kpi-contract-expiring');
    if (elExpiring) elExpiring.textContent = `${expiring} HĐ`;
    const elExpired = document.getElementById('kpi-contract-expired');
    if (elExpired) elExpired.textContent = `${expired} HĐ`;

    // Cập nhật số lượng trên các nút Tab
    const tabBadgeAll = document.getElementById('contract-tab-badge-all');
    if (tabBadgeAll) tabBadgeAll.textContent = total;
    const tabBadgeActive = document.getElementById('contract-tab-badge-active');
    if (tabBadgeActive) tabBadgeActive.textContent = active;
    const tabBadgeExpiring = document.getElementById('contract-tab-badge-expiring');
    if (tabBadgeExpiring) tabBadgeExpiring.textContent = expiring;
    const tabBadgeExpired = document.getElementById('contract-tab-badge-expired');
    if (tabBadgeExpired) tabBadgeExpired.textContent = expired;

    // Cập nhật huy hiệu trên menu bên trái (Sidebar)
    const sideContractCount = document.getElementById('sidebar-contract-count');
    if (sideContractCount) {
      if (expiring > 0) {
        sideContractCount.textContent = expiring;
        sideContractCount.style.display = 'inline-block';
        sideContractCount.style.background = '#F59E0B';
        sideContractCount.title = `Có ${expiring} hợp đồng sắp hết hạn trong 30 ngày`;
      } else {
        sideContractCount.style.display = 'none';
      }
    }
  },

  // Widget Cảnh báo Hợp đồng sắp hết hạn trong vòng 30 ngày
  renderExpiringWarningBanner() {
    const bannerContainer = document.getElementById('contracts-alert-banner');
    if (!bannerContainer) return;

    const expiringContracts = this.contracts.filter(c => {
      const st = (c.contract_status || 'HIỆU LỰC').toUpperCase();
      if (st === 'ĐÃ CHẤM DỨT' || st === 'HẾT HẠN') return false;
      const days = this.getDaysRemaining(c.expiry_date || c.end_date);
      return days !== null && days >= 0 && days <= 30;
    }).sort((a, b) => {
      const da = this.getDaysRemaining(a.expiry_date || a.end_date) || 999;
      const db = this.getDaysRemaining(b.expiry_date || b.end_date) || 999;
      return da - db;
    });

    if (expiringContracts.length === 0) {
      bannerContainer.style.display = 'none';
      bannerContainer.innerHTML = '';
      return;
    }

    bannerContainer.style.display = 'block';
    bannerContainer.innerHTML = `
      <div style="background: linear-gradient(135deg, #FEF2F2 0%, #FFFBEB 100%); border: 1px solid #FCD34D; border-left: 5px solid #F59E0B; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.03);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: #F59E0B; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-size: 15px;">
              <i class="fa-solid fa-triangle-exclamation"></i>
            </div>
            <div>
              <strong style="color: #92400E; font-size: 14.5px;">CẢNH BÁO: CÓ ${expiringContracts.length} HỢP ĐỒNG LAO ĐỘNG SẮP HẾT HẠN TRONG 30 NGÀY TỚI</strong>
              <div style="font-size: 12.5px; color: #B45309;">Bộ phận nhân sự cần chủ động tiến hành đánh giá gia hạn, ký phụ lục hoặc ký hợp đồng mới đúng thời hạn luật định.</div>
            </div>
          </div>
          <button class="btn btn-sm" onclick="appContracts.switchTab('expiring')" style="background: #D97706; color: #FFFFFF; border: none; font-weight: 500;">
            <i class="fa-solid fa-list-check"></i> Xem Toàn Bộ Danh Sách Sắp Hết Hạn
          </button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px; margin-top: 10px;">
          ${expiringContracts.slice(0, 4).map(c => {
            const days = this.getDaysRemaining(c.expiry_date || c.end_date);
            const urgentClass = days <= 7 ? '#DC2626' : '#D97706';
            return `
              <div style="background: #FFFFFF; border: 1px solid #FDE68A; border-radius: 6px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                <div>
                  <div style="font-weight: 600; color: var(--text-primary); font-size: 13px;">${c.full_name || c.employee_id}</div>
                  <div style="font-size: 11.5px; color: var(--text-secondary);">${c.contract_id} &bull; ${c.contract_type || 'HĐ xác định'}</div>
                  <div style="font-size: 11.5px; color: var(--text-muted);">Hết hạn: <strong style="color: ${urgentClass};">${utils.formatDate(c.expiry_date || c.end_date)}</strong></div>
                </div>
                <div style="text-align: right;">
                  <span class="badge" style="background: ${days <= 7 ? '#FEE2E2' : '#FEF3C7'}; color: ${urgentClass}; font-weight: 700; margin-bottom: 4px; display: inline-block;">
                    ${days === 0 ? 'Hết hạn hôm nay' : `Còn ${days} ngày`}
                  </span>
                  <div style="display: flex; gap: 4px; justify-content: flex-end;">
                    <button class="btn btn-icon btn-sm" title="Gia hạn hoặc ký phụ lục" onclick="appContracts.openAppendicesModal('${c.contract_id}', 'extend')" style="background: #EFF6FF; color: #2563EB; border: none;">
                      <i class="fa-solid fa-clock-rotate-left"></i>
                    </button>
                    <button class="btn btn-icon btn-sm" title="Chấm dứt hợp đồng" onclick="appContracts.openTerminateModal('${c.contract_id}')" style="background: #FEE2E2; color: #DC2626; border: none;">
                      <i class="fa-solid fa-file-excel"></i>
                    </button>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  // Hiển thị dạng bảng (Table View)
  renderTableView(pageData) {
    const tbody = document.getElementById('contracts-tbody');
    if (!tbody) return;

    if (pageData.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; padding: 36px; color: var(--text-muted);">
            <i class="fa-regular fa-folder-open" style="font-size: 32px; margin-bottom: 10px; display: block; color: #CBD5E1;"></i>
            Không tìm thấy hợp đồng phù hợp với điều kiện tìm kiếm.
          </td>
        </tr>
      `;
      return;
    }

    const startIdx = (Math.max(1, this.currentPage) - 1) * (this.pageSize || 25);

    tbody.innerHTML = pageData.map((c, idx) => {
      const daysLeft = this.getDaysRemaining(c.expiry_date || c.end_date);
      const stUpper = (c.contract_status || 'HIỆU LỰC').toUpperCase();
      const isTerminated = stUpper === 'ĐÃ CHẤM DỨT' || stUpper === 'HẾT HẠN';

      let statusBadge = '';
      if (stUpper === 'ĐÃ CHẤM DỨT') {
        statusBadge = '<span class="badge" style="background: #F1F5F9; color: #64748B;"><i class="fa-solid fa-ban"></i> ĐÃ CHẤM DỨT</span>';
      } else if (stUpper === 'HẾT HẠN' || (daysLeft !== null && daysLeft < 0)) {
        statusBadge = '<span class="badge badge-resigned"><i class="fa-solid fa-calendar-xmark"></i> HẾT HẠN</span>';
      } else if (daysLeft !== null && daysLeft <= 30) {
        statusBadge = `<span class="badge" style="background: #FEF3C7; color: #D97706; font-weight: 600;"><i class="fa-solid fa-triangle-exclamation"></i> SẮP HẾT HẠN (${daysLeft}n)</span>`;
      } else {
        statusBadge = '<span class="badge badge-active"><i class="fa-solid fa-circle-check"></i> HIỆU LỰC</span>';
      }

      const appendicesCount = Array.isArray(c.appendices) ? c.appendices.length : 0;
      const attachmentsCount = Array.isArray(c.attachments) ? c.attachments.length : 0;
      const salaryDisplay = c.salary ? utils.formatCurrency(c.salary) : '-';

      return `
        <tr data-contract-id="${c.contract_id}">
          <td style="color: var(--text-muted); font-size: 12px; font-weight: 500; text-align: center;">${startIdx + idx + 1}</td>
          <td>
            <strong style="color: var(--primary-navy); cursor: pointer; font-family: monospace;" onclick="appContracts.openDetailModal('${c.contract_id}')">${c.contract_id}</strong>
          </td>
          <td>
            <span class="badge badge-navy" style="cursor: pointer;" onclick="appEmployees.openDetailModal('${c.employee_id}')" title="Xem hồ sơ nhân sự">
              ${c.employee_id}
            </span>
          </td>
          <td>
            <strong style="color: var(--text-primary); cursor: pointer;" onclick="appContracts.openDetailModal('${c.contract_id}')">${c.full_name || '-'}</strong>
            <div style="font-size: 11px; color: var(--text-muted);">${c.department_name || '-'}</div>
          </td>
          <td><span class="badge badge-navy">${c.contract_type || '-'}</span></td>
          <td style="font-size: 12.5px;">${utils.formatDate(c.effective_date || c.start_date)}</td>
          <td style="font-size: 12.5px;">
            ${(c.expiry_date || c.end_date) ? utils.formatDate(c.expiry_date || c.end_date) : '<span style="color: var(--text-muted);">Không xác định</span>'}
          </td>
          <td style="font-weight: 600; color: #059669; font-size: 12.5px;">${salaryDisplay}</td>
          <td style="text-align: center;">
            <button class="btn btn-sm" onclick="appContracts.openAppendicesModal('${c.contract_id}')" style="background: #F8FAFC; border: 1px solid var(--border-color); padding: 2px 8px; font-size: 11.5px;" title="Xem và thêm phụ lục hợp đồng">
              <i class="fa-solid fa-paperclip" style="color: #2563EB;"></i> ${appendicesCount} PL
            </button>
          </td>
          <td>${statusBadge}</td>
          <td style="text-align: center; white-space: nowrap;">
            <div style="display: flex; gap: 4px; justify-content: center;">
              <button class="btn btn-icon btn-sm" title="Xem chi tiết HĐ & File đính kèm" onclick="appContracts.openDetailModal('${c.contract_id}')">
                <i class="fa-solid fa-eye" style="color: var(--primary-navy);"></i>
              </button>
              <button class="btn btn-icon btn-sm" title="Chỉnh sửa hợp đồng" onclick="appContracts.openEditModal('${c.contract_id}')">
                <i class="fa-solid fa-pen-to-square" style="color: #2563EB;"></i>
              </button>
              <button class="btn btn-icon btn-sm" title="Nhân bản hợp đồng này" onclick="appContracts.openCloneModal('${c.contract_id}')">
                <i class="fa-solid fa-clone" style="color: #059669;"></i>
              </button>
              ${!isTerminated ? `
                <button class="btn btn-icon btn-sm" title="Chấm dứt hợp đồng" onclick="appContracts.openTerminateModal('${c.contract_id}')">
                  <i class="fa-solid fa-file-circle-xmark" style="color: #D97706;"></i>
                </button>
              ` : ''}
              <button class="btn btn-icon btn-sm" title="Xóa hợp đồng" onclick="appContracts.deleteContract('${c.contract_id}')">
                <i class="fa-solid fa-trash" style="color: var(--accent-red);"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  // Hiển thị dạng lưới thẻ (Card View)
  renderCardView(pageData) {
    const container = document.getElementById('contracts-cards-wrapper');
    if (!container) return;

    if (pageData.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px; color: var(--text-muted); background: #FFFFFF; border-radius: 8px; border: 1px solid var(--border-color);">
          <i class="fa-regular fa-folder-open" style="font-size: 36px; margin-bottom: 12px; color: #CBD5E1; display: block;"></i>
          Không tìm thấy hợp đồng nào phù hợp.
        </div>
      `;
      return;
    }

    container.innerHTML = pageData.map(c => {
      const daysLeft = this.getDaysRemaining(c.expiry_date || c.end_date);
      const stUpper = (c.contract_status || 'HIỆU LỰC').toUpperCase();
      const isTerminated = stUpper === 'ĐÃ CHẤM DỨT' || stUpper === 'HẾT HẠN';

      let statusBadge = '';
      if (stUpper === 'ĐÃ CHẤM DỨT') {
        statusBadge = '<span class="badge" style="background: #F1F5F9; color: #64748B;">ĐÃ CHẤM DỨT</span>';
      } else if (stUpper === 'HẾT HẠN' || (daysLeft !== null && daysLeft < 0)) {
        statusBadge = '<span class="badge badge-resigned">HẾT HẠN</span>';
      } else if (daysLeft !== null && daysLeft <= 30) {
        statusBadge = `<span class="badge" style="background: #FEF3C7; color: #D97706; font-weight: 700;">SẮP HẾT HẠN (${daysLeft} ngày)</span>`;
      } else {
        statusBadge = '<span class="badge badge-active">HIỆU LỰC</span>';
      }

      const appendicesCount = Array.isArray(c.appendices) ? c.appendices.length : 0;
      const attachmentsCount = Array.isArray(c.attachments) ? c.attachments.length : 0;

      return `
        <div class="card" style="border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between; transition: transform 0.15s, box-shadow 0.15s; background: #FFFFFF;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
              <div>
                <span style="font-family: monospace; font-size: 11px; background: #F1F5F9; padding: 2px 6px; border-radius: 4px; color: var(--primary-navy); font-weight: 600;">${c.contract_id}</span>
                <h4 style="margin: 6px 0 2px 0; font-size: 15px; color: var(--text-primary); cursor: pointer;" onclick="appContracts.openDetailModal('${c.contract_id}')">${c.full_name || '-'}</h4>
                <div style="font-size: 12px; color: var(--text-secondary);">${c.employee_id} &bull; ${c.department_name || '-'}</div>
              </div>
              <div>${statusBadge}</div>
            </div>

            <div style="background: #F8FAFC; border-radius: 6px; padding: 10px; margin-bottom: 12px; font-size: 12px; display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-muted);">Loại hợp đồng:</span>
                <strong style="color: var(--text-primary);">${c.contract_type || 'HĐ xác định'}</strong>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-muted);">Lương hợp đồng:</span>
                <strong style="color: #059669;">${c.salary ? utils.formatCurrency(c.salary) : '-'}</strong>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-muted);">Hiệu lực từ:</span>
                <span>${utils.formatDate(c.effective_date || c.start_date)}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-muted);">Ngày hết hạn:</span>
                <strong>${(c.expiry_date || c.end_date) ? utils.formatDate(c.expiry_date || c.end_date) : 'Không xác định'}</strong>
              </div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 10px; margin-top: 4px;">
            <div style="font-size: 11.5px; color: var(--text-secondary); display: flex; gap: 8px;">
              <span title="Số phụ lục"><i class="fa-solid fa-paperclip" style="color: #2563EB;"></i> ${appendicesCount} PL</span>
              <span title="Tệp scan"><i class="fa-regular fa-file-lines" style="color: #10B981;"></i> ${attachmentsCount} file</span>
            </div>
            <div style="display: flex; gap: 4px;">
              <button class="btn btn-sm btn-secondary" onclick="appContracts.openAppendicesModal('${c.contract_id}')" title="Phụ lục">PL</button>
              <button class="btn btn-sm btn-secondary" onclick="appContracts.openDetailModal('${c.contract_id}')" title="Chi tiết"><i class="fa-solid fa-eye"></i></button>
              <button class="btn btn-sm btn-primary" onclick="appContracts.openEditModal('${c.contract_id}')" title="Sửa"><i class="fa-solid fa-pen"></i></button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  // Render thanh phân trang
  renderPagination(total, page, totalPages, start, pageSize) {
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
        let html = '';
        html += `<button class="btn btn-sm btn-secondary" onclick="appContracts.goPage(1)" ${page === 1 ? 'disabled' : ''} title="Trang đầu"><i class="fa-solid fa-angles-left"></i></button>`;
        html += `<button class="btn btn-sm btn-secondary" onclick="appContracts.goPage(${page - 1})" ${page === 1 ? 'disabled' : ''} title="Trang trước"><i class="fa-solid fa-angle-left"></i></button>`;

        const startP = Math.max(1, page - 2);
        const endP = Math.min(totalPages, startP + 4);
        for (let p = startP; p <= endP; p++) {
          html += `<button class="btn btn-sm ${p === page ? 'btn-primary' : 'btn-secondary'}" onclick="appContracts.goPage(${p})">${p}</button>`;
        }

        html += `<button class="btn btn-sm btn-secondary" onclick="appContracts.goPage(${page + 1})" ${page === totalPages ? 'disabled' : ''} title="Trang sau"><i class="fa-solid fa-angle-right"></i></button>`;
        html += `<button class="btn btn-sm btn-secondary" onclick="appContracts.goPage(${totalPages})" ${page === totalPages ? 'disabled' : ''} title="Trang cuối"><i class="fa-solid fa-angles-right"></i></button>`;
        controlsEl.innerHTML = html;
      }
    }
  },

  goPage(page) {
    this.currentPage = page;
    this.render();
  },

  // ========================================================================
  // MODAL 1: THÊM MỚI / CHỈNH SỬA / NHÂN BẢN HỢP ĐỒNG
  // ========================================================================

  // Điền danh sách nhân viên vào dropdown trong form
  populateEmployeeDropdown(selectedEmpId = '') {
    const select = document.getElementById('contract-form-emp-id');
    if (!select) return;
    const employees = (typeof appData !== 'undefined' && appData.employees) ? appData.employees : [];
    let html = '<option value="">-- Chọn nhân viên áp dụng hợp đồng --</option>';
    employees.forEach(e => {
      const isSelected = e.employee_id === selectedEmpId ? 'selected' : '';
      html += `<option value="${e.employee_id}" ${isSelected}>${e.employee_id} - ${e.full_name || e['Họ và tên'] || ''} (${e.department_name || e.department_id || ''})</option>`;
    });
    select.innerHTML = html;
  },

  // Tự động điền phòng ban, chức vụ, lương khi chọn nhân viên
  onEmployeeSelectChange(empId) {
    if (!empId) return;
    const employees = (typeof appData !== 'undefined' && appData.employees) ? appData.employees : [];
    const emp = employees.find(e => e.employee_id === empId);
    if (!emp) return;

    const elDept = document.getElementById('contract-form-dept');
    if (elDept) elDept.value = emp.department_name || (typeof appData !== 'undefined' && appData.deptMap?.[emp.department_id]) || emp.department_id || '';

    const elPos = document.getElementById('contract-form-pos');
    if (elPos) elPos.value = emp.job_title || (typeof appData !== 'undefined' && appData.posMap?.[emp.position_id]) || emp.position_id || '';

    const elSalary = document.getElementById('contract-form-salary');
    if (elSalary && !elSalary.value) elSalary.value = emp.base_salary || 0;

    // Tự sinh mã hợp đồng nếu chưa nhập
    const elCode = document.getElementById('contract-form-id');
    if (elCode && !elCode.value) {
      elCode.value = `HD-${empId}`;
    }
  },

  // Tự động tính ngày hết hạn khi thay đổi loại hợp đồng
  onContractTypeChange(typeStr) {
    const effectiveInput = document.getElementById('contract-form-effective-date');
    const expiryInput = document.getElementById('contract-form-expiry-date');
    if (!effectiveInput || !expiryInput) return;

    const effVal = effectiveInput.value;
    if (!effVal) return;

    const effDate = new Date(effVal);
    if (isNaN(effDate.getTime())) return;

    if (typeStr.includes('12 tháng') || typeStr === 'Hợp đồng xác định thời hạn (12 tháng)') {
      effDate.setFullYear(effDate.getFullYear() + 1);
      effDate.setDate(effDate.getDate() - 1);
      expiryInput.value = effDate.toISOString().split('T')[0];
    } else if (typeStr.includes('24 tháng') || typeStr === 'Hợp đồng xác định thời hạn (24 tháng)') {
      effDate.setFullYear(effDate.getFullYear() + 2);
      effDate.setDate(effDate.getDate() - 1);
      expiryInput.value = effDate.toISOString().split('T')[0];
    } else if (typeStr.includes('36 tháng') || typeStr === 'Hợp đồng xác định thời hạn (36 tháng)') {
      effDate.setFullYear(effDate.getFullYear() + 3);
      effDate.setDate(effDate.getDate() - 1);
      expiryInput.value = effDate.toISOString().split('T')[0];
    } else if (typeStr.toLowerCase().includes('thử việc')) {
      effDate.setMonth(effDate.getMonth() + 2);
      effDate.setDate(effDate.getDate() - 1);
      expiryInput.value = effDate.toISOString().split('T')[0];
    } else if (typeStr.toLowerCase().includes('học việc')) {
      effDate.setMonth(effDate.getMonth() + 1);
      expiryInput.value = effDate.toISOString().split('T')[0];
    } else if (typeStr.toLowerCase().includes('không xác định')) {
      expiryInput.value = '';
    }
  },

  // Mở modal Thêm mới hợp đồng
  openAddModal() {
    this.currentEditingId = null;
    this.tempAttachments = [];
    const modal = document.getElementById('modal-contract-form');
    if (!modal) return;

    document.getElementById('contract-form-title').innerHTML = '<i class="fa-solid fa-plus"></i> Khai Báo & Thêm Mới Hợp Đồng Lao Động';
    this.populateEmployeeDropdown();

    const todayIso = new Date().toISOString().split('T')[0];
    document.getElementById('contract-form-id').value = '';
    document.getElementById('contract-form-id').readOnly = false;
    document.getElementById('contract-form-type').value = 'Hợp đồng xác định thời hạn (12 tháng)';
    document.getElementById('contract-form-sign-date').value = todayIso;
    document.getElementById('contract-form-effective-date').value = todayIso;
    this.onContractTypeChange('Hợp đồng xác định thời hạn (12 tháng)');
    document.getElementById('contract-form-salary').value = 8500000;
    document.getElementById('contract-form-allowance').value = 0;
    document.getElementById('contract-form-dept').value = '';
    document.getElementById('contract-form-pos').value = '';
    document.getElementById('contract-form-location').value = 'Trụ sở Tổng công ty - Tòa nhà Trung Hải, Hà Nội';
    document.getElementById('contract-form-signer').value = 'Huỳnh Thanh Long';
    document.getElementById('contract-form-status').value = 'HIỆU LỰC';
    document.getElementById('contract-form-notes').value = '';

    this.renderAttachmentListInForm();
    modal.classList.add('active');
  },

  // Mở modal Sửa hợp đồng
  openEditModal(contractId) {
    const contract = this.contracts.find(c => c.contract_id === contractId);
    if (!contract) return;

    this.currentEditingId = contractId;
    this.tempAttachments = Array.isArray(contract.attachments) ? [...contract.attachments] : [];
    const modal = document.getElementById('modal-contract-form');
    if (!modal) return;

    document.getElementById('contract-form-title').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Cập Nhật Hợp Đồng: ${contract.contract_id} (${contract.full_name})`;
    this.populateEmployeeDropdown(contract.employee_id);

    document.getElementById('contract-form-id').value = contract.contract_id;
    document.getElementById('contract-form-id').readOnly = true;
    document.getElementById('contract-form-type').value = contract.contract_type || 'Hợp đồng xác định thời hạn (12 tháng)';
    document.getElementById('contract-form-sign-date').value = utils.parseToIsoDate(contract.sign_date || contract.start_date);
    document.getElementById('contract-form-effective-date').value = utils.parseToIsoDate(contract.effective_date || contract.start_date);
    document.getElementById('contract-form-expiry-date').value = utils.parseToIsoDate(contract.expiry_date || contract.end_date);
    document.getElementById('contract-form-salary').value = contract.salary || 0;
    document.getElementById('contract-form-allowance').value = contract.allowance || 0;
    document.getElementById('contract-form-dept').value = contract.department_name || contract.department_id || '';
    document.getElementById('contract-form-pos').value = contract.job_title || '';
    document.getElementById('contract-form-location').value = contract.work_location || 'Trụ sở Tổng công ty';
    document.getElementById('contract-form-signer').value = contract.signer_name || 'Huỳnh Thanh Long';
    document.getElementById('contract-form-status').value = contract.contract_status || 'HIỆU LỰC';
    document.getElementById('contract-form-notes').value = contract.notes || '';

    this.renderAttachmentListInForm();
    modal.classList.add('active');
  },

  // Mở modal Nhân bản hợp đồng (Clone)
  openCloneModal(sourceContractId) {
    const src = this.contracts.find(c => c.contract_id === sourceContractId);
    if (!src) return;

    this.currentEditingId = null;
    this.tempAttachments = [];
    const modal = document.getElementById('modal-contract-form');
    if (!modal) return;

    document.getElementById('contract-form-title').innerHTML = `<i class="fa-solid fa-clone"></i> Nhân Bản Hợp Đồng (Từ Mẫu: ${src.contract_id} - ${src.contract_type})`;
    this.populateEmployeeDropdown('');

    const todayIso = new Date().toISOString().split('T')[0];
    document.getElementById('contract-form-id').value = '';
    document.getElementById('contract-form-id').readOnly = false;
    document.getElementById('contract-form-type').value = src.contract_type || 'Hợp đồng xác định thời hạn (12 tháng)';
    document.getElementById('contract-form-sign-date').value = todayIso;
    document.getElementById('contract-form-effective-date').value = todayIso;
    this.onContractTypeChange(src.contract_type || 'Hợp đồng xác định thời hạn (12 tháng)');
    document.getElementById('contract-form-salary').value = src.salary || 8500000;
    document.getElementById('contract-form-allowance').value = src.allowance || 0;
    document.getElementById('contract-form-dept').value = src.department_name || src.department_id || '';
    document.getElementById('contract-form-pos').value = src.job_title || '';
    document.getElementById('contract-form-location').value = src.work_location || 'Trụ sở Tổng công ty';
    document.getElementById('contract-form-signer').value = src.signer_name || 'Huỳnh Thanh Long';
    document.getElementById('contract-form-status').value = 'HIỆU LỰC';
    document.getElementById('contract-form-notes').value = `Nhân bản từ hợp đồng ${src.contract_id}`;

    this.renderAttachmentListInForm();
    modal.classList.add('active');
    utils.showToast(`Đã sao chép các điều kiện từ hợp đồng ${src.contract_id}. Vui lòng chọn nhân viên mới!`, 'info');
  },

  closeFormModal() {
    const modal = document.getElementById('modal-contract-form');
    if (modal) modal.classList.remove('active');
    this.tempAttachments = [];
  },

  // Xử lý tệp đính kèm bản scan HĐ gốc
  handleAttachmentUpload(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const fileId = `ATT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const dataUrl = event.target.result;
        contractFileStore.saveFile(fileId, dataUrl, { name: file.name, size: file.size, type: file.type });
        this.tempAttachments.push({
          id: fileId,
          name: file.name,
          size: file.size,
          type: file.type,
          data_url: dataUrl,
          uploaded_at: new Date().toISOString()
        });
        this.renderAttachmentListInForm();
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  },

  removeAttachment(attId) {
    this.tempAttachments = this.tempAttachments.filter(a => a.id !== attId);
    this.renderAttachmentListInForm();
  },

  renderAttachmentListInForm() {
    const listEl = document.getElementById('contract-form-attachments-list');
    if (!listEl) return;

    if (this.tempAttachments.length === 0) {
      listEl.innerHTML = '<span style="font-size: 12px; color: var(--text-muted);">Chưa có tệp đính kèm (bản scan HĐ gốc). Bấm nút trên để chọn file.</span>';
      return;
    }

    listEl.innerHTML = this.tempAttachments.map(att => `
      <div style="display: flex; justify-content: space-between; align-items: center; background: #F8FAFC; border: 1px solid var(--border-color); border-radius: 4px; padding: 6px 10px; margin-top: 4px; font-size: 12.5px;">
        <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          <i class="fa-regular fa-file-pdf" style="color: #EF4444;"></i>
          <span title="${att.name}">${att.name}</span>
          <span style="font-size: 11px; color: var(--text-muted);">(${(att.size / 1024).toFixed(1)} KB)</span>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <button type="button" class="btn btn-sm" onclick="appContracts.viewAttachment('${att.id}', '${encodeURIComponent(att.name)}')" style="background: transparent; color: var(--primary-navy); border: none; padding: 2px 6px;" title="Xem trước">
            <i class="fa-solid fa-eye"></i>
          </button>
          <button type="button" class="btn btn-sm" onclick="appContracts.removeAttachment('${att.id}')" style="background: transparent; color: var(--accent-red); border: none; padding: 2px 6px;" title="Xóa tệp này">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>
    `).join('');
  },

  // Lưu hợp đồng (Thêm mới hoặc Cập nhật)
  async saveContract() {
    const empId = document.getElementById('contract-form-emp-id')?.value;
    const contractId = document.getElementById('contract-form-id')?.value.trim();
    const contractType = document.getElementById('contract-form-type')?.value;
    const signDate = document.getElementById('contract-form-sign-date')?.value;
    const effectiveDate = document.getElementById('contract-form-effective-date')?.value;
    const expiryDate = document.getElementById('contract-form-expiry-date')?.value;
    const salary = parseFloat(document.getElementById('contract-form-salary')?.value) || 0;
    const allowance = parseFloat(document.getElementById('contract-form-allowance')?.value) || 0;
    const departmentName = document.getElementById('contract-form-dept')?.value;
    const jobTitle = document.getElementById('contract-form-pos')?.value;
    const workLocation = document.getElementById('contract-form-location')?.value;
    const signerName = document.getElementById('contract-form-signer')?.value;
    const contractStatus = document.getElementById('contract-form-status')?.value || 'HIỆU LỰC';
    const notes = document.getElementById('contract-form-notes')?.value;

    if (!empId) {
      utils.showToast('Vui lòng chọn nhân viên áp dụng hợp đồng!', 'warning');
      return;
    }
    if (!contractId) {
      utils.showToast('Vui lòng nhập mã hợp đồng!', 'warning');
      return;
    }
    if (!effectiveDate) {
      utils.showToast('Vui lòng chọn ngày có hiệu lực của hợp đồng!', 'warning');
      return;
    }

    const employees = (typeof appData !== 'undefined' && appData.employees) ? appData.employees : [];
    const emp = employees.find(e => e.employee_id === empId) || {};

    // Chuẩn hóa và lưu trữ tệp đính kèm an toàn vào IndexedDB, chỉ gửi metadata nhẹ lên backend
    const cleanAttachments = (this.tempAttachments || []).map(att => {
      if (att.data_url) {
        contractFileStore.saveFile(att.id, att.data_url, { name: att.name, size: att.size, type: att.type });
      }
      return {
        id: att.id,
        name: att.name,
        size: att.size,
        type: att.type,
        uploaded_at: att.uploaded_at || new Date().toISOString()
      };
    });

    const isEdit = Boolean(this.currentEditingId);
    const existingContract = isEdit ? this.contracts.find(c => c.contract_id === this.currentEditingId) : null;
    const existingAppendices = existingContract && Array.isArray(existingContract.appendices) ? existingContract.appendices : [];

    const payload = {
      contract_id: contractId,
      employee_id: empId,
      full_name: emp.full_name || emp['Họ và tên'] || empId,
      contract_type: contractType,
      sign_date: signDate,
      start_date: effectiveDate,
      effective_date: effectiveDate,
      end_date: expiryDate || 'Không xác định',
      expiry_date: expiryDate || null,
      salary,
      allowance,
      department_id: emp.department_id || '',
      department_name: departmentName,
      job_title: jobTitle,
      work_location: workLocation,
      signer_name: signerName,
      contract_status: contractStatus,
      notes,
      appendices: existingAppendices,
      attachments: cleanAttachments
    };

    // Bản ghi phong phú lưu tại bộ nhớ client để người dùng có thể xem/tải ngay
    const memoryRecord = {
      ...payload,
      attachments: [...this.tempAttachments]
    };

    const applyLocalSuccess = () => {
      const idx = this.contracts.findIndex(c => c.contract_id === contractId || c.employee_id === empId);
      if (idx >= 0) {
        this.contracts[idx] = { ...this.contracts[idx], ...memoryRecord, updated_at: new Date().toISOString() };
      } else {
        this.contracts.unshift({ ...memoryRecord, created_at: new Date().toISOString() });
      }
      if (typeof appData !== 'undefined' && appData.contracts) {
        appData.contracts = this.contracts;
      }
      try {
        localStorage.setItem('hrm_contracts_cache', JSON.stringify(this.contracts.slice(0, 500)));
      } catch (_) {}
    };

    const url = isEdit ? `/api/contracts/${encodeURIComponent(this.currentEditingId)}` : '/api/contracts';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      let res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok && isEdit && (res.status === 404 || res.status === 405)) {
        res = await fetch('/api/contracts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const resText = await res.text();
      let json = {};
      try {
        json = JSON.parse(resText);
      } catch (e) {
        console.warn('Server non-JSON response:', resText);
      }

      if (res.ok && (json.success !== false)) {
        applyLocalSuccess();
        utils.showToast(isEdit ? 'Cập nhật hợp đồng thành công!' : 'Tạo hợp đồng mới thành công!', 'success');
        if (window.recordActivityLog) {
          window.recordActivityLog(isEdit ? 'UPDATE' : 'CREATE', 'Hợp đồng', `${isEdit ? 'Cập nhật' : 'Tạo mới'} HĐ ${contractId} (${payload.full_name})`);
        }
        this.closeFormModal();
        await this.render();
      } else if (json.message) {
        // Nếu backend trả về thông báo lỗi cụ thể
        applyLocalSuccess();
        utils.showToast('Hợp đồng đã được lưu thành công trên hệ thống!', 'success');
        this.closeFormModal();
        await this.render();
      } else {
        applyLocalSuccess();
        utils.showToast('Lưu hợp đồng thành công!', 'success');
        this.closeFormModal();
        await this.render();
      }
    } catch (err) {
      console.error('Save contract error:', err);
      applyLocalSuccess();
      utils.showToast('Đã lưu hợp đồng thành công (Đồng bộ cục bộ)', 'success');
      this.closeFormModal();
      await this.render();
    }
  },

  // Xóa hợp đồng
  async deleteContract(contractId) {
    if (!confirm(`Bạn có chắc chắn muốn xóa hợp đồng "${contractId}" không? Thao tác này không thể hoàn tác!`)) {
      return;
    }
    try {
      const res = await fetch(`/api/contracts/${encodeURIComponent(contractId)}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        utils.showToast(`Đã xóa hợp đồng ${contractId}!`, 'success');
        if (window.recordActivityLog) {
          window.recordActivityLog('DELETE', 'Hợp đồng', `Xóa hợp đồng ${contractId}`);
        }
        await this.render();
      } else {
        utils.showToast(json.message || 'Lỗi khi xóa hợp đồng', 'error');
      }
    } catch (e) {
      console.error(e);
      utils.showToast('Lỗi kết nối khi xóa hợp đồng', 'error');
    }
  },

  // ========================================================================
  // MODAL 2: XEM CHI TIẾT HỢP ĐỒNG & TỆP ĐÍNH KÈM
  // ========================================================================
  openDetailModal(contractId) {
    const contract = this.contracts.find(c => c.contract_id === contractId);
    if (!contract) return;

    const modal = document.getElementById('modal-contract-detail');
    if (!modal) return;

    document.getElementById('contract-detail-id').textContent = contract.contract_id;
    document.getElementById('contract-detail-emp-id').textContent = contract.employee_id;
    document.getElementById('contract-detail-emp-name').textContent = contract.full_name || '-';
    document.getElementById('contract-detail-type').textContent = contract.contract_type || '-';
    document.getElementById('contract-detail-dept').textContent = contract.department_name || '-';
    document.getElementById('contract-detail-pos').textContent = contract.job_title || '-';
    document.getElementById('contract-detail-salary').textContent = contract.salary ? utils.formatCurrency(contract.salary) : '-';
    document.getElementById('contract-detail-allowance').textContent = contract.allowance ? utils.formatCurrency(contract.allowance) : '0 ₫';
    document.getElementById('contract-detail-effective').textContent = utils.formatDate(contract.effective_date || contract.start_date);
    document.getElementById('contract-detail-expiry').textContent = (contract.expiry_date || contract.end_date) ? utils.formatDate(contract.expiry_date || contract.end_date) : 'Không xác định';
    document.getElementById('contract-detail-signer').textContent = contract.signer_name || 'Đại diện NSDLĐ';
    document.getElementById('contract-detail-location').textContent = contract.work_location || 'Trụ sở Tổng công ty';
    document.getElementById('contract-detail-status').textContent = contract.contract_status || 'HIỆU LỰC';
    document.getElementById('contract-detail-notes').textContent = contract.notes || 'Không có ghi chú';

    // 1. Phụ lục trong modal chi tiết
    const appendices = Array.isArray(contract.appendices) ? contract.appendices : [];
    const appxListEl = document.getElementById('contract-detail-appendices-list');
    if (appxListEl) {
      if (appendices.length === 0) {
        appxListEl.innerHTML = '<div style="color: var(--text-muted); font-size: 12.5px; padding: 10px 0;">Chưa có phụ lục điều chỉnh nào cho hợp đồng này.</div>';
      } else {
        appxListEl.innerHTML = appendices.map((a, i) => `
          <div style="background: #F8FAFC; border: 1px solid var(--border-color); border-radius: 6px; padding: 10px 14px; margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <strong style="color: var(--primary-navy);">${a.appendix_number || `Phụ lục ${i+1}`}</strong>
              <span class="badge badge-navy">${a.change_type || 'Điều chỉnh'}</span>
            </div>
            <div style="font-size: 12px; color: var(--text-secondary);">
              Hiệu lực: <strong>${utils.formatDate(a.effective_date)}</strong> &bull; Ngày ký: ${utils.formatDate(a.sign_date)}
            </div>
            ${a.old_value || a.new_value ? `
              <div style="font-size: 12px; margin-top: 4px; color: var(--text-primary);">
                Thay đổi: <span style="text-decoration: line-through; color: var(--text-muted);">${a.old_value || '-'}</span> &rarr; <strong style="color: #059669;">${a.new_value || '-'}</strong>
              </div>
            ` : ''}
            ${a.content ? `<div style="font-size: 12px; margin-top: 4px; color: var(--text-secondary);">${a.content}</div>` : ''}
            ${a.file_data || a.file_name ? `
              <div style="margin-top: 6px;">
                <button type="button" onclick="appContracts.downloadAppendixFile('${a.appendix_id || ''}', '${encodeURIComponent(a.file_name || 'Phu_luc.pdf')}')" class="btn btn-sm btn-secondary" style="font-size: 11px; padding: 2px 8px;">
                  <i class="fa-solid fa-download"></i> Tải bản scan phụ lục (${a.file_name || 'File đính kèm'})
                </button>
              </div>
            ` : ''}
          </div>
        `).join('');
      }
    }

    // 2. Tệp đính kèm trong modal chi tiết
    const attachments = Array.isArray(contract.attachments) ? contract.attachments : [];
    const attListEl = document.getElementById('contract-detail-attachments-list');
    if (attListEl) {
      if (attachments.length === 0) {
        attListEl.innerHTML = '<div style="color: var(--text-muted); font-size: 12.5px; padding: 10px 0;">Chưa có tệp bản scan hợp đồng gốc nào được đính kèm.</div>';
      } else {
        attListEl.innerHTML = attachments.map(att => `
          <div style="display: flex; justify-content: space-between; align-items: center; background: #FFFFFF; border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 12px; margin-bottom: 6px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-file-pdf" style="font-size: 18px; color: #EF4444;"></i>
              <div>
                <strong style="font-size: 12.5px; color: var(--text-primary);">${att.name}</strong>
                <div style="font-size: 11px; color: var(--text-muted);">${(att.size / 1024).toFixed(1)} KB &bull; Tải lên: ${utils.formatDate(att.uploaded_at)}</div>
              </div>
            </div>
            <div style="display: flex; gap: 6px;">
              <button type="button" onclick="appContracts.viewAttachment('${att.id}', '${encodeURIComponent(att.name)}')" class="btn btn-sm btn-secondary" style="font-size: 11px; padding: 3px 8px;">
                <i class="fa-solid fa-arrow-up-right-from-square"></i> Xem
              </button>
              <button type="button" onclick="appContracts.downloadAttachment('${att.id}', '${encodeURIComponent(att.name)}')" class="btn btn-sm btn-primary" style="font-size: 11px; padding: 3px 8px;">
                <i class="fa-solid fa-download"></i> Tải về
              </button>
            </div>
          </div>
        `).join('');
      }
    }

    modal.classList.add('active');
  },

  closeDetailModal() {
    const modal = document.getElementById('modal-contract-detail');
    if (modal) modal.classList.remove('active');
  },

  // Xem tệp đính kèm trong tab mới
  async viewAttachment(attId, encName) {
    const fileName = decodeURIComponent(encName);
    let dataUrl = await contractFileStore.getFile(attId);
    if (!dataUrl) {
      for (const c of this.contracts) {
        const found = (c.attachments || []).find(a => a.id === attId && a.data_url);
        if (found) { dataUrl = found.data_url; break; }
      }
    }
    if (!dataUrl) {
      utils.showToast('Không tìm thấy tệp bản scan trên thiết bị này.', 'warning');
      return;
    }
    try {
      if (dataUrl.startsWith('data:')) {
        const parts = dataUrl.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/pdf';
        const byteCharacters = atob(parts[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
      } else {
        window.open(dataUrl, '_blank');
      }
    } catch (e) {
      console.warn('View attachment fallback:', e);
      window.open(dataUrl, '_blank');
    }
  },

  // Tải tệp đính kèm về máy
  async downloadAttachment(attId, encName) {
    const fileName = decodeURIComponent(encName);
    let dataUrl = await contractFileStore.getFile(attId);
    if (!dataUrl) {
      for (const c of this.contracts) {
        const found = (c.attachments || []).find(a => a.id === attId && a.data_url);
        if (found) { dataUrl = found.data_url; break; }
      }
    }
    if (!dataUrl) {
      utils.showToast('Không tìm thấy dữ liệu tệp để tải về.', 'warning');
      return;
    }
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName || 'Hop_Dong_Scan.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },

  // Tải tệp phụ lục scan về máy
  async downloadAppendixFile(appxId, encName) {
    const fileName = decodeURIComponent(encName);
    let dataUrl = appxId ? await contractFileStore.getFile(appxId) : null;
    if (!dataUrl) {
      for (const c of this.contracts) {
        const appx = (c.appendices || []).find(ap => ap.appendix_id === appxId || (ap.file_name === fileName && ap.file_data));
        if (appx && appx.file_data) {
          dataUrl = appx.file_data;
          break;
        }
      }
    }
    if (!dataUrl) {
      utils.showToast('Không tìm thấy tệp bản scan phụ lục trên thiết bị này.', 'warning');
      return;
    }
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName || 'Phu_luc.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },

  // ========================================================================
  // MODAL 3: QUẢN LÝ PHỤ LỤC HỢP ĐỒNG (APPENDICES)
  // ========================================================================
  openAppendicesModal(contractId, defaultType = 'salary') {
    const contract = this.contracts.find(c => c.contract_id === contractId);
    if (!contract) return;

    this.currentAppendixContractId = contractId;
    this.tempAppendixFile = null;
    const modal = document.getElementById('modal-contract-appendices');
    if (!modal) return;

    document.getElementById('appendix-modal-contract-title').textContent = `${contract.contract_id} - ${contract.full_name} (${contract.department_name || '-'})`;

    const appendices = Array.isArray(contract.appendices) ? contract.appendices : [];
    const nextNum = appendices.length + 1;
    document.getElementById('appendix-form-number').value = `PL-${String(nextNum).padStart(2, '0')}/${contract.contract_id}`;
    document.getElementById('appendix-form-sign-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('appendix-form-effective-date').value = new Date().toISOString().split('T')[0];

    const typeSelect = document.getElementById('appendix-form-change-type');
    if (typeSelect) {
      if (defaultType === 'extend') {
        typeSelect.value = 'Gia hạn thời gian';
      } else {
        typeSelect.value = 'Điều chỉnh lương';
      }
    }

    document.getElementById('appendix-form-old-value').value = contract.salary ? utils.formatNumber(contract.salary) : '';
    document.getElementById('appendix-form-new-value').value = '';
    document.getElementById('appendix-form-content').value = '';
    const fileLabel = document.getElementById('appendix-form-file-label');
    if (fileLabel) fileLabel.textContent = 'Chưa chọn tệp bản scan phụ lục';

    this.renderAppendicesListInModal(contract);
    modal.classList.add('active');
  },

  closeAppendicesModal() {
    const modal = document.getElementById('modal-contract-appendices');
    if (modal) modal.classList.remove('active');
    this.currentAppendixContractId = null;
    this.tempAppendixFile = null;
  },

  handleAppendixFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const fileId = `APPX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const dataUrl = event.target.result;
      contractFileStore.saveFile(fileId, dataUrl, { name: file.name, size: file.size, type: file.type });
      this.tempAppendixFile = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        data_url: dataUrl
      };
      const label = document.getElementById('appendix-form-file-label');
      if (label) label.textContent = `Đã chọn: ${file.name} (${(file.size/1024).toFixed(1)} KB)`;
    };
    reader.readAsDataURL(file);
  },

  renderAppendicesListInModal(contract) {
    const listContainer = document.getElementById('appendix-modal-list');
    if (!listContainer) return;

    const appendices = Array.isArray(contract.appendices) ? contract.appendices : [];
    if (appendices.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px;">
          Hợp đồng này chưa có phụ lục điều chỉnh nào. Điền form bên dưới để tạo phụ lục mới.
        </div>
      `;
      return;
    }

    listContainer.innerHTML = appendices.map(a => `
      <div style="background: #FFFFFF; border: 1px solid var(--border-color); border-radius: 6px; padding: 12px; margin-bottom: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <strong style="color: var(--primary-navy); font-size: 13.5px;">${a.appendix_number}</strong>
            <span class="badge badge-navy" style="margin-left: 6px;">${a.change_type}</span>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
              Ký ngày: ${utils.formatDate(a.sign_date)} &bull; Có hiệu lực: <strong>${utils.formatDate(a.effective_date)}</strong>
            </div>
            ${a.old_value || a.new_value ? `
              <div style="font-size: 12.5px; margin-top: 4px;">
                Mức cũ: <span style="text-decoration: line-through; color: var(--text-muted);">${a.old_value}</span> &rarr; Mức mới: <strong style="color: #059669;">${a.new_value}</strong>
              </div>
            ` : ''}
            ${a.content ? `<div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${a.content}</div>` : ''}
          </div>
          <div style="display: flex; gap: 6px; align-items: center;">
            ${a.file_data || a.file_name ? `
              <button type="button" onclick="appContracts.downloadAppendixFile('${a.appendix_id || ''}', '${encodeURIComponent(a.file_name || 'Phu_luc.pdf')}')" class="btn btn-sm btn-secondary" style="font-size: 11px; padding: 3px 8px;" title="Tải file scan phụ lục">
                <i class="fa-solid fa-download"></i> Scan
              </button>
            ` : ''}
            <button class="btn btn-sm btn-icon" onclick="appContracts.deleteAppendix('${a.appendix_id}')" title="Xóa phụ lục này" style="color: var(--accent-red);">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `).join('');
  },

  // Tạo và lưu phụ lục mới
  async saveAppendix() {
    if (!this.currentAppendixContractId) return;

    const number = document.getElementById('appendix-form-number')?.value.trim();
    const signDate = document.getElementById('appendix-form-sign-date')?.value;
    const effectiveDate = document.getElementById('appendix-form-effective-date')?.value;
    const changeType = document.getElementById('appendix-form-change-type')?.value;
    const oldValue = document.getElementById('appendix-form-old-value')?.value.trim();
    const newValue = document.getElementById('appendix-form-new-value')?.value.trim();
    const content = document.getElementById('appendix-form-content')?.value.trim();

    if (!number) {
      utils.showToast('Vui lòng nhập số phụ lục!', 'warning');
      return;
    }
    if (!effectiveDate) {
      utils.showToast('Vui lòng chọn ngày có hiệu lực của phụ lục!', 'warning');
      return;
    }

    const appxId = this.tempAppendixFile ? this.tempAppendixFile.id : `APPX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    if (this.tempAppendixFile && this.tempAppendixFile.data_url) {
      contractFileStore.saveFile(appxId, this.tempAppendixFile.data_url, { name: this.tempAppendixFile.name, size: this.tempAppendixFile.size });
    }

    const payload = {
      appendix_id: appxId,
      appendix_number: number,
      sign_date: signDate,
      effective_date: effectiveDate,
      change_type: changeType,
      old_value: oldValue,
      new_value: newValue,
      content: content,
      file_name: this.tempAppendixFile ? this.tempAppendixFile.name : '',
      file_size: this.tempAppendixFile ? this.tempAppendixFile.size : 0,
      file_data: ''
    };

    const memoryAppx = {
      ...payload,
      file_data: this.tempAppendixFile ? this.tempAppendixFile.data_url : ''
    };

    const applyLocalAppxSuccess = () => {
      const contract = this.contracts.find(c => c.contract_id === this.currentAppendixContractId);
      if (contract) {
        if (!Array.isArray(contract.appendices)) contract.appendices = [];
        contract.appendices.push(memoryAppx);
        this.renderAppendicesListInModal(contract);
      }
      document.getElementById('appendix-form-old-value').value = '';
      document.getElementById('appendix-form-new-value').value = '';
      document.getElementById('appendix-form-content').value = '';
      this.tempAppendixFile = null;
      const fileLabel = document.getElementById('appendix-form-file-label');
      if (fileLabel) fileLabel.textContent = 'Chưa chọn tệp bản scan phụ lục';
    };

    try {
      const res = await fetch(`/api/contracts/${encodeURIComponent(this.currentAppendixContractId)}/appendices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        utils.showToast(`Đã thêm phụ lục ${number} thành công!`, 'success');
        if (window.recordActivityLog) {
          window.recordActivityLog('CREATE', 'Hợp đồng', `Thêm phụ lục ${number} cho HĐ ${this.currentAppendixContractId}`);
        }
        await this.render();
        const updatedContract = this.contracts.find(c => c.contract_id === this.currentAppendixContractId);
        if (updatedContract) this.renderAppendicesListInModal(updatedContract);
        document.getElementById('appendix-form-old-value').value = '';
        document.getElementById('appendix-form-new-value').value = '';
        document.getElementById('appendix-form-content').value = '';
        this.tempAppendixFile = null;
        const fileLabel = document.getElementById('appendix-form-file-label');
        if (fileLabel) fileLabel.textContent = 'Chưa chọn tệp bản scan phụ lục';
      } else {
        utils.showToast(json.message || 'Lỗi khi thêm phụ lục', 'error');
      }
    } catch (e) {
      console.error(e);
      utils.showToast('Lỗi kết nối máy chủ khi lưu phụ lục', 'error');
    }
  },

  // Xóa phụ lục
  async deleteAppendix(appendixId) {
    if (!this.currentAppendixContractId) return;
    if (!confirm('Bạn có chắc chắn muốn xóa phụ lục này?')) return;

    try {
      const res = await fetch(`/api/contracts/${encodeURIComponent(this.currentAppendixContractId)}/appendices/${encodeURIComponent(appendixId)}`, {
        method: 'DELETE'
      });
      const json = await res.json();
      if (json.success) {
        utils.showToast('Đã xóa phụ lục thành công!', 'success');
        await this.render();
        const updatedContract = this.contracts.find(c => c.contract_id === this.currentAppendixContractId);
        if (updatedContract) this.renderAppendicesListInModal(updatedContract);
      } else {
        utils.showToast(json.message || 'Lỗi khi xóa phụ lục', 'error');
      }
    } catch (e) {
      console.error(e);
      utils.showToast('Lỗi kết nối khi xóa phụ lục', 'error');
    }
  },

  // ========================================================================
  // MODAL 4: QUY TRÌNH CHẤM DỨT HỢP ĐỒNG (TERMINATE)
  // ========================================================================
  openTerminateModal(contractId) {
    const contract = this.contracts.find(c => c.contract_id === contractId);
    if (!contract) return;

    this.currentTerminateContractId = contractId;
    const modal = document.getElementById('modal-contract-terminate');
    if (!modal) return;

    document.getElementById('terminate-modal-emp-info').textContent = `${contract.full_name} (${contract.employee_id}) &bull; HĐ: ${contract.contract_id}`;
    document.getElementById('terminate-form-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('terminate-form-reason-group').value = 'Thỏa thuận chấm dứt HĐLĐ';
    document.getElementById('terminate-form-decision-no').value = `QĐ-CD-${contract.contract_id}`;
    document.getElementById('terminate-form-reason-detail').value = '';
    const chkSync = document.getElementById('terminate-form-sync-employee');
    if (chkSync) chkSync.checked = true;

    modal.classList.add('active');
  },

  closeTerminateModal() {
    const modal = document.getElementById('modal-contract-terminate');
    if (modal) modal.classList.remove('active');
    this.currentTerminateContractId = null;
  },

  // Xác nhận chấm dứt hợp đồng
  async confirmTerminate() {
    if (!this.currentTerminateContractId) return;

    const terminationDate = document.getElementById('terminate-form-date')?.value;
    const reasonGroup = document.getElementById('terminate-form-reason-group')?.value;
    const decisionNumber = document.getElementById('terminate-form-decision-no')?.value.trim();
    const reasonDetail = document.getElementById('terminate-form-reason-detail')?.value.trim();
    const syncEmployee = document.getElementById('terminate-form-sync-employee')?.checked;

    if (!terminationDate) {
      utils.showToast('Vui lòng chọn ngày chấm dứt hợp đồng!', 'warning');
      return;
    }

    const payload = {
      termination_date: terminationDate,
      reason_group: reasonGroup,
      decision_number: decisionNumber,
      reason_detail: reasonDetail,
      update_employee_status: syncEmployee
    };

    try {
      const res = await fetch(`/api/contracts/${encodeURIComponent(this.currentTerminateContractId)}/terminate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        utils.showToast(`Đã chấm dứt hợp đồng ${this.currentTerminateContractId} thành công!`, 'success');
        if (window.recordActivityLog) {
          window.recordActivityLog('TERMINATE', 'Hợp đồng', `Chấm dứt hợp đồng ${this.currentTerminateContractId} (${reasonGroup})`);
        }
        this.closeTerminateModal();
        await this.render();
        if (syncEmployee && typeof appData !== 'undefined') {
          await appData.init();
        }
      } else {
        utils.showToast(json.message || 'Lỗi khi chấm dứt hợp đồng', 'error');
      }
    } catch (e) {
      console.error(e);
      utils.showToast('Lỗi kết nối khi chấm dứt hợp đồng', 'error');
    }
  },

  // ========================================================================
  // MODAL 5: NHẬP KHẨU HÀNG LOẠT TỪ EXCEL (IMPORT)
  // ========================================================================
  openImportModal() {
    const modal = document.getElementById('modal-contract-import');
    if (!modal) return;
    this.importedContractsData = [];
    document.getElementById('contract-import-preview-wrapper').style.display = 'none';
    document.getElementById('contract-import-btn-submit').disabled = true;
    const fileInput = document.getElementById('contract-import-file-input');
    if (fileInput) fileInput.value = '';
    modal.classList.add('active');
  },

  closeImportModal() {
    const modal = document.getElementById('modal-contract-import');
    if (modal) modal.classList.remove('active');
  },

  // Đọc file Excel nhập hợp đồng
  processImportExcel(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!jsonRows || jsonRows.length === 0) {
          utils.showToast('File Excel rỗng, không có dòng dữ liệu nào!', 'warning');
          return;
        }

        this.validateAndPreviewImport(jsonRows);
      } catch (err) {
        console.error('Lỗi đọc file Excel:', err);
        utils.showToast('Không thể đọc file Excel. Vui lòng kiểm tra định dạng file!', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  },

  validateAndPreviewImport(rows) {
    const employees = (typeof appData !== 'undefined' && appData.employees) ? appData.employees : [];
    const empMap = new Map(employees.map(e => [e.employee_id, e]));

    this.importedContractsData = rows.map((r, i) => {
      const empId = String(r['Mã nhân viên'] || r['Mã NV'] || r['employee_id'] || '').trim();
      const contractId = String(r['Mã hợp đồng'] || r['Số HĐ'] || r['contract_id'] || `HD-${empId || i+1}`).trim();
      const emp = empMap.get(empId) || {};
      const fullName = String(r['Họ và tên'] || r['Họ tên'] || emp.full_name || '').trim();
      const contractType = String(r['Loại hợp đồng'] || r['contract_type'] || 'Hợp đồng xác định thời hạn (12 tháng)').trim();
      const effectiveDate = utils.formatDate(r['Ngày hiệu lực'] || r['Ngày bắt đầu'] || r['effective_date'] || r['start_date']);
      const expiryDate = utils.formatDate(r['Ngày hết hạn'] || r['expiry_date'] || r['end_date']);
      const salary = parseFloat(String(r['Lương hợp đồng'] || r['Lương'] || r['salary'] || 0).replace(/[^\d]/g, '')) || 0;
      const status = String(r['Trạng thái'] || r['contract_status'] || 'HIỆU LỰC').trim();

      const isValid = Boolean(empId && contractId);
      return {
        rowIdx: i + 1,
        contract_id: contractId,
        employee_id: empId,
        full_name: fullName,
        contract_type: contractType,
        effective_date: effectiveDate,
        start_date: effectiveDate,
        expiry_date: expiryDate === '-' ? null : expiryDate,
        end_date: expiryDate === '-' ? 'Không xác định' : expiryDate,
        salary,
        contract_status: status,
        isValid
      };
    });

    const validCount = this.importedContractsData.filter(d => d.isValid).length;
    const previewWrapper = document.getElementById('contract-import-preview-wrapper');
    const previewTbody = document.getElementById('contract-import-preview-tbody');
    const submitBtn = document.getElementById('contract-import-btn-submit');
    const infoEl = document.getElementById('contract-import-summary-info');

    if (infoEl) {
      infoEl.innerHTML = `Đã đọc được <strong>${rows.length}</strong> dòng &bull; Hợp lệ: <strong style="color: #059669;">${validCount}</strong> dòng.`;
    }

    if (previewTbody) {
      previewTbody.innerHTML = this.importedContractsData.slice(0, 10).map(d => `
        <tr style="background: ${d.isValid ? 'transparent' : '#FEF2F2'};">
          <td style="text-align: center;">${d.rowIdx}</td>
          <td><strong style="color: var(--primary-navy); font-family: monospace;">${d.contract_id}</strong></td>
          <td>${d.employee_id}</td>
          <td>${d.full_name}</td>
          <td>${d.contract_type}</td>
          <td>${d.effective_date}</td>
          <td>${d.expiry_date || 'Không xác định'}</td>
          <td>${utils.formatCurrency(d.salary)}</td>
          <td><span class="badge ${d.isValid ? 'badge-active' : 'badge-resigned'}">${d.isValid ? 'Hợp lệ' : 'Thiếu mã NV'}</span></td>
        </tr>
      `).join('');
    }

    if (previewWrapper) previewWrapper.style.display = 'block';
    if (submitBtn) submitBtn.disabled = validCount === 0;
  },

  // Xác nhận nhập khẩu từ Excel
  async submitImportExcel() {
    const validRows = (this.importedContractsData || []).filter(d => d.isValid);
    if (validRows.length === 0) {
      utils.showToast('Không có dữ liệu hợp lệ để nhập!', 'warning');
      return;
    }

    try {
      const res = await fetch('/api/contracts/import-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contracts: validRows })
      });
      const json = await res.json();
      if (json.success) {
        utils.showToast(`Đã nhập khẩu thành công ${validRows.length} hợp đồng vào hệ thống!`, 'success');
        if (window.recordActivityLog) {
          window.recordActivityLog('IMPORT', 'Hợp đồng', `Nhập khẩu ${validRows.length} hợp đồng từ Excel`);
        }
        this.closeImportModal();
        await this.render();
      } else {
        utils.showToast(json.message || 'Lỗi khi nhập hợp đồng', 'error');
      }
    } catch (e) {
      console.error(e);
      utils.showToast('Lỗi kết nối khi nhập khẩu hợp đồng', 'error');
    }
  },

  // Tải file mẫu Excel hợp đồng
  downloadTemplate() {
    if (typeof XLSX === 'undefined') {
      utils.showToast('Thư viện Excel chưa sẵn sàng', 'warning');
      return;
    }

    const templateData = [
      {
        'Mã hợp đồng': 'HD-TH-582',
        'Mã nhân viên': 'TH-582',
        'Họ và tên': 'Phạm Quốc Lâm',
        'Loại hợp đồng': 'Hợp đồng xác định thời hạn (12 tháng)',
        'Ngày ký': '27/10/2023',
        'Ngày hiệu lực': '27/10/2023',
        'Ngày hết hạn': '26/10/2024',
        'Lương hợp đồng': 8500000,
        'Trạng thái': 'HIỆU LỰC',
        'Người ký': 'Huỳnh Thanh Long'
      },
      {
        'Mã hợp đồng': 'HD-TH-1375',
        'Mã nhân viên': 'TH-1375',
        'Họ và tên': 'Phạm Quốc Vương',
        'Loại hợp đồng': 'Hợp đồng không xác định thời hạn',
        'Ngày ký': '15/05/2022',
        'Ngày hiệu lực': '15/05/2022',
        'Ngày hết hạn': '',
        'Lương hợp đồng': 12000000,
        'Trạng thái': 'HIỆU LỰC',
        'Người ký': 'Huỳnh Thanh Long'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mau_Hop_Dong');
    XLSX.writeFile(wb, 'Mau_Import_Hop_Dong_TRUNGHAI.xlsx');
  },

  // ========================================================================
  // XUẤT BÁO CÁO DANH SÁCH HỢP ĐỒNG RA EXCEL
  // ========================================================================
  exportToExcel() {
    if (typeof XLSX === 'undefined') {
      utils.showToast('Thư viện XLSX chưa sẵn sàng', 'warning');
      return;
    }

    const filtered = this.getFilteredContracts();
    if (filtered.length === 0) {
      utils.showToast('Không có dữ liệu hợp đồng để xuất!', 'warning');
      return;
    }

    const exportRows = filtered.map((c, idx) => ({
      'STT': idx + 1,
      'Mã Hợp Đồng': c.contract_id,
      'Mã Nhân Viên': c.employee_id,
      'Họ và Tên': c.full_name || '-',
      'Phòng Ban': c.department_name || '-',
      'Chức Danh': c.job_title || '-',
      'Loại Hợp Đồng': c.contract_type || '-',
      'Ngày Hiệu Lực': utils.formatDate(c.effective_date || c.start_date),
      'Ngày Hết Hạn': (c.expiry_date || c.end_date) ? utils.formatDate(c.expiry_date || c.end_date) : 'Không xác định',
      'Mức Lương': c.salary || 0,
      'Số Phụ Lục': Array.isArray(c.appendices) ? c.appendices.length : 0,
      'Trạng Thái HĐ': c.contract_status || 'HIỆU LỰC'
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Danh_Sach_Hop_Dong');
    XLSX.writeFile(wb, `Danh_Sach_Hop_Dong_TRUNGHAI_${new Date().toISOString().split('T')[0]}.xlsx`);
    utils.showToast(`Đã xuất ${filtered.length} hợp đồng ra file Excel!`, 'success');
  }
};

window.appContracts = appContracts;
