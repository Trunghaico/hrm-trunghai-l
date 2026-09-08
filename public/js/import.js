// ==========================================================================
// EXCEL IMPORT MODULE (NHẬP DANH SÁCH NHÂN SỰ TỪ FILE EXCEL & KIỂM TRA TRÙNG LẶP)
// ==========================================================================

const appImport = {
  initialized: false,
  isImporting: false,
  currentStep: 1,
  currentFilter: 'all',
  scopeMode: 'all', // 'all' | 'selected'
  selectedTabs: new Set([
    'tab-p-personal', 'tab-p-org', 'tab-p-contract', 'tab-p-identity',
    'tab-p-contact', 'tab-p-emergency', 'tab-p-education', 'tab-p-salary',
    'tab-p-allowance', 'tab-p-account'
  ]),
  parsedEmployees: [],
  validEmployees: [],
  overwriteEmployees: [],
  conflictEmployees: [],

  init() {
    if (!this.initialized) {
      this.attachEventListeners();
      this.initialized = true;
    }
  },

  attachEventListeners() {
    const fileInput = document.getElementById('excel-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    }

    const dropzone = document.getElementById('excel-dropzone');
    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--primary-navy)';
        dropzone.style.background = '#EFF6FF';
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = 'var(--border-color)';
        dropzone.style.background = '#FFFFFF';
      });
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--border-color)';
        dropzone.style.background = '#FFFFFF';
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.processExcelFile(e.dataTransfer.files[0]);
        }
      });
    }

    const btnDownload = document.getElementById('btn-download-import-template');
    if (btnDownload) {
      btnDownload.addEventListener('click', () => this.downloadTemplate());
    }

    const btnDownload1000 = document.getElementById('btn-download-sample-1000');
    if (btnDownload1000) {
      btnDownload1000.addEventListener('click', () => {
        window.location.href = '/api/employees/sample-1000';
      });
    }

    const btnSubmit = document.getElementById('btn-submit-excel-import');
    if (btnSubmit) {
      btnSubmit.addEventListener('click', () => this.submitImport());
    }

    const chkOverwrite = document.getElementById('import-chk-overwrite');
    if (chkOverwrite) {
      chkOverwrite.addEventListener('change', () => this.reValidate());
    }

    const chkSkipErrors = document.getElementById('import-chk-skip-errors');
    if (chkSkipErrors) {
      chkSkipErrors.addEventListener('change', () => this.updateSubmitButtonState());
    }
  },

  onScopeModeChange(mode) {
    this.scopeMode = mode;
    const grid = document.getElementById('import-tab-selection-grid');
    const titleEl = document.getElementById('import-template-title');
    const descEl = document.getElementById('import-template-desc');
    if (mode === 'selected') {
      if (grid) grid.style.display = 'grid';
      this.renderTabSelectionGrid();
      if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-circle-down"></i> Tải File Mẫu Theo Các Tab Đã Chọn';
      if (descEl) descEl.textContent = 'File mẫu sẽ chỉ bao gồm cột Mã nhân viên, Họ và tên (để nhận diện đối soát) và các cột thuộc các Tab bạn đã chọn bên trên.';
    } else {
      if (grid) grid.style.display = 'none';
      if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-circle-down"></i> Tải File Mẫu Chuẩn Định Dạng Excel (Đầy Đủ 115 Cột Nghiệp Vụ Chuẩn Hóa)';
      if (descEl) descEl.textContent = 'File mẫu đã chuẩn hóa chuẩn xác 115 trường thông tin (từ Mã nhân viên đến Mã đơn vị công tác) kèm 2 dòng dữ liệu mẫu và danh mục mã Đơn vị, Vị trí chuẩn để tra cứu.';
    }
  },

  renderTabSelectionGrid() {
    const grid = document.getElementById('import-tab-selection-grid');
    if (!grid || typeof PROFILE_TABS === 'undefined') return;

    grid.innerHTML = PROFILE_TABS.map(tab => {
      const isChecked = this.selectedTabs.has(tab.id);
      const fieldCount = (typeof MASTER_FIELDS_CONFIG !== 'undefined') ? MASTER_FIELDS_CONFIG.filter(f => f.tab === tab.id).length : 0;
      return `
        <label style="display: flex; align-items: center; justify-content: space-between; background: #FFFFFF; border: 1px solid ${isChecked ? '#2563EB' : 'var(--border-color)'}; padding: 7px 10px; border-radius: 5px; cursor: pointer; font-size: 12px; font-weight: 600; color: var(--text-primary); transition: all 0.15s ease;">
          <div style="display: flex; align-items: center; gap: 7px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <input type="checkbox" class="import-tab-chk" value="${tab.id}" ${isChecked ? 'checked' : ''} onchange="appImport.onTabCheckChange(this)" style="cursor: pointer; accent-color: #2563EB;">
            <i class="fa-solid ${tab.icon}" style="color: #2563EB; font-size: 12.5px; width: 15px; text-align: center;"></i>
            <span>${tab.name}</span>
          </div>
          <span style="font-size: 10.5px; color: var(--text-muted); font-weight: 500;">${fieldCount} trường</span>
        </label>
      `;
    }).join('');
  },

  onTabCheckChange(el) {
    if (el.checked) {
      this.selectedTabs.add(el.value);
    } else {
      this.selectedTabs.delete(el.value);
    }
    if (this.selectedTabs.size === 0) {
      utils.showToast('Vui lòng chọn ít nhất 1 Tab cần nhập dữ liệu!', 'warning');
      el.checked = true;
      this.selectedTabs.add(el.value);
    }
    this.renderTabSelectionGrid();
  },

  openModal() {
    this.resetState();
    this.renderTabSelectionGrid();
    const modal = document.getElementById('modal-import-employees');
    if (modal) modal.classList.add('active');
  },

  closeModal() {
    const modal = document.getElementById('modal-import-employees');
    if (modal) modal.classList.remove('active');
  },

  resetState() {
    this.currentStep = 1;
    this.currentFilter = 'all';
    this.parsedEmployees = [];
    this.validEmployees = [];
    this.overwriteEmployees = [];
    this.conflictEmployees = [];

    const fileInput = document.getElementById('excel-file-input');
    if (fileInput) fileInput.value = '';

    this.setStepUI(1);

    const submitBtn = document.getElementById('btn-submit-excel-import');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Xác Nhận Nhập Dữ Liệu';
    }
  },

  setStepUI(step) {
    this.currentStep = step;
    const step1Banner = document.getElementById('import-step1-banner');
    const dropzone = document.getElementById('excel-dropzone');
    const previewContainer = document.getElementById('import-preview-container');
    const stepHeader1 = document.getElementById('import-stepper-1');
    const stepHeader2 = document.getElementById('import-stepper-2');

    if (step === 1) {
      if (step1Banner) step1Banner.style.display = 'flex';
      if (dropzone) dropzone.style.display = 'block';
      if (previewContainer) previewContainer.style.display = 'none';

      if (stepHeader1) {
        stepHeader1.style.color = 'var(--primary-navy)';
        stepHeader1.style.fontWeight = '700';
        stepHeader1.style.borderBottom = '2px solid var(--primary-navy)';
      }
      if (stepHeader2) {
        stepHeader2.style.color = 'var(--text-muted)';
        stepHeader2.style.fontWeight = '500';
        stepHeader2.style.borderBottom = 'none';
      }
    } else {
      if (step1Banner) step1Banner.style.display = 'none';
      if (dropzone) dropzone.style.display = 'none';
      if (previewContainer) previewContainer.style.display = 'block';

      if (stepHeader1) {
        stepHeader1.style.color = 'var(--text-muted)';
        stepHeader1.style.fontWeight = '500';
        stepHeader1.style.borderBottom = 'none';
      }
      if (stepHeader2) {
        stepHeader2.style.color = '#047857';
        stepHeader2.style.fontWeight = '700';
        stepHeader2.style.borderBottom = '2px solid #10B981';
      }
    }
  },

  downloadTemplate() {
    try {
      if (typeof XLSX === 'undefined') {
        utils.showToast('Đang tải thư viện xử lý Excel, vui lòng thử lại sau giây lát...', 'warning');
        return;
      }

      const depts = (window.appData && appData.departments) || [];
      const positions = (window.appData && appData.positions) || [];

      const wb = XLSX.utils.book_new();

      if (this.scopeMode === 'selected') {
        const selectiveHeaders = ['Mã nhân viên', 'Họ và tên'];
        if (typeof MASTER_FIELDS_CONFIG !== 'undefined') {
          MASTER_FIELDS_CONFIG.forEach(f => {
            if (this.selectedTabs.has(f.tab) && !selectiveHeaders.includes(f.key)) {
              selectiveHeaders.push(f.key);
            }
          });
        }

        const sampleRowMap1 = {
          'Mã nhân viên': 'TH-2001', 'Họ và tên': 'Nguyễn Văn An', 'Giới tính': 'Nam', 'Ngày sinh': '15/08/1992',
          'Nơi sinh': 'Hà Nội', 'Nguyên quán': 'Nam Định', 'Tình trạng hôn nhân': 'Đã kết hôn', 'Dân tộc': 'Kinh',
          'Tôn giáo': 'Không', 'Quốc tịch': 'Việt Nam', 'MST cá nhân': '8456123890',
          'Đơn vị công tác': depts[0]?.department_name || 'Phòng Hành Chính Nhân Sự', 'Mã đơn vị công tác': depts[0]?.department_id || 'HR',
          'Vị trí công việc': positions[0]?.position_name || 'Chuyên viên Nhân sự', 'Mã vị trí công việc': positions[0]?.position_id || 'POS-01',
          'Chức danh': 'Chuyên viên Nhân sự cấp cao', 'Cấp': 'Cấp 3', 'Bậc': 'Bậc 3', 'Mã chấm công': '2001',
          'Quản lý trực tiếp': 'Huỳnh Thanh Long', 'Quản lý gián tiếp': 'Trần Minh Đức', 'Người duyệt': 'Huỳnh Thanh Long',
          'Địa điểm làm việc': 'Trụ sở Tổng công ty - Tòa nhà Trung Hải, Hà Nội', 'Khu vực làm việc': 'Khối Văn phòng Tổng công ty',
          'Tính chất lao động': 'Chính thức', 'Trạng thái lao động': 'Đang làm việc', 'Nhân sự khai thác': 'Lê Thị Thu',
          'Nguồn ứng viên': 'VietnamWorks', 'Số sổ QL lao động': 'LD-00123', 'Loại hợp đồng': 'Hợp đồng lao động không xác định thời hạn',
          'Ngày học việc': '01/01/2026', 'Ngày thử việc': '01/03/2026', 'Ngày chính thức': '01/05/2026', 'Thâm niên': '3 năm',
          'Ngày có hiệu lực': '01/05/2026', 'Ngày hết hiệu lực': 'Không xác định', 'Nhóm lý do nghỉ': '', 'Lý do nghỉ': '',
          'Ngày nghỉ việc': '', 'Ngày nghỉ hưu dự kiến': '15/08/2054', 'Thuộc danh sách đen': 'Không', 'Tham gia công đoàn': 'Có',
          'Loại giấy tờ': 'CCCD', 'Số CMND': '001092012345', 'Ngày cấp giấy tờ': '10/05/2021',
          'Nơi cấp giấy tờ': 'Cục Cảnh sát Quản lý hành chính về trật tự xã hội', 'Ngày hết hạn giấy tờ': '15/08/2032',
          'Số Hộ chiếu': 'P01234567', 'Ngày cấp Hộ chiếu': '12/04/2022', 'Nơi cấp Hộ chiếu': 'Cục Quản lý Xuất nhập cảnh', 'Ngày hết hạn Hộ chiếu': '12/04/2032',
          'ĐT di động': '0987654321', 'ĐT cơ quan': '02438888999', 'ĐT nhà riêng': '02437654321', 'ĐT khác': '',
          'Email cơ quan': 'an.nv@trunghaico.vn', 'Email cá nhân': 'annguyen92@gmail.com', 'Email khác': '',
          'Skype': 'an.nguyen.hr', 'Facebook': 'facebook.com/annv92', 'Hộ khẩu thường trú': 'Số 12 Phố Huế, P. Hàng Bài, Q. Hoàn Kiếm, Hà Nội',
          'Quốc gia (Thường trú)': 'Việt Nam', 'Tỉnh/Thành phố (Thường trú)': 'Hà Nội', 'Quận/Huyện (Thường trú)': 'Hoàn Kiếm',
          'Phường/Xã (Thường trú)': 'Hàng Bài', 'Số nhà, đường phố (Thường trú)': 'Số 12 Phố Huế', 'Số sổ hộ khẩu': 'HK-001928',
          'Mã số hộ gia đình': 'HGD-019283', 'Là chủ hộ': 'Có', 'Chỗ ở hiện nay': 'Tòa nhà Trung Hải, Cầu Giấy, Hà Nội',
          'Quốc gia (Hiện nay)': 'Việt Nam', 'Tỉnh/Thành phố (Hiện nay)': 'Hà Nội', 'Quận/Huyện (Hiện nay)': 'Cầu Giấy',
          'Phường/Xã (Hiện nay)': 'Dịch Vọng Hậu', 'Số nhà, đường phố (Hiện nay)': 'Phố Duy Tân', 'TP gia đình': 'Cán bộ công chức',
          'TP bản thân': 'Công nhân viên chức', 'Họ và tên (LHKC)': 'Nguyễn Thị Bình', 'Quan hệ (LHKC)': 'Vợ',
          'ĐT di động (LHKC)': '0912345678', 'ĐT nhà riêng (LHKC)': '02437654321', 'Email (LHKC)': 'binhnt@gmail.com',
          'Địa chỉ (LHKC)': 'Số 12 Phố Huế, P. Hàng Bài, Q. Hoàn Kiếm, Hà Nội', 'Trình độ văn hóa': '12/12',
          'Trình độ đào tạo': 'Đại học', 'Nơi đào tạo': 'Đại học Kinh Tế Quốc Dân', 'Khoa': 'Quản trị Kinh doanh',
          'Chuyên ngành': 'Quản trị Nhân lực', 'Năm tốt nghiệp': 2014, 'Xếp loại': 'Giỏi',
          'Bậc lương': 'Bậc 3', 'Hệ số lương': 2.34, 'Lương cơ bản': 16000000, 'Tỷ lệ hưởng lương': '100%',
          'Lương đóng BH': 16000000, 'Tổng lương': 20000000, 'TK ngân hàng': '1903456789012', 'Ngân hàng': 'Vietcombank',
          'Chi nhánh': 'Chi nhánh Hà Nội', 'Thuế suất': 'Theo biểu lũy tiến', 'Số người phụ thuộc': 0, 'Giảm trừ bản thân': 'Có',
          'Tham gia bảo hiểm': 'Đang tham gia',
          'Tỷ lệ đóng BHXH của NV': '8%', 'Tỷ lệ đóng BHYT của NV': '1.5%', 'Tỷ lệ đóng BHTN của NV': '1%',
          'Tỷ lệ đóng BHXH của DN': '17.5%', 'Tỷ lệ đóng BHYT của DN': '3%', 'Tỷ lệ đóng BHTN của DN': '1%',
          'Ngày tham gia BH': '01/03/2026', 'Số sổ BHXH': '0123456789', 'Mã số BHXH': '0123456789', 'Mã tỉnh cấp': '001',
          'Số thẻ BHYT': 'DN4010123456789', 'Nơi đăng ký KCB': 'Bệnh viện Bạch Mai - Hà Nội', 'Mật khẩu phiếu lương': 'TH@2026',
          'Tổng phụ cấp': 1500000, 'Số khoản phụ cấp': 2, 'Tổng giảm trừ': 0, 'Ghi chú phụ cấp': 'Phụ cấp chuyên cần',
          'ĐT tài khoản': '0987654321', 'Email tài khoản': 'an.nv@trunghaico.vn', 'Trạng thái tài khoản': 'Kích hoạt',
          'Trạng thái chữ ký số': 'Đã cấp', 'Trạng thái hồ sơ cấp CKS': 'Đã duyệt'
        };

        const sampleRows = [
          selectiveHeaders,
          selectiveHeaders.map(h => sampleRowMap1[h] !== undefined ? sampleRowMap1[h] : '')
        ];

        const ws = XLSX.utils.aoa_to_sheet(sampleRows);
        ws['!cols'] = selectiveHeaders.map(() => ({ wch: 22 }));
        ws['!cols'][0] = { wch: 16 };
        ws['!cols'][1] = { wch: 24 };

        XLSX.utils.book_append_sheet(wb, ws, 'Nhap_Lieu_Theo_Tab');
        XLSX.writeFile(wb, 'Mau_Nhap_Lieu_Theo_Tab_TRUNGHAI.xlsx');
        utils.showToast(`Đã tải xuống file mẫu cho ${this.selectedTabs.size} Tab được chọn!`, 'success');
        return;
      }

      const sampleHeaders = [
        'Mã nhân viên', 'Họ và tên', 'Giới tính', 'Ngày sinh', 'ĐT di động', 'Email cơ quan',
        'Vị trí công việc', 'Đơn vị công tác', 'Ngày thử việc', 'Ngày chính thức', 'Loại hợp đồng',
        'Trạng thái lao động', 'Thâm niên', 'Tham gia bảo hiểm', 'ĐT tài khoản', 'Tên gọi khác',
        'Nhóm lý do nghỉ', 'Ngày nghỉ hưu dự kiến', 'Tính chất lao động', 'Bậc lương', 'Tổng lương',
        'Tham gia công đoàn', 'Nơi sinh', 'Nguyên quán', 'Tình trạng hôn nhân', 'MST cá nhân',
        'TP gia đình', 'TP bản thân', 'Dân tộc', 'Tôn giáo', 'Quốc tịch', 'Số CMND',
        'Ngày cấp giấy tờ', 'Nơi cấp giấy tờ', 'Ngày hết hạn giấy tờ', 'Loại giấy tờ', 'Số Hộ chiếu',
        'Ngày cấp Hộ chiếu', 'Nơi cấp Hộ chiếu', 'Ngày hết hạn Hộ chiếu', 'Trình độ văn hóa',
        'Trình độ đào tạo', 'Nơi đào tạo', 'Khoa', 'Chuyên ngành', 'Năm tốt nghiệp', 'Xếp loại',
        'ĐT cơ quan', 'ĐT nhà riêng', 'ĐT khác', 'Email cá nhân', 'Email khác', 'Skype', 'Facebook',
        'Hộ khẩu thường trú', 'Quốc gia (Thường trú)', 'Tỉnh/Thành phố (Thường trú)', 'Quận/Huyện (Thường trú)',
        'Phường/Xã (Thường trú)', 'Số nhà, đường phố (Thường trú)', 'Số sổ hộ khẩu', 'Mã số hộ gia đình',
        'Là chủ hộ', 'Chỗ ở hiện nay', 'Quốc gia (Hiện nay)', 'Tỉnh/Thành phố (Hiện nay)',
        'Quận/Huyện (Hiện nay)', 'Phường/Xã (Hiện nay)', 'Số nhà, đường phố (Hiện nay)', 'Họ và tên (LHKC)',
        'Quan hệ (LHKC)', 'ĐT di động (LHKC)', 'ĐT nhà riêng (LHKC)', 'Email (LHKC)', 'Địa chỉ (LHKC)',
        'Email tài khoản', 'Trạng thái tài khoản', 'Trạng thái chữ ký số', 'Trạng thái hồ sơ cấp CKS',
        'Ngày có hiệu lực', 'Ngày hết hiệu lực', 'Chức danh', 'Mã chấm công', 'Cấp', 'Bậc',
        'Lý do nghỉ', 'Ngày nghỉ việc', 'Thuộc danh sách đen', 'Người duyệt', 'Địa điểm làm việc',
        'Số sổ QL lao động', 'Hệ số lương', 'Ngày học việc', 'Quản lý trực tiếp', 'Quản lý gián tiếp',
        'Lương cơ bản', 'Lương đóng BH', 'TK ngân hàng', 'Ngân hàng', 'Chi nhánh', 'Ngày tham gia BH',
        'Nhân sự khai thác',
        'Số sổ BHXH', 'Nguồn ứng viên', 'Mã số BHXH', 'Mã tỉnh cấp', 'Số thẻ BHYT', 'Nơi đăng ký KCB',
        'Khu vực làm việc', 'Mã vị trí công việc', 'Mã đơn vị công tác'
      ];

      const sampleRows = [
        sampleHeaders,
        [
          'TH-2001', 'Nguyễn Văn An', 'Nam', '15/08/1992', '0987654321', 'an.nv@trunghaico.vn',
          positions[0]?.position_name || 'Chuyên viên Nhân sự', depts[0]?.department_name || 'Phòng Hành Chính Nhân Sự',
          '01/03/2026', '01/05/2026', 'Hợp đồng lao động không xác định thời hạn', 'Đang làm việc',
          '3 năm', 'Có', '0987654321', '', '', '15/08/2054', 'Chính thức', '3', 20000000,
          'Có', 'Hà Nội', 'Nam Định', 'Đã kết hôn', '8456123890', 'Cán bộ công chức', 'Công nhân viên chức',
          'Kinh', 'Không', 'Việt Nam', '001092012345', '10/05/2021', 'Cục Cảnh sát Quản lý hành chính về trật tự xã hội',
          '15/08/2032', 'CCCD', 'P01234567', '12/04/2022', 'Cục Quản lý Xuất nhập cảnh', '12/04/2032',
          '12/12', 'Đại học', 'Đại học Kinh Tế Quốc Dân', 'Quản trị Kinh doanh', 'Quản trị Nhân lực',
          2014, 'Giỏi', '02438888999', '02437654321', '', 'annguyen92@gmail.com', '', 'an.nguyen.hr',
          'facebook.com/annv92', 'Số 12 Phố Huế, P. Hàng Bài, Q. Hoàn Kiếm, Hà Nội', 'Việt Nam',
          'Hà Nội', 'Hoàn Kiếm', 'Hàng Bài', 'Số 12 Phố Huế', 'HK-001928', 'HGD-019283', 'Có',
          'Tòa nhà Trung Hải, Cầu Giấy, Hà Nội', 'Việt Nam', 'Hà Nội', 'Cầu Giấy', 'Dịch Vọng Hậu',
          'Phố Duy Tân', 'Nguyễn Thị Bình', 'Vợ', '0912345678', '02437654321', 'binhnt@gmail.com',
          'Số 12 Phố Huế, P. Hàng Bài, Q. Hoàn Kiếm, Hà Nội', 'an.nv@trunghaico.vn', 'Kích hoạt',
          'Đã kích hoạt', 'Hợp lệ', '01/05/2026', '', 'Chuyên viên Nhân sự cấp cao', '2001', 'Cấp 3',
          'Bậc 3', '', '', 'Không', 'Huỳnh Thanh Long', 'Trụ sở Tổng công ty - Tòa nhà Trung Hải, Hà Nội',
          'LD-00123', 2.34, '01/01/2026', 'Huỳnh Thanh Long', 'Trần Minh Đức', 16000000, 16000000,
          '1903456789012', 'Vietcombank', 'Chi nhánh Hà Nội', '01/03/2026',
          'Lê Thị Thu', '0123456789', 'VietnamWorks', '0123456789', '001', 'DN4010123456789',
          'Bệnh viện Bạch Mai - Hà Nội', 'Khối Văn phòng Tổng công ty', positions[0]?.position_id || 'POS-01',
          depts[0]?.department_id || 'HR'
        ],
        [
          'TH-2002', 'Trần Thị Mai', 'Nữ', '20/11/1995', '0912987654', 'mai.tt@trunghaico.vn',
          positions[1]?.position_name || 'Kế toán viên', depts[1]?.department_name || 'Phòng Kế Toán Tài Chính',
          '15/02/2026', '15/04/2026', 'Hợp đồng thử việc', 'Đang làm việc', '1 năm', 'Có',
          '0912987654', '', '', '20/11/2055', 'Thử việc', '2', 15000000, 'Có', 'Đà Nẵng',
          'Quảng Nam', 'Độc thân', '8590123456', 'Công chức', 'Nhân viên', 'Kinh', 'Không',
          'Việt Nam', '034195009876', '15/12/2022', 'Cục Cảnh sát Quản lý hành chính về trật tự xã hội',
          '20/11/2035', 'CCCD', '', '', '', '', '12/12', 'Đại học', 'Đại học Kinh Tế - ĐH Đà Nẵng',
          'Tài chính Kế toán', 'Kế toán Tổng hợp', 2017, 'Khá', '02363888999', '', '',
          'maitt95@yahoo.com', '', 'mai.tran.acc', 'facebook.com/maitt95',
          'Số 45 Lê Duẩn, P. Hải Châu 1, Q. Hải Châu, TP. Đà Nẵng', 'Việt Nam', 'Đà Nẵng', 'Hải Châu',
          'Hải Châu 1', 'Số 45 Lê Duẩn', 'HK-048123', 'HGD-048567', 'Không',
          'Số 45 Lê Duẩn, P. Hải Châu 1, Q. Hải Châu, TP. Đà Nẵng', 'Việt Nam', 'Đà Nẵng', 'Hải Châu',
          'Hải Châu 1', 'Số 45 Lê Duẩn', 'Trần Văn Cường', 'Bố', '0905123456', '02363888999',
          'cuongtv@gmail.com', 'Số 45 Lê Duẩn, P. Hải Châu 1, Q. Hải Châu, TP. Đà Nẵng',
          'mai.tt@trunghaico.vn', 'Kích hoạt', 'Chưa kích hoạt', 'Chờ duyệt', '15/02/2026', '15/04/2026',
          'Chuyên viên Kế toán Tổng hợp', '2002', 'Cấp 3', 'Bậc 2', '', '', 'Không', 'Huỳnh Thanh Long',
          'Chi nhánh Miền Trung - Đà Nẵng', 'LD-00124', 2.10, '', 'Huỳnh Thanh Long', '', 12000000, 12000000,
          '1029384756', 'Techcombank', 'Chi nhánh Đà Nẵng', '15/02/2026',
          'Lê Thị Thu', '0481234567', 'TopCV', '0481234567', '048', 'DN4480481234567',
          'Bệnh viện Đa khoa Đà Nẵng', 'Khối Kế toán Tài chính', positions[1]?.position_id || 'POS-02',
          depts[1]?.department_id || 'KT'
        ]
      ];

      const ws1 = XLSX.utils.aoa_to_sheet(sampleRows);
      ws1['!cols'] = sampleHeaders.map(() => ({ wch: 20 }));
      ws1['!cols'][0] = { wch: 16 };  // Mã NV
      ws1['!cols'][1] = { wch: 24 };  // Họ tên
      ws1['!cols'][5] = { wch: 28 };  // Email
      ws1['!cols'][54] = { wch: 40 }; // Thường trú
      ws1['!cols'][63] = { wch: 40 }; // Nơi ở
      ws1['!cols'][31] = { wch: 18 }; // CMND

      XLSX.utils.book_append_sheet(wb, ws1, 'Danh_Sach_Nhan_Su');

      // Sheet 2: Danh_Muc_Tham_Chieu
      const refData = [
        ['=== DANH MỤC THAM CHIẾU HỆ THỐNG QUẢN TRỊ NHÂN SỰ TRUNG HẢI ===', ''],
        ['(Sử dụng các giá trị chuẩn trong sheet này để tra cứu thông tin)', ''],
        ['', ''],
        ['1. DANH SÁCH MÃ ĐƠN VỊ CÔNG TÁC (*)', 'TÊN ĐƠN VỊ CÔNG TÁC'],
        ...(depts.length > 0 ? depts.map(d => [d.department_id, d.department_name]) : [['HR', 'Phòng Hành Chính Nhân Sự'], ['KT', 'Phòng Kế Toán Tài Chính']]),
        ['', ''],
        ['2. DANH SÁCH MÃ VỊ TRÍ CÔNG VIỆC (*)', 'TÊN VỊ TRÍ CÔNG VIỆC'],
        ...(positions.length > 0 ? positions.map(p => [p.position_id, p.position_name]) : [['POS-01', 'Chuyên viên Nhân sự'], ['POS-02', 'Kế toán viên']]),
        ['', ''],
        ['3. CẤP BẬC NHÂN SỰ', 'MÔ TẢ CẤP BẬC'],
        ['Cấp 1', 'Ban Lãnh đạo / Giám đốc'],
        ['Cấp 2', 'Quản lý Cấp trung / Trưởng phòng'],
        ['Cấp 3', 'Chuyên viên / Nhân viên Nghiệp vụ'],
        ['Cấp 4', 'Nhân viên Sơ cấp / Tập sự'],
        ['Cấp 5', 'Công nhân / Lao động trực tiếp'],
        ['', ''],
        ['4. TÍNH CHẤT LAO ĐỘNG HỢP LỆ (*)', 'GHI CHÚ ÁP DỤNG'],
        ['Chính thức', 'Đã ký hợp đồng lao động chính thức'],
        ['Thử việc', 'Đang trong thời gian thử việc'],
        ['Học việc', 'Đang trong thời gian học việc'],
        ['Thực tập', 'Sinh viên thực tập tốt nghiệp'],
        ['Thời vụ', 'Hợp đồng theo mùa vụ / dự án ngắn hạn'],
        ['', ''],
        ['5. TRẠNG THÁI LAO ĐỘNG (*)', 'Ý NGHĨA'],
        ['Đang làm việc', 'Đang công tác hoạt động bình thường'],
        ['Đã nghỉ việc', 'Đã thôi việc, thanh lý hợp đồng lao động'],
        ['Nghỉ thai sản', 'Đang nghỉ chế độ thai sản'],
        ['Nghỉ không lương', 'Đang tạm hoãn hợp đồng lao động'],
        ['', ''],
        ['6. LOẠI HỢP ĐỒNG LAO ĐỘNG (*)', 'GHI CHÚ'],
        ['Hợp đồng lao động không xác định thời hạn', 'Hợp đồng không thời hạn'],
        ['Hợp đồng lao động xác định thời hạn (12 tháng)', 'Hợp đồng 12 tháng'],
        ['Hợp đồng lao động xác định thời hạn (24 tháng)', 'Hợp đồng 24 tháng'],
        ['Hợp đồng lao động xác định thời hạn (36 tháng)', 'Hợp đồng 36 tháng'],
        ['Hợp đồng thử việc', 'Hợp đồng thử việc 1 - 2 tháng'],
        ['Hợp đồng lao động thời vụ', 'Hợp đồng ngắn hạn dưới 12 tháng'],
        ['', ''],
        ['7. TRÌNH ĐỘ ĐÀO TẠO & HÌNH THỨC', 'HÌNH THỨC'],
        ['Đại học', 'Chính quy'],
        ['Thạc sĩ', 'Tại chức'],
        ['Tiến sĩ', 'Liên thông'],
        ['Cao đẳng', 'Từ xa / Vừa học vừa làm'],
        ['Trung cấp', ''],
        ['THPT', ''],
        ['', ''],
        ['8. DANH SÁCH NGÂN HÀNG PHỔ BIẾN', ''],
        ['Vietcombank', 'MBBank'],
        ['Techcombank', 'BIDV'],
        ['VietinBank', 'ACB'],
        ['Agribank', 'VPBank'],
        ['TPBank', 'Sacombank'],
        ['', ''],
        ['9. QUAN HỆ KHẨN CẤP', ''],
        ['Vợ', 'Chồng'],
        ['Bố', 'Mẹ'],
        ['Anh trai', 'Chị gái'],
        ['Em trai', 'Em gái'],
        ['Người thân khác', '']
      ];

      const ws2 = XLSX.utils.aoa_to_sheet(refData);
      ws2['!cols'] = [{ wch: 45 }, { wch: 55 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Danh_Muc_Tham_Chieu');

      XLSX.writeFile(wb, 'Mau_Nhap_Lieu_Nhan_Su_TRUNGHAI.xlsx');
      utils.showToast('Đã tải xuống file mẫu Excel thành công!', 'success');
    } catch (err) {
      console.error('Lỗi tải file mẫu:', err);
      utils.showToast('Không thể tải file mẫu Excel: ' + err.message, 'error');
    }
  },


  handleFileSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (file) {
      this.processExcelFile(file);
    }
  },

  findBestEmployeeSheet(workbook) {
    let bestSheet = workbook.SheetNames[0];
    let maxScore = -1;

    for (const sName of workbook.SheetNames) {
      const ws = workbook.Sheets[sName];
      if (!ws) continue;
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }).slice(0, 10);
      let sheetScore = 0;

      for (const row of rows) {
        if (!Array.isArray(row)) continue;
        const rowText = row.map(c => this.cleanKey(c)).join(' ');
        let matches = 0;
        if (rowText.includes('hovaten') || rowText.includes('hoten') || rowText.includes('fullname')) matches += 15;
        if (rowText.includes('manhanvien') || rowText.includes('employeeid') || rowText.includes('manv')) matches += 15;
        if (rowText.includes('phongban') || rowText.includes('donvicongtac') || rowText.includes('department')) matches += 8;
        if (rowText.includes('chucdanh') || rowText.includes('vitricongviec') || rowText.includes('position')) matches += 8;
        if (rowText.includes('socmnd') || rowText.includes('socccd') || rowText.includes('cccd') || rowText.includes('cmnd')) matches += 8;
        if (rowText.includes('dtdidong') || rowText.includes('sdt') || rowText.includes('mobile') || rowText.includes('phone')) matches += 8;
        if (rowText.includes('email') || rowText.includes('emailcoquan')) matches += 8;

        if (matches > sheetScore) sheetScore = matches;
      }

      const normName = this.cleanKey(sName);
      if (normName.includes('masterprofile') || normName.includes('00masterprofiles')) sheetScore += 25;
      if (normName.includes('nhansu') || normName.includes('nhanvien') || normName.includes('employee')) sheetScore += 20;
      if (normName.includes('danhsach')) sheetScore += 12;

      if (sheetScore > maxScore) {
        maxScore = sheetScore;
        bestSheet = sName;
      }
    }

    return bestSheet;
  },

  parseSheetWithSmartHeaders(worksheet) {
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    if (!rawRows || rawRows.length === 0) return [];

    let headerRowIdx = 0;
    let maxScore = -1;

    for (let r = 0; r < Math.min(10, rawRows.length); r++) {
      const row = rawRows[r];
      if (!Array.isArray(row)) continue;
      let score = 0;
      const text = row.map(c => this.cleanKey(c)).join(' ');
      if (text.includes('hovaten') || text.includes('hoten') || text.includes('fullname')) score += 15;
      if (text.includes('manhanvien') || text.includes('employeeid') || text.includes('manv')) score += 15;
      if (text.includes('gioitinh') || text.includes('gender')) score += 8;
      if (text.includes('phongban') || text.includes('donvi') || text.includes('department')) score += 8;
      if (text.includes('chucdanh') || text.includes('vitri') || text.includes('position')) score += 8;
      if (text.includes('cccd') || text.includes('cmnd')) score += 8;

      if (score > maxScore) {
        maxScore = score;
        headerRowIdx = r;
      }
    }

    const headers = rawRows[headerRowIdx].map(h => String(h || '').trim());
    const dataRows = [];
    for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!Array.isArray(row) || row.every(c => c === '')) continue;
      const obj = {};
      headers.forEach((h, colIdx) => {
        if (h) obj[h] = row[colIdx] !== undefined ? row[colIdx] : '';
      });
      dataRows.push(obj);
    }
    return dataRows;
  },

  cleanKey(str) {
    return (str || '')
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  },

  getField(normRow, ...aliases) {
    for (const a of aliases) {
      const target = this.cleanKey(a);
      if (normRow[target] !== undefined && normRow[target] !== null && String(normRow[target]).trim() !== '') {
        return String(normRow[target]).trim();
      }
    }
    return '';
  },

  formatDate(val) {
    if (!val) return '';
    if (typeof utils !== 'undefined' && utils.formatDate) {
      const res = utils.formatDate(val);
      return (res === '-') ? '' : res;
    }
    let num = null;
    if (typeof val === 'number') num = val;
    else if (typeof val === 'string' && /^\d{5}$/.test(val.trim())) num = Number(val.trim());
    if (num !== null && !isNaN(num) && num >= 10000 && num <= 65000) {
      const d = new Date(Math.round((num - 25569) * 86400 * 1000));
      if (!isNaN(d.getTime())) {
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = d.getUTCFullYear();
        return `${day}/${month}/${year}`;
      }
    }
    return String(val).trim();
  },

  onSheetChange(newSheetName) {
    if (!this.currentWorkbook) return;
    this.selectedSheetName = newSheetName;
    const worksheet = this.currentWorkbook.Sheets[newSheetName];
    if (!worksheet) return;

    const jsonRows = this.parseSheetWithSmartHeaders(worksheet);
    if (!jsonRows || jsonRows.length === 0) {
      utils.showToast(`Sheet "${newSheetName}" không có dữ liệu!`, 'warning');
      return;
    }

    const activeSheetEl = document.getElementById('import-active-sheet-name');
    if (activeSheetEl) activeSheetEl.textContent = newSheetName;

    this.rawJsonRows = jsonRows;
    this.parseAndValidate(jsonRows);
  },

  processExcelFile(file) {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      utils.showToast('Vui lòng chọn file định dạng Excel (.xlsx hoặc .xls)', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: false });
        this.currentWorkbook = workbook;

        const bestSheet = this.findBestEmployeeSheet(workbook);
        this.selectedSheetName = bestSheet;

        // Render sheet selector
        const banner = document.getElementById('import-sheet-banner');
        const activeSheetEl = document.getElementById('import-active-sheet-name');
        const selectEl = document.getElementById('import-sheet-select');
        const selectWrapper = document.getElementById('import-sheet-selector-wrapper');

        if (banner) banner.style.display = 'flex';
        if (activeSheetEl) activeSheetEl.textContent = bestSheet;
        if (selectEl) {
          selectEl.innerHTML = workbook.SheetNames.map(s => `<option value="${s}" ${s === bestSheet ? 'selected' : ''}>${s}</option>`).join('');
        }
        if (selectWrapper) {
          selectWrapper.style.display = workbook.SheetNames.length > 1 ? 'flex' : 'none';
        }

        const worksheet = workbook.Sheets[bestSheet];
        const jsonRows = this.parseSheetWithSmartHeaders(worksheet);
        if (!jsonRows || jsonRows.length === 0) {
          utils.showToast(`Sheet "${bestSheet}" không có dữ liệu nhân sự!`, 'warning');
          return;
        }

        this.rawJsonRows = jsonRows;
        this.parseAndValidate(jsonRows);
      } catch (err) {
        console.error('Error parsing Excel:', err);
        utils.showToast('Không thể đọc file Excel: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  },

  reValidate() {
    if (this.rawJsonRows && this.rawJsonRows.length > 0) {
      this.parseAndValidate(this.rawJsonRows);
    }
  },

  parseAndValidate(rawRows) {
    this.parsedEmployees = [];
    this.validEmployees = [];
    this.overwriteEmployees = [];
    this.conflictEmployees = [];

    const overwrite = document.getElementById('import-chk-overwrite')?.checked ?? true;

    // Build DB Lookup Maps for Primary / Unique Key checking
    const dbEmpById = new Map();
    const dbEmpByTimeCode = new Map();
    const dbEmpByIdNumber = new Map();
    const dbEmpByEmail = new Map();

    (appData.employees || []).forEach(e => {
      if (e.employee_id) dbEmpById.set(e.employee_id.toUpperCase(), e);
      if (e.time_attendance_code) dbEmpByTimeCode.set(e.time_attendance_code.toString().trim(), e);
    });

    (appData.identity || []).forEach(i => {
      if (i.id_number) dbEmpByIdNumber.set(i.id_number.toString().trim(), i);
    });

    (appData.contacts || []).forEach(c => {
      if (c.work_email) dbEmpByEmail.set(c.work_email.toLowerCase().trim(), c);
    });

    // 1. Initial normalizations & collection for internal duplication check
    const normalizedRows = [];
    const fileEmpIdCounts = new Map();
    const fileIdNumCounts = new Map();
    const fileEmailCounts = new Map();
    const fileTimeCodeCounts = new Map();

    rawRows.forEach((row, idx) => {
      const normMap = {};
      Object.keys(row).forEach(key => {
        const ck = this.cleanKey(key);
        if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
          normMap[ck] = String(row[key]).trim();
        }
      });

      let fullName = this.getField(normMap, 'Họ và tên', 'Họ và tên (*)', 'Họ tên', 'full_name', 'Tên nhân viên', 'Họ tên nhân viên', 'Full Name', 'Name', 'fullname');
      if (!fullName) {
        // Fallback: merge Họ / Họ và tên đệm + Tên
        const ho = this.getField(normMap, 'Họ và tên đệm', 'Họ và đệm', 'Họ đệm', 'Họ');
        const ten = this.getField(normMap, 'Tên');
        if (ho || ten) {
          fullName = `${ho} ${ten}`.trim();
        }
      }

      const empId = this.getField(normMap, 'Mã nhân viên', 'Mã nhân viên (*)', 'Mã NV', 'employee_id', 'Mã số NV', 'Staff ID', 'ID').toUpperCase();
      if (!fullName && empId) {
        const existing = dbEmpById.get(empId);
        if (existing) fullName = existing.full_name;
      }
      if (!fullName && !empId) return; // Skip completely empty rows
      if (!fullName && empId) fullName = `Nhân sự ${empId}`;
      const timeAttendanceCode = this.getField(normMap, 'Mã chấm công', 'time_attendance_code');
      const idNumber = this.getField(normMap, 'Số CMND', 'Số CCCD / CMND', 'Số CCCD / Hộ chiếu', 'Số CCCD', 'CCCD', 'CMND', 'id_number', 'Số định danh');
      const email = this.getField(normMap, 'Email cơ quan', 'Email công việc', 'Email', 'work_email').toLowerCase();

      if (empId) {
        fileEmpIdCounts.set(empId, (fileEmpIdCounts.get(empId) || 0) + 1);
      }
      if (idNumber) {
        fileIdNumCounts.set(idNumber, (fileIdNumCounts.get(idNumber) || 0) + 1);
      }
      if (email && email.includes('@')) {
        fileEmailCounts.set(email, (fileEmailCounts.get(email) || 0) + 1);
      }
      if (timeAttendanceCode) {
        fileTimeCodeCounts.set(timeAttendanceCode, (fileTimeCodeCounts.get(timeAttendanceCode) || 0) + 1);
      }

      normalizedRows.push({ rowIdx: idx + 1, normMap, rawRow: row, empId, timeAttendanceCode, idNumber, email, fullName });
    });

    // 2. Comprehensive validation pass
    normalizedRows.forEach(({ rowIdx, normMap, rawRow, empId, timeAttendanceCode, idNumber, email, fullName }) => {
      const gender = this.getField(normMap, 'Giới tính', 'Giới tính (*)', 'gender', 'Phái') || 'Nam';
      const dob = this.formatDate(this.getField(normMap, 'Ngày sinh', 'Ngày sinh (DD/MM/YYYY)', 'date_of_birth', 'DOB'));
      const birthPlace = this.getField(normMap, 'Nơi sinh', 'birth_place');
      const nativePlace = this.getField(normMap, 'Nguyên quán', 'native_place');
      const ethnicity = this.getField(normMap, 'Dân tộc', 'ethnicity') || 'Kinh';
      const religion = this.getField(normMap, 'Tôn giáo', 'religion') || 'Không';
      const nationality = this.getField(normMap, 'Quốc tịch', 'nationality') || 'Việt Nam';
      const maritalStatus = this.getField(normMap, 'Tình trạng hôn nhân', 'marital_status') || 'Độc thân';
      const childrenCount = parseInt(this.getField(normMap, 'Số con', 'children_count') || 0, 10) || 0;

      const dept = this.getField(normMap, 'Mã đơn vị công tác', 'Đơn vị công tác', 'Mã phòng ban', 'Phòng/Ban', 'department_id', 'Phòng ban', 'Bộ phận', 'Đơn vị');
      const pos = this.getField(normMap, 'Mã vị trí công việc', 'Vị trí công việc', 'Mã chức danh / Vị trí', 'Mã chức danh', 'Chức danh', 'Vị trí', 'position_id', 'Chức vụ');
      const jobRank = this.getField(normMap, 'Bậc', 'Cấp bậc nhân sự', 'Cấp bậc', 'job_rank') || 'Bậc 3';
      const professionalTitle = this.getField(normMap, 'Chức danh', 'Chức danh chuyên môn', 'job_title') || pos || 'Chuyên viên';
      const workLocation = this.getField(normMap, 'Địa điểm làm việc', 'work_location') || 'Trụ sở Tổng công ty - Tòa nhà Trung Hải, Hà Nội';
      const workArea = this.getField(normMap, 'Khu vực làm việc', 'Khối / Khu vực làm việc', 'Khối làm việc', 'work_area') || 'Khối Văn phòng Tổng công ty';
      const directMgrId = this.getField(normMap, 'Mã quản lý trực tiếp', 'direct_manager_id');
      const directMgrName = this.getField(normMap, 'Quản lý trực tiếp', 'Họ tên quản lý trực tiếp', 'direct_manager_name');
      const indirectMgrId = this.getField(normMap, 'Mã quản lý gián tiếp', 'indirect_manager_id');
      const indirectMgrName = this.getField(normMap, 'Quản lý gián tiếp', 'Họ tên quản lý gián tiếp', 'indirect_manager_name');

      const laborNature = this.getField(normMap, 'Tính chất lao động', 'Tính chất', 'labor_nature') || 'Chính thức';
      const status = this.getField(normMap, 'Trạng thái lao động', 'Trạng thái làm việc', 'Trạng thái', 'employment_status') || 'Đang làm việc';
      const startDate = this.formatDate(this.getField(normMap, 'Ngày bắt đầu làm việc', 'Ngày thử việc', 'Ngày học việc', 'Ngày chính thức', 'Ngày vào làm', 'start_date')) || new Date().toISOString().split('T')[0];
      const endDate = this.formatDate(this.getField(normMap, 'Ngày hết hiệu lực', 'Ngày kết thúc (HĐ/Nghỉ)', 'Ngày kết thúc', 'end_date')) || 'Không xác định';
      const contractType = this.getField(normMap, 'Loại hợp đồng', 'contract_type') || 'Hợp đồng lao động không xác định thời hạn';
      const trialStartDate = this.formatDate(this.getField(normMap, 'Ngày thử việc', 'Ngày bắt đầu thử việc', 'trial_start_date')) || startDate;
      const officialDate = this.formatDate(this.getField(normMap, 'Ngày chính thức', 'Ngày ký HĐ chính thức', 'official_date')) || startDate;

      const phone = this.getField(normMap, 'ĐT di động', 'Số ĐT di động', 'Số điện thoại', 'Điện thoại', 'mobile_phone', 'SĐT');
      const homePhone = this.getField(normMap, 'ĐT nhà riêng', 'Số ĐT bàn / Khác', 'Số ĐT bàn', 'home_phone');
      const personalEmail = this.getField(normMap, 'Email cá nhân', 'personal_email');
      const permAddress = this.getField(normMap, 'Hộ khẩu thường trú', 'Địa chỉ thường trú', 'Thường trú', 'permanent_address_full');
      const currAddress = this.getField(normMap, 'Chỗ ở hiện nay', 'Địa chỉ tạm trú / Hiện tại', 'Địa chỉ hiện tại', 'Địa chỉ tạm trú', 'current_address_full') || permAddress;

      const idIssueDate = this.formatDate(this.getField(normMap, 'Ngày cấp giấy tờ', 'Ngày cấp CCCD (DD/MM/YYYY)', 'Ngày cấp CCCD', 'Ngày cấp', 'id_issue_date'));
      const idIssuePlace = this.getField(normMap, 'Nơi cấp giấy tờ', 'Nơi cấp CCCD', 'Nơi cấp', 'id_issue_place') || 'Cục Cảnh sát Quản lý hành chính về trật tự xã hội';
      const idExpiryDate = this.formatDate(this.getField(normMap, 'Ngày hết hạn giấy tờ', 'Ngày hết hạn CCCD', 'id_expiry_date'));
      const passportNumber = this.getField(normMap, 'Số Hộ chiếu', 'Số hộ chiếu (Passport)', 'Số hộ chiếu', 'passport_number');
      const passportIssueDate = this.formatDate(this.getField(normMap, 'Ngày cấp Hộ chiếu', 'Ngày cấp hộ chiếu', 'passport_issue_date'));
      const taxCode = this.getField(normMap, 'MST cá nhân', 'Mã số thuế cá nhân', 'Mã số thuế', 'tax_code');

      const salaryGrade = parseInt(this.getField(normMap, 'Bậc lương', 'Bậc', 'salary_grade') || 3, 10) || 3;
      const baseSalary = parseFloat((this.getField(normMap, 'Lương cơ bản', 'Lương cơ bản (VNĐ)', 'base_salary') || '0').replace(/[^0-9.-]+/g, '')) || 0;
      const salaryRate = this.getField(normMap, 'Tỷ lệ hưởng lương (%)', 'Tỷ lệ hưởng lương', 'salary_rate');
      const totalSalary = parseFloat((this.getField(normMap, 'Tổng lương', 'Tổng lương / Thu nhập (VNĐ)', 'total_salary') || '0').replace(/[^0-9.-]+/g, '')) || 0;
      const insuranceSalary = parseFloat((this.getField(normMap, 'Lương đóng BH', 'Lương đóng BHXH (VNĐ)', 'Lương đóng BHXH', 'insurance_salary') || '0').replace(/[^0-9.-]+/g, '')) || 0;
      const bankAccount = this.getField(normMap, 'TK ngân hàng', 'Tài khoản ngân hàng', 'Số tài khoản ngân hàng', 'Số tài khoản', 'STK', 'bank_account_number');
      const bankName = this.getField(normMap, 'Ngân hàng', 'Mở tại ngân hàng', 'Tên ngân hàng', 'bank_name') || 'Vietcombank';
      const bankBranch = this.getField(normMap, 'Chi nhánh', 'Chi nhánh ngân hàng', 'bank_branch') || 'Chi nhánh Hà Nội';

      const hasInsurance = this.getField(normMap, 'Tham gia bảo hiểm', 'Tham gia BHXH', 'has_insurance') || 'Có';
      const socialInsuranceBook = this.getField(normMap, 'Số sổ BHXH', 'Mã số BHXH', 'Số sổ / Mã số BHXH', 'social_insurance_book_no');
      const insuranceJoinDate = this.formatDate(this.getField(normMap, 'Ngày tham gia BH', 'Ngày tham gia BHXH', 'insurance_join_date')) || startDate;
      const hospitalRegistered = this.getField(normMap, 'Nơi đăng ký KCB', 'Nơi ĐK khám chữa bệnh ban đầu', 'Nơi ĐK KCB ban đầu', 'hospital_registered') || 'Bệnh viện Bạch Mai - Hà Nội';
      const unionMember = this.getField(normMap, 'Tham gia công đoàn', 'Đoàn viên công đoàn', 'union_member') || 'Đoàn viên';

      const taxRate = this.getField(normMap, 'Thuế suất', 'tax_rate') || 'Theo biểu lũy tiến';
      const dependentsCount = parseInt(this.getField(normMap, 'Số người phụ thuộc', 'dependents_count') || 0, 10) || 0;
      const personalDeduction = this.getField(normMap, 'Giảm trừ bản thân', 'personal_deduction') || 'Có';
      const empBhxhRate = this.getField(normMap, 'Tỷ lệ đóng BHXH của nhân viên (%)', 'Tỷ lệ đóng BHXH của NV (%)', 'emp_bhxh_rate') || '8%';
      const empBhytRate = this.getField(normMap, 'Tỷ lệ đóng BHYT của nhân viên (%)', 'Tỷ lệ đóng BHYT của NV (%)', 'emp_bhyt_rate') || '1.5%';
      const empBhtnRate = this.getField(normMap, 'Tỷ lệ đóng BHTN của nhân viên (%)', 'Tỷ lệ đóng BHTN của NV (%)', 'emp_bhtn_rate') || '1%';
      const compBhxhRate = this.getField(normMap, 'Tỷ lệ đóng BHXH của doanh nghiệp (%)', 'Tỷ lệ đóng BHXH của DN (%)', 'comp_bhxh_rate') || '17.5%';
      const compBhytRate = this.getField(normMap, 'Tỷ lệ đóng BHYT của doanh nghiệp (%)', 'Tỷ lệ đóng BHYT của DN (%)', 'comp_bhyt_rate') || '3%';
      const compBhtnRate = this.getField(normMap, 'Tỷ lệ đóng BHTN của doanh nghiệp (%)', 'Tỷ lệ đóng BHTN của DN (%)', 'comp_bhtn_rate') || '1%';
      const payslipPassword = this.getField(normMap, 'Mật khẩu phiếu lương', 'payslip_password');

      const eduLevel = this.getField(normMap, 'Trình độ đào tạo', 'Trình độ học vấn', 'Trình độ', 'education_level') || 'Đại học';
      const degreeType = this.getField(normMap, 'Hình thức đào tạo', 'degree_type') || 'Chính quy';
      const institution = this.getField(normMap, 'Nơi đào tạo', 'Trường / Cơ sở đào tạo', 'Trường', 'institution') || 'Đại học';
      const eduMajor = this.getField(normMap, 'Chuyên ngành', 'Chuyên ngành đào tạo', 'major');
      const gradYear = parseInt(this.getField(normMap, 'Năm tốt nghiệp', 'graduation_year') || 2020, 10) || 2020;
      const gradClassification = this.getField(normMap, 'Xếp loại', 'Xếp loại tốt nghiệp', 'classification') || 'Khá';
      const otherCerts = this.getField(normMap, 'Bằng cấp chuyên môn khác & Chứng chỉ', 'Bằng cấp khác', 'other_certificates');

      const emergName = this.getField(normMap, 'Họ và tên (LHKC)', 'Họ tên người liên hệ khẩn cấp', 'Người liên hệ khẩn cấp', 'Người khẩn cấp', 'emergency_name');
      const emergRelation = this.getField(normMap, 'Quan hệ (LHKC)', 'Mối quan hệ khẩn cấp', 'Quan hệ khẩn cấp', 'Quan hệ', 'emergency_relation') || 'Người thân';
      const emergPhone = this.getField(normMap, 'ĐT di động (LHKC)', 'Số ĐT khẩn cấp', 'SĐT khẩn cấp', 'emergency_phone');

      const errors = [];
      const warnings = [];
      let rowStatus = 'VALID'; // 'VALID' | 'OVERWRITE' | 'CONFLICT'

      // Check 1: Required Fields
      const isSelectedScope = this.scopeMode === 'selected';
      if (!fullName) errors.push('Thiếu Họ và tên (*)');
      if (!isSelectedScope) {
        if (!dept) warnings.push('Chưa có Mã phòng ban (sẽ dùng mặc định)');
        if (!pos) warnings.push('Chưa có Mã vị trí (sẽ dùng mặc định)');
      }

      // Check 2: Internal Duplicate in File
      if (empId && fileEmpIdCounts.get(empId) > 1) {
        errors.push(`Trùng Mã nhân viên ${empId} với dòng khác trong file Excel`);
      }
      if (idNumber && fileIdNumCounts.get(idNumber) > 1) {
        errors.push(`Trùng số CCCD ${idNumber} với dòng khác trong file Excel`);
      }
      if (email && fileEmailCounts.get(email) > 1) {
        errors.push(`Trùng Email ${email} với dòng khác trong file Excel`);
      }

      // Check 3: Cross-check against Database Records
      const dbEmpWithId = empId ? dbEmpById.get(empId) : null;
      if (dbEmpWithId) {
        if (overwrite || isSelectedScope) {
          rowStatus = 'OVERWRITE';
        } else {
          errors.push(`Mã NV ${empId} đã tồn tại trong hệ thống (Đang tắt chế độ ghi đè)`);
        }
      }

      // Check 4: CCCD uniqueness against DB
      if (idNumber) {
        const existingCCCD = dbEmpByIdNumber.get(idNumber);
        if (existingCCCD && (!empId || existingCCCD.employee_id !== empId)) {
          errors.push(`Số CCCD ${idNumber} trùng với NV ${existingCCCD.employee_id} (${existingCCCD.full_name}) trong hệ thống`);
        }
      }

      // Check 5: Work Email uniqueness against DB
      if (email && email.includes('@')) {
        const existingEmail = dbEmpByEmail.get(email);
        if (existingEmail && (!empId || existingEmail.employee_id !== empId)) {
          errors.push(`Email ${email} trùng với NV ${existingEmail.employee_id} (${existingEmail.full_name}) trong hệ thống`);
        }
      }

      // Final status assignment
      if (errors.length > 0) {
        rowStatus = 'CONFLICT';
      } else if (rowStatus !== 'OVERWRITE') {
        rowStatus = 'VALID';
      }

      const item = {
        stt: rowIdx,
        employee_id: empId,
        time_attendance_code: timeAttendanceCode,
        full_name: fullName,
        gender,
        date_of_birth: dob,
        birth_place: birthPlace,
        native_place: nativePlace,
        ethnicity,
        religion,
        nationality,
        marital_status: maritalStatus,
        children_count: childrenCount,
        department_id: dept,
        position_id: pos,
        job_rank: jobRank,
        job_title: professionalTitle,
        work_location: workLocation,
        work_area: workArea,
        direct_manager_id: directMgrId,
        direct_manager_name: directMgrName,
        indirect_manager_id: indirectMgrId,
        indirect_manager_name: indirectMgrName,
        labor_nature: laborNature,
        employment_status: status,
        start_date: startDate,
        end_date: endDate,
        contract_type: contractType,
        trial_start_date: trialStartDate,
        official_date: officialDate,
        mobile_phone: phone,
        home_phone: homePhone,
        work_email: email,
        personal_email: personalEmail,
        permanent_address_full: permAddress,
        current_address_full: currAddress,
        id_number: idNumber,
        id_issue_date: idIssueDate,
        id_issue_place: idIssuePlace,
        id_expiry_date: idExpiryDate,
        passport_number: passportNumber,
        passport_issue_date: passportIssueDate,
        tax_code: taxCode,
        salary_grade: salaryGrade,
        base_salary: baseSalary,
        salary_rate: salaryRate,
        total_salary: totalSalary,
        insurance_salary: insuranceSalary,
        bank_account_number: bankAccount,
        bank_name: bankName,
        bank_branch: bankBranch,
        has_insurance: hasInsurance,
        social_insurance_book_no: socialInsuranceBook,
        insurance_join_date: insuranceJoinDate,
        hospital_registered: hospitalRegistered,
        union_member: unionMember,
        tax_rate: taxRate,
        dependents_count: dependentsCount,
        personal_deduction: personalDeduction,
        emp_bhxh_rate: empBhxhRate,
        emp_bhyt_rate: empBhytRate,
        emp_bhtn_rate: empBhtnRate,
        comp_bhxh_rate: compBhxhRate,
        comp_bhyt_rate: compBhytRate,
        comp_bhtn_rate: compBhtnRate,
        payslip_password: payslipPassword,
        education_level: eduLevel,
        degree_type: degreeType,
        institution: institution,
        major: eduMajor,
        graduation_year: gradYear,
        classification: gradClassification,
        other_certificates: otherCerts,
        emergency_name: emergName,
        emergency_relation: emergRelation,
        emergency_phone: emergPhone,
        status: rowStatus,
        errors,
        warnings
      };

      this.parsedEmployees.push(item);
      if (rowStatus === 'VALID') {
        this.validEmployees.push(item);
      } else if (rowStatus === 'OVERWRITE') {
        this.overwriteEmployees.push(item);
      } else {
        this.conflictEmployees.push(item);
      }
    });

    this.setStepUI(2);
    this.renderPreview();
  },

  setFilter(filter) {
    this.currentFilter = filter;
    this.renderPreviewTable();

    // Update active tab style
    ['all', 'valid', 'overwrite', 'conflict'].forEach(f => {
      const tab = document.getElementById(`import-tab-${f}`);
      if (tab) {
        if (f === filter) {
          tab.style.background = 'var(--primary-navy)';
          tab.style.color = '#FFFFFF';
          tab.style.borderColor = 'var(--primary-navy)';
        } else {
          tab.style.background = '#FFFFFF';
          tab.style.color = 'var(--text-secondary)';
          tab.style.borderColor = 'var(--border-color)';
        }
      }
    });
  },

  renderPreview() {
    const total = this.parsedEmployees.length;
    const validCount = this.validEmployees.length;
    const overwriteCount = this.overwriteEmployees.length;
    const conflictCount = this.conflictEmployees.length;

    // Summary Stat Badges
    const statSummary = document.getElementById('import-stat-summary');
    if (statSummary) {
      statSummary.innerHTML = `
        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
          <button type="button" id="import-tab-all" onclick="appImport.setFilter('all')" class="btn btn-sm" style="font-size: 12px; padding: 4px 10px; border-radius: 4px; ${this.currentFilter === 'all' ? 'background: var(--primary-navy); color: #fff; border-color: var(--primary-navy);' : 'background: #fff; color: var(--text-secondary); border: 1px solid var(--border-color);'}">
            <i class="fa-solid fa-list"></i> Tất cả (${total})
          </button>
          <button type="button" id="import-tab-valid" onclick="appImport.setFilter('valid')" class="btn btn-sm" style="font-size: 12px; padding: 4px 10px; border-radius: 4px; ${this.currentFilter === 'valid' ? 'background: #059669; color: #fff; border-color: #059669;' : 'background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0;'}">
            <i class="fa-solid fa-circle-check"></i> Hợp lệ mới (${validCount})
          </button>
          <button type="button" id="import-tab-overwrite" onclick="appImport.setFilter('overwrite')" class="btn btn-sm" style="font-size: 12px; padding: 4px 10px; border-radius: 4px; ${this.currentFilter === 'overwrite' ? 'background: #D97706; color: #fff; border-color: #D97706;' : 'background: #FFFBEB; color: #B45309; border: 1px solid #FDE68A;'}">
            <i class="fa-solid fa-arrows-rotate"></i> Trùng Mã NV (${overwriteCount})
          </button>
          <button type="button" id="import-tab-conflict" onclick="appImport.setFilter('conflict')" class="btn btn-sm" style="font-size: 12px; padding: 4px 10px; border-radius: 4px; ${this.currentFilter === 'conflict' ? 'background: #DC2626; color: #fff; border-color: #DC2626;' : 'background: #FEF2F2; color: #B91C1C; border: 1px solid #FECACA;'}">
            <i class="fa-solid fa-triangle-exclamation"></i> Xung đột / Lỗi (${conflictCount})
          </button>
        </div>
      `;
    }

    this.renderPreviewTable();
    this.updateSubmitButtonState();
  },

  renderPreviewTable() {
    const tbody = document.getElementById('import-preview-tbody');
    if (!tbody) return;

    let itemsToRender = this.parsedEmployees;
    if (this.currentFilter === 'valid') itemsToRender = this.validEmployees;
    else if (this.currentFilter === 'overwrite') itemsToRender = this.overwriteEmployees;
    else if (this.currentFilter === 'conflict') itemsToRender = this.conflictEmployees;

    if (itemsToRender.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 24px; color: var(--text-muted);">
            <i class="fa-solid fa-inbox" style="font-size: 24px; margin-bottom: 6px; display: block;"></i>
            Không có dòng dữ liệu nào trong danh mục này.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = itemsToRender.slice(0, 100).map(e => {
      let statusBadge = '';
      let errorMsgHtml = '';

      if (e.status === 'VALID') {
        statusBadge = '<span class="badge badge-active" style="font-size: 10.5px;"><i class="fa-solid fa-check"></i> Hợp lệ (Mới)</span>';
      } else if (e.status === 'OVERWRITE') {
        statusBadge = '<span class="badge" style="background: #FEF3C7; color: #92400E; font-size: 10.5px; border: 1px solid #FDE68A;"><i class="fa-solid fa-arrows-rotate"></i> Ghi đè (Mã NV)</span>';
      } else {
        statusBadge = '<span class="badge badge-resigned" style="font-size: 10.5px;"><i class="fa-solid fa-triangle-exclamation"></i> Xung đột Primary Key</span>';
      }

      if (e.errors && e.errors.length > 0) {
        errorMsgHtml = `<div style="font-size: 11px; color: #DC2626; margin-top: 4px; font-weight: 500;"><i class="fa-solid fa-circle-xmark"></i> ${e.errors.join('; ')}</div>`;
      } else if (e.warnings && e.warnings.length > 0) {
        errorMsgHtml = `<div style="font-size: 11px; color: #D97706; margin-top: 4px;"><i class="fa-solid fa-circle-exclamation"></i> ${e.warnings.join('; ')}</div>`;
      }

      const hasIdError = e.errors.some(err => err.toLowerCase().includes('mã') || err.toLowerCase().includes('id'));
      const hasCccdError = e.errors.some(err => err.toLowerCase().includes('cccd'));
      const hasEmailError = e.errors.some(err => err.toLowerCase().includes('email'));

      const idStyle = hasIdError ? 'color: #DC2626; font-weight: 700; background: #FEF2F2; padding: 2px 4px; border-radius: 3px;' : 'color: var(--primary-navy); font-weight: 600;';
      const cccdStyle = hasCccdError ? 'color: #DC2626; font-weight: 700; background: #FEF2F2; padding: 2px 4px; border-radius: 3px;' : '';
      const emailStyle = hasEmailError ? 'color: #DC2626; font-weight: 700; background: #FEF2F2; padding: 2px 4px; border-radius: 3px;' : '';

      return `
        <tr style="${e.status === 'CONFLICT' ? 'background: #FFF5F5;' : ''}">
          <td style="text-align: center; color: var(--text-secondary); font-size: 11.5px;">${e.stt}</td>
          <td style="text-align: center;">${statusBadge}</td>
          <td><span style="${idStyle}; font-family: monospace;">${e.employee_id || '(Tự tạo)'}</span></td>
          <td>
            <strong>${e.full_name}</strong>
            ${errorMsgHtml}
          </td>
          <td>${e.gender}</td>
          <td><span style="${cccdStyle}">${e.id_number || '-'}</span></td>
          <td><span style="${emailStyle}">${e.work_email || '-'}</span></td>
          <td><span class="badge badge-navy">${e.department_id || 'Mặc định'}</span></td>
          <td>${e.position_id || 'Mặc định'}</td>
        </tr>
      `;
    }).join('');
  },

  updateSubmitButtonState() {
    const submitBtn = document.getElementById('btn-submit-excel-import');
    const chkSkipErrors = document.getElementById('import-chk-skip-errors')?.checked ?? true;
    if (!submitBtn) return;

    const readyCount = this.validEmployees.length + this.overwriteEmployees.length;
    const conflictCount = this.conflictEmployees.length;

    if (conflictCount > 0 && !chkSkipErrors) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Có ${conflictCount} Dòng Xung Đột (Cần xử lý hoặc chọn bỏ qua)`;
      submitBtn.style.background = '#94A3B8';
      submitBtn.style.borderColor = '#64748B';
    } else if (readyCount === 0) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-ban"></i> Không có dòng dữ liệu hợp lệ để nhập';
      submitBtn.style.background = '#94A3B8';
      submitBtn.style.borderColor = '#64748B';
    } else {
      submitBtn.disabled = false;
      submitBtn.style.background = '#10B981';
      submitBtn.style.borderColor = '#059669';
      if (conflictCount > 0) {
        submitBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Xác Nhận Nhập ${readyCount} Nhân Sự (Bỏ qua ${conflictCount} dòng lỗi)`;
      } else {
        submitBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Xác Nhận Nhập ${readyCount} Nhân Sự Hợp Lệ`;
      }
    }
  },

  async submitImport() {
    if (this.isImporting) return;

    const overwrite = document.getElementById('import-chk-overwrite')?.checked ?? true;
    const chkSkipErrors = document.getElementById('import-chk-skip-errors')?.checked ?? true;

    const toImport = [...this.validEmployees, ...this.overwriteEmployees];
    if (toImport.length === 0) {
      utils.showToast('Không có dữ liệu hợp lệ để nhập vào hệ thống', 'warning');
      return;
    }

    this.isImporting = true;
    const submitBtn = document.getElementById('btn-submit-excel-import');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang đối soát và lưu CSDL...';
    }

    try {
      const apiHeaders = (typeof appData !== 'undefined' && typeof appData.getApiHeaders === 'function')
        ? appData.getApiHeaders()
        : {};

      const res = await fetch('/api/employees/import-excel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...apiHeaders
        },
        body: JSON.stringify({
          employees: toImport,
          overwrite: overwrite,
          skip_errors: chkSkipErrors,
          scope_mode: this.scopeMode,
          selected_tabs: this.scopeMode === 'selected' ? Array.from(this.selectedTabs) : ['all'],
          operator_id: appAuth.currentUser?.employee_id || 'TH-0001',
          operator_name: appAuth.currentUser?.full_name || 'Admin',
          operator_role: appAuth.currentUser?.role || 'ADMIN'
        })
      });

      const json = await res.json();
      if (json.success) {
        utils.showToast(json.message || 'Nhập Excel thành công!', 'success');
        if (window.recordActivityLog) {
          window.recordActivityLog('CREATE', 'Nhập liệu', `Nhập dữ liệu thành công từ file Excel (${this.cleanData?.length || ''} bản ghi)`);
        }
        this.closeModal();

        // Reload all data
        await appData.init();
        appEmployees.applyFilters();
        appDashboard.renderCharts();
        appOrganization.updateAllDropdowns();
        if (window.appReports) appReports.render();
      } else {
        utils.showToast(json.message || 'Lỗi kiểm tra xung đột dữ liệu từ Excel', 'error');
      }
    } catch (err) {
      console.error(err);
      utils.showToast('Lỗi máy chủ khi nhập Excel: ' + err.message, 'error');
    } finally {
      this.isImporting = false;
      this.updateSubmitButtonState();
    }
  }
};
