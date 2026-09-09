// ==========================================================================
// RONALD JACK 009 DEVICE INTEGRATION SERVICE
// Kết nối máy chấm công qua IP & Cổng Port 5005, 5006, 5007 bằng node-zklib
// Hỗ trợ tự động hóa (Cron/Interval), khử trùng lặp chấm công & Virtual Simulator
// ==========================================================================

let ZKLib = null;
try {
  ZKLib = require('node-zklib');
} catch (err) {
  // node-zklib is optional / loaded dynamically
}

class RonaldJackService {
  constructor() {
    this.devices = [
      {
        id: 'DEV-01',
        name: 'Ronald Jack 009 - Cửa Chính',
        ip: '192.168.1.201',
        port: 5005,
        in_out_mode: 'AUTO', // IN, OUT, AUTO
        enabled: true,
        last_sync: null,
        status: 'STANDBY'
      },
      {
        id: 'DEV-02',
        name: 'Ronald Jack 009 - Văn Phòng Kho',
        ip: '192.168.1.202',
        port: 5006,
        in_out_mode: 'AUTO',
        enabled: false,
        last_sync: null,
        status: 'STANDBY'
      },
      {
        id: 'DEV-03',
        name: 'Ronald Jack 009 - Xưởng Sản Xuất',
        ip: '192.168.1.203',
        port: 5007,
        in_out_mode: 'AUTO',
        enabled: false,
        last_sync: null,
        status: 'STANDBY'
      }
    ];

    this.cronIntervalMinutes = 15;
    this.cronTimer = null;
    this.isSyncing = false;
    this.onNewLogsCallback = null;
  }

  // Cấu hình Cron Job tự động kéo dữ liệu (15 - 30 phút)
  startCron(intervalMinutes = 15, onNewLogsCallback = null) {
    this.cronIntervalMinutes = intervalMinutes;
    if (onNewLogsCallback) this.onNewLogsCallback = onNewLogsCallback;

    if (this.cronTimer) {
      clearInterval(this.cronTimer);
      this.cronTimer = null;
    }

    if (this.cronIntervalMinutes > 0) {
      const ms = this.cronIntervalMinutes * 60 * 1000;
      this.cronTimer = setInterval(() => {
        this.pullLogsFromAllDevices().catch(err => {
          console.error('[RonaldJackService] Cron pull error:', err.message);
        });
      }, ms);
      console.log(`[RonaldJackService] Cron Job tự động kéo dữ liệu Ronald Jack 009 kích hoạt mỗi ${this.cronIntervalMinutes} phút.`);
    }
  }

  stopCron() {
    if (this.cronTimer) {
      clearInterval(this.cronTimer);
      this.cronTimer = null;
    }
  }

  // Kiểm tra kết nối tới máy chấm công qua IP & Port
  async testConnection(ip, port = 5005) {
    if (!ZKLib) {
      return {
        success: false,
        simulated: true,
        ip,
        port,
        message: 'Thư viện node-zklib chưa được nạp hoặc thiết bị ngoại vi đang ở chế độ mô phỏng kiểm thử.'
      };
    }

    let zkInstance = null;
    try {
      zkInstance = new ZKLib(ip, parseInt(port, 10), 10000, 4000);
      await zkInstance.createSocket();
      const users = await zkInstance.getUsers();
      const serialNumber = await zkInstance.getSerialNumber();
      const version = await zkInstance.getVersion();
      await zkInstance.disconnect();

      return {
        success: true,
        ip,
        port,
        serialNumber: serialNumber || 'RJ009-PRO-2026',
        version: version || 'Ver 6.60 Nov 2025',
        userCount: (users && users.data) ? users.data.length : 0,
        message: `Kết nối thành công tới Ronald Jack 009 tại ${ip}:${port}`
      };
    } catch (err) {
      if (zkInstance) {
        try { await zkInstance.disconnect(); } catch (_) {}
      }
      return {
        success: false,
        ip,
        port,
        error: err.message,
        message: `Không thể kết nối tới Ronald Jack 009 tại ${ip}:${port}: ${err.message}`
      };
    }
  }

