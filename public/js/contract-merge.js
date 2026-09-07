// ==========================================================================
// CONTRACT MAIL MERGE ENGINE (ĐỘNG CƠ IN VÀ TRỘN DỮ LIỆU HỢP ĐỒNG WORD)
// HRM Trung Hải Enterprise Edition
// Hỗ trợ trường trộn chuẩn MISA: <HoVaTen>, <NgaySinh>, <ChucDanh>, <MucLuong>...
// ==========================================================================

// 1. Hàm quy đổi số tiền thành chữ tiếng Việt chuẩn ngữ pháp
function numberToVietnameseWords(num) {
  if (num === 0) return "Không đồng chẵn";
  if (!num || isNaN(num)) return "";
  
  num = Math.round(Number(num));
  const digits = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  const units = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];

  function readThree(a, b, c, readZeroHundreds) {
    let res = "";
    if (a !== 0 || readZeroHundreds) {
      res += digits[a] + " trăm ";
      if (b === 0 && c !== 0) res += "lẻ ";
    }
    if (b !== 0 && b !== 1) {
      res += digits[b] + " mươi ";
      if (b === 0 && c !== 0) res += "lẻ ";
    }
    if (b === 1) res += "mười ";
    switch (c) {
      case 1:
        if (b > 1) res += "mốt ";
        else res += digits[c] + " ";
        break;
      case 5:
        if (b > 0) res += "lăm ";
        else res += digits[c] + " ";
        break;
      default:
        if (c !== 0) res += digits[c] + " ";
        break;
    }
    return res;
  }

  let str = String(num);
  let groups = [];
  while (str.length > 0) {
    groups.push(str.slice(-3));
    str = str.slice(0, -3);
  }

  let result = "";
  for (let i = groups.length - 1; i >= 0; i--) {
    let g = groups[i].padStart(3, '0');
    let a = Number(g[0]), b = Number(g[1]), c = Number(g[2]);
    if (a === 0 && b === 0 && c === 0) continue;
    let readZeroHundreds = (i < groups.length - 1);
    let sub = readThree(a, b, c, readZeroHundreds);
    result += sub + units[i] + " ";
  }

  result = result.trim().replace(/\s+/g, ' ');
  if (!result) return "Không đồng";
  return result.charAt(0).toUpperCase() + result.slice(1) + " đồng chẵn";
}

// Bổ sung vào utils nếu có
if (typeof utils !== 'undefined') {
  utils.numberToWords = numberToVietnameseWords;
}

