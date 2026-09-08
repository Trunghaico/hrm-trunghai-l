// ==========================================================================
// ATTENDANCE CALCULATION ENGINE & CORE BUSINESS LOGIC
// Thuật toán đối soát ca, tính công, tính đi muộn/về sớm, OT & đơn từ
// ==========================================================================

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
    grace_late_minutes: 15,
    grace_early_minutes: 15,
    work_units: 1.0,
    standard_hours: 8.0,
    min_hours: 7.0,
    color: '#2563EB'
  },
  {
    shift_id: 'CA-S',
    shift_code: 'S',
    shift_name: 'Ca Sáng',
    shift_type: 'standard',
    start_time: '08:00',
    end_time: '12:00',
    break_start: '',
    break_end: '',
    break_hours: 0,
    grace_late_minutes: 15,
    grace_early_minutes: 15,
    work_units: 0.5,
    standard_hours: 4.0,
    min_hours: 3.5,
    color: '#059669'
  },
  {
    shift_id: 'CA-C',
    shift_code: 'C',
    shift_name: 'Ca Chiều',
    shift_type: 'standard',
    start_time: '13:30',
    end_time: '17:30',
    break_start: '',
    break_end: '',
    break_hours: 0,
    grace_late_minutes: 15,
    grace_early_minutes: 15,
    work_units: 0.5,
    standard_hours: 4.0,
    min_hours: 3.5,
    color: '#D97706'
  },
  {
    shift_id: 'CA-G',
    shift_code: 'G',
    shift_name: 'Ca Gãy (Nhà Hàng/Bảo Vệ)',
    shift_type: 'split',
    start_time: '10:00',
    end_time: '21:00',
    break_start: '14:00',
    break_end: '17:00',
    break_hours: 3.0,
    grace_late_minutes: 15,
    grace_early_minutes: 15,
    work_units: 1.0,
    standard_hours: 8.0,
    min_hours: 7.0,
    color: '#7C3AED'
  },
  {
    shift_id: 'CA-D',
    shift_code: 'D',
    shift_name: 'Ca Đêm',
    shift_type: 'night',
    start_time: '22:00',
    end_time: '06:00',
    break_start: '02:00',
    break_end: '03:00',
    break_hours: 1.0,
    grace_late_minutes: 15,
    grace_early_minutes: 15,
    work_units: 1.0,
    standard_hours: 8.0,
    min_hours: 7.0,
    color: '#1E293B'
  }
];

