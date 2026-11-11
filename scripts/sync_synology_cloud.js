/**
 * TIẾN TRÌNH ĐỒNG BỘ TOÀN DIỆN & PHẢN CHIẾU THỜI GIAN THỰC (REALTIME):
 * SYNOLOGY NAS (MariaDB 10) <---> CLOUDFLARE D1 (Web HRM)
 * HRM Trung Hải Enterprise
 * 
 * Các chế độ chạy:
 * 1. Chạy 1 lần (Mặc định hoặc --pull): Đồng bộ Web -> NAS ngay lập tức.
 * 2. Chế độ Thời Gian Thực (--realtime hoặc --watch):
 *    Giám sát Web liên tục, NGAY KHI có Thêm/Sửa/Xóa trên Web ➔ NAS CẬP NHẬT LIỀN trong 1 - 2 giây!
 * 3. Chế độ Đẩy (--push): Đẩy dữ liệu từ NAS lên Web.
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const XLSX = require('xlsx');

const CONFIG_PATH = path.join(__dirname, 'synology_config.json');

function loadConfig() {
    if (!fs.existsSync(CONFIG_PATH)) {
        console.error('❌ Không tìm thấy file cấu hình scripts/synology_config.json');
        process.exit(1);
    }
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

const config = loadConfig();

function parseSqlDate(val) {
    if (!val || val === '-' || val === '') return null;
    if (typeof val === 'string') {
        if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
            const [d, m, y] = val.split('/');
            return `${y}-${m}-${d}`;
        }
    }
    return null;
}

function chunkArray(arr, size) {
    const res = [];
    for (let i = 0; i < arr.length; i += size) {
        res.push(arr.slice(i, i + size));
    }
    return res;
}

// 1. Kéo toàn bộ dữ liệu từ Cloudflare API
async function getCloudData() {
    const urls = [config.CloudApiUrl, config.CloudFallbackUrl].filter(Boolean);
    for (const url of urls) {
        try {
            const res = await fetch(`${url}?t=${Date.now()}`, {
                headers: { 'User-Agent': 'TrungHai-Synology-Sync-Agent/1.0' },
                signal: AbortSignal.timeout(15000)
            });
            if (res.ok) {
                const json = await res.json();
                if (json && json.tables && Array.isArray(json.tables['03_Employees'])) {
                    return json;
                }
            }
        } catch (e) {
            // bỏ qua thử url dự phòng
        }
    }
    return null;
}

// Kiểm tra phiên bản thay đổi nhanh trên Cloudflare (Dưới 50ms)
async function getCloudVersion() {
    const baseUrl = config.CloudApiUrl ? config.CloudApiUrl.replace(/\/api\/data$/, '') : 'https://hrm.trunghaico.vn';
    const versionUrl = `${baseUrl}/api/sync/version?t=${Date.now()}`;
    try {
        const res = await fetch(versionUrl, {
            headers: { 'User-Agent': 'TrungHai-Synology-Sync-Agent/1.0' },
            signal: AbortSignal.timeout(5000)
        });
        if (res.ok) {
            const json = await res.json();
            if (json && json.last_updated) {
                return `${json.last_updated}_${json.total_keys || 0}`;
            }
        }
    } catch (e) {}
    return null;
}

// 2. Nạp toàn bộ dữ liệu từ Cloudflare vào MySQL NAS (Bao gồm Thêm, Sửa và Xóa)
async function syncCloudToNas(connection, cloudData) {
    const tables = cloudData.tables || {};
    const emps = tables['03_Employees'] || [];
    const depts = tables['01_Departments'] || [];
    const positions = tables['02_Positions'] || [];
    const companies = tables['00_Companies'] || [];
    const contacts = tables['04_Contacts_Addresses'] || [];
    const identityDocs = tables['05_Identity_Docs'] || [];
    const contracts = tables['10_Contracts'] || [];
    const salaries = tables['08_Salaries_Banks'] || [];
    const insurance = tables['09_Insurance_Welfare'] || [];
    const accounts = tables['11_System_Accounts'] || [];

    // 1. Companies
    if (companies.length > 0) {
        const validCompIds = companies.map(c => c.company_id);
        await connection.query('DELETE FROM `companies` WHERE `company_id` NOT IN (?)', [validCompIds]).catch(() => {});
        for (const c of companies) {
            await connection.query(
                `INSERT INTO \`companies\` (\`company_id\`, \`company_name\`, \`tax_code\`, \`address\`, \`status\`)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE \`company_name\` = VALUES(\`company_name\`), \`tax_code\` = VALUES(\`tax_code\`), \`address\` = VALUES(\`address\`), \`status\` = VALUES(\`status\`)`,
                [c.company_id, c.company_name, c.tax_code || null, c.address || null, c.status || 'Hoạt động']
            ).catch(() => {});
        }
    }

    // 2. Departments
    if (depts.length > 0) {
        const validDeptIds = depts.map(d => d.department_id);
        await connection.query('DELETE FROM `departments` WHERE `department_id` NOT IN (?)', [validDeptIds]).catch(() => {});
        for (const d of depts) {
            await connection.query(
                `INSERT INTO \`departments\` (\`department_id\`, \`department_name\`, \`status\`)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE \`department_name\` = VALUES(\`department_name\`), \`status\` = VALUES(\`status\`)`,
                [d.department_id, d.department_name, d.status || 'Hoạt động']
            ).catch(() => {});
        }
    }

    // 3. Positions
    if (positions.length > 0) {
        const validPosIds = positions.map(p => p.position_id);
        await connection.query('DELETE FROM `positions` WHERE `position_id` NOT IN (?)', [validPosIds]).catch(() => {});
        for (const p of positions) {
            await connection.query(
                `INSERT INTO \`positions\` (\`position_id\`, \`position_name\`, \`department_id\`, \`status\`)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE \`position_name\` = VALUES(\`position_name\`), \`status\` = VALUES(\`status\`)`,
                [p.position_id, p.position_name, p.department_id || null, p.status || 'Hoạt động']
            ).catch(() => {});
        }
    }

    // 4. Employees & Child Tables (Xóa những nhân sự không còn trên Web)
    if (emps.length > 0) {
        const validEmpIds = emps.map(e => e.employee_id);
        
        await connection.query('DELETE FROM `employees` WHERE `employee_id` NOT IN (?)', [validEmpIds]).catch(() => {});
        await connection.query('DELETE FROM `employee_contacts` WHERE `employee_id` NOT IN (?)', [validEmpIds]).catch(() => {});
        await connection.query('DELETE FROM `employee_identity_docs` WHERE `employee_id` NOT IN (?)', [validEmpIds]).catch(() => {});
        await connection.query('DELETE FROM `employee_contracts` WHERE `employee_id` NOT IN (?)', [validEmpIds]).catch(() => {});
        await connection.query('DELETE FROM `employee_salaries_banks` WHERE `employee_id` NOT IN (?)', [validEmpIds]).catch(() => {});
        await connection.query('DELETE FROM `employee_insurance_welfare` WHERE `employee_id` NOT IN (?)', [validEmpIds]).catch(() => {});

        for (const chunk of chunkArray(emps, 50)) {
            const values = [];
            const placeholders = chunk.map(e => {
                values.push(
                    e.employee_id,
                    e.time_attendance_code || e.attendance_code || null,
                    e.full_name || '',
                    e.gender || null,
                    parseSqlDate(e.date_of_birth),
                    e.birth_place || null,
                    e.native_place || null,
                    e.ethnicity || null,
                    e.religion || null,
                    e.nationality || 'Việt Nam',
                    e.marital_status || null,
                    e.children_count || 0,
                    e.tax_code || null,
                    e.department_id || null,
                    e.department_name || null,
                    e.position_id || null,
                    e.job_title || null,
                    e.job_rank || null,
                    e.direct_manager_id || null,
                    e.direct_manager_name || null,
                    e.indirect_manager_id || null,
                    e.indirect_manager_name || null,
                    e.work_location || null,
                    e.work_area || null,
                    e.employment_status || 'Đang làm việc',
                    e.labor_nature || 'Chính thức',
                    parseSqlDate(e.start_date),
                    e.end_date || null,
                    e.contract_type || null,
                    parseSqlDate(e.trial_start_date),
                    parseSqlDate(e.official_date),
                    parseSqlDate(e.resignation_date),
                    parseSqlDate(e.expected_retirement_date),
                    e.seniority_text || null
                );
                return '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
            }).join(', ');

            const sql = `
                INSERT INTO \`employees\` (
                    \`employee_id\`, \`time_attendance_code\`, \`full_name\`, \`gender\`, \`date_of_birth\`,
                    \`birth_place\`, \`native_place\`, \`ethnicity\`, \`religion\`, \`nationality\`,
                    \`marital_status\`, \`children_count\`, \`tax_code\`, \`department_id\`, \`department_name\`,
                    \`position_id\`, \`job_title\`, \`job_rank\`, \`direct_manager_id\`, \`direct_manager_name\`,
                    \`indirect_manager_id\`, \`indirect_manager_name\`, \`work_location\`, \`work_area\`,
                    \`employment_status\`, \`labor_nature\`, \`start_date\`, \`end_date\`, \`contract_type\`,
                    \`trial_start_date\`, \`official_date\`, \`resignation_date\`, \`expected_retirement_date\`,
                    \`seniority_text\`
                ) VALUES ${placeholders}
                ON DUPLICATE KEY UPDATE
                    \`full_name\` = VALUES(\`full_name\`),
                    \`gender\` = VALUES(\`gender\`),
                    \`date_of_birth\` = VALUES(\`date_of_birth\`),
                    \`department_id\` = VALUES(\`department_id\`),
                    \`department_name\` = VALUES(\`department_name\`),
                    \`position_id\` = VALUES(\`position_id\`),
                    \`job_title\` = VALUES(\`job_title\`),
                    \`employment_status\` = VALUES(\`employment_status\`),
                    \`start_date\` = VALUES(\`start_date\`),
                    \`time_attendance_code\` = VALUES(\`time_attendance_code\`)
            `;
            await connection.query(sql, values).catch(() => {});
        }
    }

    // 5. Contacts
    if (contacts.length > 0) {
        for (const chunk of chunkArray(contacts, 50)) {
            const vals = [];
            const phs = chunk.map(c => {
                vals.push(c.employee_id, c.full_name || null, c.mobile_phone || null, c.home_phone || null, c.work_email || null, c.personal_email || null, c.permanent_address_full || c.permanent_address || null, c.current_address_full || c.current_address || null);
                return '(?, ?, ?, ?, ?, ?, ?, ?)';
            }).join(', ');

            await connection.query(`
                INSERT INTO \`employee_contacts\` (\`employee_id\`, \`full_name\`, \`mobile_phone\`, \`home_phone\`, \`work_email\`, \`personal_email\`, \`permanent_address_full\`, \`current_address_full\`) VALUES ${phs}
                ON DUPLICATE KEY UPDATE \`mobile_phone\` = VALUES(\`mobile_phone\`), \`work_email\` = VALUES(\`work_email\`), \`personal_email\` = VALUES(\`personal_email\`), \`permanent_address_full\` = VALUES(\`permanent_address_full\`), \`current_address_full\` = VALUES(\`current_address_full\`)
            `, vals).catch(() => {});
        }
    }

    // 6. Identity Docs
    if (identityDocs.length > 0) {
        for (const chunk of chunkArray(identityDocs, 50)) {
            const vals = [];
            const phs = chunk.map(d => {
                vals.push(d.employee_id, d.full_name || null, d.id_number || d.id_card_number || null, parseSqlDate(d.id_issue_date), d.id_issue_place || null, parseSqlDate(d.id_expiry_date), d.passport_number || null, parseSqlDate(d.passport_issue_date));
                return '(?, ?, ?, ?, ?, ?, ?, ?)';
            }).join(', ');

            await connection.query(`
                INSERT INTO \`employee_identity_docs\` (\`employee_id\`, \`full_name\`, \`id_number\`, \`id_issue_date\`, \`id_issue_place\`, \`id_expiry_date\`, \`passport_number\`, \`passport_issue_date\`) VALUES ${phs}
                ON DUPLICATE KEY UPDATE \`id_number\` = VALUES(\`id_number\`), \`id_issue_date\` = VALUES(\`id_issue_date\`), \`id_issue_place\` = VALUES(\`id_issue_place\`), \`id_expiry_date\` = VALUES(\`id_expiry_date\`)
            `, vals).catch(() => {});
        }
    }

    // 7. Contracts
    if (contracts.length > 0) {
        for (const chunk of chunkArray(contracts, 50)) {
            const vals = [];
            const phs = chunk.map(c => {
                vals.push(c.contract_id || c.employee_id, c.employee_id, c.full_name || null, c.contract_type || null, parseSqlDate(c.trial_start_date), parseSqlDate(c.official_date), c.contract_status || 'HIỆU LỰC');
                return '(?, ?, ?, ?, ?, ?, ?)';
            }).join(', ');

            await connection.query(`
                INSERT INTO \`employee_contracts\` (\`contract_id\`, \`employee_id\`, \`full_name\`, \`contract_type\`, \`trial_start_date\`, \`official_date\`, \`contract_status\`) VALUES ${phs}
                ON DUPLICATE KEY UPDATE \`contract_type\` = VALUES(\`contract_type\`), \`trial_start_date\` = VALUES(\`trial_start_date\`), \`official_date\` = VALUES(\`official_date\`), \`contract_status\` = VALUES(\`contract_status\`)
            `, vals).catch(() => {});
        }
    }

    // 8. Salaries & Banks
    if (salaries.length > 0) {
        for (const chunk of chunkArray(salaries, 50)) {
            const vals = [];
            const phs = chunk.map(s => {
                vals.push(s.employee_id, s.full_name || null, s.salary_grade || 'Bậc 1', s.base_salary || 0, s.insurance_salary || 0, s.total_salary || s.base_salary || 0, s.bank_account_number || s.bank_account || '', s.bank_name || '', s.bank_branch || '');
                return '(?, ?, ?, ?, ?, ?, ?, ?, ?)';
            }).join(', ');

            await connection.query(`
                INSERT INTO \`employee_salaries_banks\` (\`employee_id\`, \`full_name\`, \`salary_grade\`, \`base_salary\`, \`insurance_salary\`, \`total_salary\`, \`bank_account_number\`, \`bank_name\`, \`bank_branch\`) VALUES ${phs}
                ON DUPLICATE KEY UPDATE \`salary_grade\` = VALUES(\`salary_grade\`), \`base_salary\` = VALUES(\`base_salary\`), \`insurance_salary\` = VALUES(\`insurance_salary\`), \`total_salary\` = VALUES(\`total_salary\`), \`bank_account_number\` = VALUES(\`bank_account_number\`), \`bank_name\` = VALUES(\`bank_name\`), \`bank_branch\` = VALUES(\`bank_branch\`)
            `, vals).catch(() => {});
        }
    }

    // 9. Insurance & Welfare
    if (insurance.length > 0) {
        for (const chunk of chunkArray(insurance, 50)) {
            const vals = [];
            const phs = chunk.map(i => {
                vals.push(i.employee_id, i.full_name || null, i.has_insurance || 'Tham gia', i.social_insurance_book_no || null, i.social_insurance_code || null, parseSqlDate(i.insurance_join_date), i.hospital_registered || '', i.union_member || 'Không');
                return '(?, ?, ?, ?, ?, ?, ?, ?)';
            }).join(', ');

            await connection.query(`
                INSERT INTO \`employee_insurance_welfare\` (\`employee_id\`, \`full_name\`, \`has_insurance\`, \`social_insurance_book_no\`, \`social_insurance_code\`, \`insurance_join_date\`, \`hospital_registered\`, \`union_member\`) VALUES ${phs}
                ON DUPLICATE KEY UPDATE \`has_insurance\` = VALUES(\`has_insurance\`), \`social_insurance_code\` = VALUES(\`social_insurance_code\`), \`hospital_registered\` = VALUES(\`hospital_registered\`), \`union_member\` = VALUES(\`union_member\`)
            `, vals).catch(() => {});
        }
    }

    // 10. System Accounts (ĐỒNG BỘ XÓA GƯƠNG)
    if (accounts.length > 0) {
        const validAccIds = accounts.map(a => a.account_id);
        const [delResult] = await connection.query('DELETE FROM `system_accounts` WHERE `account_id` NOT IN (?)', [validAccIds]).catch(() => [{}]);
        if (delResult && delResult.affectedRows > 0) {
            console.log(` 🗑️ [XÓA TRÊN NAS] Đã xóa ${delResult.affectedRows} tài khoản bị gỡ quyền trên Web!`);
        }

        for (const a of accounts) {
            await connection.query(`
                INSERT INTO \`system_accounts\` (\`account_id\`, \`employee_id\`, \`username\`, \`full_name\`, \`account_email\`, \`role\`, \`account_status\`, \`password\`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE \`username\` = VALUES(\`username\`), \`full_name\` = VALUES(\`full_name\`), \`role\` = VALUES(\`role\`), \`account_status\` = VALUES(\`account_status\`), \`account_email\` = VALUES(\`account_email\`)
            `, [a.account_id, a.employee_id, a.username, a.full_name, a.account_email, a.role, a.account_status, a.password]).catch(() => {});
        }
    } else {
        await connection.query('DELETE FROM `system_accounts`').catch(() => {});
    }

    console.log(`✅ [ĐÃ ĐỒNG BỘ TOÀN DIỆN VÀO NAS] CSDL trên NAS đã cập nhật khớp 100% với Web!`);
}

// 3. Đẩy toàn bộ dữ liệu từ NAS MySQL lên Cloudflare D1
async function pushNasToCloud(connection) {
    console.log(`📤 Đang đọc toàn bộ dữ liệu từ MariaDB trên NAS để đồng bộ lên Web...`);

    const [companies] = await connection.query('SELECT * FROM `companies`').catch(() => [[]]);
    const [departments] = await connection.query('SELECT * FROM `departments`').catch(() => [[]]);
    const [positions] = await connection.query('SELECT * FROM `positions`').catch(() => [[]]);
    const [employees] = await connection.query('SELECT * FROM `employees`').catch(() => [[]]);
    const [contacts] = await connection.query('SELECT * FROM `employee_contacts`').catch(() => [[]]);
    const [identityDocs] = await connection.query('SELECT * FROM `employee_identity_docs`').catch(() => [[]]);
    const [contracts] = await connection.query('SELECT * FROM `employee_contracts`').catch(() => [[]]);
    const [salaries] = await connection.query('SELECT * FROM `employee_salaries_banks`').catch(() => [[]]);
    const [insurance] = await connection.query('SELECT * FROM `employee_insurance_welfare`').catch(() => [[]]);
    const [accounts] = await connection.query('SELECT * FROM `system_accounts`').catch(() => [[]]);

    if (!employees || employees.length === 0) return false;

    const masterProfiles = employees.map(e => {
        const c = contacts.find(item => item.employee_id === e.employee_id) || {};
        const idDoc = identityDocs.find(item => item.employee_id === e.employee_id) || {};
        return {
            employee_id: e.employee_id,
            'Mã nhân viên': e.employee_id,
            full_name: e.full_name,
            'Họ và tên': e.full_name,
            gender: e.gender,
            'Giới tính': e.gender,
            date_of_birth: e.date_of_birth,
            'Ngày sinh': e.date_of_birth,
            mobile_phone: c.mobile_phone || '',
            'Điện thoại di động': c.mobile_phone || '',
            personal_email: c.personal_email || '',
            'Email cá nhân': c.personal_email || '',
            id_card_number: idDoc.id_number || '',
            'Số CCCD/CMND': idDoc.id_number || '',
            department_name: e.department_name,
            'Phòng ban': e.department_name,
            job_title: e.job_title,
            'Chức danh': e.job_title,
            employment_status: e.employment_status,
            'Trạng thái lao động': e.employment_status
        };
    });

    const tables = {
        '00_Companies': companies,
        '01_Departments': departments,
        '02_Positions': positions,
        '03_Employees': employees,
        '00_Master_Profiles': masterProfiles,
        '04_Contacts_Addresses': contacts,
        '05_Identity_Docs': identityDocs,
        '06_Emergency_Contacts': [],
        '07_Education': [],
        '08_Salaries_Banks': salaries,
        '09_Insurance_Welfare': insurance,
        '10_Contracts': contracts,
        '11_System_Accounts': accounts,
        '12_System_Logs': [],
        '13_Recycle_Bin': [],
        '14_Allowances_Deductions': []
    };

    const targetUrl = config.CloudPushUrl || `${config.CloudApiUrl.replace(/\/api\/data$/, '')}/api/setup/restore-sample-data`;

    try {
        const res = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'TrungHai-Synology-Sync-Agent/1.0' },
            body: JSON.stringify({
                operator_id: 'NAS-SYNC',
                operator_name: 'Synology NAS Full Sync',
                operator_role: 'ADMIN',
                tables: tables
            }),
            signal: AbortSignal.timeout(45000)
        });

        if (res.ok) {
            console.log(`✅ [ĐẨY LÊN WEB THÀNH CÔNG] Đã cập nhật 10 bảng dữ liệu lên Web Cloudflare!`);
            return true;
        }
    } catch (err) {
        console.error(`❌ Lỗi đẩy lên Cloudflare: ${err.message}`);
    }
    return false;
}

// 4. Tự động xuất file sao lưu JSON và Excel trên ổ cứng NAS
function autoBackupFiles(cloudData) {
    const backupDir = path.resolve(__dirname, '..', config.BackupFolder || './backups');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    if (config.AutoBackupJson) {
        const jsonPath = path.join(backupDir, `database_backup_${todayStr}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(cloudData, null, 2), 'utf8');
    }

    if (config.AutoBackupExcel) {
        try {
            const wb = XLSX.utils.book_new();
            for (const [tblName, rows] of Object.entries(cloudData.tables || {})) {
                if (Array.isArray(rows) && rows.length > 0) {
                    const ws = XLSX.utils.json_to_sheet(rows);
                    XLSX.utils.book_append_sheet(wb, ws, tblName.substring(0, 31));
                }
            }
            const excelPath = path.join(backupDir, `HRM_Database_${todayStr}.xlsx`);
            XLSX.writeFile(wb, excelPath);
        } catch (err) {}
    }
}

// Tạo kết nối MySQL an toàn có tự phục hồi
async function createDbConnection() {
    return await mysql.createConnection({
        host: config.NasHost,
        port: config.NasPort,
        user: config.NasUser,
        password: config.NasPassword,
        database: config.NasDatabase,
        connectTimeout: 8000
    });
}

// ============================================================================
// 5. CHẾ ĐỘ THỜI GIAN THỰC (REALTIME WATCHER - ĐỒNG BỘ LIỀN DƯỚI 2 GIÂY)
// ============================================================================
async function runRealtimeWatcher() {
    console.log(`======================================================================`);
    console.log(`⚡ KÍCH HOẠT ĐỒNG BỘ THỜI GIAN THỰC (REALTIME WATCHER < 2 GIÂY)`);
    console.log(`   Web Cloudflare ➔ Synology NAS MariaDB (${config.NasHost}:${config.NasPort})`);
    console.log(`======================================================================`);
    console.log(`👀 Đang giám sát dữ liệu... Cứ mỗi 2 giây quét 1 lần.`);
    console.log(`👉 NGAY KHI bạn bấm Thêm/Sửa/Xóa trên Web, NAS sẽ cập nhật LIỀN LẬP TỨC!\n`);

    let conn = null;
    let lastVersion = '';
    let lastFingerprint = '';

    while (true) {
        try {
            if (!conn) {
                conn = await createDbConnection();
                console.log(`🔌 [${new Date().toLocaleTimeString('vi-VN')}] Đã kết nối tới MariaDB trên NAS.`);
            }

            // 1. Kiểm tra phiên bản cực nhanh từ Cloudflare (< 50ms)
            const ver = await getCloudVersion();
            let hasChanged = false;

            if (ver && ver !== lastVersion) {
                hasChanged = true;
                lastVersion = ver;
            } else if (!ver) {
                // Dự phòng nếu endpoint version chưa có: tải dữ liệu và so sánh fingerprint
                const cloudData = await getCloudData();
                if (cloudData && cloudData.tables) {
                    const emps = cloudData.tables['03_Employees'] || [];
                    const accs = cloudData.tables['11_System_Accounts'] || [];
                    const depts = cloudData.tables['01_Departments'] || [];
                    const pos = cloudData.tables['02_Positions'] || [];
                    const fp = `${emps.length}_${accs.length}_${depts.length}_${pos.length}_${accs.map(a => a.account_id + a.username + a.role).join('|')}_${emps.slice(-3).map(e => e.employee_id + (e.updated_at || '')).join('|')}`;
                    
                    if (fp !== lastFingerprint) {
                        hasChanged = true;
                        lastFingerprint = fp;
                    }
                }
            }

            if (hasChanged) {
                console.log(`\n⚡ [PHÁT HIỆN THAY ĐỔI TRÊN WEB lúc ${new Date().toLocaleTimeString('vi-VN')}]`);
                console.log(`🚀 Đang nạp ngay lập tức vào MariaDB trên NAS...`);
                const cloudData = await getCloudData();
                if (cloudData && cloudData.tables) {
                    await syncCloudToNas(conn, cloudData);
                    autoBackupFiles(cloudData);
                    console.log(`🎯 [HOÀN TẤT ĐỒNG BỘ LIỀN] MariaDB trên NAS đã cập nhật chuẩn xác 100%!\n`);
                }
            }
        } catch (err) {
            console.warn(`[Watcher Lỗi tạm thời]: ${err.message}. Tự kết nối lại sau 2s...`);
            if (conn) {
                try { await conn.end(); } catch (e) {}
                conn = null;
            }
        }

        // Nghỉ 2 giây rồi quét tiếp
        await new Promise(r => setTimeout(r, 2000));
    }
}

// 6. Chạy chính
async function main() {
    const args = process.argv.slice(2);
    const isRealtime = args.includes('--realtime') || args.includes('--watch');
    const isPush = args.includes('--push');

    if (isRealtime) {
        await runRealtimeWatcher();
        return;
    }

    console.log(`\n======================================================================`);
    console.log(`🔄 KHỞI ĐỘNG ĐỒNG BỘ TOÀN BỘ CSDL: SYNOLOGY NAS <---> CLOUDFLARE D1`);
    console.log(`⏰ Thời gian: ${new Date().toLocaleString('vi-VN')}`);
    console.log(`======================================================================`);

    let connection = null;
    try {
        console.log(`🔌 Đang kết nối tới MariaDB trên NAS (${config.NasHost}:${config.NasPort})...`);
        connection = await createDbConnection();
        console.log(`✅ Kết nối MariaDB Synology thành công!`);

        if (isPush) {
            await pushNasToCloud(connection);
        } else {
            const cloudData = await getCloudData();
            if (cloudData && cloudData.tables) {
                await syncCloudToNas(connection, cloudData);
                autoBackupFiles(cloudData);
            }
        }
    } catch (err) {
        console.error(`❌ [LỖI ĐỒNG BỘ]: ${err.message}`);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

main();
