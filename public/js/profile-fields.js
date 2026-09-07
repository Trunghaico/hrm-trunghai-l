// ==========================================================================
// 115 MASTER PROFILE FIELDS DEFINITION & MODAL BUILDER
// Hệ thống định nghĩa 115 trường dữ liệu nhân sự chuẩn HRM Trung Hải
// ==========================================================================

const PROFILE_TABS = [
  { id: 'tab-p-personal', name: '1. Cá Nhân', icon: 'fa-user' },
  { id: 'tab-p-org', name: '2. Vị Trí & Tổ Chức', icon: 'fa-sitemap' },
  { id: 'tab-p-contract', name: '3. Hợp Đồng & Thời Gian', icon: 'fa-file-signature' },
  { id: 'tab-p-identity', name: '4. Giấy Tờ Tùy Thân', icon: 'fa-id-card' },
  { id: 'tab-p-contact', name: '5. Liên Hệ & Cư Trú', icon: 'fa-map-location-dot' },
  { id: 'tab-p-emergency', name: '6. Liên Hệ Khẩn Cấp', icon: 'fa-phone-volume' },
  { id: 'tab-p-education', name: '7. Trình Độ & Học Vấn', icon: 'fa-graduation-cap' },
  { id: 'tab-p-salary', name: '8. Lương, Ngân Hàng & BHXH', icon: 'fa-money-bill-wave' },
  { id: 'tab-p-account', name: '9. Tài Khoản & CKS', icon: 'fa-shield-halved' }
];

