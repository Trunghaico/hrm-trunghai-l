// ==========================================================================
// HRM TRUNG HẢI - CONTRACT MAIL MERGE & TEMPLATE ENGINE
// Hỗ trợ Word (.docx), MISA Merge Fields, AI Trường Trộn, Xuất Word / PDF / ZIP
// ==========================================================================

// 1. Kho lưu trữ mẫu Word (.docx) dùng IndexedDB
const contractTemplateStore = {
  dbName: 'HRM_Contract_Templates_DB',
  storeName: 'word_templates',
  dbVersion: 1,
  memoryTemplates: new Map(),

  async getDB() {
    if (this._dbPromise) return this._dbPromise;
    this._dbPromise = new Promise((resolve) => {
      try {
        if (!window.indexedDB) return resolve(null);
        const req = window.indexedDB.open(this.dbName, this.dbVersion);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: 'id' });
          }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = () => resolve(null);
      } catch (err) {
        console.warn('[contractTemplateStore] IndexedDB failed:', err);
        resolve(null);
      }
    });
    return this._dbPromise;
  },

  // Danh sách các mẫu mặc định có sẵn của hệ thống
  getDefaultTemplatesMeta() {
    return [
      {
        id: 'tpl-default-fixed-term',
        name: 'Hợp Đồng Lao Động Xác Định Thời Hạn (Chuẩn MISA)',
        type: 'Hợp đồng lao động',
        file_name: 'Mau_Hop_Dong_Lao_Dong_Xac_Dinh_Thoi_Han_MISA.docx',
        is_default: true,
        created_at: '2026-01-01T00:00:00.000Z',
        description: 'Mẫu hợp đồng chuẩn Bộ Lao động & MISA AMIS có chèn sẵn 25+ trường trộn tự động.',
        size: '28 KB'
      },
      {
        id: 'tpl-default-indefinite',
        name: 'Hợp Đồng Lao Động Không Xác Định Thời Hạn (Chuẩn MISA)',
        type: 'Hợp đồng lao động',
        file_name: 'Mau_Hop_Dong_Lao_Dong_Khong_Xac_Dinh_Thoi_Han.docx',
        is_default: true,
        created_at: '2026-01-01T00:00:00.000Z',
        description: 'Dành cho nhân sự chính thức gắn bó dài hạn, đầy đủ quyền lợi bảo hiểm và phúc lợi.',
        size: '29 KB'
      },
      {
        id: 'tpl-default-appendix',
        name: 'Phụ Lục Hợp Đồng Lao Động (Điều Chỉnh Lương & Chức Danh)',
        type: 'Phụ lục hợp đồng',
        file_name: 'Mau_Phu_Luc_Hop_Dong_Lao_Dong.docx',
        is_default: true,
        created_at: '2026-01-01T00:00:00.000Z',
        description: 'Mẫu phụ lục điều chỉnh tăng lương, thăng chức hoặc thay đổi địa điểm công tác.',
        size: '22 KB'
      },
      {
        id: 'tpl-default-probation',
        name: 'Hợp Đồng Thử Việc & Thỏa Thuận Học Việc',
        type: 'Hợp đồng thử việc',
        file_name: 'Mau_Hop_Dong_Thu_Viec_Chuan.docx',
        is_default: true,
        created_at: '2026-01-01T00:00:00.000Z',
        description: 'Mẫu hợp đồng thử việc theo thời hạn 30 - 60 ngày theo Luật Lao động.',
        size: '24 KB'
      }
    ];
  },

  async getAllTemplates() {
    const defaults = this.getDefaultTemplatesMeta();
    let customList = [];
    try {
      const db = await this.getDB();
      if (db) {
        customList = await new Promise((resolve) => {
          const tx = db.transaction(this.storeName, 'readonly');
          const store = tx.objectStore(this.storeName);
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        });
      } else {
        customList = Array.from(this.memoryTemplates.values());
      }
    } catch (e) {
      console.warn('Lỗi đọc mẫu:', e);
    }
    // Gộp mẫu tùy chỉnh do người dùng upload lên trước, sau đó là mẫu chuẩn
    return [...customList, ...defaults];
  },

  async init() {
    await this.getDB();
    return true;
  },

  async getTemplate(id) {
    if (!id) return null;
    const all = await this.getAllTemplates();
    const t = all.find(item => item.id === id);
    if (!t) return null;
    if (!t.data_buffer && !t.buffer) {
      t.data_buffer = await this.getTemplateBuffer(id);
    } else if (t.buffer && !t.data_buffer) {
      t.data_buffer = t.buffer;
    }
    return t;
  },

  async saveTemplate(templateObj) {
    if (!templateObj.id) {
      templateObj.id = `tpl-custom-${Date.now()}`;
    }
    if (!templateObj.created_at) {
      templateObj.created_at = new Date().toISOString();
    }
    templateObj.updated_at = new Date().toISOString();
    if (templateObj.data_buffer && !templateObj.buffer) {
      templateObj.buffer = templateObj.data_buffer;
    }
    return this.saveCustomTemplate(templateObj);
  },

  async deleteTemplate(id) {
    return this.deleteCustomTemplate(id);
  },

  async setDefault(id) {
    const all = await this.getAllTemplates();
    all.forEach(t => {
      t.is_default = (t.id === id);
      if (t.id.startsWith('tpl-custom-')) {
        this.saveCustomTemplate(t);
      }
    });
    return true;
  },

  async saveCustomTemplate(templateObj) {
    if (!templateObj.id) {
      templateObj.id = `tpl-custom-${Date.now()}`;
    }
    templateObj.created_at = new Date().toISOString();
    this.memoryTemplates.set(templateObj.id, templateObj);

    try {
      const db = await this.getDB();
      if (db) {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.put(templateObj);
      }
    } catch (e) {
      console.warn('[contractTemplateStore] Lỗi lưu mẫu vào IndexedDB:', e);
    }
    return templateObj;
  },

  async deleteCustomTemplate(id) {
    this.memoryTemplates.delete(id);
    try {
      const db = await this.getDB();
      if (db) {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.delete(id);
      }
    } catch (e) {
      console.warn('[contractTemplateStore] Lỗi xóa mẫu:', e);
    }
  },

  // Lấy dữ liệu nhị phân ArrayBuffer của file .docx
  async getTemplateBuffer(templateId) {
    // 1. Kiểm tra trong bộ nhớ đệm hoặc IndexedDB
    if (this.memoryTemplates.has(templateId)) {
      const t = this.memoryTemplates.get(templateId);
      if (t.buffer) return t.buffer;
      if (t.base64) return this.base64ToArrayBuffer(t.base64);
    }

    try {
      const db = await this.getDB();
      if (db) {
        const res = await new Promise((resolve) => {
          const tx = db.transaction(this.storeName, 'readonly');
          const store = tx.objectStore(this.storeName);
          const req = store.get(templateId);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        });
        if (res) {
          if (res.buffer) return res.buffer;
          if (res.base64) return this.base64ToArrayBuffer(res.base64);
        }
      }
    } catch (e) {
      console.warn('Lấy buffer từ DB thất bại:', e);
    }

    // 2. Nếu là mẫu mặc định, tự động kiến tạo file .docx hoàn chỉnh bằng PizZip
    return this.generateDefaultDocxBuffer(templateId);
  },

  base64ToArrayBuffer(base64) {
    const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, '');
    const binaryString = window.atob(cleanBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  },

  // Tạo file Word .docx chuẩn có đầy đủ Quốc hiệu, Tiêu ngữ và trường trộn MISA
  generateDefaultDocxBuffer(templateId = 'tpl-default-fixed-term') {
    if (typeof PizZip === 'undefined') {
      throw new Error('Thư viện PizZip chưa sẵn sàng');
    }

    const zip = new PizZip();

    // 1. [Content_Types].xml
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`);

    // 2. _rels/.rels
    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

    // 3. word/_rels/document.xml.rels
    zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);

    // 4. word/styles.xml
    zip.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:sz w:val="26"/>
        <w:szCs w:val="26"/>
        <w:lang w:val="vi-VN"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>`);

    // 5. word/document.xml - Văn bản hợp đồng lao động chuẩn Việt Nam
    const isAppendix = templateId.includes('appendix');
    const titleText = isAppendix ? 'PHỤ LỤC HỢP ĐỒNG LAO ĐỘNG' : 'HỢP ĐỒNG LAO ĐỘNG';
    const subTitle = isAppendix ? 'Điều chỉnh các điều khoản hợp đồng lao động đã ký' : '(Ban hành theo Bộ luật Lao động số 45/2019/QH14)';

    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <!-- Quốc Hiệu Tiêu Ngữ -->
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="60"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="26"/></w:rPr><w:t>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="160"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="26"/></w:rPr><w:t>Độc lập - Tự do - Hạnh phúc</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="240"/></w:pPr>
      <w:r><w:t>-------------------o0o-------------------</w:t></w:r>
    </w:p>

    <!-- Tiêu Đề Hợp Đồng -->
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="80"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="34"/><w:color w:val="1C3381"/></w:rPr><w:t>${titleText}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="80"/></w:pPr>
      <w:r><w:rPr><w:i/><w:sz w:val="22"/></w:rPr><w:t>${subTitle}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="240"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Số: &lt;SoHD&gt;</w:t></w:r>
    </w:p>

    <!-- Ngày tháng lập -->
    <w:p>
      <w:pPr><w:jc w:val="right"/><w:spacing w:after="200"/></w:pPr>
      <w:r><w:rPr><w:i/></w:rPr><w:t>Hôm nay, ngày &lt;NgayKy&gt;, tại trụ sở &lt;TenCongTy&gt;, chúng tôi gồm có:</w:t></w:r>
    </w:p>

    <!-- BÊN A -->
    <w:p>
      <w:pPr><w:spacing w:after="100"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>BÊN A: NGƯỜI SỬ DỤNG LAO ĐỘNG</w:t></w:r>
    </w:p>
    <w:p><w:r><w:t>- Tên doanh nghiệp: &lt;TenCongTy&gt;</w:t></w:r></w:p>
    <w:p><w:r><w:t>- Đại diện bởi: &lt;NguoiDaiDien&gt;     - Chức vụ: &lt;ChucVuDaiDien&gt;</w:t></w:r></w:p>
    <w:p><w:r><w:t>- Địa chỉ trụ sở: &lt;DiaChiCongTy&gt;</w:t></w:r></w:p>
    <w:p><w:pPr><w:spacing w:after="180"/></w:pPr><w:r><w:t>- Mã số thuế: &lt;MaSoThue&gt;     - Điện thoại: &lt;DienThoaiCongTy&gt;</w:t></w:r></w:p>

    <!-- BÊN B -->
    <w:p>
      <w:pPr><w:spacing w:after="100"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>BÊN B: NGƯỜI LAO ĐỘNG</w:t></w:r>
    </w:p>
    <w:p><w:r><w:t>- Họ và tên: </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>&lt;HoVaTen&gt;</w:t></w:r><w:r><w:t>     - Giới tính: &lt;GioiTinh&gt;</w:t></w:r></w:p>
    <w:p><w:r><w:t>- Sinh ngày: &lt;NgaySinh&gt;     - Quốc tịch: Việt Nam</w:t></w:r></w:p>
    <w:p><w:r><w:t>- Số CCCD/Hộ chiếu: &lt;SoCCCD&gt;     - Ngày cấp: &lt;NgayCapCCCD&gt;</w:t></w:r></w:p>
    <w:p><w:r><w:t>- Nơi cấp: &lt;NoiCapCCCD&gt;</w:t></w:r></w:p>
    <w:p><w:r><w:t>- Hộ khẩu thường trú: &lt;DiaChiThuongTru&gt;</w:t></w:r></w:p>
    <w:p><w:r><w:t>- Nơi ở hiện nay: &lt;DiaChiHienNay&gt;</w:t></w:r></w:p>
    <w:p><w:pPr><w:spacing w:after="220"/></w:pPr><w:r><w:t>- Điện thoại liên hệ: &lt;SoDienThoai&gt;     - Email: &lt;Email&gt;</w:t></w:r></w:p>

    <!-- Nội dung cam kết -->
    <w:p>
      <w:pPr><w:spacing w:after="140"/></w:pPr>
      <w:r><w:rPr><w:i/></w:rPr><w:t>Hai bên cùng nhau thỏa thuận ký kết hợp đồng với các điều khoản sau đây:</w:t></w:r>
    </w:p>

    <!-- Điều 1 -->
    <w:p>
      <w:pPr><w:spacing w:after="80"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Điều 1. Công việc, địa điểm làm việc và thời hạn hợp đồng</w:t></w:r>
    </w:p>
    <w:p><w:r><w:t>1. Loại hợp đồng: &lt;LoaiHD&gt;</w:t></w:r></w:p>
    <w:p><w:r><w:t>2. Phòng ban công tác: &lt;PhongBan&gt;</w:t></w:r></w:p>
    <w:p><w:r><w:t>3. Chức vụ / Chức danh công việc: &lt;ChucDanh&gt;</w:t></w:r></w:p>
    <w:p><w:r><w:t>4. Thời hạn hợp đồng: Từ ngày &lt;NgayBatDau&gt; đến ngày &lt;NgayKetThuc&gt; (Hiệu lực từ &lt;NgayHieuLuc&gt;).</w:t></w:r></w:p>
    <w:p><w:pPr><w:spacing w:after="180"/></w:pPr><w:r><w:t>5. Địa điểm làm việc: &lt;DiaDiemLamViec&gt;</w:t></w:r></w:p>

    <!-- Điều 2 -->
    <w:p>
      <w:pPr><w:spacing w:after="80"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Điều 2. Chế độ làm việc và tiền lương</w:t></w:r>
    </w:p>
    <w:p><w:r><w:t>1. Thời giờ làm việc: 08 giờ/ngày, từ Thứ 2 đến Thứ 6 hàng tuần.</w:t></w:r></w:p>
    <w:p><w:r><w:t>2. Mức lương chính: </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>&lt;MucLuong&gt; VNĐ/tháng</w:t></w:r><w:r><w:t> (Bằng chữ: &lt;LuongBangChu&gt;).</w:t></w:r></w:p>
    <w:p><w:r><w:t>3. Hình thức trả lương: Chuyển khoản qua số tài khoản &lt;SoTaiKhoan&gt; tại &lt;NganHang&gt;.</w:t></w:r></w:p>
    <w:p><w:pPr><w:spacing w:after="240"/></w:pPr><w:r><w:t>4. Chế độ bảo hiểm: Được tham gia đầy đủ BHXH, BHYT, BHTN theo quy định pháp luật hiện hành.</w:t></w:r></w:p>

    <!-- Chữ ký đôi bên -->
    <w:p>
      <w:pPr><w:spacing w:before="300" w:after="80"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>            ĐẠI DIỆN NGƯỜI SỬ DỤNG LAO ĐỘNG                                      NGƯỜI LAO ĐỘNG</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:spacing w:after="1200"/></w:pPr>
      <w:r><w:rPr><w:i/></w:rPr><w:t>                       (Ký và đóng dấu)                                                            (Ký, ghi rõ họ tên)</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:rPr><w:b/></w:rPr><w:t>                      &lt;NguoiDaiDien&gt;                                                                  &lt;HoVaTen&gt;</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;

    zip.file('word/document.xml', docXml);
    return zip.generate({ type: 'arraybuffer' });
  }
};

