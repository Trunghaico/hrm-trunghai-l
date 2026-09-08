const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'hrm-trunghai-enterprise-jwt-key-2026-super-secure';
const SALT_ROUNDS = 10;

// ==========================================
// 1. SECURITY HEADERS & MIDDLEWARES
// ==========================================

// Helmet HTTP Security Headers (CSP configured for CDN FontAwesome, Chart.js & inline handlers)
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            styleSrcAttr: ["'unsafe-inline'"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com", "data:"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            connectSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://*.jsdelivr.net"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

// CORS Configuration
app.use(cors());

// Rate Limiter for Login (100 attempts per 15 mins to prevent Brute-force while allowing development/testing)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, message: 'Đã vượt quá số lần thử đăng nhập cho phép. Vui lòng thử lại sau 15 phút.' },
    standardHeaders: true,
    legacyHeaders: false
});

// General API Rate Limiter (1200 requests per 5 minutes per IP)
const apiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 1200,
    message: { success: false, message: 'Tần suất gửi yêu cầu quá cao. Vui lòng thử lại sau giây lát.' },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', apiLimiter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));


// ==========================================
// 2. SECURITY & AUTH HELPERS
// ==========================================

// Verify password with Bcrypt and auto-upgrade from plain-text
async function verifyPassword(inputPassword, storedPassword) {
    if (!storedPassword || !inputPassword) return false;
    
    // Check if stored password is a bcrypt hash
    if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$')) {
        return await bcrypt.compare(inputPassword, storedPassword);
    }
    
    // Legacy plain-text fallback
    return inputPassword === storedPassword;
}

// Hash password with Bcrypt
async function hashPassword(plainPassword) {
    if (!plainPassword) plainPassword = 'password@123';
    // If already hashed, don't rehash
    if (plainPassword.startsWith('$2a$') || plainPassword.startsWith('$2b$')) {
        return plainPassword;
    }
    return await bcrypt.hash(plainPassword, SALT_ROUNDS);
}

// JWT Authentication Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để thực hiện thao tác này' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Phiên làm việc đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.' });
        }
        req.user = user;
        next();
    });
}

// Optional Auth (for smooth client transition)
function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (!err) req.user = user;
            next();
        });
    } else {
        next();
    }
}

// Path to JSON database
const DB_PATH = path.join(__dirname, 'database_schema.json');
const TMP_DB_PATH = path.join(os.tmpdir(), 'database_schema.json');

// In-memory cache for database
let inMemoryDb = null;

// Ensure default admin exists in database (only if no admin exists to prevent lockout)
function ensureDefaultAccounts(db) {
    if (!db || typeof db !== 'object') return;
    if (!db.tables) db.tables = {};
    if (!Array.isArray(db.tables['11_System_Accounts'])) {
        db.tables['11_System_Accounts'] = [];
    }

    const accounts = db.tables['11_System_Accounts'];

    // If an ADMIN account already exists, do nothing (do not recreate deleted demo accounts)
    const hasAdmin = accounts.some(a => a.role === 'ADMIN');
    if (hasAdmin) {
        return;
    }

    // Only ensure a default Super Admin if NO admin exists in the entire system
    const adminHash = bcrypt.hashSync('123456', SALT_ROUNDS);
    accounts.unshift({
        account_id: 'ACC-TH1948',
        employee_id: 'TH-1948',
        username: 'longht',
        full_name: 'Huỳnh Thanh Long',
        account_email: 'longht@trunghaico.vn',
        role: 'ADMIN',
        account_status: 'Kích hoạt',
        password: adminHash,
        created_at: new Date().toISOString()
    });
}

// Helper: Fix Excel serial numbers (10000..65000) or 5-digit strings to DD/MM/YYYY
function fixExcelSerialDate(val) {
    if (val === undefined || val === null || val === '' || val === '-') return val;
    let num = null;
    if (typeof val === 'number') {
        num = val;
    } else if (typeof val === 'string') {
        const trimmed = val.trim();
        if (/^\d{5}$/.test(trimmed)) {
            num = Number(trimmed);
        } else {
            const match = trimmed.match(/(?:^|[\/\-\.])(\d{5})(?:$|[\/\-\.])/);
            if (match) num = Number(match[1]);
        }
    }
    if (num !== null && !isNaN(num) && num >= 10000 && num <= 65000) {
        const ms = Math.round((num - 25569) * 86400 * 1000);
        const d = new Date(ms);
        if (!isNaN(d.getTime())) {
            const day = String(d.getUTCDate()).padStart(2, '0');
            const month = String(d.getUTCMonth() + 1).padStart(2, '0');
            const year = d.getUTCFullYear();
            return `${day}/${month}/${year}`;
        }
    }
    return val;
}

function normalizeDepartmentCode(codeOrName) {
    if (!codeOrName) return '';
    const s = String(codeOrName).trim();
    if (!s || s === '-') return '';
    const low = s.toLowerCase();
    if (low.includes('tổng giám đốc') || low === 'bgd' || low === 'btgd' || low === 'btgd.th') return 'BTGD.TH';
    if (low.includes('tổ chức hành chính') || low === 'btchc' || low === 'btchc.th') return 'BTCHC.TH';
    if (low.includes('tài chính kế toán') && (low.includes('trung hải') || low.includes('.th'))) return 'BTCKT.TH';
    if (low.includes('kế hoạch tổng hợp') && (low.includes('trung hải') || low.includes('.th'))) return 'BKHTH.TH';
    if (low.includes('pháp chế')) return 'BPC.TH';
    if (low.includes('thiết bị')) return 'BQLTB.TH';
    if (low.includes('trực tiếp') && (low.includes('trung hải') || low.includes('.th'))) return 'TRUCTIEP_BDHDA.TH';
    if (low.includes('gián tiếp') && (low.includes('trung hải') || low.includes('.th'))) return 'GIANTIEP_BDHDA.TH';
    if (low.includes('văn phòng') && (low.includes('trung hải') || low.includes('.th'))) return 'VP_BDHDA.TH';
    if (low === 'cty' || low === 'thg' || (low.includes('trung hải') && !low.includes('dự án') && !low.includes('ban') && !low.includes('phòng'))) return 'CTY';

    if (low.includes('phú minh') || low.includes('.pm')) {
        if (low.includes('giám đốc') || low === 'bgd.pm') return 'BGD.PM';
        if (low.includes('điều hành dự án') || low === 'bdhda.pm') return 'BDHDA.PM';
        if (low.includes('hành chính nhân sự') || low === 'phcns.pm') return 'PHCNS.PM';
        if (low.includes('kế hoạch') || low === 'pkhth.pm') return 'PKHTH.PM';
        if (low.includes('kế toán') || low === 'ptckt.pm') return 'PTCKT.PM';
        if (low.includes('trực tiếp') || low.includes('tructiep')) return 'TRUCTIEP_BDHDA.PM';
        if (low.includes('gián tiếp') || low.includes('giantiep')) return 'GIANTIEP_BDHDA.PM';
    }

    if (low.includes('thành phát') || low.includes('.tp')) {
        if (low.includes('hành chính nhân sự') || low === 'phcns.tp') return 'PHCNS.TP';
        if (low.includes('kế hoạch') || low === 'pkhth.tp') return 'PKHTH.TP';
        if (low.includes('kế toán') || low === 'ptckt.tp') return 'PTCKT.TP';
        if (low.includes('trực tiếp') || low.includes('tructiep')) return 'TRUCTIEP_BDHDA.TP';
        if (low.includes('gián tiếp') || low.includes('giantiep')) return 'GIANTIEP_BDHDA.TP';
    }

    if (low.includes('trung nam') || low.includes('.tn')) {
        if (low.includes('giám đốc') || low === 'bgd.tn') return 'BGD.TN';
        if (low.includes('điều hành dự án') || low === 'bđhda.tn') return 'BĐHDA.TN';
        if (low.includes('hành chính nhân sự') || low === 'phcns.tn') return 'PHCNS.TN';
        if (low.includes('thương mại') || low.includes('kinh doanh') || low === 'pkdtm.tn') return 'PKDTM.TN';
        if (low.includes('kế toán') || low === 'ptckt.tn') return 'PTCKT.TN';
        if (low === 'tn' || low.includes('công ty')) return 'BĐHDA.TN';
    }

    return s;
}

function normalizeDepartmentName(codeOrName) {
    if (!codeOrName) return '';
    const s = String(codeOrName).trim();
    if (!s || s === '-') return '';
    const low = s.toLowerCase();
    if (low.includes('tổng giám đốc') || low === 'bgd' || low === 'btgd' || low === 'btgd.th') return 'BAN TỔNG GIÁM ĐỐC TRUNG HẢI';
    if (low.includes('tổ chức hành chính') || low === 'btchc' || low === 'btchc.th') return 'BAN TỔ CHỨC HÀNH CHÍNH TRUNG HẢI';
    if (low.includes('tài chính kế toán') && (low.includes('trung hải') || low.includes('.th'))) return 'BAN TÀI CHÍNH KẾ TOÁN TRUNG HẢI';
    if (low.includes('kế hoạch tổng hợp') && (low.includes('trung hải') || low.includes('.th'))) return 'BAN KẾ HOẠCH TỔNG HỢP TRUNG HẢI';
    if (low.includes('pháp chế')) return 'BAN PHÁP CHẾ TRUNG HẢI';
    if (low.includes('thiết bị')) return 'BAN QUẢN LÝ THIẾT BỊ TRUNG HẢI';
    if (low.includes('trực tiếp') && (low.includes('trung hải') || low.includes('.th'))) return 'KHỐI TRỰC TIẾP-DỰ ÁN TRUNG HẢI';
    if (low.includes('gián tiếp') && (low.includes('trung hải') || low.includes('.th'))) return 'KHỐI GIÁN TIẾP- DỰ ÁN TRUNG HẢI';
    if (low.includes('văn phòng') && (low.includes('trung hải') || low.includes('.th'))) return 'KHỐI VĂN PHÒNG-DỰ ÁN TRUNG HẢI';
    if (low === 'cty' || low === 'thg' || (low.includes('trung hải') && !low.includes('dự án') && !low.includes('ban') && !low.includes('phòng'))) return 'KHỐI VĂN PHÒNG-DỰ ÁN TRUNG HẢI';

    if (low.includes('phú minh') || low.includes('.pm')) {
        if (low.includes('giám đốc') || low === 'bgd.pm') return 'BAN GIÁM ĐỐC PHÚ MINH';
        if (low.includes('điều hành dự án') || low === 'bdhda.pm') return 'BAN ĐIỀU HÀNH DỰ ÁN PHÚ MINH';
        if (low.includes('hành chính nhân sự') || low === 'phcns.pm') return 'PHÒNG HÀNH CHÍNH NHÂN SỰ PHÚ MINH';
        if (low.includes('kế hoạch') || low === 'pkhth.pm') return 'PHÒNG KẾ HOẠCH TỔNG HỢP PHÚ MINH';
        if (low.includes('kế toán') || low === 'ptckt.pm') return 'PHÒNG TÀI CHÍNH KẾ TOÁN PHÚ MINH';
        if (low.includes('trực tiếp') || low.includes('tructiep')) return 'KHỐI TRỰC TIẾP-DỰ ÁN PHÚ MINH';
        if (low.includes('gián tiếp') || low.includes('giantiep')) return 'KHỐI GIÁN TIẾP_DỰ ÁN PHÚ MINH';
    }

    if (low.includes('thành phát') || low.includes('.tp')) {
        if (low.includes('hành chính nhân sự') || low === 'phcns.tp') return 'PHÒNG HÀNH CHÍNH NHÂN SỰ THÀNH PHÁT';
        if (low.includes('kế hoạch') || low === 'pkhth.tp') return 'PHÒNG KẾ HOẠCH TỔNG HỢP THÀNH PHÁT';
        if (low.includes('kế toán') || low === 'ptckt.tp') return 'PHÒNG TÀI CHÍNH KẾ TOÁN THÀNH PHÁT';
        if (low.includes('trực tiếp') || low.includes('tructiep')) return 'KHỐI TRỰC TIẾP-DỰ ÁN THÀNH PHÁT';
        if (low.includes('gián tiếp') || low.includes('giantiep')) return 'KHỐI GIÁN TIẾP-DỰ ÁN THÀNH PHÁT';
    }

    if (low.includes('trung nam') || low.includes('.tn')) {
        if (low.includes('giám đốc') || low === 'bgd.tn') return 'BAN GIÁM ĐỐC TRUNG NAM';
        if (low.includes('điều hành dự án') || low === 'bđhda.tn') return 'BAN ĐIỀU HÀNH DỰ ÁN TRUNG NAM';
        if (low.includes('hành chính nhân sự') || low === 'phcns.tn') return 'PHÒNG HÀNH CHÍNH NHÂN SỰ TRUNG NAM';
        if (low.includes('thương mại') || low.includes('kinh doanh') || low === 'pkdtm.tn') return 'PHÒNG KINH DOANH THƯƠNG MẠI TRUNG NAM';
        if (low.includes('kế toán') || low === 'ptckt.tn') return 'PHÒNG TÀI CHÍNH KẾ TOÁN TRUNG NAM';
        if (low === 'tn' || low.includes('công ty')) return 'BAN ĐIỀU HÀNH DỰ ÁN TRUNG NAM';
    }

    return s;
}

function sanitizeDates(db) {
    if (!db || !db.tables) return;
    if (Array.isArray(db.tables['03_Employees'])) {
        db.tables['03_Employees'].forEach(e => {
            if (e.date_of_birth) e.date_of_birth = fixExcelSerialDate(e.date_of_birth);
            if (e['Ngày sinh']) e['Ngày sinh'] = fixExcelSerialDate(e['Ngày sinh']);
            if (e.start_date) e.start_date = fixExcelSerialDate(e.start_date);
            if (e.trial_start_date) e.trial_start_date = fixExcelSerialDate(e.trial_start_date);
            if (e.official_date) e.official_date = fixExcelSerialDate(e.official_date);
            if (e.department_id) {
                const clean = normalizeDepartmentCode(e.department_id);
                if (clean) e.department_id = clean;
            }
            if (!e.department_name && e.department_id) {
                e.department_name = normalizeDepartmentName(e.department_id);
            }
        });
    }
    if (Array.isArray(db.tables['00_Master_Profiles'])) {
        db.tables['00_Master_Profiles'].forEach(m => {
            if (m['Ngày sinh']) m['Ngày sinh'] = fixExcelSerialDate(m['Ngày sinh']);
            if (m.date_of_birth) m.date_of_birth = fixExcelSerialDate(m.date_of_birth);
            const rawDept = m['Mã đơn vị công tác'] || m.department_id || m['Đơn vị công tác'] || m.department_name;
            if (rawDept) {
                const cleanId = normalizeDepartmentCode(rawDept);
                if (cleanId) {
                    m['Mã đơn vị công tác'] = cleanId;
                    m.department_id = cleanId;
                }
                const cleanName = normalizeDepartmentName(m['Đơn vị công tác'] || rawDept);
                if (cleanName) {
                    m['Đơn vị công tác'] = cleanName;
                    m.department_name = cleanName;
                }
            }
        });
    }
}

// Helper to load DB (Reads in-memory -> /tmp -> disk)
function loadDatabase() {
    if (inMemoryDb && inMemoryDb.tables) {
        ensureDefaultAccounts(inMemoryDb);
        sanitizeDates(inMemoryDb);
        return inMemoryDb;
    }

    try {
        if (fs.existsSync(TMP_DB_PATH)) {
            const raw = fs.readFileSync(TMP_DB_PATH, 'utf-8');
            const db = JSON.parse(raw);
            ensureDefaultAccounts(db);
            sanitizeDates(db);
            inMemoryDb = db;
            return db;
        }
        if (fs.existsSync(DB_PATH)) {
            const raw = fs.readFileSync(DB_PATH, 'utf-8');
            const db = JSON.parse(raw);
            ensureDefaultAccounts(db);
            sanitizeDates(db);
            inMemoryDb = db;
            return db;
        }
    } catch (e) {
        console.error('Error reading database_schema.json:', e);
    }
    const db = { tables: {} };
    ensureDefaultAccounts(db);
    inMemoryDb = db;
    return db;
}

// Path to Excel database
const EXCEL_DB_PATH = path.join(__dirname, 'HRM_Database_Normalized.xlsx');

// Helper to sync JSON tables to Excel file in real-time
function syncToExcelFile(db) {
    try {
        const wb = XLSX.utils.book_new();
        for (const [sheetName, rows] of Object.entries(db.tables || {})) {
            const safeSheetName = sheetName.substring(0, 31);
            const ws = XLSX.utils.json_to_sheet(rows || []);
            XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
        }
        XLSX.writeFile(wb, EXCEL_DB_PATH);
    } catch (e) {
        // Handled silently on read-only environments
    }
}

// Helper to save DB (Serverless-safe with in-memory and /tmp fallback)
function saveDatabase(data) {
    inMemoryDb = data;
    let saved = false;

    // 1. Try saving to project root (works on local development / VPS)
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
        saved = true;
    } catch (e) {
        // 2. Fallback to /tmp on read-only filesystem
        try {
            fs.writeFileSync(TMP_DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
            saved = true;
        } catch (tmpErr) {
            console.warn('⚠️ Ghi CSDL vào /tmp thất bại:', tmpErr.message);
        }
    }

    try {
        setTimeout(() => syncToExcelFile(data), 10);
    } catch (e) {}

    return saved;
}

// ==========================================
// SYSTEM ACTIVITY LOGGER HELPER
// ==========================================
function recordLog(db, { action_type, module, description, user_id, user_name, user_role, ip }) {
    if (!db.tables['12_System_Logs']) {
        db.tables['12_System_Logs'] = [];
    }
    const logEntry = {
        log_id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        user_id: user_id || 'TH-1948',
        user_name: user_name || 'Huỳnh Thanh Long',
        user_role: user_role || 'ADMIN',
        action_type: action_type || 'INFO',
        module: module || 'Hệ thống',
        description: description || '',
        ip_address: ip || '127.0.0.1'
    };
    db.tables['12_System_Logs'].unshift(logEntry);
    if (db.tables['12_System_Logs'].length > 3000) {
        db.tables['12_System_Logs'] = db.tables['12_System_Logs'].slice(0, 3000);
    }
    return logEntry;
}

// 1. GET FULL DATABASE
app.get('/api/data', (req, res) => {
    const db = loadDatabase();
    res.json({
        success: true,
        tables: db.tables,
        company: db.company_info || {
            brand_name: "TRUNG HẢI",
            full_name: "CÔNG TY CỔ PHẦN ĐẦU TƯ VÀ XÂY DỰNG TRUNG HẢI",
            subtitle: "HRM ENTERPRISE",
            logo_url: "assets/logo.png",
            tax_code: "0101234567",
            phone: "024.1234.5678",
            email: "contact@trunghaico.vn",
            address: "Tòa nhà Trung Hải, Hà Nội",
            website: "https://trunghaico.vn"
        }
    });
});

// 2. GET DASHBOARD STATS
app.get('/api/stats', (req, res) => {
    const db = loadDatabase();
    const employees = db.tables['03_Employees'] || [];
    const departments = db.tables['01_Departments'] || [];
    const positions = db.tables['02_Positions'] || [];
    const salaries = db.tables['08_Salaries_Banks'] || [];
    const insurance = db.tables['09_Insurance_Welfare'] || [];

    const totalEmployees = employees.length;
    const activeEmployees = employees.filter(e => e.employment_status === 'Đang làm việc').length;
    const probationEmployees = employees.filter(e => e.labor_nature === 'Thử việc' || e.labor_nature === 'Học việc').length;
    const officialEmployees = employees.filter(e => e.labor_nature === 'Chính thức').length;
    const resignedEmployees = employees.filter(e => e.employment_status === 'Đã nghỉ việc').length;
    const maleCount = employees.filter(e => e.gender === 'Nam').length;
    const femaleCount = employees.filter(e => e.gender === 'Nữ').length;

    // Headcount by department
    const deptCounts = {};
    employees.forEach(e => {
        const dId = e.department_id || 'UNKNOWN';
        deptCounts[dId] = (deptCounts[dId] || 0) + 1;
    });

    const deptStats = departments.map(d => ({
        department_id: d.department_id,
        department_name: d.department_name,
        count: deptCounts[d.department_id] || 0
    })).sort((a, b) => b.count - a.count);

    // Salary total
    let totalBaseSalary = 0;
    let salaryCount = 0;
    salaries.forEach(s => {
        if (s.base_salary && s.base_salary > 0) {
            totalBaseSalary += s.base_salary;
            salaryCount++;
        }
    });
    const avgBaseSalary = salaryCount > 0 ? Math.round(totalBaseSalary / salaryCount) : 0;

    // Upcoming probation ends / contract review
    const now = new Date('2026-08-24');
    const upcomingProbations = employees.filter(e => {
        if (e.employment_status === 'Đang làm việc' && (e.labor_nature === 'Thử việc' || e.labor_nature === 'Học việc')) {
            return true;
        }
        return false;
    }).slice(0, 10);

    res.json({
        success: true,
        stats: {
            totalEmployees,
            activeEmployees,
            probationEmployees,
            officialEmployees,
            resignedEmployees,
            maleCount,
            femaleCount,
            totalDepartments: departments.length,
            totalPositions: positions.length,
            avgBaseSalary,
            totalPayrollEstimate: totalBaseSalary,
            departmentBreakdown: deptStats,
            upcomingProbations
        }
    });
});

// 3. GET EMPLOYEES (With Filtering, Search, Pagination)
app.get('/api/employees', (req, res) => {
    const db = loadDatabase();
    const employees = db.tables['03_Employees'] || [];
    const contacts = db.tables['04_Contacts_Addresses'] || [];
    const salaries = db.tables['08_Salaries_Banks'] || [];
    const identity = db.tables['05_Identity_Docs'] || [];
    const insurance = db.tables['09_Insurance_Welfare'] || [];
    const depts = db.tables['01_Departments'] || [];
    const pos = db.tables['02_Positions'] || [];

    const edu = db.tables['07_Education'] || [];
    const contracts = db.tables['10_Contracts'] || [];
    const emergency = db.tables['06_Emergency_Contacts'] || [];

    const deptMap = {};
    depts.forEach(d => deptMap[d.department_id] = d.department_name);
    const posMap = {};
    pos.forEach(p => posMap[p.position_id] = p.position_name);

    const contactMap = {};
    contacts.forEach(c => contactMap[c.employee_id] = c);
    const salaryMap = {};
    salaries.forEach(s => salaryMap[s.employee_id] = s);
    const identityMap = {};
    identity.forEach(i => identityMap[i.employee_id] = i);
    const insMap = {};
    insurance.forEach(i => insMap[i.employee_id] = i);
    const eduMap = {};
    edu.forEach(ed => eduMap[ed.employee_id] = ed);
    const contractMap = {};
    contracts.forEach(ct => contractMap[ct.employee_id] = ct);
    const emergMap = {};
    emergency.forEach(em => emergMap[em.employee_id] = em);

    // Merge full row with all 34 fields
    let result = employees.map(e => {
        const c = contactMap[e.employee_id] || {};
        const s = salaryMap[e.employee_id] || {};
        const idDoc = identityMap[e.employee_id] || {};
        const ins = insMap[e.employee_id] || {};
        const ed = eduMap[e.employee_id] || {};
        const ct = contractMap[e.employee_id] || {};
        const em = emergMap[e.employee_id] || {};

        return {
            ...e,
            department_name: deptMap[e.department_id] || e.department_id,
            position_name: posMap[e.position_id] || e.position_id,
            job_rank: e.job_rank || (s.salary_grade ? `Cấp ${s.salary_grade}` : 'Cấp 3'),
            children_count: e.children_count !== undefined ? e.children_count : 0,
            start_date: e.start_date || e.trial_start_date || e.probation_start_date || '',
            end_date: e.end_date || e.resignation_date || 'Không xác định',
            contract_type: e.contract_type || ct.contract_type || 'Hợp đồng lao động',
            mobile_phone: c.mobile_phone || '',
            home_phone: c.home_phone || '',
            work_email: c.work_email || '',
            personal_email: c.personal_email || '',
            permanent_address_full: c.permanent_address_full || '',
            current_address_full: c.current_address_full || '',
            doc_type: idDoc.doc_type || 'CCCD',
            id_number: idDoc.id_number || '',
            id_issue_date: idDoc.id_issue_date || '',
            id_issue_place: idDoc.id_issue_place || '',
            id_expiry_date: idDoc.id_expiry_date || '',
            passport_number: idDoc.passport_number || '',
            salary_grade: s.salary_grade || 1,
            base_salary: s.base_salary || 0,
            total_salary: s.total_salary || s.base_salary || 0,
            insurance_salary: s.insurance_salary || 0,
            bank_account_number: s.bank_account_number || '',
            bank_name: s.bank_name || '',
            bank_branch: s.bank_branch || '',
            has_insurance: ins.has_insurance || 'Không tham gia',
            social_insurance_book_no: ins.social_insurance_book_no || '',
            social_insurance_code: ins.social_insurance_code || '',
            hospital_registered: ins.hospital_registered || '',
            education_level: ed.education_level || e.education_level || 'Đại học',
            major: ed.major || e.major || '',
            other_certificates: e.other_certificates || ed.other_certificates || '',
            emergency_contact_name: em.contact_name || '',
            emergency_contact_relation: em.relationship || '',
            emergency_contact_phone: em.mobile_phone || '',
            emergency_contact_full: em.contact_name ? `${em.contact_name} (${em.relationship || ''}) - ${em.mobile_phone || ''}` : ''
        };
    });

    // Query parameters
    const { search, department_id, position_id, employment_status, labor_nature, gender, page = 1, limit = 25 } = req.query;

    if (search) {
        const q = search.toLowerCase().trim();
        result = result.filter(e => 
            (e.employee_id && e.employee_id.toLowerCase().includes(q)) ||
            (e.full_name && e.full_name.toLowerCase().includes(q)) ||
            (e.mobile_phone && e.mobile_phone.includes(q)) ||
            (e.work_email && e.work_email.toLowerCase().includes(q)) ||
            (e.id_number && e.id_number.includes(q)) ||
            (e.department_name && e.department_name.toLowerCase().includes(q)) ||
            (e.position_name && e.position_name.toLowerCase().includes(q))
        );
    }

    if (department_id) {
        result = result.filter(e => e.department_id === department_id);
    }
    if (position_id) {
        result = result.filter(e => e.position_id === position_id);
    }
    if (employment_status) {
        result = result.filter(e => e.employment_status === employment_status);
    }
    if (labor_nature) {
        result = result.filter(e => e.labor_nature === labor_nature);
    }
    if (gender) {
        result = result.filter(e => e.gender === gender);
    }

    const total = result.length;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const start = (pageNum - 1) * limitNum;
    const paginated = limitNum > 0 ? result.slice(start, start + limitNum) : result;

    res.json({
        success: true,
        total,
        page: pageNum,
totalPages: limitNum > 0 ? Math.ceil(total / limitNum) : 1,
        data: paginated
    });
});