const MASTER_FIELDS_CONFIG = [
  // TAB 1: CÁ NHÂN (12 trường)
  { key: 'Mã nhân viên', tab: 'tab-p-personal', label: 'Mã nhân viên', type: 'text', required: true, placeholder: 'TH-xxxx' },
  { key: 'Họ và tên', tab: 'tab-p-personal', label: 'Họ và tên', type: 'text', required: true, placeholder: 'Nguyễn Văn A' },
  { key: 'Tên gọi khác', tab: 'tab-p-personal', label: 'Tên gọi khác', type: 'text', placeholder: 'Biệt danh / Tên khác' },
  { key: 'Giới tính', tab: 'tab-p-personal', label: 'Giới tính', type: 'select', options: ['Nam', 'Nữ', 'Khác'] },
  { key: 'Ngày sinh', tab: 'tab-p-personal', label: 'Ngày sinh', type: 'date' },
  { key: 'Nơi sinh', tab: 'tab-p-personal', label: 'Nơi sinh', type: 'text', placeholder: 'Tỉnh / Thành phố' },
  { key: 'Nguyên quán', tab: 'tab-p-personal', label: 'Nguyên quán', type: 'text', placeholder: 'Tỉnh / Thành phố' },
  { key: 'Tình trạng hôn nhân', tab: 'tab-p-personal', label: 'Tình trạng hôn nhân', type: 'select', options: ['Độc thân', 'Đã có gia đình', 'Ly hôn', 'Góa'] },
  { key: 'Dân tộc', tab: 'tab-p-personal', label: 'Dân tộc', type: 'text', defaultValue: 'Kinh' },
  { key: 'Tôn giáo', tab: 'tab-p-personal', label: 'Tôn giáo', type: 'text', defaultValue: 'Không' },
  { key: 'Quốc tịch', tab: 'tab-p-personal', label: 'Quốc tịch', type: 'text', defaultValue: 'Việt Nam' },
  { key: 'MST cá nhân', tab: 'tab-p-personal', label: 'MST cá nhân', type: 'text', placeholder: 'Mã số thuế cá nhân' },

  // TAB 2: VỊ TRÍ & TỔ CHỨC (18 trường)
  { key: 'Đơn vị công tác', tab: 'tab-p-org', label: 'Đơn vị công tác', type: 'text', required: true, placeholder: 'Ban / Phòng / Chi nhánh', colSpan: 2 },
  { key: 'Mã đơn vị công tác', tab: 'tab-p-org', label: 'Mã đơn vị công tác', type: 'text', placeholder: 'VD: BTGD.TH, QLDA...' },
  { key: 'Vị trí công việc', tab: 'tab-p-org', label: 'Vị trí công việc', type: 'text', required: true, placeholder: 'VD: Nhân viên IT, Kế toán...', colSpan: 2 },
  { key: 'Mã vị trí công việc', tab: 'tab-p-org', label: 'Mã vị trí công việc', type: 'text', placeholder: 'VD: THG_NV_IT, POS-01...' },
  { key: 'Chức danh', tab: 'tab-p-org', label: 'Chức danh', type: 'text', placeholder: 'Chức danh chuyên môn' },
  { key: 'Cấp', tab: 'tab-p-org', label: 'Cấp', type: 'select', options: ['Cấp 1', 'Cấp 2', 'Cấp 3', 'Cấp 4', 'Cấp 5', 'Cấp 6', 'Cấp 7', 'Cấp 8', 'Cấp 9', 'Cấp 10'] },
  { key: 'Bậc', tab: 'tab-p-org', label: 'Bậc', type: 'select', options: ['Bậc 1', 'Bậc 2', 'Bậc 3', 'Bậc 4', 'Bậc 5', 'Bậc 6', 'Bậc 7', 'Bậc 8', 'Bậc 9', 'Bậc 10'] },
  { key: 'Mã chấm công', tab: 'tab-p-org', label: 'Mã chấm công', type: 'text', placeholder: 'Mã trên máy chấm công' },
  { key: 'Quản lý trực tiếp', tab: 'tab-p-org', label: 'Quản lý trực tiếp', type: 'text', placeholder: 'Họ tên hoặc mã QL trực tiếp' },
  { key: 'Quản lý gián tiếp', tab: 'tab-p-org', label: 'Quản lý gián tiếp', type: 'text', placeholder: 'Họ tên hoặc mã QL gián tiếp' },
  { key: 'Người duyệt', tab: 'tab-p-org', label: 'Người duyệt', type: 'text', placeholder: 'Người duyệt hồ sơ' },
  { key: 'Địa điểm làm việc', tab: 'tab-p-org', label: 'Địa điểm làm việc', type: 'text', placeholder: 'Trụ sở công ty / Công trường...', colSpan: 2 },
  { key: 'Khu vực làm việc', tab: 'tab-p-org', label: 'Khu vực làm việc', type: 'text', placeholder: 'Khối Văn phòng / Dự án' },
  { key: 'Tính chất lao động', tab: 'tab-p-org', label: 'Tính chất lao động', type: 'select', options: ['Chính thức', 'Thử việc', 'Học việc', 'Thời vụ', 'Cộng tác viên'] },
  { key: 'Trạng thái lao động', tab: 'tab-p-org', label: 'Trạng thái lao động', type: 'select', options: ['Đang làm việc', 'Đã nghỉ việc', 'Nghỉ thai sản', 'Tạm hoãn'] },
  { key: 'Nhân sự khai thác', tab: 'tab-p-org', label: 'Nhân sự khai thác', type: 'text', placeholder: 'Cán bộ phụ trách khai thác' },
  { key: 'Nguồn ứng viên', tab: 'tab-p-org', label: 'Nguồn ứng viên', type: 'text', placeholder: 'Nội bộ, Tuyển dụng, Giới thiệu...' },
  { key: 'Số sổ QL lao động', tab: 'tab-p-org', label: 'Số sổ QL lao động', type: 'text', placeholder: 'Số sổ quản lý LĐ' },

  // TAB 3: HỢP ĐỒNG & THỜI GIAN (13 trường)
  { key: 'Loại hợp đồng', tab: 'tab-p-contract', label: 'Loại hợp đồng', type: 'select', options: [
    'Hợp đồng lao động không xác định thời hạn',
    'Hợp đồng xác định thời hạn',
    'Hợp đồng lao động xác định thời hạn (12 tháng)',
    'Hợp đồng lao động xác định thời hạn (24 tháng)',
    'Hợp đồng lao động xác định thời hạn (36 tháng)',
    'Hợp đồng thử việc',
    'Hợp đồng học việc',
    'Hợp đồng khoán việc / Thời vụ'
  ], colSpan: 2 },
  { key: 'Ngày học việc', tab: 'tab-p-contract', label: 'Ngày học việc', type: 'date' },
  { key: 'Ngày thử việc', tab: 'tab-p-contract', label: 'Ngày thử việc', type: 'date' },
  { key: 'Ngày chính thức', tab: 'tab-p-contract', label: 'Ngày chính thức', type: 'date' },
  { key: 'Thâm niên', tab: 'tab-p-contract', label: 'Thâm niên', type: 'text', placeholder: 'VD: 2 năm 4 tháng' },
  { key: 'Ngày có hiệu lực', tab: 'tab-p-contract', label: 'Ngày có hiệu lực', type: 'date' },
  { key: 'Ngày hết hiệu lực', tab: 'tab-p-contract', label: 'Ngày hết hiệu lực', type: 'text', placeholder: 'YYYY-MM-DD hoặc Không xác định' },
  { key: 'Nhóm lý do nghỉ', tab: 'tab-p-contract', label: 'Nhóm lý do nghỉ', type: 'select', options: ['', 'Cá nhân', 'Hết hạn hợp đồng', 'Nghỉ hưu', 'Chuyển công tác', 'Khác'] },
  { key: 'Lý do nghỉ', tab: 'tab-p-contract', label: 'Lý do nghỉ', type: 'text', placeholder: 'Lý do nghỉ việc chi tiết', colSpan: 2 },
  { key: 'Ngày nghỉ việc', tab: 'tab-p-contract', label: 'Ngày nghỉ việc', type: 'date' },
  { key: 'Ngày nghỉ hưu dự kiến', tab: 'tab-p-contract', label: 'Ngày nghỉ hưu dự kiến', type: 'date' },
  { key: 'Thuộc danh sách đen', tab: 'tab-p-contract', label: 'Thuộc danh sách đen', type: 'select', options: ['Không', 'Có'] },
  { key: 'Tham gia công đoàn', tab: 'tab-p-contract', label: 'Tham gia công đoàn', type: 'select', options: ['Có', 'Không'] },

  // TAB 4: GIẤY TỜ TÙY THÂN (9 trường)
  { key: 'Loại giấy tờ', tab: 'tab-p-identity', label: 'Loại giấy tờ', type: 'select', options: ['CCCD', 'CMND', 'Hộ chiếu'] },
  { key: 'Số CMND', tab: 'tab-p-identity', label: 'Số CMND / CCCD', type: 'text', placeholder: 'Số 12 hoặc 9 chữ số' },
  { key: 'Ngày cấp giấy tờ', tab: 'tab-p-identity', label: 'Ngày cấp giấy tờ', type: 'date' },
  { key: 'Nơi cấp giấy tờ', tab: 'tab-p-identity', label: 'Nơi cấp giấy tờ', type: 'text', placeholder: 'Cục Cảnh sát QLHC về TTXH', colSpan: 2 },
  { key: 'Ngày hết hạn giấy tờ', tab: 'tab-p-identity', label: 'Ngày hết hạn giấy tờ', type: 'date' },
  { key: 'Số Hộ chiếu', tab: 'tab-p-identity', label: 'Số Hộ chiếu', type: 'text', placeholder: 'Số Hộ chiếu (nếu có)' },
  { key: 'Ngày cấp Hộ chiếu', tab: 'tab-p-identity', label: 'Ngày cấp Hộ chiếu', type: 'date' },
  { key: 'Nơi cấp Hộ chiếu', tab: 'tab-p-identity', label: 'Nơi cấp Hộ chiếu', type: 'text', placeholder: 'Cục Quản lý xuất nhập cảnh' },
  { key: 'Ngày hết hạn Hộ chiếu', tab: 'tab-p-identity', label: 'Ngày hết hạn Hộ chiếu', type: 'date' },

  // TAB 5: LIÊN HỆ & CƯ TRÚ (26 trường)
  { key: 'ĐT di động', tab: 'tab-p-contact', label: 'ĐT di động', type: 'text', placeholder: '09xxxxxxxx' },
  { key: 'ĐT cơ quan', tab: 'tab-p-contact', label: 'ĐT cơ quan', type: 'text', placeholder: 'Máy bàn cơ quan' },
  { key: 'ĐT nhà riêng', tab: 'tab-p-contact', label: 'ĐT nhà riêng', type: 'text', placeholder: 'Số ĐT nhà riêng' },
  { key: 'ĐT khác', tab: 'tab-p-contact', label: 'ĐT khác', type: 'text', placeholder: 'Số ĐT phụ khác' },
  { key: 'Email cơ quan', tab: 'tab-p-contact', label: 'Email cơ quan', type: 'text', placeholder: 'ten@trunghaico.vn' },
  { key: 'Email cá nhân', tab: 'tab-p-contact', label: 'Email cá nhân', type: 'text', placeholder: 'ten@gmail.com' },
  { key: 'Email khác', tab: 'tab-p-contact', label: 'Email khác', type: 'text', placeholder: 'Email phụ khác' },
  { key: 'Skype', tab: 'tab-p-contact', label: 'Skype', type: 'text', placeholder: 'Tài khoản Skype' },
  { key: 'Facebook', tab: 'tab-p-contact', label: 'Facebook', type: 'text', placeholder: 'Link hoặc tên Facebook' },
  { key: 'Hộ khẩu thường trú', tab: 'tab-p-contact', label: 'Hộ khẩu thường trú', type: 'text', placeholder: 'Địa chỉ thường trú đầy đủ', colSpan: 3 },
  { key: 'Quốc gia (Thường trú)', tab: 'tab-p-contact', label: 'Quốc gia (Thường trú)', type: 'text', defaultValue: 'Việt Nam' },
  { key: 'Tỉnh/Thành phố (Thường trú)', tab: 'tab-p-contact', label: 'Tỉnh/TP (Thường trú)', type: 'text', placeholder: 'Tỉnh / Thành phố' },
  { key: 'Quận/Huyện (Thường trú)', tab: 'tab-p-contact', label: 'Quận/Huyện (Thường trú)', type: 'text', placeholder: 'Quận / Huyện' },
  { key: 'Phường/Xã (Thường trú)', tab: 'tab-p-contact', label: 'Phường/Xã (Thường trú)', type: 'text', placeholder: 'Phường / Xã' },
  { key: 'Số nhà, đường phố (Thường trú)', tab: 'tab-p-contact', label: 'Số nhà, đường phố (Thường trú)', type: 'text', placeholder: 'Số nhà, ngõ, đường...', colSpan: 2 },
  { key: 'Số sổ hộ khẩu', tab: 'tab-p-contact', label: 'Số sổ hộ khẩu', type: 'text', placeholder: 'Số sổ hộ khẩu' },
  { key: 'Mã số hộ gia đình', tab: 'tab-p-contact', label: 'Mã số hộ gia đình', type: 'text', placeholder: 'Mã số hộ gia đình' },
  { key: 'Là chủ hộ', tab: 'tab-p-contact', label: 'Là chủ hộ', type: 'select', options: ['', 'Có', 'Không'] },
  { key: 'Chỗ ở hiện nay', tab: 'tab-p-contact', label: 'Chỗ ở hiện nay', type: 'text', placeholder: 'Địa chỉ chỗ ở hiện nay đầy đủ', colSpan: 3 },
  { key: 'Quốc gia (Hiện nay)', tab: 'tab-p-contact', label: 'Quốc gia (Hiện nay)', type: 'text', defaultValue: 'Việt Nam' },
  { key: 'Tỉnh/Thành phố (Hiện nay)', tab: 'tab-p-contact', label: 'Tỉnh/TP (Hiện nay)', type: 'text', placeholder: 'Tỉnh / Thành phố' },
  { key: 'Quận/Huyện (Hiện nay)', tab: 'tab-p-contact', label: 'Quận/Huyện (Hiện nay)', type: 'text', placeholder: 'Quận / Huyện' },
  { key: 'Phường/Xã (Hiện nay)', tab: 'tab-p-contact', label: 'Phường/Xã (Hiện nay)', type: 'text', placeholder: 'Phường / Xã' },
  { key: 'Số nhà, đường phố (Hiện nay)', tab: 'tab-p-contact', label: 'Số nhà, đường phố (Hiện nay)', type: 'text', placeholder: 'Số nhà, đường phố...', colSpan: 2 },
  { key: 'TP gia đình', tab: 'tab-p-contact', label: 'TP gia đình', type: 'text', placeholder: 'Thành phần gia đình' },
  { key: 'TP bản thân', tab: 'tab-p-contact', label: 'TP bản thân', type: 'text', placeholder: 'Thành phần bản thân' },

  // TAB 6: LIÊN HỆ KHẨN CẤP (6 trường)
  { key: 'Họ và tên (LHKC)', tab: 'tab-p-emergency', label: 'Họ và tên người liên hệ', type: 'text', placeholder: 'Họ và tên người thân' },
  { key: 'Quan hệ (LHKC)', tab: 'tab-p-emergency', label: 'Mối quan hệ', type: 'select', options: ['Vợ', 'Chồng', 'Bố', 'Mẹ', 'Con', 'Anh/Chị/Em', 'Người thân', 'Bạn bè', 'Khác'] },
  { key: 'ĐT di động (LHKC)', tab: 'tab-p-emergency', label: 'ĐT di động', type: 'text', placeholder: 'Số điện thoại di động' },
  { key: 'ĐT nhà riêng (LHKC)', tab: 'tab-p-emergency', label: 'ĐT nhà riêng', type: 'text', placeholder: 'Số điện thoại nhà riêng' },
  { key: 'Email (LHKC)', tab: 'tab-p-emergency', label: 'Email', type: 'text', placeholder: 'Địa chỉ email' },
  { key: 'Địa chỉ (LHKC)', tab: 'tab-p-emergency', label: 'Địa chỉ người liên hệ', type: 'text', placeholder: 'Địa chỉ cư trú', colSpan: 3 },

  // TAB 7: TRÌNH ĐỘ & HỌC VẤN (7 trường)
  { key: 'Trình độ văn hóa', tab: 'tab-p-education', label: 'Trình độ văn hóa', type: 'select', options: ['12/12', '9/12', 'Đại học', 'Thạc sĩ', 'Tiến sĩ', 'Khác'] },
  { key: 'Trình độ đào tạo', tab: 'tab-p-education', label: 'Trình độ đào tạo', type: 'select', options: ['Đại học', 'Cao đẳng', 'Trung cấp', 'Thạc sĩ', 'Tiến sĩ', 'Sơ cấp', 'Nghề'] },
  { key: 'Nơi đào tạo', tab: 'tab-p-education', label: 'Nơi đào tạo (Trường/Cơ sở)', type: 'text', placeholder: 'Đại học Xây dựng, Bách khoa...', colSpan: 2 },
  { key: 'Khoa', tab: 'tab-p-education', label: 'Khoa / Bộ môn', type: 'text', placeholder: 'Khoa Xây dựng, CNTT, Kinh tế...' },
  { key: 'Chuyên ngành', tab: 'tab-p-education', label: 'Chuyên ngành', type: 'text', placeholder: 'Kỹ thuật công trình, Kế toán...' },
  { key: 'Năm tốt nghiệp', tab: 'tab-p-education', label: 'Năm tốt nghiệp', type: 'number', placeholder: 'VD: 2020' },
  { key: 'Xếp loại', tab: 'tab-p-education', label: 'Xếp loại tốt nghiệp', type: 'select', options: ['Xuất sắc', 'Giỏi', 'Khá', 'Trung bình khá', 'Trung bình'] },

  // TAB 8: LƯƠNG, NGÂN HÀNG & BHXH (19 trường)
  { key: 'Bậc lương', tab: 'tab-p-salary', label: 'Bậc lương', type: 'text', placeholder: 'VD: 1, 2, Bậc 3...' },
  { key: 'Hệ số lương', tab: 'tab-p-salary', label: 'Hệ số lương', type: 'number', placeholder: 'VD: 2.34' },
  { key: 'Lương cơ bản', tab: 'tab-p-salary', label: 'Lương cơ bản (VNĐ)', type: 'number', placeholder: 'VD: 10000000' },
  { key: 'Lương đóng BH', tab: 'tab-p-salary', label: 'Lương đóng BH (VNĐ)', type: 'number', placeholder: 'VD: 5000000' },
  { key: 'Tổng lương', tab: 'tab-p-salary', label: 'Tổng lương (VNĐ)', type: 'number', placeholder: 'VD: 15000000' },
  { key: 'TK ngân hàng', tab: 'tab-p-salary', label: 'Số TK ngân hàng', type: 'text', placeholder: 'Số tài khoản' },
  { key: 'Ngân hàng', tab: 'tab-p-salary', label: 'Ngân hàng', type: 'text', placeholder: 'Tên ngân hàng mở thẻ' },
  { key: 'Chi nhánh', tab: 'tab-p-salary', label: 'Chi nhánh ngân hàng', type: 'text', placeholder: 'Chi nhánh mở tài khoản' },
  { key: 'Tham gia bảo hiểm', tab: 'tab-p-salary', label: 'Tham gia bảo hiểm', type: 'select', options: ['Đang tham gia', 'Chưa tham gia', 'Đã dừng đóng'] },
  { key: 'Ngày tham gia BH', tab: 'tab-p-salary', label: 'Ngày tham gia BH', type: 'date' },
  { key: 'Số sổ BHXH', tab: 'tab-p-salary', label: 'Số sổ BHXH', type: 'text', placeholder: 'Số sổ BHXH' },
  { key: 'Mã số BHXH', tab: 'tab-p-salary', label: 'Mã số BHXH', type: 'text', placeholder: 'Mã số BHXH' },
  { key: 'Mã tỉnh cấp', tab: 'tab-p-salary', label: 'Mã tỉnh cấp', type: 'text', placeholder: 'Mã tỉnh cấp thẻ/sổ' },
  { key: 'Số thẻ BHYT', tab: 'tab-p-salary', label: 'Số thẻ BHYT', type: 'text', placeholder: 'Mã số trên thẻ BHYT' },
  { key: 'Nơi đăng ký KCB', tab: 'tab-p-salary', label: 'Nơi đăng ký KCB', type: 'text', placeholder: 'Bệnh viện / Cơ sở y tế KCB ban đầu', colSpan: 2 },
  { key: 'Tỷ lệ đóng BH', tab: 'tab-p-salary', label: 'Tỷ lệ đóng BH', type: 'text', defaultValue: '32%' },
  { key: 'Tỷ lệ đóng BHXH', tab: 'tab-p-salary', label: 'Tỷ lệ đóng BHXH', type: 'text', defaultValue: '25.5%' },
  { key: 'Tỷ lệ đóng BHYT', tab: 'tab-p-salary', label: 'Tỷ lệ đóng BHYT', type: 'text', defaultValue: '4.5%' },
  { key: 'Tỷ lệ đóng BHTN', tab: 'tab-p-salary', label: 'Tỷ lệ đóng BHTN', type: 'text', defaultValue: '2%' },

  // TAB 9: TÀI KHOẢN & CKS (5 trường)
  { key: 'ĐT tài khoản', tab: 'tab-p-account', label: 'ĐT tài khoản', type: 'text', placeholder: 'Số ĐT đăng nhập' },
  { key: 'Email tài khoản', tab: 'tab-p-account', label: 'Email tài khoản', type: 'text', placeholder: 'Email đăng nhập hệ thống' },
  { key: 'Trạng thái tài khoản', tab: 'tab-p-account', label: 'Trạng thái tài khoản', type: 'select', options: ['Kích hoạt', 'Chưa kích hoạt', 'Đã khóa'] },
  { key: 'Trạng thái chữ ký số', tab: 'tab-p-account', label: 'Trạng thái chữ ký số', type: 'select', options: ['', 'Đã cấp', 'Chưa cấp', 'Hết hạn', 'Tạm khóa'] },
  { key: 'Trạng thái hồ sơ cấp CKS', tab: 'tab-p-account', label: 'Trạng thái hồ sơ cấp CKS', type: 'select', options: ['', 'Đã duyệt', 'Chờ duyệt', 'Chưa nộp', 'Bị từ chối'] }
];

