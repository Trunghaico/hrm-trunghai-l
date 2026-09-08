const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Configuration
const OUTPUT_EXCEL_PATH = path.join(__dirname, '..', 'Mau_1000_Nhan_Su_TRUNGHAI.xlsx');
const PUBLIC_EXCEL_PATH = path.join(__dirname, '..', 'public', 'Mau_1000_Nhan_Su_TRUNGHAI.xlsx');
const DB_JSON_PATH = path.join(__dirname, '..', 'database_schema.json');

console.log('🔄 Bắt đầu sinh 1,000 dữ liệu nhân sự mẫu chuẩn hóa đầy đủ 115 cột...');

// Load existing DB for reference tables (01_Departments, 02_Positions)
let originalDb = { tables: {} };
if (fs.existsSync(DB_JSON_PATH)) {
    try {
        originalDb = JSON.parse(fs.readFileSync(DB_JSON_PATH, 'utf-8'));
    } catch (e) {
        console.error('Lỗi đọc database_schema.json:', e);
    }
}

const depts = originalDb.tables['01_Departments'] || [
    { department_id: 'HR', department_name: 'Phòng Hành Chính Nhân Sự' },
    { department_id: 'KT', department_name: 'Phòng Kế Toán Tài Chính' },
    { department_id: 'KD', department_name: 'Phòng Kinh Doanh & Tiếp Thị' },
    { department_id: 'KTGS', department_name: 'Phòng Kỹ Thuật & Giám Sát' },
    { department_id: 'TC-HC', department_name: 'Phòng Tổ Chức Hành Chính' },
    { department_id: 'IT', department_name: 'Phòng Công Nghệ Thông Tin' },
    { department_id: 'QLDA', department_name: 'Ban Quản Lý Dự Án' }
];

const positions = originalDb.tables['02_Positions'] || [
    { position_id: 'POS-01', position_name: 'Chuyên viên Nhân sự' },
    { position_id: 'POS-02', position_name: 'Kế toán viên' },
    { position_id: 'POS-03', position_name: 'Kỹ sư Kỹ thuật' },
    { position_id: 'POS-04', position_name: 'Chuyên viên Kinh doanh' },
    { position_id: 'POS-05', position_name: 'Kỹ sư CNTT' },
    { position_id: 'POS-06', position_name: 'Trưởng phòng' },
    { position_id: 'POS-07', position_name: 'Phó phòng' },
    { position_id: 'POS-08', position_name: 'Giám sát Công trình' }
];

// Names Pool
const lastNames = [
    'Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng',
    'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý', 'Đinh', 'Đoàn', 'Lâm', 'Trịnh',
    'Mai', 'Đào', 'Cao', 'Hà', 'Lưu', 'Lương', 'Thái', 'Châu', 'Tạ', 'Phùng'
];

const maleMiddleNames = [
    'Văn', 'Đức', 'Minh', 'Hữu', 'Đình', 'Quang', 'Thanh', 'Hải', 'Quốc', 'Tuấn',
    'Ngọc', 'Xuân', 'Thế', 'Thành', 'Huy', 'Hoàng', 'Khắc', 'Trọng', 'Duy', 'Nhật',
    'Tiến', 'Bảo', 'Công', 'Phúc', 'Việt', 'Mạnh', 'Gia', 'Vĩnh', 'Đăng', 'Chí'
];

const maleFirstNames = [
    'An', 'Bình', 'Cường', 'Dũng', 'Đạt', 'Đức', 'Giang', 'Hà', 'Hải', 'Hào',
    'Hậu', 'Hiếu', 'Hiệp', 'Hòa', 'Hoàng', 'Hùng', 'Hưng', 'Huy', 'Khánh', 'Khoa',
    'Kiên', 'Lâm', 'Long', 'Minh', 'Nam', 'Nghĩa', 'Nhân', 'Nhật', 'Phát', 'Phong',
    'Phú', 'Phúc', 'Quân', 'Quang', 'Sang', 'Sơn', 'Tài', 'Tâm', 'Tân', 'Thắng',
    'Thành', 'Thịnh', 'Thông', 'Thuận', 'Tiến', 'Toàn', 'Trí', 'Trung', 'Trọng', 'Trường',
    'Tú', 'Tuấn', 'Tùng', 'Việt', 'Vinh', 'Vũ', 'Vương', 'Vượng', 'Yên', 'Bảo'
];

