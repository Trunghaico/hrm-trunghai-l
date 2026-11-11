/**
 * NAS DIRECT API SERVER - HRM TRUNG HẢI
 * Kết nối trực tiếp MariaDB 10 / MySQL trên Synology NAS
 * Phục vụ dữ liệu nhân sự thời gian thực cho Web HRM
 */

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Cấu hình kết nối MySQL trên Synology NAS
const CONFIG_FILE = path.join(__dirname, 'scripts', 'synology_config.json');
let dbConfig = {
    host: process.env.NAS_HOST || '127.0.0.1',
    port: parseInt(process.env.NAS_PORT || '3306', 10),
    user: process.env.NAS_USER || 'root',
    password: process.env.NAS_PASSWORD || '',
    database: process.env.NAS_DATABASE || 'hrm_trunghai',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

if (fs.existsSync(CONFIG_FILE)) {
    try {
        const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        dbConfig.host = cfg.NasHost || dbConfig.host;
        dbConfig.port = cfg.NasPort || dbConfig.port;
        dbConfig.user = cfg.NasUser || dbConfig.user;
        dbConfig.password = cfg.NasPassword !== undefined ? cfg.NasPassword : dbConfig.password;
        dbConfig.database = cfg.NasDatabase || dbConfig.database;
        console.log(`[Config] Đã nạp cấu hình từ ${CONFIG_FILE}`);
    } catch (e) {
        console.warn('[Config] Lỗi đọc synology_config.json:', e.message);
    }
}

// Khởi tạo MySQL Connection Pool
let pool = null;
function getPool() {
    if (!pool) {
        pool = mysql.createPool(dbConfig);
    }
    return pool;
}

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 1. Kiểm tra trạng thái kết nối (Health Check)
app.get('/api/health', async (req, res) => {
    try {
        const p = getPool();
        const [rows] = await p.query('SELECT 1 as connected');
        const [empCount] = await p.query('SELECT COUNT(*) as total FROM employees');
        res.json({
            status: 'online',
            service: 'Synology NAS HRM API',
            database: dbConfig.database,
            host: dbConfig.host,
            total_employees: empCount[0].total,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            message: 'Không thể kết nối đến MySQL trên NAS',
            error: err.message
        });
    }
});

// 2. Lấy toàn bộ dữ liệu database cho Web HRM (/api/data)
app.get('/api/data', async (req, res) => {
    try {
        const p = getPool();

        // Truy vấn dữ liệu từ các bảng trong MySQL NAS
        const [companies] = await p.query('SELECT * FROM companies').catch(() => [[]]);
        const [departments] = await p.query('SELECT * FROM departments').catch(() => [[]]);
        const [positions] = await p.query('SELECT * FROM positions').catch(() => [[]]);
        const [employees] = await p.query('SELECT * FROM employees').catch(() => [[]]);
        const [profiles] = await p.query('SELECT * FROM employee_profiles').catch(() => [[]]);
        const [family] = await p.query('SELECT * FROM employee_family_contacts').catch(() => [[]]);
        const [identityDocs] = await p.query('SELECT * FROM employee_identity_docs').catch(() => [[]]);
        const [contracts] = await p.query('SELECT * FROM employee_contracts').catch(() => [[]]);
        const [salaries] = await p.query('SELECT * FROM employee_salaries').catch(() => [[]]);
        const [insurance] = await p.query('SELECT * FROM employee_insurance').catch(() => [[]]);
        const [accounts] = await p.query('SELECT * FROM system_accounts').catch(() => [[]]);

        // Đóng gói cấu trúc tables đúng định dạng Web HRM yêu cầu
        const tables = {
            '00_Companies': companies,
            '01_Departments': departments,
            '02_Positions': positions,
            '03_Employees': employees,
            '00_Master_Profiles': profiles,
            '04_Contacts_Addresses': profiles.map(p => ({
                employee_id: p.employee_id,
                current_address: p.current_address || '',
                permanent_address: p.permanent_address || '',
                personal_email: p.personal_email || '',
                mobile_phone: p.phone || ''
            })),
            '05_Identity_Docs': identityDocs,
            '06_Emergency_Contacts': family,
            '07_Education': [],
            '08_Salaries_Banks': salaries,
            '09_Insurance_Welfare': insurance,
            '10_Contracts': contracts,
            '11_System_Accounts': accounts,
            '12_System_Logs': [],
            '13_Recycle_Bin': [],
            '14_Allowances_Deductions': []
        };

        const companyInfo = companies.length > 0 ? {
            brand_name: companies[0].company_name || 'TRUNG HẢI',
            full_name: companies[0].company_name || 'CÔNG TY CỔ PHẦN ĐẦU TƯ VÀ XÂY DỰNG TRUNG HẢI',
            tax_code: companies[0].tax_code || '',
            address: companies[0].address || ''
        } : {
            brand_name: 'TRUNG HẢI',
            full_name: 'CÔNG TY CỔ PHẦN ĐẦU TƯ VÀ XÂY DỰNG TRUNG HẢI'
        };

        res.json({
            success: true,
            source: 'SYNOLOGY_NAS_MYSQL',
            total_employees: employees.length,
            company: companyInfo,
            tables: tables,
            last_updated: new Date().toISOString()
        });
    } catch (err) {
        console.error('[API /api/data] Lỗi truy vấn MySQL:', err);
        res.status(500).json({
            success: false,
            message: 'Lỗi truy vấn cơ sở dữ liệu trên Synology NAS',
            error: err.message
        });
    }
});

// 3. Khởi động máy chủ API
app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`🚀 HRM SYNOLOGY NAS API SERVER ĐANG CHẠY TẠI PORT ${PORT}`);
    console.log(`👉 Kiểm tra kết nối: http://localhost:${PORT}/api/health`);
    console.log(`👉 Dữ liệu đầy đủ:  http://localhost:${PORT}/api/data`);
    console.log(`👉 Kết nối MySQL:   ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    console.log(`=======================================================`);
});

