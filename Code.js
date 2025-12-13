// ✅ 全域變數與常數
const ss = SpreadsheetApp.getActiveSpreadsheet();
const sheetBooking = ss.getSheetByName('BookingData');
const sheetSetting = ss.getSheetByName('設定');
const sheetSummary = ss.getSheetByName('BookingSummary');

// ⬇️ REUSED: 提取 Drive 檔案 ID 的輔助函數
function getDriveFileId(url) {
  if (!url) return null;
  var m =
    url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/) ||
    url.match(/\/d\/([a-zA-Z0-9_-]{10,})(?:[\/?]|$)/) ||
    url.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]{10,})/);
  if (!m && url.length > 20 && url.match(/^[a-zA-Z0-9_-]+$/)) return url;
  return m ? m[1] : null;
}

// ⬇️ REUSED: 格式化日期時間為 yyyy/MM/dd HH:mm
function formatDateTime(date) {
  if (!date) return '';
  return Utilities.formatDate(date, "Asia/Taipei", "yyyy/MM/dd HH:mm");
}

// ⬇️ CRITICAL FIX: 修正地圖連結生成邏輯 (解決 email 錯誤)
function toClickableMapUrl(rawUrl, placeName) {
  // 檢查連結是否是 Google Maps 嵌入碼、無效的連結或我們上一步生成的錯誤連結。
  if (!rawUrl || rawUrl.includes('/embed') || !rawUrl.match(/^https?:\/\//i) || rawUrl.includes('/dir') || rawUrl.includes('googleusercontent.com')) {
    if (placeName) {
      // 建立 Google Maps 搜尋連結 (查詢模式, ?query=)
      const encodedPlace = encodeURIComponent(placeName); // 修正 1: 移除 Utilities.
      // ✅ 修正：使用標準且正確的 Google Maps 搜尋 URL
      return `https://www.google.com/maps/search/?api=1&query=${encodedPlace}`; // 修正 2: 正確的 Google Maps URL 格式
    }
    return '';
  }
  
  // 如果連結看起來是個正常的 URL (且不是 embed 或 dir)，則直接回傳
  return rawUrl;
}

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
    // ⬇️ CRITICAL FIX: 修正時區拼寫錯誤 (解決首頁內容消失)
    startDate: new Date(Utilities.formatDate(sheetSetting.getRange('C3').getValue(), "Asia/Taipei", "yyyy/MM/dd")),
    bookingCutoffDate: new Date(Utilities.formatDate(sheetSetting.getRange('C4').getValue(), "Asia/Taipei", "yyyy/MM/dd")),
    slotStartTime: normalizeTime(sheetSetting.getRange('C6').getValue()),
    slotEndTime: normalizeTime(sheetSetting.getRange('C7').getValue()),
    slotIntervalMinutes: sheetSetting.getRange('C8').getValue() || 30, // 預設 30 分鐘間隔
    maxPerSlot: sheetSetting.getRange('C9').getValue(),
    activityPlace: sheetSetting.getRange('C10').getValue(),
    activityMapUrl: sheetSetting.getRange('C11').getValue(), // <== 地圖連結/嵌入碼 URL
    promoText: sheetSetting.getRange('C12').getValue(),
    activityContact: sheetSetting.getRange('C14').getValue(),
    // ⬇️ UPDATE: 存儲原始連結，讓 doGet 轉換成 Image Proxy URL
    promoImageRaw: String(sheetSetting.getRange('C15').getValue() || ""),
    promoLink: sheetSetting.getRange('C16').getValue(),
    secondPromoImageRaw: String(sheetSetting.getRange('C17').getValue() || ""),
    secondPromoLink: sheetSetting.getRange('C18').getValue(),
  };
}