const femaleMiddleNames = [
    'Thị', 'Ngọc', 'Thu', 'Thanh', 'Phương', 'Mai', 'Kim', 'Mỹ', 'Thúy', 'Hồng',
    'Bích', 'Ánh', 'Quỳnh', 'Cẩm', 'Diệu', 'Khánh', 'Tuyết', 'Lan', 'Hương', 'Hoài',
    'Tường', 'Bảo', 'Thảo', 'Yến', 'Minh', 'Trúc', 'Gia', 'Hải', 'Như', 'Diễm'
];

const femaleFirstNames = [
    'An', 'Anh', 'Ánh', 'Bình', 'Châu', 'Chi', 'Cúc', 'Diệp', 'Dung', 'Duyên',
    'Giang', 'Hà', 'Hân', 'Hằng', 'Hạnh', 'Hiền', 'Hoa', 'Hoài', 'Hương', 'Hường',
    'Huyền', 'Khánh', 'Lan', 'Linh', 'Loan', 'Ly', 'Mai', 'Mi', 'My', 'Nga',
    'Ngân', 'Ngọc', 'Nhung', 'Oanh', 'Phương', 'Quyên', 'Quỳnh', 'Tâm', 'Thảo', 'Thi',
    'Thu', 'Thư', 'Thương', 'Thúy', 'Thủy', 'Tiên', 'Trang', 'Trâm', 'Trinh', 'Trúc',
    'Tú', 'Tuyết', 'Uyên', 'Vân', 'Vi', 'Vy', 'Xuân', 'Yến', 'Đan', 'Nhi'
];

const provinces = [
    { name: 'Hà Nội', code: '001', hospital: 'Bệnh viện Bạch Mai - Hà Nội', location: 'Trụ sở Tổng công ty - Tòa nhà Trung Hải, Hà Nội' },
    { name: 'TP. Hồ Chí Minh', code: '079', hospital: 'Bệnh viện Chợ Rẫy - TP.HCM', location: 'Chi nhánh Miền Nam - TP. Hồ Chí Minh' },
    { name: 'Đà Nẵng', code: '048', hospital: 'Bệnh viện Đa khoa Đà Nẵng', location: 'Chi nhánh Miền Trung - TP. Đà Nẵng' },
    { name: 'Hải Phòng', code: '031', hospital: 'Bệnh viện Việt Tiệp - Hải Phòng', location: 'Văn phòng Đại diện Hải Phòng' },
    { name: 'Cần Thơ', code: '092', hospital: 'Bệnh viện Đa khoa Cần Thơ', location: 'Chi nhánh Tây Nam Bộ - Cần Thơ' },
    { name: 'Bình Dương', code: '074', hospital: 'Bệnh viện Đa khoa Bình Dương', location: 'Khu Công Nghiệp VSIP - Bình Dương' },
    { name: 'Đồng Nai', code: '075', hospital: 'Bệnh viện Đa khoa Đồng Nai', location: 'Khu Công Nghiệp Biên Hòa - Đồng Nai' },
    { name: 'Bắc Ninh', code: '027', hospital: 'Bệnh viện Đa khoa Bắc Ninh', location: 'Chi nhánh Bắc Ninh' },
    { name: 'Quảng Nam', code: '049', hospital: 'Bệnh viện Đa khoa Quảng Nam', location: 'Văn phòng Dự án Chu Lai' },
    { name: 'Nghệ An', code: '040', hospital: 'Bệnh viện Hữu nghị Đa khoa Nghệ An', location: 'Văn phòng Dự án Vinh' }
];

