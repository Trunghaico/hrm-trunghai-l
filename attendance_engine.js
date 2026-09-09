/**
 * ATTENDANCE ENGINE - BỘ XỬ LÝ CHẤM CÔNG CHUẨN MITAPRO ULTIMATE 2026
 * Dành cho Hệ thống Quản trị Nhân sự HRM Trung Hải
 * 
 * Các tính năng:
 * 1. Quản lý Ca làm việc (Hành chính, Sáng, Chiều, Đêm, Ca gãy)
 * 2. Phân tích log chấm công thô (Check-in / Check-out / Ghép cặp / Bất thường)
 * 3. Thuật toán Đi muộn / Về sớm (Grace period & Làm tròn 5p/15p)
 * 4. Tính giờ làm thêm Overtime (OT ngày thường 150%, CN 200%, Lễ 300%)
 * 5. Tự động áp dụng Đơn từ (Nghỉ phép P/RO/TS/Ô, Giải trình quên chấm công, Đơn OT, Công tác CT)
 * 6. Tính toán Bảng công chi tiết & Bảng tổng hợp
 */

const DEFAULT_SHIFTS = [
  {
    shift_id: 'CA-HC',
    shift_code: 'HC',
    shift_name: 'Ca Hành Chính',
    shift_type: 'standard',
    start_time: '08:00',
    end_time: '17:30',
    break_start: '12:00',
    break_end: '13:30',
    break_hours: 1.5,
    standard_hours: 8.0,
    work_units: 1.0,
    grace_late_minutes: 15,
    grace_early_minutes: 15,
    min_hours: 7.0,
    checkin_start: '06:00',
    checkin_end: '11:00',
    checkout_start: '12:00',
    checkout_end: '23:59',
    color: '#2563EB',
    status: 'ACTIVE'
  },
  {
    shift_id: 'CA-S',
    shift_code: 'S',
    shift_name: 'Ca Sáng',
    shift_type: 'half_day',
    start_time: '08:00',
    end_time: '12:00',
    break_start: '',
    break_end: '',
    break_hours: 0,
    standard_hours: 4.0,
    work_units: 0.5,
    grace_late_minutes: 10,
    grace_early_minutes: 10,
    min_hours: 3.5,
    checkin_start: '06:00',
    checkin_end: '10:00',
    checkout_start: '11:30',
    checkout_end: '14:00',
    color: '#10B981',
    status: 'ACTIVE'
  },
  {
    shift_id: 'CA-C',
    shift_code: 'C',
    shift_name: 'Ca Chiều',
    shift_type: 'half_day',
    start_time: '13:30',
    end_time: '17:30',
    break_start: '',
    break_end: '',
    break_hours: 0,
    standard_hours: 4.0,
    work_units: 0.5,
    grace_late_minutes: 10,
    grace_early_minutes: 10,
    min_hours: 3.5,
    checkin_start: '11:00',
    checkin_end: '15:00',
    checkout_start: '16:30',
    checkout_end: '20:00',
    color: '#F59E0B',
    status: 'ACTIVE'
  },
  {
    shift_id: 'CA-DEM',
    shift_code: 'DEM',
    shift_name: 'Ca Đêm',
    shift_type: 'night',
    start_time: '22:00',
    end_time: '06:00',
    break_start: '02:00',
    break_end: '03:00',
    break_hours: 1.0,
    standard_hours: 8.0,
    work_units: 1.0,
    grace_late_minutes: 15,
    grace_early_minutes: 15,
    min_hours: 7.0,
    checkin_start: '20:00',
    checkin_end: '23:30',
    checkout_start: '05:00',
    checkout_end: '09:00',
    color: '#6366F1',
    status: 'ACTIVE'
  }
];

// Danh sách các ngày lễ cố định (Dương lịch: MM-DD)
const FIXED_HOLIDAYS = [
  '01-01', // Tết Dương Lịch
  '04-30', // Ngày Giải phóng Miền Nam
  '05-01', // Quốc tế Lao động
  '09-02', // Quốc khánh
  '09-03'  // Nghỉ Quốc khánh
];

function isPublicHoliday(dateStr) {
  if (!dateStr) return false;
  const monthDay = dateStr.substring(5, 10);
  return FIXED_HOLIDAYS.includes(monthDay);
}

function timeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function minutesToTime(mins) {
  if (mins === null || isNaN(mins)) return '';
  const totalMins = (mins % (24 * 60) + (24 * 60)) % (24 * 60);
  const h = Math.floor(totalMins / 60);
  const m = Math.floor(totalMins % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function roundMinutes(mins, roundStep = 5) {
  if (!mins || mins <= 0) return 0;
  if (!roundStep || roundStep <= 1) return mins;
  return Math.ceil(mins / roundStep) * roundStep;
}

function getDayOfWeekName(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const dayNames = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  return dayNames[day] || '';
}

/**
 * Tính toán dữ liệu chấm công của một nhân viên trong một ngày cụ thể
 */
function calculateDayTimesheet({
  employee,
  date,
  dayLogs = [],
  approvedRequests = [],
  shiftSchedule = null,
  shiftsList = DEFAULT_SHIFTS,
  policy = {}
}) {
  const empId = employee.employee_id || employee.id || '';
  const fullName = employee.full_name || '';
  const deptName = employee.department_name || employee.department || '';

  const d = new Date(date + 'T00:00:00');
  const dayOfWeek = d.getDay(); // 0 = Sunday
  const isSunday = (dayOfWeek === 0);
  const dayName = getDayOfWeekName(date);
  const isHoliday = isPublicHoliday(date);

  // Xác định ca làm việc áp dụng cho ngày này
  let activeShift = null;
  if (shiftSchedule && shiftSchedule.shift_id) {
    activeShift = shiftsList.find(s => s.shift_id === shiftSchedule.shift_id);
  }
  if (!activeShift) {
    // Mặc định ca hành chính nếu không phải Chủ nhật
    if (!isSunday) {
      activeShift = shiftsList.find(s => s.shift_id === 'CA-HC') || DEFAULT_SHIFTS[0];
    }
  }

  // 1. Phân tích Log chấm công thô của nhân viên trong ngày
  const empCodes = new Set([
    String(employee.attendance_code || '').trim(),
    String(employee.time_attendance_code || '').trim(),
    String(employee.employee_id || '').trim(),
    String(employee.employee_id || '').replace(/[^0-9]/g, '')
  ].filter(Boolean));

  const validLogs = (dayLogs || []).filter(log => {
    const logCode = String(log.attendance_code || log.employee_id || log.badgenumber || '').trim();
    return empCodes.has(logCode);
  });

  // Sắp xếp tăng dần theo thời gian timestamp
  validLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let rawCheckIn = null;
  let rawCheckOut = null;

  if (validLogs.length > 0) {
    const firstTime = (validLogs[0].timestamp || '').substring(11, 16); // HH:mm
    rawCheckIn = firstTime;

    if (validLogs.length > 1) {
      const lastTime = (validLogs[validLogs.length - 1].timestamp || '').substring(11, 16);
      if (lastTime !== firstTime) {
        rawCheckOut = lastTime;
      }
    }
  }

  // 2. Kiểm tra các đơn từ đã được duyệt trong ngày
  const leaveReq = (approvedRequests || []).find(r => (r.request_type === 'LEAVE' || r.type === 'LEAVE') && (r.status === 'APPROVED'));
  const forgotReq = (approvedRequests || []).find(r => (r.request_type === 'FORGOT_CHECKIN' || r.type === 'FORGOT_CHECKIN') && (r.status === 'APPROVED'));
  const otReq = (approvedRequests || []).find(r => (r.request_type === 'OVERTIME' || r.type === 'OVERTIME') && (r.status === 'APPROVED'));
  const tripReq = (approvedRequests || []).find(r => (r.request_type === 'BUSINESS_TRIP' || r.type === 'BUSINESS_TRIP') && (r.status === 'APPROVED'));

  // Áp dụng đơn giải trình quên chấm công
  let checkIn = rawCheckIn;
  let checkOut = rawCheckOut;
  let hasForgotExplanation = false;

  if (forgotReq) {
    hasForgotExplanation = true;
    if (forgotReq.start_time || forgotReq.check_in) checkIn = forgotReq.start_time || forgotReq.check_in;
    if (forgotReq.end_time || forgotReq.check_out) checkOut = forgotReq.end_time || forgotReq.check_out;
  }

  // A. Trường hợp Ngày lễ (Holiday)
  if (isHoliday) {
    let otHours = 0;
    if (checkIn && checkOut) {
      const inM = timeToMinutes(checkIn);
      const outM = timeToMinutes(checkOut);
      if (outM > inM) otHours = Math.round(((outM - inM) / 60) * 10) / 10;
    }
    return {
      timesheet_id: `TS_${empId}_${date}`,
      employee_id: empId,
      full_name: fullName,
      department_name: deptName,
      date,
      day_name: dayName,
      shift_id: 'HOLIDAY',
      shift_name: 'Nghỉ Lễ / Tết',
      check_in: checkIn || '',
      check_out: checkOut || '',
      late_minutes: 0,
      early_minutes: 0,
      work_units: 1.0,
      total_work_hours: 8.0,
      ot_hours: otHours,
      ot_type: 'HOLIDAY',
      ot_rate: 3.0,
      total_all_hours: 8.0 + otHours,
      symbol: otHours > 0 ? 'L+OT' : 'L',
      status: otHours > 0 ? 'HOLIDAY_WORK' : 'HOLIDAY',
      is_locked: false,
      is_manual_edited: false,
      note: otHours > 0 ? `Đi làm ngày Lễ (${otHours}h OT - 300%)` : 'Nghỉ lễ hưởng lương'
    };
  }

  // B. Trường hợp Đi công tác (Business Trip)
  if (tripReq) {
    return {
      timesheet_id: `TS_${empId}_${date}`,
      employee_id: empId,
      full_name: fullName,
      department_name: deptName,
      date,
      day_name: dayName,
      shift_id: activeShift ? activeShift.shift_id : 'CA-HC',
      shift_name: 'Công tác',
      check_in: checkIn || '08:00',
      check_out: checkOut || '17:30',
      late_minutes: 0,
      early_minutes: 0,
      work_units: 1.0,
      total_work_hours: 8.0,
      ot_hours: 0,
      ot_type: 'NONE',
      ot_rate: 1.0,
      total_all_hours: 8.0,
      symbol: 'CT',
      status: 'BUSINESS_TRIP',
      is_locked: false,
      is_manual_edited: false,
      note: `Đi công tác (${tripReq.reason || 'Đã duyệt'})`
    };
  }

  // C. Trường hợp Chủ nhật (Nghỉ tuần)
  if (!activeShift && isSunday) {
    let otHours = 0;
    if (checkIn && checkOut) {
      const inM = timeToMinutes(checkIn);
      const outM = timeToMinutes(checkOut);
      if (outM > inM) otHours = Math.round(((outM - inM) / 60) * 10) / 10;
    }
    return {
      timesheet_id: `TS_${empId}_${date}`,
      employee_id: empId,
      full_name: fullName,
      department_name: deptName,
      date,
      day_name: dayName,
      shift_id: 'OFF',
      shift_name: 'Nghỉ tuần (Chủ nhật)',
      check_in: checkIn || '',
      check_out: checkOut || '',
      late_minutes: 0,
      early_minutes: 0,
      work_units: 0,
      total_work_hours: 0,
      ot_hours: otHours,
      ot_type: otHours > 0 ? 'WEEKEND' : 'NONE',
      ot_rate: 2.0,
      total_all_hours: otHours,
      symbol: otHours > 0 ? 'OT_CN' : 'OFF',
      status: otHours > 0 ? 'OT_WEEKEND' : 'WEEKEND',
      is_locked: false,
      is_manual_edited: false,
      note: otHours > 0 ? `Làm thêm ngày Chủ nhật (${otHours}h - 200%)` : 'Nghỉ cuối tuần'
    };
  }

  // D. Xử lý Đơn xin nghỉ phép đã duyệt
  if (leaveReq) {
    const leaveCategory = (leaveReq.leave_type || leaveReq.sub_type || 'ANNUAL').toUpperCase();
    let symbol = 'P';
    let isPaid = true;
    let noteText = 'Nghỉ phép năm hưởng lương';

    if (leaveCategory.includes('UNPAID') || leaveCategory.includes('RO')) {
      symbol = 'RO';
      isPaid = false;
      noteText = 'Nghỉ việc riêng không lương';
    } else if (leaveCategory.includes('MATERNITY') || leaveCategory.includes('TS')) {
      symbol = 'TS';
      isPaid = true;
      noteText = 'Nghỉ chế độ thai sản (BHXH)';
    } else if (leaveCategory.includes('SICK') || leaveCategory.includes('OM')) {
      symbol = 'Ô';
      isPaid = true;
      noteText = 'Nghỉ ốm đau hưởng BHXH';
    }

    const units = isPaid ? (activeShift ? activeShift.work_units : 1.0) : 0;
    const stdHours = isPaid ? (activeShift ? activeShift.standard_hours : 8.0) : 0;

    return {
      timesheet_id: `TS_${empId}_${date}`,
      employee_id: empId,
      full_name: fullName,
      department_name: deptName,
      date,
      day_name: dayName,
      shift_id: activeShift ? activeShift.shift_id : 'CA-HC',
      shift_name: activeShift ? activeShift.shift_name : 'Ca Hành Chính',
      check_in: checkIn || '',
      check_out: checkOut || '',
      late_minutes: 0,
      early_minutes: 0,
      work_units: units,
      total_work_hours: stdHours,
      ot_hours: 0,
      ot_type: 'NONE',
      ot_rate: 1.0,
      total_all_hours: stdHours,
      symbol,
      status: isPaid ? 'LEAVE_PAID' : 'LEAVE_UNPAID',
      is_locked: false,
      is_manual_edited: false,
      note: `${noteText} (${leaveReq.reason || 'Đã duyệt'})`
    };
  }

  // E. Tính toán theo Ca làm việc thực tế
  if (!activeShift) {
    activeShift = DEFAULT_SHIFTS[0];
  }

  let lateMinutes = 0;
  let earlyMinutes = 0;
  const shiftStartMins = timeToMinutes(activeShift.start_time);
  const shiftEndMins = timeToMinutes(activeShift.end_time);
  const inMins = timeToMinutes(checkIn);
  const outMins = timeToMinutes(checkOut);

  // Đi muộn (so với start_time + grace_late_minutes)
  if (inMins !== null && shiftStartMins !== null) {
    const diffIn = inMins - shiftStartMins;
    if (diffIn > (activeShift.grace_late_minutes || 0)) {
      lateMinutes = roundMinutes(diffIn, policy.round_step || 5);
    }
  }

  // Về sớm (so với end_time - grace_early_minutes)
  if (outMins !== null && shiftEndMins !== null) {
    const diffOut = shiftEndMins - outMins;
    if (diffOut > (activeShift.grace_early_minutes || 0)) {
      earlyMinutes = roundMinutes(diffOut, policy.round_step || 5);
    }
  }

  // Tính giờ làm thực tế
  let totalWorkHours = 0;
  if (inMins !== null && outMins !== null && outMins > inMins) {
    let spanMins = outMins - inMins;
    // Trừ giờ nghỉ trưa nếu làm qua khung giờ nghỉ
    if (activeShift.break_hours && activeShift.break_start && activeShift.break_end) {
      const bStartMins = timeToMinutes(activeShift.break_start);
      const bEndMins = timeToMinutes(activeShift.break_end);
      if (inMins <= bStartMins && outMins >= bEndMins) {
        spanMins -= (activeShift.break_hours * 60);
      }
    }
    totalWorkHours = Math.max(0, Math.round((spanMins / 60) * 10) / 10);
  } else if (inMins !== null && !outMins) {
    totalWorkHours = 4.0; // Quên chấm ra -> tạm tính nửa ca
  }

  // Tính số công (Work Units) & Ký hiệu (Symbol)
  let workUnits = 0;
  let status = 'VALID';
  let symbol = 'X';

  if (!checkIn && !checkOut) {
    workUnits = 0;
    status = 'ABSENT';
    symbol = 'KP'; // Vắng không phép
  } else if (checkIn && !checkOut) {
    workUnits = 0.5;
    status = 'MISSING_OUT';
    symbol = '1/2';
  } else if (!checkIn && checkOut) {
    workUnits = 0.5;
    status = 'MISSING_IN';
    symbol = '1/2';
  } else {
    // Đủ cả In và Out
    if (totalWorkHours >= (activeShift.min_hours || 7.0)) {
      workUnits = activeShift.work_units; // 1.0 công
      if (lateMinutes > 0 && earlyMinutes > 0) status = 'LATE_AND_EARLY';
      else if (lateMinutes > 0) status = 'LATE';
      else if (earlyMinutes > 0) status = 'EARLY';
      else status = 'VALID';
      symbol = 'X';
    } else if (totalWorkHours >= 3.5) {
      workUnits = 0.5;
      status = lateMinutes > 0 ? 'LATE_HALF' : 'HALF_DAY';
      symbol = '1/2';
    } else {
      workUnits = 0.25;
      status = 'UNDER_HOURS';
      symbol = '0.25';
    }
  }

  // Tính giờ làm thêm Overtime (OT)
  let otHours = 0;
  if (outMins !== null && shiftEndMins !== null) {
    const afterShiftMins = outMins - shiftEndMins;
    if (afterShiftMins >= 30) {
      otHours = Math.round((afterShiftMins / 60) * 10) / 10;
    }
  }

  // Kết hợp đơn OT được duyệt nếu có
  if (otReq && otReq.ot_hours) {
    otHours = Math.max(otHours, parseFloat(otReq.ot_hours) || 0);
  }

  const totalAllHours = Math.round((totalWorkHours + otHours) * 10) / 10;

  let note = '';
  if (hasForgotExplanation) note = 'Đã giải trình chấm công';
  else if (status === 'ABSENT') note = 'Vắng không phép';
  else if (status === 'MISSING_OUT') note = 'Quên chấm công ra';
  else if (status === 'MISSING_IN') note = 'Quên chấm công vào';
  else if (lateMinutes > 0 && earlyMinutes > 0) note = `Đi muộn ${lateMinutes}p, về sớm ${earlyMinutes}p`;
  else if (lateMinutes > 0) note = `Đi muộn ${lateMinutes}p`;
  else if (earlyMinutes > 0) note = `Về sớm ${earlyMinutes}p`;

  return {
    timesheet_id: `TS_${empId}_${date}`,
    employee_id: empId,
    full_name: fullName,
    department_name: deptName,
    date,
    day_name: dayName,
    shift_id: activeShift.shift_id,
    shift_name: activeShift.shift_name,
    check_in: checkIn || '',
    check_out: checkOut || '',
    late_minutes: lateMinutes,
    early_minutes: earlyMinutes,
    work_units: workUnits,
    total_work_hours: totalWorkHours,
    ot_hours: otHours,
    ot_type: otHours > 0 ? 'WEEKDAY' : 'NONE',
    ot_rate: 1.5,
    total_all_hours: totalAllHours,
    symbol,
    status,
    is_locked: false,
    is_manual_edited: false,
    note
  };
}

/**
 * Tính toán Bảng công tổng hợp cả tháng cho toàn bộ nhân viên
 */
function calculateMonthlyTimesheet({
  employees = [],
  year,
  month,
  allLogs = [],
  allRequests = [],
  allSchedules = [],
  shiftsList = DEFAULT_SHIFTS,
  policy = {}
}) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const dateStrings = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = String(d).padStart(2, '0');
    const mStr = String(month).padStart(2, '0');
    dateStrings.push(`${year}-${mStr}-${dayStr}`);
  }

  const logsByDate = {};
  for (const log of allLogs) {
    if (!log.timestamp) continue;
    const logDate = log.timestamp.substring(0, 10);
    if (!logsByDate[logDate]) logsByDate[logDate] = [];
    logsByDate[logDate].push(log);
  }

  const requestsByEmpAndDate = {};
  for (const req of allRequests) {
    if (req.status !== 'APPROVED') continue;
    const empId = req.employee_id;
    const startDate = (req.start_date || req.date || '').substring(0, 10);
    const endDate = (req.end_date || req.date || startDate).substring(0, 10);

    for (const dt of dateStrings) {
      if (dt >= startDate && dt <= endDate) {
        const key = `${empId}_${dt}`;
        if (!requestsByEmpAndDate[key]) requestsByEmpAndDate[key] = [];
        requestsByEmpAndDate[key].push(req);
      }
    }
  }

  const schedulesByEmpAndDate = {};
  for (const sch of allSchedules) {
    const empId = sch.employee_id;
    const dt = sch.date;
    if (empId && dt) {
      schedulesByEmpAndDate[`${empId}_${dt}`] = sch;
    }
  }

  const dailyDetails = [];
  const monthlySummaries = [];

  for (const emp of employees) {
    const empId = emp.employee_id || emp.id;
    let totalWorkUnits = 0;
    let totalStandardHours = 0;
    let totalOtWeekday = 0;
    let totalOtWeekend = 0;
    let totalOtHoliday = 0;
    let totalLateTimes = 0;
    let totalLateMinutes = 0;
    let totalEarlyTimes = 0;
    let totalEarlyMinutes = 0;
    let totalPaidLeave = 0;
    let totalUnpaidLeave = 0;
    let totalAbsent = 0;
    const daysGrid = {};

    for (const dt of dateStrings) {
      const dayLogs = logsByDate[dt] || [];
      const approvedReqs = requestsByEmpAndDate[`${empId}_${dt}`] || [];
      const schedule = schedulesByEmpAndDate[`${empId}_${dt}`] || null;

      const dayResult = calculateDayTimesheet({
        employee: emp,
        date: dt,
        dayLogs,
        approvedRequests: approvedReqs,
        shiftSchedule: schedule,
        shiftsList,
        policy
      });

      dailyDetails.push(dayResult);
      daysGrid[dt] = dayResult;

      totalWorkUnits += (dayResult.work_units || 0);
      totalStandardHours += (dayResult.total_work_hours || 0);

      if (dayResult.ot_hours > 0) {
        if (dayResult.ot_type === 'HOLIDAY') totalOtHoliday += dayResult.ot_hours;
        else if (dayResult.ot_type === 'WEEKEND') totalOtWeekend += dayResult.ot_hours;
        else totalOtWeekday += dayResult.ot_hours;
      }

      if (dayResult.late_minutes > 0) {
        totalLateTimes += 1;
        totalLateMinutes += dayResult.late_minutes;
      }
      if (dayResult.early_minutes > 0) {
        totalEarlyTimes += 1;
        totalEarlyMinutes += dayResult.early_minutes;
      }

      if (dayResult.symbol === 'P') totalPaidLeave += 1;
      else if (dayResult.symbol === 'RO') totalUnpaidLeave += 1;
      else if (dayResult.symbol === 'KP') totalAbsent += 1;
    }

    monthlySummaries.push({
      employee_id: empId,
      full_name: emp.full_name || '',
      department_name: emp.department_name || emp.department || '',
      job_title: emp.job_title || emp.position_name || '',
      year,
      month,
      days_in_month: daysInMonth,
      total_work_units: Math.round(totalWorkUnits * 10) / 10,
      total_work_hours: Math.round(totalStandardHours * 10) / 10,
      ot_weekday_hours: Math.round(totalOtWeekday * 10) / 10,
      ot_weekend_hours: Math.round(totalOtWeekend * 10) / 10,
      ot_holiday_hours: Math.round(totalOtHoliday * 10) / 10,
      total_ot_hours: Math.round((totalOtWeekday + totalOtWeekend + totalOtHoliday) * 10) / 10,
      total_late_times: totalLateTimes,
      total_late_minutes: totalLateMinutes,
      total_early_times: totalEarlyTimes,
      total_early_minutes: totalEarlyMinutes,
      paid_leave_days: totalPaidLeave,
      unpaid_leave_days: totalUnpaidLeave,
      absent_days: totalAbsent,
      days_grid: daysGrid
    });
  }

  return {
    year,
    month,
    daysInMonth,
    dateStrings,
    dailyDetails,
    monthlySummaries
  };
}

module.exports = {
  DEFAULT_SHIFTS,
  FIXED_HOLIDAYS,
  isPublicHoliday,
  timeToMinutes,
  minutesToTime,
  roundMinutes,
  getDayOfWeekName,
  calculateDayTimesheet,
  calculateMonthlyTimesheet
};
