// ==========================================================================
// CONTRACT TEMPLATES MANAGEMENT (QUẢN LÝ MẪU HỢP ĐỒNG WORD & MERGE FIELDS)
// HRM Trung Hải Enterprise Edition
// ==========================================================================

const contractTemplateStore = {
  dbName: 'HRM_Contract_Files_DB',
  storeName: 'contract_templates',
  dbVersion: 2,
  templates: [],

  // Khởi tạo IndexedDB lưu trữ mẫu Word
  async getDB() {
    if (this._dbPromise) return this._dbPromise;
    this._dbPromise = new Promise((resolve) => {
      try {
        if (!window.indexedDB) return resolve(null);
        const req = window.indexedDB.open(this.dbName, this.dbVersion);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('contract_files')) {
            db.createObjectStore('contract_files', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: 'id' });
          }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => {
          console.warn('[contractTemplateStore] IndexedDB error:', e);
          resolve(null);
        };
      } catch (err) {
        console.warn('[contractTemplateStore] init error:', err);
        resolve(null);
      }
    });
    return this._dbPromise;
  },

  // Tạo file Word .docx tiêu chuẩn bằng XML cho các mẫu mặc định
  async createDefaultDocx(type = 'fixed_term') {
    if (typeof window.JSZip === 'undefined') return null;
    const zip = new window.JSZip();

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

    // 5. word/document.xml (Nội dung hợp đồng tiếng Việt hoàn chỉnh có đầy đủ Merge Fields)
    let title = "HỢP ĐỒNG LAO ĐỘNG";
    let subTitle = "(Xác định thời hạn)";
    if (type === 'indefinite') {
      subTitle = "(Không xác định thời hạn)";
    } else if (type === 'probation') {
      title = "HỢP ĐỒNG THỬ VIỆC";
      subTitle = "(Theo quy định của Bộ Luật Lao Động)";
    } else if (type === 'appendix') {
      title = "PHỤ LỤC HỢP ĐỒNG LAO ĐỘNG";
      subTitle = "(Kèm theo Hợp đồng số: &lt;SoHD&gt;)";
    }

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <!-- Quốc hiệu Tiêu ngữ -->
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="60"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="160"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="26"/><w:u w:val="single"/></w:rPr><w:t>Độc lập - Tự do - Hạnh phúc</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="right"/><w:spacing w:after="240"/></w:pPr>
      <w:r><w:rPr><w:i/></w:rPr><w:t>&lt;NgayThangNamKy&gt;</w:t></w:r>
    </w:p>

    <!-- Tiêu đề Hợp đồng -->
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="80"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t>${title}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="60"/></w:pPr>
      <w:r><w:rPr><w:i/><w:sz w:val="24"/></w:rPr><w:t>${subTitle}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="280"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Số: &lt;SoHD&gt;</w:t></w:r>
    </w:p>

    <!-- Đoạn mở đầu -->
    <w:p><w:r><w:t>Hôm nay, ngày &lt;NgayHienTai&gt; tháng &lt;ThangHienTai&gt; năm &lt;NamHienTai&gt;, tại trụ sở &lt;TenCongTy&gt;, chúng tôi gồm có:</w:t></w:r></w:p>

    <!-- Bên A -->
    <w:p><w:pPr><w:spacing w:before="160"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>BÊN A: NGƯỜI SỬ DỤNG LAO ĐỘNG</w:t></w:r></w:p>
    <w:p><w:r><w:t>- Tên đơn vị / Doanh nghiệp: </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>&lt;TenCongTy&gt;</w:t></w:r></w:p>
    <w:p><w:r><w:t>- Mã số thuế: &lt;MSTCongTy&gt; • Điện thoại: &lt;DienThoaiCongTy&gt;</w:t></w:r></w:p>
    <w:p><w:r><w:t>- Địa chỉ trụ sở chính: &lt;DiaChiCongTy&gt;</w:t></w:r></w:p>
    <w:p><w:r><w:t>- Đại diện bởi Ông/Bà: </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>&lt;DaiDienCongTy&gt;</w:t></w:r><w:r><w:t> - Chức vụ: </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>&lt;ChucVuDaiDien&gt;</w:t></w:r><w:r><w:t> (Quốc tịch: &lt;QuocTichDaiDien&gt;)</w:t></w:r></w:p>

    <!-- Bên B -->
    <w:p><w:pPr><w:spacing w:before="160"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>BÊN B: NGƯỜI LAO ĐỘNG</w:t></w:r></w:p>
    <w:p><w:r><w:t>- Họ và tên: </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>&lt;HO_VA_TEN&gt;</w:t></w:r><w:r><w:t> • Giới tính: &lt;GioiTinh&gt;</w:t></w:r></w:p>
    <w:p><w:r><w:t>- Ngày sinh: &lt;NgaySinh&gt; • Quốc tịch: &lt;QuocTich&gt; • Dân tộc: &lt;DanToc&gt;</w:t></w:r></w:p>
    <w:p><w:r><w:t>- Mã nhân viên: </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>&lt;MaNV&gt;</w:t></w:r><w:r><w:t> • Số CCCD/CMND: </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>&lt;SoCCCD&gt;</w:t></w:r></w:p>
    <w:p><w:r><w:t>- Ngày cấp: &lt;NgayCap&gt; • Nơi cấp: &lt;NoiCap&gt;</w:t></w:r></w:p>
    <w:p><w:r><w:t>- Hộ khẩu thường trú: &lt;DiaChiThuongTru&gt;</w:t></w:r></w:p>
    <w:p><w:r><w:t>- Chỗ ở hiện nay: &lt;ChoOHienNay&gt;</w:t></w:r></w:p>
    <w:p><w:r><w:t>- Số điện thoại liên hệ: &lt;DienThoai&gt; • Email: &lt;Email&gt;</w:t></w:r></w:p>
    <w:p><w:r><w:t>- Tài khoản ngân hàng: &lt;SoTaiKhoan&gt; tại Ngân hàng &lt;NganHang&gt; (&lt;ChiNhanhNganHang&gt;)</w:t></w:r></w:p>

    <!-- Điều khoản 1 -->
    <w:p><w:pPr><w:spacing w:before="200"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Hai bên cùng thỏa thuận ký kết Hợp đồng lao động với các điều khoản sau đây:</w:t></w:r></w:p>

    <w:p><w:pPr><w:spacing w:before="120"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Điều 1: Thời hạn và công việc hợp đồng</w:t></w:r></w:p>
    <w:p><w:r><w:t>1. Loại hợp đồng lao động: </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>&lt;LoaiHD&gt;</w:t></w:r></w:p>
    <w:p><w:r><w:t>2. Thời hạn hợp đồng: Bắt đầu từ ngày </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>&lt;NgayBatDau&gt;</w:t></w:r><w:r><w:t> đến ngày </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>&lt;NgayKetThuc&gt;</w:t></w:r><w:r><w:t>.</w:t></w:r></w:p>
    <w:p><w:r><w:t>3. Đơn vị công tác: </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>&lt;PhongBan&gt;</w:t></w:r></w:p>
    <w:p><w:r><w:t>4. Chức danh / Vị trí làm việc: </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>&lt;ChucDanh&gt;</w:t></w:r></w:p>
    <w:p><w:r><w:t>5. Địa điểm làm việc: &lt;DiaDiemLamViec&gt;.</w:t></w:r></w:p>

    <!-- Điều khoản 2 -->
    <w:p><w:pPr><w:spacing w:before="120"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Điều 2: Chế độ làm việc và nghỉ ngơi</w:t></w:r></w:p>
    <w:p><w:r><w:t>1. Thời giờ làm việc: &lt;ThoiGioLamViec&gt;.</w:t></w:r></w:p>
    <w:p><w:r><w:t>2. Thời giờ nghỉ ngơi: Nghỉ hàng tuần theo quy định, nghỉ lễ, tết và ngày nghỉ phép năm hưởng nguyên lương theo quy định hiện hành của Bộ Luật Lao Động.</w:t></w:r></w:p>

    <!-- Điều khoản 3 -->
    <w:p><w:pPr><w:spacing w:before="120"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Điều 3: Tiền lương, phụ cấp và các quyền lợi</w:t></w:r></w:p>
    <w:p><w:r><w:t>1. Mức lương cơ bản thỏa thuận: </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>&lt;MucLuong&gt; VNĐ/tháng</w:t></w:r></w:p>
    <w:p><w:r><w:t>(Bằng chữ: </w:t></w:r><w:r><w:rPr><w:i/><w:b/></w:rPr><w:t>&lt;MucLuongChu&gt;</w:t></w:r><w:r><w:t>)</w:t></w:r></w:p>
    <w:p><w:r><w:t>2. Phụ cấp lương: &lt;PhuCap&gt; VNĐ/tháng (Bằng chữ: &lt;PhuCapChu&gt;).</w:t></w:r></w:p>
    <w:p><w:r><w:t>3. Tổng mức thu nhập theo hợp đồng: </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>&lt;TongLuong&gt; VNĐ/tháng</w:t></w:r><w:r><w:t>.</w:t></w:r></w:p>
    <w:p><w:r><w:t>4. Hình thức chi trả lương: &lt;HinhThucTraLuong&gt;.</w:t></w:r></w:p>
    <w:p><w:r><w:t>5. Bảo hiểm: Người lao động được tham gia BHXH, BHYT, BHTN đầy đủ theo quy định của pháp luật lao động.</w:t></w:r></w:p>

    <!-- Điều khoản 4 -->
    <w:p><w:pPr><w:spacing w:before="120"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Điều 4: Điều khoản thi hành</w:t></w:r></w:p>
    <w:p><w:r><w:t>1. Hợp đồng này được lập thành 02 (hai) bản có giá trị pháp lý như nhau, Bên A giữ 01 bản, Bên B giữ 01 bản để thực hiện.</w:t></w:r></w:p>
    <w:p><w:r><w:t>2. Hợp đồng có hiệu lực kể từ ngày </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>&lt;NgayHieuLuc&gt;</w:t></w:r><w:r><w:t>.</w:t></w:r></w:p>

    <!-- Chữ ký 2 bên -->
    <w:p><w:pPr><w:spacing w:before="360"/></w:pPr></w:p>
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9600" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/>
          <w:insideH w:val="none"/><w:insideV w:val="none"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="4800" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/></w:pPr>
            <w:r><w:rPr><w:b/></w:rPr><w:t>NGƯỜI LAO ĐỘNG</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:after="900"/></w:pPr>
            <w:r><w:rPr><w:i/><w:sz w:val="22"/></w:rPr><w:t>(Ký, ghi rõ họ tên)</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="center"/></w:pPr>
            <w:r><w:rPr><w:b/></w:rPr><w:t>&lt;HO_VA_TEN&gt;</w:t></w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="4800" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/></w:pPr>
            <w:r><w:rPr><w:b/></w:rPr><w:t>ĐẠI DIỆN NGƯỜI SỬ DỤNG LAO ĐỘNG</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:after="900"/></w:pPr>
            <w:r><w:rPr><w:i/><w:sz w:val="22"/></w:rPr><w:t>(Ký tên, đóng dấu)</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="center"/></w:pPr>
            <w:r><w:rPr><w:b/></w:rPr><w:t>&lt;DaiDienCongTy&gt;</w:t></w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`;

    zip.file('word/document.xml', documentXml);

    const blob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      compression: 'DEFLATE'
    });
    return blob;
  },

  // Danh mục 4 mẫu Word mặc định
  getDefaultTemplateDefs() {
    return [
      {
        id: 'TPL-01',
        name: 'Mẫu Hợp Đồng Lao Động Xác Định Thời Hạn (Chuẩn MISA & BLLĐ)',
        type: 'fixed_term',
        type_label: 'HĐ Xác Định Thời Hạn',
        file_name: 'Mau_HDLD_Xac_Dinh_Thoi_Han.docx',
        description: 'Mẫu hợp đồng lao động có thời hạn (12-36 tháng) theo chuẩn Bộ Luật Lao Động và trường trộn MISA.',
        is_default: true,
        updated_at: '2026-09-01T08:00:00.000Z'
      },
      {
        id: 'TPL-02',
        name: 'Mẫu Hợp Đồng Lao Động Không Xác Định Thời Hạn (MISA/Trung Hải)',
        type: 'indefinite',
        type_label: 'HĐ Không Xác Định Thời Hạn',
        file_name: 'Mau_HDLD_Khong_Xac_Dinh_Thoi_Han.docx',
        description: 'Áp dụng cho nhân viên chính thức ký hợp đồng vô thời hạn, đầy đủ quyền lợi BHXH và đãi ngộ.',
        is_default: true,
        updated_at: '2026-09-01T08:00:00.000Z'
      },
      {
        id: 'TPL-03',
        name: 'Mẫu Hợp Đồng Thử Việc Chuẩn Doanh Nghiệp',
        type: 'probation',
        type_label: 'HĐ Thử Việc',
        file_name: 'Mau_Hop_Dong_Thu_Viec.docx',
        description: 'Mẫu hợp đồng thử việc từ 30 đến 60 ngày cho nhân sự mới tuyển dụng với mức 85% lương.',
        is_default: true,
        updated_at: '2026-09-01T08:00:00.000Z'
      },
      {
        id: 'TPL-04',
        name: 'Mẫu Phụ Lục Hợp Đồng Lao Động (Điều Chỉnh Lương & Vị Trí)',
        type: 'appendix',
        type_label: 'Phụ Lục HĐ',
        file_name: 'Mau_Phu_Luc_Hop_Dong_Lao_Dong.docx',
        description: 'Văn bản phụ lục điều chỉnh mức lương, gia hạn thời gian làm việc hoặc chuyển đổi vị trí công tác.',
        is_default: true,
        updated_at: '2026-09-01T08:00:00.000Z'
      }
    ];
  },

  // Nạp toàn bộ danh sách mẫu (mặc định + tùy chỉnh)
  async loadAllTemplates() {
    const defaults = this.getDefaultTemplateDefs();
    let customs = [];

    try {
      const db = await this.getDB();
      if (db) {
        customs = await new Promise((resolve) => {
          try {
            const tx = db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
          } catch (_) {
            resolve([]);
          }
        });
      }
    } catch (e) {
      console.warn('[contractTemplateStore] load custom error:', e);
    }

    this.templates = [...defaults, ...customs];
    return this.templates;
  },

  // Lấy dữ liệu nhị phân ArrayBuffer của một mẫu
  async getTemplateBuffer(templateId) {
    const tpl = this.templates.find(t => t.id === templateId) || this.getDefaultTemplateDefs()[0];
    if (!tpl) throw new Error('Không tìm thấy mẫu hợp đồng');

    // Nếu là mẫu tùy chỉnh đã lưu trong IndexedDB
    if (tpl.file_data) {
      if (tpl.file_data instanceof ArrayBuffer) return tpl.file_data;
      if (typeof tpl.file_data === 'string') {
        // Base64 Data URL
        const base64 = tpl.file_data.includes(',') ? tpl.file_data.split(',')[1] : tpl.file_data;
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
      }
    }

    // Nếu là mẫu mặc định, tạo tự động bằng JSZip
    const blob = await this.createDefaultDocx(tpl.type || 'fixed_term');
    if (blob) {
      return await blob.arrayBuffer();
    }
    throw new Error('Không thể khởi tạo mẫu Word mặc định');
  },

  // Lưu mẫu tùy chỉnh mới do doanh nghiệp tải lên
  async saveCustomTemplate(name, type, file, description = '') {
    if (!file || !name) throw new Error('Vui lòng chọn file mẫu Word và nhập tên mẫu.');

    const fileDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const newTemplate = {
      id: `TPL-CUSTOM-${Date.now()}`,
      name: name.trim(),
      type: type || 'custom',
      type_label: this.getTypeLabel(type),
      file_name: file.name,
      file_size: file.size,
      file_data: fileDataUrl,
      description: description.trim() || `Mẫu Word tùy chỉnh tải lên ngày ${utils.formatDate(new Date().toISOString())}`,
      is_default: false,
      updated_at: new Date().toISOString()
    };

    const db = await this.getDB();
    if (db) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const req = store.put(newTemplate);
        req.onsuccess = resolve;
        req.onerror = reject;
      });
    }

    await this.loadAllTemplates();
    return newTemplate;
  },

  // Xóa mẫu tùy chỉnh
  async deleteTemplate(templateId) {
    const tpl = this.templates.find(t => t.id === templateId);
    if (!tpl || tpl.is_default) {
      throw new Error('Không thể xóa mẫu mặc định của hệ thống.');
    }

    const db = await this.getDB();
    if (db) {
      await new Promise((resolve) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const req = store.delete(templateId);
        req.onsuccess = resolve;
        req.onerror = resolve;
      });
    }
    await this.loadAllTemplates();
  },

  getTypeLabel(type) {
    const map = {
      fixed_term: 'HĐ Xác Định Thời Hạn',
      indefinite: 'HĐ Không Xác Định Thời Hạn',
      probation: 'HĐ Thử Việc',
      appendix: 'Phụ Lục Hợp Đồng',
      decision: 'Quyết Định Tiếp Nhận',
      custom: 'Mẫu Tùy Chỉnh Doanh Nghiệp'
    };
    return map[type] || 'Mẫu Khác';
  }
};

// 2. Bộ điều khiển giao diện Quản lý Mẫu & Tra cứu Merge Fields
const appContractTemplates = {
  initialized: false,

  // Danh mục trường trộn hiển thị trong Cheat Sheet tra cứu
  MERGE_FIELDS_METADATA: [
    { group: 'Thông tin hợp đồng', field: '<SoHD>', desc: 'Mã hoặc Số hợp đồng', sample: 'MISA01' },
    { group: 'Thông tin hợp đồng', field: '<LoaiHD>', desc: 'Loại hợp đồng lao động', sample: 'HĐ xác định thời hạn (12 tháng)' },
    { group: 'Thông tin hợp đồng', field: '<NgayKy>', desc: 'Ngày ký hợp đồng (dd/mm/yyyy)', sample: '01/01/2026' },
    { group: 'Thông tin hợp đồng', field: '<NgayBatDau>', desc: 'Ngày hợp đồng bắt đầu có hiệu lực', sample: '01/01/2026' },
    { group: 'Thông tin hợp đồng', field: '<NgayKetThuc>', desc: 'Ngày kết thúc hợp đồng', sample: '31/12/2026' },
    { group: 'Thông tin hợp đồng', field: '<NgayThuViec>', desc: 'Ngày bắt đầu thử việc', sample: '01/01/2026' },
    { group: 'Thông tin hợp đồng', field: '<NgayChinhThuc>', desc: 'Ngày làm chính thức', sample: '01/03/2026' },
    
    { group: 'Người lao động (Bên B)', field: '<HoVaTen>', desc: 'Họ và tên người lao động', sample: 'Huỳnh Thanh Long' },
    { group: 'Người lao động (Bên B)', field: '<HO_VA_TEN>', desc: 'Họ và tên viết IN HOA', sample: 'HUỲNH THANH LONG' },
    { group: 'Người lao động (Bên B)', field: '<MaNV>', desc: 'Mã nhân viên', sample: 'TH-1948' },
    { group: 'Người lao động (Bên B)', field: '<GioiTinh>', desc: 'Giới tính (Nam/Nữ)', sample: 'Nam' },
    { group: 'Người lao động (Bên B)', field: '<NgaySinh>', desc: 'Ngày tháng năm sinh', sample: '15/08/1990' },
    { group: 'Người lao động (Bên B)', field: '<SoCCCD>', desc: 'Số Căn cước công dân / CMND', sample: '001090012345' },
    { group: 'Người lao động (Bên B)', field: '<NgayCap>', desc: 'Ngày cấp thẻ CCCD/CMND', sample: '10/05/2021' },
    { group: 'Người lao động (Bên B)', field: '<NoiCap>', desc: 'Nơi cấp giấy tờ CCCD/CMND', sample: 'Cục Cảnh sát QLHC về TTXH' },
    { group: 'Người lao động (Bên B)', field: '<DiaChiThuongTru>', desc: 'Hộ khẩu thường trú', sample: 'P. Dịch Vọng Hậu, Cầu Giấy, Hà Nội' },
    { group: 'Người lao động (Bên B)', field: '<ChoOHienNay>', desc: 'Chỗ ở hiện nay', sample: 'P. Dịch Vọng Hậu, Cầu Giấy, Hà Nội' },
    { group: 'Người lao động (Bên B)', field: '<DienThoai>', desc: 'Số điện thoại di động', sample: '0901234567' },
    { group: 'Người lao động (Bên B)', field: '<Email>', desc: 'Email liên hệ', sample: 'longht@trunghaico.vn' },
    { group: 'Người lao động (Bên B)', field: '<DanToc>', desc: 'Dân tộc', sample: 'Kinh' },
    { group: 'Người lao động (Bên B)', field: '<QuocTich>', desc: 'Quốc tịch', sample: 'Việt Nam' },
    { group: 'Người lao động (Bên B)', field: '<SoTaiKhoan>', desc: 'Số tài khoản ngân hàng', sample: '19036888888' },
    { group: 'Người lao động (Bên B)', field: '<NganHang>', desc: 'Tên ngân hàng chi trả lương', sample: 'Techcombank' },

    { group: 'Vị trí & Đơn vị', field: '<PhongBan>', desc: 'Tên phòng ban / bộ phận', sample: 'Phòng Hành Chính Nhân Sự' },
    { group: 'Vị trí & Đơn vị', field: '<ChucDanh>', desc: 'Chức danh / vị trí công việc', sample: 'Chuyên viên Nhân sự' },
    { group: 'Vị trí & Đơn vị', field: '<DiaDiemLamViec>', desc: 'Địa điểm làm việc', sample: 'Trụ sở Tổng công ty' },
    { group: 'Vị trí & Đơn vị', field: '<ThoiGioLamViec>', desc: 'Thời giờ làm việc', sample: '8h/ngày, 44h/tuần' },

    { group: 'Tiền lương & Đãi ngộ', field: '<MucLuong>', desc: 'Mức lương cơ bản thỏa thuận (số)', sample: '15.000.000' },
    { group: 'Tiền lương & Đãi ngộ', field: '<MucLuongChu>', desc: 'Mức lương bằng chữ tiếng Việt', sample: 'Mười lăm triệu đồng chẵn' },
    { group: 'Tiền lương & Đãi ngộ', field: '<PhuCap>', desc: 'Mức phụ cấp lương', sample: '1.500.000' },
    { group: 'Tiền lương & Đãi ngộ', field: '<PhuCapChu>', desc: 'Mức phụ cấp bằng chữ', sample: 'Một triệu năm trăm nghìn đồng chẵn' },
    { group: 'Tiền lương & Đãi ngộ', field: '<TongLuong>', desc: 'Tổng thu nhập (Lương + Phụ cấp)', sample: '16.500.000' },
    { group: 'Tiền lương & Đãi ngộ', field: '<HinhThucTraLuong>', desc: 'Hình thức trả lương', sample: 'Chuyển khoản ngày 10 hàng tháng' },

    { group: 'Doanh nghiệp (Bên A)', field: '<TenCongTy>', desc: 'Tên đầy đủ của công ty', sample: 'CÔNG TY CP ĐẦU TƯ VÀ XÂY DỰNG TRUNG HẢI' },
    { group: 'Doanh nghiệp (Bên A)', field: '<MSTCongTy>', desc: 'Mã số thuế doanh nghiệp', sample: '0101234567' },
    { group: 'Doanh nghiệp (Bên A)', field: '<DiaChiCongTy>', desc: 'Địa chỉ trụ sở công ty', sample: 'Tòa nhà Trung Hải, Hà Nội' },
    { group: 'Doanh nghiệp (Bên A)', field: '<DienThoaiCongTy>', desc: 'Số điện thoại công ty', sample: '024.1234.5678' },
    { group: 'Doanh nghiệp (Bên A)', field: '<DaiDienCongTy>', desc: 'Người đại diện theo pháp luật', sample: 'Huỳnh Thanh Long' },
    { group: 'Doanh nghiệp (Bên A)', field: '<ChucVuDaiDien>', desc: 'Chức vụ người đại diện', sample: 'Tổng Giám Đốc' },

    { group: 'Thể thức ngày tháng', field: '<NgayHienTai>', desc: 'Ngày hiện tại (2 chữ số)', sample: '07' },
    { group: 'Thể thức ngày tháng', field: '<ThangHienTai>', desc: 'Tháng hiện tại (2 chữ số)', sample: '09' },
    { group: 'Thể thức ngày tháng', field: '<NamHienTai>', desc: 'Năm hiện tại (4 chữ số)', sample: '2026' },
    { group: 'Thể thức ngày tháng', field: '<NgayThangNamKy>', desc: 'Chuỗi ngày ký chuẩn thể thức', sample: 'Hà Nội, ngày 07 tháng 09 năm 2026' }
  ],

  // Mở modal Quản Lý Mẫu Word
  async openTemplatesModal() {
    await contractTemplateStore.loadAllTemplates();
    const modal = document.getElementById('modal-contract-templates');
    if (!modal) return;

    this.renderTemplatesList();
    this.renderMergeFieldsCheatSheet();
    modal.classList.add('active');
  },

  closeTemplatesModal() {
    const modal = document.getElementById('modal-contract-templates');
    if (modal) modal.classList.remove('active');
  },

  // Hiển thị danh sách mẫu hợp đồng Word
  renderTemplatesList() {
    const listEl = document.getElementById('contract-templates-list');
    if (!listEl) return;

    const templates = contractTemplateStore.templates || [];
    listEl.innerHTML = templates.map(tpl => `
      <div style="background: #FFFFFF; border: 1px solid var(--border-color); border-radius: 6px; padding: 12px 14px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
        <div style="display: flex; align-items: center; gap: 12px; overflow: hidden;">
          <div style="width: 36px; height: 36px; border-radius: 6px; background: #EFF6FF; color: #2563EB; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">
            <i class="fa-solid fa-file-word"></i>
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <strong style="color: var(--text-primary); font-size: 13.5px;">${tpl.name}</strong>
              <span class="badge ${tpl.is_default ? 'badge-navy' : 'badge-active'}" style="font-size: 11px;">
                ${tpl.type_label || 'Mẫu Word'}
              </span>
              ${tpl.is_default ? '<span style="font-size: 11px; color: var(--text-muted);"><i class="fa-solid fa-shield-halved"></i> Mặc định</span>' : ''}
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 3px;">
              ${tpl.description} &bull; <span style="color: var(--text-muted);">${tpl.file_name}</span>
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 6px; flex-shrink: 0; align-items: center;">
          <button type="button" class="btn btn-sm" onclick="appContractTemplates.closeTemplatesModal(); appContracts.openMergeStudio('${tpl.id}')" style="background: #2563EB; color: #FFFFFF; font-weight: 600; border: none; padding: 5px 12px; display: inline-flex; align-items: center; gap: 4px;" title="Chạy trộn dữ liệu nhân sự vào mẫu Word này">
            <i class="fa-solid fa-bolt"></i> Chạy Trộn HĐ
          </button>
          <button type="button" class="btn btn-sm btn-secondary" onclick="appContractTemplates.downloadTemplateFile('${tpl.id}')" title="Tải file mẫu .docx này về máy tính để xem và chỉnh sửa trong Word">
            <i class="fa-solid fa-download"></i> Tải Mẫu
          </button>
          ${!tpl.is_default ? `
            <button type="button" class="btn btn-sm btn-icon" onclick="appContractTemplates.deleteTemplate('${tpl.id}')" title="Xóa mẫu tùy chỉnh này" style="color: var(--accent-red);">
              <i class="fa-solid fa-trash"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `).join('');
  },

  // Hiển thị Cheat Sheet tra cứu trường trộn
  renderMergeFieldsCheatSheet(filterQuery = '') {
    const tbody = document.getElementById('contract-merge-fields-tbody');
    if (!tbody) return;

    const q = filterQuery.trim().toLowerCase();
    const filtered = this.MERGE_FIELDS_METADATA.filter(f => 
      !q || f.field.toLowerCase().includes(q) || f.desc.toLowerCase().includes(q) || f.group.toLowerCase().includes(q)
    );

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:16px; color:var(--text-muted);">Không tìm thấy trường trộn phù hợp</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(f => `
      <tr>
        <td style="font-size: 12px; color: var(--text-secondary); font-weight: 500;">${f.group}</td>
        <td>
          <code style="background: #EFF6FF; color: #2563EB; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 12.5px; border: 1px solid #BFDBFE;">${f.field}</code>
        </td>
        <td style="font-size: 12px; color: var(--text-primary);">${f.desc}</td>
        <td style="font-size: 11.5px; color: var(--text-muted);">${f.sample}</td>
        <td style="text-align: center;">
          <button type="button" class="btn btn-sm" onclick="appContractTemplates.copyMergeField('${f.field}')" style="background: #F8FAFC; border: 1px solid var(--border-color); padding: 2px 8px; font-size: 11px;" title="Sao chép trường trộn vào bộ nhớ tạm">
            <i class="fa-regular fa-copy"></i> Copy
          </button>
        </td>
      </tr>
    `).join('');
  },

  // Sao chép nhanh thẻ trộn vào clipboard
  copyMergeField(token) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(token).then(() => {
        utils.showToast(`Đã sao chép "${token}" vào bộ nhớ tạm! Dán vào Word để sử dụng.`, 'success');
      }).catch(() => {
        this.fallbackCopy(token);
      });
    } else {
      this.fallbackCopy(token);
    }
  },

  fallbackCopy(text) {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    utils.showToast(`Đã sao chép "${text}"! Dán vào Word để sử dụng.`, 'success');
  },

  // Xử lý tải lên mẫu Word tùy chỉnh của doanh nghiệp
  async handleUploadCustomTemplate(event) {
    event.preventDefault();
    const nameInput = document.getElementById('template-upload-name');
    const typeSelect = document.getElementById('template-upload-type');
    const fileInput = document.getElementById('template-upload-file');
    const descInput = document.getElementById('template-upload-desc');

    const name = nameInput?.value.trim();
    const type = typeSelect?.value || 'custom';
    const file = fileInput?.files?.[0];
    const desc = descInput?.value.trim();

    if (!name) {
      utils.showToast('Vui lòng nhập tên cho mẫu hợp đồng!', 'warning');
      return;
    }
    if (!file) {
      utils.showToast('Vui lòng chọn file mẫu Word dạng .docx!', 'warning');
      return;
    }
    if (!file.name.endsWith('.docx')) {
      utils.showToast('Hệ thống chỉ hỗ trợ file Word định dạng .docx!', 'warning');
      return;
    }

    try {
      const btn = document.getElementById('btn-template-upload-submit');
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải lên...'; }

      const newTemplate = await contractTemplateStore.saveCustomTemplate(name, type, file, desc);
      utils.showToast(`Đã thêm mẫu Word "${name}" thành công!`, 'success');

      // Reset form
      nameInput.value = '';
      fileInput.value = '';
      if (descInput) descInput.value = '';
      const label = document.getElementById('template-upload-file-label');
      if (label) label.textContent = 'Chưa chọn file mẫu Word';

      this.renderTemplatesList();
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Lưu Mẫu Hợp Đồng'; }

      // Gợi ý chuyển ngay sang giao diện Chạy Trộn Hợp Đồng với mẫu vừa tải lên
      setTimeout(() => {
        if (confirm(`Đã lưu mẫu "${name}" thành công!\n\nBạn có muốn Chạy Trộn Hợp Đồng (Mail Merge) ngay bằng mẫu này không?`)) {
          this.closeTemplatesModal();
          appContracts.openMergeStudio(newTemplate.id);
        }
      }, 300);
    } catch (err) {
      console.error(err);
      utils.showToast(err.message || 'Lỗi khi tải lên mẫu Word', 'error');
      const btn = document.getElementById('btn-template-upload-submit');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Lưu Mẫu Hợp Đồng'; }
    }
  },

  // Tải file mẫu .docx về máy tính
  async downloadTemplateFile(templateId) {
    try {
      const tpl = contractTemplateStore.templates.find(t => t.id === templateId);
      if (!tpl) return;

      const buffer = await contractTemplateStore.getTemplateBuffer(templateId);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      contractMergeEngine.downloadBlob(blob, tpl.file_name || `${tpl.name}.docx`);
      utils.showToast(`Đã tải file mẫu "${tpl.file_name}"!`, 'info');
    } catch (e) {
      console.error(e);
      utils.showToast('Lỗi khi tải file mẫu: ' + e.message, 'error');
    }
  },

  // Xóa mẫu tùy chỉnh
  async deleteTemplate(templateId) {
    if (!confirm('Bạn có chắc chắn muốn xóa mẫu hợp đồng này không?')) return;
    try {
      await contractTemplateStore.deleteTemplate(templateId);
      utils.showToast('Đã xóa mẫu hợp đồng thành công!', 'success');
      this.renderTemplatesList();
    } catch (e) {
      utils.showToast(e.message || 'Lỗi khi xóa mẫu', 'error');
    }
  }
};