const universities = [
    { name: 'Đại học Bách Khoa Hà Nội', major: 'Kỹ thuật Máy tính & CNTT' },
    { name: 'Đại học Kinh Tế Quốc Dân', major: 'Quản trị Kinh doanh' },
    { name: 'Đại học Ngoại Thương', major: 'Kinh tế Quốc tế' },
    { name: 'Học viện Tài Chính', major: 'Tài chính Ngân hàng' },
    { name: 'Đại học Khoa học Xã hội & Nhân văn', major: 'Quản trị Nhân lực' },
    { name: 'Đại học Quốc Gia TP.HCM', major: 'Khoa học Máy tính' },
    { name: 'Đại học Kinh Tế TP.HCM (UEH)', major: 'Kế toán Kiểm toán' },
    { name: 'Đại học Bách Khoa TP.HCM', major: 'Kỹ thuật Xây dựng & Giám sát' },
    { name: 'Đại học Luật Hà Nội', major: 'Luật Kinh tế' },
    { name: 'Đại học Mở TP.HCM', major: 'Quản trị Kinh doanh Tổng hợp' }
];

const banks = [
    'Vietcombank', 'MBBank', 'Techcombank', 'BIDV', 'VietinBank', 'ACB', 'VPBank', 'TPBank', 'Agribank', 'Sacombank'
];

function removeVietnameseTones(str) {
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    return str;
}

// 115 Standardized Headers in exact order
const STANDARDIZED_HEADERS = [
    'Mã nhân viên',
    'Họ và tên',
    'Giới tính',
    'Ngày sinh',
    'ĐT di động',
    'Email cơ quan',
    'Vị trí công việc',
    'Đơn vị công tác',
    'Ngày thử việc',
    'Ngày chính thức',
    'Loại hợp đồng',
    'Trạng thái lao động',
    'Thâm niên',
    'Tham gia bảo hiểm',
    'ĐT tài khoản',
    'Tên gọi khác',
    'Nhóm lý do nghỉ',
    'Ngày nghỉ hưu dự kiến',
    'Tính chất lao động',
    'Bậc lương',
    'Tổng lương',
    'Tham gia công đoàn',
    'Nơi sinh',
    'Nguyên quán',
    'Tình trạng hôn nhân',
    'MST cá nhân',
    'TP gia đình',
    'TP bản thân',
    'Dân tộc',
    'Tôn giáo',
    'Quốc tịch',
    'Số CMND',
    'Ngày cấp giấy tờ',
    'Nơi cấp giấy tờ',
    'Ngày hết hạn giấy tờ',
    'Loại giấy tờ',
    'Số Hộ chiếu',
    'Ngày cấp Hộ chiếu',
    'Nơi cấp Hộ chiếu',
    'Ngày hết hạn Hộ chiếu',
    'Trình độ văn hóa',
    'Trình độ đào tạo',
    'Nơi đào tạo',
    'Khoa',
    'Chuyên ngành',
    'Năm tốt nghiệp',
    'Xếp loại',
    'ĐT cơ quan',
    'ĐT nhà riêng',
    'ĐT khác',
    'Email cá nhân',
    'Email khác',
    'Skype',
    'Facebook',
    'Hộ khẩu thường trú',
    'Quốc gia (Thường trú)',
    'Tỉnh/Thành phố (Thường trú)',
    'Quận/Huyện (Thường trú)',
    'Phường/Xã (Thường trú)',
    'Số nhà, đường phố (Thường trú)',
    'Số sổ hộ khẩu',
    'Mã số hộ gia đình',
    'Là chủ hộ',
    'Chỗ ở hiện nay',
    'Quốc gia (Hiện nay)',
    'Tỉnh/Thành phố (Hiện nay)',
    'Quận/Huyện (Hiện nay)',
    'Phường/Xã (Hiện nay)',
    'Số nhà, đường phố (Hiện nay)',
    'Họ và tên (LHKC)',
    'Quan hệ (LHKC)',
    'ĐT di động (LHKC)',
    'ĐT nhà riêng (LHKC)',
    'Email (LHKC)',
    'Địa chỉ (LHKC)',
    'Email tài khoản',
    'Trạng thái tài khoản',
    'Trạng thái chữ ký số',
    'Trạng thái hồ sơ cấp CKS',
    'Ngày có hiệu lực',
    'Ngày hết hiệu lực',
    'Chức danh',
    'Mã chấm công',
    'Cấp',
    'Bậc',
    'Lý do nghỉ',
    'Ngày nghỉ việc',
    'Thuộc danh sách đen',
    'Người duyệt',
    'Địa điểm làm việc',
    'Số sổ QL lao động',
    'Hệ số lương',
    'Ngày học việc',
    'Quản lý trực tiếp',
    'Quản lý gián tiếp',
    'Lương cơ bản',
    'Lương đóng BH',
    'TK ngân hàng',
    'Ngân hàng',
    'Chi nhánh',
    'Ngày tham gia BH',
    'Nhân sự khai thác',
    'Số sổ BHXH',
    'Nguồn ứng viên',
    'Mã số BHXH',
    'Mã tỉnh cấp',
    'Số thẻ BHYT',
    'Nơi đăng ký KCB',
    'Khu vực làm việc',
    'Mã vị trí công việc',
    'Mã đơn vị công tác'
];

