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
  { id: 'tab-p-allowance', name: '9. Phụ Cấp & Giảm Trừ', icon: 'fa-hand-holding-dollar' },
  { id: 'tab-p-account', name: '10. Tài Khoản & CKS', icon: 'fa-shield-halved' }
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

  // TAB 8: LƯƠNG, NGÂN HÀNG & BHXH (Cập nhật chuẩn theo file Danh sách nhân viên.xlsx)
  { key: 'Bậc lương', tab: 'tab-p-salary', label: 'Bậc lương', type: 'text', placeholder: 'VD: 1, 2, Bậc 3...' },
  { key: 'Hệ số lương', tab: 'tab-p-salary', label: 'Hệ số lương', type: 'number', placeholder: 'VD: 2.34' },
  { key: 'Lương cơ bản', tab: 'tab-p-salary', label: 'Lương cơ bản (VNĐ)', type: 'number', placeholder: 'VD: 10000000' },
  { key: 'Tỷ lệ hưởng lương', tab: 'tab-p-salary', label: 'Tỷ lệ hưởng lương (%)', type: 'text', placeholder: 'VD: 100%, 85%...' },
  { key: 'Lương đóng BH', tab: 'tab-p-salary', label: 'Lương đóng BH (VNĐ)', type: 'number', placeholder: 'VD: 5000000' },
  { key: 'Tổng lương', tab: 'tab-p-salary', label: 'Tổng lương (VNĐ)', type: 'number', placeholder: 'VD: 15000000' },
  { key: 'TK ngân hàng', tab: 'tab-p-salary', label: 'Số TK ngân hàng', type: 'text', placeholder: 'Số tài khoản' },
  { key: 'Ngân hàng', tab: 'tab-p-salary', label: 'Ngân hàng', type: 'text', placeholder: 'Tên ngân hàng mở thẻ' },
  { key: 'Chi nhánh', tab: 'tab-p-salary', label: 'Chi nhánh ngân hàng', type: 'text', placeholder: 'Chi nhánh mở tài khoản' },
  { key: 'Thuế suất', tab: 'tab-p-salary', label: 'Thuế suất', type: 'text', placeholder: 'Theo biểu lũy tiến / 10%' },
  { key: 'Số người phụ thuộc', tab: 'tab-p-salary', label: 'Số người phụ thuộc', type: 'number', placeholder: '0' },
  { key: 'Giảm trừ bản thân', tab: 'tab-p-salary', label: 'Giảm trừ bản thân', type: 'select', options: ['Có', 'Không'] },
  { key: 'Tham gia công đoàn', tab: 'tab-p-salary', label: 'Tham gia công đoàn', type: 'select', options: ['Có', 'Không'] },
  { key: 'Tham gia bảo hiểm', tab: 'tab-p-salary', label: 'Tham gia bảo hiểm', type: 'select', options: ['Đang tham gia', 'Không tham gia', 'Chưa tham gia', 'Đã dừng đóng'] },
  { key: 'Tỷ lệ đóng BHXH của NV', tab: 'tab-p-salary', label: 'Tỷ lệ đóng BHXH của NV (%)', type: 'text', defaultValue: '8%' },
  { key: 'Tỷ lệ đóng BHYT của NV', tab: 'tab-p-salary', label: 'Tỷ lệ đóng BHYT của NV (%)', type: 'text', defaultValue: '1.5%' },
  { key: 'Tỷ lệ đóng BHTN của NV', tab: 'tab-p-salary', label: 'Tỷ lệ đóng BHTN của NV (%)', type: 'text', defaultValue: '1%' },
  { key: 'Tỷ lệ đóng BHXH của DN', tab: 'tab-p-salary', label: 'Tỷ lệ đóng BHXH của DN (%)', type: 'text', defaultValue: '17.5%' },
  { key: 'Tỷ lệ đóng BHYT của DN', tab: 'tab-p-salary', label: 'Tỷ lệ đóng BHYT của DN (%)', type: 'text', defaultValue: '3%' },
  { key: 'Tỷ lệ đóng BHTN của DN', tab: 'tab-p-salary', label: 'Tỷ lệ đóng BHTN của DN (%)', type: 'text', defaultValue: '1%' },
  { key: 'Ngày tham gia BH', tab: 'tab-p-salary', label: 'Ngày tham gia BH', type: 'date' },
  { key: 'Số sổ BHXH', tab: 'tab-p-salary', label: 'Số sổ BHXH', type: 'text', placeholder: 'Số sổ BHXH' },
  { key: 'Mã số BHXH', tab: 'tab-p-salary', label: 'Mã số BHXH', type: 'text', placeholder: 'Mã số BHXH' },
  { key: 'Mã tỉnh cấp', tab: 'tab-p-salary', label: 'Mã tỉnh cấp', type: 'text', placeholder: 'Mã tỉnh cấp thẻ/sổ' },
  { key: 'Số thẻ BHYT', tab: 'tab-p-salary', label: 'Số thẻ BHYT', type: 'text', placeholder: 'Mã số trên thẻ BHYT' },
  { key: 'Nơi đăng ký KCB', tab: 'tab-p-salary', label: 'Nơi đăng ký KCB', type: 'text', placeholder: 'Bệnh viện / Cơ sở y tế KCB ban đầu', colSpan: 2 },
  { key: 'Mật khẩu phiếu lương', tab: 'tab-p-salary', label: 'Mật khẩu phiếu lương', type: 'text', placeholder: 'Mật khẩu tra cứu' },

  // TAB 9: PHỤ CẤP & GIẢM TRỪ (Theo file Danh sách lịch sử lương.xlsx)
  { key: 'Tổng phụ cấp', tab: 'tab-p-allowance', label: 'Tổng định mức phụ cấp (VNĐ)', type: 'number', placeholder: '0' },
  { key: 'Số khoản phụ cấp', tab: 'tab-p-allowance', label: 'Số khoản phụ cấp đang hưởng', type: 'number', placeholder: '0' },
  { key: 'Tổng giảm trừ', tab: 'tab-p-allowance', label: 'Tổng giảm trừ / khấu trừ (VNĐ)', type: 'number', placeholder: '0' },
  { key: 'Ghi chú phụ cấp', tab: 'tab-p-allowance', label: 'Ghi chú phụ cấp & giảm trừ', type: 'text', placeholder: 'Ghi chú...', colSpan: 2 },

  // TAB 10: TÀI KHOẢN & CKS (5 trường)
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
    if (tab.id === 'tab-p-allowance') {
      return `
        <div class="tab-pane det-tab-pane ${idx === 0 ? 'active' : ''}" id="${tab.id}">
          <!-- KPI Summary Cards -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 20px;">
            <div style="background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%); border: 1px solid #BFDBFE; border-radius: 10px; padding: 14px 18px;">
              <div style="font-size: 11.5px; font-weight: 700; color: #1E40AF; text-transform: uppercase; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-money-bill-trend-up"></i> Tổng Định Mức Phụ Cấp
              </div>
              <div id="allowance-sum-amount" style="font-size: 22px; font-weight: 800; color: #1D4ED8; letter-spacing: -0.5px;">0 ₫</div>
              <div id="allowance-sum-count" style="font-size: 12px; color: #3B82F6; margin-top: 3px; font-weight: 500;">0 khoản phụ cấp</div>
            </div>
            <div style="background: linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%); border: 1px solid #BBF7D0; border-radius: 10px; padding: 14px 18px;">
              <div style="font-size: 11.5px; font-weight: 700; color: #166534; text-transform: uppercase; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-circle-check"></i> Trạng Thái Áp Dụng
              </div>
              <div id="allowance-active-status" style="font-size: 19px; font-weight: 700; color: #15803D;">Đang áp dụng</div>
              <div style="font-size: 12px; color: #16A34A; margin-top: 3px;">Chuẩn theo file Lịch sử lương</div>
            </div>
            <div style="background: linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%); border: 1px solid #FECACA; border-radius: 10px; padding: 14px 18px;">
              <div style="font-size: 11.5px; font-weight: 700; color: #991B1B; text-transform: uppercase; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-scale-unbalanced-flip"></i> Tổng Khoản Giảm Trừ
              </div>
              <div id="deduction-sum-amount" style="font-size: 22px; font-weight: 800; color: #B91C1C; letter-spacing: -0.5px;">0 ₫</div>
              <div id="deduction-sum-count" style="font-size: 12px; color: #DC2626; margin-top: 3px; font-weight: 500;">0 khoản khấu trừ</div>
            </div>
          </div>

          <!-- SECTION 1: BẢNG CÁC KHOẢN PHỤ CẤP -->
          <div style="margin-bottom: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <h4 style="margin: 0; font-size: 14.5px; font-weight: 700; color: var(--primary-navy); display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-hand-holding-dollar" style="color: #2563EB;"></i> Danh Sách Các Khoản Phụ Cấp Đang Hưởng
              </h4>
              <span id="allowance-table-badge" class="badge" style="background: #EFF6FF; color: #1D4ED8; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 20px; border: 1px solid #BFDBFE;">0 khoản</span>
            </div>
            <div class="table-responsive" style="border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; max-height: 280px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
              <table class="data-table" style="margin: 0; width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead style="background: #F8FAFC; position: sticky; top: 0; z-index: 2; border-bottom: 1px solid var(--border-color);">
                  <tr>
                    <th style="width: 45px; text-align: center;">STT</th>
                    <th>Tên Khoản Phụ Cấp</th>
                    <th>Mã Khoản</th>
                    <th style="text-align: right;">Định Mức (VNĐ)</th>
                    <th>Công Thức / Cách Tính</th>
                    <th style="text-align: center;">Ngày Hiệu Lực</th>
                    <th style="text-align: center;">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody id="allowance-table-body">
                  <!-- Rendered dynamically -->
                </tbody>
              </table>
            </div>
          </div>

          <!-- SECTION 2: BẢNG CÁC KHOẢN GIẢM TRỪ & KHẤU TRỪ -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <h4 style="margin: 0; font-size: 14.5px; font-weight: 700; color: var(--primary-navy); display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-scale-unbalanced-flip" style="color: #DC2626;"></i> Danh Sách Các Khoản Khấu Trừ & Giảm Trừ
              </h4>
              <span id="deduction-table-badge" class="badge" style="background: #FEF2F2; color: #991B1B; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 20px; border: 1px solid #FECACA;">0 khoản</span>
            </div>
            <div class="table-responsive" style="border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; max-height: 220px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
              <table class="data-table" style="margin: 0; width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead style="background: #F8FAFC; position: sticky; top: 0; z-index: 2; border-bottom: 1px solid var(--border-color);">
                  <tr>
                    <th style="width: 45px; text-align: center;">STT</th>
                    <th>Tên Khoản Khấu Trừ</th>
                    <th>Mã Khoản</th>
                    <th style="text-align: right;">Định Mức (VNĐ)</th>
                    <th>Công Thức / Cách Tính</th>
                    <th style="text-align: center;">Ngày Hiệu Lực</th>
                    <th style="text-align: center;">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody id="deduction-table-body">
                  <!-- Rendered dynamically -->
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    }

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
    <datalist id="dl-profile-dept-ids">
      ${depts.map(d => `<option value="${d.department_id}">${d.department_name}</option>`).join('')}
    </datalist>
    <datalist id="dl-profile-positions">
      ${positions.map(p => `<option value="${p.position_name}">${p.position_id}</option>`).join('')}
    </datalist>
    <datalist id="dl-profile-position-ids">
      ${positions.map(p => `<option value="${p.position_id}">${p.position_name}</option>`).join('')}
    </datalist>
  `;

  const tabPanesHtml = PROFILE_TABS.map((tab, idx) => {
    const fields = MASTER_FIELDS_CONFIG.filter(f => f.tab === tab.id);
    const itemsHtml = fields.map(f => {
      const inputId = getFieldInputId(f.key);
      const colStyle = f.colSpan && f.colSpan > 1 ? `style="grid-column: span ${f.colSpan};"` : '';
      const reqMarker = f.required ? `<span class="req" style="color: var(--accent-red); margin-left: 2px;">*</span>` : '';

      let controlHtml = '';
      if (f.type === 'select') {
        const opts = (f.options || []).map(opt => `<option value="${opt}">${opt === '' ? '-- Chưa chọn --' : opt}</option>`).join('');
        controlHtml = `<select id="${inputId}" class="form-control">${opts}</select>`;
      } else if (f.type === 'date') {
        controlHtml = `<input type="date" id="${inputId}" class="form-control">`;
      } else if (f.type === 'number') {
        controlHtml = `<input type="number" id="${inputId}" class="form-control" placeholder="${f.placeholder || ''}">`;
      } else if (f.key === 'Đơn vị công tác') {
        controlHtml = `<input type="text" id="${inputId}" class="form-control" placeholder="${f.placeholder || ''}" list="dl-profile-departments">`;
      } else if (f.key === 'Mã đơn vị công tác') {
        controlHtml = `<input type="text" id="${inputId}" class="form-control" placeholder="${f.placeholder || ''}" list="dl-profile-dept-ids">`;
      } else if (f.key === 'Vị trí công việc') {
        controlHtml = `<input type="text" id="${inputId}" class="form-control" placeholder="${f.placeholder || ''}" list="dl-profile-positions">`;
      } else if (f.key === 'Mã vị trí công việc') {
        controlHtml = `<input type="text" id="${inputId}" class="form-control" placeholder="${f.placeholder || ''}" list="dl-profile-position-ids">`;
      } else {
        controlHtml = `<input type="text" id="${inputId}" class="form-control" placeholder="${f.placeholder || ''}">`;
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

    if (tab.id === 'tab-p-allowance') {
      const infoBanner = `
        <div style="grid-column: 1 / -1; background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 12px 16px; margin-bottom: 6px; font-size: 13px; color: #1E40AF; display: flex; align-items: center; gap: 10px;">
          <i class="fa-solid fa-circle-info" style="font-size: 16px; color: #2563EB;"></i>
          <span>Dữ liệu chi tiết các khoản phụ cấp (Chuyên cần, Vùng miền, Làm thêm giờ, Năng suất...) được đồng bộ tự động chuẩn từ file <strong>Danh sách lịch sử lương.xlsx</strong>.</span>
        </div>
      `;
      return `
        <div class="form-tab-pane ${idx === 0 ? 'active' : ''}" id="form-${tab.id}" style="${idx === 0 ? 'display: block;' : 'display: none;'}">
          <div class="form-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px;">
            ${infoBanner}
            ${itemsHtml}
          </div>
        </div>
      `;
    }

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
      const syncFromDept = () => {
        const val = deptInput.value.trim();
        if (!val) return;
        if (typeof appData !== 'undefined' && appData.getDepartmentId) {
          const matchedId = appData.getDepartmentId(val);
          const matchedName = appData.getDepartmentName(val);
          if (matchedId) deptIdInput.value = matchedId;
          if (matchedName && matchedName !== '-') deptInput.value = matchedName;
        }
      };
      const syncFromDeptId = () => {
        const val = deptIdInput.value.trim();
        if (!val) return;
        if (typeof appData !== 'undefined' && appData.getDepartmentName) {
          const matchedName = appData.getDepartmentName(val);
          const matchedId = appData.getDepartmentId(val);
          if (matchedName && matchedName !== '-') deptInput.value = matchedName;
          if (matchedId) deptIdInput.value = matchedId;
        }
      };
      deptInput.addEventListener('change', syncFromDept);
      deptInput.addEventListener('blur', syncFromDept);
      deptIdInput.addEventListener('change', syncFromDeptId);
      deptIdInput.addEventListener('blur', syncFromDeptId);
    }

    const posInput = document.getElementById(getFieldInputId('Vị trí công việc'));
    const posIdInput = document.getElementById(getFieldInputId('Mã vị trí công việc'));
    const jobTitleInput = document.getElementById(getFieldInputId('Chức danh'));
    if (posInput && posIdInput) {
      const syncFromPos = () => {
        const val = posInput.value.trim();
        if (!val) return;
        if (typeof appData !== 'undefined') {
          const matchedName = appData.getPositionName(val);
          const matchedId = appData.getPositionId(val);
          if (matchedName && matchedName !== '-') {
            posInput.value = matchedName;
            if (jobTitleInput && (!jobTitleInput.value || jobTitleInput.value === val)) {
              jobTitleInput.value = matchedName;
            }
          }
          if (matchedId) posIdInput.value = matchedId;
        }
      };
      const syncFromPosId = () => {
        const val = posIdInput.value.trim();
        if (!val) return;
        if (typeof appData !== 'undefined') {
          const matchedName = appData.getPositionName(val);
          const matchedId = appData.getPositionId(val);
          if (matchedName && matchedName !== '-') {
            posInput.value = matchedName;
            if (jobTitleInput && (!jobTitleInput.value || jobTitleInput.value === val)) {
              jobTitleInput.value = matchedName;
            }
          }
          if (matchedId) posIdInput.value = matchedId;
        }
      };
      posInput.addEventListener('change', syncFromPos);
      posInput.addEventListener('blur', syncFromPos);
      posIdInput.addEventListener('change', syncFromPosId);
      posIdInput.addEventListener('blur', syncFromPosId);
    }
  }, 50);

  return { tabNavHtml, tabPanesHtml: fullPanesHtml };
}

// Populate values in View Detail Modal
function fillDetailModalData(masterData, allowancesList = null) {
  if (!masterData) masterData = {};
  const empId = masterData['Mã nhân viên'] || masterData.employee_id;

  // 1. Fill standard fields
  MASTER_FIELDS_CONFIG.forEach(f => {
    const el = document.getElementById(getFieldDetailId(f.key));
    if (!el) return;
    let val = masterData[f.key];

    // Standardize Position & Job Title to position name
    if (f.key === 'Vị trí công việc' || f.key === 'Chức danh') {
      if (typeof appData !== 'undefined' && appData.getPositionName) {
        val = appData.getPositionName(val || masterData.position_name || masterData.position_id || masterData.job_title);
      }
    } else if (f.key === 'Mã vị trí công việc') {
      if (typeof appData !== 'undefined' && appData.getPositionId) {
        val = appData.getPositionId(val || masterData.position_id || masterData['Vị trí công việc']);
      }
    } else if (f.key === 'Đơn vị công tác') {
      if (typeof appData !== 'undefined' && appData.getDepartmentName) {
        val = appData.getDepartmentName(val || masterData['Mã đơn vị công tác'] || masterData.department_id || masterData.department_name);
      } else if (!val && masterData.department_name) {
        val = masterData.department_name;
      }
    } else if (f.key === 'Mã đơn vị công tác') {
      if (typeof appData !== 'undefined' && appData.getDepartmentId) {
        val = appData.getDepartmentId(val || masterData.department_id || masterData['Đơn vị công tác'] || masterData.department_name);
      } else if (!val && masterData.department_id) {
        val = masterData.department_id;
      }
    }

    if (val === undefined || val === null || val === '') {
      el.textContent = '-';
      el.style.color = 'var(--text-muted)';
    } else if (typeof val === 'number' && (f.key.includes('lương') || f.key.includes('Lương') || f.key.includes('phụ cấp') || f.key.includes('giảm trừ')) && !f.key.includes('Tỷ lệ') && !f.key.includes('Bậc') && !f.key.includes('Hệ số') && !f.key.includes('Số khoản')) {
      el.textContent = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
      el.style.color = '#059669';
      el.style.fontWeight = '700';
    } else if ((f.key.includes('Tỷ lệ') || f.label.includes('(%)')) && val !== undefined && val !== null && val !== '') {
      const sVal = String(val).trim();
      el.textContent = sVal.endsWith('%') ? sVal : (sVal + '%');
      el.style.color = 'var(--text-primary)';
      el.style.fontWeight = '600';
    } else if (f.type === 'date' || (typeof f.key === 'string' && (f.key.startsWith('Ngày') || f.key.includes('ngày') || f.key.includes('Ngày')))) {
      const formatted = (typeof utils !== 'undefined' && utils.formatDate) ? utils.formatDate(val) : val;
      el.textContent = (formatted && formatted !== '-') ? formatted : '-';
      el.style.color = (formatted && formatted !== '-') ? 'var(--text-primary)' : 'var(--text-muted)';
      el.style.fontWeight = '500';
    } else {
      el.textContent = String(val);
      el.style.color = 'var(--text-primary)';
      el.style.fontWeight = '500';
    }
  });

  // 2. Populate Allowances & Deductions Tab
  let items = allowancesList;
  if (!items && empId) {
    if (typeof appData !== 'undefined') {
      items = appData.allowanceMap?.[empId] || (appData.allowances || []).filter(a => a.employee_id === empId);
    }
  }
  if (!items && masterData.allowances && Array.isArray(masterData.allowances)) {
    items = masterData.allowances;
  }
  if (!items) items = [];

  const allowances = items.filter(it => it.type === 'ALLOWANCE' || (!it.type && (it.item_name || it.name)));
  const deductions = items.filter(it => it.type === 'DEDUCTION');

  let totalAllowAmount = allowances.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
  let totalDeductAmount = deductions.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);

  const sumAllowEl = document.getElementById('allowance-sum-amount');
  const countAllowEl = document.getElementById('allowance-sum-count');
  const statusAllowEl = document.getElementById('allowance-active-status');
  const badgeAllowEl = document.getElementById('allowance-table-badge');
  const tbodyAllowEl = document.getElementById('allowance-table-body');

  const sumDeductEl = document.getElementById('deduction-sum-amount');
  const countDeductEl = document.getElementById('deduction-sum-count');
  const badgeDeductEl = document.getElementById('deduction-table-badge');
  const tbodyDeductEl = document.getElementById('deduction-table-body');

  if (sumAllowEl) sumAllowEl.textContent = (typeof utils !== 'undefined' && utils.formatCurrency) ? utils.formatCurrency(totalAllowAmount) : `${totalAllowAmount.toLocaleString('vi-VN')} ₫`;
  if (countAllowEl) countAllowEl.textContent = `${allowances.length} khoản phụ cấp đang áp dụng`;
  if (statusAllowEl) {
    statusAllowEl.textContent = allowances.length > 0 ? 'Đang áp dụng' : 'Chưa có phụ cấp';
    statusAllowEl.style.color = allowances.length > 0 ? '#15803D' : 'var(--text-muted)';
  }
  if (badgeAllowEl) badgeAllowEl.textContent = `${allowances.length} khoản`;

  if (tbodyAllowEl) {
    if (allowances.length === 0) {
      tbodyAllowEl.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 24px 16px; color: var(--text-muted);">
            <i class="fa-solid fa-circle-info" style="margin-right: 6px; color: #3B82F6;"></i> Nhân sự hiện chưa có khoản phụ cấp nào được ghi nhận trong hệ thống.
          </td>
        </tr>
      `;
    } else {
      tbodyAllowEl.innerHTML = allowances.map((a, idx) => {
        const amtStr = (typeof utils !== 'undefined' && utils.formatCurrency) ? utils.formatCurrency(a.amount) : `${(a.amount || 0).toLocaleString('vi-VN')} ₫`;
        return `
          <tr style="border-bottom: 1px solid var(--border-color);">
            <td style="text-align: center; color: var(--text-muted); font-weight: 500;">${idx + 1}</td>
            <td style="font-weight: 600; color: var(--primary-navy);">
              <i class="fa-solid fa-hand-holding-dollar" style="color: #2563EB; margin-right: 6px; font-size: 12px;"></i>
              ${a.item_name || a.name || '-'}
            </td>
            <td><code style="background: #F1F5F9; color: #334155; padding: 3px 7px; border-radius: 4px; font-size: 11.5px; font-weight: 600;">${a.item_code || a.code || '-'}</code></td>
            <td style="text-align: right; font-weight: 700; color: #059669; font-size: 13.5px;">${amtStr}</td>
            <td style="font-size: 12px; color: #64748B; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${a.formula || ''}">${a.formula || 'Theo định mức chuẩn'}</td>
            <td style="text-align: center; font-size: 12.5px; color: var(--text-secondary);">${a.effective_date || '-'}</td>
            <td style="text-align: center;">
              <span class="badge" style="background: #ECFDF5; color: #059669; border: 1px solid #A7F3D0; font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 999px;">
                <i class="fa-solid fa-circle-check" style="font-size: 10px; margin-right: 3px;"></i> ${a.status || 'Đang áp dụng'}
              </span>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  if (sumDeductEl) sumDeductEl.textContent = (typeof utils !== 'undefined' && utils.formatCurrency) ? utils.formatCurrency(totalDeductAmount) : `${totalDeductAmount.toLocaleString('vi-VN')} ₫`;
  if (countDeductEl) countDeductEl.textContent = `${deductions.length} khoản khấu trừ`;
  if (badgeDeductEl) badgeDeductEl.textContent = `${deductions.length} khoản`;

  if (tbodyDeductEl) {
    if (deductions.length === 0) {
      tbodyDeductEl.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 20px 16px; color: var(--text-muted);">
            <i class="fa-solid fa-circle-check" style="margin-right: 6px; color: #10B981;"></i> Không phát sinh khoản giảm trừ hoặc khấu trừ lương.
          </td>
        </tr>
      `;
    } else {
      tbodyDeductEl.innerHTML = deductions.map((d, idx) => {
        const amtStr = (typeof utils !== 'undefined' && utils.formatCurrency) ? utils.formatCurrency(d.amount) : `${(d.amount || 0).toLocaleString('vi-VN')} ₫`;
        return `
          <tr style="border-bottom: 1px solid var(--border-color);">
            <td style="text-align: center; color: var(--text-muted); font-weight: 500;">${idx + 1}</td>
            <td style="font-weight: 600; color: var(--primary-navy);">${d.item_name || d.name || '-'}</td>
            <td><code style="background: #F1F5F9; color: #334155; padding: 3px 7px; border-radius: 4px; font-size: 11.5px; font-weight: 600;">${d.item_code || d.code || '-'}</code></td>
            <td style="text-align: right; font-weight: 700; color: #DC2626; font-size: 13.5px;">${amtStr}</td>
            <td style="font-size: 12px; color: #64748B;">${d.formula || 'Theo quy định'}</td>
            <td style="text-align: center; font-size: 12.5px;">${d.effective_date || '-'}</td>
            <td style="text-align: center;">
              <span class="badge" style="background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; font-size: 11px; padding: 3px 9px; border-radius: 999px;">${d.status || 'Đang áp dụng'}</span>
            </td>
          </tr>
        `;
      }).join('');
    }
  }
}

// Populate values in Form Modal (Add / Edit)
function fillFormModalData(masterData = {}, isEdit = false) {
  MASTER_FIELDS_CONFIG.forEach(f => {
    const el = document.getElementById(getFieldInputId(f.key));
    if (!el) return;
    let val = masterData[f.key];

    // Standardize Position & Job Title
    if (f.key === 'Vị trí công việc') {
      if (typeof appData !== 'undefined' && appData.getPositionName) {
        val = appData.getPositionName(val || masterData.position_name || masterData.position_id || masterData.job_title);
      }
    } else if (f.key === 'Mã vị trí công việc') {
      if (typeof appData !== 'undefined' && appData.getPositionId) {
        val = appData.getPositionId(val || masterData.position_id || masterData['Vị trí công việc']);
      }
    } else if (f.key === 'Chức danh') {
      if (typeof appData !== 'undefined' && appData.getPositionName) {
        val = appData.getPositionName(val || masterData.job_title || masterData.position_name || masterData['Vị trí công việc']);
      }
    } else if (f.key === 'Đơn vị công tác') {
      if (typeof appData !== 'undefined' && appData.getDepartmentName) {
        val = appData.getDepartmentName(val || masterData['Mã đơn vị công tác'] || masterData.department_id || masterData.department_name);
      } else if (!val && masterData.department_name) {
        val = masterData.department_name;
      }
    } else if (f.key === 'Mã đơn vị công tác') {
      if (typeof appData !== 'undefined' && appData.getDepartmentId) {
        val = appData.getDepartmentId(val || masterData.department_id || masterData['Đơn vị công tác'] || masterData.department_name);
      } else if (!val && masterData.department_id) {
        val = masterData.department_id;
      }
    }

    if (val === undefined || val === null) {
      val = f.defaultValue !== undefined ? f.defaultValue : '';
    }

    if (f.key === 'Mã nhân viên') {
      el.value = val || '';
      el.readOnly = false; // Luôn cho phép điều chỉnh mã
    } else if (f.type === 'date') {
      el.value = (typeof utils !== 'undefined' && utils.parseToIsoDate) ? utils.parseToIsoDate(val) : (val || '');
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

  // Strict cross-field enforcement
  if (typeof appData !== 'undefined') {
    const deptVal = data['Đơn vị công tác'];
    const deptIdVal = data['Mã đơn vị công tác'];
    const resolvedDeptId = appData.getDepartmentId ? appData.getDepartmentId(deptIdVal || deptVal) : (deptIdVal || deptVal);
    const resolvedDeptName = appData.getDepartmentName ? appData.getDepartmentName(deptVal || deptIdVal) : (deptVal || deptIdVal);
    if (resolvedDeptId) {
      data['Mã đơn vị công tác'] = resolvedDeptId;
      data.department_id = resolvedDeptId;
    }
    if (resolvedDeptName && resolvedDeptName !== '-') {
      data['Đơn vị công tác'] = resolvedDeptName;
      data.department_name = resolvedDeptName;
    }

    const posVal = data['Vị trí công việc'];
    const posIdVal = data['Mã vị trí công việc'];
    const resolvedPosId = appData.getPositionId ? appData.getPositionId(posIdVal || posVal) : (posIdVal || posVal);
    const resolvedPosName = appData.getPositionName ? appData.getPositionName(posVal || posIdVal) : (posVal || posIdVal);
    if (resolvedPosId) {
      data['Mã vị trí công việc'] = resolvedPosId;
      data.position_id = resolvedPosId;
    }
    if (resolvedPosName && resolvedPosName !== '-') {
      data['Vị trí công việc'] = resolvedPosName;
      if (!data['Chức danh'] || data['Chức danh'] === posVal) {
        data['Chức danh'] = resolvedPosName;
      }
    }
  }

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
