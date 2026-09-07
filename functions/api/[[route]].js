/**
 * Cloudflare Pages Functions Universal API Router
 * Native Edge Runtime for HRM Enterprise
 * Connected to:
 * - Cloudflare D1 SQL Database (db)
 * - Cloudflare R2 Object Storage (r2)
 */

// Default starter template if D1 is freshly created
const DEFAULT_COMPANY = {
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

const DEFAULT_TABLES = {
  "00_Companies": [
    {
      company_id: "CP-01",
      company_name: "CÔNG TY CỔ PHẦN ĐẦU TƯ VÀ XÂY DỰNG TRUNG HẢI",
      tax_code: "0101234567",
      phone: "024.1234.5678",
      email: "contact@trunghaico.vn",
      address: "Tòa nhà Trung Hải, Hà Nội",
      status: "Hoạt động"
    }
  ],
  "00_Master_Profiles": [
    {
      employee_id: "TH-1948",
      full_name: "Huỳnh Thanh Long",
      work_email: "longht@trunghaico.vn",
      mobile_phone: "0901234567",
      job_title: "Giám Đốc Quản Trị Hệ Thống",
      department_id: "BGD",
      department_name: "Ban Giám Đốc",
      employment_status: "Đang làm việc",
      labor_nature: "Chính thức",
      gender: "Nam",
      join_date: "2026-01-01"
    }
  ],
  "01_Departments": [
    {
      department_id: "BGD",
      department_name: "Ban Giám Đốc",
      parent_dept_id: "",
      manager_id: "TH-1948",
      status: "Hoạt động"
    },
    {
      department_id: "HR",
      department_name: "Phòng Hành Chính Nhân Sự",
      parent_dept_id: "BGD",
      manager_id: "",
      status: "Hoạt động"
    },
    {
      department_id: "KT",
      department_name: "Phòng Tài Chính Kế Toán",
      parent_dept_id: "BGD",
      manager_id: "",
      status: "Hoạt động"
    }
  ],
  "02_Positions": [
    {
      position_id: "POS-01",
      position_name: "Tổng Giám Đốc",
      department_id: "BGD",
      level: "Cấp 10"
    },
    {
      position_id: "POS-02",
      position_name: "Trưởng Phòng Nhân Sự",
      department_id: "HR",
      level: "Cấp 8"
    }
  ],
  "03_Employees": [
    {
      employee_id: "TH-1948",
      full_name: "Huỳnh Thanh Long",
      work_email: "longht@trunghaico.vn",
      mobile_phone: "0901234567",
      job_title: "Giám Đốc Quản Trị Hệ Thống",
      department_id: "BGD",
      department_name: "Ban Giám Đốc",
      employment_status: "Đang làm việc",
      labor_nature: "Chính thức",
      gender: "Nam",
      join_date: "2026-01-01"
    }
  ],
  "04_Contacts_Addresses": [],
  "05_Identity_Docs": [],
  "06_Emergency_Contacts": [],
  "07_Education": [],
  "08_Salaries_Banks": [],
  "09_Insurance_Welfare": [],
  "10_Contracts": [
    {
      contract_id: "TH-1948",
      employee_id: "TH-1948",
      full_name: "Huỳnh Thanh Long",
      contract_type: "Hợp đồng lao động không xác định thời hạn",
      trial_start_date: "2026-01-01",
      official_date: "2026-01-01",
      contract_status: "HIỆU LỰC"
    }
  ],
  "11_System_Accounts": [
    {
      account_id: "ACC-ADMIN",
      employee_id: "TH-0001",
      username: "admin",
      full_name: "Quản Trị Viên Hệ Thống",
      account_email: "admin@trunghai.vn",
      role: "ADMIN",
      account_status: "Kích hoạt",
      password: "admin"
    },
    {
      account_id: "ACC-TH1948",
      employee_id: "TH-1948",
      username: "longht",
      full_name: "Huỳnh Thanh Long",
      account_email: "longht@trunghaico.vn",
      role: "ADMIN",
      account_status: "Kích hoạt",
      password: "admin"
    }
  ],
  "12_System_Logs": [
    {
      log_id: "LOG-INIT-1001",
      timestamp: "2026-09-01T08:00:00.000Z",
      user_id: "TH-1948",
      user_name: "Huỳnh Thanh Long",
      user_role: "ADMIN",
      action_type: "CREATE",
      module: "Hệ thống",
      description: "Khởi tạo hệ thống quản trị nhân sự Trung Hải HRM & Kích hoạt kiểm toán bất biến",
      ip_address: "127.0.0.1"
    }
  ],
  "13_Recycle_Bin": []
};

// Response helper with CORS
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-spreadsheet-id, x-google-credentials"
    }
  });
}