// 2. Động cơ Trộn Dữ Liệu Hợp Đồng (Contract Merge Engine)
const contractMergeEngine = {

  // Trích xuất toàn bộ bảng dữ liệu trường trộn MISA & HRM
  buildMergeData(contract, employee = {}, company = {}) {
    const c = contract || {};
    const e = employee || {};
    const comp = company || (typeof appData !== 'undefined' && appData.company) || {};

    const salaryNum = parseFloat(c.salary) || parseFloat(e.base_salary) || 0;
    const allowanceNum = parseFloat(c.allowance) || 0;
    const totalSalaryNum = salaryNum + allowanceNum;

    const today = new Date();
    const curDay = String(today.getDate()).padStart(2, '0');
    const curMonth = String(today.getMonth() + 1).padStart(2, '0');
    const curYear = String(today.getFullYear());

    const fullName = c.full_name || e.full_name || e['Họ và tên'] || c.employee_id || '';
    const empId = c.employee_id || e.employee_id || '';
    const contractId = c.contract_id || `HD-${empId}`;

    const signDateFormatted = utils.formatDate(c.sign_date || c.start_date || c.effective_date || today.toISOString().split('T')[0]);
    const startDateFormatted = utils.formatDate(c.start_date || c.effective_date || today.toISOString().split('T')[0]);
    const endDateFormatted = (c.end_date && c.end_date !== 'Không xác định' && c.end_date !== '-') 
      ? utils.formatDate(c.end_date || c.expiry_date) 
      : 'Không xác định thời hạn';

    const baseMap = {
      // 1. Thông tin hợp đồng
      SoHD: contractId,
      SoHopDong: contractId,
      LoaiHD: c.contract_type || 'Hợp đồng lao động xác định thời hạn',
      LoaiHopDong: c.contract_type || 'Hợp đồng lao động xác định thời hạn',
      NgayKy: signDateFormatted,
      NgayKyHD: signDateFormatted,
      NgayBatDau: startDateFormatted,
      NgayHieuLuc: startDateFormatted,
      NgayKetThuc: endDateFormatted,
      NgayHetHan: endDateFormatted,
      NgayThuViec: utils.formatDate(c.trial_start_date || e.trial_start_date || e.probation_start_date || ''),
      NgayChinhThuc: utils.formatDate(c.official_date || e.official_date || ''),
      TrangThaiHD: c.contract_status || 'HIỆU LỰC',
      GhiChuHD: c.notes || 'Không có ghi chú',

      // 2. Thông tin nhân sự (Người lao động - Bên B)
      HoVaTen: fullName,
      TenNhanVien: fullName,
      HO_VA_TEN: fullName.toUpperCase(),
      MaNV: empId,
      MaNhanVien: empId,
      GioiTinh: e.gender || e['Giới tính'] || 'Nam',
      NgaySinh: utils.formatDate(e.date_of_birth || e['Ngày sinh'] || ''),
      NamSinh: (e.date_of_birth || e['Ngày sinh']) ? String(utils.formatDate(e.date_of_birth || e['Ngày sinh'])).split('/').pop() : '',
      SoCMND: e.id_number || e['Số CMND'] || e.tax_code || '',
      SoCCCD: e.id_number || e['Số CMND'] || e.tax_code || '',
      NgayCap: utils.formatDate(e.id_issue_date || e['Ngày cấp giấy tờ'] || '10/05/2021'),
      NgayCapCCCD: utils.formatDate(e.id_issue_date || e['Ngày cấp giấy tờ'] || '10/05/2021'),
      NoiCap: e.id_issue_place || e['Nơi cấp giấy tờ'] || 'Cục Cảnh sát QLHC về TTXH',
      NoiCapCCCD: e.id_issue_place || e['Nơi cấp giấy tờ'] || 'Cục Cảnh sát QLHC về TTXH',
      DiaChiThuongTru: e.permanent_address || e['Hộ khẩu thường trú'] || e.address || 'Hà Nội',
      HoKhau: e.permanent_address || e['Hộ khẩu thường trú'] || e.address || 'Hà Nội',
      ChoOHienNay: e.current_address || e['Chỗ ở hiện nay'] || e.address || e.permanent_address || 'Hà Nội',
      DiaChiTamTru: e.current_address || e['Chỗ ở hiện nay'] || e.address || 'Hà Nội',
      DienThoai: e.mobile_phone || e['ĐT di động'] || '',
      SoDienThoai: e.mobile_phone || e['ĐT di động'] || '',
      Email: e.work_email || e['Email cơ quan'] || e.personal_email || '',
      EmailCoQuan: e.work_email || e['Email cơ quan'] || '',
      DanToc: e.ethnicity || e['Dân tộc'] || 'Kinh',
      QuocTich: e.nationality || e['Quốc tịch'] || 'Việt Nam',
      TrinhDo: e.education_level || e['Trình độ đào tạo'] || 'Đại học',
      TrinhDoHocVan: e.education_level || e['Trình độ đào tạo'] || 'Đại học',
      MST: e.personal_tax_code || e['MST cá nhân'] || '',
      MaSoThue: e.personal_tax_code || e['MST cá nhân'] || '',
      SoBHXH: e.social_insurance_no || e['Số sổ BHXH'] || '',
      SoTaiKhoan: e.bank_account_no || e['Số tài khoản'] || '',
      TaiKhoanNganHang: e.bank_account_no || e['Số tài khoản'] || '',
      NganHang: e.bank_name || e['Tên ngân hàng'] || 'Techcombank',
      TenNganHang: e.bank_name || e['Tên ngân hàng'] || 'Techcombank',
      ChiNhanhNganHang: e.bank_branch || e['Chi nhánh ngân hàng'] || 'Hội sở',

      // 3. Vị trí Công việc & Đơn vị
      PhongBan: c.department_name || e.department_name || e['Đơn vị công tác'] || 'Khối Văn Phòng',
      DonViCongTac: c.department_name || e.department_name || e['Đơn vị công tác'] || 'Khối Văn Phòng',
      ChucDanh: c.job_title || e.job_title || e['Vị trí công việc'] || 'Nhân viên',
      ChucVu: c.job_title || e.job_title || e['Vị trí công việc'] || 'Nhân viên',
      ViTri: c.job_title || e.job_title || e['Vị trí công việc'] || 'Nhân viên',
      ViTriCongViec: c.job_title || e.job_title || e['Vị trí công việc'] || 'Nhân viên',
      DiaDiemLamViec: c.work_location || e.work_location || 'Trụ sở Tổng công ty',
      ThoiGioLamViec: '8 giờ/ngày, 44 giờ/tuần (từ thứ Hai đến thứ Bảy)',

      // 4. Lương & Chế độ đãi ngộ
      MucLuong: utils.formatNumber(salaryNum),
      LuongCoBan: utils.formatNumber(salaryNum),
      MucLuongChu: numberToVietnameseWords(salaryNum),
      LuongBangChu: numberToVietnameseWords(salaryNum),
      PhuCap: utils.formatNumber(allowanceNum),
      PhuCapLuong: utils.formatNumber(allowanceNum),
      PhuCapChu: numberToVietnameseWords(allowanceNum),
      TongLuong: utils.formatNumber(totalSalaryNum),
      HinhThucTraLuong: 'Chuyển khoản vào tài khoản ngân hàng của Người lao động vào ngày 10 hàng tháng',

      // 5. Thông tin Doanh nghiệp / Người sử dụng lao động (Bên A)
      TenCongTy: comp.full_name || 'CÔNG TY CỔ PHẦN ĐẦU TƯ VÀ XÂY DỰNG TRUNG HẢI',
      CongTy: comp.full_name || 'CÔNG TY CỔ PHẦN ĐẦU TƯ VÀ XÂY DỰNG TRUNG HẢI',
      TenThuongMai: comp.brand_name || 'TRUNG HẢI',
      MSTCongTy: comp.tax_code || '0101234567',
      MaSoThueCongTy: comp.tax_code || '0101234567',
      DiaChiCongTy: comp.address || 'Tòa nhà Trung Hải, Hà Nội',
      DienThoaiCongTy: comp.phone || '024.1234.5678',
      EmailCongTy: comp.email || 'contact@trunghaico.vn',
      DaiDienCongTy: c.signer_name || 'Huỳnh Thanh Long',
      NguoiDaiDien: c.signer_name || 'Huỳnh Thanh Long',
      ChucVuDaiDien: 'Tổng Giám Đốc',
      QuocTichDaiDien: 'Việt Nam',

      // 6. Ngày tháng ký & Thể thức văn bản
      NgayHienTai: curDay,
      ThangHienTai: curMonth,
      NamHienTai: curYear,
      NgayThangNamKy: `Hà Nội, ngày ${curDay} tháng ${curMonth} năm ${curYear}`
    };

    // Hỗ trợ thêm các biến thể viết chữ thường, snake_case và có dấu ngoặc
    const fullDict = { ...baseMap };
    Object.keys(baseMap).forEach(key => {
      fullDict[key.toLowerCase()] = baseMap[key];
      fullDict[`<${key}>`] = baseMap[key];
      fullDict[`{${key}}`] = baseMap[key];
      fullDict[`{{${key}}}`] = baseMap[key];
    });

    return fullDict;
  },

  // Tiền xử lý XML của Word: Chuẩn hóa các run bị ngắt vụn và biến <Tag> -> {Tag}
  preprocessDocumentXml(xmlString) {
    if (!xmlString || typeof xmlString !== 'string') return xmlString;

    let cleaned = xmlString;

    // Gộp các trường bị phân tán giữa các thẻ <w:r> và <w:t>
    // Ví dụ: <w:t>&lt;Ho</w:t></w:r><w:r><w:t>VaTen&gt;</w:t>
    cleaned = cleaned.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (pBlock) => {
      return pBlock.replace(/(?:&lt;|<|&laquo;|«)([\s\S]*?)(?:&gt;|>|&raquo;|»)/g, (match, inner) => {
        const pureFieldName = inner.replace(/<[^>]+>/g, '').trim();
        if (/^[a-zA-Z0-9_]+$/.test(pureFieldName)) {
          return `{${pureFieldName}}`;
        }
        return match;
      });
    });

    // Chuyển đổi mọi &lt;Field&gt; còn lại thành {Field}
    cleaned = cleaned.replace(/&lt;([a-zA-Z0-9_]+)&gt;/g, '{$1}');
    cleaned = cleaned.replace(/&laquo;([a-zA-Z0-9_]+)&raquo;/g, '{$1}');
    cleaned = cleaned.replace(/<([a-zA-Z0-9_]+)>/g, '{$1}');
    cleaned = cleaned.replace(/«([a-zA-Z0-9_]+)»/g, '{$1}');

    return cleaned;
  },

  // Trộn dữ liệu vào template Word (.docx) và trả về Blob file kết quả
  async mergeDocx(templateBuffer, mergeData) {
    // Ưu tiên 1: Sử dụng docxtemplater + PizZip nếu có
    if (typeof window.docxtemplater !== 'undefined' && typeof window.PizZip !== 'undefined') {
      try {
        const zip = new window.PizZip(templateBuffer);

        // Tiền xử lý XML trong document, header, footer
        const fileNames = Object.keys(zip.files);
        fileNames.forEach(fn => {
          if (fn.startsWith('word/') && fn.endsWith('.xml')) {
            const rawXml = zip.file(fn).asText();
            const preprocessed = this.preprocessDocumentXml(rawXml);
            zip.file(fn, preprocessed);
          }
        });

        const doc = new window.docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
          delimiters: { start: '{', end: '}' }
        });

        doc.render(mergeData);

        const out = doc.getZip().generate({
          type: 'blob',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          compression: 'DEFLATE'
        });
        return out;
      } catch (err) {
        console.warn('[contractMergeEngine] docxtemplater error, trying native JSZip fallback:', err);
      }
    }

    // Ưu tiên 2: Fallback bằng JSZip thuần (thay thế trực tiếp các token trong word/document.xml)
    if (typeof window.JSZip !== 'undefined') {
      try {
        const zip = await window.JSZip.loadAsync(templateBuffer);
        const fileNames = Object.keys(zip.files);

        for (const fn of fileNames) {
          if (fn.startsWith('word/') && fn.endsWith('.xml')) {
            let xmlText = await zip.file(fn).async('string');
            xmlText = this.preprocessDocumentXml(xmlText);

            // Thay thế tất cả {key} bằng giá trị tương ứng
            Object.keys(mergeData).forEach(key => {
              if (key.includes('<') || key.includes('{') || key === key.toLowerCase()) return;
              const val = String(mergeData[key] ?? '');
              const escapedVal = val
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
              
              const regex = new RegExp(`\\{${key}\\}`, 'gi');
              xmlText = xmlText.replace(regex, escapedVal);
            });

            zip.file(fn, xmlText);
          }
        }

        const out = await zip.generateAsync({
          type: 'blob',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          compression: 'DEFLATE'
        });
        return out;
      } catch (err) {
        console.error('[contractMergeEngine] JSZip fallback error:', err);
        throw err;
      }
    }

    throw new Error('Chưa tải được thư viện xử lý Word (.docx). Vui lòng kiểm tra kết nối mạng!');
  },

  // Trộn hàng loạt và đóng gói thành file ZIP
  async batchMerge(contractsList, templateBuffer, onProgress) {
    if (!Array.isArray(contractsList) || contractsList.length === 0) {
      throw new Error('Danh sách hợp đồng trống.');
    }

    if (typeof window.JSZip === 'undefined') {
      throw new Error('Thư viện nén JSZip chưa được tải.');
    }

    const zipOut = new window.JSZip();
    const employees = (typeof appData !== 'undefined' && appData.employees) ? appData.employees : [];
    const company = (typeof appData !== 'undefined' && appData.company) ? appData.company : {};
    const total = contractsList.length;

    for (let i = 0; i < total; i++) {
      const contract = contractsList[i];
      const emp = employees.find(e => e.employee_id === contract.employee_id) || {};
      const mergeData = this.buildMergeData(contract, emp, company);

      if (onProgress) {
        onProgress(i + 1, total, mergeData.HoVaTen || contract.contract_id);
      }

      // Tạo file docx cho nhân viên này
      const docxBlob = await this.mergeDocx(templateBuffer, mergeData);
      
      // Tên file an toàn: HD_MaNV_TenKhongDau.docx
      const safeName = (mergeData.HoVaTen || 'Nhan_Vien')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .replace(/_+/g, '_');
      
      const fileName = `HD_${contract.contract_id}_${safeName}.docx`;
      zipOut.file(fileName, docxBlob);
    }

    // Nén toàn bộ thành file .zip
    const zipBlob = await zipOut.generateAsync({
      type: 'blob',
      mimeType: 'application/zip',
      compression: 'DEFLATE'
    });

    return zipBlob;
  },

  // Tải file xuống máy khách
  downloadBlob(blob, filename) {
    if (typeof window.saveAs !== 'undefined') {
      window.saveAs(blob, filename);
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
};