const rows = [STANDARDIZED_HEADERS];

// Generate exactly 1,000 distinct employees (TH-1001 to TH-2000)
for (let i = 1; i <= 1000; i++) {
    const empNum = 1000 + i;
    const empId = `TH-${empNum}`;
    const timeAttendanceCode = `${empNum}`;

    const isMale = i % 2 === 1;
    const gender = isMale ? 'Nam' : 'Nữ';
    const lName = lastNames[i % lastNames.length];
    const mName = isMale ? maleMiddleNames[(i * 3) % maleMiddleNames.length] : femaleMiddleNames[(i * 3) % femaleMiddleNames.length];
    const fName = isMale ? maleFirstNames[(i * 7) % maleFirstNames.length] : femaleFirstNames[(i * 7) % femaleFirstNames.length];
    const fullName = `${lName} ${mName} ${fName}`;

    // Birth date (age between 22 and 55)
    const birthYear = 1970 + (i % 33);
    const birthMonth = (i % 12) + 1;
    const birthDay = (i % 28) + 1;
    const dobFormatted = `${String(birthDay).padStart(2, '0')}/${String(birthMonth).padStart(2, '0')}/${birthYear}`;

    const prov = provinces[i % provinces.length];
    const birthPlace = prov.name;
    const nativePlace = provinces[(i * 3) % provinces.length].name;
    const ethnicity = (i % 25 === 0) ? 'Tày' : (i % 40 === 0 ? 'Mường' : 'Kinh');
    const religion = 'Không';
    const nationality = 'Việt Nam';
    const isMarried = birthYear < 1998;
    const maritalStatus = isMarried ? 'Đã kết hôn' : 'Độc thân';

    // Organization
    const deptObj = depts[i % depts.length];
    const posObj = positions[i % positions.length];
    const deptId = deptObj.department_id;
    const deptName = deptObj.department_name;
    const posId = posObj.position_id;
    const posTitle = posObj.position_name;

    let jobLevel = 'Cấp 3';
    let jobRank = 'Bậc 3';
    if (i % 15 === 0) { jobLevel = 'Cấp 2'; jobRank = 'Bậc 5'; }
    else if (i % 30 === 0) { jobLevel = 'Cấp 1'; jobRank = 'Bậc 7'; }
    else if (i % 8 === 0) { jobLevel = 'Cấp 4'; jobRank = 'Bậc 2'; }

    const workLocation = prov.location;
    const workArea = (prov.name === 'Hà Nội') ? 'Khối Văn phòng Tổng công ty' : `Khối Chi nhánh ${prov.name}`;
    const directMgrName = (i <= 5) ? 'Huỳnh Thanh Long' : 'Quản lý Trực tiếp';
    const indirectMgrName = 'Huỳnh Thanh Long';

    // Labor nature & Status
    const laborNature = (i % 20 === 0) ? 'Thử việc' : 'Chính thức';
    const empStatus = (i % 50 === 0) ? 'Đã nghỉ việc' : (i % 60 === 0 ? 'Nghỉ thai sản' : 'Đang làm việc');

    // Dates
    const startYear = Math.max(birthYear + 22, 2018 + (i % 8));
    const startMonth = ((i * 5) % 12) + 1;
    const startDay = ((i * 7) % 28) + 1;
    const startDate = `${String(startDay).padStart(2, '0')}/${String(startMonth).padStart(2, '0')}/${startYear}`;

    const trialStartDate = (laborNature === 'Thử việc') ? startDate : `${String(startDay).padStart(2, '0')}/${String(startMonth).padStart(2, '0')}/${startYear}`;
    const officialDate = (laborNature === 'Thử việc') ? '' : `${String(startDay).padStart(2, '0')}/${String(((startMonth + 1) % 12) + 1).padStart(2, '0')}/${startYear}`;
    const contractType = (laborNature === 'Thử việc')
        ? 'Hợp đồng thử việc'
        : ((i % 3 === 0) ? 'Hợp đồng lao động không xác định thời hạn' : 'Hợp đồng lao động xác định thời hạn (24 tháng)');
    const endDate = (contractType.includes('không xác định')) ? 'Không xác định' : `31/12/${startYear + 2}`;

    // Contacts
    const cleanFirstName = removeVietnameseTones(fName).toLowerCase();
    const cleanMidInitial = removeVietnameseTones(mName).substring(0, 1).toLowerCase();
    const cleanLastInitial = removeVietnameseTones(lName).substring(0, 1).toLowerCase();
    const username = `${cleanFirstName}.${cleanLastInitial}${cleanMidInitial}${empNum}`;

    const phone = `09${String(80000000 + i).substring(1)}`;
    const homePhone = (i % 3 === 0) ? `024${String(3800000 + i).substring(1)}` : '';
    const workEmail = `${username}@trunghaico.vn`;
    const personalEmail = `${username}@gmail.com`;

    // Addresses
    const streetName = (i % 2 === 0) ? `Số ${12 + (i % 150)} Phố Huế` : `Số ${45 + (i % 200)} Đường Lê Duẩn`;
    const wardName = (i % 2 === 0) ? 'Phường Hàng Bài' : 'Phường Hải Châu 1';
    const districtName = (i % 2 === 0) ? 'Quận Hoàn Kiếm' : 'Quận Hải Châu';
    const permAddress = `${streetName}, ${wardName}, ${districtName}, ${birthPlace}`;
    const currAddress = permAddress;

    // CCCD & Documents
    const cccd = `${prov.code}${isMale ? '0' : '1'}${String(birthYear).substring(2)}${String(100000 + i).substring(1)}`;
    const cccdIssueDate = `10/05/${Math.max(birthYear + 20, 2021)}`;
    const cccdIssuePlace = 'Cục Cảnh sát Quản lý hành chính về trật tự xã hội';
    const cccdExpiryDate = `${String(birthDay).padStart(2, '0')}/${String(birthMonth).padStart(2, '0')}/${birthYear + 40}`;

    const hasPassport = (i % 3 === 0);
    const passportNumber = hasPassport ? `P0${String(1000000 + i).substring(1)}` : '';
    const passportIssueDate = hasPassport ? `12/04/2022` : '';
    const taxCode = `8${String(100000000 + i).substring(1)}`;

    // Salary & Bank
    const salaryGrade = (i % 7) + 1;
    const baseSalary = 10000000 + (salaryGrade * 2000000);
    const totalSalary = Math.round(baseSalary * 1.25);
    const insuranceSalary = Math.min(baseSalary, 23400000);
    const bankAccount = `190${String(3000000000 + i).substring(1)}`;
    const bankName = banks[i % banks.length];
    const bankBranch = `Chi nhánh ${prov.name}`;

    // Insurance & Union
    const hasInsurance = 'Có';
    const socialInsuranceBook = `04${String(10000000 + i).substring(1)}`;
    const insuranceJoinDate = startDate;
    const hospitalRegistered = prov.hospital;

    // Education
    const uni = universities[i % universities.length];
    const eduLevel = (i % 10 === 0) ? 'Thạc sĩ' : ((i % 15 === 0) ? 'Cao đẳng' : 'Đại học');
    const institution = uni.name;
    const major = uni.major;
    const gradYear = birthYear + 22;
    const classification = (i % 5 === 0) ? 'Xuất sắc' : ((i % 3 === 0) ? 'Giỏi' : 'Khá');

    // Emergency Contact
    const emergRelation = isMarried ? (isMale ? 'Vợ' : 'Chồng') : 'Bố';
    const emergName = isMarried ? `${lastNames[(i + 3) % lastNames.length]} Thị Hoa` : `${lName} Văn Hùng`;
    const emergPhone = `091${String(2000000 + i).substring(1)}`;

    const seniorityYears = Math.max(1, 2026 - startYear);
    const retirementYear = birthYear + (isMale ? 62 : 60);
    const expectedRetirementDate = `${dobFormatted.substring(0, 6)}${retirementYear}`;

    rows.push([
        empId,                                                  // 1. Mã nhân viên
        fullName,                                               // 2. Họ và tên
        gender,                                                 // 3. Giới tính
        dobFormatted,                                           // 4. Ngày sinh
        phone,                                                  // 5. ĐT di động
        workEmail,                                              // 6. Email cơ quan
        posTitle,                                               // 7. Vị trí công việc
        deptName,                                               // 8. Đơn vị công tác
        trialStartDate,                                         // 9. Ngày thử việc
        officialDate,                                           // 10. Ngày chính thức
        contractType,                                           // 11. Loại hợp đồng
        empStatus,                                              // 12. Trạng thái lao động
        `${seniorityYears} năm`,                                // 13. Thâm niên
        hasInsurance,                                           // 14. Tham gia bảo hiểm
        phone,                                                  // 15. ĐT tài khoản
        '',                                                     // 16. Tên gọi khác
        (empStatus === 'Đã nghỉ việc' ? 'Cá nhân' : ''),        // 17. Nhóm lý do nghỉ
        expectedRetirementDate,                                 // 18. Ngày nghỉ hưu dự kiến
        laborNature,                                            // 19. Tính chất lao động
        String(salaryGrade),                                    // 20. Bậc lương
        totalSalary,                                            // 21. Tổng lương
        'Có',                                                   // 22. Tham gia công đoàn
        birthPlace,                                             // 23. Nơi sinh
        nativePlace,                                            // 24. Nguyên quán
        maritalStatus,                                          // 25. Tình trạng hôn nhân
        taxCode,                                                // 26. MST cá nhân
        'Cán bộ công chức',                                     // 27. TP gia đình
        'Công nhân viên chức',                                  // 28. TP bản thân
        ethnicity,                                              // 29. Dân tộc
        religion,                                               // 30. Tôn giáo
        nationality,                                            // 31. Quốc tịch
        cccd,                                                   // 32. Số CMND
        cccdIssueDate,                                          // 33. Ngày cấp giấy tờ
        cccdIssuePlace,                                         // 34. Nơi cấp giấy tờ
        cccdExpiryDate,                                         // 35. Ngày hết hạn giấy tờ
        'CCCD',                                                 // 36. Loại giấy tờ
        passportNumber,                                         // 37. Số Hộ chiếu
        passportIssueDate,                                      // 38. Ngày cấp Hộ chiếu
        passportNumber ? 'Cục Quản lý Xuất nhập cảnh' : '',    // 39. Nơi cấp Hộ chiếu
        passportIssueDate ? `12/04/2032` : '',                  // 40. Ngày hết hạn Hộ chiếu
        '12/12',                                                // 41. Trình độ văn hóa
        eduLevel,                                               // 42. Trình độ đào tạo
        institution,                                            // 43. Nơi đào tạo
        major.includes('CNTT') ? 'Công nghệ Thông tin' : (major.includes('Kinh tế') ? 'Kinh tế Quốc tế' : 'Quản trị Kinh doanh'), // 44. Khoa
        major,                                                  // 45. Chuyên ngành
        gradYear,                                               // 46. Năm tốt nghiệp
        classification,                                         // 47. Xếp loại
        '02438888999',                                          // 48. ĐT cơ quan
        homePhone,                                              // 49. ĐT nhà riêng
        '',                                                     // 50. ĐT khác
        personalEmail,                                          // 51. Email cá nhân
        '',                                                     // 52. Email khác
        `${username}.work`,                                     // 53. Skype
        `facebook.com/${username}`,                             // 54. Facebook
        permAddress,                                            // 55. Hộ khẩu thường trú
        'Việt Nam',                                             // 56. Quốc gia (Thường trú)
        birthPlace,                                             // 57. Tỉnh/Thành phố (Thường trú)
        districtName,                                           // 58. Quận/Huyện (Thường trú)
        wardName,                                               // 59. Phường/Xã (Thường trú)
        streetName,                                             // 60. Số nhà, đường phố (Thường trú)
        `HK-${String(100000 + i)}`,                             // 61. Số sổ hộ khẩu
        `HGD-${String(200000 + i)}`,                            // 62. Mã số hộ gia đình
        isMarried && isMale ? 'Có' : 'Không',                   // 63. Là chủ hộ
        currAddress,                                            // 64. Chỗ ở hiện nay
        'Việt Nam',                                             // 65. Quốc gia (Hiện nay)
        birthPlace,                                             // 66. Tỉnh/Thành phố (Hiện nay)
        districtName,                                           // 67. Quận/Huyện (Hiện nay)
        wardName,                                               // 68. Phường/Xã (Hiện nay)
        streetName,                                             // 69. Số nhà, đường phố (Hiện nay)
        emergName,                                              // 70. Họ và tên (LHKC)
        emergRelation,                                          // 71. Quan hệ (LHKC)
        emergPhone,                                             // 72. ĐT di động (LHKC)
        '02438888999',                                          // 73. ĐT nhà riêng (LHKC)
        `lh_${username}@gmail.com`,                             // 74. Email (LHKC)
        permAddress,                                            // 75. Địa chỉ (LHKC)
        workEmail,                                              // 76. Email tài khoản
        'Kích hoạt',                                            // 77. Trạng thái tài khoản
        (i % 3 === 0 ? 'Chưa kích hoạt' : 'Đã kích hoạt'),     // 78. Trạng thái chữ ký số
        (i % 3 === 0 ? 'Chờ cấp' : 'Hợp lệ'),                   // 79. Trạng thái hồ sơ cấp CKS
        startDate,                                              // 80. Ngày có hiệu lực
        (endDate !== 'Không xác định' ? endDate : ''),          // 81. Ngày hết hiệu lực
        posTitle,                                               // 82. Chức danh
        timeAttendanceCode,                                     // 83. Mã chấm công
        jobLevel,                                               // 84. Cấp
        jobRank,                                                // 85. Bậc
        (empStatus === 'Đã nghỉ việc' ? 'Hết hạn HĐLĐ' : ''),   // 86. Lý do nghỉ
        (empStatus === 'Đã nghỉ việc' ? endDate : ''),          // 87. Ngày nghỉ việc
        'Không',                                                // 88. Thuộc danh sách đen
        'Huỳnh Thanh Long',                                     // 89. Người duyệt
        workLocation,                                           // 90. Địa điểm làm việc
        `LD-${String(10000 + i)}`,                              // 91. Số sổ QL lao động
        (1.8 + (salaryGrade * 0.35)).toFixed(2),                // 92. Hệ số lương
        (i % 5 === 0 ? startDate : ''),                         // 93. Ngày học việc
        directMgrName,                                          // 94. Quản lý trực tiếp
        indirectMgrName,                                        // 95. Quản lý gián tiếp
        baseSalary,                                             // 96. Lương cơ bản
        insuranceSalary,                                        // 97. Lương đóng BH
        bankAccount,                                            // 98. TK ngân hàng
        bankName,                                               // 99. Ngân hàng
        bankBranch,                                             // 100. Chi nhánh
        insuranceJoinDate,                                      // 101. Ngày tham gia BH
        'Lê Thị Thu',                                           // 102. Nhân sự khai thác
        socialInsuranceBook,                                    // 107. Số sổ BHXH
        (i % 3 === 0 ? 'VietnamWorks' : 'TopCV'),               // 108. Nguồn ứng viên
        socialInsuranceBook,                                    // 109. Mã số BHXH
        prov.code,                                              // 110. Mã tỉnh cấp
        `DN4${prov.code}${socialInsuranceBook}`,                // 111. Số thẻ BHYT
        hospitalRegistered,                                     // 112. Nơi đăng ký KCB
        workArea,                                               // 113. Khu vực làm việc
        posId,                                                  // 114. Mã vị trí công việc
        deptId                                                  // 115. Mã đơn vị công tác
    ]);
}