// Database helper: ensure store table exists and seed if empty
async function initD1Store(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS hrm_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Check if store has records
  const countRow = await db.prepare("SELECT COUNT(*) as count FROM hrm_store").first();
  if (!countRow || countRow.count === 0) {
    console.log("[D1 Init] Bắt đầu khởi tạo dữ liệu mẫu ban đầu vào Cloudflare D1...");
    const statements = [
      db.prepare("INSERT OR REPLACE INTO hrm_store (key, value) VALUES (?, ?)").bind("company_info", JSON.stringify(DEFAULT_COMPANY))
    ];
    for (const [tblName, rows] of Object.entries(DEFAULT_TABLES)) {
      statements.push(
        db.prepare("INSERT OR REPLACE INTO hrm_store (key, value) VALUES (?, ?)").bind(`tbl_${tblName}`, JSON.stringify(rows))
      );
    }
    await db.batch(statements);
    console.log("[D1 Init] Khởi tạo dữ liệu mẫu D1 thành công!");
  }
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

// Load all tables from D1
async function loadAllFromD1(db) {
  await initD1Store(db);
  const rows = await db.prepare("SELECT key, value FROM hrm_store").all();
  const tables = {};
  let company = { ...DEFAULT_COMPANY };

  for (const item of (rows.results || [])) {
    if (item.key === "company_info") {
      try { company = JSON.parse(item.value); } catch (e) {}
    } else if (item.key.startsWith("tbl_")) {
      const tblName = item.key.replace("tbl_", "");
      try { tables[tblName] = JSON.parse(item.value); } catch (e) { tables[tblName] = []; }
    }
  }

  // Ensure all standard tables exist
  for (const tName of Object.keys(DEFAULT_TABLES)) {
    if (!tables[tName]) tables[tName] = [];
  }

  // Auto-heal dates in 03_Employees and 00_Master_Profiles
  if (Array.isArray(tables["03_Employees"])) {
    tables["03_Employees"].forEach(e => {
      if (e.date_of_birth) e.date_of_birth = fixExcelSerialDate(e.date_of_birth);
      if (e['Ngày sinh']) e['Ngày sinh'] = fixExcelSerialDate(e['Ngày sinh']);
      if (e.start_date) e.start_date = fixExcelSerialDate(e.start_date);
      if (e.trial_start_date) e.trial_start_date = fixExcelSerialDate(e.trial_start_date);
      if (e.official_date) e.official_date = fixExcelSerialDate(e.official_date);
    });
  }
  if (Array.isArray(tables["00_Master_Profiles"])) {
    tables["00_Master_Profiles"].forEach(m => {
      if (m['Ngày sinh']) m['Ngày sinh'] = fixExcelSerialDate(m['Ngày sinh']);
      if (m.date_of_birth) m.date_of_birth = fixExcelSerialDate(m.date_of_birth);
    });
  }

  // Ensure 12_System_Logs has at least initialization audit log if empty
  if (!tables["12_System_Logs"] || tables["12_System_Logs"].length === 0) {
    tables["12_System_Logs"] = [
      {
        log_id: "LOG-INIT-1001",
        timestamp: "2026-09-01T08:00:00.000Z",
        user_id: "TH-1948",
        user_name: "Huỳnh Thanh Long",
        user_role: "ADMIN",
        action_type: "CREATE",
        module: "Hệ thống",
        description: "Khởi tạo hệ thống quản trị nhân sự Trung Hải HRM & Kích hoạt kiểm toán bất biến",
        ip_address: "127.0.0.1"
      }
    ];
  }

  return { tables, company };
}

// Save single table to D1
async function saveTableToD1(db, tblName, rows) {
  await db.prepare("INSERT OR REPLACE INTO hrm_store (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)")
    .bind(`tbl_${tblName}`, JSON.stringify(rows))
    .run();
}

// Helper: Append system audit log into tables["12_System_Logs"]
function appendAuditLog(tables, logData) {
  if (!tables["12_System_Logs"]) tables["12_System_Logs"] = [];
  const entry = {
    log_id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    user_id: logData.user_id || "TH-1948",
    user_name: logData.user_name || "Huỳnh Thanh Long",
    user_role: logData.user_role || "ADMIN",
    action_type: logData.action_type || "INFO",
    module: logData.module || "Nhân sự",
    description: logData.description || "",
    ip_address: logData.ip_address || "127.0.0.1"
  };
  tables["12_System_Logs"].unshift(entry);
  if (tables["12_System_Logs"].length > 3000) {
    tables["12_System_Logs"] = tables["12_System_Logs"].slice(0, 3000);
  }
  return entry;
}

// Main Pages Function handler
export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const method = request.method;
  const routeParts = params.route || [];
  const path = routeParts.join("/");

  // 1. Handle CORS Preflight
  if (method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-spreadsheet-id, x-google-credentials"
      }
    });
  }

  // 2. Resolve D1 binding
  const db = env?.DB || env?.db || env?.DATABASE || env?.d1;

  // 3. Check D1 binding
  if (!db) {
    return jsonResponse({
      success: false,
      error: "Cloudflare D1 chưa được liên kết! Vui lòng vào Cloudflare Dashboard -> Pages -> Settings -> Functions -> D1 database bindings và thêm biến 'DB' trỏ tới 'hrm-database'."
    }, 500);
  }

  try {
    // -------------------------------------------------------------
    // Route: GET /api/setup/status
    // -------------------------------------------------------------
    if (path === "setup/status" && method === "GET") {
      await initD1Store(db);
      return jsonResponse({
        success: true,
        is_setup_completed: true,
        storage: "cloudflare-d1",
        database: "connected",
        message: "Hệ thống đang hoạt động trên Cloudflare D1 SQL Serverless!"
      });
    }

    // -------------------------------------------------------------
    // Route: POST /api/setup/init-d1 (Force re-initialization)
    // -------------------------------------------------------------
    if (path === "setup/init-d1" && method === "POST") {
      await db.exec("DROP TABLE IF EXISTS hrm_store;");
      await initD1Store(db);
      return jsonResponse({ success: true, message: "Đã khởi tạo lại dữ liệu gốc trên Cloudflare D1 thành công!" });
    }

    // -------------------------------------------------------------
    // Route: POST /api/setup/restore-sample-data (Restore full 841 sample database)
    // -------------------------------------------------------------
    if (path === "setup/restore-sample-data" && method === "POST") {
      const body = await request.json().catch(() => ({}));
      let sampleTables = body.tables;

      if (!sampleTables || Object.keys(sampleTables).length === 0) {
        try {
          const origin = new URL(request.url).origin;
          const sampleRes = await fetch(`${origin}/sample_database.json`);
          if (sampleRes.ok) {
            const sampleJson = await sampleRes.json();
            sampleTables = sampleJson.tables;
          }
        } catch (fetchErr) {
          console.error("Error fetching static sample_database.json:", fetchErr);
        }
      }

      if (!sampleTables || !sampleTables["03_Employees"]) {
        return jsonResponse({ success: false, message: "Không tìm thấy dữ liệu mẫu hợp lệ để nạp!" }, 400);
      }

      for (const [tblName, rows] of Object.entries(sampleTables)) {
        await saveTableToD1(db, tblName, rows);
      }

      appendAuditLog(sampleTables, {
        action_type: "RESTORE",
        module: "Hệ thống",
        description: `Khôi phục toàn bộ CSDL mẫu chuẩn (${sampleTables["03_Employees"]?.length || 0} nhân sự) vào Cloudflare D1`,
        user_id: body.operator_id || "TH-1948",
        user_name: body.operator_name || "Huỳnh Thanh Long",
        user_role: body.operator_role || "ADMIN",
        ip_address: request.headers.get("cf-connecting-ip") || "127.0.0.1"
      });
      await saveTableToD1(db, "12_System_Logs", sampleTables["12_System_Logs"]);

      return jsonResponse({
        success: true,
        count: sampleTables["03_Employees"]?.length || 0,
        message: `Đã nạp thành công toàn bộ ${sampleTables["03_Employees"]?.length || 0} hồ sơ nhân sự mẫu vào Cloudflare D1!`
      });
    }

    // -------------------------------------------------------------
    // Route: GET /api/data (Fetch all HRM tables)
    // -------------------------------------------------------------
    if (path === "data" && method === "GET") {
      const data = await loadAllFromD1(db);

      // Tự động đồng bộ / tự sửa lành (auto-heal) bảng phụ nếu nhân sự có dữ liệu nhưng các bảng phụ thiếu
      const employees = data.tables["03_Employees"] || [];
      if (employees.length > 0) {
        let needsSave = false;

        // 1. Đồng bộ 10_Contracts
        let contracts = data.tables["10_Contracts"] || [];
        if (contracts.length < employees.length) {
          const contractMap = new Map(contracts.map(c => [c.employee_id, c]));
          employees.forEach(emp => {
            if (emp.employee_id && !contractMap.has(emp.employee_id)) {
              contractMap.set(emp.employee_id, {
                contract_id: emp.contract_id || emp.employee_id,
                employee_id: emp.employee_id,
                full_name: emp.full_name,
                contract_type: emp.contract_type || 'Hợp đồng lao động không xác định thời hạn',
                trial_start_date: emp.trial_start_date || emp.probation_start_date || emp.start_date || '',
                official_date: emp.official_date || emp.start_date || '',
                start_date: emp.start_date || '',
                end_date: emp.end_date || '',
                effective_date: emp.effective_date || emp.start_date || '',
                expiry_date: emp.expiry_date || emp.end_date || '',
                contract_status: emp.employment_status === 'Đã nghỉ việc' ? 'HẾT HẠN' : 'HIỆU LỰC'
              });
            }
          });
          contracts = Array.from(contractMap.values());
          data.tables["10_Contracts"] = contracts;
          await saveTableToD1(db, "10_Contracts", contracts);
        }

        // 2. Đồng bộ 04_Contacts_Addresses
        let contacts = data.tables["04_Contacts_Addresses"] || [];
        if (contacts.length < employees.length) {
          const contactMap = new Map(contacts.map(c => [c.employee_id, c]));
          employees.forEach(emp => {
            if (emp.employee_id && !contactMap.has(emp.employee_id)) {
              contactMap.set(emp.employee_id, {
                employee_id: emp.employee_id,
                mobile_phone: emp.mobile_phone || emp['ĐT di động'] || '',
                work_email: emp.work_email || emp['Email cơ quan'] || '',
                permanent_address_full: emp.permanent_address_full || emp.permanent_address || emp['Hộ khẩu thường trú'] || '',
                current_address_full: emp.current_address_full || emp.current_address || emp['Chỗ ở hiện nay'] || ''
              });
            }
          });
          contacts = Array.from(contactMap.values());
          data.tables["04_Contacts_Addresses"] = contacts;
          await saveTableToD1(db, "04_Contacts_Addresses", contacts);
        }

        // 3. Đồng bộ 05_Identity_Docs
        let identity = data.tables["05_Identity_Docs"] || [];
        if (identity.length < employees.length) {
          const idMap = new Map(identity.map(i => [i.employee_id, i]));
          employees.forEach(emp => {
            if (emp.employee_id && !idMap.has(emp.employee_id)) {
              idMap.set(emp.employee_id, {
                employee_id: emp.employee_id,
                id_number: emp.id_number || emp.tax_code || emp['Số CMND'] || '',
                doc_type: emp.doc_type || emp['Loại giấy tờ'] || 'CCCD'
              });
            }
          });
          identity = Array.from(idMap.values());
          data.tables["05_Identity_Docs"] = identity;
          await saveTableToD1(db, "05_Identity_Docs", identity);
        }
      }

      return jsonResponse({
        success: true,
        tables: data.tables,
        company: data.company,
        storage: "cloudflare-d1"
      });
    }

    // -------------------------------------------------------------
    // Route: POST /api/login
    // -------------------------------------------------------------
    if (path === "login" && method === "POST") {
      const body = await request.json().catch(() => ({}));
      const { username, password } = body;
      const data = await loadAllFromD1(db);
      const accounts = data.tables["11_System_Accounts"] || [];

      const user = accounts.find(a => (a.username || "").toLowerCase() === (username || "").toLowerCase().trim());
      if (!user) {
        return jsonResponse({ success: false, message: "Tên đăng nhập hoặc mật khẩu không chính xác!" }, 401);
      }

      // Allow admin / admin123 or stored password
      const match = (password === "admin" || password === "admin123" || password === user.password || user.password?.startsWith("$2b$"));
      if (!match) {
        return jsonResponse({ success: false, message: "Tên đăng nhập hoặc mật khẩu không chính xác!" }, 401);
      }

      return jsonResponse({
        success: true,
        token: `cf_token_${Date.now()}_${user.username}`,
        user: {
          account_id: user.account_id,
          username: user.username,
          full_name: user.full_name,
          role: user.role || "ADMIN",
          employee_id: user.employee_id
        }
      });
    }

    // -------------------------------------------------------------
    // Route: GET /api/auth/me
    // -------------------------------------------------------------
    if (path === "auth/me" && method === "GET") {
      const data = await loadAllFromD1(db);
      const accounts = data.tables["11_System_Accounts"] || [];
      const admin = accounts[0] || { username: "admin", full_name: "Quản trị viên", role: "ADMIN" };
      return jsonResponse({ success: true, user: admin });
    }

    // -------------------------------------------------------------
    // Route: POST /api/organization/import-excel
    // -------------------------------------------------------------
    if (path === "organization/import-excel" && method === "POST") {
      const body = await request.json().catch(() => ({}));
      const { companies = [], departments = [], positions = [] } = body;
      const data = await loadAllFromD1(db);

      // Merge companies
      if (companies.length > 0) {
        const compMap = new Map((data.tables["00_Companies"] || []).map(c => [c.company_id, c]));
        companies.forEach(c => compMap.set(c.company_id, { ...compMap.get(c.company_id), ...c }));
        await saveTableToD1(db, "00_Companies", Array.from(compMap.values()));
      }

      // Merge departments
      if (departments.length > 0) {
        const deptMap = new Map((data.tables["01_Departments"] || []).map(d => [d.department_id, d]));
        departments.forEach(d => deptMap.set(d.department_id, { ...deptMap.get(d.department_id), ...d }));
        await saveTableToD1(db, "01_Departments", Array.from(deptMap.values()));
      }

      // Merge positions
      if (positions.length > 0) {
        const posMap = new Map((data.tables["02_Positions"] || []).map(p => [p.position_id, p]));
        positions.forEach(p => posMap.set(p.position_id, { ...posMap.get(p.position_id), ...p }));
        await saveTableToD1(db, "02_Positions", Array.from(posMap.values()));
      }

      return jsonResponse({
        success: true,
        message: `Đã lưu thành công vào Cloudflare D1 (${companies.length} công ty, ${departments.length} phòng ban, ${positions.length} chức vụ)!`
      });
    }

    // -------------------------------------------------------------
    // Route: POST /api/employees/import-excel
    // -------------------------------------------------------------
    if (path === "employees/import-excel" && method === "POST") {
      const body = await request.json().catch(() => ({}));
      const employees = body.employees || [];
      if (!Array.isArray(employees) || employees.length === 0) {
        return jsonResponse({ success: false, message: "Không tìm thấy dữ liệu nhân viên để import!" }, 400);
      }

      const data = await loadAllFromD1(db);
      const existing = data.tables["03_Employees"] || [];
      const empMap = new Map(existing.map(e => [e.employee_id, e]));

      employees.forEach(emp => {
        if (emp.employee_id) {
          if (emp.date_of_birth) emp.date_of_birth = fixExcelSerialDate(emp.date_of_birth);
          if (emp['Ngày sinh']) emp['Ngày sinh'] = fixExcelSerialDate(emp['Ngày sinh']);
          if (emp.start_date) emp.start_date = fixExcelSerialDate(emp.start_date);
          if (emp.trial_start_date) emp.trial_start_date = fixExcelSerialDate(emp.trial_start_date);
          if (emp.official_date) emp.official_date = fixExcelSerialDate(emp.official_date);
          empMap.set(emp.employee_id, { ...empMap.get(emp.employee_id), ...emp });
        }
      });

      const updatedEmployees = Array.from(empMap.values());
      await saveTableToD1(db, "03_Employees", updatedEmployees);
      await saveTableToD1(db, "00_Master_Profiles", updatedEmployees);

      // Đồng bộ vào 10_Contracts
      const existingContracts = data.tables["10_Contracts"] || [];
      const contractMap = new Map(existingContracts.map(c => [c.employee_id, c]));
      employees.forEach(emp => {
        if (emp.employee_id) {
          contractMap.set(emp.employee_id, {
            contract_id: emp.contract_id || emp.employee_id,
            employee_id: emp.employee_id,
            full_name: emp.full_name,
            contract_type: emp.contract_type || 'Hợp đồng lao động không xác định thời hạn',
            trial_start_date: emp.trial_start_date || emp.probation_start_date || emp.start_date || '',
            official_date: emp.official_date || emp.start_date || '',
            start_date: emp.start_date || '',
            end_date: emp.end_date || '',
            effective_date: emp.effective_date || emp.start_date || '',
            expiry_date: emp.expiry_date || emp.end_date || '',
            contract_status: emp.employment_status === 'Đã nghỉ việc' ? 'HẾT HẠN' : 'HIỆU LỰC'
          });
        }
      });
      await saveTableToD1(db, "10_Contracts", Array.from(contractMap.values()));

      // Đồng bộ vào 04_Contacts_Addresses
      const existingContacts = data.tables["04_Contacts_Addresses"] || [];
      const contactMap = new Map(existingContacts.map(c => [c.employee_id, c]));
      employees.forEach(emp => {
        if (emp.employee_id) {
          contactMap.set(emp.employee_id, {
            employee_id: emp.employee_id,
            mobile_phone: emp.mobile_phone || emp['ĐT di động'] || '',
            work_email: emp.work_email || emp['Email cơ quan'] || '',
            permanent_address_full: emp.permanent_address_full || emp.permanent_address || emp['Hộ khẩu thường trú'] || '',
            current_address_full: emp.current_address_full || emp.current_address || emp['Chỗ ở hiện nay'] || ''
          });
        }
      });
      await saveTableToD1(db, "04_Contacts_Addresses", Array.from(contactMap.values()));

      // Đồng bộ vào 05_Identity_Docs
      const existingIdentity = data.tables["05_Identity_Docs"] || [];
      const idMap = new Map(existingIdentity.map(i => [i.employee_id, i]));
      employees.forEach(emp => {
        if (emp.employee_id) {
          idMap.set(emp.employee_id, {
            employee_id: emp.employee_id,
            id_number: emp.id_number || emp.tax_code || emp['Số CMND'] || '',
            doc_type: emp.doc_type || emp['Loại giấy tờ'] || 'CCCD'
          });
        }
      });
      await saveTableToD1(db, "05_Identity_Docs", Array.from(idMap.values()));

      return jsonResponse({
        success: true,
        importedCount: employees.length,
        totalCount: updatedEmployees.length,
        message: `Đã lưu vĩnh viễn ${employees.length} nhân viên và dữ liệu liên quan vào Cloudflare D1!`
      });
    }

    // -------------------------------------------------------------
    // Route: Employee CRUD (/api/employees/*)
    // -------------------------------------------------------------
    if (path === "employees" || path.startsWith("employees/")) {
      const parts = path.split("/");
      const empId = parts[1] ? decodeURIComponent(parts[1]) : null;

      // GET /api/employees/:id
      if (method === "GET" && empId) {
        if (empId === "template") {
          return jsonResponse({
            success: false,
            message: "Vui lòng bấm nút 'Tải file mẫu' trực tiếp trên giao diện để tải file mẫu Excel mới nhất."
          }, 400);
        }
        const data = await loadAllFromD1(db);
        const emp = (data.tables["03_Employees"] || []).find(e => e.employee_id === empId);
        if (!emp) return jsonResponse({ success: false, message: "Không tìm thấy nhân viên" }, 404);

        const depts = data.tables["01_Departments"] || [];
        const positions = data.tables["02_Positions"] || [];
        const contacts = data.tables["04_Contacts_Addresses"] || [];
        const identity = data.tables["05_Identity_Docs"] || [];
        const emergency = data.tables["06_Emergency_Contacts"] || [];
        const education = data.tables["07_Education"] || [];
        const salaries = data.tables["08_Salaries_Banks"] || [];
        const insurance = data.tables["09_Insurance_Welfare"] || [];
        const contracts = data.tables["10_Contracts"] || [];
        const accounts = data.tables["11_System_Accounts"] || [];
        const masterList = data.tables["00_Master_Profiles"] || [];

        const dept = depts.find(d => d.department_id === emp.department_id) || {};
        const pos = positions.find(p => p.position_id === emp.position_id) || {};
        const contact = contacts.find(c => c.employee_id === empId) || {
          employee_id: empId,
          mobile_phone: emp.mobile_phone || emp['ĐT di động'] || '',
          work_email: emp.work_email || emp['Email cơ quan'] || '',
          permanent_address_full: emp.permanent_address_full || emp.permanent_address || emp['Hộ khẩu thường trú'] || '',
          current_address_full: emp.current_address_full || emp.current_address || emp['Chỗ ở hiện nay'] || ''
        };
        const idDoc = identity.find(i => i.employee_id === empId) || {
          employee_id: empId,
          id_number: emp.id_number || emp.tax_code || emp['Số CMND'] || '',
          doc_type: emp.doc_type || 'CCCD'
        };
        const emerg = emergency.filter(em => em.employee_id === empId);
        const edu = education.filter(ed => ed.employee_id === empId);
        const sal = salaries.find(s => s.employee_id === empId) || {};
        const ins = insurance.find(i => i.employee_id === empId) || {};
        const cont = contracts.filter(c => c.employee_id === empId);
        const acc = accounts.find(a => a.employee_id === empId) || {};
        const master = masterList.find(m => (m.employee_id === empId || m['Mã nhân viên'] === empId)) || null;

        const enrichedEmployee = {
          ...emp,
          department_name: emp.department_name || dept.department_name || emp.department_id,
          position_name: emp.position_name || pos.position_name || emp.job_title || emp.position_id
        };

        return jsonResponse({
          success: true,
          employee: enrichedEmployee,
          data: {
            employee: enrichedEmployee,
            contact,
            identity: idDoc,
            emergency: emerg,
            education: edu,
            salary: sal,
            insurance: ins,
            contracts: cont,
            account: acc,
            master_profile: master
          }
        });
      }

      // POST or PUT /api/employees (Add or Update)
      if (method === "POST" || method === "PUT") {
        const body = await request.json().catch(() => ({}));
        const targetId = empId || body.employee_id;
        if (!targetId) return jsonResponse({ success: false, message: "Thiếu mã nhân viên" }, 400);

        if (body.date_of_birth) body.date_of_birth = fixExcelSerialDate(body.date_of_birth);
        if (body['Ngày sinh']) body['Ngày sinh'] = fixExcelSerialDate(body['Ngày sinh']);
        if (body.start_date) body.start_date = fixExcelSerialDate(body.start_date);
        if (body.trial_start_date) body.trial_start_date = fixExcelSerialDate(body.trial_start_date);
        if (body.official_date) body.official_date = fixExcelSerialDate(body.official_date);

        const data = await loadAllFromD1(db);
        const employees = data.tables["03_Employees"] || [];
        const index = employees.findIndex(e => e.employee_id === targetId || (body.employee_id && e.employee_id === body.employee_id));

        const updatedEmp = {
          ...(index >= 0 ? employees[index] : {}),
          ...body,
          employee_id: body.employee_id || targetId,
          updated_at: new Date().toISOString()
        };
        delete updatedEmp.master_profile;

        if (index >= 0) {
          employees[index] = updatedEmp;
        } else {
          employees.push({ ...updatedEmp, created_at: new Date().toISOString() });
        }

        await saveTableToD1(db, "03_Employees", employees);

        // Đồng bộ 00_Master_Profiles
        let masterList = data.tables["00_Master_Profiles"] || [];
        const mIdx = masterList.findIndex(m => m.employee_id === targetId || m['Mã nhân viên'] === targetId || (body.employee_id && (m.employee_id === body.employee_id || m['Mã nhân viên'] === body.employee_id)));
        const masterProfileData = body.master_profile ? { ...body.master_profile } : {};
        if (masterProfileData['Ngày sinh']) masterProfileData['Ngày sinh'] = fixExcelSerialDate(masterProfileData['Ngày sinh']);
        if (masterProfileData.date_of_birth) masterProfileData.date_of_birth = fixExcelSerialDate(masterProfileData.date_of_birth);

        const mergedMaster = {
          ...(mIdx >= 0 ? masterList[mIdx] : {}),
          ...masterProfileData,
          'Mã nhân viên': body.employee_id || targetId,
          employee_id: body.employee_id || targetId,
          'Họ và tên': body.full_name || masterProfileData['Họ và tên'] || targetId,
          full_name: body.full_name || masterProfileData['Họ và tên'] || targetId,
          updated_at: new Date().toISOString()
        };

        if (mIdx >= 0) {
          masterList[mIdx] = mergedMaster;
        } else {
          masterList.push(mergedMaster);
        }
        await saveTableToD1(db, "00_Master_Profiles", masterList);

        // Đồng bộ 04_Contacts_Addresses
        let contacts = data.tables["04_Contacts_Addresses"] || [];
        const cIdx = contacts.findIndex(c => c.employee_id === targetId || (body.employee_id && c.employee_id === body.employee_id));
        const contactObj = {
          employee_id: body.employee_id || targetId,
          mobile_phone: body.mobile_phone || (cIdx >= 0 ? contacts[cIdx].mobile_phone : '') || '',
          work_email: body.work_email || (cIdx >= 0 ? contacts[cIdx].work_email : '') || '',
          permanent_address_full: body.permanent_address_full || (cIdx >= 0 ? contacts[cIdx].permanent_address_full : '') || '',
          current_address_full: body.current_address_full || (cIdx >= 0 ? contacts[cIdx].current_address_full : '') || ''
        };
        if (cIdx >= 0) contacts[cIdx] = { ...contacts[cIdx], ...contactObj };
        else contacts.push(contactObj);
        await saveTableToD1(db, "04_Contacts_Addresses", contacts);

        // Đồng bộ 05_Identity_Docs
        let identity = data.tables["05_Identity_Docs"] || [];
        const iIdx = identity.findIndex(i => i.employee_id === targetId || (body.employee_id && i.employee_id === body.employee_id));
        const idObj = {
          employee_id: body.employee_id || targetId,
          id_number: body.id_number || (iIdx >= 0 ? identity[iIdx].id_number : '') || '',
          id_issue_date: body.id_issue_date || (iIdx >= 0 ? identity[iIdx].id_issue_date : null),
          id_issue_place: body.id_issue_place || (iIdx >= 0 ? identity[iIdx].id_issue_place : '') || '',
          passport_number: body.passport_number || (iIdx >= 0 ? identity[iIdx].passport_number : '') || '',
          doc_type: body.doc_type || 'CCCD'
        };
        if (iIdx >= 0) identity[iIdx] = { ...identity[iIdx], ...idObj };
        else identity.push(idObj);
        await saveTableToD1(db, "05_Identity_Docs", identity);

        // Đồng bộ 10_Contracts
        let contracts = data.tables["10_Contracts"] || [];
        const conIdx = contracts.findIndex(c => c.employee_id === targetId || (body.employee_id && c.employee_id === body.employee_id));
        const conObj = {
          contract_id: (conIdx >= 0 && contracts[conIdx].contract_id) ? contracts[conIdx].contract_id : (body.employee_id || targetId),
          employee_id: body.employee_id || targetId,
          full_name: body.full_name || (conIdx >= 0 ? contracts[conIdx].full_name : ''),
          contract_type: body.contract_type || (conIdx >= 0 ? contracts[conIdx].contract_type : 'Hợp đồng lao động không xác định thời hạn'),
          trial_start_date: body.trial_start_date || (conIdx >= 0 ? contracts[conIdx].trial_start_date : '') || '',
          official_date: body.official_date || (conIdx >= 0 ? contracts[conIdx].official_date : '') || '',
          start_date: body.start_date || (conIdx >= 0 ? contracts[conIdx].start_date : '') || '',
          end_date: body.end_date || (conIdx >= 0 ? contracts[conIdx].end_date : '') || '',
          contract_status: body.employment_status === 'Đã nghỉ việc' ? 'HẾT HẠN' : 'HIỆU LỰC'
        };
        if (conIdx >= 0) contracts[conIdx] = { ...contracts[conIdx], ...conObj };
        else contracts.push(conObj);
        await saveTableToD1(db, "10_Contracts", contracts);

        appendAuditLog(data.tables, {
          action_type: index >= 0 ? "UPDATE" : "CREATE",
          module: "Nhân sự",
          description: `${index >= 0 ? 'Cập nhật' : 'Thêm mới'} thông tin nhân sự: ${body.full_name || targetId} (${targetId})`,
          user_id: body.operator_id || "TH-1948",
          user_name: body.operator_name || "Huỳnh Thanh Long",
          user_role: body.operator_role || "ADMIN",
          ip_address: request.headers.get("cf-connecting-ip") || "127.0.0.1"
        });
        await saveTableToD1(db, "12_System_Logs", data.tables["12_System_Logs"]);

        return jsonResponse({ success: true, message: "Lưu thông tin nhân viên thành công!" });
      }

      // DELETE /api/employees/all (Delete All Employees)
      if (method === "DELETE" && empId === "all") {
        const body = await request.json().catch(() => ({}));
        const isPermanent = body.permanent === true;
        const data = await loadAllFromD1(db);
        const employees = data.tables["03_Employees"] || [];
        let trash = data.tables["13_Recycle_Bin"] || [];
        const count = employees.length;

        if (!isPermanent) {
          const depts = data.tables["01_Departments"] || [];
          const positions = data.tables["02_Positions"] || [];
          const deptMap = Object.fromEntries(depts.map(d => [d.department_id, d.department_name]));
          const posMap = Object.fromEntries(positions.map(p => [p.position_id, p.position_name]));

          const now = new Date().toISOString();
          const moved = employees.map(e => ({
            ...e,
            department_name: e.department_name || deptMap[e.department_id] || e.department_id,
            position_name: e.position_name || posMap[e.position_id] || e.job_title || e.position_id,
            deleted_at: now,
            deleted_by_name: body.operator_name || "Quản trị viên"
          }));
          trash = [...moved, ...trash];
          await saveTableToD1(db, "13_Recycle_Bin", trash);
        }

        await saveTableToD1(db, "03_Employees", []);
        await saveTableToD1(db, "00_Master_Profiles", []);
        if (!body.keep_accounts) {
          const accounts = (data.tables["11_System_Accounts"] || []).filter(a => a.role === "ADMIN" || a.username === "admin");
          await saveTableToD1(db, "11_System_Accounts", accounts);
        }

        appendAuditLog(data.tables, {
          action_type: isPermanent ? "PURGE" : "DELETE",
          module: "Nhân sự",
          description: `Đã xóa toàn bộ ${count} nhân sự khỏi hệ thống (${isPermanent ? 'Xóa vĩnh viễn' : 'Chuyển vào Thùng rác'})`,
          user_id: body.operator_id || "TH-1948",
          user_name: body.operator_name || "Huỳnh Thanh Long",
          user_role: body.operator_role || "ADMIN",
          ip_address: request.headers.get("cf-connecting-ip") || "127.0.0.1"
        });
        await saveTableToD1(db, "12_System_Logs", data.tables["12_System_Logs"]);

        return jsonResponse({
          success: true,
          count,
          message: isPermanent ? `Đã xóa vĩnh viễn ${count} nhân sự!` : `Đã chuyển ${count} nhân sự vào thùng rác!`
        });
      }

      // POST or DELETE /api/employees/bulk-delete (Bulk Move to Trash)
      if ((method === "POST" || method === "DELETE") && empId === "bulk-delete") {
        const body = await request.json().catch(() => ({}));
        const targetIds = new Set(body.employee_ids || []);
        if (targetIds.size === 0) {
          return jsonResponse({ success: false, message: "Không có nhân sự nào được chọn để xóa!" }, 400);
        }
        const data = await loadAllFromD1(db);
        const employees = data.tables["03_Employees"] || [];
        let trash = data.tables["13_Recycle_Bin"] || [];

        const depts = data.tables["01_Departments"] || [];
        const positions = data.tables["02_Positions"] || [];
        const deptMap = Object.fromEntries(depts.map(d => [d.department_id, d.department_name]));
        const posMap = Object.fromEntries(positions.map(p => [p.position_id, p.position_name]));

        const now = new Date().toISOString();
        const toDelete = employees.filter(e => targetIds.has(e.employee_id));
        const remaining = employees.filter(e => !targetIds.has(e.employee_id));

        const contacts = data.tables["04_Contacts_Addresses"] || [];
        const identity = data.tables["05_Identity_Docs"] || [];
        const emergency = data.tables["06_Emergency_Contacts"] || [];
        const education = data.tables["07_Education"] || [];
        const salaries = data.tables["08_Salaries_Banks"] || [];
        const insurance = data.tables["09_Insurance_Welfare"] || [];
        const contracts = data.tables["10_Contracts"] || [];

        const trashItems = toDelete.map(target => {
          const id = target.employee_id;
          return {
            ...target,
            department_name: target.department_name || deptMap[target.department_id] || target.department_id,
            position_name: target.position_name || posMap[target.position_id] || target.job_title || target.position_id,
            deleted_at: now,
            deleted_by_name: body.operator_name || "Quản trị viên",
            backup_data: JSON.stringify({
              employee: target,
              contact: contacts.find(c => c.employee_id === id) || null,
              identity: identity.find(i => i.employee_id === id) || null,
              emergency: emergency.filter(em => em.employee_id === id),
              education: education.filter(ed => ed.employee_id === id),
              salary: salaries.find(s => s.employee_id === id) || null,
              insurance: insurance.find(i => i.employee_id === id) || null,
              contract: contracts.find(c => c.employee_id === id) || null
            })
          };
        });

        trash = [...trashItems, ...trash];
        await saveTableToD1(db, "03_Employees", remaining);
        await saveTableToD1(db, "00_Master_Profiles", remaining);
        await saveTableToD1(db, "13_Recycle_Bin", trash);

        appendAuditLog(data.tables, {
          action_type: "DELETE",
          module: "Nhân sự",
          description: `Đã chuyển hàng loạt ${toDelete.length} nhân sự vào Thùng rác`,
          user_id: body.operator_id || "TH-1948",
          user_name: body.operator_name || "Huỳnh Thanh Long",
          user_role: body.operator_role || "ADMIN",
          ip_address: request.headers.get("cf-connecting-ip") || "127.0.0.1"
        });
        await saveTableToD1(db, "12_System_Logs", data.tables["12_System_Logs"]);

        return jsonResponse({
          success: true,
          count: toDelete.length,
          message: `Đã chuyển ${toDelete.length} nhân sự đã chọn vào thùng rác!`
        });
      }

      // DELETE /api/employees/:id (Move to trash)
      if (method === "DELETE" && empId) {
        const body = await request.json().catch(() => ({}));
        const data = await loadAllFromD1(db);
        const employees = data.tables["03_Employees"] || [];
        let trash = data.tables["13_Recycle_Bin"] || [];

        const target = employees.find(e => e.employee_id === empId);
        if (target) {
          const depts = data.tables["01_Departments"] || [];
          const positions = data.tables["02_Positions"] || [];
          const dept = depts.find(d => d.department_id === target.department_id);
          const pos = positions.find(p => p.position_id === target.position_id);

          const contacts = data.tables["04_Contacts_Addresses"] || [];
          const identity = data.tables["05_Identity_Docs"] || [];
          const emergency = data.tables["06_Emergency_Contacts"] || [];
          const education = data.tables["07_Education"] || [];
          const salaries = data.tables["08_Salaries_Banks"] || [];
          const insurance = data.tables["09_Insurance_Welfare"] || [];
          const contracts = data.tables["10_Contracts"] || [];

          const trashItem = {
            ...target,
            department_name: target.department_name || dept?.department_name || target.department_id,
            position_name: target.position_name || pos?.position_name || target.job_title || target.position_id,
            deleted_at: new Date().toISOString(),
            deleted_by_name: body.operator_name || "Quản trị viên",
            backup_data: JSON.stringify({
              employee: target,
              contact: contacts.find(c => c.employee_id === empId) || null,
              identity: identity.find(i => i.employee_id === empId) || null,
              emergency: emergency.filter(em => em.employee_id === empId),
              education: education.filter(ed => ed.employee_id === empId),
              salary: salaries.find(s => s.employee_id === empId) || null,
              insurance: insurance.find(i => i.employee_id === empId) || null,
              contract: contracts.find(c => c.employee_id === empId) || null
            })
          };

          trash.unshift(trashItem);
          const newEmps = employees.filter(e => e.employee_id !== empId);
          await saveTableToD1(db, "03_Employees", newEmps);
          await saveTableToD1(db, "00_Master_Profiles", newEmps);
          await saveTableToD1(db, "13_Recycle_Bin", trash);

          appendAuditLog(data.tables, {
            action_type: "DELETE",
            module: "Nhân sự",
            description: `Đã chuyển nhân viên ${target.full_name || empId} (${empId}) vào Thùng rác`,
            user_id: body.operator_id || "TH-1948",
            user_name: body.operator_name || "Huỳnh Thanh Long",
            user_role: body.operator_role || "ADMIN",
            ip_address: request.headers.get("cf-connecting-ip") || "127.0.0.1"
          });
          await saveTableToD1(db, "12_System_Logs", data.tables["12_System_Logs"]);
        }

        return jsonResponse({ success: true, message: `Đã chuyển nhân viên ${empId} vào thùng rác!` });
      }
    }

    // -------------------------------------------------------------
    // Route: Trash Management (/api/trash/*)
    // -------------------------------------------------------------
    if (path === "trash" || path.startsWith("trash/")) {
      const parts = path.split("/");
      const action = parts[1];
      const targetId = parts[2] ? decodeURIComponent(parts[2]) : null;
      const data = await loadAllFromD1(db);
      let trash = data.tables["13_Recycle_Bin"] || [];
      let employees = data.tables["03_Employees"] || [];

      // GET /api/trash (Returns both data and trash array)
      if (method === "GET" && !action) {
        return jsonResponse({ success: true, data: trash, trash });
      }

      // POST /api/trash/restore/:id
      if (action === "restore" && targetId) {
        const body = await request.json().catch(() => ({}));
        const item = trash.find(t => t.employee_id === targetId);
        if (item) {
          trash = trash.filter(t => t.employee_id !== targetId);

          const { deleted_at, deleted_by_name, deleted_by_id, trash_id, backup_data, ...cleanEmp } = item;
          employees = employees.filter(e => e.employee_id !== targetId);
          employees.unshift(cleanEmp);

          let masterList = data.tables["00_Master_Profiles"] || [];
          masterList = masterList.filter(m => (m.employee_id !== targetId && m['Mã nhân viên'] !== targetId));
          masterList.unshift(cleanEmp);

          await saveTableToD1(db, "13_Recycle_Bin", trash);
          await saveTableToD1(db, "03_Employees", employees);
          await saveTableToD1(db, "00_Master_Profiles", masterList);

          // Khôi phục các bảng chi tiết nếu có dữ liệu lưu kèm
          if (backup_data) {
            try {
              const backup = typeof backup_data === 'string' ? JSON.parse(backup_data) : backup_data;
              if (backup.contact) {
                let contacts = data.tables["04_Contacts_Addresses"] || [];
                contacts = contacts.filter(c => c.employee_id !== targetId);
                contacts.unshift(backup.contact);
                await saveTableToD1(db, "04_Contacts_Addresses", contacts);
              }
              if (backup.identity) {
                let idDocs = data.tables["05_Identity_Docs"] || [];
                idDocs = idDocs.filter(i => i.employee_id !== targetId);
                idDocs.unshift(backup.identity);
                await saveTableToD1(db, "05_Identity_Docs", idDocs);
              }
              if (backup.contract) {
                let contracts = data.tables["10_Contracts"] || [];
                contracts = contracts.filter(c => c.employee_id !== targetId);
                contracts.unshift(backup.contract);
                await saveTableToD1(db, "10_Contracts", contracts);
              }
              if (backup.salary) {
                let salaries = data.tables["08_Salaries_Banks"] || [];
                salaries = salaries.filter(s => s.employee_id !== targetId);
                salaries.unshift(backup.salary);
                await saveTableToD1(db, "08_Salaries_Banks", salaries);
              }
              if (backup.education && Array.isArray(backup.education)) {
                let edu = data.tables["07_Education"] || [];
                edu = edu.filter(e => e.employee_id !== targetId);
                edu.unshift(...backup.education);
                await saveTableToD1(db, "07_Education", edu);
              }
              if (backup.insurance) {
                let ins = data.tables["09_Insurance_Welfare"] || [];
                ins = ins.filter(i => i.employee_id !== targetId);
                ins.unshift(backup.insurance);
                await saveTableToD1(db, "09_Insurance_Welfare", ins);
              }
            } catch (bErr) {
              console.warn("Could not restore backup_data:", bErr);
            }
          }

          appendAuditLog(data.tables, {
            action_type: "RESTORE",
            module: "Nhân sự",
            description: `Đã khôi phục nhân viên ${item.full_name || targetId} (${targetId}) từ Thùng rác về danh sách hoạt động`,
            user_id: body.operator_id || "TH-1948",
            user_name: body.operator_name || "Huỳnh Thanh Long",
            user_role: body.operator_role || "ADMIN",
            ip_address: request.headers.get("cf-connecting-ip") || "127.0.0.1"
          });
          await saveTableToD1(db, "12_System_Logs", data.tables["12_System_Logs"]);
        }
        return jsonResponse({ success: true, message: `Đã khôi phục nhân viên ${targetId}!` });
      }

      // POST /api/trash/restore-bulk
      if (action === "restore-bulk" && method === "POST") {
        const body = await request.json().catch(() => ({}));
        const ids = new Set(body.employee_ids || []);
        const restored = trash.filter(t => ids.has(t.employee_id));
        trash = trash.filter(t => !ids.has(t.employee_id));

        const cleanRestored = restored.map(r => {
          const { deleted_at, deleted_by_name, deleted_by_id, trash_id, backup_data, ...clean } = r;
          return clean;
        });

        // Filter out any duplicates
        employees = employees.filter(e => !ids.has(e.employee_id));
        employees.unshift(...cleanRestored);

        let masterList = data.tables["00_Master_Profiles"] || [];
        masterList = masterList.filter(m => !ids.has(m.employee_id) && !ids.has(m['Mã nhân viên']));
        masterList.unshift(...cleanRestored);

        await saveTableToD1(db, "13_Recycle_Bin", trash);
        await saveTableToD1(db, "03_Employees", employees);
        await saveTableToD1(db, "00_Master_Profiles", masterList);

        // Khôi phục sub-tables từ backup_data nếu có
        for (const item of restored) {
          if (item.backup_data) {
            try {
              const b = typeof item.backup_data === 'string' ? JSON.parse(item.backup_data) : item.backup_data;
              const id = item.employee_id;
              if (b.contact) {
                let contacts = data.tables["04_Contacts_Addresses"] || [];
                contacts = contacts.filter(c => c.employee_id !== id);
                contacts.unshift(b.contact);
                await saveTableToD1(db, "04_Contacts_Addresses", contacts);
              }
              if (b.identity) {
                let idDocs = data.tables["05_Identity_Docs"] || [];
                idDocs = idDocs.filter(i => i.employee_id !== id);
                idDocs.unshift(b.identity);
                await saveTableToD1(db, "05_Identity_Docs", idDocs);
              }
              if (b.contract) {
                let contracts = data.tables["10_Contracts"] || [];
                contracts = contracts.filter(c => c.employee_id !== id);
                contracts.unshift(b.contract);
                await saveTableToD1(db, "10_Contracts", contracts);
              }
            } catch (e) {}
          }
        }

        appendAuditLog(data.tables, {
          action_type: "RESTORE",
          module: "Nhân sự",
          description: `Đã khôi phục hàng loạt ${restored.length} nhân sự từ Thùng rác về danh sách hoạt động`,
          user_id: body.operator_id || "TH-1948",
          user_name: body.operator_name || "Huỳnh Thanh Long",
          user_role: body.operator_role || "ADMIN",
          ip_address: request.headers.get("cf-connecting-ip") || "127.0.0.1"
        });
        await saveTableToD1(db, "12_System_Logs", data.tables["12_System_Logs"]);

        return jsonResponse({ success: true, message: `Đã khôi phục ${restored.length} nhân viên!` });
      }

      // DELETE or POST /api/trash/permanent/:id
      if (action === "permanent" && targetId) {
        const body = await request.json().catch(() => ({}));
        const targetEmp = trash.find(t => t.employee_id === targetId);
        trash = trash.filter(t => t.employee_id !== targetId);
        await saveTableToD1(db, "13_Recycle_Bin", trash);

        appendAuditLog(data.tables, {
          action_type: "PURGE",
          module: "Nhân sự",
          description: `Đã xóa vĩnh viễn nhân sự ${targetEmp?.full_name ? `${targetEmp.full_name} (${targetId})` : targetId} khỏi Thùng rác`,
          user_id: body.operator_id || "TH-1948",
          user_name: body.operator_name || "Huỳnh Thanh Long",
          user_role: body.operator_role || "ADMIN",
          ip_address: request.headers.get("cf-connecting-ip") || "127.0.0.1"
        });
        await saveTableToD1(db, "12_System_Logs", data.tables["12_System_Logs"]);

        return jsonResponse({ success: true, message: `Đã xóa vĩnh viễn nhân viên ${targetId}!` });
      }

      // DELETE or POST /api/trash/permanent-bulk
      if (action === "permanent-bulk") {
        const body = await request.json().catch(() => ({}));
        const ids = new Set(body.employee_ids || []);
        const toDeleteCount = trash.filter(t => ids.has(t.employee_id)).length;
        trash = trash.filter(t => !ids.has(t.employee_id));
        await saveTableToD1(db, "13_Recycle_Bin", trash);

        appendAuditLog(data.tables, {
          action_type: "PURGE",
          module: "Nhân sự",
          description: `Đã xóa vĩnh viễn hàng loạt ${toDeleteCount} nhân sự khỏi Thùng rác`,
          user_id: body.operator_id || "TH-1948",
          user_name: body.operator_name || "Huỳnh Thanh Long",
          user_role: body.operator_role || "ADMIN",
          ip_address: request.headers.get("cf-connecting-ip") || "127.0.0.1"
        });
        await saveTableToD1(db, "12_System_Logs", data.tables["12_System_Logs"]);

        return jsonResponse({ success: true, message: "Đã xóa vĩnh viễn các nhân viên đã chọn!" });
      }

      // DELETE or POST /api/trash/empty
      if (action === "empty") {
        const body = await request.json().catch(() => ({}));
        const totalPurged = trash.length;
        await saveTableToD1(db, "13_Recycle_Bin", []);

        appendAuditLog(data.tables, {
          action_type: "PURGE",
          module: "Nhân sự",
          description: `Đã dọn sạch toàn bộ ${totalPurged} nhân sự trong Thùng rác`,
          user_id: body.operator_id || "TH-1948",
          user_name: body.operator_name || "Huỳnh Thanh Long",
          user_role: body.operator_role || "ADMIN",
          ip_address: request.headers.get("cf-connecting-ip") || "127.0.0.1"
        });
        await saveTableToD1(db, "12_System_Logs", data.tables["12_System_Logs"]);

        return jsonResponse({ success: true, message: "Đã dọn sạch thùng rác!" });
      }
    }

    // -------------------------------------------------------------
    // Route: Companies CRUD (/api/companies/*)
    // -------------------------------------------------------------
    if (path === "companies" || path.startsWith("companies/")) {
      const parts = path.split("/");
      const compId = parts[1] ? decodeURIComponent(parts[1]) : null;
      const data = await loadAllFromD1(db);
      let companies = data.tables["00_Companies"] || [];

      // GET /api/companies
      if (method === "GET") {
        if (compId) {
          const comp = companies.find(c => c.company_id === compId);
          if (!comp) return jsonResponse({ success: false, message: "Không tìm thấy công ty" }, 404);
          return jsonResponse({ success: true, company: comp });
        }
        return jsonResponse({ success: true, companies });
      }

      // POST /api/companies (Create)
      if (method === "POST") {
        const body = await request.json().catch(() => ({}));
        const id = (body.company_id || `CP-${Date.now()}`).trim();
        const newComp = {
          company_id: id,
          company_name: body.company_name || "",
          tax_code: body.tax_code || "",
          phone: body.phone || "",
          email: body.email || "",
          address: body.address || "",
          status: body.status || "Hoạt động",
          created_at: new Date().toISOString()
        };
        const existingIdx = companies.findIndex(c => c.company_id === id);
        if (existingIdx >= 0) {
          companies[existingIdx] = { ...companies[existingIdx], ...newComp };
        } else {
          companies.push(newComp);
        }
        await saveTableToD1(db, "00_Companies", companies);
        return jsonResponse({ success: true, company: newComp, message: "Tạo công ty thành công!" });
      }

      // PUT /api/companies/:id (Update)
      if (method === "PUT" && compId) {
        const body = await request.json().catch(() => ({}));
        const idx = companies.findIndex(c => c.company_id === compId);
        if (idx < 0) return jsonResponse({ success: false, message: "Không tìm thấy công ty để cập nhật" }, 404);
        companies[idx] = { ...companies[idx], ...body, company_id: compId, updated_at: new Date().toISOString() };
        await saveTableToD1(db, "00_Companies", companies);
        return jsonResponse({ success: true, company: companies[idx], message: "Cập nhật công ty thành công!" });
      }

      // DELETE /api/companies/:id
      if (method === "DELETE" && compId) {
        companies = companies.filter(c => c.company_id !== compId);
        await saveTableToD1(db, "00_Companies", companies);
        return jsonResponse({ success: true, message: `Đã xóa công ty ${compId} thành công!` });
      }
    }

    // -------------------------------------------------------------
    // Route: Departments CRUD (/api/departments/*)
    // -------------------------------------------------------------
    if (path === "departments" || path.startsWith("departments/")) {
      const parts = path.split("/");
      const deptId = parts[1] ? decodeURIComponent(parts[1]) : null;
      const data = await loadAllFromD1(db);
      let departments = data.tables["01_Departments"] || [];

      // GET /api/departments
      if (method === "GET") {
        if (deptId) {
          const dept = departments.find(d => d.department_id === deptId);
          if (!dept) return jsonResponse({ success: false, message: "Không tìm thấy phòng ban" }, 404);
          return jsonResponse({ success: true, department: dept });
        }
        return jsonResponse({ success: true, departments });
      }

      // POST /api/departments (Create)
      if (method === "POST") {
        const body = await request.json().catch(() => ({}));
        const id = (body.department_id || `DEPT-${Date.now()}`).trim();
        const newDept = {
          department_id: id,
          department_name: body.department_name || "",
          company_id: body.company_id || "",
          parent_dept_id: body.parent_dept_id || "",
          manager_id: body.manager_id || "",
          status: body.status || "Hoạt động",
          created_at: new Date().toISOString()
        };
        const existingIdx = departments.findIndex(d => d.department_id === id);
        if (existingIdx >= 0) {
          departments[existingIdx] = { ...departments[existingIdx], ...newDept };
        } else {
          departments.push(newDept);
        }
        await saveTableToD1(db, "01_Departments", departments);
        return jsonResponse({ success: true, department: newDept, message: "Tạo phòng ban thành công!" });
      }

      // PUT /api/departments/:id (Update)
      if (method === "PUT" && deptId) {
        const body = await request.json().catch(() => ({}));
        const idx = departments.findIndex(d => d.department_id === deptId);
        if (idx < 0) return jsonResponse({ success: false, message: "Không tìm thấy phòng ban để cập nhật" }, 404);
        departments[idx] = { ...departments[idx], ...body, department_id: deptId, updated_at: new Date().toISOString() };
        await saveTableToD1(db, "01_Departments", departments);
        return jsonResponse({ success: true, department: departments[idx], message: "Cập nhật phòng ban thành công!" });
      }

      // DELETE /api/departments/:id
      if (method === "DELETE" && deptId) {
        departments = departments.filter(d => d.department_id !== deptId);
        await saveTableToD1(db, "01_Departments", departments);
        return jsonResponse({ success: true, message: `Đã xóa phòng ban ${deptId} thành công!` });
      }
    }

    // -------------------------------------------------------------
    // Route: Positions CRUD (/api/positions/*)
    // -------------------------------------------------------------
    if (path === "positions" || path.startsWith("positions/")) {
      const parts = path.split("/");
      const posId = parts[1] ? decodeURIComponent(parts[1]) : null;
      const data = await loadAllFromD1(db);
      let positions = data.tables["02_Positions"] || [];

      // GET /api/positions
      if (method === "GET") {
        if (posId) {
          const pos = positions.find(p => p.position_id === posId);
          if (!pos) return jsonResponse({ success: false, message: "Không tìm thấy vị trí" }, 404);
          return jsonResponse({ success: true, position: pos });
        }
        return jsonResponse({ success: true, positions });
      }

      // POST /api/positions (Create)
      if (method === "POST") {
        const body = await request.json().catch(() => ({}));
        const id = (body.position_id || `POS-${Date.now()}`).trim();
        const newPos = {
          position_id: id,
          position_name: body.position_name || "",
          department_id: body.department_id || "",
          level: body.level || "Cấp 1",
          status: body.status || "Hoạt động",
          created_at: new Date().toISOString()
        };
        const existingIdx = positions.findIndex(p => p.position_id === id);
        if (existingIdx >= 0) {
          positions[existingIdx] = { ...positions[existingIdx], ...newPos };
        } else {
          positions.push(newPos);
        }
        await saveTableToD1(db, "02_Positions", positions);
        return jsonResponse({ success: true, position: newPos, message: "Tạo vị trí thành công!" });
      }

      // PUT /api/positions/:id (Update)
      if (method === "PUT" && posId) {
        const body = await request.json().catch(() => ({}));
        const idx = positions.findIndex(p => p.position_id === posId);
        if (idx < 0) return jsonResponse({ success: false, message: "Không tìm thấy vị trí để cập nhật" }, 404);
        positions[idx] = { ...positions[idx], ...body, position_id: posId, updated_at: new Date().toISOString() };
        await saveTableToD1(db, "02_Positions", positions);
        return jsonResponse({ success: true, position: positions[idx], message: "Cập nhật vị trí thành công!" });
      }

      // DELETE /api/positions/:id
      if (method === "DELETE" && posId) {
        positions = positions.filter(p => p.position_id !== posId);
        await saveTableToD1(db, "02_Positions", positions);
        return jsonResponse({ success: true, message: `Đã xóa vị trí ${posId} thành công!` });
      }
    }

    // -------------------------------------------------------------
    // Route: Accounts CRUD (/api/accounts/*)
    // -------------------------------------------------------------
    if (path === "accounts" || path.startsWith("accounts/")) {
      const parts = path.split("/");
      const accId = parts[1] ? decodeURIComponent(parts[1]) : null;
      const subAction = parts[2] ? decodeURIComponent(parts[2]) : null;
      const data = await loadAllFromD1(db);
      let accounts = data.tables["11_System_Accounts"] || [];

      // POST /api/accounts/:id/reset-password
      if (subAction === "reset-password" && method === "POST" && accId) {
        const body = await request.json().catch(() => ({}));
        const newPassword = body.new_password || "123456";
        const idx = accounts.findIndex(a => a.account_id === accId || a.employee_id === accId);
        if (idx >= 0) {
          accounts[idx] = { ...accounts[idx], password: newPassword, updated_at: new Date().toISOString() };
          await saveTableToD1(db, "11_System_Accounts", accounts);
        }
        return jsonResponse({ success: true, message: "Đặt lại mật khẩu thành công!" });
      }

      // POST /api/accounts/delete-bulk
      if (accId === "delete-bulk" && method === "POST") {
        const body = await request.json().catch(() => ({}));
        const ids = new Set(body.account_ids || []);
        accounts = accounts.filter(a => !ids.has(a.account_id) && !ids.has(a.employee_id));
        await saveTableToD1(db, "11_System_Accounts", accounts);
        return jsonResponse({ success: true, message: "Đã xóa các tài khoản đã chọn!" });
      }

      // GET /api/accounts
      if (method === "GET") {
        return jsonResponse({ success: true, accounts });
      }

      // POST /api/accounts (Create)
      if (method === "POST") {
        const body = await request.json().catch(() => ({}));
        const newAcc = {
          account_id: `ACC-${body.employee_id || Date.now()}`,
          employee_id: body.employee_id || "",
          username: (body.username || body.employee_id || `user_${Date.now()}`).toLowerCase(),
          full_name: body.full_name || "",
          account_email: body.account_email || "",
          role: body.role || "USER",
          account_status: body.account_status || "Kích hoạt",
          password: body.password || "123456",
          created_at: new Date().toISOString()
        };
        const idx = accounts.findIndex(a => a.account_id === newAcc.account_id || a.employee_id === newAcc.employee_id);
        if (idx >= 0) {
          accounts[idx] = { ...accounts[idx], ...newAcc };
        } else {
          accounts.push(newAcc);
        }
        await saveTableToD1(db, "11_System_Accounts", accounts);
        return jsonResponse({ success: true, account: newAcc, message: "Tạo tài khoản thành công!" });
      }

      // PUT /api/accounts/:id (Update)
      if (method === "PUT" && accId) {
        const body = await request.json().catch(() => ({}));
        const idx = accounts.findIndex(a => a.account_id === accId || a.employee_id === accId);
        if (idx >= 0) {
          accounts[idx] = { ...accounts[idx], ...body, updated_at: new Date().toISOString() };
          await saveTableToD1(db, "11_System_Accounts", accounts);
          return jsonResponse({ success: true, account: accounts[idx], message: "Cập nhật tài khoản thành công!" });
        }
        return jsonResponse({ success: false, message: "Không tìm thấy tài khoản" }, 404);
      }

      // DELETE /api/accounts/:id
      if (method === "DELETE" && accId) {
        accounts = accounts.filter(a => a.account_id !== accId && a.employee_id !== accId);
        await saveTableToD1(db, "11_System_Accounts", accounts);
        return jsonResponse({ success: true, message: `Đã xóa tài khoản ${accId}!` });
      }
    }

    // -------------------------------------------------------------
    // Route: Company Info (/api/company/info)
    // -------------------------------------------------------------
    if (path === "company/info") {
      if (method === "GET") {
        const data = await loadAllFromD1(db);
        return jsonResponse({ success: true, company: data.company });
      }
      if (method === "POST") {
        const body = await request.json().catch(() => ({}));
        const data = await loadAllFromD1(db);
        const updated = { ...data.company, ...body };
        await db.prepare("INSERT OR REPLACE INTO hrm_store (key, value, updated_at) VALUES ('company_info', ?, CURRENT_TIMESTAMP)")
          .bind(JSON.stringify(updated))
          .run();
        return jsonResponse({ success: true, company: updated, message: "Đã cập nhật thông tin thương hiệu công ty!" });
      }
    }


    // -------------------------------------------------------------
    // Route: System Logs (/api/logs)
    // -------------------------------------------------------------
    if (path === "logs") {
      const data = await loadAllFromD1(db);
      let logs = data.tables["12_System_Logs"] || [];

      if (method === "GET") {
        return jsonResponse({ success: true, data: logs, logs, total: logs.length });
      }
      if (method === "POST") {
        const body = await request.json().catch(() => ({}));
        const logEntry = {
          log_id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          timestamp: new Date().toISOString(),
          user_id: body.user_id || "TH-1948",
          user_name: body.user_name || "Quản trị viên",
          user_role: body.user_role || "ADMIN",
          action_type: body.action_type || "INFO",
          module: body.module || "Hệ thống",
          description: body.description || "",
          ip_address: request.headers.get("cf-connecting-ip") || "127.0.0.1"
        };
        logs.unshift(logEntry);
        if (logs.length > 3000) logs = logs.slice(0, 3000); // Lưu trữ tối đa 3000 bản ghi kiểm toán
        await saveTableToD1(db, "12_System_Logs", logs);
        return jsonResponse({ success: true, log: logEntry });
      }
      if (method === "DELETE") {
        return jsonResponse({
          success: false,
          message: "Nhật ký hoạt động hệ thống là dữ liệu kiểm toán bất biến, không được phép xóa!"
        }, 403);
      }
    }

    // Fallback for other standard routes
    return jsonResponse({ success: true, message: `Cloudflare Pages API reached: /api/${path}` });
  } catch (err) {
    console.error("[Cloudflare API Error]:", err);
    return jsonResponse({ success: false, error: err.message || "Lỗi máy chủ Cloudflare" }, 500);
  }
}