// Map from field key to HTML field id
function getFieldInputId(key) {
  return 'mf-' + encodeURIComponent(key).replace(/%/g, '_');
}

function getFieldDetailId(key) {
  return 'md-' + encodeURIComponent(key).replace(/%/g, '_');
}

// Render HTML for View Detail Modal (9 Tabs with 115 info items)
function buildDetailModalTabsHtml() {
  const tabNavHtml = PROFILE_TABS.map((tab, idx) => `
    <button type="button" class="modal-tab-btn det-tab-btn ${idx === 0 ? 'active' : ''}" data-tab="${tab.id}">
      <i class="fa-solid ${tab.icon}"></i> ${tab.name}
    </button>
  `).join('');

  const tabPanesHtml = PROFILE_TABS.map((tab, idx) => {
    const fields = MASTER_FIELDS_CONFIG.filter(f => f.tab === tab.id);
    const itemsHtml = fields.map(f => {
      const colStyle = f.colSpan && f.colSpan > 1 ? `style="grid-column: span ${f.colSpan};"` : '';
      return `
        <div class="info-item" ${colStyle}>
          <span class="info-label">${f.label}</span>
          <span class="info-value" id="${getFieldDetailId(f.key)}">-</span>
        </div>
      `;
    }).join('');

    return `
      <div class="tab-pane det-tab-pane ${idx === 0 ? 'active' : ''}" id="${tab.id}">
        <div class="info-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px;">
          ${itemsHtml}
        </div>
      </div>
    `;
  }).join('');

  const navContainer = document.getElementById('detail-modal-tab-container');
  const panesContainer = document.getElementById('detail-modal-panes-container');
  if (navContainer) navContainer.innerHTML = tabNavHtml;
  if (panesContainer) panesContainer.innerHTML = tabPanesHtml;

  return { tabNavHtml, tabPanesHtml };
}