function timeToMinutes(tStr) {
  if (!tStr || typeof tStr !== 'string') return null;
  const parts = tStr.trim().split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function minutesToTime(totalMins) {
  if (totalMins === null || totalMins === undefined || isNaN(totalMins)) return '--:--';
  const h = Math.floor(totalMins / 60) % 24;
  const m = Math.floor(totalMins % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getDayOfWeekName(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const dayIndex = d.getDay(); // 0: CN, 1: T2, ..., 6: T7
  const names = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  return names[dayIndex];
}

/**
 * Thuật toán tính công cho 1 nhân viên trong 1 ngày cụ thể
 */
function calculateDayTimesheet({
  employee,
  date,
  shift = null,
  dayLogs = [],
  approvedRequests = [],
  existingTimesheet = null
}) {
  const empId = employee.employee_id;
  const fullName = employee.full_name || '';
  const deptName = employee.department_name || employee.department_id || '';
  const dayName = getDayOfWeekName(date);
  const isSunday = (dayName === 'Chủ nhật');
  const isSaturday = (dayName === 'Thứ 7');

  // Nếu đã bị khóa sổ và không có can thiệp -> giữ nguyên
  if (existingTimesheet && existingTimesheet.is_locked && !existingTimesheet.force_recalc) {
    return existingTimesheet;
  }

  // Nếu HR đã sửa tay thủ công -> giữ nguyên dữ liệu đã sửa
  if (existingTimesheet && existingTimesheet.is_manual_edited) {
    return {
      ...existingTimesheet,
      full_name: fullName,
      department_name: deptName,
      day_name: dayName
    };
  }

  // Xác định ca làm việc
  let activeShift = shift;
  if (!activeShift) {
    if (isSunday) {
      activeShift = null; // Chủ nhật nghỉ
    } else if (isSaturday) {
      activeShift = DEFAULT_SHIFTS.find(s => s.shift_id === 'CA-S') || DEFAULT_SHIFTS[0];
    } else {
      activeShift = DEFAULT_SHIFTS.find(s => s.shift_id === 'CA-HC') || DEFAULT_SHIFTS[0];
    }
  }

  // 1. Lọc log quẹt thẻ của nhân viên trong ngày
  // Khớp theo attendance_code hoặc employee_id
  const empCodes = new Set([
    String(employee.attendance_code || '').trim(),
    String(employee.time_attendance_code || '').trim(),
    String(employee.employee_id || '').trim(),
    String(employee.employee_id || '').replace(/[^0-9]/g, '')
  ].filter(Boolean));

  const validLogs = (dayLogs || []).filter(log => {
    const logCode = String(log.attendance_code || log.employee_id || '').trim();
    return empCodes.has(logCode);
  });

  // Sắp xếp tăng dần theo thời gian
  validLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let rawCheckIn = null;
  let rawCheckOut = null;

  if (validLogs.length > 0) {
    const firstTime = validLogs[0].timestamp.substring(11, 16); // HH:mm
    rawCheckIn = firstTime;

    if (validLogs.length > 1) {
      const lastTime = validLogs[validLogs.length - 1].timestamp.substring(11, 16);
      if (lastTime !== firstTime) {
        rawCheckOut = lastTime;
      }
    }
  }

  // 2. Kiểm tra đơn từ đã được duyệt trong ngày
  const leaveReq = (approvedRequests || []).find(r => r.request_type === 'LEAVE' && r.status === 'APPROVED');
  const forgotReq = (approvedRequests || []).find(r => r.request_type === 'FORGOT_CHECKIN' && r.status === 'APPROVED');
  const otReq = (approvedRequests || []).find(r => r.request_type === 'OVERTIME' && r.status === 'APPROVED');

  // Áp dụng đơn giải trình quên chấm công nếu có
  let checkIn = rawCheckIn;
  let checkOut = rawCheckOut;
  let hasForgotExplanation = false;

  if (forgotReq) {
    hasForgotExplanation = true;
    if (forgotReq.start_time) checkIn = forgotReq.start_time;
    if (forgotReq.end_time) checkOut = forgotReq.end_time;
  }

  // Nếu là ngày Chủ nhật và không có phân ca đặc biệt
  if (!activeShift && isSunday) {
    // Nếu có đi làm vào chủ nhật -> tính OT ngày nghỉ
    let otHours = 0;
    if (checkIn && checkOut) {
      const inM = timeToMinutes(checkIn);
      const outM = timeToMinutes(checkOut);
      if (outM > inM) {
        otHours = Math.round(((outM - inM) / 60) * 10) / 10;
      }
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
      total_all_hours: otHours,
      status: otHours > 0 ? 'OT_WEEKEND' : 'WEEKEND',
      is_locked: false,
      is_manual_edited: false,
      note: otHours > 0 ? 'Làm thêm ngày Chủ nhật' : 'Nghỉ cuối tuần'
    };
  }

  // Xử lý nghỉ phép có đơn duyệt
  if (leaveReq) {
    const isPaid = leaveReq.leave_type !== 'UNPAID';
    const units = isPaid ? (activeShift ? activeShift.work_units : 1.0) : 0;
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
      total_work_hours: isPaid ? (activeShift ? activeShift.standard_hours : 8.0) : 0,
      ot_hours: 0,
      total_all_hours: isPaid ? (activeShift ? activeShift.standard_hours : 8.0) : 0,
      status: isPaid ? 'LEAVE_PAID' : 'LEAVE_UNPAID',
      is_locked: false,
      is_manual_edited: false,
      note: isPaid ? `Nghỉ phép hưởng lương (${leaveReq.reason || 'Đã duyệt'})` : `Nghỉ không lương (${leaveReq.reason || 'Đã duyệt'})`
    };
  }

  // 3. Thuật toán phát hiện Đi muộn / Về sớm
  let lateMinutes = 0;
  let earlyMinutes = 0;
  const shiftStartMins = timeToMinutes(activeShift.start_time);
  const shiftEndMins = timeToMinutes(activeShift.end_time);
  const inMins = timeToMinutes(checkIn);
  const outMins = timeToMinutes(checkOut);

  if (inMins !== null && shiftStartMins !== null) {
    const diffIn = inMins - shiftStartMins;
    if (diffIn > (activeShift.grace_late_minutes || 0)) {
      lateMinutes = diffIn;
    }
  }

  if (outMins !== null && shiftEndMins !== null) {
    const diffOut = shiftEndMins - outMins;
    if (diffOut > (activeShift.grace_early_minutes || 0)) {
      earlyMinutes = diffOut;
    }
  }

  // 4. Tính giờ làm thực tế
  let totalWorkHours = 0;
  if (inMins !== null && outMins !== null && outMins > inMins) {
    let spanMins = outMins - inMins;
    // Khấu trừ giờ nghỉ trưa nếu làm qua khung giờ nghỉ
    if (activeShift.break_hours && activeShift.break_start && activeShift.break_end) {
      const bStartMins = timeToMinutes(activeShift.break_start);
      const bEndMins = timeToMinutes(activeShift.break_end);
      if (inMins <= bStartMins && outMins >= bEndMins) {
        spanMins -= (activeShift.break_hours * 60);
      }
    }
    totalWorkHours = Math.max(0, Math.round((spanMins / 60) * 10) / 10);
  } else if (inMins !== null && !outMins) {
    // Chỉ có giờ vào (quên quẹt ra) -> tạm tính nửa ca hoặc 4h
    totalWorkHours = 4.0;
  }

  // 5. Tính số công chuẩn (Work Units)
  let workUnits = 0;
  let status = 'VALID';

  if (!checkIn && !checkOut) {
    // Không có bất kỳ quẹt thẻ nào và không có đơn -> Vắng mặt
    workUnits = 0;
    status = 'ABSENT';
  } else if (checkIn && !checkOut) {
    // Thiếu giờ ra
    workUnits = 0.5;
    status = 'MISSING_OUT';
  } else if (!checkIn && checkOut) {
    // Thiếu giờ vào
    workUnits = 0.5;
    status = 'MISSING_IN';
  } else {
    // Đầy đủ cả In và Out
    if (totalWorkHours >= (activeShift.min_hours || 7.0)) {
      workUnits = activeShift.work_units; // 1.0 công
      if (lateMinutes > 0 && earlyMinutes > 0) status = 'LATE_AND_EARLY';
      else if (lateMinutes > 0) status = 'LATE';
      else if (earlyMinutes > 0) status = 'EARLY';
      else status = 'VALID';
    } else if (totalWorkHours >= 3.5) {
      workUnits = 0.5;
      status = lateMinutes > 0 ? 'LATE_HALF' : 'HALF_DAY';
    } else {
      workUnits = 0.25;
      status = 'UNDER_HOURS';
    }
  }

  // 6. Tính giờ làm thêm (OT)
  let otHours = 0;
  if (outMins !== null && shiftEndMins !== null) {
    const afterShiftMins = outMins - shiftEndMins;
    // Nếu về muộn hơn ca từ 30 phút trở lên -> tính OT sau ca
    if (afterShiftMins >= 30) {
      otHours = Math.round((afterShiftMins / 60) * 10) / 10;
    }
  }

  // Cộng thêm OT từ đơn đăng ký đã duyệt nếu có
  if (otReq && otReq.ot_hours) {
    otHours = Math.max(otHours, parseFloat(otReq.ot_hours) || 0);
  }

  const totalAllHours = Math.round((totalWorkHours + otHours) * 10) / 10;

  let note = '';
  if (hasForgotExplanation) note = 'Đã giải trình chấm công';
  else if (status === 'ABSENT') note = 'Vắng không phép';
  else if (status === 'MISSING_OUT') note = 'Quên quẹt thẻ ra';
  else if (status === 'MISSING_IN') note = 'Quên quẹt thẻ vào';
  else if (lateMinutes > 0) note = `Đi muộn ${lateMinutes}p`;

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
    total_all_hours: totalAllHours,
    status,
    is_locked: false,
    is_manual_edited: false,
    note
  };
}

module.exports = {
  DEFAULT_SHIFTS,
  timeToMinutes,
  minutesToTime,
  getDayOfWeekName,
  calculateDayTimesheet
};