// 1. DOWNLOAD COMPREHENSIVE EXCEL TEMPLATE (STANDARDIZED 115 COLUMNS)
app.get('/api/employees/template', (req, res) => {
    const db = loadDatabase();
    const depts = db.tables['01_Departments'] || [];
    const positions = db.tables['02_Positions'] || [];

    const wb = XLSX.utils.book_new();

    const sampleHeaders = [
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

    const sampleRows = [
        sampleHeaders,
        [
            'TH-2001',                                                 // 1. Mã nhân viên
            'Nguyễn Văn An',                                           // 2. Họ và tên
            'Nam',                                                     // 3. Giới tính
            '15/08/1992',                                              // 4. Ngày sinh
            '0987654321',                                              // 5. ĐT di động
            'an.nv@trunghaico.vn',                                     // 6. Email cơ quan
            positions[0]?.position_name || 'Chuyên viên Nhân sự',      // 7. Vị trí công việc
            depts[0]?.department_name || 'Phòng Hành Chính Nhân Sự',  // 8. Đơn vị công tác
            '01/03/2026',                                              // 9. Ngày thử việc
            '01/05/2026',                                              // 10. Ngày chính thức
            'Hợp đồng lao động không xác định thời hạn',                // 11. Loại hợp đồng
            'Đang làm việc',                                           // 12. Trạng thái lao động
            '3 năm',                                                   // 13. Thâm niên
            'Có',                                                      // 14. Tham gia bảo hiểm
            '0987654321',                                              // 15. ĐT tài khoản
            '',                                                        // 16. Tên gọi khác
            '',                                                        // 17. Nhóm lý do nghỉ
            '15/08/2054',                                              // 18. Ngày nghỉ hưu dự kiến
            'Chính thức',                                              // 19. Tính chất lao động
            '3',                                                       // 20. Bậc lương
            20000000,                                                  // 21. Tổng lương
            'Có',                                                      // 22. Tham gia công đoàn
            'Hà Nội',                                                  // 23. Nơi sinh
            'Nam Định',                                                // 24. Nguyên quán
            'Đã kết hôn',                                              // 25. Tình trạng hôn nhân
            '8456123890',                                              // 26. MST cá nhân
            'Cán bộ công chức',                                        // 27. TP gia đình
            'Công nhân viên chức',                                     // 28. TP bản thân
            'Kinh',                                                    // 29. Dân tộc
            'Không',                                                   // 30. Tôn giáo
            'Việt Nam',                                                // 31. Quốc tịch
            '001092012345',                                            // 32. Số CMND
            '10/05/2021',                                              // 33. Ngày cấp giấy tờ
            'Cục Cảnh sát Quản lý hành chính về trật tự xã hội',       // 34. Nơi cấp giấy tờ
            '15/08/2032',                                              // 35. Ngày hết hạn giấy tờ
            'CCCD',                                                    // 36. Loại giấy tờ
            'P01234567',                                               // 37. Số Hộ chiếu
            '12/04/2022',                                              // 38. Ngày cấp Hộ chiếu
            'Cục Quản lý Xuất nhập cảnh',                              // 39. Nơi cấp Hộ chiếu
            '12/04/2032',                                              // 40. Ngày hết hạn Hộ chiếu
            '12/12',                                                   // 41. Trình độ văn hóa
            'Đại học',                                                 // 42. Trình độ đào tạo
            'Đại học Kinh Tế Quốc Dân',                                // 43. Nơi đào tạo
            'Quản trị Kinh doanh',                                     // 44. Khoa
            'Quản trị Nhân lực',                                       // 45. Chuyên ngành
            2014,                                                      // 46. Năm tốt nghiệp
            'Giỏi',                                                    // 47. Xếp loại
            '02438888999',                                             // 48. ĐT cơ quan
            '02437654321',                                             // 49. ĐT nhà riêng
            '',                                                        // 50. ĐT khác
            'annguyen92@gmail.com',                                    // 51. Email cá nhân
            '',                                                        // 52. Email khác
            'an.nguyen.hr',                                            // 53. Skype
            'facebook.com/annv92',                                     // 54. Facebook
            'Số 12 Phố Huế, P. Hàng Bài, Q. Hoàn Kiếm, Hà Nội',       // 55. Hộ khẩu thường trú
            'Việt Nam',                                                // 56. Quốc gia (Thường trú)
            'Hà Nội',                                                  // 57. Tỉnh/Thành phố (Thường trú)
            'Hoàn Kiếm',                                               // 58. Quận/Huyện (Thường trú)
            'Hàng Bài',                                                // 59. Phường/Xã (Thường trú)
            'Số 12 Phố Huế',                                           // 60. Số nhà, đường phố (Thường trú)
            'HK-001928',                                               // 61. Số sổ hộ khẩu
            'HGD-019283',                                              // 62. Mã số hộ gia đình
            'Có',                                                      // 63. Là chủ hộ
            'Tòa nhà Trung Hải, Cầu Giấy, Hà Nội',                     // 64. Chỗ ở hiện nay
            'Việt Nam',                                                // 65. Quốc gia (Hiện nay)
            'Hà Nội',                                                  // 66. Tỉnh/Thành phố (Hiện nay)
            'Cầu Giấy',                                                // 67. Quận/Huyện (Hiện nay)
            'Dịch Vọng Hậu',                                           // 68. Phường/Xã (Hiện nay)
            'Phố Duy Tân',                                             // 69. Số nhà, đường phố (Hiện nay)
            'Nguyễn Thị Bình',                                         // 70. Họ và tên (LHKC)
            'Vợ',                                                      // 71. Quan hệ (LHKC)
            '0912345678',                                              // 72. ĐT di động (LHKC)
            '02437654321',                                             // 73. ĐT nhà riêng (LHKC)
            'binhnt@gmail.com',                                        // 74. Email (LHKC)
            'Số 12 Phố Huế, P. Hàng Bài, Q. Hoàn Kiếm, Hà Nội',       // 75. Địa chỉ (LHKC)
            'an.nv@trunghaico.vn',                                     // 76. Email tài khoản
            'Kích hoạt',                                               // 77. Trạng thái tài khoản
            'Đã kích hoạt',                                            // 78. Trạng thái chữ ký số
            'Hợp lệ',                                                  // 79. Trạng thái hồ sơ cấp CKS
            '01/05/2026',                                              // 80. Ngày có hiệu lực
            '',                                                        // 81. Ngày hết hiệu lực
            'Chuyên viên Nhân sự cấp cao',                             // 82. Chức danh
            '2001',                                                    // 83. Mã chấm công
            'Cấp 3',                                                   // 84. Cấp
            'Bậc 3',                                                   // 85. Bậc
            '',                                                        // 86. Lý do nghỉ
            '',                                                        // 87. Ngày nghỉ việc
            'Không',                                                   // 88. Thuộc danh sách đen
            'Huỳnh Thanh Long',                                        // 89. Người duyệt
            'Trụ sở Tổng công ty - Tòa nhà Trung Hải, Hà Nội',        // 90. Địa điểm làm việc
            'LD-00123',                                                // 91. Số sổ QL lao động
            2.34,                                                      // 92. Hệ số lương
            '01/01/2026',                                              // 93. Ngày học việc
            'Huỳnh Thanh Long',                                        // 94. Quản lý trực tiếp
            'Trần Minh Đức',                                           // 95. Quản lý gián tiếp
            16000000,                                                  // 96. Lương cơ bản
            16000000,                                                  // 97. Lương đóng BH
            '1903456789012',                                           // 98. TK ngân hàng
            'Vietcombank',                                             // 99. Ngân hàng
            'Chi nhánh Hà Nội',                                        // 100. Chi nhánh
            '01/03/2026',                                              // 101. Ngày tham gia BH
            'Lê Thị Thu',                                              // 102. Nhân sự khai thác
            '0123456789',                                              // 107. Số sổ BHXH
            'VietnamWorks',                                            // 108. Nguồn ứng viên
            '0123456789',                                              // 109. Mã số BHXH
            '001',                                                     // 110. Mã tỉnh cấp
            'DN4010123456789',                                         // 111. Số thẻ BHYT
            'Bệnh viện Bạch Mai - Hà Nội',                             // 112. Nơi đăng ký KCB
            'Khối Văn phòng Tổng công ty',                             // 113. Khu vực làm việc
            positions[0]?.position_id || 'POS-01',                     // 114. Mã vị trí công việc
            depts[0]?.department_id || 'HR'                            // 115. Mã đơn vị công tác
        ],
        [
            'TH-2002',
            'Trần Thị Mai',
            'Nữ',
            '20/11/1995',
            '0912987654',
            'mai.tt@trunghaico.vn',
            positions[1]?.position_name || 'Kế toán viên',
            depts[1]?.department_name || 'Phòng Kế Toán Tài Chính',
            '15/02/2026',
            '15/04/2026',
            'Hợp đồng thử việc',
            'Đang làm việc',
            '1 năm',
            'Có',
            '0912987654',
            '',
            '',
            '20/11/2055',
            'Thử việc',
            '2',
            15000000,
            'Có',
            'Đà Nẵng',
            'Quảng Nam',
            'Độc thân',
            '8590123456',
            'Công chức',
            'Nhân viên',
            'Kinh',
            'Không',
            'Việt Nam',
            '034195009876',
            '15/12/2022',
            'Cục Cảnh sát Quản lý hành chính về trật tự xã hội',
            '20/11/2035',
            'CCCD',
            '',
            '',
            '',
            '',
            '12/12',
            'Đại học',
            'Đại học Kinh Tế - ĐH Đà Nẵng',
            'Tài chính Kế toán',
            'Kế toán Tổng hợp',
            2017,
            'Khá',
            '02363888999',
            '',
            '',
            'maitt95@yahoo.com',
            '',
            'mai.tran.acc',
            'facebook.com/maitt95',
            'Số 45 Lê Duẩn, P. Hải Châu 1, Q. Hải Châu, TP. Đà Nẵng',
            'Việt Nam',
            'Đà Nẵng',
            'Hải Châu',
            'Hải Châu 1',
            'Số 45 Lê Duẩn',
            'HK-048123',
            'HGD-048567',
            'Không',
            'Số 45 Lê Duẩn, P. Hải Châu 1, Q. Hải Châu, TP. Đà Nẵng',
            'Việt Nam',
            'Đà Nẵng',
            'Hải Châu',
            'Hải Châu 1',
            'Số 45 Lê Duẩn',
            'Trần Văn Cường',
            'Bố',
            '0905123456',
            '02363888999',
            'cuongtv@gmail.com',
            'Số 45 Lê Duẩn, P. Hải Châu 1, Q. Hải Châu, TP. Đà Nẵng',
            'mai.tt@trunghaico.vn',
            'Kích hoạt',
            'Chưa kích hoạt',
            'Chờ duyệt',
            '15/02/2026',
            '15/04/2026',
            'Chuyên viên Kế toán Tổng hợp',
            '2002',
            'Cấp 3',
            'Bậc 2',
            '',
            '',
            'Không',
            'Huỳnh Thanh Long',
            'Chi nhánh Miền Trung - Đà Nẵng',
            'LD-00124',
            2.10,
            '',
            'Huỳnh Thanh Long',
            '',
            12000000,
            12000000,
            '1029384756',
            'Techcombank',
            'Chi nhánh Đà Nẵng',
            '15/02/2026',
            '32%',
            '25.5%',
            '4.5%',
            '2%',
            'Lê Thị Thu',
            '0481234567',
            'TopCV',
            '0481234567',
            '048',
            'DN4480481234567',
            'Bệnh viện Đa khoa Đà Nẵng',
            'Khối Kế toán Tài chính',
            positions[1]?.position_id || 'POS-02',
            depts[1]?.department_id || 'KT'
        ]
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(sampleRows);
    ws1['!cols'] = sampleHeaders.map(() => ({ wch: 20 }));
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

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="Mau_Nhap_Lieu_Nhan_Su.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
});

// 1.1 DOWNLOAD 1,000 SAMPLE EMPLOYEES EXCEL FILE
app.get('/api/employees/sample-1000', (req, res) => {
    const filePath = path.join(__dirname, 'Mau_1000_Nhan_Su_TRUNGHAI.xlsx');
    if (fs.existsSync(filePath)) {
        res.download(filePath, 'Mau_1000_Nhan_Su_TRUNGHAI.xlsx');
    } else {
        res.status(404).json({ success: false, message: 'File 1000 nhân sự mẫu chưa được tạo' });
    }
});

// 2. IMPORT EMPLOYEES FROM EXCEL BATCH (WITH PRIMARY KEY DUPLICATE VALIDATION)
app.post('/api/employees/import-excel', async (req, res) => {
    try {
        const clientSheetId = req.headers['x-spreadsheet-id'] || req.body.spreadsheetId;
        const clientCreds = req.headers['x-google-credentials'] || req.body.googleCredentials;
        if (clientSheetId) activeClientSpreadsheetId = clientSheetId;
        if (clientCreds) activeClientCredentials = clientCreds;

        const db = loadDatabase();
        const { employees: importedList, overwrite, skip_errors, scope_mode, selected_tabs, operator_id, operator_name, operator_role } = req.body;

        if (!Array.isArray(importedList) || importedList.length === 0) {
            return res.status(400).json({ success: false, message: 'Danh sách nhân sự cần nhập rỗng' });
        }

        const employees = db.tables['03_Employees'] || [];
        const contacts = db.tables['04_Contacts_Addresses'] || [];
        const identity = db.tables['05_Identity_Docs'] || [];
        const emergency = db.tables['06_Emergency_Contacts'] || [];
        const education = db.tables['07_Education'] || [];
        const salaries = db.tables['08_Salaries_Banks'] || [];
        const insurance = db.tables['09_Insurance_Welfare'] || [];
        const allowances = db.tables['14_Allowances_Deductions'] || [];
        const contracts = db.tables['10_Contracts'] || [];
        const masterProfiles = db.tables['00_Master_Profiles'] || [];
        const depts = db.tables['01_Departments'] || [];
        const pos = db.tables['02_Positions'] || [];

        const TAB_FIELDS_MAP = {
            'tab-p-personal': ['Mã nhân viên', 'Họ và tên', 'Tên gọi khác', 'Giới tính', 'Ngày sinh', 'Nơi sinh', 'Nguyên quán', 'Tình trạng hôn nhân', 'Dân tộc', 'Tôn giáo', 'Quốc tịch', 'MST cá nhân'],
            'tab-p-org': ['Đơn vị công tác', 'Mã đơn vị công tác', 'Vị trí công việc', 'Mã vị trí công việc', 'Chức danh', 'Cấp', 'Bậc', 'Mã chấm công', 'Quản lý trực tiếp', 'Quản lý gián tiếp', 'Người duyệt', 'Địa điểm làm việc', 'Khu vực làm việc', 'Tính chất lao động', 'Trạng thái lao động', 'Nhân sự khai thác', 'Nguồn ứng viên', 'Số sổ QL lao động'],
            'tab-p-contract': ['Loại hợp đồng', 'Ngày học việc', 'Ngày thử việc', 'Ngày chính thức', 'Thâm niên', 'Ngày có hiệu lực', 'Ngày hết hiệu lực', 'Nhóm lý do nghỉ', 'Lý do nghỉ', 'Ngày nghỉ việc', 'Ngày nghỉ hưu dự kiến', 'Thuộc danh sách đen', 'Tham gia công đoàn'],
            'tab-p-identity': ['Loại giấy tờ', 'Số CMND', 'Ngày cấp giấy tờ', 'Nơi cấp giấy tờ', 'Ngày hết hạn giấy tờ', 'Số Hộ chiếu', 'Ngày cấp Hộ chiếu', 'Nơi cấp Hộ chiếu', 'Ngày hết hạn Hộ chiếu'],
            'tab-p-contact': ['ĐT di động', 'ĐT cơ quan', 'ĐT nhà riêng', 'ĐT khác', 'Email cơ quan', 'Email cá nhân', 'Email khác', 'Skype', 'Facebook', 'Hộ khẩu thường trú', 'Quốc gia (Thường trú)', 'Tỉnh/Thành phố (Thường trú)', 'Quận/Huyện (Thường trú)', 'Phường/Xã (Thường trú)', 'Số nhà, đường phố (Thường trú)', 'Số sổ hộ khẩu', 'Mã số hộ gia đình', 'Là chủ hộ', 'Chỗ ở hiện nay', 'Quốc gia (Hiện nay)', 'Tỉnh/Thành phố (Hiện nay)', 'Quận/Huyện (Hiện nay)', 'Phường/Xã (Hiện nay)', 'Số nhà, đường phố (Hiện nay)', 'TP gia đình', 'TP bản thân'],
            'tab-p-emergency': ['Họ và tên (LHKC)', 'Quan hệ (LHKC)', 'ĐT di động (LHKC)', 'ĐT nhà riêng (LHKC)', 'Email (LHKC)', 'Địa chỉ (LHKC)'],
            'tab-p-education': ['Trình độ văn hóa', 'Trình độ đào tạo', 'Nơi đào tạo', 'Khoa', 'Chuyên ngành', 'Năm tốt nghiệp', 'Xếp loại'],
            'tab-p-salary': ['Bậc lương', 'Hệ số lương', 'Lương cơ bản', 'Tỷ lệ hưởng lương', 'Lương đóng BH', 'Tổng lương', 'TK ngân hàng', 'Ngân hàng', 'Chi nhánh', 'Thuế suất', 'Số người phụ thuộc', 'Giảm trừ bản thân', 'Tham gia bảo hiểm', 'Tỷ lệ đóng BHXH của NV', 'Tỷ lệ đóng BHYT của NV', 'Tỷ lệ đóng BHTN của NV', 'Tỷ lệ đóng BHXH của DN', 'Tỷ lệ đóng BHYT của DN', 'Tỷ lệ đóng BHTN của DN', 'Ngày tham gia BH', 'Số sổ BHXH', 'Mã số BHXH', 'Mã tỉnh cấp', 'Số thẻ BHYT', 'Nơi đăng ký KCB', 'Mật khẩu phiếu lương'],
            'tab-p-allowance': ['Tổng phụ cấp', 'Số khoản phụ cấp', 'Tổng giảm trừ', 'Ghi chú phụ cấp'],
            'tab-p-account': ['ĐT tài khoản', 'Email tài khoản', 'Trạng thái tài khoản', 'Trạng thái chữ ký số', 'Trạng thái hồ sơ cấp CKS']
        };
        const isTabSelected = (tabId) => (!selected_tabs || selected_tabs.includes('all') || selected_tabs.includes(tabId));

        // Build lookup maps for fast resolution
        const deptMapById = {};
        const deptMapByName = {};
        depts.forEach(d => {
            deptMapById[(d.department_id || '').toUpperCase()] = d;
            deptMapByName[(d.department_name || '').toLowerCase().trim()] = d;
        });

        const posMapById = {};
        const posMapByName = {};
        pos.forEach(p => {
            posMapById[(p.position_id || '').toUpperCase()] = p;
            posMapByName[(p.position_name || '').toLowerCase().trim()] = p;
        });

        // Build DB maps for primary key validation
        const dbEmpById = {};
        const dbEmpByTimeCode = {};
        const dbEmpByIdNumber = {};
        const dbEmpByWorkEmail = {};

        employees.forEach(e => {
            if (e.employee_id) dbEmpById[e.employee_id.toUpperCase()] = e;
            if (e.time_attendance_code) dbEmpByTimeCode[e.time_attendance_code.toString().trim()] = e;
        });

        identity.forEach(i => {
            if (i.id_number) dbEmpByIdNumber[i.id_number.toString().trim()] = i;
        });

        contacts.forEach(c => {
            if (c.work_email) dbEmpByWorkEmail[c.work_email.toLowerCase().trim()] = c;
        });

        // Determine next ID seed
        let maxNum = 2000;
        employees.forEach(e => {
            const match = (e.employee_id || '').match(/TH-(\d+)/);
            if (match) {
                const n = parseInt(match[1], 10);
                if (n > maxNum) maxNum = n;
            }
        });

        let insertedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        const processedIds = new Set();
        const seenFileEmpIds = new Map();
        const seenFileIdNumbers = new Map();
        const seenFileEmails = new Map();
        const conflictErrors = [];

        function getVal(obj, ...keys) {
            for (const key of keys) {
                if (obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim() !== '') {
                    return String(obj[key]).trim();
                }
            }
            return '';
        }

        function hasVal(obj, ...keys) {
            for (const key of keys) {
                if (obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim() !== '' && String(obj[key]).trim() !== '-') {
                    return true;
                }
            }
            if (obj.raw_data && typeof obj.raw_data === 'object') {
                for (const key of keys) {
                    if (obj.raw_data[key] !== undefined && obj.raw_data[key] !== null && String(obj.raw_data[key]).trim() !== '' && String(obj.raw_data[key]).trim() !== '-') {
                        return true;
                    }
                }
            }
            if (obj.provided_fields && Array.isArray(obj.provided_fields)) {
                const normKeys = keys.map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ''));
                if (obj.provided_fields.some(f => normKeys.includes(f.toLowerCase().replace(/[^a-z0-9]/g, '')))) {
                    return true;
                }
            }
            return false;
        }

        // 1. First Pass: Validate batch for duplicates
        importedList.forEach((item, idx) => {
            const rowNum = idx + 1;
            const empId = getVal(item, 'Mã nhân viên', 'Mã nhân viên (*)', 'employee_id', 'Mã NV').toUpperCase();
            const idNumber = getVal(item, 'Số CMND', 'Số CCCD / CMND', 'Số CCCD / Hộ chiếu', 'Số CCCD', 'CCCD', 'id_number');
            const email = getVal(item, 'Email cơ quan', 'Email công việc', 'Email', 'work_email').toLowerCase();
            const fullName = getVal(item, 'Họ và tên', 'Họ và tên (*)', 'full_name', 'Họ tên');

            if (!fullName) {
                conflictErrors.push({ row: rowNum, employee_id: empId, message: `Dòng ${rowNum}: Thiếu Họ và tên (*)` });
                return;
            }

            // Check duplicate ID in file
            if (empId) {
                if (seenFileEmpIds.has(empId)) {
                    conflictErrors.push({ row: rowNum, employee_id: empId, message: `Dòng ${rowNum}: Trùng Mã nhân viên ${empId} với dòng ${seenFileEmpIds.get(empId)} trong file Excel` });
                } else {
                    seenFileEmpIds.set(empId, rowNum);
                }
            }

            // Check duplicate CCCD/CMND in file (only when identity tab is selected)
            if (idNumber && isTabSelected('tab-p-identity')) {
                if (seenFileIdNumbers.has(idNumber)) {
                    conflictErrors.push({ row: rowNum, employee_id: empId, message: `Dòng ${rowNum}: Trùng số CMND/CCCD ${idNumber} với dòng ${seenFileIdNumbers.get(idNumber)} trong file Excel` });
                } else {
                    seenFileIdNumbers.set(idNumber, rowNum);
                }

                // Check duplicate CCCD with DB on a DIFFERENT employee
                const existingWithCCCD = dbEmpByIdNumber[idNumber];
                if (existingWithCCCD && (!empId || existingWithCCCD.employee_id !== empId)) {
                    conflictErrors.push({ row: rowNum, employee_id: empId, message: `Dòng ${rowNum}: Số CMND/CCCD ${idNumber} đã thuộc về nhân sự khác (${existingWithCCCD.employee_id} - ${existingWithCCCD.full_name}) trong hệ thống` });
                }
            }

            // Check duplicate Email with DB on a DIFFERENT employee (only when contact tab is selected)
            if (email && email.includes('@') && isTabSelected('tab-p-contact')) {
                if (seenFileEmails.has(email)) {
                    conflictErrors.push({ row: rowNum, employee_id: empId, message: `Dòng ${rowNum}: Trùng Email cơ quan ${email} với dòng ${seenFileEmails.get(email)} trong file Excel` });
                } else {
                    seenFileEmails.set(email, rowNum);
                }

                const existingWithEmail = dbEmpByWorkEmail[email];
                if (existingWithEmail && (!empId || existingWithEmail.employee_id !== empId)) {
                    conflictErrors.push({ row: rowNum, employee_id: empId, message: `Dòng ${rowNum}: Email ${email} đã được sử dụng bởi nhân sự (${existingWithEmail.employee_id} - ${existingWithEmail.full_name}) trong hệ thống` });
                }
            }
        });

        // If there are conflict errors and skip_errors is false, reject batch
        if (conflictErrors.length > 0 && !skip_errors) {
            return res.status(400).json({
                success: false,
                has_conflicts: true,
                conflict_count: conflictErrors.length,
                errors: conflictErrors,
                message: `Phát hiện ${conflictErrors.length} lỗi trùng lặp / xung đột dữ liệu Primary Key. Vui lòng kiểm tra lại!`
            });
        }

        const conflictRowSet = new Set(conflictErrors.map(e => e.row));

        // 2. Second Pass: Process valid rows with all 115 standardized columns
        for (let i = 0; i < importedList.length; i++) {
            const rowNum = i + 1;
            if (conflictRowSet.has(rowNum)) {
                skippedCount++;
                continue;
            }

            const item = importedList[i];
            const fullName = getVal(item, 'Họ và tên', 'Họ và tên (*)', 'full_name', 'Họ tên');
            if (!fullName) continue;

            // Resolve Department
            const rawDeptId = getVal(item, 'Mã đơn vị công tác', 'Mã phòng ban (*)', 'Mã phòng ban', 'department_id');
            const rawDeptName = getVal(item, 'Đơn vị công tác', 'Phòng ban', 'Phòng/Ban', 'department_name');
            let deptObj = deptMapById[rawDeptId.toUpperCase()] || deptMapByName[rawDeptName.toLowerCase()] || deptMapByName[rawDeptId.toLowerCase()] || depts[0] || { department_id: 'HR', department_name: 'Phòng Hành Chính Nhân Sự' };
            const deptId = normalizeDepartmentCode(rawDeptId || rawDeptName) || deptObj.department_id;
            const deptName = normalizeDepartmentName(rawDeptName || rawDeptId) || deptObj.department_name;

            // Resolve Position
            const rawPosId = getVal(item, 'Mã vị trí công việc', 'Mã chức danh / Vị trí (*)', 'Mã chức danh', 'position_id');
            const rawPosName = getVal(item, 'Vị trí công việc', 'Chức danh', 'Vị trí', 'position_name');
            let posObj = posMapById[rawPosId.toUpperCase()] || posMapByName[rawPosName.toLowerCase()] || posMapByName[rawPosId.toLowerCase()] || pos[0] || { position_id: 'POS-01', position_name: 'Chuyên viên' };
            const posId = rawPosId || posObj.position_id;
            const posTitle = rawPosName || posObj.position_name;

            // Resolve or generate Employee ID
            let empId = getVal(item, 'Mã nhân viên', 'Mã nhân viên (*)', 'employee_id', 'Mã NV').toUpperCase();
            if (!empId || processedIds.has(empId)) {
                maxNum++;
                empId = `TH-${maxNum}`;
            }
            processedIds.add(empId);

            const timeAttendanceCode = getVal(item, 'Mã chấm công', 'time_attendance_code') || empId.replace('TH-', '');
            const gender = getVal(item, 'Giới tính', 'Giới tính (*)', 'gender') || 'Nam';
            const dob = getVal(item, 'Ngày sinh', 'Ngày sinh (DD/MM/YYYY)', 'date_of_birth') || null;
            const birthPlace = getVal(item, 'Nơi sinh', 'birth_place');
            const nativePlace = getVal(item, 'Nguyên quán', 'native_place');
            const ethnicity = getVal(item, 'Dân tộc', 'ethnicity') || 'Kinh';
            const religion = getVal(item, 'Tôn giáo', 'religion') || 'Không';
            const nationality = getVal(item, 'Quốc tịch', 'nationality') || 'Việt Nam';
            const maritalStatus = getVal(item, 'Tình trạng hôn nhân', 'marital_status') || 'Độc thân';
            const childrenCount = parseInt(getVal(item, 'Số con', 'children_count') || 0, 10) || 0;

            const jobLevel = getVal(item, 'Cấp', 'job_level') || 'Cấp 3';
            const jobRank = getVal(item, 'Bậc', 'Cấp bậc nhân sự', 'Cấp bậc', 'job_rank') || 'Bậc 3';
            const professionalTitle = getVal(item, 'Chức danh', 'Chức danh chuyên môn', 'job_title') || posTitle;
            const workLocation = getVal(item, 'Địa điểm làm việc', 'work_location') || 'Trụ sở Tổng công ty - Tòa nhà Trung Hải, Hà Nội';
            const workArea = getVal(item, 'Khu vực làm việc', 'Khối / Khu vực làm việc', 'Khối làm việc', 'work_area') || 'Khối Văn phòng Tổng công ty';
            const directMgrName = getVal(item, 'Quản lý trực tiếp', 'Họ tên quản lý trực tiếp', 'direct_manager_name');
            const directMgrId = getVal(item, 'Mã quản lý trực tiếp', 'direct_manager_id') || null;
            const indirectMgrName = getVal(item, 'Quản lý gián tiếp', 'Họ tên quản lý gián tiếp', 'indirect_manager_name');
            const indirectMgrId = getVal(item, 'Mã quản lý gián tiếp', 'indirect_manager_id') || null;

            const laborNature = getVal(item, 'Tính chất lao động', 'Tính chất lao động (*)', 'Tính chất', 'labor_nature') || 'Chính thức';
            const empStatus = getVal(item, 'Trạng thái lao động', 'Trạng thái làm việc (*)', 'Trạng thái', 'employment_status') || 'Đang làm việc';
            const apprenticeStartDate = getVal(item, 'Ngày học việc', 'apprentice_start_date');
            const trialStartDate = getVal(item, 'Ngày thử việc', 'Ngày bắt đầu thử việc', 'trial_start_date', 'probation_start_date');
            const officialDate = getVal(item, 'Ngày chính thức', 'Ngày ký HĐ chính thức', 'official_date');
            const startDate = apprenticeStartDate || trialStartDate || officialDate || getVal(item, 'Ngày bắt đầu làm việc', 'start_date') || new Date().toISOString().split('T')[0];
            const endDate = getVal(item, 'Ngày hết hiệu lực', 'Ngày kết thúc (HĐ/Nghỉ)', 'Ngày kết thúc', 'end_date') || 'Không xác định';
            const contractType = getVal(item, 'Loại hợp đồng', 'Loại hợp đồng (*)', 'contract_type') || 'Hợp đồng lao động không xác định thời hạn';
            const effectiveDate = getVal(item, 'Ngày có hiệu lực', 'effective_date') || startDate;
            const expiryDate = getVal(item, 'Ngày hết hiệu lực', 'expiry_date') || (endDate !== 'Không xác định' ? endDate : null);
            const seniority = getVal(item, 'Thâm niên', 'seniority');
            const aliasName = getVal(item, 'Tên gọi khác', 'alias_name');
            const resignationReasonGroup = getVal(item, 'Nhóm lý do nghỉ', 'resignation_reason_group');
            const resignationReason = getVal(item, 'Lý do nghỉ', 'resignation_reason');
            const resignationDate = getVal(item, 'Ngày nghỉ việc', 'resignation_date') || (empStatus === 'Đã nghỉ việc' ? endDate : null);
            const expectedRetirementDate = getVal(item, 'Ngày nghỉ hưu dự kiến', 'expected_retirement_date');
            const isBlacklisted = getVal(item, 'Thuộc danh sách đen', 'is_blacklisted') === 'Có';
            const approverName = getVal(item, 'Người duyệt', 'approved_by') || 'Huỳnh Thanh Long';
            const laborBookNumber = getVal(item, 'Số sổ QL lao động', 'labor_book_number');
            const recruiterName = getVal(item, 'Nhân sự khai thác', 'recruiter_name');
            const candidateSource = getVal(item, 'Nguồn ứng viên', 'candidate_source');
            const familyBackground = getVal(item, 'TP gia đình', 'family_background');
            const personalBackground = getVal(item, 'TP bản thân', 'personal_background');

            // Contacts & Address
            const phone = getVal(item, 'ĐT di động', 'Số ĐT di động (*)', 'Số ĐT di động', 'Số điện thoại', 'Điện thoại', 'mobile_phone');
            const officePhone = getVal(item, 'ĐT cơ quan', 'office_phone');
            const homePhone = getVal(item, 'ĐT nhà riêng', 'Số ĐT bàn / Khác', 'Số ĐT bàn', 'home_phone');
            const otherPhone = getVal(item, 'ĐT khác', 'other_phone');
            const email = getVal(item, 'Email cơ quan', 'Email công việc', 'Email', 'work_email') || `${empId.toLowerCase()}@trunghaico.vn`;
            const personalEmail = getVal(item, 'Email cá nhân', 'personal_email');
            const otherEmail = getVal(item, 'Email khác', 'other_email');
            const skype = getVal(item, 'Skype', 'skype');
            const facebook = getVal(item, 'Facebook', 'facebook');

            const permAddress = getVal(item, 'Hộ khẩu thường trú', 'Địa chỉ thường trú', 'permanent_address_full');
            const permCountry = getVal(item, 'Quốc gia (Thường trú)', 'permanent_country') || 'Việt Nam';
            const permProvince = getVal(item, 'Tỉnh/Thành phố (Thường trú)', 'permanent_province');
            const permDistrict = getVal(item, 'Quận/Huyện (Thường trú)', 'permanent_district');
            const permWard = getVal(item, 'Phường/Xã (Thường trú)', 'permanent_ward');
            const permStreet = getVal(item, 'Số nhà, đường phố (Thường trú)', 'permanent_street');
            const householdBookNo = getVal(item, 'Số sổ hộ khẩu', 'household_book_number');
            const householdCode = getVal(item, 'Mã số hộ gia đình', 'household_code');
            const isHouseholdHead = getVal(item, 'Là chủ hộ', 'is_household_head');

            const currAddress = getVal(item, 'Chỗ ở hiện nay', 'Địa chỉ tạm trú / Hiện tại', 'Địa chỉ hiện tại', 'Địa chỉ tạm trú', 'current_address_full') || permAddress;
            const currCountry = getVal(item, 'Quốc gia (Hiện nay)', 'current_country') || 'Việt Nam';
            const currProvince = getVal(item, 'Tỉnh/Thành phố (Hiện nay)', 'current_province');
            const currDistrict = getVal(item, 'Quận/Huyện (Hiện nay)', 'current_district');
            const currWard = getVal(item, 'Phường/Xã (Hiện nay)', 'current_ward');
            const currStreet = getVal(item, 'Số nhà, đường phố (Hiện nay)', 'current_street');

            // Documents
            const idNumber = getVal(item, 'Số CMND', 'Số CCCD / CMND', 'Số CCCD / Hộ chiếu', 'Số CCCD', 'CCCD', 'id_number');
            const idIssueDate = getVal(item, 'Ngày cấp giấy tờ', 'Ngày cấp CCCD (DD/MM/YYYY)', 'Ngày cấp CCCD', 'Ngày cấp', 'id_issue_date') || null;
            const idIssuePlace = getVal(item, 'Nơi cấp giấy tờ', 'Nơi cấp CCCD', 'Nơi cấp', 'id_issue_place') || 'Cục Cảnh sát Quản lý hành chính về trật tự xã hội';
            const idExpiryDate = getVal(item, 'Ngày hết hạn giấy tờ', 'Ngày hết hạn CCCD', 'id_expiry_date') || null;
            const idType = getVal(item, 'Loại giấy tờ', 'id_type') || 'CCCD';
            const passportNumber = getVal(item, 'Số Hộ chiếu', 'Số hộ chiếu (Passport)', 'Số hộ chiếu', 'passport_number');
            const passportIssueDate = getVal(item, 'Ngày cấp Hộ chiếu', 'Ngày cấp hộ chiếu', 'passport_issue_date') || null;
            const passportIssuePlace = getVal(item, 'Nơi cấp Hộ chiếu', 'passport_issue_place');
            const passportExpiryDate = getVal(item, 'Ngày hết hạn Hộ chiếu', 'passport_expiry_date') || null;
            const taxCode = getVal(item, 'MST cá nhân', 'Mã số thuế cá nhân', 'Mã số thuế', 'tax_code');

            // Salary & Bank
            const salaryGrade = parseInt(getVal(item, 'Bậc lương', 'salary_grade') || 3, 10) || 3;
            const salaryCoeff = parseFloat(getVal(item, 'Hệ số lương', 'salary_coefficient')) || (1.8 + salaryGrade * 0.35);
            const baseSalary = parseFloat(String(getVal(item, 'Lương cơ bản', 'Lương cơ bản (VNĐ) (*)', 'Lương cơ bản (VNĐ)', 'base_salary') || '0').replace(/[^0-9.-]+/g, '')) || 0;
            const totalSalary = parseFloat(String(getVal(item, 'Tổng lương', 'Tổng lương / Thu nhập (VNĐ)', 'total_salary') || '0').replace(/[^0-9.-]+/g, '')) || (baseSalary > 0 ? Math.round(baseSalary * 1.25) : 0);
            const insuranceSalary = parseFloat(String(getVal(item, 'Lương đóng BH', 'Lương đóng BHXH (VNĐ)', 'Lương đóng BHXH', 'insurance_salary') || '0').replace(/[^0-9.-]+/g, '')) || Math.min(baseSalary, 23400000);
            const bankAccount = getVal(item, 'TK ngân hàng', 'Số tài khoản ngân hàng', 'Số tài khoản', 'STK', 'bank_account_number');
            const bankName = getVal(item, 'Ngân hàng', 'Tên ngân hàng', 'bank_name') || 'Vietcombank';
            const bankBranch = getVal(item, 'Chi nhánh', 'Chi nhánh ngân hàng', 'bank_branch') || 'Chi nhánh Hà Nội';

            // Insurance & Welfare
            const hasInsurance = getVal(item, 'Tham gia bảo hiểm', 'Tham gia BHXH', 'has_insurance') || 'Có';
            const unionMember = getVal(item, 'Tham gia công đoàn', 'Đoàn viên công đoàn', 'union_member') || 'Đoàn viên';
            const socialInsuranceBook = getVal(item, 'Số sổ BHXH', 'Số sổ / Mã số BHXH', 'social_insurance_book_no');
            const socialInsuranceCode = getVal(item, 'Mã số BHXH', 'social_insurance_code') || socialInsuranceBook;
            const insuranceJoinDate = getVal(item, 'Ngày tham gia BH', 'Ngày tham gia BHXH', 'insurance_join_date') || startDate;
            const insuranceProvinceCode = getVal(item, 'Mã tỉnh cấp', 'insurance_province_code');
            const healthInsuranceCardNo = getVal(item, 'Số thẻ BHYT', 'health_insurance_card_no');
            const hospitalRegistered = getVal(item, 'Nơi đăng ký KCB', 'Nơi ĐK khám chữa bệnh ban đầu', 'Nơi ĐK KCB ban đầu', 'hospital_registered') || 'Bệnh viện Bạch Mai - Hà Nội';

            // Education
            const culturalLevel = getVal(item, 'Trình độ văn hóa', 'cultural_level') || '12/12';
            const eduLevel = getVal(item, 'Trình độ đào tạo', 'Trình độ học vấn', 'education_level') || 'Đại học';
            const degreeType = getVal(item, 'Hình thức đào tạo', 'degree_type') || 'Chính quy';
            const institution = getVal(item, 'Nơi đào tạo', 'Trường / Cơ sở đào tạo', 'Trường', 'institution') || 'Đại học';
            const faculty = getVal(item, 'Khoa', 'faculty');
            const eduMajor = getVal(item, 'Chuyên ngành', 'Chuyên ngành đào tạo', 'major');
            const gradYear = parseInt(getVal(item, 'Năm tốt nghiệp', 'graduation_year') || 2020, 10) || 2020;
            const gradClassification = getVal(item, 'Xếp loại', 'Xếp loại tốt nghiệp', 'classification') || 'Khá';
            const otherCerts = getVal(item, 'Bằng cấp chuyên môn khác & Chứng chỉ', 'Bằng cấp khác', 'other_certificates');

            // Emergency Contact (LHKC)
            const emergName = getVal(item, 'Họ và tên (LHKC)', 'Họ tên người liên hệ khẩn cấp', 'Người liên hệ khẩn cấp', 'emergency_name');
            const emergRelation = getVal(item, 'Quan hệ (LHKC)', 'Mối quan hệ khẩn cấp', 'Quan hệ khẩn cấp', 'emergency_relation') || 'Người thân';
            const emergPhone = getVal(item, 'ĐT di động (LHKC)', 'Số ĐT khẩn cấp', 'SĐT khẩn cấp', 'emergency_phone');
            const emergHomePhone = getVal(item, 'ĐT nhà riêng (LHKC)', 'emergency_home_phone');
            const emergEmail = getVal(item, 'Email (LHKC)', 'emergency_email');
            const emergAddress = getVal(item, 'Địa chỉ (LHKC)', 'emergency_address') || permAddress;

            // Account & Digital signature
            const accountPhone = getVal(item, 'ĐT tài khoản', 'account_phone') || phone;
            const accountEmail = getVal(item, 'Email tài khoản', 'account_email') || email;
            const accountStatus = getVal(item, 'Trạng thái tài khoản', 'account_status') || 'Kích hoạt';
            const digitalSignatureStatus = getVal(item, 'Trạng thái chữ ký số', 'digital_signature_status');
            const digitalCertStatus = getVal(item, 'Trạng thái hồ sơ cấp CKS', 'digital_cert_status');

            // Full 115 columns record for 00_Master_Profiles
            const masterRow = {
                'Mã nhân viên': empId,
                'Họ và tên': fullName,
                'Giới tính': gender,
                'Ngày sinh': dob || '',
                'ĐT di động': phone,
                'Email cơ quan': email,
                'Vị trí công việc': posTitle,
                'Đơn vị công tác': deptName,
                'Ngày thử việc': trialStartDate || '',
                'Ngày chính thức': officialDate || '',
                'Loại hợp đồng': contractType,
                'Trạng thái lao động': empStatus,
                'Thâm niên': seniority || '',
                'Tham gia bảo hiểm': hasInsurance,
                'ĐT tài khoản': accountPhone,
                'Tên gọi khác': aliasName,
                'Nhóm lý do nghỉ': resignationReasonGroup,
                'Ngày nghỉ hưu dự kiến': expectedRetirementDate || '',
                'Tính chất lao động': laborNature,
                'Bậc lương': String(salaryGrade),
                'Tổng lương': totalSalary,
                'Tham gia công đoàn': unionMember,
                'Nơi sinh': birthPlace,
                'Nguyên quán': nativePlace,
                'Tình trạng hôn nhân': maritalStatus,
                'MST cá nhân': taxCode,
                'TP gia đình': familyBackground,
                'TP bản thân': personalBackground,
                'Dân tộc': ethnicity,
                'Tôn giáo': religion,
                'Quốc tịch': nationality,
                'Số CMND': idNumber,
                'Ngày cấp giấy tờ': idIssueDate || '',
                'Nơi cấp giấy tờ': idIssuePlace,
                'Ngày hết hạn giấy tờ': idExpiryDate || '',
                'Loại giấy tờ': idType,
                'Số Hộ chiếu': passportNumber,
                'Ngày cấp Hộ chiếu': passportIssueDate || '',
                'Nơi cấp Hộ chiếu': passportIssuePlace,
                'Ngày hết hạn Hộ chiếu': passportExpiryDate || '',
                'Trình độ văn hóa': culturalLevel,
                'Trình độ đào tạo': eduLevel,
                'Nơi đào tạo': institution,
                'Khoa': faculty,
                'Chuyên ngành': eduMajor,
                'Năm tốt nghiệp': gradYear,
                'Xếp loại': gradClassification,
                'ĐT cơ quan': officePhone,
                'ĐT nhà riêng': homePhone,
                'ĐT khác': otherPhone,
                'Email cá nhân': personalEmail,
                'Email khác': otherEmail,
                'Skype': skype,
                'Facebook': facebook,
                'Hộ khẩu thường trú': permAddress,
                'Quốc gia (Thường trú)': permCountry,
                'Tỉnh/Thành phố (Thường trú)': permProvince,
                'Quận/Huyện (Thường trú)': permDistrict,
                'Phường/Xã (Thường trú)': permWard,
                'Số nhà, đường phố (Thường trú)': permStreet,
                'Số sổ hộ khẩu': householdBookNo,
                'Mã số hộ gia đình': householdCode,
                'Là chủ hộ': isHouseholdHead,
                'Chỗ ở hiện nay': currAddress,
                'Quốc gia (Hiện nay)': currCountry,
                'Tỉnh/Thành phố (Hiện nay)': currProvince,
                'Quận/Huyện (Hiện nay)': currDistrict,
                'Phường/Xã (Hiện nay)': currWard,
                'Số nhà, đường phố (Hiện nay)': currStreet,
                'Họ và tên (LHKC)': emergName,
                'Quan hệ (LHKC)': emergRelation,
                'ĐT di động (LHKC)': emergPhone,
                'ĐT nhà riêng (LHKC)': emergHomePhone,
                'Email (LHKC)': emergEmail,
                'Địa chỉ (LHKC)': emergAddress,
                'Email tài khoản': accountEmail,
                'Trạng thái tài khoản': accountStatus,
                'Trạng thái chữ ký số': digitalSignatureStatus,
                'Trạng thái hồ sơ cấp CKS': digitalCertStatus,
                'Ngày có hiệu lực': effectiveDate || '',
                'Ngày hết hiệu lực': expiryDate || '',
                'Chức danh': professionalTitle,
                'Mã chấm công': timeAttendanceCode,
                'Cấp': jobLevel,
                'Bậc': jobRank,
                'Lý do nghỉ': resignationReason,
                'Ngày nghỉ việc': resignationDate || '',
                'Thuộc danh sách đen': isBlacklisted ? 'Có' : 'Không',
                'Người duyệt': approverName,
                'Địa điểm làm việc': workLocation,
                'Số sổ QL lao động': laborBookNumber,
                'Hệ số lương': salaryCoeff,
                'Ngày học việc': apprenticeStartDate || '',
                'Quản lý trực tiếp': directMgrName,
                'Quản lý gián tiếp': indirectMgrName,
                'Lương cơ bản': baseSalary,
                'Lương đóng BH': insuranceSalary,
                'TK ngân hàng': bankAccount,
                'Ngân hàng': bankName,
                'Chi nhánh': bankBranch,
                'Ngày tham gia BH': insuranceJoinDate || '',
                'Nhân sự khai thác': recruiterName,
                'Số sổ BHXH': socialInsuranceBook,
                'Nguồn ứng viên': candidateSource,
                'Mã số BHXH': socialInsuranceCode,
                'Mã tỉnh cấp': insuranceProvinceCode,
                'Số thẻ BHYT': healthInsuranceCardNo,
                'Nơi đăng ký KCB': hospitalRegistered,
                'Khu vực làm việc': workArea,
                'Mã vị trí công việc': posId,
                'Mã đơn vị công tác': deptId
            };

            const existingIdx = employees.findIndex(e => e.employee_id === empId);

            if (existingIdx >= 0 && overwrite) {
                // UPDATE RECORD (NON-DESTRUCTIVE: ONLY UPDATE SELECTED TABS)
                const currentEmp = employees[existingIdx];
                const updatedEmp = { ...currentEmp };

                if (isTabSelected('tab-p-personal')) {
                    if (hasVal(item, 'Họ và tên', 'Họ tên', 'full_name') && fullName) updatedEmp.full_name = fullName;
                    if (hasVal(item, 'Tên gọi khác', 'alias_name') && aliasName) updatedEmp.alias_name = aliasName;
                    if (hasVal(item, 'Giới tính', 'gender') && gender) updatedEmp.gender = gender;
                    if (hasVal(item, 'Ngày sinh', 'date_of_birth') && dob) updatedEmp.date_of_birth = dob;
                    if (hasVal(item, 'Nơi sinh', 'birth_place') && birthPlace) updatedEmp.birth_place = birthPlace;
                    if (hasVal(item, 'Nguyên quán', 'native_place') && nativePlace) updatedEmp.native_place = nativePlace;
                    if (hasVal(item, 'Dân tộc', 'ethnicity') && ethnicity) updatedEmp.ethnicity = ethnicity;
                    if (hasVal(item, 'Tôn giáo', 'religion') && religion) updatedEmp.religion = religion;
                    if (hasVal(item, 'Quốc tịch', 'nationality') && nationality) updatedEmp.nationality = nationality;
                    if (hasVal(item, 'Tình trạng hôn nhân', 'marital_status') && maritalStatus) updatedEmp.marital_status = maritalStatus;
                    if (hasVal(item, 'Số con', 'children_count') && childrenCount !== undefined) updatedEmp.children_count = childrenCount;
                    if (hasVal(item, 'MST cá nhân', 'tax_code') && taxCode) updatedEmp.tax_code = taxCode;
                }

                if (isTabSelected('tab-p-org')) {
                    if (hasVal(item, 'Mã đơn vị công tác', 'Mã phòng ban', 'department_id') && deptId) updatedEmp.department_id = deptId;
                    if (hasVal(item, 'Đơn vị công tác', 'Phòng ban', 'department_name') && deptName) updatedEmp.department_name = deptName;
                    if (hasVal(item, 'Mã vị trí công việc', 'position_id') && posId) updatedEmp.position_id = posId;
                    if (hasVal(item, 'Cấp', 'job_level') && jobLevel) updatedEmp.job_level = jobLevel;
                    if (hasVal(item, 'Bậc', 'job_rank') && jobRank) updatedEmp.job_rank = jobRank;
                    if (hasVal(item, 'Chức danh', 'job_title') && professionalTitle) updatedEmp.job_title = professionalTitle;
                    if (hasVal(item, 'Địa điểm làm việc', 'work_location') && workLocation) updatedEmp.work_location = workLocation;
                    if (hasVal(item, 'Khu vực làm việc', 'work_area') && workArea) updatedEmp.work_area = workArea;
                    if (hasVal(item, 'Mã chấm công', 'time_attendance_code') && timeAttendanceCode) updatedEmp.time_attendance_code = timeAttendanceCode;
                    if (hasVal(item, 'Mã quản lý trực tiếp', 'direct_manager_id') && directMgrId) updatedEmp.direct_manager_id = directMgrId;
                    if (hasVal(item, 'Quản lý trực tiếp', 'direct_manager_name') && directMgrName) updatedEmp.direct_manager_name = directMgrName;
                    if (hasVal(item, 'Mã quản lý gián tiếp', 'indirect_manager_id') && indirectMgrId) updatedEmp.indirect_manager_id = indirectMgrId;
                    if (hasVal(item, 'Quản lý gián tiếp', 'indirect_manager_name') && indirectMgrName) updatedEmp.indirect_manager_name = indirectMgrName;
                    if (hasVal(item, 'Trạng thái lao động', 'employment_status') && empStatus) updatedEmp.employment_status = empStatus;
                    if (hasVal(item, 'Tính chất lao động', 'labor_nature') && laborNature) updatedEmp.labor_nature = laborNature;
                    if (hasVal(item, 'Nhân sự khai thác', 'recruiter_name') && recruiterName) updatedEmp.recruiter_name = recruiterName;
                    if (hasVal(item, 'Nguồn ứng viên', 'candidate_source') && candidateSource) updatedEmp.candidate_source = candidateSource;
                    if (hasVal(item, 'Số sổ QL lao động', 'labor_book_number') && laborBookNumber) updatedEmp.labor_book_number = laborBookNumber;
                }

                if (isTabSelected('tab-p-contract')) {
                    if (hasVal(item, 'Loại hợp đồng', 'contract_type') && contractType) updatedEmp.contract_type = contractType;
                    if (hasVal(item, 'Ngày bắt đầu làm việc', 'start_date') && startDate) updatedEmp.start_date = startDate;
                    if (hasVal(item, 'Ngày hết hiệu lực', 'end_date') && endDate) updatedEmp.end_date = endDate;
                    if (hasVal(item, 'Ngày học việc', 'apprentice_start_date') && apprenticeStartDate) updatedEmp.apprentice_start_date = apprenticeStartDate;
                    if (hasVal(item, 'Ngày thử việc', 'trial_start_date') && trialStartDate) {
                        updatedEmp.probation_start_date = trialStartDate;
                        updatedEmp.trial_start_date = trialStartDate;
                    }
                    if (hasVal(item, 'Ngày chính thức', 'official_date') && officialDate) updatedEmp.official_date = officialDate;
                    if (hasVal(item, 'Ngày nghỉ việc', 'resignation_date') && resignationDate) updatedEmp.resignation_date = resignationDate;
                    if (hasVal(item, 'Lý do nghỉ', 'resignation_reason') && resignationReason) updatedEmp.resignation_reason = resignationReason;
                    if (hasVal(item, 'Nhóm lý do nghỉ', 'resignation_reason_group') && resignationReasonGroup) updatedEmp.resignation_reason_group = resignationReasonGroup;
                    if (hasVal(item, 'Ngày nghỉ hưu dự kiến', 'expected_retirement_date') && expectedRetirementDate) updatedEmp.expected_retirement_date = expectedRetirementDate;
                    if (hasVal(item, 'Thuộc danh sách đen', 'is_blacklisted') && isBlacklisted !== undefined) updatedEmp.is_blacklisted = isBlacklisted;
                    if (hasVal(item, 'Người duyệt', 'approved_by') && approverName) updatedEmp.approved_by = approverName;
                    if (hasVal(item, 'Thâm niên', 'seniority') && seniority) updatedEmp.seniority_text = seniority;
                }

                if (isTabSelected('tab-p-education')) {
                    if (hasVal(item, 'Bằng cấp chuyên môn khác & Chứng chỉ', 'other_certificates') && otherCerts) updatedEmp.other_certificates = otherCerts;
                }

                if (isTabSelected('tab-p-salary')) {
                    if (hasVal(item, 'Lương cơ bản', 'base_salary') && baseSalary) updatedEmp.base_salary = baseSalary;
                    if (hasVal(item, 'Tổng lương', 'total_salary') && totalSalary) updatedEmp.total_salary = totalSalary;
                    if (hasVal(item, 'TK ngân hàng', 'bank_account_number') && bankAccount) updatedEmp.bank_account_number = bankAccount;
                    if (hasVal(item, 'Ngân hàng', 'bank_name') && bankName) updatedEmp.bank_name = bankName;
                    if (hasVal(item, 'Chi nhánh', 'bank_branch') && bankBranch) updatedEmp.bank_branch = bankBranch;
                }

                if (isTabSelected('tab-p-allowance')) {
                    const totalAllow = parseFloat(getVal(item, 'Tổng phụ cấp', 'total_allowance') || 0);
                    const allowCount = parseInt(getVal(item, 'Số khoản phụ cấp', 'allowance_count') || 0, 10);
                    if (hasVal(item, 'Tổng phụ cấp', 'total_allowance') && totalAllow) updatedEmp.total_allowance = totalAllow;
                    if (hasVal(item, 'Số khoản phụ cấp', 'allowance_count') && allowCount) updatedEmp.allowance_count = allowCount;
                }

                employees[existingIdx] = updatedEmp;

                // Update contact (ONLY if tab-p-contact selected)
                if (isTabSelected('tab-p-contact')) {
                    const cIdx = contacts.findIndex(c => c.employee_id === empId);
                    if (cIdx >= 0) {
                        contacts[cIdx] = {
                            ...contacts[cIdx],
                            full_name: fullName || contacts[cIdx].full_name,
                            mobile_phone: phone || contacts[cIdx].mobile_phone,
                            office_phone: officePhone || contacts[cIdx].office_phone,
                            home_phone: homePhone || contacts[cIdx].home_phone,
                            other_phone: otherPhone || contacts[cIdx].other_phone,
                            work_email: email || contacts[cIdx].work_email,
                            personal_email: personalEmail || contacts[cIdx].personal_email,
                            other_email: otherEmail || contacts[cIdx].other_email,
                            skype: skype || contacts[cIdx].skype,
                            facebook: facebook || contacts[cIdx].facebook,
                            permanent_address_full: permAddress || contacts[cIdx].permanent_address_full,
                            permanent_country: permCountry || contacts[cIdx].permanent_country,
                            permanent_province: permProvince || contacts[cIdx].permanent_province,
                            permanent_district: permDistrict || contacts[cIdx].permanent_district,
                            permanent_ward: permWard || contacts[cIdx].permanent_ward,
                            permanent_street: permStreet || contacts[cIdx].permanent_street,
                            household_book_number: householdBookNo || contacts[cIdx].household_book_number,
                            household_code: householdCode || contacts[cIdx].household_code,
                            is_household_head: isHouseholdHead || contacts[cIdx].is_household_head,
                            current_address_full: currAddress || contacts[cIdx].current_address_full,
                            current_country: currCountry || contacts[cIdx].current_country,
                            current_province: currProvince || contacts[cIdx].current_province,
                            current_district: currDistrict || contacts[cIdx].current_district,
                            current_ward: currWard || contacts[cIdx].current_ward,
                            current_street: currStreet || contacts[cIdx].current_street
                        };
                    }
                }

                // Update identity (ONLY if tab-p-identity selected)
                if (isTabSelected('tab-p-identity')) {
                    const iIdx = identity.findIndex(i => i.employee_id === empId);
                    if (iIdx >= 0) {
                        identity[iIdx] = {
                            ...identity[iIdx],
                            full_name: fullName || identity[iIdx].full_name,
                            doc_type: idType || identity[iIdx].doc_type,
                            id_number: idNumber || identity[iIdx].id_number,
                            id_issue_date: idIssueDate || identity[iIdx].id_issue_date,
                            id_issue_place: idIssuePlace || identity[iIdx].id_issue_place,
                            id_expiry_date: idExpiryDate || identity[iIdx].id_expiry_date,
                            passport_number: passportNumber || identity[iIdx].passport_number,
                            passport_issue_date: passportIssueDate || identity[iIdx].passport_issue_date,
                            passport_issue_place: passportIssuePlace || identity[iIdx].passport_issue_place,
                            passport_expiry_date: passportExpiryDate || identity[iIdx].passport_expiry_date
                        };
                    }
                }

                // Update salary & insurance (ONLY if tab-p-salary selected)
                if (isTabSelected('tab-p-salary')) {
                    const sIdx = salaries.findIndex(s => s.employee_id === empId);
                    if (sIdx >= 0) {
                        salaries[sIdx] = {
                            ...salaries[sIdx],
                            full_name: fullName || salaries[sIdx].full_name,
                            salary_grade: salaryGrade || salaries[sIdx].salary_grade,
                            salary_coefficient: salaryCoeff || salaries[sIdx].salary_coefficient,
                            base_salary: baseSalary || salaries[sIdx].base_salary,
                            total_salary: totalSalary || salaries[sIdx].total_salary,
                            insurance_salary: insuranceSalary || salaries[sIdx].insurance_salary,
                            bank_account_number: bankAccount || salaries[sIdx].bank_account_number,
                            bank_name: bankName || salaries[sIdx].bank_name,
                            bank_branch: bankBranch || salaries[sIdx].bank_branch
                        };
                    }

                    const insIdx = insurance.findIndex(ins => ins.employee_id === empId);
                    if (insIdx >= 0) {
                        insurance[insIdx] = {
                            ...insurance[insIdx],
                            full_name: fullName || insurance[insIdx].full_name,
                            has_insurance: hasInsurance || insurance[insIdx].has_insurance,
                            social_insurance_book_no: socialInsuranceBook || insurance[insIdx].social_insurance_book_no,
                            social_insurance_code: socialInsuranceCode || insurance[insIdx].social_insurance_code,
                            insurance_join_date: insuranceJoinDate || insurance[insIdx].insurance_join_date,
                            total_insurance_rate: insuranceRateTotal || insurance[insIdx].total_insurance_rate,
                            social_insurance_rate: insuranceRateSocial || insurance[insIdx].social_insurance_rate,
                            health_insurance_rate: insuranceRateHealth || insurance[insIdx].health_insurance_rate,
                            unemployment_insurance_rate: insuranceRateUnemployment || insurance[insIdx].unemployment_insurance_rate,
                            insurance_province_code: insuranceProvinceCode || insurance[insIdx].insurance_province_code,
                            health_insurance_card_no: healthInsuranceCardNo || insurance[insIdx].health_insurance_card_no,
                            hospital_registered: hospitalRegistered || insurance[insIdx].hospital_registered,
                            union_member: unionMember || insurance[insIdx].union_member
                        };
                    }
                }

                // Update education (ONLY if tab-p-education selected)
                if (isTabSelected('tab-p-education')) {
                    const eduIdx = education.findIndex(ed => ed.employee_id === empId);
                    if (eduIdx >= 0) {
                        education[eduIdx] = {
                            ...education[eduIdx],
                            full_name: fullName || education[eduIdx].full_name,
                            cultural_level: culturalLevel || education[eduIdx].cultural_level,
                            education_level: eduLevel || education[eduIdx].education_level,
                            degree_type: degreeType || education[eduIdx].degree_type,
                            institution: institution || education[eduIdx].institution,
                            faculty: faculty || education[eduIdx].faculty,
                            major: eduMajor || education[eduIdx].major,
                            graduation_year: gradYear || education[eduIdx].graduation_year,
                            classification: gradClassification || education[eduIdx].classification,
                            other_certificates: otherCerts || education[eduIdx].other_certificates
                        };
                    }
                }

                // Update contracts (ONLY if tab-p-contract selected)
                if (isTabSelected('tab-p-contract')) {
                    const ctIdx = contracts.findIndex(c => c.employee_id === empId);
                    if (ctIdx >= 0) {
                        contracts[ctIdx] = {
                            ...contracts[ctIdx],
                            full_name: fullName || contracts[ctIdx].full_name,
                            contract_type: contractType || contracts[ctIdx].contract_type,
                            start_date: startDate || contracts[ctIdx].start_date,
                            end_date: endDate || contracts[ctIdx].end_date,
                            trial_start_date: trialStartDate || contracts[ctIdx].trial_start_date,
                            official_date: officialDate || contracts[ctIdx].official_date,
                            effective_date: effectiveDate || contracts[ctIdx].effective_date,
                            expiry_date: expiryDate || contracts[ctIdx].expiry_date
                        };
                    }
                }

                // Update master profiles (selective update: only update columns belonging to selected tabs)
                const mpIdx = masterProfiles.findIndex(m => (m['Mã nhân viên'] === empId || m.employee_id === empId));
                if (mpIdx >= 0) {
                    const currentMaster = { ...masterProfiles[mpIdx] };
                    Object.keys(TAB_FIELDS_MAP).forEach(tabId => {
                        if (isTabSelected(tabId)) {
                            TAB_FIELDS_MAP[tabId].forEach(fKey => {
                                if (hasVal(item, fKey) && masterRow[fKey] !== undefined && masterRow[fKey] !== null && masterRow[fKey] !== '') {
                                    currentMaster[fKey] = masterRow[fKey];
                                } else if (item.raw_data && item.raw_data[fKey] !== undefined && item.raw_data[fKey] !== null && String(item.raw_data[fKey]).trim() !== '') {
                                    currentMaster[fKey] = item.raw_data[fKey];
                                }
                            });
                        }
                    });
                    masterProfiles[mpIdx] = currentMaster;
                }

                updatedCount++;
            } else if (existingIdx === -1) {
                // INSERT NEW RECORD
                const newEmp = {
                    employee_id: empId,
                    time_attendance_code: timeAttendanceCode,
                    full_name: fullName,
                    alias_name: aliasName,
                    gender,
                    date_of_birth: dob,
                    birth_place: birthPlace,
                    native_place: nativePlace,
                    ethnicity,
                    religion,
                    nationality,
                    marital_status: maritalStatus,
                    children_count: childrenCount,
                    tax_code: taxCode,
                    department_id: deptId,
                    department_name: deptName,
                    position_id: posId,
                    job_level: jobLevel,
                    job_rank: jobRank,
                    job_title: professionalTitle,
                    direct_manager_id: directMgrId,
                    direct_manager_name: directMgrName,
                    indirect_manager_id: indirectMgrId,
                    indirect_manager_name: indirectMgrName,
                    work_location: workLocation,
                    work_area: workArea,
                    employment_status: empStatus,
                    labor_nature: laborNature,
                    start_date: startDate,
                    end_date: endDate,
                    contract_type: contractType,
                    apprentice_start_date: apprenticeStartDate,
                    probation_start_date: trialStartDate,
                    trial_start_date: trialStartDate,
                    official_date: officialDate,
                    resignation_date: resignationDate,
                    resignation_reason: resignationReason,
                    resignation_reason_group: resignationReasonGroup,
                    expected_retirement_date: expectedRetirementDate,
                    is_blacklisted: isBlacklisted,
                    approved_by: approverName,
                    labor_book_number: laborBookNumber,
                    recruiter_name: recruiterName,
                    candidate_source: candidateSource,
                    other_certificates: otherCerts,
                    seniority_text: seniority || 'Mới gia nhập'
                };
                employees.unshift(newEmp);

                contacts.unshift({
                    employee_id: empId,
                    full_name: fullName,
                    mobile_phone: phone,
                    office_phone: officePhone,
                    home_phone: homePhone,
                    other_phone: otherPhone,
                    work_email: email,
                    personal_email: personalEmail,
                    other_email: otherEmail,
                    skype: skype,
                    facebook: facebook,
                    permanent_address_full: permAddress,
                    permanent_country: permCountry,
                    permanent_province: permProvince,
                    permanent_district: permDistrict,
                    permanent_ward: permWard,
                    permanent_street: permStreet,
                    household_book_number: householdBookNo,
                    household_code: householdCode,
                    is_household_head: isHouseholdHead,
                    current_address_full: currAddress,
                    current_country: currCountry,
                    current_province: currProvince,
                    current_district: currDistrict,
                    current_ward: currWard,
                    current_street: currStreet
                });

                identity.unshift({
                    employee_id: empId,
                    full_name: fullName,
                    doc_type: idType,
                    id_number: idNumber,
                    id_issue_date: idIssueDate,
                    id_issue_place: idIssuePlace,
                    id_expiry_date: idExpiryDate,
                    passport_number: passportNumber || null,
                    passport_issue_date: passportIssueDate || null,
                    passport_issue_place: passportIssuePlace || null,
                    passport_expiry_date: passportExpiryDate || null
                });

                if (emergName) {
                    emergency.unshift({
                        employee_id: empId,
                        full_name: fullName,
                        contact_name: emergName,
                        relationship: emergRelation,
                        mobile_phone: emergPhone,
                        home_phone: emergHomePhone,
                        email: emergEmail,
                        address: emergAddress
                    });
                }

                education.unshift({
                    employee_id: empId,
                    full_name: fullName,
                    cultural_level: culturalLevel,
                    education_level: eduLevel,
                    degree_type: degreeType,
                    institution: institution,
                    faculty: faculty,
                    major: eduMajor || 'Chuyên ngành',
                    other_certificates: otherCerts,
                    graduation_year: gradYear,
                    classification: gradClassification
                });

                salaries.unshift({
                    employee_id: empId,
                    full_name: fullName,
                    salary_grade: salaryGrade,
                    salary_coefficient: salaryCoeff,
                    base_salary: baseSalary,
                    total_salary: totalSalary,
                    insurance_salary: insuranceSalary,
                    bank_account_number: bankAccount,
                    bank_name: bankName,
                    bank_branch: bankBranch
                });

                insurance.unshift({
                    employee_id: empId,
                    full_name: fullName,
                    has_insurance: hasInsurance,
                    social_insurance_book_no: socialInsuranceBook,
                    social_insurance_code: socialInsuranceCode,
                    insurance_join_date: insuranceJoinDate,
                    total_insurance_rate: insuranceRateTotal,
                    social_insurance_rate: insuranceRateSocial,
                    health_insurance_rate: insuranceRateHealth,
                    unemployment_insurance_rate: insuranceRateUnemployment,
                    insurance_province_code: insuranceProvinceCode,
                    health_insurance_card_no: healthInsuranceCardNo,
                    hospital_registered: hospitalRegistered,
                    union_member: unionMember
                });

                contracts.unshift({
                    contract_id: empId,
                    employee_id: empId,
                    full_name: fullName,
                    contract_type: contractType,
                    start_date: startDate,
                    end_date: endDate,
                    trial_start_date: trialStartDate,
                    official_date: officialDate,
                    effective_date: effectiveDate,
                    expiry_date: expiryDate,
                    contract_status: 'HIỆU LỰC'
                });

                masterProfiles.unshift(masterRow);

                insertedCount++;
            }
        }

        db.tables['03_Employees'] = employees;
        db.tables['04_Contacts_Addresses'] = contacts;
        db.tables['05_Identity_Docs'] = identity;
        db.tables['06_Emergency_Contacts'] = emergency;
        db.tables['07_Education'] = education;
        db.tables['08_Salaries_Banks'] = salaries;
        db.tables['09_Insurance_Welfare'] = insurance;
        db.tables['10_Contracts'] = contracts;
        db.tables['00_Master_Profiles'] = masterProfiles;

        recordLog(db, {
            action_type: 'IMPORT',
            module: 'Nhân sự',
            description: `Nhập danh sách ${insertedCount + updatedCount} nhân sự từ file Excel (Thêm mới: ${insertedCount}, Cập nhật: ${updatedCount}, Bỏ qua lỗi: ${skippedCount})`,
            user_id: operator_id || 'TH-0001',
            user_name: operator_name || 'Huỳnh Thanh Long',
            user_role: operator_role || 'ADMIN',
            ip: req.ip
        });

        saveDatabase(db);

        res.json({
            success: true,
            count: insertedCount + updatedCount,
            inserted: insertedCount,
            updated: updatedCount,
            skipped: skippedCount,
            errors: conflictErrors,
            message: `Nhập Excel thành công! Đã thêm mới ${insertedCount} nhân sự, cập nhật ${updatedCount} nhân sự${skippedCount > 0 ? `, bỏ qua ${skippedCount} dòng xung đột/lỗi` : ''}.`
        });
    } catch (err) {
        console.error('Error importing employees:', err);
        res.status(500).json({ success: false, message: 'Lỗi xử lý file Excel: ' + err.message });
    }
});