// Render HTML for Form Modal (Add / Edit 115 fields across 9 Tabs)
function buildFormModalTabsHtml() {
  const tabNavHtml = PROFILE_TABS.map((tab, idx) => `
    <button type="button" class="modal-tab-btn form-tab-btn ${idx === 0 ? 'active' : ''}" data-tab="form-${tab.id}">
      <i class="fa-solid ${tab.icon}"></i> ${tab.name}
    </button>
  `).join('');

  // Generate datalists for auto-suggest
  const depts = (typeof appData !== 'undefined' && appData.departments) ? appData.departments : [];
  const positions = (typeof appData !== 'undefined' && appData.positions) ? appData.positions : [];
  
  let datalistsHtml = `
    <datalist id="dl-profile-departments">
      ${depts.map(d => `<option value="${d.department_name}">${d.department_id}</option>`).join('')}
    </datalist>
    <datalist id="dl-profile-positions">
      ${positions.map(p => `<option value="${p.position_name}">${p.position_id}</option>`).join('')}
    </datalist>
  `;

  const tabPanesHtml = PROFILE_TABS.map((tab, idx) => {
    const fields = MASTER_FIELDS_CONFIG.filter(f => f.tab === tab.id);
    const itemsHtml = fields.map(f => {
      const inputId = getFieldInputId(f.key);
      const colStyle = f.colSpan && f.colSpan > 1 ? `style="grid-column: span ${f.colSpan};"` : '';
      const reqMarker = f.required ? `<span class="req" style="color: var(--accent-red); margin-left: 2px;">*</span>` : '';
      const reqAttr = f.required ? 'required' : '';

      let controlHtml = '';
      if (f.type === 'select') {
        const opts = (f.options || []).map(opt => `<option value="${opt}">${opt === '' ? '-- Chưa chọn --' : opt}</option>`).join('');
        controlHtml = `<select id="${inputId}" class="form-control" ${reqAttr}>${opts}</select>`;
      } else if (f.type === 'date') {
        controlHtml = `<input type="date" id="${inputId}" class="form-control" ${reqAttr}>`;
      } else if (f.type === 'number') {
        controlHtml = `<input type="number" id="${inputId}" class="form-control" placeholder="${f.placeholder || ''}" ${reqAttr}>`;
      } else if (f.key === 'Đơn vị công tác') {
        controlHtml = `<input type="text" id="${inputId}" class="form-control" placeholder="${f.placeholder || ''}" list="dl-profile-departments" ${reqAttr}>`;
      } else if (f.key === 'Vị trí công việc') {
        controlHtml = `<input type="text" id="${inputId}" class="form-control" placeholder="${f.placeholder || ''}" list="dl-profile-positions" ${reqAttr}>`;
      } else {
        controlHtml = `<input type="text" id="${inputId}" class="form-control" placeholder="${f.placeholder || ''}" ${reqAttr}>`;
      }

      return `
        <div class="form-group" ${colStyle} style="margin-bottom: 12px;">
          <label for="${inputId}" style="font-size: 12px; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 4px;">
            ${f.label} ${reqMarker}
          </label>
          ${controlHtml}
        </div>
      `;
    }).join('');

    return `
      <div class="form-tab-pane ${idx === 0 ? 'active' : ''}" id="form-${tab.id}" style="${idx === 0 ? 'display: block;' : 'display: none;'}">
        <div class="form-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px;">
          ${itemsHtml}
        </div>
      </div>
    `;
  }).join('');

  const fullPanesHtml = datalistsHtml + tabPanesHtml;

  const navContainer = document.getElementById('form-modal-tab-container');
  const panesContainer = document.getElementById('form-modal-panes-container');
  if (navContainer) navContainer.innerHTML = tabNavHtml;
  if (panesContainer) panesContainer.innerHTML = fullPanesHtml;

  // Add auto-fill synchronization for Dept & Position
  setTimeout(() => {
    const deptInput = document.getElementById(getFieldInputId('Đơn vị công tác'));
    const deptIdInput = document.getElementById(getFieldInputId('Mã đơn vị công tác'));
    if (deptInput && deptIdInput) {
      deptInput.addEventListener('change', () => {
        const val = deptInput.value.trim();
        const depts = (typeof appData !== 'undefined' && appData.departments) ? appData.departments : [];
        const match = depts.find(d => d.department_name.toLowerCase() === val.toLowerCase() || d.department_id.toLowerCase() === val.toLowerCase());
        if (match) {
          deptInput.value = match.department_name;
          deptIdInput.value = match.department_id;
        }
      });
    }

    const posInput = document.getElementById(getFieldInputId('Vị trí công việc'));
    const posIdInput = document.getElementById(getFieldInputId('Mã vị trí công việc'));
    const jobTitleInput = document.getElementById(getFieldInputId('Chức danh'));
    if (posInput && posIdInput) {
      posInput.addEventListener('change', () => {
        const val = posInput.value.trim();
        const positions = (typeof appData !== 'undefined' && appData.positions) ? appData.positions : [];
        const match = positions.find(p => p.position_name.toLowerCase() === val.toLowerCase() || p.position_id.toLowerCase() === val.toLowerCase());
        if (match) {
          posInput.value = match.position_name;
          posIdInput.value = match.position_id;
          if (jobTitleInput && !jobTitleInput.value) {
            jobTitleInput.value = match.position_name;
          }
        }
      });
    }
  }, 50);

  return { tabNavHtml, tabPanesHtml: fullPanesHtml };
}