const wb = XLSX.utils.book_new();

// Sheet 1: Danh_Sach_Nhan_Su
const ws1 = XLSX.utils.aoa_to_sheet(rows);
ws1['!cols'] = STANDARDIZED_HEADERS.map(() => ({ wch: 20 }));
ws1['!cols'][0] = { wch: 16 };  // Mã NV
ws1['!cols'][1] = { wch: 24 };  // Họ tên
ws1['!cols'][5] = { wch: 28 };  // Email cơ quan
ws1['!cols'][54] = { wch: 40 }; // Hộ khẩu thường trú
ws1['!cols'][63] = { wch: 40 }; // Chỗ ở hiện nay
ws1['!cols'][31] = { wch: 18 }; // CMND

XLSX.utils.book_append_sheet(wb, ws1, 'Danh_Sach_Nhan_Su');

// Sheet 2: Danh_Muc_Tham_Chieu
const refData = [
    ['=== DANH MỤC THAM CHIẾU HỆ THỐNG QUẢN TRỊ NHÂN SỰ TRUNG HẢI ===', ''],
    ['(Sử dụng các giá trị chuẩn trong sheet này để tra cứu thông tin)', ''],
    ['', ''],
    ['1. DANH SÁCH MÃ ĐƠN VỊ CÔNG TÁC (*)', 'TÊN ĐƠN VỊ CÔNG TÁC'],
    ...depts.map(d => [d.department_id, d.department_name]),
    ['', ''],
    ['2. DANH SÁCH MÃ VỊ TRÍ CÔNG VIỆC (*)', 'TÊN VỊ TRÍ CÔNG VIỆC'],
    ...positions.map(p => [p.position_id, p.position_name]),
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
    ['9. QUAN HỆ KHẨN CẤP (LHKC)', ''],
    ['Vợ', 'Chồng'],
    ['Bố', 'Mẹ'],
    ['Anh trai', 'Chị gái'],
    ['Em trai', 'Em gái'],
    ['Người thân khác', '']
];

const ws2 = XLSX.utils.aoa_to_sheet(refData);
ws2['!cols'] = [{ wch: 45 }, { wch: 55 }];
XLSX.utils.book_append_sheet(wb, ws2, 'Danh_Muc_Tham_Chieu');

// Write to both workspace root and public folder
XLSX.writeFile(wb, OUTPUT_EXCEL_PATH);
XLSX.writeFile(wb, PUBLIC_EXCEL_PATH);

console.log(`✅ Đã xuất thành công file Excel 1,000 nhân sự mẫu với chuẩn 115 cột!`);
console.log(`📁 Đường dẫn gốc: ${OUTPUT_EXCEL_PATH}`);
console.log(`📁 Đường dẫn web public: ${PUBLIC_EXCEL_PATH}`);