function corsJsonResponse(payload) {
  // ... (省略)
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function doOptions(e) {
  // ... (省略)
  return ContentService.createTextOutput("").setMimeType(ContentService.MimeType.TEXT);
}

function initializeSheetFormat() {
  // ... (省略)
  sheetBooking.getRange(2, 3, sheetBooking.getMaxRows() - 1).setNumberFormat('@STRING@');
  sheetBooking.getRange(2, 5, sheetBooking.getMaxRows() - 1).setNumberFormat('@STRING@');
}

function isValidEmail(email) {
  // ... (省略)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidMobile(num) {
  // ... (省略)
  return /^09\d{8}$/.test(num);
}

function isValidLandline(num) {
  // ... (省略)
  return /^(0(?:2|3|4|5|6|7|8|82|836|89))-?\d{6,8}$/.test(num);
}

function toMinutes(timestr) {
  // ... (省略)
  if (!timestr || typeof timestr !== 'string') return NaN;
  const match = timestr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return NaN;
  const [h, m] = [Number(match[1]), Number(match[2])];
  return h * 60 + m;
}

function normalizeTime(raw) {
  // ... (省略)
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

function generateTimeSlots() {
  // ... (省略)
  const { slotStartTime, slotEndTime, slotIntervalMinutes } = getSettings();
  
  const startTimeMin = toMinutes(slotStartTime);
  const endTimeMin = toMinutes(slotEndTime);
  const interval = Number(slotIntervalMinutes);

  if (isNaN(startTimeMin) || isNaN(endTimeMin) || isNaN(interval) || interval <= 0 || startTimeMin >= endTimeMin) {
    Logger.log("Invalid time slot settings. Returning empty array.");
    return []; 
  }

  const slots = [];
  for (let currentMin = startTimeMin; currentMin < endTimeMin; currentMin += interval) {
    const hours = Math.floor(currentMin / 60);
    const minutes = currentMin % 60;
    slots.push(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
  }
  
  return slots;
}


function updateBookingSummary() {
  // ... (省略)
  const TIME_SLOTS = generateTimeSlots(); 
  const { maxPerSlot } = getSettings();
  const data = sheetBooking.getDataRange().getValues();
  const validStatuses = ['待確認', '已確認'];
  const slotMap = {};
  TIME_SLOTS.forEach(slot => slotMap[slot] = []);

  for (let i = 1; i < data.length; i++) {
    const [token, name, email, phone, timeslot, status, , note] = data[i];
    if (TIME_SLOTS.includes(timeslot) && validStatuses.includes(status) && slotMap[timeslot]?.length < maxPerSlot) {
      slotMap[timeslot].push([token, name, email, phone, status, note || '']);
    }
  }

  const summaryData = [];
  TIME_SLOTS.forEach(slot => {
    const bookings = slotMap[slot];
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
  if (lastRow > 1) sheetSummary.getRange(2, 1, lastRow - 1, 7).clearContent();
  if (summaryData.length > 0) sheetSummary.getRange(2, 1, summaryData.length, 7).setValues(summaryData);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  const LOCK_WAIT_TIMEOUT = 10000; 
  
  try {
    const data = JSON.parse(e.postData.contents);
    const { name, email, phone, timeslot } = data;
    
    // ... (省略前置檢查)
    if (!name || !email || !phone || !timeslot) throw new Error("缺少必要欄位");
    if (!isValidEmail(email)) return corsJsonResponse({ status: 'error', message: 'Email 格式不正確，請重新輸入' });
    if (!isValidMobile(phone) && !isValidLandline(phone)) return corsJsonResponse({ status: 'error', message: '電話格式不正確' });
    
    const TIME_SLOTS = generateTimeSlots();
    if (!TIME_SLOTS.includes(timeslot)) {
      return corsJsonResponse({ status: 'error', message: '時段無效，請重新選擇' });
    }

    lock.waitLock(LOCK_WAIT_TIMEOUT); 
    
    const { maxPerSlot, activityDate, activityPlace, activityContact, activityMapUrl } = getSettings();
    const allRows = sheetBooking.getDataRange().getValues();
    const invalidStates = ["已取消", "回覆逾期", "已拒絕"];

    const emailExists = allRows.some(row => row[2] === email && !invalidStates.includes(row[5]));
    const phoneExists = allRows.some(row => row[3] === phone && !invalidStates.includes(row[5]));
    if (emailExists || phoneExists) {
      const field = emailExists && phoneExists ? "電子郵件與電話" : emailExists ? "電子郵件" : "電話";
      lock.releaseLock(); 
      return corsJsonResponse({ status: 'error', message: `此${field}已預約過` });
    }

    const currentCount = allRows.filter(row => row[4] === timeslot && ["待確認", "已確認"].includes(row[5])).length;
    if (currentCount >= maxPerSlot) {
      lock.releaseLock(); 
      return corsJsonResponse({ status: 'error', message: '此時段已額滿' });
    }

    const now = new Date();
    const id = `Q${Math.floor((now.getMonth() + 3) / 3)}-${now.getFullYear()}-${Utilities.getUuid().slice(0, 8)}`;
    // ⬇️ UPDATE: 使用 formatDateTime 儲存建立時間
    const values = [id, name, email, phone, timeslot, '待確認', formatDateTime(now), ''];

    sheetBooking.getRange(sheetBooking.getLastRow() + 1, 1, 1, values.length).setValues([values]);
    sheetBooking.getRange(sheetBooking.getLastRow(), 4).setNumberFormat('@STRING@');
    sheetBooking.getRange(sheetBooking.getLastRow(), 5).setNumberFormat('@STRING@');

    updateBookingSummary();
    
    lock.releaseLock(); 
    
    const confirmUrl = `https://blood-booking.vercel.app/confirm?token=${id}`;
    const cancelUrl = `https://blood-booking.vercel.app/cancel?token=${id}`;
    
    // ⬇️ UPDATE: 使用修正後的 toClickableMapUrl 處理地圖連結
    const mapLink = toClickableMapUrl(activityMapUrl, activityPlace);

    MailApp.sendEmail({
      to: email,
      subject: '🩸 捐血預約確認通知',
      htmlBody: `
        <p>親愛的 ${name}，</p>
        <p>感謝您使用本系統預約於 ${activityDate.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })} 舉辦的捐血活動</p>
        <p>本次捐血地點為： <a href="${mapLink}">${activityPlace}</a></p>
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
    if (lock.hasLock()) {
      lock.releaseLock();
    }
    
    let errorMessage = error.message;
    if (error.message.includes('Timeout')) {
      errorMessage = "系統繁忙，請稍後再試。";
    }

    return corsJsonResponse({ status: 'error', message: errorMessage });
  }
}

function doGet(e) {
  const { type, token, id } = e.parameter;
  
  // ⬇️ NEW: 圖片代理邏輯 (必須在 JSON 邏輯之前執行)
  if (type === 'image' && id) {
    try {
      const file = DriveApp.getFileById(id);
      const blob = file.getBlob();
      
      // 直接返回 Blob 物件，讓 Apps Script 服務處理 Content-Type 和 CORS
      return blob; 
    } catch (err) {
      Logger.log(`Image Proxy Error for ID ${id}: ${err.message}`);
      // 返回一個透明的 1x1 像素圖片，避免圖片元件崩潰
      const transparentBlob = Utilities.newBlob(Utilities.base64Decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYGD4DwAADgAEAQAHCAAAAABJRU5ErkJggg=="), "image/png");
      return transparentBlob;
    }
  }
  
  if (!type) return corsJsonResponse({ status: 'error', message: '缺少 type' });

  // 💡 NEW: 讀取所有設定
  const settings = getSettings(); // ❗ 此處的 getSettings 修正後將解決首頁內容消失的問題
  const { maxPerSlot, startDate, activityDate, activityPlace, activityMapUrl, activityContact, promoImageRaw, promoLink, secondPromoImageRaw, secondPromoLink, bookingCutoffDate, promoText } = settings;
  const data = sheetBooking.getDataRange().getValues();
  const now = new Date();

  if (type === 'confirm' || type === 'cancel') {
    // ... (省略 confirm/cancel 邏輯)
    if (!token) return corsJsonResponse({ status: 'error', message: '缺少 token' });
    const rowIndex = data.findIndex(row => row[0] === token);
    if (rowIndex === -1) return corsJsonResponse({ status: 'error', message: '查無預約資料' });
    const status = data[rowIndex][5];
    if (type === 'confirm' && status === '待確認') {
      sheetBooking.getRange(rowIndex + 1, 6).setValue('已確認');
      // ⬇️ UPDATE: 使用 formatDateTime 儲存確認時間
      sheetBooking.getRange(rowIndex + 1, 7).setValue(formatDateTime(new Date()));
      updateBookingSummary();
      return corsJsonResponse({ status: 'success', message: '預約確認成功' });
    } else if (type === 'confirm' && status === '已取消') {
      return corsJsonResponse({ status: 'canceled', message: '預約已取消' });
    } else if (type === 'cancel' && (status === '待確認' || status === '已確認')) {
      sheetBooking.getRange(rowIndex + 1, 6).setValue('已取消');
      // ⬇️ UPDATE: 使用 formatDateTime 儲存取消時間
      sheetBooking.getRange(rowIndex + 1, 7).setValue(formatDateTime(new Date()));
      updateBookingSummary();
      return corsJsonResponse({ status: 'success', message: '預約已取消' });
    } else {
      return corsJsonResponse({ status: 'info', message: '狀態不需操作' });
    }
  }
  
  if (type === 'summary') {
    // ... (省略 summary 邏輯)
    if (!token) return corsJsonResponse({ status: 'error', message: '缺少 token' });

    const rowIndex = data.findIndex(row => row[0] === token);
    if (rowIndex === -1) return corsJsonResponse({ status: 'error', message: '查無預約資料' });

    const [id, name, email, phone, timeslot, status, createTime] = data[rowIndex];
    
    // 💡 修正：使用 bookingCutoffDate 作為最終截止日
    const deadlineDate = new Date(bookingCutoffDate); 
    
    // 計算截止日期：取 (created + 7天) 和 (預約截止日) 中較早者
    // createTime 現在是 yyyy/MM/dd HH:mm 格式的字串，new Date() 應該能解析
    const created = new Date(createTime);
    const deadlineTimestamp = Math.min(created.getTime() + 7 * 24 * 60 * 60 * 1000, deadlineDate.getTime());
    
    const deadline = new Date(deadlineTimestamp).toISOString(); 
    
    return corsJsonResponse({ 
      status: 'success', 
      data: {
        bookingId: id, 
        name, 
        email, 
        phone: String(phone).replace(/^'/, ''), 
        timeslot, 
        status, 
        deadline 
      }
    });
  }

  if (type === 'availability') {
    const TIME_SLOTS = generateTimeSlots(); 
    const capacityMap = {};
    TIME_SLOTS.forEach(slot => capacityMap[slot] = maxPerSlot);

    for (let i = 1; i < data.length; i++) {
      const [ , , , , rawSlot, status ] = data[i];
      const timeSlot = normalizeTime(rawSlot);
      if (TIME_SLOTS.includes(timeSlot) && ["待確認", "已確認"].includes(status)) {
        capacityMap[timeSlot] = Math.max(0, capacityMap[timeSlot] - 1);
      }
    }

    // ⬇️ UPDATE: 轉換圖片連結為新的 Image Proxy URL
    const promoImageId = getDriveFileId(promoImageRaw);
    const finalPromoImage = promoImageId ? `?type=image&id=${promoImageId}` : promoImageRaw;
    
    const secondPromoImageId = getDriveFileId(secondPromoImageRaw);
    const finalSecondPromoImage = secondPromoImageId ? `?type=image&id=${secondPromoImageId}` : secondPromoImageRaw;
    
    // 💡 修正：預約截止檢查點改為 bookingCutoffDate
    const bookingClosed = now >= new Date(bookingCutoffDate.getTime());
    const notYetOpen = now < startDate;

    return corsJsonResponse({
      status: "success",
      data: capacityMap,
      bookingClosed,
      notYetOpen,
      activityInfo: {
        date: Utilities.formatDate(activityDate, "Asia/Taipei", "yyyy/MM/dd"),
        bookingCutoffDate: Utilities.formatDate(bookingCutoffDate, "Asia/Taipei", "yyyy/MM/dd"),
        place: activityPlace,
        placeMapUrl: activityMapUrl, // <== 回傳原始連結給前端，前端會自行處理
        contact: activityContact,
        startDate: Utilities.formatDate(startDate, "Asia/Taipei", "yyyy/MM/dd"),
        promoImage: finalPromoImage,
        promoLink: promoLink,
        secondPromoImage: finalSecondPromoImage,
        secondPromoLink: secondPromoLink,
        promoText: promoText,
      }
    });
  }

  return corsJsonResponse({ status: 'error', message: '未知的請求類型' });
}

function sendReminderBeforeEvent() {
  const { activityDate, activityPlace, activityMapUrl, activityContact } = getSettings();
  const today = new Date();
  const reminderDay = new Date(activityDate);
  reminderDay.setDate(activityDate.getDate() - 1);
  if (today.toDateString() !== reminderDay.toDateString()) return;

  const data = sheetBooking.getDataRange().getValues();
  
  // ⬇️ UPDATE: 使用修正後的 toClickableMapUrl 處理地圖連結
  const mapLink = toClickableMapUrl(activityMapUrl, activityPlace);

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
          <li><strong>活動地點：</strong> <a href="${mapLink}">${activityPlace}</a><br>
        </ul>
        <p>若您無法前來，請儘早告知以便釋出名額。</p>
        <p>謝謝您支持捐血活動，期待與您見面！</p>
        <p>聯絡資訊：請私訊<a href="${activityContact}">良全預拌混凝土粉絲專頁</a></p>`
    });
  });
}

function checkExpiredBookings() {
  // 💡 NEW: 讀取 bookingCutoffDate
  const { activityContact, bookingCutoffDate } = getSettings(); 
  const today = new Date();
  
  // 💡 修正：使用 bookingCutoffDate 作為最終期限
  const deadlineDate = new Date(bookingCutoffDate); 
  deadlineDate.setDate(bookingCutoffDate.getDate()); 

  const data = sheetBooking.getDataRange().getValues();

  data.forEach((row, i) => {
    if (i === 0) return;
    const [id, name, email, , timeslot, status, createTime] = row;
    if (status !== '待確認') return;

    // createTime 現在是 yyyy/MM/dd HH:mm 格式的字串
    const created = new Date(createTime);
    // 💡 修正：使用 deadlineDate (即 bookingCutoffDate)
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
      // ⬇️ UPDATE: 使用 formatDateTime 儲存逾期時間
      sheetBooking.getRange(i + 1, 7).setValue(formatDateTime(new Date()));
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