// Populate values in View Detail Modal
function fillDetailModalData(masterData) {
  if (!masterData) masterData = {};
  MASTER_FIELDS_CONFIG.forEach(f => {
    const el = document.getElementById(getFieldDetailId(f.key));
    if (!el) return;
    let val = masterData[f.key];
    if (val === undefined || val === null || val === '') {
      el.textContent = '-';
      el.style.color = 'var(--text-muted)';
    } else if (typeof val === 'number' && (f.key.includes('lương') || f.key.includes('Lương'))) {
      el.textContent = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
      el.style.color = '#059669';
      el.style.fontWeight = '700';
    } else {
      el.textContent = String(val);
      el.style.color = 'var(--text-primary)';
      el.style.fontWeight = '500';
    }
  });
}

// Populate values in Form Modal (Add / Edit)
function fillFormModalData(masterData = {}, isEdit = false) {
  MASTER_FIELDS_CONFIG.forEach(f => {
    const el = document.getElementById(getFieldInputId(f.key));
    if (!el) return;
    let val = masterData[f.key];

    if (val === undefined || val === null) {
      val = f.defaultValue !== undefined ? f.defaultValue : '';
    }

    if (f.key === 'Mã nhân viên') {
      el.value = val || '';
      el.readOnly = false; // Luôn cho phép điều chỉnh mã
    } else {
      el.value = val;
    }
  });
}