// 2. Bộ máy trộn dữ liệu Mail Merge & AI Smart Scanner
const contractMergeEngine = {
  // Bảng danh mục trường trộn MISA chuẩn dùng cho toàn hệ thống & Cheat Sheet
  MISA_MERGE_FIELDS: [
    { key: 'SoHD', label: 'Số hợp đồng lao động', group: 'Hợp đồng', sample: 'HD-TH-582' },
    { key: 'LoaiHD', label: 'Loại hợp đồng lao động', group: 'Hợp đồng', sample: 'HĐ xác định thời hạn (12 tháng)' },
    { key: 'NgayKy', label: 'Ngày ký kết hợp đồng', group: 'Hợp đồng', sample: '01/01/2026' },
    { key: 'NgayBatDau', label: 'Ngày bắt đầu hợp đồng', group: 'Hợp đồng', sample: '01/01/2026' },
    { key: 'NgayKetThuc', label: 'Ngày hết hạn hợp đồng', group: 'Hợp đồng', sample: '31/12/2026' },
    { key: 'NgayHieuLuc', label: 'Ngày hiệu lực', group: 'Hợp đồng', sample: '01/01/2026' },
    { key: 'NgayHetHan', label: 'Ngày hết hạn', group: 'Hợp đồng', sample: '31/12/2026' },
    { key: 'NgayThuViec', label: 'Ngày bắt đầu thử việc', group: 'Hợp đồng', sample: '01/11/2025' },
    { key: 'NgayChinhThuc', label: 'Ngày chính thức', group: 'Hợp đồng', sample: '01/01/2026' },
    { key: 'MaNV', label: 'Mã nhân viên', group: 'Nhân sự', sample: 'TH-582' },
    { key: 'HoVaTen', label: 'Họ và tên nhân viên', group: 'Nhân sự', sample: 'Phạm Quốc Lâm' },
    { key: 'NgaySinh', label: 'Ngày tháng năm sinh', group: 'Nhân sự', sample: '15/08/1990' },
    { key: 'GioiTinh', label: 'Giới tính', group: 'Nhân sự', sample: 'Nam' },
    { key: 'SoCCCD', label: 'Số CCCD / CMND', group: 'Nhân sự', sample: '079090012345' },
    { key: 'NgayCapCCCD', label: 'Ngày cấp CCCD', group: 'Nhân sự', sample: '10/05/2021' },
    { key: 'NoiCapCCCD', label: 'Nơi cấp CCCD', group: 'Nhân sự', sample: 'Cục CSQLHC về TTXH' },
    { key: 'DiaChiThuongTru', label: 'Hộ khẩu thường trú', group: 'Nhân sự', sample: 'Số 123 Nguyễn Trãi, Q.5, TP.HCM' },
    { key: 'DiaChiHienNay', label: 'Chỗ ở hiện nay', group: 'Nhân sự', sample: '456 Lê Văn Sỹ, Q.3, TP.HCM' },
    { key: 'SoDienThoai', label: 'Số điện thoại liên hệ', group: 'Nhân sự', sample: '0903123456' },
    { key: 'Email', label: 'Email công ty / cá nhân', group: 'Nhân sự', sample: 'lam.pham@trunghaico.vn' },
    { key: 'DanToc', label: 'Dân tộc', group: 'Nhân sự', sample: 'Kinh' },
    { key: 'TonGiao', label: 'Tôn giáo', group: 'Nhân sự', sample: 'Không' },
    { key: 'TrinhDo', label: 'Trình độ học vấn', group: 'Nhân sự', sample: 'Đại học' },
    { key: 'ChuyenNganh', label: 'Chuyên ngành đào tạo', group: 'Nhân sự', sample: 'Quản trị Kinh doanh' },
    { key: 'ChucDanh', label: 'Vị trí công việc / Chức danh', group: 'Công việc', sample: 'Trưởng Phòng Kinh Doanh' },
    { key: 'PhongBan', label: 'Phòng ban công tác', group: 'Công việc', sample: 'Khối Kinh Doanh' },
    { key: 'DiaDiemLamViec', label: 'Địa điểm làm việc', group: 'Công việc', sample: 'Trụ sở Trung Hải, TP.HCM' },
    { key: 'MucLuong', label: 'Mức lương hợp đồng', group: 'Lương & Chế độ', sample: '18.000.000 VNĐ' },
    { key: 'MucLuongSo', label: 'Mức lương dạng số', group: 'Lương & Chế độ', sample: '18000000' },
    { key: 'LuongBangChu', label: 'Mức lương bằng chữ', group: 'Lương & Chế độ', sample: 'Mười tám triệu đồng chẵn' },
    { key: 'SoTaiKhoan', label: 'Số tài khoản ngân hàng', group: 'Lương & Chế độ', sample: '012345678901' },
    { key: 'NganHang', label: 'Ngân hàng thụ hưởng', group: 'Lương & Chế độ', sample: 'MBBank - Ngân hàng Quân Đội' },
    { key: 'ChiNhanhNganHang', label: 'Chi nhánh ngân hàng', group: 'Lương & Chế độ', sample: 'Chi nhánh Sài Gòn' },
    { key: 'TenCongTy', label: 'Tên công ty / Doanh nghiệp', group: 'Doanh nghiệp', sample: 'CÔNG TY CỔ PHẦN TRUNG HẢI' },
    { key: 'NguoiDaiDien', label: 'Người đại diện theo PL', group: 'Doanh nghiệp', sample: 'Huỳnh Thanh Long' },
    { key: 'ChucVuDaiDien', label: 'Chức vụ người đại diện', group: 'Doanh nghiệp', sample: 'Tổng Giám Đốc' },
    { key: 'DiaChiCongTy', label: 'Địa chỉ trụ sở công ty', group: 'Doanh nghiệp', sample: 'KCN Trung Hải, TP. Hồ Chí Minh' },
    { key: 'MaSoThue', label: 'Mã số thuế doanh nghiệp', group: 'Doanh nghiệp', sample: '0315894123' },
    { key: 'DienThoaiCongTy', label: 'Điện thoại doanh nghiệp', group: 'Doanh nghiệp', sample: '(028) 3888 9999' }
  ],

  // Tạo file Word .docx chuẩn
  generateDefaultDocxBuffer(templateId) {
    return contractTemplateStore.generateDefaultDocxBuffer(templateId);
  },

  // Chuyển số tiền sang chữ tiếng Việt chuẩn xác
  numberToVietnameseWords(num) {
    if (!num || isNaN(num) || num <= 0) return 'Không đồng';
    const units = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
    const ranks = ['', 'nghìn', 'triệu', 'tỷ'];

    function readTriple(n) {
      let h = Math.floor(n / 100);
      let t = Math.floor((n % 100) / 10);
      let o = n % 10;
      let res = '';
      if (h > 0) res += units[h] + ' trăm ';
      if (t > 1) {
        res += units[t] + ' mươi ';
        if (o === 1) res += 'mốt ';
        else if (o === 5) res += 'lăm ';
        else if (o > 0) res += units[o] + ' ';
      } else if (t === 1) {
        res += 'mười ';
        if (o === 5) res += 'lăm ';
        else if (o > 0) res += units[o] + ' ';
      } else if (t === 0 && o > 0) {
        if (h > 0) res += 'lẻ ' + units[o] + ' ';
        else res += units[o] + ' ';
      }
      return res.trim();
    }

    let strNum = Math.floor(num).toString();
    let parts = [];
    while (strNum.length > 0) {
      parts.unshift(parseInt(strNum.slice(-3), 10));
      strNum = strNum.slice(0, -3);
    }

    let words = [];
    for (let i = 0; i < parts.length; i++) {
      let p = parts[i];
      let rankIdx = parts.length - 1 - i;
      if (p > 0) {
        words.push(readTriple(p) + ' ' + ranks[rankIdx]);
      }
    }
    let res = words.join(' ').replace(/\s+/g, ' ').trim() + ' đồng chẵn';
    return res.charAt(0).toUpperCase() + res.slice(1);
  },

  // Bốc tách và kiến tạo bảng dữ liệu trộn từ Hợp đồng + Hồ sơ Nhân sự + Công ty
  buildMergeData(contract = {}, employee = {}, company = {}) {
    const rawSalary = Number(contract.salary || employee.base_salary || employee.salary || 0);
    const salaryFormatted = rawSalary > 0 ? (typeof utils !== 'undefined' ? utils.formatCurrency(rawSalary) : rawSalary.toLocaleString('vi-VN') + ' VNĐ') : 'Thỏa thuận';
    const salaryInWords = rawSalary > 0 ? this.numberToVietnameseWords(rawSalary) : 'Thỏa thuận theo quy chế công ty';

    const cleanDate = (d) => (typeof utils !== 'undefined' && utils.formatDate) ? utils.formatDate(d) : (d || '-');
    const today = new Date();
    const currentDateStr = `${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`;

    const cName = company.name || 'CÔNG TY CỔ PHẦN TRUNG HẢI';
    const cRep = company.representative || 'Huỳnh Thanh Long';
    const cPos = company.rep_position || 'Tổng Giám Đốc';
    const cAddr = company.address || 'Khu Công Nghiệp Trung Hải, Việt Nam';

    // Bảng trường chuẩn MISA
    const baseFields = {
      // Thông tin hợp đồng
      SoHD: contract.contract_id || `HD-${employee.employee_id || 'TH-01'}`,
      LoaiHD: contract.contract_type || 'Hợp đồng lao động xác định thời hạn',
      NgayKy: cleanDate(contract.sign_date || contract.effective_date) || currentDateStr,
      NgayBatDau: cleanDate(contract.effective_date || contract.start_date),
      NgayKetThuc: (contract.expiry_date || contract.end_date) ? cleanDate(contract.expiry_date || contract.end_date) : 'Không xác định',
      NgayHieuLuc: cleanDate(contract.effective_date || contract.start_date),
      NgayHetHan: (contract.expiry_date || contract.end_date) ? cleanDate(contract.expiry_date || contract.end_date) : 'Không xác định',
      NgayThuViec: cleanDate(contract.trial_start_date),
      NgayChinhThuc: cleanDate(contract.official_date),

      // Thông tin nhân sự
      MaNV: employee.employee_id || contract.employee_id || '-',
      HoVaTen: employee.full_name || contract.full_name || '-',
      NgaySinh: cleanDate(employee.date_of_birth),
      GioiTinh: employee.gender || 'Nam',
      SoCCCD: employee.id_number || employee.tax_code || '-',
      NgayCapCCCD: cleanDate(employee.id_issued_date),
      NoiCapCCCD: employee.id_issued_place || 'Cục Cảnh sát QLHC về TTXH',
      DiaChiThuongTru: employee.permanent_address_full || employee.permanent_address || '-',
      DiaChiHienNay: employee.current_address_full || employee.current_address || employee.permanent_address_full || '-',
      SoDienThoai: employee.mobile_phone || employee.phone || '-',
      Email: employee.work_email || employee.personal_email || '-',
      DanToc: employee.ethnicity || 'Kinh',
      TonGiao: employee.religion || 'Không',
      TrinhDo: employee.education_level || 'Đại học',
      ChuyenNganh: employee.major || '-',

      // Vị trí & Công việc
      ChucDanh: contract.job_title || employee.job_title || employee.position_name || '-',
      PhongBan: contract.department_name || employee.department_name || '-',
      DiaDiemLamViec: employee.work_location || company.address || 'Trụ sở công ty',

      // Tiền lương & Phúc lợi
      MucLuong: salaryFormatted,
      MucLuongSo: rawSalary,
      LuongBangChu: salaryInWords,
      SoTaiKhoan: employee.bank_account_number || employee.bank_account || '-',
      NganHang: employee.bank_name || 'Ngân hàng TMCP Quân Đội (MBBank)',
      ChiNhanhNganHang: employee.bank_branch || 'Chi nhánh TP. Hồ Chí Minh',

      // Thông tin Doanh nghiệp
      TenCongTy: cName,
      NguoiDaiDien: cRep,
      ChucVuDaiDien: cPos,
      DiaChiCongTy: cAddr,
      MaSoThue: company.tax_id || '0315894123',
      DienThoaiCongTy: company.phone || '(028) 3888 9999'
    };

    // Hỗ trợ cả 3 cú pháp trộn: Tag thường, <Tag> và {Tag}
    const finalData = { ...baseFields };
    for (const [k, v] of Object.entries(baseFields)) {
      finalData[`<${k}>`] = v !== undefined && v !== null ? v : '';
      finalData[`{${k}}`] = v !== undefined && v !== null ? v : '';
      finalData[`<<${k}>>`] = v !== undefined && v !== null ? v : '';
    }
    return finalData;
  },

  // AI / Smart Scanner: Quét và nhận diện các trường trộn từ tệp Word (.docx)
  analyzeDocxFields(arrayBuffer) {
    if (typeof PizZip === 'undefined') {
      return { success: false, message: 'Thư viện PizZip chưa sẵn sàng' };
    }

    try {
      const zip = new PizZip(arrayBuffer);
      const docXml = zip.files['word/document.xml'] ? zip.files['word/document.xml'].asText() : '';

      if (!docXml) {
        return { success: false, message: 'Tệp Word không chứa nội dung hợp lệ (document.xml)' };
      }

      // 1. Dọn dẹp XML và tìm tất cả thẻ có dạng <...>, {...}, «...»
      const textOnly = docXml.replace(/<[^>]+>/g, '');

      // Regex quét trường: <Tag>, {Tag}, «Tag»
      const tagRegex = /(?:<|&lt;|«|\{)([a-zA-Z0-9_À-ỹ]+)(?:>|&gt;|»|\})/g;
      const detectedSet = new Set();
      let match;
      while ((match = tagRegex.exec(textOnly)) !== null) {
        const tagName = match[1].trim();
        // Bỏ qua các tag XML chuẩn nếu có
        if (!['xml', 'w', 'r', 'p', 't', 'b', 'i'].includes(tagName.toLowerCase())) {
          detectedSet.add(tagName);
        }
      }

      const detectedTags = Array.from(detectedSet);

      // Danh mục trường HRM đã được hỗ trợ tự động bốc tách
      const supportedMap = {
        'HoVaTen': 'Họ và tên nhân viên',
        'NgaySinh': 'Ngày tháng năm sinh',
        'GioiTinh': 'Giới tính',
        'SoCCCD': 'Số Căn cước công dân / CMND',
        'NgayCapCCCD': 'Ngày cấp CCCD',
        'NoiCapCCCD': 'Nơi cấp CCCD',
        'DiaChiThuongTru': 'Hộ khẩu thường trú',
        'DiaChiHienNay': 'Chỗ ở hiện nay',
        'SoDienThoai': 'Số điện thoại liên hệ',
        'Email': 'Địa chỉ Email cơ quan/cá nhân',
        'SoHD': 'Số hợp đồng lao động',
        'LoaiHD': 'Loại hợp đồng lao động',
        'ChucDanh': 'Vị trí công việc / Chức danh',
        'PhongBan': 'Phòng ban công tác',
        'NgayBatDau': 'Ngày bắt đầu hợp đồng',
        'NgayKetThuc': 'Ngày kết thúc hợp đồng',
        'NgayHieuLuc': 'Ngày hiệu lực',
        'MucLuong': 'Mức lương hợp đồng (định dạng số & VNĐ)',
        'LuongBangChu': 'Mức lương viết bằng chữ',
        'SoTaiKhoan': 'Số tài khoản ngân hàng',
        'NganHang': 'Tên ngân hàng mở thẻ',
        'TenCongTy': 'Tên doanh nghiệp / Công ty',
        'NguoiDaiDien': 'Người đại diện theo pháp luật',
        'ChucVuDaiDien': 'Chức vụ người đại diện',
        'NgayKy': 'Ngày ký kết hợp đồng'
      };

      const matched = [];
      const unmatched = [];

      detectedTags.forEach(tag => {
        const foundKey = Object.keys(supportedMap).find(k => k.toLowerCase() === tag.toLowerCase());
        if (foundKey) {
          matched.push({ tag, fieldKey: foundKey, label: supportedMap[foundKey] });
        } else {
          unmatched.push(tag);
        }
      });

      const total = detectedTags.length;
      const score = total > 0 ? Math.round((matched.length / total) * 100) : 100;

      return {
        success: true,
        totalFound: total,
        totalTags: total,
        matched,
        recognizedTags: matched,
        unmatched,
        unrecognizedTags: unmatched,
        score,
        detectedTags
      };
    } catch (err) {
      console.error('[analyzeDocxFields] error:', err);
      return { success: false, message: err.message };
    }
  },

  // Trộn 1 hợp đồng với mẫu Word (.docx)
  async mergeDocx(templateBuffer, mergeData) {
    if (typeof PizZip === 'undefined' || typeof window.docxtemplater === 'undefined') {
      throw new Error('Thư viện xử lý Word chưa sẵn sàng (PizZip/Docxtemplater)');
    }

    if (!templateBuffer) {
      templateBuffer = this.generateDefaultDocxBuffer();
    }

    const zip = new PizZip(templateBuffer);

    // Tự động chuẩn hóa nội dung document.xml:
    let docXml = zip.files['word/document.xml'].asText();
    for (const [key, val] of Object.entries(mergeData)) {
      if (key.startsWith('<') && key.endsWith('>')) {
        const rawKey = key.slice(1, -1);
        const safeVal = (val !== undefined && val !== null ? String(val) : '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');

        docXml = docXml.split(`&lt;${rawKey}&gt;`).join(safeVal);
        docXml = docXml.split(`<${rawKey}>`).join(safeVal);
        docXml = docXml.split(`«${rawKey}»`).join(safeVal);
      }
    }
    zip.file('word/document.xml', docXml);

    const doc = new window.docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{', end: '}' }
    });

    doc.render(mergeData);

    const out = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
    return out;
  },

  // Trộn hàng loạt (Batch Merge) và nén thành tệp .ZIP kèm báo cáo tiến trình
  async batchMerge(contractsList, templateBuffer, onProgress) {
    if (typeof JSZip === 'undefined') {
      throw new Error('Thư viện JSZip chưa sẵn sàng');
    }

    const zipPackage = new JSZip();
    const total = contractsList.length;
    const employees = (typeof appData !== 'undefined' && appData.employees) ? appData.employees : [];
    const company = (typeof appData !== 'undefined' && appData.company) ? appData.company : {};

    if (!templateBuffer) {
      templateBuffer = this.generateDefaultDocxBuffer();
    }

    for (let i = 0; i < total; i++) {
      const contract = contractsList[i];
      const emp = employees.find(e => e.employee_id === contract.employee_id || e.id === contract.employee_id) || {};
      const mergeData = this.buildMergeData(contract, emp, company);

      if (onProgress) {
        onProgress(i + 1, total, mergeData.HoVaTen || contract.employee_id);
      }

      // Trộn từng hợp đồng
      const docxBlob = await this.mergeDocx(templateBuffer, mergeData);
      const cleanEmpName = (mergeData.HoVaTen || contract.employee_id || `NV_${i + 1}`)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .replace(/_+/g, '_');

      const fileName = `Hop_Dong_${contract.contract_id || `HD_${i + 1}`}_${cleanEmpName}.docx`;
      zipPackage.file(fileName, docxBlob);
    }

    // Đóng gói file .ZIP
    const zipBlob = await zipPackage.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
    return zipBlob;
  },

  // Tải file về máy tính
  downloadBlob(blob, fileName) {
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(link.href);
  },

  // Kiến tạo giao diện HTML in hợp đồng chuẩn pháp lý cho xem trước & in trực tiếp / xuất PDF
  generateContractPrintHtml(contract = {}, employee = {}, company = {}) {
    const data = this.buildMergeData(contract, employee, company);

    return `
      <div class="contract-print-page" style="max-width: 800px; margin: 0 auto; background: #FFFFFF; padding: 40px 50px; font-family: 'Times New Roman', Times, serif; font-size: 14pt; line-height: 1.5; color: #111827;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h4 style="margin: 0; font-size: 13pt; text-transform: uppercase; font-weight: bold;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</h4>
          <h5 style="margin: 4px 0 0 0; font-size: 13pt; font-weight: bold;">Độc lập - Tự do - Hạnh phúc</h5>
          <div style="letter-spacing: 2px; margin-top: 4px;">------------------o0o------------------</div>
        </div>

        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="margin: 0; font-size: 18pt; text-transform: uppercase; font-weight: bold; color: #1C3381;">HỢP ĐỒNG LAO ĐỘNG</h2>
          <div style="font-size: 11pt; font-style: italic; margin-top: 4px;">(Ban hành theo Bộ luật Lao động số 45/2019/QH14)</div>
          <div style="font-weight: bold; font-size: 12pt; margin-top: 6px;">Số: ${data.SoHD}</div>
        </div>

        <div style="text-align: right; font-style: italic; margin-bottom: 18px; font-size: 12pt;">
          Hôm nay, ngày ${data.NgayKy}, tại trụ sở ${data.TenCongTy}, chúng tôi gồm có:
        </div>

        <div style="margin-bottom: 16px;">
          <div style="font-weight: bold; text-transform: uppercase;">BÊN A: NGƯỜI SỬ DỤNG LAO ĐỘNG</div>
          <table style="width: 100%; border-collapse: collapse; margin-top: 4px;">
            <tr><td style="width: 170px;">Tên doanh nghiệp:</td><td><strong>${data.TenCongTy}</strong></td></tr>
            <tr><td>Đại diện bởi:</td><td>Ông/Bà <strong>${data.NguoiDaiDien}</strong> &nbsp;&nbsp;&nbsp;&nbsp; Chức vụ: ${data.ChucVuDaiDien}</td></tr>
            <tr><td>Địa chỉ trụ sở:</td><td>${data.DiaChiCongTy}</td></tr>
            <tr><td>Mã số thuế:</td><td>${data.MaSoThue} &nbsp;&nbsp;&nbsp;&nbsp; Điện thoại: ${data.DienThoaiCongTy}</td></tr>
          </table>
        </div>

        <div style="margin-bottom: 20px;">
          <div style="font-weight: bold; text-transform: uppercase;">BÊN B: NGƯỜI LAO ĐỘNG</div>
          <table style="width: 100%; border-collapse: collapse; margin-top: 4px;">
            <tr><td style="width: 170px;">Họ và tên:</td><td><strong style="text-transform: uppercase;">${data.HoVaTen}</strong> &nbsp;&nbsp;&nbsp;&nbsp; Giới tính: ${data.GioiTinh}</td></tr>
            <tr><td>Sinh ngày:</td><td>${data.NgaySinh} &nbsp;&nbsp;&nbsp;&nbsp; Quốc tịch: Việt Nam</td></tr>
            <tr><td>Số CCCD/Hộ chiếu:</td><td><strong>${data.SoCCCD}</strong> &nbsp;&nbsp;&nbsp;&nbsp; Ngày cấp: ${data.NgayCapCCCD}</td></tr>
            <tr><td>Nơi cấp:</td><td>${data.NoiCapCCCD}</td></tr>
            <tr><td>Hộ khẩu thường trú:</td><td>${data.DiaChiThuongTru}</td></tr>
            <tr><td>Nơi ở hiện nay:</td><td>${data.DiaChiHienNay}</td></tr>
            <tr><td>Điện thoại:</td><td>${data.SoDienThoai} &nbsp;&nbsp;&nbsp;&nbsp; Email: ${data.Email}</td></tr>
          </table>
        </div>

        <div style="font-style: italic; margin-bottom: 14px;">
          Hai bên cùng nhau thống nhất ký kết hợp đồng lao động với các điều khoản cụ thể như sau:
        </div>

        <div style="margin-bottom: 16px;">
          <strong>Điều 1. Công việc, địa điểm làm việc và thời hạn hợp đồng</strong>
          <div style="margin-left: 18px; margin-top: 4px;">
            <div>1. Loại hợp đồng: <strong>${data.LoaiHD}</strong></div>
            <div>2. Chức danh / Vị trí: <strong>${data.ChucDanh}</strong> &nbsp;&nbsp;&nbsp;&nbsp; Phòng ban: <strong>${data.PhongBan}</strong></div>
            <div>3. Thời hạn hợp đồng: Từ ngày <strong>${data.NgayBatDau}</strong> đến ngày <strong>${data.NgayKetThuc}</strong>.</div>
            <div>4. Địa điểm làm việc: ${data.DiaDiemLamViec}.</div>
          </div>
        </div>

        <div style="margin-bottom: 24px;">
          <strong>Điều 2. Chế độ làm việc, tiền lương và quyền lợi</strong>
          <div style="margin-left: 18px; margin-top: 4px;">
            <div>1. Thời giờ làm việc: 08 giờ/ngày, từ Thứ 2 đến Thứ 6 hàng tuần.</div>
            <div>2. Tiền lương hợp đồng: <strong style="color: #059669; font-size: 15pt;">${data.MucLuong}</strong> /tháng.</div>
            <div>3. Viết bằng chữ: <em>${data.LuongBangChu}</em>.</div>
            <div>4. Hình thức trả lương: Chuyển khoản ngân hàng định kỳ vào ngày 05 hàng tháng.</div>
            <div>5. Chế độ bảo hiểm: Được đóng đầy đủ BHXH, BHYT, BHTN theo quy định pháp luật.</div>
          </div>
        </div>

        <table style="width: 100%; margin-top: 30px; text-align: center;">
          <tr>
            <td style="width: 50%; vertical-align: top;">
              <strong>ĐẠI DIỆN NGƯỜI SỬ DỤNG LAO ĐỘNG</strong><br>
              <span style="font-size: 11pt; font-style: italic;">(Ký tên và đóng dấu)</span>
              <div style="height: 90px;"></div>
              <strong>${data.NguoiDaiDien}</strong>
            </td>
            <td style="width: 50%; vertical-align: top;">
              <strong>NGƯỜI LAO ĐỘNG</strong><br>
              <span style="font-size: 11pt; font-style: italic;">(Ký và ghi rõ họ tên)</span>
              <div style="height: 90px;"></div>
              <strong>${data.HoVaTen}</strong>
            </td>
          </tr>
        </table>
      </div>
    `;
  }
};

window.contractTemplateStore = contractTemplateStore;
window.contractMergeEngine = contractMergeEngine;
