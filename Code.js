// ✅ 全域變數與常數
const ss = SpreadsheetApp.getActiveSpreadsheet();
const sheetBooking = ss.getSheetByName('BookingData');
const sheetSetting = ss.getSheetByName('設定');
const sheetSummary = ss.getSheetByName('BookingSummary');

// 💡 移除硬編碼的 TIME_SLOTS 陣列。

function getSettings() {
  function toUcViewUrl(url) {
    if (!url) return "";
    var m =
      url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/) ||
      url.match(/\/d\/([a-zA-Z0-9_-]{10,})(?:[\/?]|$)/) ||
      url.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]{10,})/);
    var id = m ? m[1] : "";
    return id ? ("https://drive.google.com/uc?export=view&id=" + id) : url;
  }
  
  return {
    activityDate: new Date(Utilities.formatDate(sheetSetting.getRange('C2').getValue(), "Asia/Taipei", "yyyy/MM/dd")),
    startDate: new Date(Utilities.formatDate(sheetSetting.getRange('C3').getValue(), "Asia/Taipei", "yyyy/MM/dd")),
    slotStartTime: normalizeTime(sheetSetting.getRange('C6').getValue()),
    slotEndTime: normalizeTime(sheetSetting.getRange('C7').getValue()),
    slotIntervalMinutes: sheetSetting.getRange('C8').getValue() || 30, // 預設 30 分鐘間隔
    maxPerSlot: sheetSetting.getRange('C9').getValue(),
    activityPlace: sheetSetting.getRange('C10').getValue(),
    activityContact: sheetSetting.getRange('C12').getValue(),
    promoImage: toUcViewUrl(String(sheetSetting.getRange('C13').getValue() || "")),
    promoLink: sheetSetting.getRange('C14').getValue(),
    secondPromoImage: toUcViewUrl(String(sheetSetting.getRange('C15').getValue() || "")),
    secondPromoLink: sheetSetting.getRange('C16').getValue(),
  };
}

function corsJsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function doOptions(e) {
  return ContentService.createTextOutput("").setMimeType(ContentService.MimeType.TEXT);
}