// 4. GET EMPLOYEE DETAIL BY ID (Full 8 Tabs)
app.get('/api/employees/:id', (req, res) => {
    const db = loadDatabase();
    const id = req.params.id;

    const employees = db.tables['03_Employees'] || [];
    const contacts = db.tables['04_Contacts_Addresses'] || [];
    const identity = db.tables['05_Identity_Docs'] || [];
    const emergency = db.tables['06_Emergency_Contacts'] || [];
    const education = db.tables['07_Education'] || [];
    const salaries = db.tables['08_Salaries_Banks'] || [];
    const insurance = db.tables['09_Insurance_Welfare'] || [];
    const allowances = (db.tables['14_Allowances_Deductions'] || []).filter(a => a.employee_id === id);
    const contracts = db.tables['10_Contracts'] || [];
    const accounts = db.tables['11_System_Accounts'] || [];
    const depts = db.tables['01_Departments'] || [];
    const pos = db.tables['02_Positions'] || [];

    const employee = employees.find(e => e.employee_id === id);
    if (!employee) {
        return res.status(404).json({ success: false, message: 'Nhân viên không tồn tại' });
    }

    const dept = depts.find(d => d.department_id === employee.department_id) || {};
    const position = pos.find(p => p.position_id === employee.position_id || (p.position_id && p.position_id.replace(/^THG_/, '') === employee.position_id) || p.position_name === employee.position_name) || {};

    const contact = contacts.find(c => c.employee_id === id) || {};
    const idDoc = identity.find(i => i.employee_id === id) || {};
    const emerg = emergency.filter(e => e.employee_id === id);
    const edu = education.filter(e => e.employee_id === id);
    const sal = salaries.find(s => s.employee_id === id) || {};
    const ins = insurance.find(i => i.employee_id === id) || {};
    const cont = contracts.filter(c => c.employee_id === id);
    const acc = accounts.find(a => a.employee_id === id) || {};
    const masterProfiles = db.tables['00_Master_Profiles'] || [];
    const masterProfile = masterProfiles.find(m => m['Mã nhân viên'] === id || m.employee_id === id) || null;

    res.json({
        success: true,
        data: {
            employee: {
                ...employee,
                department_name: dept.department_name || employee.department_id,
                position_name: position.position_name || employee.position_id
            },
            contact,
            identity: idDoc,
            emergency: emerg,
            education: edu,
            salary: sal,
            insurance: ins,
            allowances,
            contracts: cont,
            account: acc,
            master_profile: masterProfile
        }
    });
});