// Collect all 115 field values from Form
function collectFormModalData() {
  const data = {};
  MASTER_FIELDS_CONFIG.forEach(f => {
    const el = document.getElementById(getFieldInputId(f.key));
    if (!el) {
      data[f.key] = '';
      return;
    }
    let val = el.value !== undefined ? el.value.trim() : '';
    if (f.type === 'number') {
      data[f.key] = val === '' ? 0 : parseFloat(val) || 0;
    } else {
      data[f.key] = val;
    }
  });
  return data;
}

// Helper: Wire tab click switching for modal tabs
function initModalTabSwitching() {
  // 1. Detail modal
  const detailModal = document.getElementById('modal-employee-detail');
  if (detailModal) {
    const detBtns = detailModal.querySelectorAll('.det-tab-btn');
    detBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = btn.getAttribute('data-tab');
        detBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        detailModal.querySelectorAll('.det-tab-pane').forEach(p => {
          const isActive = p.id === targetId;
          p.classList.toggle('active', isActive);
          p.style.display = isActive ? 'block' : 'none';
        });
      });
    });
  }

  // 2. Form modal
  const formModal = document.getElementById('modal-employee-form');
  if (formModal) {
    const formBtns = formModal.querySelectorAll('.form-tab-btn');
    formBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = btn.getAttribute('data-tab');
        formBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        formModal.querySelectorAll('.form-tab-pane').forEach(p => {
          const isActive = p.id === targetId;
          p.classList.toggle('active', isActive);
          p.style.display = isActive ? 'block' : 'none';
        });
      });
    });
  }
}