function initializeSheetFormat() {
  sheetBooking.getRange(2, 3, sheetBooking.getMaxRows() - 1).setNumberFormat('@STRING@');
  sheetBooking.getRange(2, 5, sheetBooking.getMaxRows() - 1).setNumberFormat('@STRING@');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidMobile(num) {
  return /^09\d{8}$/.test(num);
}

function isValidLandline(num) {
  return /^(0(?:2|3|4|5|6|7|8|82|836|89))-?\d{6,8}$/.test(num);
}

// 💡 輔助函式：將 HH:MM 轉換為總分鐘數
function toMinutes(timestr) {
  if (!timestr || typeof timestr !== 'string') return NaN;
  const match = timestr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return NaN;
  const [h, m] = [Number(match[1]), Number(match[2])];
  return h * 60 + m;
}

function normalizeTime(raw) {
  if (raw instanceof Date) {
    const h = raw.getHours();
    const m = raw.getMinutes();
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }
  const rawStr = String(raw).trim();
  const tryDate = new Date(rawStr);
  if (!isNaN(tryDate) && rawStr.includes(':')) {
    const h = tryDate.getHours();
    const m = tryDate.getMinutes();
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }
  return rawStr;
}

// 💡 NEW FUNCTION: 動態生成時段
function generateTimeSlots() {
  const { slotStartTime, slotEndTime, slotIntervalMinutes } = getSettings();
  
  const startTimeMin = toMinutes(slotStartTime);
  const endTimeMin = toMinutes(slotEndTime);
  const interval = Number(slotIntervalMinutes);

  if (isNaN(startTimeMin) || isNaN(endTimeMin) || isNaN(interval) || interval <= 0 || startTimeMin >= endTimeMin) {
    Logger.log("Invalid time slot settings. Returning empty array.");
    return []; // 設定無效時返回空陣列
  }

  const slots = [];
  // currentMin < endTimeMin 確保 endTime 本身不會被包含
  for (let currentMin = startTimeMin; currentMin < endTimeMin; currentMin += interval) {
    const hours = Math.floor(currentMin / 60);
    const minutes = currentMin % 60;
    // 格式化為 "HH:MM"
    slots.push(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
  }
  
  return slots;
}


function updateBookingSummary() {
  const TIME_SLOTS = generateTimeSlots(); // 💡 使用動態時段
  const { maxPerSlot } = getSettings();
  const data = sheetBooking.getDataRange().getValues();
  const validStatuses = ['待確認', '已確認'];
  const slotMap = {};
  TIME_SLOTS.forEach(slot => slotMap[slot] = []);

  for (let i = 1; i < data.length; i++) {
    const [token, name, email, phone, timeslot, status, , note] = data[i];
    // 檢查 timeslot 是否是有效時段
    if (TIME_SLOTS.includes(timeslot) && validStatuses.includes(status) && slotMap[timeslot]?.length < maxPerSlot) {
      slotMap[timeslot].push([token, name, email, phone, status, note || '']);
    }
  }

  const summaryData = [];
  TIME_SLOTS.forEach(slot => {
    const bookings = slotMap[slot];
    // 如果時段沒有預約，我們仍需要為每個 maxPerSlot 填入空行
    for (let i = 0; i < maxPerSlot; i++) {
      const [token, name, email, phone, status, note] = bookings?.[i] || [];
      summaryData.push([
        slot,
        token || '',
        name || '',
        email || '',
        phone ? `'${String(phone)}` : '',
        status || '',
        note || ''
      ]);
    }
  });

  const lastRow = sheetSummary.getLastRow();
  // 清除舊資料時，使用 getLastRow() - 1 是錯的，應該是 lastRow > 1
  if (lastRow > 1) sheetSummary.getRange(2, 1, lastRow - 1, 7).clearContent();
  if (summaryData.length > 0) sheetSummary.getRange(2, 1, summaryData.length, 7).setValues(summaryData);
}

function doPost(e) {
  // 1. 取得腳本鎖定物件
  const lock = LockService.getScriptLock();
  // 設定等待鎖定的時間上限（例如 10 秒 = 10000 毫秒）
  const LOCK_WAIT_TIMEOUT = 10000; 
  
  try {
    const data = JSON.parse(e.postData.contents);
    const { name, email, phone, timeslot } = data;
    
    // --- 可以在鎖定前先進行不涉及試算表存取的基本驗證 ---
    if (!name || !email || !phone || !timeslot) throw new Error("缺少必要欄位");
    if (!isValidEmail(email)) return corsJsonResponse({ status: 'error', message: 'Email 格式不正確，請重新輸入' });
    if (!isValidMobile(phone) && !isValidLandline(phone)) return corsJsonResponse({ status: 'error', message: '電話格式不正確' });
    
    // 💡 檢查時段是否有效
    const TIME_SLOTS = generateTimeSlots();
    if (!TIME_SLOTS.includes(timeslot)) {
      return corsJsonResponse({ status: 'error', message: '時段無效，請重新選擇' });
    }

    // 2. 等待取得鎖定 (此處是關鍵，確保多個請求會排隊等待)
    lock.waitLock(LOCK_WAIT_TIMEOUT); 
    
    // ===========================================
    // START: 競爭條件的「關鍵區塊」
    // ===========================================
    
    const { maxPerSlot, activityDate, activityPlace, activityContact } = getSettings();
    // 重新讀取試算表中的所有資料 (確保是最新狀態)
    const allRows = sheetBooking.getDataRange().getValues();
    const invalidStates = ["已取消", "回覆逾期", "已拒絕"];

    // 重新檢查重複預約 (讀取 Sheet)
    const emailExists = allRows.some(row => row[2] === email && !invalidStates.includes(row[5]));
    const phoneExists = allRows.some(row => row[3] === phone && !invalidStates.includes(row[5]));
    if (emailExists || phoneExists) {
      const field = emailExists && phoneExists ? "電子郵件與電話" : emailExists ? "電子郵件" : "電話";
      lock.releaseLock(); 
      return corsJsonResponse({ status: 'error', message: `此${field}已預約過` });
    }

    // 重新檢查名額 (讀取 Sheet，確保在鎖定內進行)
    const currentCount = allRows.filter(row => row[4] === timeslot && ["待確認", "已確認"].includes(row[5])).length;
    if (currentCount >= maxPerSlot) {
      lock.releaseLock(); 
      return corsJsonResponse({ status: 'error', message: '此時段已額滿' });
    }

    // 寫入預約資料 (寫入 Sheet，這是原子操作的結尾)
    const now = new Date();
    const id = `Q${Math.floor((now.getMonth() + 3) / 3)}-${now.getFullYear()}-${Utilities.getUuid().slice(0, 8)}`;
    const values = [id, name, email, phone, timeslot, '待確認', now, ''];

    sheetBooking.getRange(sheetBooking.getLastRow() + 1, 1, 1, values.length).setValues([values]);
    sheetBooking.getRange(sheetBooking.getLastRow(), 4).setNumberFormat('@STRING@');
    sheetBooking.getRange(sheetBooking.getLastRow(), 5).setNumberFormat('@STRING@');

    // 更新總表 (寫入 Sheet)
    updateBookingSummary();
    
    // 3. 釋放鎖定 (在成功完成所有寫入操作後釋放)
    lock.releaseLock(); 
    
    // ===========================================
    // END: 競爭條件的「關鍵區塊」
    // ===========================================

    // 4. 寄送郵件 (不涉及 Sheet 寫入，可在鎖定釋放後執行)
    const confirmUrl = `https://blood-booking.vercel.app/confirm?token=${id}`;
    const cancelUrl = `https://blood-booking.vercel.app/cancel?token=${id}`;
    
    // ✅ 修正地圖 URL 建構錯誤
    const mapUrl = `https://www.google.com/maps/search/${encodeURIComponent(activityPlace)}`;

    MailApp.sendEmail({
      to: email,
      subject: '🩸 捐血預約確認通知',
      htmlBody: `
        <p>親愛的 ${name}，</p>
        <p>感謝您使用本系統預約於 ${activityDate.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })} 舉辦的捐血活動</p>
        <p>本次捐血地點為： <a href="${mapUrl}">${activityPlace}</a></p>
        <p>您已申請預約 ${timeslot} 捐血時段，請點選下方連結完成確認：</p>
        <p><a href="${confirmUrl}">👉 點我完成預約確認</a></p>
        <p>若您希望取消此次預約，可點選：<a href="${cancelUrl}">取消預約</a></p>
        <p>請您於預約時間<strong>10分鐘</strong>前至捐血地點完成報到</p>
        <p>預約將為您保留<strong>15分鐘</strong>，若超時則將取消預約資料並需改為現場抽號碼牌</p>
        <p>感謝配合，並誠摯謝謝您的熱心捐血！</p>
        <p>聯絡資訊：請私訊<a href="${activityContact}">良全預拌混凝土粉絲專頁</a></p>`
    });

    return corsJsonResponse({ status: 'success', id });

  } catch (error) {
    // 5. 錯誤處理：如果程式碼在取得鎖定後發生錯誤，必須確保鎖定被釋放。
    if (lock.hasLock()) {
      lock.releaseLock();
    }
    
    let errorMessage = error.message;
    // 如果是鎖定等待超時的錯誤，給予友善提示
    if (error.message.includes('Timeout')) {
      errorMessage = "系統繁忙，請稍後再試。";
    }

    return corsJsonResponse({ status: 'error', message: errorMessage });
  }
}

function doGet(e) {
  const { type, token } = e.parameter;
  if (!type) return corsJsonResponse({ status: 'error', message: '缺少 type' });

  const { maxPerSlot, startDate, activityDate, activityPlace, activityContact, promoImage, promoLink, secondPromoImage, secondPromoLink } = getSettings();
  const data = sheetBooking.getDataRange().getValues();
  const now = new Date();

  if (type === 'confirm' || type === 'cancel') {
    if (!token) return corsJsonResponse({ status: 'error', message: '缺少 token' });
    const rowIndex = data.findIndex(row => row[0] === token);
    if (rowIndex === -1) return corsJsonResponse({ status: 'error', message: '查無預約資料' });
    const status = data[rowIndex][5];
    if (type === 'confirm' && status === '待確認') {
      sheetBooking.getRange(rowIndex + 1, 6).setValue('已確認');
      sheetBooking.getRange(rowIndex + 1, 7).setValue(new Date());
      updateBookingSummary();
      return corsJsonResponse({ status: 'success', message: '預約確認成功' });
    } else if (type === 'confirm' && status === '已取消') {
      return corsJsonResponse({ status: 'canceled', message: '預約已取消' });
    } else if (type === 'cancel' && (status === '待確認' || status === '已確認')) {
      sheetBooking.getRange(rowIndex + 1, 6).setValue('已取消');
      sheetBooking.getRange(rowIndex + 1, 7).setValue(new Date());
      updateBookingSummary();
      return corsJsonResponse({ status: 'success', message: '預約已取消' });
    } else {
      return corsJsonResponse({ status: 'info', message: '狀態不需操作' });
    }
  }
  
  if (type === 'summary') {
    if (!token) return corsJsonResponse({ status: 'error', message: '缺少 token' });

    const rowIndex = data.findIndex(row => row[0] === token);
    if (rowIndex === -1) return corsJsonResponse({ status: 'error', message: '查無預約資料' });

    // 欄位: [id, name, email, phone, timeslot, status, createTime]
    const [id, name, email, phone, timeslot, status, createTime] = data[rowIndex];
    const { activityDate } = getSettings();
    const deadlineDate = new Date(activityDate);
    
    // 計算截止日期：取 (created + 7天) 和 (activityDate) 中較早者
    const created = new Date(createTime);
    const deadlineTimestamp = Math.min(created.getTime() + 7 * 24 * 60 * 60 * 1000, deadlineDate.getTime());
    
    // 轉換為 ISO 格式方便前端解析
    const deadline = new Date(deadlineTimestamp).toISOString(); 
    
    return corsJsonResponse({ 
      status: 'success', 
      data: {
        bookingId: id, 
        name, 
        email, 
        // 移除 GAS 為了儲存數字格式而加的單引號
        phone: String(phone).replace(/^'/, ''), 
        timeslot, 
        status, 
        deadline 
      }
    });
  }

  if (type === 'availability') {
    const TIME_SLOTS = generateTimeSlots(); // 💡 使用動態時段
    const capacityMap = {};
    TIME_SLOTS.forEach(slot => capacityMap[slot] = maxPerSlot);

    for (let i = 1; i < data.length; i++) {
      const [ , , , , rawSlot, status ] = data[i];
      const timeSlot = normalizeTime(rawSlot);
      // 確保只計算在動態生成的 TIME_SLOTS 內的時段
      if (TIME_SLOTS.includes(timeSlot) && ["待確認", "已確認"].includes(status)) {
        capacityMap[timeSlot] = Math.max(0, capacityMap[timeSlot] - 1);
      }
    }

    const bookingClosed = now >= new Date(activityDate.getTime());
    const notYetOpen = now < startDate;

    return corsJsonResponse({
      status: "success",
      data: capacityMap,
      bookingClosed,
      notYetOpen,
      activityInfo: {
        date: Utilities.formatDate(activityDate, "Asia/Taipei", "yyyy/MM/dd"),
        place: activityPlace,
        contact: activityContact,
        startDate: Utilities.formatDate(startDate, "Asia/Taipei", "yyyy/MM/dd"),
        promoImage: promoImage,
        promoLink: promoLink,
        secondPromoImage: secondPromoImage,
        secondPromoLink: secondPromoLink,
      }
    });
  }

  return corsJsonResponse({ status: 'error', message: '未知的請求類型' });
}

function sendReminderBeforeEvent() {
  const { activityDate, activityPlace, activityContact } = getSettings();
  const today = new Date();
  const reminderDay = new Date(activityDate);
  reminderDay.setDate(activityDate.getDate() - 1);
  if (today.toDateString() !== reminderDay.toDateString()) return;

  const data = sheetBooking.getDataRange().getValues();
  // ✅ 修正地圖 URL 建構錯誤
  const mapUrl = `https://maps.google.com/maps?q=$${encodeURIComponent(activityPlace)}`;

  data.forEach((row, i) => {
    if (i === 0) return;
    const [id, name, email, , timeslot, status] = row;
    if (status !== '已確認') return;

    MailApp.sendEmail({
      to: email,
      subject: '📢 捐血提醒通知（明日活動）',
      htmlBody: `<p>親愛的 ${name}，</p>
        <p>感謝您預約參加我們的捐血活動！以下為明日活動資訊，請準時前往：</p>
        <ul>
          <li><strong>預約時段：</strong> ${timeslot}</li>
          <li><strong>活動地點：</strong> <a href="${mapUrl}">${activityPlace}</a><br>
        </ul>
        <p>若您無法前來，請儘早告知以便釋出名額。</p>
        <p>謝謝您支持捐血活動，期待與您見面！</p>
        <p>聯絡資訊：請私訊<a href="${activityContact}">良全預拌混凝土粉絲專頁</a></p>`
    });
  });
}

function checkExpiredBookings() {
  const { activityDate, activityContact } = getSettings();
  const today = new Date();
  const deadlineDate = new Date(activityDate);
  deadlineDate.setDate(activityDate.getDate());

  const data = sheetBooking.getDataRange().getValues();

  data.forEach((row, i) => {
    if (i === 0) return;
    const [id, name, email, , timeslot, status, createTime] = row;
    if (status !== '待確認') return;

    const created = new Date(createTime);
    const deadline = new Date(Math.min(created.getTime() + 7 * 24 * 60 * 60 * 1000, deadlineDate.getTime()));
    const daysLeft = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));

    if (daysLeft === 1) {
      MailApp.sendEmail({
        to: email,
        subject: '🔔 捐血預約確認提醒',
        htmlBody: `<p>親愛的 ${name}，</p>
          <p>請盡速完成您於 <strong>${timeslot}</strong> 的捐血預約確認，確認截止日為 <strong>${deadline.toLocaleDateString('zh-TW')}</strong>：</p>
          <p><a href="https://blood-booking.vercel.app/confirm?token=${id}">✅ 點我完成預約確認</a></p>
          <p>若您已不克前來，可忽略此信，或點此<a href="https://blood-booking.vercel.app/cancel?token=${id}">取消預約</a>。</p>
          <p>聯絡資訊：請私訊<a href="${activityContact}">良全預拌混凝土粉絲專頁</a></p>`
      });
    } else if (daysLeft < 0) {
      sheetBooking.getRange(i + 1, 6).setValue('回覆逾期');
      sheetBooking.getRange(i + 1, 7).setValue(new Date());
      MailApp.sendEmail({
        to: email,
        subject: '❌ 預約已取消（逾期未確認）',
        htmlBody: `<p>親愛的 ${name}，</p>
          <p>由於您未於期限內完成捐血活動的預約確認，您預約的 <strong>${timeslot}</strong> 時段已被系統自動取消。</p>
          <p>若仍想參與，可<a href="https://blood-booking.vercel.app">重新預約</a>尚有空位的時段。感謝您的支持！</p>
          <p>聯絡資訊：請私訊<a href="${activityContact}">良全預拌混凝土粉絲專頁</a></p>`
      });
    }
  });
}