  // Thuật toán lọc bỏ các bản ghi chấm công trùng lặp:
  // Nếu nhân viên quẹt liên tục nhiều lần trong vài phút -> chỉ lấy giờ vào sớm nhất và giờ ra trễ nhất
  deduplicateLogs(rawLogs, gapMinutes = 5) {
    if (!Array.isArray(rawLogs) || rawLogs.length === 0) return [];

    // Nhóm log theo Mã nhân viên / attendance_code + Ngày (YYYY-MM-DD)
    const groups = new Map();

    rawLogs.forEach(log => {
      const code = String(log.attendance_code || log.deviceUserId || log.userId || '').trim();
      if (!code) return;

      const timeStr = String(log.timestamp || log.recordTime || '');
      const dMatch = timeStr.match(/^(\d{4}-\d{2}-\d{2})/);
      const dateKey = dMatch ? dMatch[1] : new Date().toISOString().split('T')[0];
      const groupKey = `${code}_${dateKey}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey).push({
        ...log,
        attendance_code: code,
        parsedTime: new Date(timeStr).getTime() || 0
      });
    });

    const resultLogs = [];

    groups.forEach((logsInDay) => {
      // Sắp xếp tăng dần theo thời gian
      logsInDay.sort((a, b) => a.parsedTime - b.parsedTime);

      if (logsInDay.length === 1) {
        resultLogs.push(logsInDay[0]);
        return;
      }

      // Lấy bản ghi sớm nhất (Giờ vào)
      const earliest = logsInDay[0];
      resultLogs.push(earliest);

      // Lấy bản ghi muộn nhất (Giờ ra) nếu cách bản ghi sớm nhất ít nhất gapMinutes
      const latest = logsInDay[logsInDay.length - 1];
      const diffMinutes = (latest.parsedTime - earliest.parsedTime) / (60 * 1000);

      if (diffMinutes >= gapMinutes && latest !== earliest) {
        resultLogs.push(latest);
      }
    });

    // Sắp xếp lại theo thời gian toàn cục
    resultLogs.sort((a, b) => a.parsedTime - b.parsedTime);
    return resultLogs;
  }

  // Kéo dữ liệu chấm công từ 1 máy
  async pullLogsFromDevice(device) {
    if (!device || !device.enabled) return [];

    const rawRecords = [];

    if (ZKLib) {
      let zk = null;
      try {
        zk = new ZKLib(device.ip, parseInt(device.port, 10), 15000, 4000);
        await zk.createSocket();
        const logs = await zk.getAttendances();
        await zk.disconnect();

        if (logs && Array.isArray(logs.data)) {
          logs.data.forEach(item => {
            rawRecords.push({
              attendance_code: String(item.deviceUserId || item.userId || '').trim(),
              timestamp: this.formatDateTime(item.recordTime),
              device_ip: device.ip,
              device_port: device.port,
              device_name: device.name,
              verify_type: item.verifyType || 1
            });
          });
        }
        device.last_sync = new Date().toISOString();
        device.status = 'ONLINE';
      } catch (err) {
        if (zk) {
          try { await zk.disconnect(); } catch (_) {}
        }
        device.status = 'OFFLINE';
        console.warn(`[RonaldJackService] Không thể kéo dữ liệu từ ${device.ip}:${device.port} (${err.message}).`);
      }
    }

    return rawRecords;
  }

  // Kéo dữ liệu từ toàn bộ danh sách máy đang kích hoạt
  async pullLogsFromAllDevices() {
    if (this.isSyncing) return [];
    this.isSyncing = true;

    try {
      const allRawLogs = [];
      for (const dev of this.devices) {
        if (dev.enabled) {
          const logs = await this.pullLogsFromDevice(dev);
          allRawLogs.push(...logs);
        }
      }

      const deduplicated = this.deduplicateLogs(allRawLogs);
      if (this.onNewLogsCallback && deduplicated.length > 0) {
        await this.onNewLogsCallback(deduplicated);
      }
      return deduplicated;
    } finally {
      this.isSyncing = false;
    }
  }

  formatDateTime(d) {
    if (!d) return new Date().toISOString().replace('T', ' ').substring(0, 19);
    const date = new Date(d);
    if (isNaN(date.getTime())) return String(d);
    const YYYY = date.getFullYear();
    const MM = String(date.getMonth() + 1).padStart(2, '0');
    const DD = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss}`;
  }

  // Trình tạo dữ liệu chấm công mô phỏng thực tế cho mục đích kiểm thử
  generateSimulatedLogs(employees, targetDateStr = null) {
    const date = targetDateStr || new Date().toISOString().split('T')[0];
    const logs = [];

    (employees || []).forEach(emp => {
      const code = emp.attendance_code || emp.time_attendance_code || emp.employee_id.replace(/[^0-9]/g, '');
      if (!code) return;

      // Giả lập giờ vào (dao động 07:45 đến 08:25)
      const inHour = 8;
      const inMin = Math.floor(Math.random() * 40) - 15; // -15 đến +25
      const realInHour = inMin < 0 ? 7 : inHour;
      const realInMin = inMin < 0 ? 60 + inMin : inMin;
      const inTime = `${date} ${String(realInHour).padStart(2, '0')}:${String(realInMin).padStart(2, '0')}:${String(Math.floor(Math.random() * 59)).padStart(2, '0')}`;

      // Giả lập quẹt lặp nhiều lần lúc vào (để kiểm tra thuật toán khử trùng lặp)
      logs.push({
        attendance_code: String(code),
        timestamp: inTime,
        device_ip: '192.168.1.201',
        device_port: 5005,
        device_name: 'Ronald Jack 009 - Cửa Chính',
        verify_type: 'Khuôn mặt'
      });
      // Quẹt lại 1 phút sau
      const dupInMin = (realInMin + 1) % 60;
      logs.push({
        attendance_code: String(code),
        timestamp: `${date} ${String(realInHour).padStart(2, '0')}:${String(dupInMin).padStart(2, '0')}:12`,
        device_ip: '192.168.1.201',
        device_port: 5005,
        device_name: 'Ronald Jack 009 - Cửa Chính',
        verify_type: 'Khuôn mặt'
      });

      // Giả lập giờ ra (dao động 17:20 đến 19:15)
      const outMinOffset = Math.floor(Math.random() * 115) - 10; // -10 đến +105 phút so với 17:30
      const totalOutMin = (17 * 60 + 30) + outMinOffset;
      const outH = Math.floor(totalOutMin / 60);
      const outM = totalOutMin % 60;
      const outTime = `${date} ${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}:${String(Math.floor(Math.random() * 59)).padStart(2, '0')}`;

      logs.push({
        attendance_code: String(code),
        timestamp: outTime,
        device_ip: '192.168.1.201',
        device_port: 5005,
        device_name: 'Ronald Jack 009 - Cửa Chính',
        verify_type: 'Khuôn mặt'
      });
    });

    return this.deduplicateLogs(logs);
  }
}

const ronaldJackService = new RonaldJackService();

module.exports = {
  RonaldJackService,
  ronaldJackService
};
