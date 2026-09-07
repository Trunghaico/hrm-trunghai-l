// ==========================================================================
// ORGANIZATION EXCEL IMPORT MODULE (CÔNG TY, PHÒNG BAN, VỊ TRÍ)
// Đảm bảo tính toàn vẹn quan hệ:
// - Phòng ban bắt buộc phải có Mã công ty trực thuộc hợp lệ
// - Vị trí bắt buộc phải có Mã phòng ban trực thuộc hợp lệ
// ==========================================================================

const appOrgImport = {
  initialized: false,
  isProcessing: false,
  currentScope: 'all', // 'all', 'company', 'department', 'position'

  parsedCompanies: [],
  parsedDepartments: [],
  parsedPositions: [],

  validCompanies: [],
  validDepartments: [],
  validPositions: [],

  init() {
    if (!this.initialized) {
      this.attachEventListeners();
      this.initialized = true;
    }
  },

  attachEventListeners() {
    const fileInput = document.getElementById('org-excel-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    }

    const dropzone = document.getElementById('org-excel-dropzone');
    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--primary-navy)';
        dropzone.style.background = '#EFF6FF';
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = 'var(--border-color)';
        dropzone.style.background = '#F8FAFC';
      });
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--border-color)';
        dropzone.style.background = '#F8FAFC';
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.processExcelFile(e.dataTransfer.files[0]);
        }
      });
    }

    const btnDownload = document.getElementById('btn-download-org-template');
    if (btnDownload) {
      btnDownload.addEventListener('click', () => this.downloadTemplate());
    }

    const btnSubmit = document.getElementById('btn-submit-org-import');
    if (btnSubmit) {
      btnSubmit.addEventListener('click', () => this.submitImport());
    }
  },

  openModal(scope = 'all') {
    this.init();
    this.currentScope = scope;
    this.resetState();

    const titleEl = document.getElementById('modal-org-import-title');
    if (titleEl) {
      if (scope === 'company') titleEl.textContent = 'Nhập Dữ Liệu Công Ty Bằng Excel';
      else if (scope === 'department') titleEl.textContent = 'Nhập Dữ Liệu Phòng Ban Bằng Excel';
      else if (scope === 'position') titleEl.textContent = 'Nhập Dữ Liệu Vị Trí / Chức Danh Bằng Excel';
      else titleEl.textContent = 'Nhập Dữ Liệu Cơ Cấu Tổ Chức Bằng Excel (Công Ty, Phòng Ban, Vị Trí)';
    }

    // Select matching scope radio if exists
    const radio = document.querySelector(`input[name="org-import-scope"][value="${scope}"]`);
    if (radio) radio.checked = true;

    const modal = document.getElementById('modal-import-org');
    if (modal) modal.classList.add('active');
  },

  closeModal() {
    const modal = document.getElementById('modal-import-org');
    if (modal) modal.classList.remove('active');
    this.resetState();
  },

  resetState() {
    this.parsedCompanies = [];
    this.parsedDepartments = [];
    this.parsedPositions = [];
    this.validCompanies = [];
    this.validDepartments = [];
    this.validPositions = [];

    const fileInput = document.getElementById('org-excel-file-input');
    if (fileInput) fileInput.value = '';

    const dropzone = document.getElementById('org-excel-dropzone');
    if (dropzone) {
      dropzone.style.display = 'block';
      this.resetDropzoneUI();
    }

    const preview = document.getElementById('org-import-preview-container');
    if (preview) preview.style.display = 'none';

    const submitBtn = document.getElementById('btn-submit-org-import');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> <span>Xác Nhận Nhập Dữ Liệu</span>';
    }
  },

  downloadTemplate() {
    try {
      if (typeof XLSX === 'undefined') {
        utils.showToast('Đang tải thư viện Excel, vui lòng thử lại sau giây lát...', 'warning');
        return;
      }

      const wb = XLSX.utils.book_new();

      // Sheet 1: Companies (01_Cong_Ty)
      const companiesData = [
        ['Mã công ty (*)', 'Tên công ty (*)'],
        ['TH-CORP', 'Tổng Công Ty Cổ Phần Trung Hải'],
        ['TP', 'Công Ty Cổ Phần Xây Dựng Cầu Đường Thành Phát'],
        ['TH-TECH', 'Công Ty TNHH Công Nghệ & Giải Pháp Số Trung Hải']
      ];
      const wsComp = XLSX.utils.aoa_to_sheet(companiesData);
      wsComp['!cols'] = [{ wch: 18 }, { wch: 45 }];
      XLSX.utils.book_append_sheet(wb, wsComp, '01_Cong_Ty');

      // Sheet 2: Departments (02_Phong_Ban)
      const deptsData = [
        ['Mã phòng ban (*)', 'Tên phòng ban (*)', 'Mã công ty (* BẮT BUỘC)'],
        ['BGD', 'Ban Giám Đốc', 'TH-CORP'],
        ['HR', 'Phòng Hành Chính Nhân Sự', 'TH-CORP'],
        ['TP-KT', 'Phòng Kế Toán', 'TP'],
        ['TP-KTTH', 'Ban Kỹ Thuật Dự Án', 'TP'],
        ['TECH-DEV', 'Trung Tâm Phát Triển Phần Mềm', 'TH-TECH']
      ];
      const wsDept = XLSX.utils.aoa_to_sheet(deptsData);
      wsDept['!cols'] = [{ wch: 20 }, { wch: 38 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(wb, wsDept, '02_Phong_Ban');

      // Sheet 3: Positions (03_Vi_Tri)
      const posData = [
        ['Mã vị trí (*)', 'Tên vị trí công việc / Chức danh (*)'],
        ['POS-TGD', 'Tổng Giám Đốc'],
        ['POS-TP-HR', 'Trưởng Phòng Nhân Sự'],
        ['TP-KTTH', 'Kế Toán Tổng Hợp'],
        ['TECH-LEAD', 'Trưởng Nhóm Kỹ Thuật (Tech Lead)'],
        ['DEV-SR', 'Kỹ Sư Phần Mềm Cao Cấp'],
        ['CHUYEN-VIEN', 'Chuyên Viên Nghiệp Vụ']
      ];
      const wsPos = XLSX.utils.aoa_to_sheet(posData);
      wsPos['!cols'] = [{ wch: 18 }, { wch: 42 }];
      XLSX.utils.book_append_sheet(wb, wsPos, '03_Vi_Tri');

      XLSX.writeFile(wb, 'Mau_Co_Cau_To_Chuc_TRUNGHAI.xlsx');
      utils.showToast('Đã tải xuống file mẫu cơ cấu tổ chức thành công!', 'success');
    } catch (err) {
      console.error('Lỗi tải file mẫu tổ chức:', err);
      utils.showToast('Không thể tạo file mẫu: ' + err.message, 'error');
    }
  },


  handleFileSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (file) this.processExcelFile(file);
  },

  async processExcelFile(file) {
    if (!file) return;

    const dropzone = document.getElementById('org-excel-dropzone');
    if (dropzone) {
      dropzone.innerHTML = `
        <i class="fa-solid fa-spinner fa-spin" style="color: #10B981; font-size: 38px; margin-bottom: 12px; display: block;"></i>
        <div style="font-size: 14px; font-weight: 700; color: var(--primary-navy);">Đang đọc & đối soát liên kết file Excel: ${file.name}...</div>
      `;
    }

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });

      this.parseWorkbookData(workbook);
      this.validateLinkages();
      this.renderPreview();
    } catch (err) {
      console.error(err);
      utils.showToast('Lỗi khi đọc file Excel: ' + err.message, 'error');
      this.resetDropzoneUI();
    }
  },

  resetDropzoneUI() {
    const dropzone = document.getElementById('org-excel-dropzone');
    if (dropzone) {
      dropzone.innerHTML = `
        <i class="fa-solid fa-cloud-arrow-up" style="color: #10B981; font-size: 38px; margin-bottom: 12px; display: block;"></i>
        <div style="font-size: 14.5px; font-weight: 700; color: var(--primary-navy);">Kéo & Thả file Excel vào đây hoặc click để chọn file</div>
        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 6px;">Hệ thống sẽ tự động đối soát: Phòng ban trực thuộc Công ty nào; Danh mục vị trí độc lập.</div>
      `;
    }
  },

  extractField(row, fieldType) {
    if (!row || typeof row !== 'object') return '';
    for (const [k, v] of Object.entries(row)) {
      if (v === undefined || v === null) continue;
      const strVal = v.toString().trim();
      if (!strVal) continue;

      const norm = k.toString().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, ' ')
        .trim()
        .replace(/\s+/g, '_');

      if (fieldType === 'pos_id') {
        if ((norm.includes('ma') && (norm.includes('vi_tri') || norm.includes('chuc_danh') || norm.includes('vt') || norm.includes('chuc_vu'))) ||
            norm === 'position_id' || norm === 'pos_id' || norm === 'ma' || norm === 'id') {
          return strVal;
        }
      }
      if (fieldType === 'pos_name') {
        if ((norm.includes('ten') && (norm.includes('vi_tri') || norm.includes('chuc_danh') || norm.includes('vt') || norm.includes('chuc_vu'))) ||
            norm.includes('chuc_danh') || norm.includes('position_name') || norm === 'chuc_vu' || norm === 'title') {
          return strVal;
        }
      }
      if (fieldType === 'comp_id') {
        if ((norm.includes('ma') && (norm.includes('cong_ty') || norm.includes('cty') || norm.includes('don_vi') || norm.includes('dv'))) ||
            norm === 'company_id' || norm === 'comp_id') {
          return strVal;
        }
      }
      if (fieldType === 'comp_name') {
        if ((norm.includes('ten') && (norm.includes('cong_ty') || norm.includes('cty') || norm.includes('don_vi') || norm.includes('dv'))) ||
            norm === 'company_name') {
          return strVal;
        }
      }
      if (fieldType === 'dept_id') {
        if ((norm.includes('ma') && (norm.includes('phong_ban') || norm.includes('pb') || norm.includes('don_vi'))) ||
            norm === 'department_id' || norm === 'dept_id') {
          return strVal;
        }
      }
      if (fieldType === 'dept_name') {
        if ((norm.includes('ten') && (norm.includes('phong_ban') || norm.includes('pb') || norm.includes('don_vi'))) ||
            norm === 'department_name') {
          return strVal;
        }
      }
      if (fieldType === 'dept_comp_id') {
        if (norm.includes('cong_ty') || norm.includes('company') || norm.includes('cty')) {
          return strVal;
        }
      }
    }
    return '';
  },

  parseWorkbookData(workbook) {
    this.parsedCompanies = [];
    this.parsedDepartments = [];
    this.parsedPositions = [];

    const sheetNames = workbook.SheetNames || [];

    sheetNames.forEach(sName => {
      const ws = workbook.Sheets[sName];
      if (!ws) return;
      const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (rawRows.length === 0) return;

      const sLower = sName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      // Identify sheet type
      const isCompSheet = sLower.includes('cong_ty') || sLower.includes('company') || sLower.includes('cong ty');
      const isDeptSheet = sLower.includes('phong_ban') || sLower.includes('department') || sLower.includes('phong ban');
      const isPosSheet = sLower.includes('vi_tri') || sLower.includes('position') || sLower.includes('chuc_danh') || sLower.includes('vi tri') || sLower.includes('chuc danh');

      if (isCompSheet || (sheetNames.length === 1 && this.currentScope === 'company')) {
        rawRows.forEach((r, idx) => {
          let compId = this.extractField(r, 'comp_id');
          let compName = this.extractField(r, 'comp_name');
          if (!compId && !compName) {
            const vals = Object.values(r).map(v => v ? v.toString().trim() : '').filter(Boolean);
            if (vals.length >= 2) { compId = vals[0]; compName = vals[1]; }
          }
          if (compId || compName) {
            this.parsedCompanies.push({
              _row: idx + 2,
              _sheet: sName,
              company_id: (compId || '').toUpperCase(),
              company_name: compName || '',
              parent_company_id: ''
            });
          }
        });
      } else if (isDeptSheet || (sheetNames.length === 1 && this.currentScope === 'department')) {
        rawRows.forEach((r, idx) => {
          let deptId = this.extractField(r, 'dept_id');
          let deptName = this.extractField(r, 'dept_name');
          let compId = this.extractField(r, 'dept_comp_id');
          if (!deptId && !deptName) {
            const vals = Object.values(r).map(v => v ? v.toString().trim() : '').filter(Boolean);
            if (vals.length >= 3) { deptId = vals[0]; deptName = vals[1]; compId = vals[2]; }
            else if (vals.length >= 2) { deptId = vals[0]; deptName = vals[1]; }
          }
          if (deptId || deptName) {
            this.parsedDepartments.push({
              _row: idx + 2,
              _sheet: sName,
              department_id: (deptId || '').toUpperCase(),
              department_name: deptName || '',
              company_id: (compId || '').toUpperCase(),
              parent_dept_id: ''
            });
          }
        });
      } else if (isPosSheet || (sheetNames.length === 1 && this.currentScope === 'position')) {
        rawRows.forEach((r, idx) => {
          let posId = this.extractField(r, 'pos_id');
          let posName = this.extractField(r, 'pos_name');
          if (!posId || !posName) {
            const vals = Object.values(r).map(v => v ? v.toString().trim() : '').filter(Boolean);
            if (vals.length >= 2) {
              if (!posId) posId = vals[0];
              if (!posName) posName = vals[1];
            }
          }
          if (posId || posName) {
            this.parsedPositions.push({
              _row: idx + 2,
              _sheet: sName,
              position_id: (posId || '').toUpperCase(),
              position_name: posName || '',
              level: 'Cấp 3'
            });
          }
        });
      } else {
        // Auto-detect by inspecting first row
        const firstRow = rawRows[0];
        const hasPos = this.extractField(firstRow, 'pos_id') || this.extractField(firstRow, 'pos_name');
        const hasDept = this.extractField(firstRow, 'dept_id') || this.extractField(firstRow, 'dept_name');
        const hasComp = this.extractField(firstRow, 'comp_id') || this.extractField(firstRow, 'comp_name');

        rawRows.forEach((r, idx) => {
          if (hasPos) {
            let posId = this.extractField(r, 'pos_id');
            let posName = this.extractField(r, 'pos_name');
            if (!posId || !posName) {
              const vals = Object.values(r).map(v => v ? v.toString().trim() : '').filter(Boolean);
              if (vals.length >= 2) { if (!posId) posId = vals[0]; if (!posName) posName = vals[1]; }
            }
            if (posId || posName) {
              this.parsedPositions.push({
                _row: idx + 2,
                _sheet: sName,
                position_id: (posId || '').toUpperCase(),
                position_name: posName || '',
                level: 'Cấp 3'
              });
            }
          } else if (hasDept) {
            let deptId = this.extractField(r, 'dept_id');
            let deptName = this.extractField(r, 'dept_name');
            let compId = this.extractField(r, 'dept_comp_id');
            if (deptId || deptName) {
              this.parsedDepartments.push({
                _row: idx + 2,
                _sheet: sName,
                department_id: (deptId || '').toUpperCase(),
                department_name: deptName || '',
                company_id: (compId || '').toUpperCase(),
                parent_dept_id: ''
              });
            }
          } else if (hasComp) {
            let compId = this.extractField(r, 'comp_id');
            let compName = this.extractField(r, 'comp_name');
            if (compId || compName) {
              this.parsedCompanies.push({
                _row: idx + 2,
                _sheet: sName,
                company_id: (compId || '').toUpperCase(),
                company_name: compName || '',
                parent_company_id: ''
              });
            }
          }
        });
      }
    });
  },

  validateLinkages() {
    this.validCompanies = [];
    this.validDepartments = [];
    this.validPositions = [];

    // Pool of known companies: existing + newly imported valid companies
    const knownCompanies = new Map();
    (appData.companies || []).forEach(c => knownCompanies.set((c.company_id || '').toUpperCase(), c.company_name || ''));

    // 1. Validate Companies
    this.parsedCompanies.forEach(c => {
      c._errors = [];
      if (!c.company_id) c._errors.push('Thiếu Mã công ty');
      if (!c.company_name) c._errors.push('Thiếu Tên công ty');

      if (c._errors.length === 0) {
        knownCompanies.set(c.company_id, c.company_name);
        this.validCompanies.push(c);
      }
    });

    // Pool of known departments: existing + newly imported valid departments
    const knownDepartments = new Map();
    (appData.departments || []).forEach(d => knownDepartments.set((d.department_id || '').toUpperCase(), d.department_name || ''));

    // 2. Validate Departments (STRICT: BẮT BUỘC có mã công ty & mã công ty phải tồn tại)
    this.parsedDepartments.forEach(d => {
      d._errors = [];
      if (!d.department_id) d._errors.push('Thiếu Mã phòng ban');
      if (!d.department_name) d._errors.push('Thiếu Tên phòng ban');

      // Check mandatory company_id
      if (!d.company_id) {
        d._errors.push('BẮT BUỘC: Phòng ban phải có Mã công ty');
      } else if (!knownCompanies.has(d.company_id)) {
        d._errors.push(`Mã công ty "${d.company_id}" không tồn tại`);
      }

      if (d._errors.length === 0) {
        knownDepartments.set(d.department_id, d.department_name);
        this.validDepartments.push(d);
      }
    });

    // 3. Validate Positions (INDEPENDENT CATALOG: Danh mục vị trí độc lập, không phụ thuộc phòng ban và công ty)
    this.parsedPositions.forEach(p => {
      p._errors = [];
      if (!p.position_id) p._errors.push('Thiếu Mã vị trí');
      if (!p.position_name) p._errors.push('Thiếu Tên vị trí');

      if (p._errors.length === 0) {
        this.validPositions.push(p);
      }
    });
  },

  renderPreview() {
    this.resetDropzoneUI();
    const dropzone = document.getElementById('org-excel-dropzone');
    if (dropzone) dropzone.style.display = 'none';

    const preview = document.getElementById('org-import-preview-container');
    if (preview) preview.style.display = 'block';

    // Summary banner
    const statEl = document.getElementById('org-import-stat-summary');
    if (statEl) {
      const compErr = this.parsedCompanies.length - this.validCompanies.length;
      const deptErr = this.parsedDepartments.length - this.validDepartments.length;
      const posErr = this.parsedPositions.length - this.validPositions.length;

      statEl.innerHTML = `
        <div style="display: flex; gap: 14px; flex-wrap: wrap; font-size: 12.5px;">
          <span style="font-weight: 700; color: #1E293B;">Đã quét từ file:</span>
          <span><i class="fa-solid fa-building" style="color: #0284C7;"></i> <strong>${this.validCompanies.length}</strong>/${this.parsedCompanies.length} Công ty ${compErr > 0 ? `<span style="color: var(--accent-red); font-weight:700;">(${compErr} lỗi)</span>` : ''}</span>
          <span><i class="fa-solid fa-sitemap" style="color: #D97706;"></i> <strong>${this.validDepartments.length}</strong>/${this.parsedDepartments.length} Phòng ban ${deptErr > 0 ? `<span style="color: var(--accent-red); font-weight:700;">(${deptErr} lỗi)</span>` : ''}</span>
          <span><i class="fa-solid fa-user-tag" style="color: #10B981;"></i> <strong>${this.validPositions.length}</strong>/${this.parsedPositions.length} Vị trí ${posErr > 0 ? `<span style="color: var(--accent-red); font-weight:700;">(${posErr} lỗi)</span>` : ''}</span>
        </div>
      `;
    }

    // Render Preview Tables
    this.renderCompaniesPreviewTable();
    this.renderDepartmentsPreviewTable();
    this.renderPositionsPreviewTable();

    // Default to matching scope or tab with data
    if (this.currentScope === 'position' && this.parsedPositions.length > 0) {
      this.switchPreviewTab('org-preview-pos-tab');
    } else if (this.currentScope === 'department' && this.parsedDepartments.length > 0) {
      this.switchPreviewTab('org-preview-dept-tab');
    } else if (this.currentScope === 'company' && this.parsedCompanies.length > 0) {
      this.switchPreviewTab('org-preview-comp-tab');
    } else if (this.parsedCompanies.length > 0) {
      this.switchPreviewTab('org-preview-comp-tab');
    } else if (this.parsedDepartments.length > 0) {
      this.switchPreviewTab('org-preview-dept-tab');
    } else if (this.parsedPositions.length > 0) {
      this.switchPreviewTab('org-preview-pos-tab');
    }

    // Enable/disable submit button
    const totalValid = this.validCompanies.length + this.validDepartments.length + this.validPositions.length;
    const submitBtn = document.getElementById('btn-submit-org-import');
    if (submitBtn) {
      submitBtn.disabled = totalValid === 0;
      submitBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> <span>Xác Nhận Nhập (${totalValid} Mục Hợp Lệ)</span>`;
    }
  },

  renderCompaniesPreviewTable() {
    const tbody = document.getElementById('org-preview-comp-tbody');
    if (!tbody) return;

    if (this.parsedCompanies.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 16px;">Không có dữ liệu công ty trong file</td></tr>';
      return;
    }

    tbody.innerHTML = this.parsedCompanies.map(c => {
      const hasErr = c._errors.length > 0;
      const badge = hasErr
        ? `<span class="badge" style="background: #FEE2E2; color: #991B1B;"><i class="fa-solid fa-triangle-exclamation"></i> ${c._errors.join(', ')}</span>`
        : `<span class="badge" style="background: #DCFCE7; color: #166534;"><i class="fa-solid fa-circle-check"></i> Hợp lệ</span>`;

      return `
        <tr style="${hasErr ? 'background: #FFF5F5;' : ''}">
          <td style="text-align: center; font-weight: 600;">${c._row || '-'}</td>
          <td><strong style="color: var(--primary-navy);">${c.company_id || '-'}</strong></td>
          <td>${c.company_name || '-'}</td>
          <td>${badge}</td>
        </tr>
      `;
    }).join('');
  },

  renderDepartmentsPreviewTable() {
    const tbody = document.getElementById('org-preview-dept-tbody');
    if (!tbody) return;

    if (this.parsedDepartments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 16px;">Không có dữ liệu phòng ban trong file</td></tr>';
      return;
    }

    tbody.innerHTML = this.parsedDepartments.map(d => {
      const hasErr = d._errors.length > 0;
      const badge = hasErr
        ? `<span class="badge" style="background: #FEE2E2; color: #991B1B;"><i class="fa-solid fa-triangle-exclamation"></i> ${d._errors.join(', ')}</span>`
        : `<span class="badge" style="background: #DCFCE7; color: #166534;"><i class="fa-solid fa-circle-check"></i> Hợp lệ</span>`;

      return `
        <tr style="${hasErr ? 'background: #FFF5F5;' : ''}">
          <td style="text-align: center; font-weight: 600;">${d._row || '-'}</td>
          <td><strong style="color: var(--primary-navy);">${d.department_id || '-'}</strong></td>
          <td>${d.department_name || '-'}</td>
          <td><span class="badge badge-navy">${d.company_id || '<i style="color:red;">Thiếu mã công ty</i>'}</span></td>
          <td>${badge}</td>
        </tr>
      `;
    }).join('');
  },

  renderPositionsPreviewTable() {
    const tbody = document.getElementById('org-preview-pos-tbody');
    if (!tbody) return;

    if (this.parsedPositions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 16px;">Không có dữ liệu vị trí trong file</td></tr>';
      return;
    }

    tbody.innerHTML = this.parsedPositions.map(p => {
      const hasErr = p._errors.length > 0;
      const badge = hasErr
        ? `<span class="badge" style="background: #FEE2E2; color: #991B1B;"><i class="fa-solid fa-triangle-exclamation"></i> ${p._errors.join(', ')}</span>`
        : `<span class="badge" style="background: #DCFCE7; color: #166534;"><i class="fa-solid fa-circle-check"></i> Hợp lệ</span>`;

      return `
        <tr style="${hasErr ? 'background: #FFF5F5;' : ''}">
          <td style="text-align: center; font-weight: 600;">${p._row || '-'}</td>
          <td><strong style="color: var(--primary-navy);">${p.position_id || '-'}</strong></td>
          <td>${p.position_name || '-'}</td>
          <td style="text-align: center;">${badge}</td>
        </tr>
      `;
    }).join('');
  },

  switchPreviewTab(tabId) {
    document.querySelectorAll('.org-preview-tab-btn').forEach(btn => {
      const isActive = btn.getAttribute('data-tab') === tabId;
      btn.classList.toggle('active', isActive);
    });
    document.querySelectorAll('.org-preview-tab-pane').forEach(pane => {
      const isActive = pane.id === tabId;
      pane.classList.toggle('active', isActive);
      pane.style.setProperty('display', isActive ? 'block' : 'none', 'important');
    });
  },

  async submitImport() {
    const totalValid = this.validCompanies.length + this.validDepartments.length + this.validPositions.length;
    if (totalValid === 0) {
      utils.showToast('Không có dữ liệu hợp lệ để nhập vào hệ thống', 'warning');
      return;
    }

    const submitBtn = document.getElementById('btn-submit-org-import');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Đang ghi vào hệ thống...</span>';
    }

    try {
      const overwrite = document.getElementById('org-import-chk-overwrite')?.checked !== false;
      const user = (typeof appAuth !== 'undefined' && typeof appAuth.getCurrentUser === 'function')
        ? appAuth.getCurrentUser()
        : { employee_id: 'TH-0001', full_name: 'Huỳnh Thanh Long', role: 'ADMIN' };

      const apiHeaders = (typeof appData !== 'undefined' && typeof appData.getApiHeaders === 'function')
        ? appData.getApiHeaders()
        : {};

      const res = await fetch('/api/organization/import-excel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...apiHeaders
        },
        body: JSON.stringify({
          companies: this.validCompanies,
          departments: this.validDepartments,
          positions: this.validPositions,
          overwrite,
          operator_id: user?.employee_id || 'TH-0001',
          operator_name: user?.full_name || 'Huỳnh Thanh Long',
          operator_role: user?.role || 'ADMIN'
        })
      });

      const json = await res.json();
      if (json.success) {
        utils.showToast(json.message || `Nhập thành công cơ cấu tổ chức!`, 'success');
        this.closeModal();

        // Refresh all application and organization data
        await appData.init();
        if (typeof appOrganization !== 'undefined') {
          appOrganization.populateFilterDropdowns();
          appOrganization.renderCompaniesTable();
          appOrganization.renderDepartmentsTable();
          appOrganization.renderPositionsTable();
          appOrganization.renderOrgChart();
          appOrganization.updateAllDropdowns();
        }
      } else {
        utils.showToast(json.message || 'Lỗi khi nhập cơ cấu tổ chức', 'error');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> <span>Xác Nhận Nhập Dữ Liệu</span>';
        }
      }
    } catch (err) {
      console.error(err);
      utils.showToast('Lỗi kết nối máy chủ: ' + err.message, 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> <span>Xác Nhận Nhập Dữ Liệu</span>';
      }
    }
  }
};