// 5. CREATE NEW EMPLOYEE (FULL 115 STANDARDIZED ATTRIBUTES)
app.post('/api/employees', (req, res) => {
    const db = loadDatabase();
    const body = req.body;
    const masterData = body.master_profile ? { ...body.master_profile } : { ...body };

    const fullName = (masterData['Họ và tên'] || body.full_name || '').trim();
    const deptNameOrId = masterData['Đơn vị công tác'] || masterData['Mã đơn vị công tác'] || body.department_id || body.department_name || '';
    const posNameOrId = masterData['Vị trí công việc'] || masterData['Mã vị trí công việc'] || body.position_id || body.position_name || '';

    if (!fullName) {
        return res.status(400).json({ success: false, message: 'Họ và tên là bắt buộc (*)' });
    }

    const employees = db.tables['03_Employees'] || [];
    const depts = db.tables['01_Departments'] || [];
    const pos = db.tables['02_Positions'] || [];
    
    // Resolve Department & Position
    const deptObj = depts.find(d => d.department_id === deptNameOrId || d.department_name === deptNameOrId) || depts[0] || { department_id: 'HR', department_name: 'Phòng Hành Chính Nhân Sự' };
    const cleanPosNameOrId = (posNameOrId || '').trim();
    const posObj = pos.find(p => 
        p.position_id === cleanPosNameOrId || 
        p.position_name === cleanPosNameOrId || 
        (p.position_id && p.position_id.replace(/^THG_/, '') === cleanPosNameOrId) ||
        (p.position_name && p.position_name.toLowerCase() === cleanPosNameOrId.toLowerCase()) ||
        (p.position_id && p.position_id.toLowerCase() === cleanPosNameOrId.toLowerCase())
    ) || pos[0] || { position_id: 'POS-01', position_name: 'Chuyên viên' };

    // Auto-generate employee_id if not provided
    let newId = (masterData['Mã nhân viên'] || body.employee_id || '').trim();
    if (!newId) {
        let maxNum = 2000;
        employees.forEach(e => {
            const match = (e.employee_id || '').match(/TH-(\d+)/);
            if (match) {
                const n = parseInt(match[1], 10);
                if (n > maxNum) maxNum = n;
            }
        });
        newId = `TH-${maxNum + 1}`;
    }

    // Check duplicate
    if (employees.some(e => e.employee_id === newId)) {
        return res.status(400).json({ success: false, message: `Mã nhân viên ${newId} đã tồn tại` });
    }

    // Normalize masterData
    masterData['Mã nhân viên'] = newId;
    masterData['Họ và tên'] = fullName;
    masterData['Đơn vị công tác'] = deptObj.department_name || deptNameOrId;
    masterData['Mã đơn vị công tác'] = deptObj.department_id || '';
    masterData['Vị trí công việc'] = posObj.position_name || posNameOrId;
    masterData['Mã vị trí công việc'] = posObj.position_id || '';

    const baseSal = parseFloat(masterData['Lương cơ bản']) || parseFloat(body.base_salary) || 0;
    const totSal = parseFloat(masterData['Tổng lương']) || parseFloat(body.total_salary) || (baseSal * 1.25);
    const startDate = masterData['Ngày học việc'] || masterData['Ngày thử việc'] || masterData['Ngày chính thức'] || body.start_date || new Date().toISOString().split('T')[0];
    const endDate = masterData['Ngày hết hiệu lực'] || masterData['Ngày nghỉ việc'] || body.end_date || 'Không xác định';

    // Build 03_Employees entry
    const newEmp = {
        employee_id: newId,
        time_attendance_code: masterData['Mã chấm công'] || body.time_attendance_code || newId.replace('TH-', ''),
        full_name: fullName,
        alias_name: masterData['Tên gọi khác'] || '',
        gender: masterData['Giới tính'] || body.gender || 'Nam',
        date_of_birth: masterData['Ngày sinh'] || body.date_of_birth || null,
        birth_place: masterData['Nơi sinh'] || body.birth_place || '',
        native_place: masterData['Nguyên quán'] || body.native_place || '',
        ethnicity: masterData['Dân tộc'] || body.ethnicity || 'Kinh',
        religion: masterData['Tôn giáo'] || body.religion || 'Không',
        nationality: masterData['Quốc tịch'] || body.nationality || 'Việt Nam',
        marital_status: masterData['Tình trạng hôn nhân'] || body.marital_status || 'Độc thân',
        children_count: parseInt(masterData['Số con'] || body.children_count || 0, 10) || 0,
        tax_code: masterData['MST cá nhân'] || body.tax_code || '',
        company_id: deptObj.company_id || 'TH-CORP',
        department_id: deptObj.department_id || 'HR',
        department_name: deptObj.department_name || deptNameOrId,
        position_id: posObj.position_id || 'POS-01',
        position_name: posObj.position_name || posNameOrId,
        job_rank: masterData['Bậc'] || masterData['Bậc lương'] || body.job_rank || 'Cấp 3 - Chuyên viên / Nhân viên Nghiệp vụ',
        job_level: masterData['Cấp'] || 'Cấp 3',
        job_title: masterData['Chức danh'] || posObj.position_name || posNameOrId,
        direct_manager_id: masterData['Mã quản lý trực tiếp'] || body.direct_manager_id || null,
        direct_manager_name: masterData['Quản lý trực tiếp'] || body.direct_manager_name || '',
        indirect_manager_id: masterData['Mã quản lý gián tiếp'] || body.indirect_manager_id || null,
        indirect_manager_name: masterData['Quản lý gián tiếp'] || body.indirect_manager_name || '',
        work_location: masterData['Địa điểm làm việc'] || body.work_location || 'Trụ sở Tổng công ty - Tòa nhà Trung Hải, Hà Nội',
        work_area: masterData['Khu vực làm việc'] || body.work_area || 'Khối Văn phòng Tổng công ty',
        employment_status: masterData['Trạng thái lao động'] || body.employment_status || 'Đang làm việc',
        labor_nature: masterData['Tính chất lao động'] || body.labor_nature || 'Chính thức',
        start_date: startDate,
        end_date: endDate,
        contract_type: masterData['Loại hợp đồng'] || body.contract_type || 'Hợp đồng lao động không xác định thời hạn',
        apprentice_start_date: masterData['Ngày học việc'] || null,
        probation_start_date: masterData['Ngày thử việc'] || startDate,
        trial_start_date: masterData['Ngày thử việc'] || startDate,
        official_date: masterData['Ngày chính thức'] || startDate,
        resignation_date: masterData['Ngày nghỉ việc'] || (masterData['Trạng thái lao động'] === 'Đã nghỉ việc' ? endDate : null),
        resignation_reason: masterData['Lý do nghỉ'] || '',
        resignation_reason_group: masterData['Nhóm lý do nghỉ'] || '',
        expected_retirement_date: masterData['Ngày nghỉ hưu dự kiến'] || null,
        is_blacklisted: masterData['Thuộc danh sách đen'] === 'Có',
        approved_by: masterData['Người duyệt'] || 'Huỳnh Thanh Long',
        labor_book_number: masterData['Số sổ QL lao động'] || '',
        recruiter_name: masterData['Nhân sự khai thác'] || '',
        candidate_source: masterData['Nguồn ứng viên'] || '',
        other_certificates: masterData['Bằng cấp chuyên môn khác'] || body.other_certificates || '',
        seniority_text: masterData['Thâm niên'] || 'Mới gia nhập'
    };

    employees.unshift(newEmp);
    db.tables['03_Employees'] = employees;

    // Contacts
    const contacts = db.tables['04_Contacts_Addresses'] || [];
    contacts.unshift({
        employee_id: newId,
        full_name: fullName,
        mobile_phone: masterData['ĐT di động'] || body.mobile_phone || '',
        office_phone: masterData['ĐT cơ quan'] || body.office_phone || '',
        home_phone: masterData['ĐT nhà riêng'] || body.home_phone || '',
        other_phone: masterData['ĐT khác'] || '',
        work_email: masterData['Email cơ quan'] || body.work_email || `${newId.toLowerCase()}@trunghaico.vn`,
        personal_email: masterData['Email cá nhân'] || body.personal_email || '',
        other_email: masterData['Email khác'] || '',
        skype: masterData['Skype'] || '',
        facebook: masterData['Facebook'] || '',
        permanent_address_full: masterData['Hộ khẩu thường trú'] || body.permanent_address_full || '',
        permanent_country: masterData['Quốc gia (Thường trú)'] || 'Việt Nam',
        permanent_province: masterData['Tỉnh/Thành phố (Thường trú)'] || '',
        permanent_district: masterData['Quận/Huyện (Thường trú)'] || '',
        permanent_ward: masterData['Phường/Xã (Thường trú)'] || '',
        permanent_street: masterData['Số nhà, đường phố (Thường trú)'] || '',
        household_book_number: masterData['Số sổ hộ khẩu'] || '',
        household_code: masterData['Mã số hộ gia đình'] || '',
        is_household_head: masterData['Là chủ hộ'] || 'Không',
        current_address_full: masterData['Chỗ ở hiện nay'] || body.current_address_full || '',
        current_country: masterData['Quốc gia (Hiện nay)'] || 'Việt Nam',
        current_province: masterData['Tỉnh/Thành phố (Hiện nay)'] || '',
        current_district: masterData['Quận/Huyện (Hiện nay)'] || '',
        current_ward: masterData['Phường/Xã (Hiện nay)'] || '',
        current_street: masterData['Số nhà, đường phố (Hiện nay)'] || ''
    });
    db.tables['04_Contacts_Addresses'] = contacts;

    // Identity Docs
    const identity = db.tables['05_Identity_Docs'] || [];
    identity.unshift({
        employee_id: newId,
        full_name: fullName,
        doc_type: masterData['Loại giấy tờ'] || body.doc_type || 'CCCD',
        id_number: masterData['Số CMND'] || body.id_number || '',
        id_issue_date: masterData['Ngày cấp giấy tờ'] || body.id_issue_date || null,
        id_issue_place: masterData['Nơi cấp giấy tờ'] || body.id_issue_place || 'Cục Cảnh sát Quản lý hành chính về trật tự xã hội',
        id_expiry_date: masterData['Ngày hết hạn giấy tờ'] || body.id_expiry_date || null,
        passport_number: masterData['Số Hộ chiếu'] || body.passport_number || null,
        passport_issue_date: masterData['Ngày cấp Hộ chiếu'] || null,
        passport_issue_place: masterData['Nơi cấp Hộ chiếu'] || null,
        passport_expiry_date: masterData['Ngày hết hạn Hộ chiếu'] || null
    });
    db.tables['05_Identity_Docs'] = identity;

    // Emergency Contacts
    const emergency = db.tables['06_Emergency_Contacts'] || [];
    const emergName = masterData['Họ và tên (LHKC)'] || body.emergency_name || body.emergency_contact_name;
    if (emergName) {
        emergency.unshift({
            employee_id: newId,
            full_name: fullName,
            contact_name: emergName,
            relationship: masterData['Quan hệ (LHKC)'] || body.emergency_relation || 'Vợ',
            mobile_phone: masterData['ĐT di động (LHKC)'] || body.emergency_phone || '',
            home_phone: masterData['ĐT nhà riêng (LHKC)'] || '',
            email: masterData['Email (LHKC)'] || '',
            address: masterData['Địa chỉ (LHKC)'] || masterData['Hộ khẩu thường trú'] || ''
        });
        db.tables['06_Emergency_Contacts'] = emergency;
    }

    // Education
    const education = db.tables['07_Education'] || [];
    education.unshift({
        employee_id: newId,
        full_name: fullName,
        cultural_level: masterData['Trình độ văn hóa'] || '12/12',
        education_level: masterData['Trình độ đào tạo'] || body.education_level || 'Đại học',
        degree_type: 'Chính quy',
        institution: masterData['Nơi đào tạo'] || 'Đại học Xây Dựng Hà Nội',
        faculty: masterData['Khoa'] || 'Khoa Chuyên ngành',
        major: masterData['Chuyên ngành'] || body.major || 'Kỹ thuật Xây dựng',
        other_certificates: masterData['Bằng cấp chuyên môn khác'] || body.other_certificates || '',
        graduation_year: parseInt(masterData['Năm tốt nghiệp'], 10) || 2020,
        classification: masterData['Xếp loại'] || 'Khá'
    });
    db.tables['07_Education'] = education;

    // Salaries
    const salaries = db.tables['08_Salaries_Banks'] || [];
    salaries.unshift({
        employee_id: newId,
        full_name: fullName,
        salary_grade: parseInt(masterData['Bậc lương'], 10) || 3,
        salary_coefficient: parseFloat(masterData['Hệ số lương']) || 2.34,
        base_salary: baseSal,
        total_salary: totSal,
        insurance_salary: parseFloat(masterData['Lương đóng BH']) || Math.min(baseSal, 23400000),
        bank_account_number: masterData['TK ngân hàng'] || body.bank_account_number || '',
        bank_name: masterData['Ngân hàng'] || body.bank_name || 'Vietcombank',
        bank_branch: masterData['Chi nhánh'] || body.bank_branch || ''
    });
    db.tables['08_Salaries_Banks'] = salaries;

    // Insurance
    const insurance = db.tables['09_Insurance_Welfare'] || [];
    insurance.unshift({
        employee_id: newId,
        full_name: fullName,
        has_insurance: masterData['Tham gia bảo hiểm'] || 'Có',
        social_insurance_book_no: masterData['Số sổ BHXH'] || body.social_insurance_book_no || '',
        social_insurance_code: masterData['Mã số BHXH'] || body.social_insurance_code || '',
        insurance_join_date: masterData['Ngày tham gia BH'] || startDate,
        total_insurance_rate: '32%',
        social_insurance_rate: '25.5%',
        health_insurance_rate: '4.5%',
        unemployment_insurance_rate: '2%',
        insurance_province_code: masterData['Mã tỉnh cấp'] || '001',
        health_insurance_card_no: masterData['Số thẻ BHYT'] || '',
        hospital_registered: masterData['Nơi đăng ký KCB'] || body.hospital_registered || 'Bệnh viện Bạch Mai - Hà Nội',
        union_member: masterData['Tham gia công đoàn'] || 'Có'
    });
    db.tables['09_Insurance_Welfare'] = insurance;

    // Contracts
    const contracts = db.tables['10_Contracts'] || [];
    contracts.unshift({
        contract_id: newId,
        employee_id: newId,
        full_name: fullName,
        contract_type: masterData['Loại hợp đồng'] || body.contract_type || 'Hợp đồng lao động không xác định thời hạn',
        start_date: startDate,
        end_date: endDate,
        trial_start_date: masterData['Ngày thử việc'] || startDate,
        official_date: masterData['Ngày chính thức'] || startDate,
        effective_date: masterData['Ngày có hiệu lực'] || startDate,
        expiry_date: masterData['Ngày hết hiệu lực'] || (endDate !== 'Không xác định' ? endDate : null),
        contract_status: 'HIỆU LỰC'
    });
    db.tables['10_Contracts'] = contracts;

    // Master Profiles (00_Master_Profiles)
    if (!db.tables['00_Master_Profiles']) {
        db.tables['00_Master_Profiles'] = [];
    }
    db.tables['00_Master_Profiles'].unshift(masterData);

    recordLog(db, {
        action_type: 'CREATE',
        module: 'Nhân sự',
        description: `Thêm mới hồ sơ nhân sự ${newId} - ${fullName} (${masterData['Chức danh'] || posObj.position_name || ''})`,
        user_id: body.operator_id || 'TH-1948',
        user_name: body.operator_name || 'Huỳnh Thanh Long',
        user_role: body.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.status(201).json({
        success: true,
        message: 'Thêm nhân viên thành công',
        employee_id: newId
    });
});

// 6. UPDATE EMPLOYEE (FULL 115 STANDARDIZED ATTRIBUTES & CHANGEABLE EMPLOYEE_ID)
const updateEmployeeHandler = (req, res) => {
    const db = loadDatabase();
    const id = req.params.id;
    const body = req.body;
    const masterData = body.master_profile ? { ...body.master_profile } : { ...body };

    const employees = db.tables['03_Employees'] || [];
    const empIdx = employees.findIndex(e => e.employee_id === id);
    if (empIdx === -1) {
        return res.status(404).json({ success: false, message: 'Nhân viên không tồn tại' });
    }

    const requestedId = (masterData['Mã nhân viên'] || body.employee_id || '').trim();
    const targetId = requestedId || id;

    // Check duplicate if changing employee_id
    if (targetId !== id) {
        if (employees.some(e => e.employee_id === targetId)) {
            return res.status(400).json({ 
                success: false, 
                message: `Mã nhân viên "${targetId}" đã tồn tại trên hệ thống. Vui lòng chọn mã khác!` 
            });
        }
    }

    const depts = db.tables['01_Departments'] || [];
    const pos = db.tables['02_Positions'] || [];
    const deptNameOrId = masterData['Đơn vị công tác'] || masterData['Mã đơn vị công tác'] || body.department_id || employees[empIdx].department_id;
    const posNameOrId = masterData['Vị trí công việc'] || masterData['Mã vị trí công việc'] || body.position_id || employees[empIdx].position_id;
    const deptObj = depts.find(d => d.department_id === deptNameOrId || d.department_name === deptNameOrId) || {};
    const cleanPosNameOrId2 = (posNameOrId || '').trim();
    const posObj = pos.find(p => 
        p.position_id === cleanPosNameOrId2 || 
        p.position_name === cleanPosNameOrId2 ||
        (p.position_id && p.position_id.replace(/^THG_/, '') === cleanPosNameOrId2) ||
        (p.position_name && p.position_name.toLowerCase() === cleanPosNameOrId2.toLowerCase()) ||
        (p.position_id && p.position_id.toLowerCase() === cleanPosNameOrId2.toLowerCase())
    ) || {};

    const fullName = (masterData['Họ và tên'] || body.full_name || employees[empIdx].full_name || '').trim();

    masterData['Mã nhân viên'] = targetId;
    if (fullName) masterData['Họ và tên'] = fullName;
    if (deptObj.department_name) masterData['Đơn vị công tác'] = deptObj.department_name;
    if (deptObj.department_id) masterData['Mã đơn vị công tác'] = deptObj.department_id;
    if (posObj.position_name) masterData['Vị trí công việc'] = posObj.position_name;
    if (posObj.position_id) masterData['Mã vị trí công việc'] = posObj.position_id;

    // 1. Update core employee
    employees[empIdx] = {
        ...employees[empIdx],
        ...body,
        employee_id: targetId,
        full_name: fullName,
        gender: masterData['Giới tính'] || body.gender || employees[empIdx].gender,
        date_of_birth: masterData['Ngày sinh'] !== undefined ? masterData['Ngày sinh'] : (body.date_of_birth || employees[empIdx].date_of_birth),
        birth_place: masterData['Nơi sinh'] !== undefined ? masterData['Nơi sinh'] : (body.birth_place || employees[empIdx].birth_place),
        native_place: masterData['Nguyên quán'] !== undefined ? masterData['Nguyên quán'] : (body.native_place || employees[empIdx].native_place),
        ethnicity: masterData['Dân tộc'] || body.ethnicity || employees[empIdx].ethnicity,
        religion: masterData['Tôn giáo'] || body.religion || employees[empIdx].religion,
        nationality: masterData['Quốc tịch'] || body.nationality || employees[empIdx].nationality,
        marital_status: masterData['Tình trạng hôn nhân'] || body.marital_status || employees[empIdx].marital_status,
        tax_code: masterData['MST cá nhân'] !== undefined ? masterData['MST cá nhân'] : (body.tax_code || employees[empIdx].tax_code),
        department_id: deptObj.department_id || employees[empIdx].department_id,
        department_name: deptObj.department_name || employees[empIdx].department_name,
        position_id: posObj.position_id || employees[empIdx].position_id,
        position_name: posObj.position_name || employees[empIdx].position_name,
        job_rank: masterData['Bậc'] || masterData['Bậc lương'] || body.job_rank || employees[empIdx].job_rank,
        job_level: masterData['Cấp'] || employees[empIdx].job_level || 'Cấp 3',
        job_title: masterData['Chức danh'] || body.job_title || posObj.position_name || employees[empIdx].job_title,
        work_location: masterData['Địa điểm làm việc'] || body.work_location || employees[empIdx].work_location,
        work_area: masterData['Khu vực làm việc'] || body.work_area || employees[empIdx].work_area,
        direct_manager_name: masterData['Quản lý trực tiếp'] !== undefined ? masterData['Quản lý trực tiếp'] : employees[empIdx].direct_manager_name,
        indirect_manager_name: masterData['Quản lý gián tiếp'] !== undefined ? masterData['Quản lý gián tiếp'] : employees[empIdx].indirect_manager_name,
        labor_nature: masterData['Tính chất lao động'] || body.labor_nature || employees[empIdx].labor_nature,
        employment_status: masterData['Trạng thái lao động'] || body.employment_status || employees[empIdx].employment_status,
        contract_type: masterData['Loại hợp đồng'] || body.contract_type || employees[empIdx].contract_type,
        trial_start_date: masterData['Ngày thử việc'] !== undefined ? masterData['Ngày thử việc'] : employees[empIdx].trial_start_date,
        official_date: masterData['Ngày chính thức'] !== undefined ? masterData['Ngày chính thức'] : employees[empIdx].official_date,
        resignation_date: masterData['Ngày nghỉ việc'] !== undefined ? masterData['Ngày nghỉ việc'] : employees[empIdx].resignation_date,
        resignation_reason: masterData['Lý do nghỉ'] !== undefined ? masterData['Lý do nghỉ'] : employees[empIdx].resignation_reason,
        resignation_reason_group: masterData['Nhóm lý do nghỉ'] !== undefined ? masterData['Nhóm lý do nghỉ'] : employees[empIdx].resignation_reason_group,
        seniority_text: masterData['Thâm niên'] !== undefined ? masterData['Thâm niên'] : employees[empIdx].seniority_text
    };

    // If ID changed, cascade update references in all related tables
    if (targetId !== id) {
        employees.forEach(e => {
            if (e.direct_manager_id === id) e.direct_manager_id = targetId;
            if (e.indirect_manager_id === id) e.indirect_manager_id = targetId;
        });
        if (Array.isArray(db.tables['11_System_Accounts'])) {
            db.tables['11_System_Accounts'].forEach(a => {
                if (a.employee_id === id) a.employee_id = targetId;
            });
        }
        if (Array.isArray(db.tables['06_Emergency_Contacts'])) {
            db.tables['06_Emergency_Contacts'].forEach(em => {
                if (em.employee_id === id) em.employee_id = targetId;
            });
        }
        if (Array.isArray(db.tables['07_Education'])) {
            db.tables['07_Education'].forEach(ed => {
                if (ed.employee_id === id) ed.employee_id = targetId;
            });
        }
        if (Array.isArray(db.tables['10_Contracts'])) {
            db.tables['10_Contracts'].forEach(ct => {
                if (ct.employee_id === id) {
                    ct.employee_id = targetId;
                    ct.contract_id = targetId;
                }
            });
        }
    }
    db.tables['03_Employees'] = employees;

    // 2. Update contact
    const contacts = db.tables['04_Contacts_Addresses'] || [];
    const cIdx = contacts.findIndex(c => c.employee_id === id || c.employee_id === targetId);
    if (cIdx >= 0) {
        contacts[cIdx] = {
            ...contacts[cIdx],
            employee_id: targetId,
            full_name: fullName,
            mobile_phone: masterData['ĐT di động'] !== undefined ? masterData['ĐT di động'] : (body.mobile_phone !== undefined ? body.mobile_phone : contacts[cIdx].mobile_phone),
            office_phone: masterData['ĐT cơ quan'] !== undefined ? masterData['ĐT cơ quan'] : contacts[cIdx].office_phone,
            home_phone: masterData['ĐT nhà riêng'] !== undefined ? masterData['ĐT nhà riêng'] : (body.home_phone !== undefined ? body.home_phone : contacts[cIdx].home_phone),
            other_phone: masterData['ĐT khác'] !== undefined ? masterData['ĐT khác'] : contacts[cIdx].other_phone,
            work_email: masterData['Email cơ quan'] !== undefined ? masterData['Email cơ quan'] : (body.work_email !== undefined ? body.work_email : contacts[cIdx].work_email),
            personal_email: masterData['Email cá nhân'] !== undefined ? masterData['Email cá nhân'] : (body.personal_email !== undefined ? body.personal_email : contacts[cIdx].personal_email),
            other_email: masterData['Email khác'] !== undefined ? masterData['Email khác'] : contacts[cIdx].other_email,
            skype: masterData['Skype'] !== undefined ? masterData['Skype'] : contacts[cIdx].skype,
            facebook: masterData['Facebook'] !== undefined ? masterData['Facebook'] : contacts[cIdx].facebook,
            permanent_address_full: masterData['Hộ khẩu thường trú'] !== undefined ? masterData['Hộ khẩu thường trú'] : (body.permanent_address_full !== undefined ? body.permanent_address_full : contacts[cIdx].permanent_address_full),
            current_address_full: masterData['Chỗ ở hiện nay'] !== undefined ? masterData['Chỗ ở hiện nay'] : (body.current_address_full !== undefined ? body.current_address_full : contacts[cIdx].current_address_full)
        };
        db.tables['04_Contacts_Addresses'] = contacts;
    }

    // 3. Update identity
    const identity = db.tables['05_Identity_Docs'] || [];
    const iIdx = identity.findIndex(i => i.employee_id === id || i.employee_id === targetId);
    if (iIdx >= 0) {
        identity[iIdx] = {
            ...identity[iIdx],
            employee_id: targetId,
            full_name: fullName,
            doc_type: masterData['Loại giấy tờ'] || body.doc_type || identity[iIdx].doc_type,
            id_number: masterData['Số CMND'] !== undefined ? masterData['Số CMND'] : (body.id_number !== undefined ? body.id_number : identity[iIdx].id_number),
            id_issue_date: masterData['Ngày cấp giấy tờ'] !== undefined ? masterData['Ngày cấp giấy tờ'] : (body.id_issue_date !== undefined ? body.id_issue_date : identity[iIdx].id_issue_date),
            id_issue_place: masterData['Nơi cấp giấy tờ'] !== undefined ? masterData['Nơi cấp giấy tờ'] : (body.id_issue_place !== undefined ? body.id_issue_place : identity[iIdx].id_issue_place),
            id_expiry_date: masterData['Ngày hết hạn giấy tờ'] !== undefined ? masterData['Ngày hết hạn giấy tờ'] : identity[iIdx].id_expiry_date,
            passport_number: masterData['Số Hộ chiếu'] !== undefined ? masterData['Số Hộ chiếu'] : (body.passport_number !== undefined ? body.passport_number : identity[iIdx].passport_number),
            passport_issue_date: masterData['Ngày cấp Hộ chiếu'] !== undefined ? masterData['Ngày cấp Hộ chiếu'] : identity[iIdx].passport_issue_date,
            passport_issue_place: masterData['Nơi cấp Hộ chiếu'] !== undefined ? masterData['Nơi cấp Hộ chiếu'] : identity[iIdx].passport_issue_place,
            passport_expiry_date: masterData['Ngày hết hạn Hộ chiếu'] !== undefined ? masterData['Ngày hết hạn Hộ chiếu'] : identity[iIdx].passport_expiry_date
        };
        db.tables['05_Identity_Docs'] = identity;
    }

    // 4. Update emergency
    const emergency = db.tables['06_Emergency_Contacts'] || [];
    const emIdx = emergency.findIndex(em => em.employee_id === id || em.employee_id === targetId);
    const emergName = masterData['Họ và tên (LHKC)'] || body.emergency_name || body.emergency_contact_name;
    if (emIdx >= 0) {
        emergency[emIdx] = {
            ...emergency[emIdx],
            employee_id: targetId,
            full_name: fullName,
            contact_name: emergName !== undefined ? emergName : emergency[emIdx].contact_name,
            relationship: masterData['Quan hệ (LHKC)'] !== undefined ? masterData['Quan hệ (LHKC)'] : (body.emergency_relation || emergency[emIdx].relationship),
            mobile_phone: masterData['ĐT di động (LHKC)'] !== undefined ? masterData['ĐT di động (LHKC)'] : (body.emergency_phone || emergency[emIdx].mobile_phone),
            home_phone: masterData['ĐT nhà riêng (LHKC)'] !== undefined ? masterData['ĐT nhà riêng (LHKC)'] : emergency[emIdx].home_phone,
            email: masterData['Email (LHKC)'] !== undefined ? masterData['Email (LHKC)'] : emergency[emIdx].email,
            address: masterData['Địa chỉ (LHKC)'] !== undefined ? masterData['Địa chỉ (LHKC)'] : emergency[emIdx].address
        };
        db.tables['06_Emergency_Contacts'] = emergency;
    } else if (emergName) {
        emergency.push({
            employee_id: targetId,
            full_name: fullName,
            contact_name: emergName,
            relationship: masterData['Quan hệ (LHKC)'] || body.emergency_relation || 'Vợ',
            mobile_phone: masterData['ĐT di động (LHKC)'] || body.emergency_phone || '',
            home_phone: masterData['ĐT nhà riêng (LHKC)'] || '',
            email: masterData['Email (LHKC)'] || '',
            address: masterData['Địa chỉ (LHKC)'] || masterData['Hộ khẩu thường trú'] || ''
        });
        db.tables['06_Emergency_Contacts'] = emergency;
    }

    // 5. Update education
    const education = db.tables['07_Education'] || [];
    const eduIdx = education.findIndex(ed => ed.employee_id === id || ed.employee_id === targetId);
    if (eduIdx >= 0) {
        education[eduIdx] = {
            ...education[eduIdx],
            employee_id: targetId,
            full_name: fullName,
            cultural_level: masterData['Trình độ văn hóa'] !== undefined ? masterData['Trình độ văn hóa'] : education[eduIdx].cultural_level,
            education_level: masterData['Trình độ đào tạo'] !== undefined ? masterData['Trình độ đào tạo'] : (body.education_level !== undefined ? body.education_level : education[eduIdx].education_level),
            institution: masterData['Nơi đào tạo'] !== undefined ? masterData['Nơi đào tạo'] : education[eduIdx].institution,
            faculty: masterData['Khoa'] !== undefined ? masterData['Khoa'] : education[eduIdx].faculty,
            major: masterData['Chuyên ngành'] !== undefined ? masterData['Chuyên ngành'] : (body.major !== undefined ? body.major : education[eduIdx].major),
            graduation_year: masterData['Năm tốt nghiệp'] !== undefined ? masterData['Năm tốt nghiệp'] : education[eduIdx].graduation_year,
            classification: masterData['Xếp loại'] !== undefined ? masterData['Xếp loại'] : education[eduIdx].classification,
            other_certificates: masterData['Bằng cấp chuyên môn khác'] !== undefined ? masterData['Bằng cấp chuyên môn khác'] : (body.other_certificates !== undefined ? body.other_certificates : education[eduIdx].other_certificates)
        };
        db.tables['07_Education'] = education;
    }

    // 6. Update salary
    const salaries = db.tables['08_Salaries_Banks'] || [];
    const sIdx = salaries.findIndex(s => s.employee_id === id || s.employee_id === targetId);
    if (sIdx >= 0) {
        const base = masterData['Lương cơ bản'] !== undefined ? parseFloat(masterData['Lương cơ bản']) : (body.base_salary !== undefined ? parseFloat(body.base_salary) : salaries[sIdx].base_salary);
        const total = masterData['Tổng lương'] !== undefined ? parseFloat(masterData['Tổng lương']) : (body.total_salary !== undefined ? parseFloat(body.total_salary) : salaries[sIdx].total_salary);
        salaries[sIdx] = {
            ...salaries[sIdx],
            employee_id: targetId,
            full_name: fullName,
            base_salary: base,
            total_salary: total,
            insurance_salary: masterData['Lương đóng BH'] !== undefined ? parseFloat(masterData['Lương đóng BH']) : salaries[sIdx].insurance_salary,
            salary_grade: masterData['Bậc lương'] !== undefined ? masterData['Bậc lương'] : salaries[sIdx].salary_grade,
            salary_coefficient: masterData['Hệ số lương'] !== undefined ? parseFloat(masterData['Hệ số lương']) : salaries[sIdx].salary_coefficient,
            bank_account_number: masterData['TK ngân hàng'] !== undefined ? masterData['TK ngân hàng'] : (body.bank_account_number !== undefined ? body.bank_account_number : salaries[sIdx].bank_account_number),
            bank_name: masterData['Ngân hàng'] !== undefined ? masterData['Ngân hàng'] : (body.bank_name !== undefined ? body.bank_name : salaries[sIdx].bank_name),
            bank_branch: masterData['Chi nhánh'] !== undefined ? masterData['Chi nhánh'] : (body.bank_branch !== undefined ? body.bank_branch : salaries[sIdx].bank_branch)
        };
        db.tables['08_Salaries_Banks'] = salaries;
    }

    // 7. Update insurance
    const insurance = db.tables['09_Insurance_Welfare'] || [];
    const insIdx = insurance.findIndex(i => i.employee_id === id || i.employee_id === targetId);
    if (insIdx >= 0) {
        insurance[insIdx] = {
            ...insurance[insIdx],
            employee_id: targetId,
            full_name: fullName,
            has_insurance: masterData['Tham gia bảo hiểm'] !== undefined ? masterData['Tham gia bảo hiểm'] : insurance[insIdx].has_insurance,
            social_insurance_book_no: masterData['Số sổ BHXH'] !== undefined ? masterData['Số sổ BHXH'] : (body.social_insurance_book_no !== undefined ? body.social_insurance_book_no : insurance[insIdx].social_insurance_book_no),
            social_insurance_code: masterData['Mã số BHXH'] !== undefined ? masterData['Mã số BHXH'] : (body.social_insurance_code !== undefined ? body.social_insurance_code : insurance[insIdx].social_insurance_code),
            hospital_registered: masterData['Nơi đăng ký KCB'] !== undefined ? masterData['Nơi đăng ký KCB'] : (body.hospital_registered !== undefined ? body.hospital_registered : insurance[insIdx].hospital_registered),
            union_member: masterData['Tham gia công đoàn'] !== undefined ? masterData['Tham gia công đoàn'] : insurance[insIdx].union_member
        };
        db.tables['09_Insurance_Welfare'] = insurance;
    }

    // 8. Update contracts
    const contracts = db.tables['10_Contracts'] || [];
    const ctIdx = contracts.findIndex(ct => ct.employee_id === id || ct.employee_id === targetId);
    if (ctIdx >= 0) {
        contracts[ctIdx] = {
            ...contracts[ctIdx],
            employee_id: targetId,
            contract_id: targetId,
            full_name: fullName,
            contract_type: masterData['Loại hợp đồng'] !== undefined ? masterData['Loại hợp đồng'] : (body.contract_type !== undefined ? body.contract_type : contracts[ctIdx].contract_type),
            start_date: masterData['Ngày bắt đầu làm việc'] || masterData['Ngày thử việc'] || body.start_date || contracts[ctIdx].start_date,
            end_date: masterData['Ngày hết hiệu lực'] || masterData['Ngày nghỉ việc'] || body.end_date || contracts[ctIdx].end_date,
            trial_start_date: masterData['Ngày thử việc'] !== undefined ? masterData['Ngày thử việc'] : contracts[ctIdx].trial_start_date,
            official_date: masterData['Ngày chính thức'] !== undefined ? masterData['Ngày chính thức'] : contracts[ctIdx].official_date
        };
        db.tables['10_Contracts'] = contracts;
    }

    // 9. Update Master Profiles Sheet (All 115 columns preserved)
    if (!db.tables['00_Master_Profiles']) {
        db.tables['00_Master_Profiles'] = [];
    }
    const mIdx = db.tables['00_Master_Profiles'].findIndex(m => m['Mã nhân viên'] === id || m['Mã nhân viên'] === targetId);
    if (mIdx >= 0) {
        db.tables['00_Master_Profiles'][mIdx] = {
            ...db.tables['00_Master_Profiles'][mIdx],
            ...masterData,
            'Mã nhân viên': targetId
        };
    } else {
        db.tables['00_Master_Profiles'].unshift({
            ...masterData,
            'Mã nhân viên': targetId
        });
    }

    recordLog(db, {
        action_type: 'UPDATE',
        module: 'Nhân sự',
        description: `Cập nhật hồ sơ nhân sự ${targetId !== id ? `${id} -> ${targetId}` : id} - ${fullName}`,
        user_id: body.operator_id || 'TH-1948',
        user_name: body.operator_name || 'Huỳnh Thanh Long',
        user_role: body.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.json({
        success: true,
        message: 'Cập nhật hồ sơ nhân viên thành công',
        employee_id: targetId
    });
};
app.put('/api/employees/:id', updateEmployeeHandler);
app.post('/api/employees/:id', updateEmployeeHandler);

// 6.5. DELETE ALL EMPLOYEES (BULK DELETE OR PURGE)
app.delete('/api/employees/all', (req, res) => {
    const db = loadDatabase();

    const employees = db.tables['03_Employees'] || [];
    const count = employees.length;

    if (count === 0) {
        return res.status(400).json({ success: false, message: 'Danh sách nhân sự hiện đang trống, không có dữ liệu để xóa' });
    }

    const isPermanent = req.body?.permanent === true;
    const keepAccounts = req.body?.keep_accounts !== false; // Default: true - keep employees with accounts
    const operatorId = req.body?.operator_id || 'TH-1948';
    const operatorName = req.body?.operator_name || 'Huỳnh Thanh Long';
    const operatorRole = req.body?.operator_role || 'ADMIN';

    // Identify employees with system accounts and permissions
    const accounts = db.tables['11_System_Accounts'] || [];
    const accountEmpIds = new Set(accounts.map(a => a.employee_id).filter(Boolean));
    if (operatorId) accountEmpIds.add(operatorId);
    accountEmpIds.add('TH-0001');

    const employeesToDelete = [];
    const employeesToKeep = [];

    for (const emp of employees) {
        if (keepAccounts && accountEmpIds.has(emp.employee_id)) {
            employeesToKeep.push(emp);
        } else {
            employeesToDelete.push(emp);
        }
    }

    if (employeesToDelete.length === 0) {
        return res.status(400).json({
            success: false,
            message: `Tất cả ${count} nhân sự hiện có đều có tài khoản phân quyền nên được giữ lại an toàn, không có nhân sự nào cần xóa.`
        });
    }

    const toDeleteIds = new Set(employeesToDelete.map(e => e.employee_id));

    if (!isPermanent) {
        if (!db.tables['13_Recycle_Bin']) {
            db.tables['13_Recycle_Bin'] = [];
        }

        // Fast lookup maps for instant processing
        const contactsMap = new Map((db.tables['04_Contacts_Addresses'] || []).map(c => [c.employee_id, c]));
        const identityMap = new Map((db.tables['05_Identity_Docs'] || []).map(i => [i.employee_id, i]));
        const emergencyMap = new Map((db.tables['06_Emergency_Contacts'] || []).map(e => [e.employee_id, e]));
        const educationMap = new Map((db.tables['07_Education'] || []).map(ed => [ed.employee_id, ed]));
        const salariesMap = new Map((db.tables['08_Salaries_Banks'] || []).map(s => [s.employee_id, s]));
        const insuranceMap = new Map((db.tables['09_Insurance_Welfare'] || []).map(i => [i.employee_id, i]));
        const contractsMap = new Map((db.tables['10_Contracts'] || []).map(c => [c.employee_id, c]));
        const accountsMap = new Map((db.tables['11_System_Accounts'] || []).map(a => [a.employee_id, a]));
        const masterMap = new Map((db.tables['00_Master_Profiles'] || []).map(m => [m['Mã nhân viên'], m]));

        const now = new Date().toISOString();
        const newTrashEntries = [];

        for (const emp of employeesToDelete) {
            const id = emp.employee_id;
            const contact = contactsMap.get(id) || null;
            const idDoc = identityMap.get(id) || null;
            const emerg = emergencyMap.get(id) || null;
            const edu = educationMap.get(id) || null;
            const sal = salariesMap.get(id) || null;
            const ins = insuranceMap.get(id) || null;
            const ct = contractsMap.get(id) || null;
            const acc = accountsMap.get(id) || null;
            const master = masterMap.get(id) || null;

            newTrashEntries.push({
                trash_id: `TRASH-${id}-${Date.now()}`,
                employee_id: id,
                full_name: emp.full_name || '',
                gender: emp.gender || '',
                department_id: emp.department_id || '',
                position_id: emp.position_id || '',
                job_title: emp.job_title || '',
                work_email: (contact && contact.work_email) || '',
                mobile_phone: (contact && contact.mobile_phone) || '',
                deleted_at: now,
                deleted_by_name: operatorName,
                deleted_by_id: operatorId,
                backup_data: JSON.stringify({
                    employee: emp,
                    contact,
                    identity: idDoc,
                    emergency: emerg,
                    education: edu,
                    salary: sal,
                    insurance: ins,
                    contract: ct,
                    account: acc,
                    master
                })
            });
        }

        db.tables['13_Recycle_Bin'] = [...newTrashEntries, ...(db.tables['13_Recycle_Bin'] || [])];
    }

    // Clean only records belonging to employeesToDelete
    db.tables['03_Employees'] = (db.tables['03_Employees'] || []).filter(e => !toDeleteIds.has(e.employee_id));
    db.tables['04_Contacts_Addresses'] = (db.tables['04_Contacts_Addresses'] || []).filter(c => !toDeleteIds.has(c.employee_id));
    db.tables['05_Identity_Docs'] = (db.tables['05_Identity_Docs'] || []).filter(i => !toDeleteIds.has(i.employee_id));
    db.tables['06_Emergency_Contacts'] = (db.tables['06_Emergency_Contacts'] || []).filter(e => !toDeleteIds.has(e.employee_id));
    db.tables['07_Education'] = (db.tables['07_Education'] || []).filter(ed => !toDeleteIds.has(ed.employee_id));
    db.tables['08_Salaries_Banks'] = (db.tables['08_Salaries_Banks'] || []).filter(s => !toDeleteIds.has(s.employee_id));
    db.tables['09_Insurance_Welfare'] = (db.tables['09_Insurance_Welfare'] || []).filter(ins => !toDeleteIds.has(ins.employee_id));
    db.tables['10_Contracts'] = (db.tables['10_Contracts'] || []).filter(ct => !toDeleteIds.has(ct.employee_id));
    db.tables['00_Master_Profiles'] = (db.tables['00_Master_Profiles'] || []).filter(m => !toDeleteIds.has(m['Mã nhân viên']));

    // Keep system accounts of preserved employees
    if (Array.isArray(db.tables['11_System_Accounts'])) {
        db.tables['11_System_Accounts'] = db.tables['11_System_Accounts'].filter(a => !toDeleteIds.has(a.employee_id));
    }
    ensureDefaultAccounts(db);

    const desc = isPermanent
        ? `Đã xóa vĩnh viễn ${employeesToDelete.length} nhân sự${keepAccounts ? ` (Đã giữ lại ${employeesToKeep.length} nhân sự có tài khoản phân quyền)` : ''}`
        : `Đã chuyển ${employeesToDelete.length} nhân sự vào Thùng rác${keepAccounts ? ` (Đã giữ lại ${employeesToKeep.length} nhân sự có tài khoản phân quyền)` : ''}`;

    recordLog(db, {
        action_type: 'DELETE',
        module: 'Nhân sự',
        description: desc,
        user_id: operatorId,
        user_name: operatorName,
        user_role: operatorRole,
        ip: req.ip
    });

    saveDatabase(db);

    res.json({
        success: true,
        count: employeesToDelete.length,
        kept_count: employeesToKeep.length,
        permanent: isPermanent,
        message: desc
    });
});

// 6.6. BULK SOFT DELETE EMPLOYEES
app.post('/api/employees/bulk-delete', (req, res) => {
    const db = loadDatabase();
    const ids = Array.isArray(req.body?.employee_ids) ? req.body.employee_ids : [];

    if (ids.length === 0) {
        return res.status(400).json({ success: false, message: 'Vui lòng chọn ít nhất 1 nhân sự để xóa' });
    }

    if (!db.tables['13_Recycle_Bin']) {
        db.tables['13_Recycle_Bin'] = [];
    }

    const idSet = new Set(ids);
    const employees = db.tables['03_Employees'] || [];
    const toDelete = employees.filter(e => idSet.has(e.employee_id));

    if (toDelete.length === 0) {
        return res.status(400).json({ success: false, message: 'Không tìm thấy nhân sự phù hợp trong danh sách xóa' });
    }

    const contacts = db.tables['04_Contacts_Addresses'] || [];
    const identity = db.tables['05_Identity_Docs'] || [];
    const emergency = db.tables['06_Emergency_Contacts'] || [];
    const education = db.tables['07_Education'] || [];
    const salaries = db.tables['08_Salaries_Banks'] || [];
    const insurance = db.tables['09_Insurance_Welfare'] || [];
    const contracts = db.tables['10_Contracts'] || [];
    const accounts = db.tables['11_System_Accounts'] || [];
    const masterList = db.tables['00_Master_Profiles'] || [];

    const now = new Date().toISOString();
    const operatorName = req.body?.operator_name || 'Huỳnh Thanh Long';
    const operatorId = req.body?.operator_id || 'TH-1948';

    toDelete.forEach(emp => {
        const id = emp.employee_id;
        const contact = contacts.find(c => c.employee_id === id) || null;
        const idDoc = identity.find(i => i.employee_id === id) || null;
        const emerg = emergency.find(em => em.employee_id === id) || null;
        const edu = education.find(ed => ed.employee_id === id) || null;
        const sal = salaries.find(s => s.employee_id === id) || null;
        const ins = insurance.find(i => i.employee_id === id) || null;
        const ct = contracts.find(c => c.employee_id === id) || null;
        const acc = accounts.find(a => a.employee_id === id) || null;
        const master = masterList.find(m => m['Mã nhân viên'] === id) || null;

        const trashEntry = {
            trash_id: `TRASH-${id}-${Date.now()}-${Math.floor(Math.random()*1000)}`,
            employee_id: id,
            full_name: emp.full_name || id,
            gender: emp.gender || '',
            department_id: emp.department_id || '',
            position_id: emp.position_id || '',
            job_title: emp.job_title || '',
            work_email: (contact && contact.work_email) || '',
            mobile_phone: (contact && contact.mobile_phone) || '',
            deleted_at: now,
            deleted_by_name: operatorName,
            deleted_by_id: operatorId,
            backup_data: JSON.stringify({
                employee: emp,
                contact,
                identity: idDoc,
                emergency: emerg,
                education: edu,
                salary: sal,
                insurance: ins,
                contract: ct,
                account: acc,
                master
            })
        };

        db.tables['13_Recycle_Bin'].unshift(trashEntry);
    });

    // Remove from active tables
    const tableKeysToClean = [
        '03_Employees',
        '04_Contacts_Addresses',
        '05_Identity_Docs',
        '06_Emergency_Contacts',
        '07_Education',
        '08_Salaries_Banks',
        '09_Insurance_Welfare',
        '10_Contracts',
        '11_System_Accounts'
    ];

    tableKeysToClean.forEach(key => {
        if (db.tables[key]) {
            db.tables[key] = db.tables[key].filter(row => !idSet.has(row.employee_id));
        }
    });

    if (db.tables['00_Master_Profiles']) {
        db.tables['00_Master_Profiles'] = db.tables['00_Master_Profiles'].filter(row => !idSet.has(row['Mã nhân viên']));
    }

    saveDatabase(db);

    res.json({
        success: true,
        count: toDelete.length,
        message: `Đã chuyển ${toDelete.length} nhân sự đã chọn vào Thùng rác!`
    });
});

// 7. SOFT DELETE EMPLOYEE (MOVE TO RECYCLE BIN)
app.delete('/api/employees/:id', (req, res) => {
    const db = loadDatabase();
    const id = req.params.id;

    if (!db.tables['13_Recycle_Bin']) {
        db.tables['13_Recycle_Bin'] = [];
    }

    const employees = db.tables['03_Employees'] || [];
    const emp = employees.find(e => e.employee_id === id);
    if (!emp) {
        return res.status(404).json({ success: false, message: 'Nhân viên không tồn tại trong hệ thống' });
    }

    const empName = emp.full_name || '';
    const contacts = db.tables['04_Contacts_Addresses'] || [];
    const identity = db.tables['05_Identity_Docs'] || [];
    const emergency = db.tables['06_Emergency_Contacts'] || [];
    const education = db.tables['07_Education'] || [];
    const salaries = db.tables['08_Salaries_Banks'] || [];
    const insurance = db.tables['09_Insurance_Welfare'] || [];
    const contracts = db.tables['10_Contracts'] || [];
    const accounts = db.tables['11_System_Accounts'] || [];
    const master = (db.tables['00_Master_Profiles'] || []).find(m => m['Mã nhân viên'] === id) || null;

    const contact = contacts.find(c => c.employee_id === id) || null;
    const idDoc = identity.find(i => i.employee_id === id) || null;
    const emerg = emergency.find(em => em.employee_id === id) || null;
    const edu = education.find(ed => ed.employee_id === id) || null;
    const sal = salaries.find(s => s.employee_id === id) || null;
    const ins = insurance.find(i => i.employee_id === id) || null;
    const ct = contracts.find(c => c.employee_id === id) || null;
    const acc = accounts.find(a => a.employee_id === id) || null;

    // Create Recycle Bin entry
    const trashEntry = {
        trash_id: `TRASH-${id}-${Date.now()}`,
        employee_id: id,
        full_name: empName,
        gender: emp.gender || '',
        department_id: emp.department_id || '',
        position_id: emp.position_id || '',
        job_title: emp.job_title || '',
        work_email: (contact && contact.work_email) || '',
        mobile_phone: (contact && contact.mobile_phone) || '',
        deleted_at: new Date().toISOString(),
        deleted_by_name: req.body?.operator_name || 'Huỳnh Thanh Long',
        deleted_by_id: req.body?.operator_id || 'TH-1948',
        backup_data: JSON.stringify({
            employee: emp,
            contact,
            identity: idDoc,
            emergency: emerg,
            education: edu,
            salary: sal,
            insurance: ins,
            contract: ct,
            account: acc,
            master
        })
    };

    // Add to 13_Recycle_Bin
    db.tables['13_Recycle_Bin'].unshift(trashEntry);

    // Remove from active tables
    const tableKeysToClean = [
        '03_Employees',
        '04_Contacts_Addresses',
        '05_Identity_Docs',
        '06_Emergency_Contacts',
        '07_Education',
        '08_Salaries_Banks',
        '09_Insurance_Welfare',
        '10_Contracts',
        '11_System_Accounts'
    ];

    for (const key of tableKeysToClean) {
        if (Array.isArray(db.tables[key])) {
            db.tables[key] = db.tables[key].filter(item => item.employee_id !== id);
        }
    }

    if (Array.isArray(db.tables['00_Master_Profiles'])) {
        db.tables['00_Master_Profiles'] = db.tables['00_Master_Profiles'].filter(item => item['Mã nhân viên'] !== id);
    }

    recordLog(db, {
        action_type: 'DELETE',
        module: 'Nhân sự',
        description: `Đã chuyển hồ sơ nhân sự ${id} (${empName}) vào Thùng rác`,
        user_id: req.body?.operator_id || 'TH-1948',
        user_name: req.body?.operator_name || 'Huỳnh Thanh Long',
        user_role: req.body?.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);
    res.json({
        success: true,
        message: `Đã chuyển nhân viên ${empName} (${id}) vào Thùng rác`,
        trash_id: trashEntry.trash_id
    });
});

// ==========================================
// RECYCLE BIN (THÙNG RÁC) ENDPOINTS
// ==========================================

// GET ALL ITEMS IN RECYCLE BIN
app.get('/api/trash', (req, res) => {
    const db = loadDatabase();
    const trash = db.tables['13_Recycle_Bin'] || [];
    const depts = db.tables['01_Departments'] || [];
    const pos = db.tables['02_Positions'] || [];

    const deptMap = {};
    depts.forEach(d => deptMap[d.department_id] = d.department_name);
    const posMap = {};
    pos.forEach(p => posMap[p.position_id] = p.position_name);

    const enriched = trash.map(item => ({
        ...item,
        department_name: deptMap[item.department_id] || item.department_id,
        position_name: posMap[item.position_id] || item.position_id
    }));

    res.json({
        success: true,
        total: enriched.length,
        data: enriched
    });
});

// RESTORE EMPLOYEE FROM RECYCLE BIN
app.post('/api/trash/restore/:id', (req, res) => {
    const db = loadDatabase();
    const id = req.params.id;
    const trash = db.tables['13_Recycle_Bin'] || [];
    const trashIdx = trash.findIndex(t => t.employee_id === id);

    if (trashIdx === -1) {
        return res.status(404).json({ success: false, message: 'Nhân sự không tìm thấy trong Thùng rác' });
    }

    const trashItem = trash[trashIdx];
    let backup = {};
    try {
        backup = JSON.parse(trashItem.backup_data || '{}');
    } catch (e) {
        console.error('Error parsing backup_data:', e);
    }

    // Restore into respective tables
    if (backup.employee) {
        if (!db.tables['03_Employees']) db.tables['03_Employees'] = [];
        // Prevent duplicate
        db.tables['03_Employees'] = db.tables['03_Employees'].filter(e => e.employee_id !== id);
        db.tables['03_Employees'].unshift(backup.employee);
    }
    if (backup.contact) {
        if (!db.tables['04_Contacts_Addresses']) db.tables['04_Contacts_Addresses'] = [];
        db.tables['04_Contacts_Addresses'] = db.tables['04_Contacts_Addresses'].filter(c => c.employee_id !== id);
        db.tables['04_Contacts_Addresses'].unshift(backup.contact);
    }
    if (backup.identity) {
        if (!db.tables['05_Identity_Docs']) db.tables['05_Identity_Docs'] = [];
        db.tables['05_Identity_Docs'] = db.tables['05_Identity_Docs'].filter(i => i.employee_id !== id);
        db.tables['05_Identity_Docs'].unshift(backup.identity);
    }
    if (backup.emergency) {
        if (!db.tables['06_Emergency_Contacts']) db.tables['06_Emergency_Contacts'] = [];
        db.tables['06_Emergency_Contacts'] = db.tables['06_Emergency_Contacts'].filter(em => em.employee_id !== id);
        db.tables['06_Emergency_Contacts'].unshift(backup.emergency);
    }
    if (backup.education) {
        if (!db.tables['07_Education']) db.tables['07_Education'] = [];
        db.tables['07_Education'] = db.tables['07_Education'].filter(ed => ed.employee_id !== id);
        db.tables['07_Education'].unshift(backup.education);
    }
    if (backup.salary) {
        if (!db.tables['08_Salaries_Banks']) db.tables['08_Salaries_Banks'] = [];
        db.tables['08_Salaries_Banks'] = db.tables['08_Salaries_Banks'].filter(s => s.employee_id !== id);
        db.tables['08_Salaries_Banks'].unshift(backup.salary);
    }
    if (backup.insurance) {
        if (!db.tables['09_Insurance_Welfare']) db.tables['09_Insurance_Welfare'] = [];
        db.tables['09_Insurance_Welfare'] = db.tables['09_Insurance_Welfare'].filter(i => i.employee_id !== id);
        db.tables['09_Insurance_Welfare'].unshift(backup.insurance);
    }
    if (backup.contract) {
        if (!db.tables['10_Contracts']) db.tables['10_Contracts'] = [];
        db.tables['10_Contracts'] = db.tables['10_Contracts'].filter(c => c.employee_id !== id);
        db.tables['10_Contracts'].unshift(backup.contract);
    }
    if (backup.account) {
        if (!db.tables['11_System_Accounts']) db.tables['11_System_Accounts'] = [];
        db.tables['11_System_Accounts'] = db.tables['11_System_Accounts'].filter(a => a.employee_id !== id);
        db.tables['11_System_Accounts'].unshift(backup.account);
    }
    if (backup.master) {
        if (!db.tables['00_Master_Profiles']) db.tables['00_Master_Profiles'] = [];
        db.tables['00_Master_Profiles'] = db.tables['00_Master_Profiles'].filter(m => m['Mã nhân viên'] !== id);
        db.tables['00_Master_Profiles'].unshift(backup.master);
    }

    // Remove from 13_Recycle_Bin
    trash.splice(trashIdx, 1);
    db.tables['13_Recycle_Bin'] = trash;

    recordLog(db, {
        action_type: 'RESTORE',
        module: 'Nhân sự',
        description: `Đã khôi phục hồ sơ nhân sự ${id} (${trashItem.full_name}) về danh sách hoạt động`,
        user_id: req.body?.operator_id || 'TH-1948',
        user_name: req.body?.operator_name || 'Huỳnh Thanh Long',
        user_role: req.body?.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);
    res.json({
        success: true,
        message: `Đã khôi phục thành công nhân viên ${trashItem.full_name} (${id})`
    });
});

// BULK RESTORE
app.post('/api/trash/restore-bulk', (req, res) => {
    const db = loadDatabase();
    const { employee_ids } = req.body;
    if (!Array.isArray(employee_ids) || employee_ids.length === 0) {
        return res.status(400).json({ success: false, message: 'Danh sách mã nhân sự không hợp lệ' });
    }

    const trash = db.tables['13_Recycle_Bin'] || [];
    let restoredCount = 0;

    employee_ids.forEach(id => {
        const trashIdx = trash.findIndex(t => t.employee_id === id);
        if (trashIdx !== -1) {
            const trashItem = trash[trashIdx];
            let backup = {};
            try {
                backup = JSON.parse(trashItem.backup_data || '{}');
            } catch (e) {}

            if (backup.employee) {
                if (!db.tables['03_Employees']) db.tables['03_Employees'] = [];
                db.tables['03_Employees'] = db.tables['03_Employees'].filter(e => e.employee_id !== id);
                db.tables['03_Employees'].unshift(backup.employee);
            }
            if (backup.contact) {
                if (!db.tables['04_Contacts_Addresses']) db.tables['04_Contacts_Addresses'] = [];
                db.tables['04_Contacts_Addresses'] = db.tables['04_Contacts_Addresses'].filter(c => c.employee_id !== id);
                db.tables['04_Contacts_Addresses'].unshift(backup.contact);
            }
            if (backup.identity) {
                if (!db.tables['05_Identity_Docs']) db.tables['05_Identity_Docs'] = [];
                db.tables['05_Identity_Docs'] = db.tables['05_Identity_Docs'].filter(i => i.employee_id !== id);
                db.tables['05_Identity_Docs'].unshift(backup.identity);
            }
            if (backup.emergency) {
                if (!db.tables['06_Emergency_Contacts']) db.tables['06_Emergency_Contacts'] = [];
                db.tables['06_Emergency_Contacts'] = db.tables['06_Emergency_Contacts'].filter(em => em.employee_id !== id);
                db.tables['06_Emergency_Contacts'].unshift(backup.emergency);
            }
            if (backup.education) {
                if (!db.tables['07_Education']) db.tables['07_Education'] = [];
                db.tables['07_Education'] = db.tables['07_Education'].filter(ed => ed.employee_id !== id);
                db.tables['07_Education'].unshift(backup.education);
            }
            if (backup.salary) {
                if (!db.tables['08_Salaries_Banks']) db.tables['08_Salaries_Banks'] = [];
                db.tables['08_Salaries_Banks'] = db.tables['08_Salaries_Banks'].filter(s => s.employee_id !== id);
                db.tables['08_Salaries_Banks'].unshift(backup.salary);
            }
            if (backup.insurance) {
                if (!db.tables['09_Insurance_Welfare']) db.tables['09_Insurance_Welfare'] = [];
                db.tables['09_Insurance_Welfare'] = db.tables['09_Insurance_Welfare'].filter(i => i.employee_id !== id);
                db.tables['09_Insurance_Welfare'].unshift(backup.insurance);
            }
            if (backup.contract) {
                if (!db.tables['10_Contracts']) db.tables['10_Contracts'] = [];
                db.tables['10_Contracts'] = db.tables['10_Contracts'].filter(c => c.employee_id !== id);
                db.tables['10_Contracts'].unshift(backup.contract);
            }
            if (backup.account) {
                if (!db.tables['11_System_Accounts']) db.tables['11_System_Accounts'] = [];
                db.tables['11_System_Accounts'] = db.tables['11_System_Accounts'].filter(a => a.employee_id !== id);
                db.tables['11_System_Accounts'].unshift(backup.account);
            }
            if (backup.master) {
                if (!db.tables['00_Master_Profiles']) db.tables['00_Master_Profiles'] = [];
                db.tables['00_Master_Profiles'] = db.tables['00_Master_Profiles'].filter(m => m['Mã nhân viên'] !== id);
                db.tables['00_Master_Profiles'].unshift(backup.master);
            }

            trash.splice(trashIdx, 1);
            restoredCount++;
        }
    });

    db.tables['13_Recycle_Bin'] = trash;

    recordLog(db, {
        action_type: 'RESTORE',
        module: 'Nhân sự',
        description: `Khôi phục hàng loạt ${restoredCount} nhân sự từ Thùng rác`,
        user_id: req.body?.operator_id || 'TH-1948',
        user_name: req.body?.operator_name || 'Huỳnh Thanh Long',
        user_role: req.body?.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);
    res.json({
        success: true,
        message: `Đã khôi phục thành công ${restoredCount} nhân sự`,
        restoredCount
    });
});

// PERMANENT DELETE FROM RECYCLE BIN
app.delete('/api/trash/permanent/:id', (req, res) => {
    const db = loadDatabase();
    const id = req.params.id;
    const trash = db.tables['13_Recycle_Bin'] || [];
    const trashIdx = trash.findIndex(t => t.employee_id === id);

    if (trashIdx === -1) {
        return res.status(404).json({ success: false, message: 'Nhân sự không tìm thấy trong Thùng rác' });
    }

    const trashItem = trash[trashIdx];
    trash.splice(trashIdx, 1);
    db.tables['13_Recycle_Bin'] = trash;

    recordLog(db, {
        action_type: 'PURGE',
        module: 'Nhân sự',
        description: `Xóa vĩnh viễn hồ sơ nhân sự ${id} (${trashItem.full_name}) khỏi Thùng rác`,
        user_id: req.body?.operator_id || 'TH-1948',
        user_name: req.body?.operator_name || 'Huỳnh Thanh Long',
        user_role: req.body?.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);
    res.json({
        success: true,
        message: `Đã xóa vĩnh viễn nhân viên ${trashItem.full_name} (${id}) khỏi hệ thống`
    });
});

// BULK PERMANENT DELETE
app.delete('/api/trash/permanent-bulk', (req, res) => {
    const db = loadDatabase();
    const { employee_ids } = req.body;
    if (!Array.isArray(employee_ids) || employee_ids.length === 0) {
        return res.status(400).json({ success: false, message: 'Danh sách mã nhân sự không hợp lệ' });
    }

    const trash = db.tables['13_Recycle_Bin'] || [];
    const initialLen = trash.length;
    db.tables['13_Recycle_Bin'] = trash.filter(t => !employee_ids.includes(t.employee_id));
    const deletedCount = initialLen - db.tables['13_Recycle_Bin'].length;

    recordLog(db, {
        action_type: 'PURGE',
        module: 'Nhân sự',
        description: `Xóa vĩnh viễn hàng loạt ${deletedCount} nhân sự khỏi Thùng rác`,
        user_id: req.body?.operator_id || 'TH-1948',
        user_name: req.body?.operator_name || 'Huỳnh Thanh Long',
        user_role: req.body?.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);
    res.json({
        success: true,
        message: `Đã xóa vĩnh viễn ${deletedCount} nhân sự khỏi hệ thống`,
        deletedCount
    });
});

// EMPTY RECYCLE BIN
app.delete('/api/trash/empty', (req, res) => {
    const db = loadDatabase();
    const trash = db.tables['13_Recycle_Bin'] || [];
    const count = trash.length;

    db.tables['13_Recycle_Bin'] = [];

    recordLog(db, {
        action_type: 'PURGE',
        module: 'Nhân sự',
        description: `Đã dọn sạch toàn bộ Thùng rác (${count} nhân sự)`,
        user_id: req.body?.operator_id || 'TH-1948',
        user_name: req.body?.operator_name || 'Huỳnh Thanh Long',
        user_role: req.body?.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);
    res.json({
        success: true,
        message: `Đã dọn sạch toàn bộ Thùng rác (${count} nhân sự)`
    });
});

// ==========================================
// CONTRACTS MANAGEMENT ENDPOINTS
// ==========================================

// GET ALL CONTRACTS (ENRICHED)
app.get('/api/contracts', (req, res) => {
    const db = loadDatabase();
    const contracts = db.tables['10_Contracts'] || [];
    const employees = db.tables['03_Employees'] || [];
    const depts = db.tables['01_Departments'] || [];
    const positions = db.tables['02_Positions'] || [];
    const deptMap = Object.fromEntries(depts.map(d => [d.department_id, d.department_name]));
    const posMap = Object.fromEntries(positions.map(p => [p.position_id, p.position_name]));
    const empMap = Object.fromEntries(employees.map(e => [e.employee_id, e]));

    const enriched = contracts.map(c => {
        const emp = empMap[c.employee_id] || {};
        return {
            ...c,
            full_name: c.full_name || emp.full_name || c.employee_id || "-",
            department_name: c.department_name || deptMap[c.department_id || emp.department_id] || emp.department_name || "-",
            job_title: c.job_title || posMap[emp.position_id] || emp.job_title || "-",
            email: emp.work_email || emp.personal_email || "-",
            phone: emp.mobile_phone || "-",
            appendices_count: Array.isArray(c.appendices) ? c.appendices.length : 0,
            attachments_count: Array.isArray(c.attachments) ? c.attachments.length : 0
        };
    });
    res.json({ success: true, contracts: enriched });
});

// GET SINGLE CONTRACT
app.get('/api/contracts/:id', (req, res) => {
    const db = loadDatabase();
    const id = req.params.id;
    const contracts = db.tables['10_Contracts'] || [];
    const employees = db.tables['03_Employees'] || [];
    const depts = db.tables['01_Departments'] || [];
    const positions = db.tables['02_Positions'] || [];
    const deptMap = Object.fromEntries(depts.map(d => [d.department_id, d.department_name]));
    const posMap = Object.fromEntries(positions.map(p => [p.position_id, p.position_name]));
    const empMap = Object.fromEntries(employees.map(e => [e.employee_id, e]));

    const item = contracts.find(c => c.contract_id === id || c.employee_id === id);
    if (!item) return res.status(404).json({ success: false, message: "Không tìm thấy hợp đồng" });
    const emp = empMap[item.employee_id] || {};
    res.json({
        success: true,
        contract: {
            ...item,
            department_name: item.department_name || deptMap[item.department_id || emp.department_id] || emp.department_name || "-",
            job_title: item.job_title || posMap[emp.position_id] || emp.job_title || "-",
            email: emp.work_email || emp.personal_email || "-",
            phone: emp.mobile_phone || "-"
        }
    });
});

// CREATE CONTRACT
app.post('/api/contracts', (req, res) => {
    const db = loadDatabase();
    if (!db.tables['10_Contracts']) db.tables['10_Contracts'] = [];
    const contracts = db.tables['10_Contracts'];
    const employees = db.tables['03_Employees'] || [];
    const depts = db.tables['01_Departments'] || [];
    const positions = db.tables['02_Positions'] || [];
    const deptMap = Object.fromEntries(depts.map(d => [d.department_id, d.department_name]));
    const posMap = Object.fromEntries(positions.map(p => [p.position_id, p.position_name]));
    const empMap = Object.fromEntries(employees.map(e => [e.employee_id, e]));

    const body = req.body || {};
    const newId = (body.contract_id || `HD-${body.employee_id || Date.now()}`).trim();
    const emp = empMap[body.employee_id] || {};
    const newContract = {
        contract_id: newId,
        employee_id: body.employee_id || newId,
        full_name: body.full_name || emp.full_name || body.employee_id,
        contract_type: body.contract_type || "Hợp đồng xác định thời hạn",
        sign_date: fixExcelSerialDate(body.sign_date || new Date().toISOString().split('T')[0]),
        start_date: fixExcelSerialDate(body.start_date || body.effective_date || new Date().toISOString().split('T')[0]),
        end_date: fixExcelSerialDate(body.end_date || body.expiry_date || "Không xác định"),
        effective_date: fixExcelSerialDate(body.effective_date || body.start_date || new Date().toISOString().split('T')[0]),
        expiry_date: fixExcelSerialDate(body.expiry_date || body.end_date || null),
        trial_start_date: fixExcelSerialDate(body.trial_start_date || ""),
        official_date: fixExcelSerialDate(body.official_date || ""),
        salary: parseFloat(body.salary) || emp.base_salary || 0,
        allowance: parseFloat(body.allowance) || 0,
        department_id: body.department_id || emp.department_id || "",
        department_name: body.department_name || emp.department_name || deptMap[body.department_id || emp.department_id] || "",
        job_title: body.job_title || emp.job_title || posMap[emp.position_id] || "",
        work_location: body.work_location || emp.work_location || "Trụ sở Tổng công ty",
        signer_name: body.signer_name || "Huỳnh Thanh Long",
        contract_status: body.contract_status || "HIỆU LỰC",
        notes: body.notes || "",
        appendices: Array.isArray(body.appendices) ? body.appendices : [],
        attachments: Array.isArray(body.attachments) ? body.attachments : [],
        created_at: new Date().toISOString()
    };

    const existingIdx = contracts.findIndex(c => c.contract_id === newId);
    if (existingIdx >= 0) {
        contracts[existingIdx] = { ...contracts[existingIdx], ...newContract, updated_at: new Date().toISOString() };
    } else {
        contracts.unshift(newContract);
    }
    saveDatabase(db);
    res.json({ success: true, contract: newContract, message: "Lưu hợp đồng thành công!" });
});

// UPDATE CONTRACT (or Auto-upsert)
const updateContractEndpoint = (req, res) => {
    const db = loadDatabase();
    const id = req.params.id;
    const body = req.body || {};
    if (!db.tables['10_Contracts']) db.tables['10_Contracts'] = [];
    const contracts = db.tables['10_Contracts'];
    let idx = contracts.findIndex(c => c.contract_id === id || c.employee_id === id);

    if (body.start_date) body.start_date = fixExcelSerialDate(body.start_date);
    if (body.end_date) body.end_date = fixExcelSerialDate(body.end_date);
    if (body.effective_date) body.effective_date = fixExcelSerialDate(body.effective_date);
    if (body.expiry_date) body.expiry_date = fixExcelSerialDate(body.expiry_date);
    if (body.trial_start_date) body.trial_start_date = fixExcelSerialDate(body.trial_start_date);
    if (body.official_date) body.official_date = fixExcelSerialDate(body.official_date);
    if (body.sign_date) body.sign_date = fixExcelSerialDate(body.sign_date);

    if (idx >= 0) {
        contracts[idx] = {
            ...contracts[idx],
            ...body,
            contract_id: body.contract_id || id,
            updated_at: new Date().toISOString()
        };
    } else {
        const emps = db.tables['03_Employees'] || [];
        const emp = emps.find(e => e.employee_id === (body.employee_id || id)) || {};
        const newContract = {
            contract_id: body.contract_id || id,
            employee_id: body.employee_id || id,
            full_name: body.full_name || emp.full_name || id,
            contract_type: body.contract_type || "Hợp đồng xác định thời hạn",
            start_date: fixExcelSerialDate(body.start_date || body.effective_date || new Date().toISOString().split('T')[0]),
            effective_date: fixExcelSerialDate(body.effective_date || body.start_date || new Date().toISOString().split('T')[0]),
            end_date: fixExcelSerialDate(body.end_date || body.expiry_date || "Không xác định"),
            expiry_date: fixExcelSerialDate(body.expiry_date || body.end_date || null),
            salary: parseFloat(body.salary) || emp.base_salary || 0,
            allowance: parseFloat(body.allowance) || 0,
            department_id: body.department_id || emp.department_id || "",
            department_name: body.department_name || emp.department_name || "",
            job_title: body.job_title || emp.job_title || "",
            work_location: body.work_location || "Trụ sở Tổng công ty",
            signer_name: body.signer_name || "Huỳnh Thanh Long",
            contract_status: body.contract_status || "HIỆU LỰC",
            notes: body.notes || "",
            appendices: Array.isArray(body.appendices) ? body.appendices : [],
            attachments: Array.isArray(body.attachments) ? body.attachments : [],
            ...body,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        contracts.unshift(newContract);
        idx = 0;
    }

    saveDatabase(db);
    res.json({ success: true, contract: contracts[idx], message: "Cập nhật hợp đồng thành công!" });
};
app.put('/api/contracts/:id', updateContractEndpoint);
app.post('/api/contracts/:id', updateContractEndpoint);

// DELETE CONTRACT
app.delete('/api/contracts/:id', (req, res) => {
    const db = loadDatabase();
    const id = req.params.id;
    if (db.tables['10_Contracts']) {
        db.tables['10_Contracts'] = db.tables['10_Contracts'].filter(c => c.contract_id !== id && c.employee_id !== id);
        saveDatabase(db);
    }
    res.json({ success: true, message: `Đã xóa hợp đồng ${id} thành công!` });
});

// ADD APPENDIX
app.post('/api/contracts/:id/appendices', (req, res) => {
    const db = loadDatabase();
    const id = req.params.id;
    const body = req.body || {};
    const contracts = db.tables['10_Contracts'] || [];
    const idx = contracts.findIndex(c => c.contract_id === id || c.employee_id === id);
    if (idx < 0) return res.status(404).json({ success: false, message: "Hợp đồng không tồn tại" });

    if (!Array.isArray(contracts[idx].appendices)) contracts[idx].appendices = [];
    const appxId = body.appendix_id || `PL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const appendixObj = {
        appendix_id: appxId,
        appendix_number: body.appendix_number || `PL-${contracts[idx].appendices.length + 1}/${contracts[idx].contract_id}`,
        sign_date: fixExcelSerialDate(body.sign_date || new Date().toISOString().split('T')[0]),
        effective_date: fixExcelSerialDate(body.effective_date || new Date().toISOString().split('T')[0]),
        change_type: body.change_type || "Điều chỉnh lương",
        old_value: body.old_value || "",
        new_value: body.new_value || "",
        content: body.content || "",
        file_name: body.file_name || "",
        file_data: body.file_data || "",
        created_at: new Date().toISOString(),
        created_by: body.operator_name || "Quản trị viên"
    };
    if (body.change_type === "Điều chỉnh lương" && body.new_value) {
        const numSal = parseFloat(String(body.new_value).replace(/[^\d]/g, ''));
        if (!isNaN(numSal) && numSal > 0) contracts[idx].salary = numSal;
    }
    if (body.change_type === "Gia hạn thời gian" && body.new_value) {
        contracts[idx].expiry_date = fixExcelSerialDate(body.new_value);
        contracts[idx].end_date = fixExcelSerialDate(body.new_value);
    }
    contracts[idx].appendices.unshift(appendixObj);
    contracts[idx].updated_at = new Date().toISOString();
    saveDatabase(db);
    res.json({ success: true, appendix: appendixObj, message: "Thêm phụ lục hợp đồng thành công!" });
});

// DELETE APPENDIX
app.delete('/api/contracts/:id/appendices/:appendixId', (req, res) => {
    const db = loadDatabase();
    const id = req.params.id;
    const appendixId = req.params.appendixId;
    const contracts = db.tables['10_Contracts'] || [];
    const idx = contracts.findIndex(c => c.contract_id === id || c.employee_id === id);
    if (idx < 0) return res.status(404).json({ success: false, message: "Hợp đồng không tồn tại" });

    if (Array.isArray(contracts[idx].appendices)) {
        contracts[idx].appendices = contracts[idx].appendices.filter(a => a.appendix_id !== appendixId && a.appendix_number !== appendixId);
        contracts[idx].updated_at = new Date().toISOString();
        saveDatabase(db);
    }
    res.json({ success: true, message: "Đã xóa phụ lục hợp đồng!" });
});

// TERMINATE CONTRACT
app.post('/api/contracts/:id/terminate', (req, res) => {
    const db = loadDatabase();
    const id = req.params.id;
    const body = req.body || {};
    const contracts = db.tables['10_Contracts'] || [];
    const employees = db.tables['03_Employees'] || [];
    const idx = contracts.findIndex(c => c.contract_id === id || c.employee_id === id);
    if (idx < 0) return res.status(404).json({ success: false, message: "Hợp đồng không tồn tại" });

    const terminationDate = fixExcelSerialDate(body.termination_date || new Date().toISOString().split('T')[0]);
    const reasonGroup = body.reason_group || "Thỏa thuận chấm dứt HĐLĐ";
    const reasonDetail = body.reason_detail || "";
    const decisionNumber = body.decision_number || `QĐ-CD-${id}`;

    contracts[idx].contract_status = "ĐÃ CHẤM DỨT";
    contracts[idx].end_date = terminationDate;
    contracts[idx].expiry_date = terminationDate;
    contracts[idx].termination = {
        termination_date: terminationDate,
        reason_group: reasonGroup,
        reason_detail: reasonDetail,
        decision_number: decisionNumber,
        file_name: body.file_name || "",
        file_data: body.file_data || "",
        terminated_at: new Date().toISOString(),
        terminated_by: body.operator_name || "Quản trị viên"
    };
    contracts[idx].updated_at = new Date().toISOString();

    if (body.update_employee_status !== false) {
        const empIdx = employees.findIndex(e => e.employee_id === contracts[idx].employee_id);
        if (empIdx >= 0) {
            employees[empIdx].employment_status = "Đã nghỉ việc";
            employees[empIdx].resignation_date = terminationDate;
            employees[empIdx].resignation_reason_group = reasonGroup;
            employees[empIdx].resignation_reason = reasonDetail;
            employees[empIdx].updated_at = new Date().toISOString();
            let masters = db.tables['00_Master_Profiles'] || [];
            const mIdx = masters.findIndex(m => m.employee_id === contracts[idx].employee_id || m['Mã nhân viên'] === contracts[idx].employee_id);
            if (mIdx >= 0) {
                masters[mIdx]['Trạng thái lao động'] = "Đã nghỉ việc";
                masters[mIdx]['Ngày nghỉ việc'] = terminationDate;
                masters[mIdx]['Lý do nghỉ'] = reasonDetail;
            }
        }
    }
    saveDatabase(db);
    res.json({ success: true, message: `Đã chấm dứt hợp đồng ${id} thành công!` });
});

// IMPORT CONTRACTS FROM EXCEL
app.post('/api/contracts/import-excel', (req, res) => {
    const db = loadDatabase();
    if (!db.tables['10_Contracts']) db.tables['10_Contracts'] = [];
    const contracts = db.tables['10_Contracts'];
    const employees = db.tables['03_Employees'] || [];
    const depts = db.tables['01_Departments'] || [];
    const positions = db.tables['02_Positions'] || [];
    const deptMap = Object.fromEntries(depts.map(d => [d.department_id, d.department_name]));
    const posMap = Object.fromEntries(positions.map(p => [p.position_id, p.position_name]));
    const empMap = Object.fromEntries(employees.map(e => [e.employee_id, e]));

    const body = req.body || {};
    const list = body.contracts || [];
    if (!Array.isArray(list) || list.length === 0) {
        return res.status(400).json({ success: false, message: "Dữ liệu hợp đồng rỗng!" });
    }

    const contractMap = new Map(contracts.map(c => [c.contract_id || c.employee_id, c]));
    list.forEach(c => {
        const id = (c.contract_id || c.employee_id || `HD-${Date.now()}-${Math.floor(Math.random()*1000)}`).trim();
        const emp = empMap[c.employee_id] || {};
        const item = {
            contract_id: id,
            employee_id: c.employee_id || id,
            full_name: c.full_name || emp.full_name || id,
            contract_type: c.contract_type || emp.contract_type || "Hợp đồng xác định thời hạn",
            start_date: fixExcelSerialDate(c.start_date || c.effective_date || ""),
            end_date: fixExcelSerialDate(c.end_date || c.expiry_date || "Không xác định"),
            trial_start_date: fixExcelSerialDate(c.trial_start_date || ""),
            official_date: fixExcelSerialDate(c.official_date || ""),
            effective_date: fixExcelSerialDate(c.effective_date || c.start_date || ""),
            expiry_date: fixExcelSerialDate(c.expiry_date || c.end_date || null),
            contract_status: c.contract_status || (c.end_date && new Date(c.end_date) < new Date() ? "HẾT HẠN" : "HIỆU LỰC"),
            salary: c.salary || emp.base_salary || 0,
            department_id: c.department_id || emp.department_id || "",
            department_name: c.department_name || emp.department_name || deptMap[emp.department_id] || "",
            job_title: c.job_title || emp.job_title || posMap[emp.position_id] || "",
            signer_name: c.signer_name || "Huỳnh Thanh Long",
            notes: c.notes || "",
            appendices: Array.isArray(c.appendices) ? c.appendices : [],
            attachments: Array.isArray(c.attachments) ? c.attachments : [],
            updated_at: new Date().toISOString()
        };
        contractMap.set(id, { ...(contractMap.get(id) || {}), ...item });
    });
    db.tables['10_Contracts'] = Array.from(contractMap.values());
    saveDatabase(db);
    res.json({ success: true, count: list.length, message: `Đã nhập ${list.length} hợp đồng thành công!` });
});

// ==========================================
// COMPANIES, DEPARTMENTS & POSITIONS ENDPOINTS
// ==========================================

// GET COMPANIES
app.get('/api/companies', (req, res) => {
    const db = loadDatabase();
    res.json({
        success: true,
        data: db.tables['00_Companies'] || []
    });
});

// CREATE COMPANY
app.post('/api/companies', (req, res) => {
    const db = loadDatabase();
    if (!db.tables['00_Companies']) db.tables['00_Companies'] = [];
    const companies = db.tables['00_Companies'];
    const body = req.body;

    const compId = (body.company_id || '').trim().toUpperCase();
    const compName = (body.company_name || '').trim();

    if (!compId || !compName) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ Mã công ty và Tên công ty' });
    }

    if (companies.some(c => (c.company_id || '').toUpperCase() === compId)) {
        return res.status(400).json({ success: false, message: `Mã công ty "${compId}" đã tồn tại trên hệ thống` });
    }

    const newComp = {
        company_id: compId,
        company_name: compName,
        parent_company_id: body.parent_company_id || ''
    };

    companies.push(newComp);
    db.tables['00_Companies'] = companies;

    recordLog(db, {
        action_type: 'CREATE',
        module: 'Tổ chức',
        description: `Thêm mới công ty: ${newComp.company_id} - ${newComp.company_name}`,
        user_id: body.operator_id || 'TH-0001',
        user_name: body.operator_name || 'Huỳnh Thanh Long',
        user_role: body.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.status(201).json({
        success: true,
        message: 'Thêm mới công ty thành công!',
        company: newComp
    });
});

// UPDATE COMPANY
app.put('/api/companies/:id', (req, res) => {
    const db = loadDatabase();
    const companies = db.tables['00_Companies'] || [];
    const id = req.params.id;
    const body = req.body;

    const idx = companies.findIndex(c => c.company_id === id);
    if (idx === -1) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy công ty' });
    }

    const oldName = companies[idx].company_name;
    const newName = (body.company_name || oldName).trim();

    companies[idx] = {
        ...companies[idx],
        company_name: newName,
        parent_company_id: body.parent_company_id !== undefined ? body.parent_company_id : companies[idx].parent_company_id
    };

    db.tables['00_Companies'] = companies;

    recordLog(db, {
        action_type: 'UPDATE',
        module: 'Tổ chức',
        description: `Cập nhật công ty ${id}: ${oldName} -> ${newName}`,
        user_id: body.operator_id || 'TH-0001',
        user_name: body.operator_name || 'Huỳnh Thanh Long',
        user_role: body.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.json({
        success: true,
        message: 'Cập nhật công ty thành công!',
        company: companies[idx]
    });
});

// DELETE COMPANY
app.delete('/api/companies/:id', (req, res) => {
    const db = loadDatabase();
    let companies = db.tables['00_Companies'] || [];
    const depts = db.tables['01_Departments'] || [];
    const id = req.params.id;

    const target = companies.find(c => c.company_id === id);
    if (!target) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy công ty' });
    }

    // Check if departments belong to this company
    const assignedDepts = depts.filter(d => d.company_id === id);
    if (assignedDepts.length > 0) {
        return res.status(400).json({
            success: false,
            message: `Không thể xóa công ty này vì đang có ${assignedDepts.length} phòng ban trực thuộc. Vui lòng chuyển hoặc xóa các phòng ban trước.`
        });
    }

    companies = companies.filter(c => c.company_id !== id);
    db.tables['00_Companies'] = companies;

    recordLog(db, {
        action_type: 'DELETE',
        module: 'Tổ chức',
        description: `Xóa công ty ${id} - ${target.company_name}`,
        user_id: req.body?.operator_id || 'TH-0001',
        user_name: req.body?.operator_name || 'Huỳnh Thanh Long',
        user_role: req.body?.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.json({ success: true, message: 'Đã xóa công ty thành công!' });
});

// GET DEPARTMENTS
app.get('/api/departments', (req, res) => {
    const db = loadDatabase();
    res.json({
        success: true,
        data: db.tables['01_Departments'] || []
    });
});

// CREATE DEPARTMENT
app.post('/api/departments', (req, res) => {
    const db = loadDatabase();
    const depts = db.tables['01_Departments'] || [];
    const body = req.body;

    const deptId = (body.department_id || '').trim().toUpperCase();
    const deptName = (body.department_name || '').trim();

    if (!deptId || !deptName) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ Mã và Tên phòng ban' });
    }

    if (depts.some(d => (d.department_id || '').toUpperCase() === deptId)) {
        return res.status(400).json({ success: false, message: `Mã phòng ban "${deptId}" đã tồn tại trên hệ thống` });
    }

    // Auto-detect company_id if not explicitly given: match prefix with company_id
    const companies = db.tables['00_Companies'] || [];
    let compId = body.company_id || '';
    if (!compId) {
        const matchedComp = companies.find(c => deptId.startsWith(c.company_id + '-') || deptId.startsWith(c.company_id + '_') || deptId.startsWith(c.company_id));
        compId = matchedComp ? matchedComp.company_id : 'TH-CORP';
    }

    const newDept = {
        department_id: deptId,
        department_name: deptName,
        company_id: compId,
        parent_dept_id: body.parent_dept_id || '',
        manager_id: body.manager_id || '',
        status: body.status || 'Hoạt động'
    };

    depts.push(newDept);
    db.tables['01_Departments'] = depts;

    recordLog(db, {
        action_type: 'CREATE',
        module: 'Tổ chức',
        description: `Thêm mới phòng ban: ${newDept.department_id} - ${newDept.department_name} (Công ty: ${newDept.company_id})`,
        user_id: body.operator_id || 'TH-0001',
        user_name: body.operator_name || 'Huỳnh Thanh Long',
        user_role: body.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.status(201).json({
        success: true,
        message: 'Thêm mới phòng ban thành công!',
        department: newDept
    });
});

// UPDATE DEPARTMENT
app.put('/api/departments/:id', (req, res) => {
    const db = loadDatabase();
    const depts = db.tables['01_Departments'] || [];
    const id = req.params.id;
    const body = req.body;

    const idx = depts.findIndex(d => d.department_id === id);
    if (idx === -1) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy phòng ban' });
    }

    const oldName = depts[idx].department_name;
    const newName = (body.department_name || oldName).trim();

    depts[idx] = {
        ...depts[idx],
        department_name: newName,
        company_id: body.company_id !== undefined ? body.company_id : (depts[idx].company_id || 'TH-CORP'),
        parent_dept_id: body.parent_dept_id !== undefined ? body.parent_dept_id : depts[idx].parent_dept_id,
        manager_id: body.manager_id !== undefined ? body.manager_id : depts[idx].manager_id,
        status: body.status || depts[idx].status
    };

    db.tables['01_Departments'] = depts;

    // Sync updated department_name to employees table
    if (db.tables['03_Employees']) {
        db.tables['03_Employees'].forEach(emp => {
            if (emp.department_id === id) {
                emp.department_name = newName;
            }
        });
    }

    recordLog(db, {
        action_type: 'UPDATE',
        module: 'Tổ chức',
        description: `Cập nhật phòng ban ${id}: ${oldName} -> ${newName}`,
        user_id: body.operator_id || 'TH-0001',
        user_name: body.operator_name || 'Huỳnh Thanh Long',
        user_role: body.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.json({
        success: true,
        message: 'Cập nhật phòng ban thành công!',
        department: depts[idx]
    });
});

// DELETE DEPARTMENT
app.delete('/api/departments/:id', (req, res) => {
    const db = loadDatabase();
    let depts = db.tables['01_Departments'] || [];
    const employees = db.tables['03_Employees'] || [];
    const id = req.params.id;

    const target = depts.find(d => d.department_id === id);
    if (!target) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy phòng ban' });
    }

    // Check if active employees belong to this department
    const activeAssigned = employees.filter(e => e.department_id === id && e.employment_status !== 'Đã nghỉ việc');
    if (activeAssigned.length > 0) {
        return res.status(400).json({
            success: false,
            message: `Không thể xóa phòng ban này vì đang có ${activeAssigned.length} nhân sự đang làm việc. Vui lòng chuyển nhân sự sang phòng ban khác trước.`
        });
    }

    depts = depts.filter(d => d.department_id !== id);
    db.tables['01_Departments'] = depts;

    recordLog(db, {
        action_type: 'DELETE',
        module: 'Tổ chức',
        description: `Xóa phòng ban ${id} - ${target.department_name}`,
        user_id: req.body?.operator_id || 'TH-0001',
        user_name: req.body?.operator_name || 'Huỳnh Thanh Long',
        user_role: req.body?.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.json({ success: true, message: 'Đã xóa phòng ban thành công!' });
});

// GET POSITIONS
app.get('/api/positions', (req, res) => {
    const db = loadDatabase();
    res.json({
        success: true,
        data: db.tables['02_Positions'] || []
    });
});

// CREATE POSITION
app.post('/api/positions', (req, res) => {
    const db = loadDatabase();
    const positions = db.tables['02_Positions'] || [];
    const body = req.body;

    const posId = (body.position_id || '').trim().toUpperCase();
    const posName = (body.position_name || '').trim();

    if (!posId || !posName) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ Mã và Tên vị trí chức danh' });
    }

    if (positions.some(p => (p.position_id || '').toUpperCase() === posId)) {
        return res.status(400).json({ success: false, message: `Mã vị trí "${posId}" đã tồn tại trên hệ thống` });
    }

    const newPos = {
        position_id: posId,
        position_name: posName,
        department_id: body.department_id || '',
        level: body.level || 'Cấp 3',
        status: body.status || 'Hoạt động'
    };

    positions.push(newPos);
    db.tables['02_Positions'] = positions;

    recordLog(db, {
        action_type: 'CREATE',
        module: 'Tổ chức',
        description: `Thêm mới vị trí công việc: ${newPos.position_id} - ${newPos.position_name}`,
        user_id: body.operator_id || 'TH-0001',
        user_name: body.operator_name || 'Huỳnh Thanh Long',
        user_role: body.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.status(201).json({
        success: true,
        message: 'Thêm mới vị trí công việc thành công!',
        position: newPos
    });
});

// UPDATE POSITION
app.put('/api/positions/:id', (req, res) => {
    const db = loadDatabase();
    const positions = db.tables['02_Positions'] || [];
    const id = req.params.id;
    const body = req.body;

    const idx = positions.findIndex(p => p.position_id === id);
    if (idx === -1) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy vị trí công việc' });
    }

    const oldName = positions[idx].position_name;
    const newName = (body.position_name || oldName).trim();

    positions[idx] = {
        ...positions[idx],
        position_name: newName,
        department_id: body.department_id !== undefined ? body.department_id : positions[idx].department_id,
        level: body.level || positions[idx].level,
        status: body.status || positions[idx].status
    };

    db.tables['02_Positions'] = positions;

    recordLog(db, {
        action_type: 'UPDATE',
        module: 'Tổ chức',
        description: `Cập nhật vị trí công việc ${id}: ${oldName} -> ${newName}`,
        user_id: body.operator_id || 'TH-0001',
        user_name: body.operator_name || 'Huỳnh Thanh Long',
        user_role: body.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.json({
        success: true,
        message: 'Cập nhật vị trí công việc thành công!',
        position: positions[idx]
    });
});

// DELETE POSITION
app.delete('/api/positions/:id', (req, res) => {
    const db = loadDatabase();
    let positions = db.tables['02_Positions'] || [];
    const employees = db.tables['03_Employees'] || [];
    const id = req.params.id;

    const target = positions.find(p => p.position_id === id);
    if (!target) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy vị trí công việc' });
    }

    // Check if active employees hold this position
    const activeAssigned = employees.filter(e => e.position_id === id && e.employment_status !== 'Đã nghỉ việc');
    if (activeAssigned.length > 0) {
        return res.status(400).json({
            success: false,
            message: `Không thể xóa vị trí này vì đang có ${activeAssigned.length} nhân sự đảm nhiệm. Vui lòng chuyển chức danh nhân sự trước.`
        });
    }

    positions = positions.filter(p => p.position_id !== id);
    db.tables['02_Positions'] = positions;

    recordLog(db, {
        action_type: 'DELETE',
        module: 'Tổ chức',
        description: `Xóa vị trí công việc ${id} - ${target.position_name}`,
        user_id: req.body?.operator_id || 'TH-0001',
        user_name: req.body?.operator_name || 'Huỳnh Thanh Long',
        user_role: req.body?.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.json({ success: true, message: 'Đã xóa vị trí công việc thành công!' });
});

// ==========================================
// ORGANIZATION EXCEL IMPORT & TEMPLATE
// ==========================================

// 1. DOWNLOAD ORGANIZATION EXCEL TEMPLATE (3 SHEETS: COMPANIES, DEPARTMENTS, POSITIONS)
app.get('/api/organization/template-excel', (req, res) => {
    try {
        const wb = XLSX.utils.book_new();

        // Sheet 1: Companies (01_Cong_Ty) - Chỉ Mã công ty và Tên công ty
        const companiesData = [
            ['Mã công ty (*)', 'Tên công ty (*)'],
            ['TH-CORP', 'Tổng Công Ty Cổ Phần Trung Hải'],
            ['TP', 'Công Ty Cổ Phần Xây Dựng Cầu Đường Thành Phát'],
            ['TH-TECH', 'Công Ty TNHH Công Nghệ & Giải Pháp Số Trung Hải']
        ];
        const wsComp = XLSX.utils.aoa_to_sheet(companiesData);
        wsComp['!cols'] = [{ wch: 18 }, { wch: 45 }];
        XLSX.utils.book_append_sheet(wb, wsComp, '01_Cong_Ty');

        // Sheet 2: Departments (02_Phong_Ban) - Chỉ Mã phòng ban, Tên phòng ban và Mã công ty bắt buộc
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

        // Sheet 3: Positions (03_Vi_Tri) - Danh mục vị trí độc lập, không phụ thuộc phòng ban và công ty
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

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', 'attachment; filename="Mau_Co_Cau_To_Chuc_TRUNGHAI.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (e) {
        console.error('Lỗi xuất file mẫu tổ chức:', e);
        res.status(500).json({ success: false, message: 'Lỗi khi tạo file mẫu Excel: ' + e.message });
    }
});

// 2. IMPORT ORGANIZATION DATA FROM EXCEL (COMPANIES, DEPARTMENTS, POSITIONS WITH STRICT RELATIONAL INTEGRITY)
app.post('/api/organization/import-excel', async (req, res) => {
    try {
        const clientSheetId = req.headers['x-spreadsheet-id'] || req.body.spreadsheetId;
        const clientCreds = req.headers['x-google-credentials'] || req.body.googleCredentials;
        if (clientSheetId) activeClientSpreadsheetId = clientSheetId;
        if (clientCreds) activeClientCredentials = clientCreds;

        const db = loadDatabase();
        if (!db.tables['00_Companies']) db.tables['00_Companies'] = [];
        if (!db.tables['01_Departments']) db.tables['01_Departments'] = [];
        if (!db.tables['02_Positions']) db.tables['02_Positions'] = [];

        const companies = db.tables['00_Companies'];
        const departments = db.tables['01_Departments'];
        const positions = db.tables['02_Positions'];

        const body = req.body || {};
        const importCompanies = Array.isArray(body.companies) ? body.companies : [];
        const importDepartments = Array.isArray(body.departments) ? body.departments : [];
        const importPositions = Array.isArray(body.positions) ? body.positions : [];
        const overwrite = body.overwrite !== false; // default true

        const operatorId = body.operator_id || 'TH-0001';
        const operatorName = body.operator_name || 'Huỳnh Thanh Long';
        const operatorRole = body.operator_role || 'ADMIN';

        // Known ID Sets for relational validation
        const validCompanyIds = new Map();
        companies.forEach(c => validCompanyIds.set((c.company_id || '').toUpperCase(), c.company_name || ''));

        const validDeptIds = new Map();
        departments.forEach(d => validDeptIds.set((d.department_id || '').toUpperCase(), d.department_name || ''));

        const results = {
            companies: { added: 0, updated: 0, errors: [] },
            departments: { added: 0, updated: 0, errors: [] },
            positions: { added: 0, updated: 0, errors: [] }
        };

        // --- STEP 1: PROCESS COMPANIES ---
        for (let i = 0; i < importCompanies.length; i++) {
            const item = importCompanies[i];
            const compId = (item.company_id || '').trim().toUpperCase();
            const compName = (item.company_name || '').trim();

            if (!compId || !compName) {
                results.companies.errors.push(`Dòng ${i + 1}: Thiếu Mã công ty hoặc Tên công ty`);
                continue;
            }

            const existingIdx = companies.findIndex(c => (c.company_id || '').toUpperCase() === compId);
            if (existingIdx >= 0) {
                if (overwrite) {
                    companies[existingIdx].company_name = compName;
                    if (item.parent_company_id !== undefined) companies[existingIdx].parent_company_id = item.parent_company_id;
                    results.companies.updated++;
                }
            } else {
                companies.push({
                    company_id: compId,
                    company_name: compName,
                    parent_company_id: item.parent_company_id || ''
                });
                results.companies.added++;
            }
            validCompanyIds.set(compId, compName);
        }

        // --- STEP 2: PROCESS DEPARTMENTS (STRICT LINKAGE: MUST HAVE VALID company_id) ---
        for (let i = 0; i < importDepartments.length; i++) {
            const item = importDepartments[i];
            const deptId = (item.department_id || '').trim().toUpperCase();
            const deptName = (item.department_name || '').trim();
            const compId = (item.company_id || '').trim().toUpperCase();

            if (!deptId || !deptName) {
                results.departments.errors.push(`Dòng ${i + 1}: Thiếu Mã phòng ban hoặc Tên phòng ban`);
                continue;
            }

            // RELATIONAL CHECK 1: Bắt buộc nhập mã công ty
            if (!compId) {
                results.departments.errors.push(`Phòng ban "${deptId} - ${deptName}": BẮT BUỘC phải nhập Mã công ty trực thuộc`);
                continue;
            }

            // RELATIONAL CHECK 2: Mã công ty phải tồn tại trong CSDL hoặc trong danh sách công ty vừa nhập
            if (!validCompanyIds.has(compId)) {
                results.departments.errors.push(`Phòng ban "${deptId} - ${deptName}": Mã công ty "${compId}" không tồn tại trên hệ thống`);
                continue;
            }

            const existingIdx = departments.findIndex(d => (d.department_id || '').toUpperCase() === deptId);
            if (existingIdx >= 0) {
                if (overwrite) {
                    departments[existingIdx].department_name = deptName;
                    departments[existingIdx].company_id = compId;
                    if (item.parent_dept_id !== undefined) departments[existingIdx].parent_dept_id = item.parent_dept_id;
                    results.departments.updated++;
                }
            } else {
                departments.push({
                    department_id: deptId,
                    department_name: deptName,
                    company_id: compId,
                    parent_dept_id: item.parent_dept_id || '',
                    manager_id: item.manager_id || '',
                    status: 'Hoạt động'
                });
                results.departments.added++;
            }
            validDeptIds.set(deptId, deptName);
        }

        // --- STEP 3: PROCESS POSITIONS (INDEPENDENT CATALOG: NOT DEPENDENT ON COMPANY OR DEPT) ---
        for (let i = 0; i < importPositions.length; i++) {
            const item = importPositions[i];
            const posId = (item.position_id || '').trim().toUpperCase();
            const posName = (item.position_name || '').trim();

            if (!posId || !posName) {
                results.positions.errors.push(`Dòng ${i + 1}: Thiếu Mã vị trí hoặc Tên vị trí`);
                continue;
            }

            const existingIdx = positions.findIndex(p => (p.position_id || '').toUpperCase() === posId);
            if (existingIdx >= 0) {
                if (overwrite) {
                    positions[existingIdx].position_name = posName;
                    if (item.level !== undefined) positions[existingIdx].level = item.level;
                    results.positions.updated++;
                }
            } else {
                positions.push({
                    position_id: posId,
                    position_name: posName,
                    department_id: '',
                    level: item.level || 'Cấp 3',
                    status: 'Hoạt động'
                });
                results.positions.added++;
            }
        }

        db.tables['00_Companies'] = companies;
        db.tables['01_Departments'] = departments;
        db.tables['02_Positions'] = positions;

        const totalAdded = results.companies.added + results.departments.added + results.positions.added;
        const totalUpdated = results.companies.updated + results.departments.updated + results.positions.updated;
        const totalErrors = results.companies.errors.length + results.departments.errors.length + results.positions.errors.length;

        recordLog(db, {
            action_type: 'CREATE',
            module: 'Tổ chức',
            description: `Nhập Excel cơ cấu tổ chức: Thêm ${totalAdded} mục, cập nhật ${totalUpdated} mục (Công ty: +${results.companies.added}, Phòng ban: +${results.departments.added}, Vị trí: +${results.positions.added})`,
            user_id: operatorId,
            user_name: operatorName,
            user_role: operatorRole,
            ip: req.ip
        });

        saveDatabase(db);

        res.json({
            success: true,
            results,
            totalAdded,
            totalUpdated,
            totalErrors,
            message: `Nhập cơ cấu tổ chức thành công! Đã thêm mới ${totalAdded} mục, cập nhật ${totalUpdated} mục.`
        });
    } catch (e) {
        console.error('Lỗi nhập Excel cơ cấu tổ chức:', e);
        res.status(500).json({ success: false, message: 'Lỗi khi nhập dữ liệu Excel: ' + e.message });
    }
});

// ==========================================
// AUTHENTICATION & SESSION ENDPOINTS
// ==========================================

// LOGIN ENDPOINT
app.post('/api/login', loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu' });
        }

        const db = loadDatabase();
        const accounts = db.tables['11_System_Accounts'] || [];
        const employees = db.tables['03_Employees'] || [];
        const contacts = db.tables['04_Contacts_Addresses'] || [];

        const q = username.toLowerCase().trim();
        
        // Find account by username, employee_id, account_email, or admin aliases
        let userAcc = accounts.find(a => 
            (a.username && a.username.toLowerCase().trim() === q) ||
            (a.employee_id && a.employee_id.toLowerCase().trim() === q) ||
            (a.account_email && a.account_email.toLowerCase().trim() === q) ||
            (a.role === 'ADMIN' && ['admin', 'longht', 'longht@trunghaico.vn', 'admin@trunghai.vn', 'admin@trunghaico.vn'].includes(q))
        );

        // Fallback: match by employee profile work_email or mobile_phone
        if (!userAcc) {
            const matchedEmp = employees.find(e => 
                (e.employee_id && e.employee_id.toLowerCase().trim() === q) ||
                (e.work_email && e.work_email.toLowerCase().trim() === q)
            ) || contacts.find(c => 
                (c.employee_id && c.employee_id.toLowerCase().trim() === q) ||
                (c.work_email && c.work_email.toLowerCase().trim() === q)
            );

            if (matchedEmp) {
                userAcc = accounts.find(a => a.employee_id === matchedEmp.employee_id);
            }
        }

        if (!userAcc) {
            recordLog(db, {
                action_type: 'LOGIN_FAIL',
                module: 'Bảo mật',
                description: `Đăng nhập thất bại: Tài khoản "${username}" không tồn tại`,
                user_id: username,
                user_name: username,
                user_role: 'GUEST',
                ip: req.ip
            });
            saveDatabase(db);
            return res.status(401).json({ success: false, message: 'Tên đăng nhập hoặc mật khẩu không chính xác' });
        }

        // Check account status
        if (userAcc.account_status === 'Khóa' || userAcc.account_status === 'Tạm khóa') {
            return res.status(403).json({ success: false, message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Quản trị viên.' });
        }

        // Verify password
        const isMatch = await verifyPassword(password, userAcc.password);
        if (!isMatch) {
            recordLog(db, {
                action_type: 'LOGIN_FAIL',
                module: 'Bảo mật',
                description: `Đăng nhập thất bại: Sai mật khẩu cho tài khoản ${userAcc.employee_id} (${userAcc.full_name})`,
                user_id: userAcc.employee_id,
                user_name: userAcc.full_name,
                user_role: userAcc.role || 'HR',
                ip: req.ip
            });
            saveDatabase(db);
            return res.status(401).json({ success: false, message: 'Tên đăng nhập hoặc mật khẩu không chính xác' });
        }

        // Auto-upgrade plain-text password to bcrypt hash in database
        if (!userAcc.password.startsWith('$2a$') && !userAcc.password.startsWith('$2b$')) {
            userAcc.password = await hashPassword(password);
            saveDatabase(db);
        }

        // Generate JWT Token (Expires in 24 hours)
        const tokenPayload = {
            account_id: userAcc.account_id,
            employee_id: userAcc.employee_id,
            username: userAcc.username || userAcc.employee_id,
            full_name: userAcc.full_name,
            role: userAcc.role || 'HR'
        };
        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

        // Record successful login in audit trail
        recordLog(db, {
            action_type: 'LOGIN',
            module: 'Bảo mật',
            description: `Đăng nhập thành công vào hệ thống (${userAcc.full_name} - Quyền: ${userAcc.role})`,
            user_id: userAcc.employee_id,
            user_name: userAcc.full_name,
            user_role: userAcc.role || 'HR',
            ip: req.ip
        });
        saveDatabase(db);

        res.json({
            success: true,
            message: `Đăng nhập thành công! Chào mừng ${userAcc.full_name}`,
            token,
            user: tokenPayload
        });
    } catch (e) {
        console.error('Login error:', e);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ trong quá trình xác thực: ' + e.message });
    }
});

// GET CURRENT AUTH PROFILE
app.get('/api/auth/me', authenticateToken, (req, res) => {
    res.json({ success: true, user: req.user });
});

// CHANGE PASSWORD
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
    try {
        const { current_password, new_password } = req.body;
        if (!current_password || !new_password) {
            return res.status(400).json({ success: false, message: 'Vui lòng cung cấp mật khẩu hiện tại và mật khẩu mới' });
        }

        const db = loadDatabase();
        const accounts = db.tables['11_System_Accounts'] || [];
        const userAcc = accounts.find(a => a.employee_id === req.user.employee_id);

        if (!userAcc) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản người dùng' });
        }

        const isMatch = await verifyPassword(current_password, userAcc.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không chính xác' });
        }

        userAcc.password = await hashPassword(new_password);
        saveDatabase(db);

        recordLog(db, {
            action_type: 'PASSWORD',
            module: 'Bảo mật',
            description: `Đổi mật khẩu thành công cho tài khoản ${req.user.employee_id} (${req.user.full_name})`,
            user_id: req.user.employee_id,
            user_name: req.user.full_name,
            user_role: req.user.role,
            ip: req.ip
        });

        res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ==========================================
// ACCOUNTS & RBAC MANAGEMENT ENDPOINTS
// ==========================================

// GET ACCOUNTS
app.get('/api/accounts', (req, res) => {
    const db = loadDatabase();
    res.json({
        success: true,
        data: db.tables['11_System_Accounts'] || []
    });
});

// CREATE ACCOUNT
app.post('/api/accounts', async (req, res) => {
    const db = loadDatabase();
    const accounts = db.tables['11_System_Accounts'] || [];
    const body = req.body;

    if (!body.employee_id || !body.account_email) {
        return res.status(400).json({ success: false, message: 'Thiếu mã nhân viên hoặc email' });
    }

    // Check duplicate
    if (accounts.some(a => a.employee_id === body.employee_id)) {
        return res.status(400).json({ success: false, message: 'Nhân viên này đã có tài khoản hệ thống' });
    }

    const hashedPassword = await hashPassword(body.password || '123456');

    const newAcc = {
        account_id: `ACC-${body.employee_id.replace('-', '')}`,
        employee_id: body.employee_id,
        full_name: body.full_name || '',
        account_email: body.account_email,
        role: body.role || 'HR',
        account_status: body.account_status || 'Kích hoạt',
        password: hashedPassword
    };

    accounts.unshift(newAcc);
    db.tables['11_System_Accounts'] = accounts;

    recordLog(db, {
        action_type: 'CREATE',
        module: 'Tài khoản',
        description: `Cấp tài khoản mới cho NV ${newAcc.employee_id} (${newAcc.full_name}) - Quyền: ${newAcc.role === 'ADMIN' ? 'Admin' : 'Nhân sự'}`,
        user_id: body.operator_id || 'TH-1948',
        user_name: body.operator_name || 'Huỳnh Thanh Long',
        user_role: body.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.status(201).json({ success: true, message: 'Cấp tài khoản thành công', account: newAcc });
});

// UPDATE ACCOUNT (ROLE / STATUS / EMAIL)
app.put('/api/accounts/:id', async (req, res) => {
    const db = loadDatabase();
    const accounts = db.tables['11_System_Accounts'] || [];
    const id = req.params.id;
    const body = req.body;

    const idx = accounts.findIndex(a => a.account_id === id || a.employee_id === id);
    if (idx === -1) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
    }

    let updatedPassword = accounts[idx].password;
    if (body.password) {
        updatedPassword = await hashPassword(body.password);
    }

    accounts[idx] = {
        ...accounts[idx],
        ...body,
        password: updatedPassword,
        account_id: accounts[idx].account_id,
        employee_id: accounts[idx].employee_id
    };

    db.tables['11_System_Accounts'] = accounts;

    recordLog(db, {
        action_type: 'UPDATE',
        module: 'Tài khoản',
        description: `Cập nhật tài khoản ${accounts[idx].employee_id} (${accounts[idx].full_name}) - Quyền: ${accounts[idx].role}, Trạng thái: ${accounts[idx].account_status}`,
        user_id: body.operator_id || 'TH-1948',
        user_name: body.operator_name || 'Huỳnh Thanh Long',
        user_role: body.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.json({ success: true, message: 'Cập nhật phân quyền tài khoản thành công', account: accounts[idx] });
});

// RESET PASSWORD
app.post('/api/accounts/:id/reset-password', async (req, res) => {
    const db = loadDatabase();
    const accounts = db.tables['11_System_Accounts'] || [];
    const id = req.params.id;
    const { new_password, operator_id, operator_name, operator_role } = req.body;

    const idx = accounts.findIndex(a => a.account_id === id || a.employee_id === id);
    if (idx === -1) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
    }

    accounts[idx].password = await hashPassword(new_password || '123456');
    db.tables['11_System_Accounts'] = accounts;

    recordLog(db, {
        action_type: 'PASSWORD',
        module: 'Tài khoản',
        description: `Đặt lại mật khẩu cho tài khoản ${accounts[idx].employee_id} (${accounts[idx].full_name})`,
        user_id: operator_id || 'TH-1948',
        user_name: operator_name || 'Huỳnh Thanh Long',
        user_role: operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.json({ success: true, message: 'Mật khẩu đã được thiết lập lại thành công' });
});

// DELETE ACCOUNT
app.delete('/api/accounts/:id', (req, res) => {
    const db = loadDatabase();
    let accounts = db.tables['11_System_Accounts'] || [];
    const id = req.params.id;

    const target = accounts.find(a => a.account_id === id || a.employee_id === id);
    if (!target) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
    }

    // Safety: Protect the only admin account from accidental deletion
    if (target.role === 'ADMIN') {
        const adminCount = accounts.filter(a => a.role === 'ADMIN').length;
        if (adminCount <= 1) {
            return res.status(400).json({ success: false, message: 'Không thể xóa tài khoản Quản trị viên (Admin) duy nhất của hệ thống' });
        }
    }

    accounts = accounts.filter(a => a.account_id !== id && a.employee_id !== id);
    db.tables['11_System_Accounts'] = accounts;

    recordLog(db, {
        action_type: 'DELETE',
        module: 'Tài khoản',
        description: `Xóa tài khoản đăng nhập ${target.employee_id} (${target.full_name}) khỏi hệ thống`,
        user_id: req.body?.operator_id || 'TH-1948',
        user_name: req.body?.operator_name || 'Huỳnh Thanh Long',
        user_role: req.body?.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.json({ success: true, message: 'Đã xóa tài khoản khỏi hệ thống' });
});

// BULK DELETE ACCOUNTS
app.post('/api/accounts/delete-bulk', (req, res) => {
    const db = loadDatabase();
    let accounts = db.tables['11_System_Accounts'] || [];
    const { account_ids, operator_id, operator_name, operator_role } = req.body;

    if (!Array.isArray(account_ids) || account_ids.length === 0) {
        return res.status(400).json({ success: false, message: 'Danh sách tài khoản cần xóa không hợp lệ' });
    }

    const toDeleteSet = new Set(account_ids);

    // Safety: Protect current operator and admin from accidentally deleting their own account
    const currentOpId = operator_id || 'TH-1948';
    toDeleteSet.delete(`ACC-${currentOpId}`);
    toDeleteSet.delete(`ACC-${currentOpId.replace(/-/g, '')}`);
    toDeleteSet.delete(currentOpId);
    toDeleteSet.delete('ACC-TH0001');
    toDeleteSet.delete('ACC-TH-0001');
    toDeleteSet.delete('TH-0001');
    toDeleteSet.delete('TH-1948');

    const initialCount = accounts.length;
    const deletedAccounts = accounts.filter(a => toDeleteSet.has(a.account_id) || toDeleteSet.has(a.employee_id));
    accounts = accounts.filter(a => !toDeleteSet.has(a.account_id) && !toDeleteSet.has(a.employee_id));
    
    db.tables['11_System_Accounts'] = accounts;
    ensureDefaultAccounts(db);

    const deletedCount = deletedAccounts.length;

    recordLog(db, {
        action_type: 'DELETE',
        module: 'Tài khoản',
        description: `Xóa hàng loạt ${deletedCount} tài khoản phân quyền khỏi hệ thống`,
        user_id: operator_id || 'TH-1948',
        user_name: operator_name || 'Huỳnh Thanh Long',
        user_role: operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.json({
        success: true,
        count: deletedCount,
        message: `Đã xóa thành công ${deletedCount} tài khoản phân quyền`
    });
});

// ==========================================
// SYSTEM ACTIVITY LOGS API ENDPOINTS
// ==========================================

// GET LOGS
app.get('/api/logs', (req, res) => {
    const db = loadDatabase();
    const logs = db.tables['12_System_Logs'] || [];
    res.json({
        success: true,
        data: logs
    });
});

// CREATE CLIENT LOG (LOGOUT, EXPORT, REPORT ACTIONS)
app.post('/api/logs', (req, res) => {
    const db = loadDatabase();
    const { action_type, module, description, user_id, user_name, user_role } = req.body;

    const entry = recordLog(db, {
        action_type: action_type || 'INFO',
        module: module || 'Hệ thống',
        description: description || '',
        user_id,
        user_name,
        user_role,
        ip: req.ip
    });

    saveDatabase(db);
    res.status(201).json({ success: true, log: entry });
});

// CLEAR ALL LOGS IS PROHIBITED FOR AUDIT TRAIL INTEGRITY
app.delete('/api/logs', (req, res) => {
    return res.status(403).json({
        success: false,
        message: 'Nhật ký hoạt động hệ thống là dữ liệu kiểm toán bất biến, không được phép xóa!'
    });
});

// 10. EXPORT EXCEL
app.get('/api/export', (req, res) => {
    const db = loadDatabase();
    const wb = XLSX.utils.book_new();

    for (const [sheetName, sheetData] of Object.entries(db.tables)) {
        const ws = XLSX.utils.json_to_sheet(sheetData);
        XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="HRM_Export_TrungHai.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
});
// ==========================================
// COMPANY BRANDING & SETTINGS API ENDPOINTS
// ==========================================

const DEFAULT_COMPANY_INFO = {
    brand_name: "TRUNG HẢI",
    full_name: "CÔNG TY CỔ PHẦN ĐẦU TƯ VÀ XÂY DỰNG TRUNG HẢI",
    subtitle: "HRM ENTERPRISE",
    logo_url: "assets/logo.png",
    tax_code: "0101234567",
    phone: "024.1234.5678",
    email: "contact@trunghaico.vn",
    address: "Tòa nhà Trung Hải, Hà Nội",
    website: "https://trunghaico.vn"
};

// GET COMPANY INFO
app.get('/api/company/info', (req, res) => {
    const db = loadDatabase();
    res.json({
        success: true,
        company: db.company_info || DEFAULT_COMPANY_INFO
    });
});

// UPDATE COMPANY INFO
app.post('/api/company/info', (req, res) => {
    const db = loadDatabase();
    const body = req.body;

    db.company_info = {
        ...(db.company_info || DEFAULT_COMPANY_INFO),
        brand_name: body.brand_name || db.company_info?.brand_name || DEFAULT_COMPANY_INFO.brand_name,
        full_name: body.full_name || db.company_info?.full_name || DEFAULT_COMPANY_INFO.full_name,
        subtitle: body.subtitle !== undefined ? body.subtitle : (db.company_info?.subtitle || DEFAULT_COMPANY_INFO.subtitle),
        logo_url: body.logo_url || db.company_info?.logo_url || DEFAULT_COMPANY_INFO.logo_url,
        tax_code: body.tax_code !== undefined ? body.tax_code : (db.company_info?.tax_code || ''),
        phone: body.phone !== undefined ? body.phone : (db.company_info?.phone || ''),
        email: body.email !== undefined ? body.email : (db.company_info?.email || ''),
        address: body.address !== undefined ? body.address : (db.company_info?.address || ''),
        website: body.website !== undefined ? body.website : (db.company_info?.website || '')
    };

    recordLog(db, {
        action_type: 'UPDATE',
        module: 'Hệ thống',
        description: `Cập nhật thông tin doanh nghiệp & thương hiệu: ${db.company_info.brand_name} - ${db.company_info.full_name}`,
        user_id: body.operator_id || 'TH-0001',
        user_name: body.operator_name || 'Huỳnh Thanh Long',
        user_role: body.operator_role || 'ADMIN',
        ip: req.ip
    });

    saveDatabase(db);

    res.json({
        success: true,
        message: 'Cập nhật thông tin doanh nghiệp thành công!',
        company: db.company_info
    });
});

// UPLOAD COMPANY LOGO (Base64)
app.post('/api/company/upload-logo', (req, res) => {
    try {
        const { image_base64 } = req.body;
        if (!image_base64) {
            return res.status(400).json({ success: false, message: 'Chưa có dữ liệu ảnh logo' });
        }

        const matches = image_base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            return res.status(400).json({ success: false, message: 'Định dạng ảnh Base64 không hợp lệ' });
        }

        const mimeType = matches[1];
        let ext = 'png';
        if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
        else if (mimeType.includes('svg')) ext = 'svg';
        else if (mimeType.includes('webp')) ext = 'webp';

        const buffer = Buffer.from(matches[2], 'base64');
        const uploadsDir = path.join(__dirname, 'public', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const fileName = `company_logo_${Date.now()}.${ext}`;
        const filePath = path.join(uploadsDir, fileName);
        fs.writeFileSync(filePath, buffer);

        const db = loadDatabase();
        if (!db.company_info) db.company_info = { ...DEFAULT_COMPANY_INFO };
        db.company_info.logo_url = `uploads/${fileName}`;

        recordLog(db, {
            action_type: 'UPDATE',
            module: 'Hệ thống',
            description: `Tải lên và đổi Logo nhận diện thương hiệu công ty (${fileName})`,
            user_id: req.body.operator_id || 'TH-0001',
            user_name: req.body.operator_name || 'Huỳnh Thanh Long',
            user_role: req.body.operator_role || 'ADMIN',
            ip: req.ip
        });

        saveDatabase(db);

        res.json({
            success: true,
            message: 'Tải lên Logo công ty thành công!',
            logo_url: db.company_info.logo_url,
            company: db.company_info
        });
    } catch (e) {
        console.error('Error uploading logo:', e);
        res.status(500).json({ success: false, message: 'Lỗi khi lưu ảnh logo: ' + e.message });
    }
});

// RESTORE FULL SAMPLE DATA
app.post('/api/setup/restore-sample-data', (req, res) => {
    try {
        const body = req.body || {};
        let sampleDb = body.tables ? { tables: body.tables } : null;

        if (!sampleDb) {
            const samplePath = path.join(__dirname, 'sample_database.json');
            if (fs.existsSync(samplePath)) {
                sampleDb = JSON.parse(fs.readFileSync(samplePath, 'utf-8'));
            }
        }

        if (sampleDb && sampleDb.tables && sampleDb.tables['03_Employees']) {
            saveDatabase(sampleDb);
            const count = sampleDb.tables['03_Employees'].length;
            return res.json({
                success: true,
                count,
                message: `Đã nạp thành công toàn bộ ${count} hồ sơ nhân sự mẫu vào hệ thống!`
            });
        }
        res.status(404).json({ success: false, message: 'Không tìm thấy dữ liệu sample_database.json' });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Lỗi khôi phục CSDL mẫu: ' + e.message });
    }
});

// ==========================================
// TIME & ATTENDANCE API (PHÂN HỆ CHẤM CÔNG & RONALD JACK 009)
// ==========================================
const { ronaldJackService } = require('./zk_service');
const {
    DEFAULT_SHIFTS,
    calculateDayTimesheet,
    getDayOfWeekName
} = require('./attendance_engine');

function ensureAttendanceTables(db) {
    if (!db.tables) db.tables = {};
    if (!Array.isArray(db.tables['15_Attendance_Shifts'])) {
        db.tables['15_Attendance_Shifts'] = JSON.parse(JSON.stringify(DEFAULT_SHIFTS));
    }
    if (!Array.isArray(db.tables['16_Attendance_Schedules'])) {
        db.tables['16_Attendance_Schedules'] = [];
    }
    if (!Array.isArray(db.tables['17_Attendance_Logs'])) {
        db.tables['17_Attendance_Logs'] = [];
    }
    if (!Array.isArray(db.tables['18_Attendance_Requests'])) {
        db.tables['18_Attendance_Requests'] = [];
    }
    if (!Array.isArray(db.tables['19_Attendance_Timesheets'])) {
        db.tables['19_Attendance_Timesheets'] = [];
    }
}

// 1. Overview Dashboard API
app.get('/api/attendance/overview', (req, res) => {
    try {
        const db = loadDatabase();
        ensureAttendanceTables(db);
        const date = req.query.date || new Date().toISOString().split('T')[0];
        const employees = (db.tables['03_Employees'] || []).filter(e => e.employment_status !== 'Đã nghỉ việc');
        const timesheets = (db.tables['19_Attendance_Timesheets'] || []).filter(t => t.date === date);
        const requests = (db.tables['18_Attendance_Requests'] || []).filter(r => r.date === date && r.status === 'APPROVED');

        const totalScheduled = employees.length;
        let workingCount = 0;
        let lateCount = 0;
        let earlyCount = 0;
        let absentCount = 0;
        let leaveCount = requests.length;

        timesheets.forEach(ts => {
            if (ts.check_in) workingCount++;
            if (ts.late_minutes > 0) lateCount++;
            if (ts.early_minutes > 0) earlyCount++;
            if (ts.status === 'ABSENT') absentCount++;
        });

        const recentLogs = [...(db.tables['17_Attendance_Logs'] || [])]
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 25);

        res.json({
            success: true,
            date,
            stats: {
                total_scheduled: totalScheduled,
                working: workingCount,
                late: lateCount,
                early: earlyCount,
                absent: Math.max(0, totalScheduled - workingCount - leaveCount),
                leave: leaveCount
            },
            recent_logs: recentLogs
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi lấy tổng quan chấm công: ' + err.message });
    }
});

// 2. Monthly Timesheets API
app.get('/api/attendance/timesheets', (req, res) => {
    try {
        const db = loadDatabase();
        ensureAttendanceTables(db);
        const month = req.query.month || new Date().toISOString().substring(0, 7);
        const empId = req.query.employee_id;
        const deptId = req.query.department_id;
        const status = req.query.status;

        let list = (db.tables['19_Attendance_Timesheets'] || []).filter(t => (t.date || '').startsWith(month));

        if (empId) {
            list = list.filter(t => t.employee_id === empId);
        }
        if (deptId) {
            list = list.filter(t => t.department_name === deptId || t.department_id === deptId);
        }
        if (status && status !== 'ALL') {
            list = list.filter(t => t.status === status);
        }

        list.sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.employee_id || '').localeCompare(b.employee_id || ''));

        res.json({
            success: true,
            month,
            count: list.length,
            timesheets: list
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi tải bảng công: ' + err.message });
    }
});

// 3. Calculate / Recalculate Timesheets
app.post('/api/attendance/calculate', (req, res) => {
    try {
        const db = loadDatabase();
        ensureAttendanceTables(db);
        const { month, date_from, date_to, employee_id } = req.body;

        const targetMonth = month || new Date().toISOString().substring(0, 7);
        const employees = (db.tables['03_Employees'] || []).filter(e => e.employment_status !== 'Đã nghỉ việc');
        const shifts = db.tables['15_Attendance_Shifts'] || [];
        const schedules = db.tables['16_Attendance_Schedules'] || [];
        const allLogs = db.tables['17_Attendance_Logs'] || [];
        const allRequests = db.tables['18_Attendance_Requests'] || [];
        const timesheetMap = new Map((db.tables['19_Attendance_Timesheets'] || []).map(t => [t.timesheet_id, t]));

        let dates = [];
        if (date_from && date_to) {
            let curr = new Date(date_from);
            const end = new Date(date_to);
            while (curr <= end) {
                dates.push(curr.toISOString().split('T')[0]);
                curr.setDate(curr.getDate() + 1);
            }
        } else {
            const [yStr, mStr] = targetMonth.split('-');
            const year = parseInt(yStr, 10);
            const mon = parseInt(mStr, 10);
            const daysInMonth = new Date(year, mon, 0).getDate();
            for (let d = 1; d <= daysInMonth; d++) {
                dates.push(`${targetMonth}-${String(d).padStart(2, '0')}`);
            }
        }

        const empsToProcess = employee_id
            ? employees.filter(e => e.employee_id === employee_id)
            : employees;

        empsToProcess.forEach(emp => {
            dates.forEach(dStr => {
                const tsId = `TS_${emp.employee_id}_${dStr}`;
                const existing = timesheetMap.get(tsId);

                let assignedShift = null;
                const sched = schedules.find(s => (s.employee_id === emp.employee_id || s.department_id === emp.department_id) && (s.date === dStr || s.day_of_week === getDayOfWeekName(dStr)));
                if (sched && sched.shift_id) {
                    assignedShift = shifts.find(sh => sh.shift_id === sched.shift_id);
                }

                const dayLogs = allLogs.filter(l => (l.timestamp || '').startsWith(dStr));
                const empApprovedReqs = allRequests.filter(r => r.employee_id === emp.employee_id && r.date === dStr && r.status === 'APPROVED');

                const computed = calculateDayTimesheet({
                    employee: emp,
                    date: dStr,
                    shift: assignedShift,
                    dayLogs,
                    approvedRequests: empApprovedReqs,
                    existingTimesheet: existing
                });

                timesheetMap.set(tsId, computed);
            });
        });

        db.tables['19_Attendance_Timesheets'] = Array.from(timesheetMap.values());
        saveDatabase(db);

        res.json({
            success: true,
            message: `Đã đối soát và tính công thành công cho ${empsToProcess.length} nhân sự trên ${dates.length} ngày!`,
            count: db.tables['19_Attendance_Timesheets'].length
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi tính toán bảng công: ' + err.message });
    }
});

// 4. Update Timesheet Manually (HR Override)
app.post('/api/attendance/timesheets/update', (req, res) => {
    try {
        const db = loadDatabase();
        ensureAttendanceTables(db);
        const { timesheet_id, check_in, check_out, work_units, ot_hours, status, note, operator_name } = req.body;

        if (!timesheet_id) {
            return res.status(400).json({ success: false, message: 'Thiếu timesheet_id' });
        }

        const idx = (db.tables['19_Attendance_Timesheets'] || []).findIndex(t => t.timesheet_id === timesheet_id);
        if (idx === -1) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy dòng bảng công' });
        }

        const row = db.tables['19_Attendance_Timesheets'][idx];
        if (row.is_locked) {
            return res.status(400).json({ success: false, message: 'Bảng công tháng này đã bị khóa sổ chốt công.' });
        }

        if (check_in !== undefined) row.check_in = check_in;
        if (check_out !== undefined) row.check_out = check_out;
        if (work_units !== undefined) row.work_units = parseFloat(work_units) || 0;
        if (ot_hours !== undefined) row.ot_hours = parseFloat(ot_hours) || 0;
        if (status !== undefined) row.status = status;
        if (note !== undefined) row.note = note;

        row.is_manual_edited = true;
        row.last_edited_by = operator_name || 'HR Admin';
        row.last_edited_at = new Date().toISOString();

        saveDatabase(db);
        res.json({ success: true, message: 'Cập nhật bảng công thủ công thành công!', timesheet: row });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi sửa bảng công: ' + err.message });
    }
});

// 5. Lock / Unlock Monthly Timesheet
app.post('/api/attendance/timesheets/lock', (req, res) => {
    try {
        const db = loadDatabase();
        ensureAttendanceTables(db);
        const { month, is_locked } = req.body;
        const targetMonth = month || new Date().toISOString().substring(0, 7);

        let count = 0;
        (db.tables['19_Attendance_Timesheets'] || []).forEach(ts => {
            if ((ts.date || '').startsWith(targetMonth)) {
                ts.is_locked = !!is_locked;
                count++;
            }
        });

        saveDatabase(db);
        res.json({
            success: true,
            is_locked: !!is_locked,
            message: is_locked ? `Đã khóa sổ chốt công tháng ${targetMonth} (${count} dòng)!` : `Đã mở khóa sổ tháng ${targetMonth}!`
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi khóa sổ bảng công: ' + err.message });
    }
});

// 6. Shifts CRUD
app.get('/api/attendance/shifts', (req, res) => {
    try {
        const db = loadDatabase();
        ensureAttendanceTables(db);
        res.json({ success: true, shifts: db.tables['15_Attendance_Shifts'] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/attendance/shifts/save', (req, res) => {
    try {
        const db = loadDatabase();
        ensureAttendanceTables(db);
        const shiftData = req.body;
        if (!shiftData.shift_id) {
            shiftData.shift_id = 'CA-' + Date.now().toString(36).toUpperCase();
        }

        const idx = db.tables['15_Attendance_Shifts'].findIndex(s => s.shift_id === shiftData.shift_id);
        if (idx >= 0) {
            db.tables['15_Attendance_Shifts'][idx] = { ...db.tables['15_Attendance_Shifts'][idx], ...shiftData };
        } else {
            db.tables['15_Attendance_Shifts'].push(shiftData);
        }

        saveDatabase(db);
        res.json({ success: true, message: 'Lưu ca làm việc thành công!', shift: shiftData });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/attendance/shifts/:id', (req, res) => {
    try {
        const db = loadDatabase();
        ensureAttendanceTables(db);
        const shiftId = req.params.id;
        db.tables['15_Attendance_Shifts'] = (db.tables['15_Attendance_Shifts'] || []).filter(s => s.shift_id !== shiftId);
        saveDatabase(db);
        res.json({ success: true, message: 'Đã xóa ca làm việc!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 7. Requests (Leave / Forgot Checkin / OT)
app.get('/api/attendance/requests', (req, res) => {
    try {
        const db = loadDatabase();
        ensureAttendanceTables(db);
        const empId = req.query.employee_id;
        const status = req.query.status;

        let list = db.tables['18_Attendance_Requests'] || [];
        if (empId) list = list.filter(r => r.employee_id === empId);
        if (status && status !== 'ALL') list = list.filter(r => r.status === status);

        list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        res.json({ success: true, requests: list });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/attendance/requests/submit', (req, res) => {
    try {
        const db = loadDatabase();
        ensureAttendanceTables(db);
        const reqData = req.body;
        if (!reqData.employee_id || !reqData.date || !reqData.request_type) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc (Mã NV, ngày, loại đơn)' });
        }

        const newRequest = {
            request_id: 'REQ-' + Date.now(),
            employee_id: reqData.employee_id,
            full_name: reqData.full_name || '',
            department_name: reqData.department_name || '',
            request_type: reqData.request_type, // LEAVE, FORGOT_CHECKIN, OVERTIME
            leave_type: reqData.leave_type || 'ANNUAL',
            date: reqData.date,
            start_time: reqData.start_time || '',
            end_time: reqData.end_time || '',
            ot_hours: parseFloat(reqData.ot_hours) || 0,
            reason: reqData.reason || '',
            proof_file: reqData.proof_file || '',
            status: 'PENDING',
            created_at: new Date().toISOString()
        };

        db.tables['18_Attendance_Requests'].unshift(newRequest);
        saveDatabase(db);
        res.json({ success: true, message: 'Nộp đơn thành công! Vui lòng chờ quản lý duyệt.', request: newRequest });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/attendance/requests/approve', (req, res) => {
    try {
        const db = loadDatabase();
        ensureAttendanceTables(db);
        const { request_id, status, approver_name, approver_note } = req.body;
        const idx = (db.tables['18_Attendance_Requests'] || []).findIndex(r => r.request_id === request_id);
        if (idx === -1) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn từ' });
        }

        const reqItem = db.tables['18_Attendance_Requests'][idx];
        reqItem.status = status;
        reqItem.approver_name = approver_name || 'Quản lý duyệt';
        reqItem.approver_note = approver_note || '';
        reqItem.updated_at = new Date().toISOString();

        // Tự động tái tính toán bảng công cho ngày này nếu đơn được duyệt
        if (status === 'APPROVED' && reqItem.date && reqItem.employee_id) {
            const emp = (db.tables['03_Employees'] || []).find(e => e.employee_id === reqItem.employee_id);
            if (emp) {
                const dayLogs = (db.tables['17_Attendance_Logs'] || []).filter(l => (l.timestamp || '').startsWith(reqItem.date));
                const approvedReqs = (db.tables['18_Attendance_Requests'] || []).filter(r => r.employee_id === emp.employee_id && r.date === reqItem.date && r.status === 'APPROVED');
                const shifts = db.tables['15_Attendance_Shifts'] || [];
                const defaultShift = shifts[0] || DEFAULT_SHIFTS[0];

                const tsId = `TS_${emp.employee_id}_${reqItem.date}`;
                const computed = calculateDayTimesheet({
                    employee: emp,
                    date: reqItem.date,
                    shift: defaultShift,
                    dayLogs,
                    approvedRequests: approvedReqs
                });

                const tsIdx = (db.tables['19_Attendance_Timesheets'] || []).findIndex(t => t.timesheet_id === tsId);
                if (tsIdx >= 0) {
                    db.tables['19_Attendance_Timesheets'][tsIdx] = computed;
                } else {
                    db.tables['19_Attendance_Timesheets'].push(computed);
                }
            }
        }

        saveDatabase(db);
        res.json({ success: true, message: status === 'APPROVED' ? 'Đã duyệt đơn và tự động cập nhật bảng công!' : 'Đã từ chối đơn!', request: reqItem });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8. Device Management & Ronald Jack 009 Integration
app.get('/api/attendance/devices', (req, res) => {
    try {
        const db = loadDatabase();
        ensureAttendanceTables(db);
        if (!db.tables['20_Attendance_Devices'] || db.tables['20_Attendance_Devices'].length === 0) {
            db.tables['20_Attendance_Devices'] = ronaldJackService.devices.map(d => ({ ...d, location: 'Văn phòng', note: '' }));
            saveDatabase(db);
        }
        res.json({ success: true, devices: db.tables['20_Attendance_Devices'] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/attendance/devices/save', (req, res) => {
    try {
        const db = loadDatabase();
        ensureAttendanceTables(db);
        if (!db.tables['20_Attendance_Devices']) db.tables['20_Attendance_Devices'] = [];

        const { device_id, id, name, device_name, ip, port, location, note, enabled } = req.body;
        const targetId = device_id || id;
        const devName = device_name || name || 'Ronald Jack 009';
        const devIp = (ip || '192.168.1.201').trim();
        const devPort = parseInt(port, 10) || 5005;

        const idx = db.tables['20_Attendance_Devices'].findIndex(d => (d.device_id || d.id) === targetId);
        let savedDev = null;

        if (idx >= 0) {
            const existing = db.tables['20_Attendance_Devices'][idx];
            existing.device_name = devName;
            existing.name = devName;
            existing.ip = devIp;
            existing.port = devPort;
            if (location !== undefined) existing.location = location;
            if (note !== undefined) existing.note = note;
            if (enabled !== undefined) existing.enabled = !!enabled;
            savedDev = existing;
        } else {
            savedDev = {
                device_id: targetId || 'DEV-' + Date.now().toString(36).toUpperCase(),
                device_name: devName,
                name: devName,
                ip: devIp,
                port: devPort,
                location: location || 'Văn phòng chính',
                status: 'ONLINE',
                enabled: enabled !== undefined ? !!enabled : true,
                last_sync: null,
                note: note || 'Thiết bị Ronald Jack 009 thêm thủ công'
            };
            db.tables['20_Attendance_Devices'].push(savedDev);
        }

        saveDatabase(db);

        // Synchronize in-memory ronaldJackService devices
        ronaldJackService.devices = db.tables['20_Attendance_Devices'].map(d => ({
            id: d.device_id || d.id,
            name: d.device_name || d.name,
            ip: d.ip,
            port: d.port,
            in_out_mode: 'AUTO',
            enabled: d.enabled !== false,
            last_sync: d.last_sync,
            status: d.status || 'ONLINE'
        }));

        res.json({ success: true, message: 'Đã lưu cấu hình máy chấm công thành công!', device: savedDev });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi lưu máy chấm công: ' + err.message });
    }
});

app.post('/api/attendance/devices/delete', (req, res) => {
    try {
        const db = loadDatabase();
        ensureAttendanceTables(db);
        const { device_id, id } = req.body;
        const targetId = device_id || id;
        if (!targetId) return res.status(400).json({ success: false, message: 'Thiếu device_id cần xóa' });

        if (db.tables['20_Attendance_Devices']) {
            db.tables['20_Attendance_Devices'] = db.tables['20_Attendance_Devices'].filter(d => (d.device_id || d.id) !== targetId);
            saveDatabase(db);
        }

        ronaldJackService.devices = (db.tables['20_Attendance_Devices'] || []).map(d => ({
            id: d.device_id || d.id,
            name: d.device_name || d.name,
            ip: d.ip,
            port: d.port,
            in_out_mode: 'AUTO',
            enabled: d.enabled !== false,
            last_sync: d.last_sync,
            status: d.status || 'ONLINE'
        }));

        res.json({ success: true, message: `Đã xóa thiết bị ${targetId} thành công!` });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi xóa thiết bị: ' + err.message });
    }
});

app.post('/api/attendance/zk/test-connection', async (req, res) => {
    try {
        const { ip, port } = req.body;
        const result = await ronaldJackService.testConnection(ip, port || 5005);
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi kiểm tra kết nối: ' + err.message });
    }
});

app.post('/api/attendance/zk/sync', async (req, res) => {
    try {
        const db = loadDatabase();
        ensureAttendanceTables(db);
        const logs = await ronaldJackService.pullLogsFromAllDevices();

        let addedCount = 0;
        if (logs && logs.length > 0) {
            const existingLogKeys = new Set((db.tables['17_Attendance_Logs'] || []).map(l => `${l.attendance_code}_${l.timestamp}`));
            logs.forEach(l => {
                const key = `${l.attendance_code}_${l.timestamp}`;
                if (!existingLogKeys.has(key)) {
                    db.tables['17_Attendance_Logs'].push({
                        log_id: 'LOG-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
                        ...l
                    });
                    existingLogKeys.add(key);
                    addedCount++;
                }
            });
            saveDatabase(db);
        }

        res.json({
            success: true,
            message: `Đồng bộ thành công! Kéo được ${logs.length} bản ghi, thêm mới ${addedCount} bản ghi quẹt thẻ.`,
            synced_count: logs.length,
            added_count: addedCount
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi đồng bộ máy chấm công: ' + err.message });
    }
});

app.post('/api/attendance/zk/simulate', (req, res) => {
    try {
        const db = loadDatabase();
        ensureAttendanceTables(db);
        const targetDate = req.body.date || new Date().toISOString().split('T')[0];
        const employees = (db.tables['03_Employees'] || []).filter(e => e.employment_status !== 'Đã nghỉ việc');

        const simLogs = ronaldJackService.generateSimulatedLogs(employees, targetDate);
        const existingKeys = new Set((db.tables['17_Attendance_Logs'] || []).map(l => `${l.attendance_code}_${l.timestamp}`));

        let addedCount = 0;
        simLogs.forEach(l => {
            const key = `${l.attendance_code}_${l.timestamp}`;
            if (!existingKeys.has(key)) {
                db.tables['17_Attendance_Logs'].push({
                    log_id: 'LOG-SIM-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
                    ...l
                });
                existingKeys.add(key);
                addedCount++;
            }
        });

        saveDatabase(db);
        res.json({
            success: true,
            message: `Đã mô phỏng thành công dữ liệu quẹt thẻ thực tế cho ngày ${targetDate} (${addedCount} bản ghi)!`,
            added_count: addedCount,
            total_logs: simLogs.length
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi mô phỏng dữ liệu quẹt thẻ: ' + err.message });
    }
});

// ==========================================
// SYSTEM STATUS ENDPOINT
// ==========================================
app.get('/api/setup/status', (req, res) => {
    res.json({
        success: true,
        is_setup_completed: true,
        storage: 'cloudflare-d1',
        message: 'Hệ thống HRM hoạt động trên nền tảng Cloudflare D1 & R2.'
    });
});

// Fallback to SPA index.html
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`====================================================`);
        console.log(`🚀 HRM WebApp Server running on: http://localhost:${PORT}`);
        console.log(`🏢 TRUNG HAI Human Resource Management System`);
        console.log(`====================================================`);
    });
}

module.exports = app;
