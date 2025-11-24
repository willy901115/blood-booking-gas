import { useEffect, useState, useMemo } from "react"; 
import { useNavigate } from "react-router-dom";

// ⬇️ 工具：清洗字串 + 轉直連 Drive URL
function sanitize(s?: string) {
  return (s ?? "").toString().trim().replace(/[\u200B-\u200D\uFEFF]/g, "");
}
function toDirectDriveUrl(url?: string) {
  const u = sanitize(url);
  if (!u) return u;
  const m = u.match(/\/d\/([a-zA-Z0-9_-]{10,})\b/);
  return m ? `https://drive.google.com/uc?export=view&id=${m[1]}` : u;
}

export default function Home() {
  const navigate = useNavigate();
  const [availability, setAvailability] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [bookingClosed, setBookingClosed] = useState(false);
  const [notYetOpen, setNotYetOpen] = useState(false);
  // 💡 UPDATE: 新增 bookingCutoffDate 欄位
  const [activityInfo, setActivityInfo] = useState<{
    date: string;
    bookingCutoffDate: string; // ✅ 新增預約截止日期
    place: string;
    placeMapUrl?: string; // <== 【新增】地圖連結/嵌入碼 URL 欄位
    contact: string;
    startDate: string;
    placeurl: string;
    promoImage?: string; 
    promoLink?: string;  
    secondPromoImage?: string; 
    secondPromoLink?: string;  
    promoText?: string; // ✅ NEW: 活動宣傳文字
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/availability", { credentials: "same-origin" });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status} ${res.statusText} :: ${text.slice(0, 200)}`);
        }
        const data = await res.json();
        console.log("📦 後端完整回傳內容：", data);

        if (data?.activityInfo) {

          const { place, promoImage, promoLink, secondPromoImage, secondPromoLink, bookingCutoffDate, placeMapUrl, promoText, ...rest } = data.activityInfo;
          
          const finalPlaceUrl = placeMapUrl || "";

          const finalPromoImage = toDirectDriveUrl(promoImage);
          const finalPromoLink  = sanitize(promoLink);
          const finalSecondPromoImage = toDirectDriveUrl(secondPromoImage);
          const finalSecondPromoLink  = sanitize(secondPromoLink);

          setActivityInfo({
            ...rest,
            place,
            bookingCutoffDate,
            placeMapUrl,
            placeurl: finalPlaceUrl,
            promoText: sanitize(promoText),
            ...(finalPromoImage ? { promoImage: finalPromoImage } : {}),
            ...(finalPromoLink  ? { promoLink:  finalPromoLink  } : {}),
            ...(finalSecondPromoImage ? { secondPromoImage: finalSecondPromoImage } : {}),
            ...(finalSecondPromoLink  ? { secondPromoLink:  finalSecondPromoLink  } : {}),
          });

          console.log("🖼 promoImage(raw):", promoImage);
          console.log("🖼 promoImage(final):", finalPromoImage);
          console.log("🔗 promoLink(final):", finalPromoLink);
        } else {
          setActivityInfo(null);
        }

        // 狀態開關
        setNotYetOpen(!!data?.notYetOpen);
        setBookingClosed(!!data?.bookingClosed);

        // 名額
        if (!data?.notYetOpen && !data?.bookingClosed && data?.data) {
          setAvailability(data.data);
        } else {
          setAvailability({});
        }
      } catch (err) {
        console.error("❌ 取得時段資料失敗:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleBooking = (time: string) => {
    navigate(`/book?slot=${encodeURIComponent(time)}`);
  };

  const slotsToDisplay = useMemo(() => {
    const slots = Object.keys(availability);
    return slots.sort();
  }, [availability]);
  
  // ✅ FIX: 定義輔助變數並用於 JSX 條件中，不再被 TS 認為是未使用的區域變數
  const isAvailable = !loading && !bookingClosed && !notYetOpen;
  const image1Used = Boolean(activityInfo?.promoImage && sanitize(activityInfo.promoImage));
  const link1Used = Boolean(activityInfo?.promoLink && sanitize(activityInfo.promoLink));
  const image2Used = Boolean(activityInfo?.secondPromoImage && sanitize(activityInfo.secondPromoImage));
  const link2Used = Boolean(activityInfo?.secondPromoLink && sanitize(activityInfo.secondPromoLink));
  

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="mb-6 flex items-center justify-center gap-2 text-2xl font-bold">
        <span role="img" aria-label="血滴">🩸</span>
        <span>捐血活動預約系統</span>
      </h1>

      {activityInfo && (
        <div className="mb-6 text-center bg-white p-4 rounded-lg shadow">
          <h1 className="text-2xl font-bold mb-6 text-center">本次捐血活動資訊</h1>
          <p className="text-lg font-medium flex items-center justify-center">
            <span role="img" aria-label="活動日期" className="mr-2">📅</span>
            活動日期：<strong className="font-extrabold text-700 ml-1">{activityInfo.date}</strong>
          </p>
          <p className="text-base mt-2">📍 地點：{activityInfo.place}</p>
          <p className="text-base mt-2">
            聯絡資訊：請私訊
            <a href={activityInfo.contact} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline ml-1">
              良全預拌混凝土粉絲專頁
            </a>
          </p>
          {/* 💡 UPDATE: 使用後端提供的宣傳文字，如果存在 */}
          {activityInfo.promoText && (
            <p className="text-base mt-2">
              {activityInfo.promoText}
            </p>
          )}
          <p className="text-base mt-2">
            {/* 💡 UPDATE 1: 顯示預約截止日期 */}
            {!bookingClosed && activityInfo.bookingCutoffDate ? (
              <>
                預約只開放到
                <strong className="mx-1 font-extrabold text-red-700">
                  {activityInfo.bookingCutoffDate} 23:59 截止
                </strong>
                ，名額有限，歡迎踴躍報名
              </>
            ) : (
              <>
                名額已滿，歡迎加入
                <a
                  href={activityInfo.contact}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline mx-1"
                >
                  粉專
                </a>
                參與下次活動
              </>
            )}
          </p>
        </div>
      )}

      {activityInfo?.placeurl && (
        <div className="mt-6">
          <h2 className="text-base font-semibold py-6">🗺 活動地點地圖</h2>
          <iframe
            title="活動地點地圖"
            src={activityInfo.placeurl}
            width="100%"
            height="300"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="rounded-lg shadow"
          ></iframe>
        </div>
      )}

      {loading ? (
        <div className="text-center">載入中...</div>
      ) : bookingClosed ? (
        <div className="text-center text-red-600 font-semibold text-lg py-6 animate-pulse">
          本次活動的預約已截止，歡迎關注下一次捐血活動！
        </div>
      ) : notYetOpen ? (
        <div className="text-center text-yellow-600 font-semibold text-lg py-6 animate-pulse">
          預約尚未開放，請於
          <strong className="font-extrabold text-red-700 mx-1">{activityInfo?.startDate}</strong>
          後再試，謝謝您的耐心等待。
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-bold py-6 text-center">請選擇適合您預約的捐血時段</h1>
          <section className="mx-auto max-w-4xl mt-6 mb-8">
            <div className="bg-white rounded-lg shadow divide-y">
              <div className="p-5">
                <h2 className="text-lg font-semibold mb-3">📌 預約注意事項</h2>
                <ul className="list-disc pl-6 space-y-2 text-gray-700 text-sm md:text-base">
                  <li>每人僅能預約一個時段；若取消原預約後，才可重新預約。</li>
                  <li>
                    請於預約時段
                    <strong className="font-extrabold text-red-700 mx-1">10分鐘</strong>
                    前抵達現場完成報到與基本檢查。
                  </li>
                  <li>
                    預約資格僅會保留到預約時段後
                    <strong className="font-extrabold text-red-700 mx-1">15分鐘</strong>
                    。
                  </li>
                  <li>逾時雖將取消預約資格，但仍可於現場抽取號碼牌參與捐血。</li>
                  <li>請攜帶可辨識身分之證件（如身分證、健保卡、駕照）。</li>
                  <li>請於捐血前一晚睡眠充足並進食，避免空腹與飲酒。</li>
                  <li>名額採即時更新，顯示「已額滿」之時段無法點選預約。</li>
                  {/* 💡 UPDATE 2: 顯示預約確認的截止日 */}
                  <li>
                    預約後需在
                    <strong className="font-extrabold text-red-700 mx-1">
                      「申請後7天內」或「預約截止日（{activityInfo?.bookingCutoffDate}）」
                    </strong>
                    （取較早者）於郵件內點選預約確認連結，逾期將自動取消名額。
                  </li>
                  <li>若在確認截止日前一日仍未完成確認，系統會再寄發提醒通知。</li>
                  <li>取消預約可透過 Email中的「取消連結」直接辦理；取消後名額將立即釋出。</li>
                </ul>
              </div>

              <div className="p-5">
                <h2 className="text-lg font-semibold mb-3">✅ 預約流程</h2>
                <ol className="list-decimal pl-6 space-y-2 text-gray-700 text-sm md:text-base">
                  <li>在下方選擇可預約的時段（顯示剩餘名額）。</li>
                  <li>填寫姓名、Email、手機號碼並送出。</li>
                  <li>收到 Email通知後，於截止日前完成「點擊確認」。</li>
                  <li>完成確認後，您將會被導向確認成功通知的網頁，即完成預約確認。</li>
                  <li>活動當日依提醒時間抵達現場報到；如需取消，請使用通知中的取消連結。</li>
                </ol>
              </div>
            </div>
          </section>
          
          <br />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {slotsToDisplay.map((slot) => { 
              const available = availability[slot] ?? 0;
              const isFull = available <= 0;
              return (
                <div
                  key={slot}
                  className={`border rounded-lg p-4 text-center cursor-pointer ${
                    isFull ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-white hover:bg-blue-100"
                  }`}
                  onClick={() => !isFull && handleBooking(slot)}
                >
                  <div className="text-lg font-semibold">{slot}</div>
                  <div className="text-sm">
                    {available <= 0 ? "已額滿" : `剩餘名額：${available}`}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ✅ 宣傳圖區塊改用直接定義的變數 */}
          {isAvailable && image1Used && (
            <div className="mt-8">
              <div className="mx-auto w-full max-w-screen-lg">
                {link1Used ? (
                  <a
                    href={activityInfo!.promoLink!}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="前往活動宣傳連結（另開視窗）"
                  >
                    <img
                      src={activityInfo!.promoImage!}
                      alt="活動宣傳"
                      className="w-full rounded-lg shadow hover:opacity-90 object-contain"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onLoad={() => console.log("✅ 圖片載入成功")}
                      onError={(ev) => {
                        const img = ev.currentTarget as HTMLImageElement;
                    
                        // 已嘗試次數（避免無限遞迴）
                        const tried = Number(img.dataset.try || "0");
                    
                        // 從目前 src 取 Drive 檔案 ID（支援 ?id=... 或 /d/.../）
                        const srcNow = img.src;
                        const m =
                          srcNow.match(/[?&]id=([a-zA-Z0-9_-]{10,})/) ||
                          srcNow.match(/\/d\/([a-zA-Z0-9_-]{10,})\b/);
                        const id = m ? m[1] : "";
                    
                        if (id && tried === 0) {
                          // 第一次失敗 → 改用 Google 圖片 CDN（最穩）
                          img.dataset.try = "1";
                          // ✅ FIX: 將 http 改為 https 解決 Mixed Content 錯誤
                          img.src = `https://googleusercontent.com/profile/picture/13${id}=s1600`;
                          console.warn("↪️ fallback → lh3:", img.src);
                          return;
                        }
                        if (id && tried === 1) {
                          // 第二次失敗 → 改用 Drive 縮圖服務（可指定寬度）
                          img.dataset.try = "2";
                          img.src = `https://drive.google.com/thumbnail?id=${id}&sz=w1600`;
                          console.warn("↪️ fallback → thumbnail:", img.src);
                          return;
                        }
                    
                        console.error("❌ 圖片載入最終失敗：", srcNow);
                      }}
                    />
                  </a>
                ) : (
                  <img
                    src={activityInfo!.promoImage!}
                    alt="活動宣傳"
                    className="w-full rounded-lg shadow hover:opacity-90 object-contain"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onLoad={() => console.log("✅ 圖片載入成功")}
                    onError={(ev) => {
                      const img = ev.currentTarget as HTMLImageElement;
                  
                      // 已嘗試次數（避免無限遞迴）
                      const tried = Number(img.dataset.try || "0");
                  
                      // 從目前 src 取 Drive 檔案 ID（支援 ?id=... 或 /d/.../）
                      const srcNow = img.src;
                      const m =
                        srcNow.match(/[?&]id=([a-zA-Z0-9_-]{10,})/) ||
                        srcNow.match(/\/d\/([a-zA-Z0-9_-]{10,})\b/);
                      const id = m ? m[1] : "";
                  
                      if (id && tried === 0) {
                        // 第一次失敗 → 改用 Google 圖片 CDN（最穩）
                        img.dataset.try = "1";
                        // ✅ FIX: 將 http 改為 https 解決 Mixed Content 錯誤
                        img.src = `https://googleusercontent.com/profile/picture/14${id}=s1600`;
                        console.warn("↪️ fallback → lh3:", img.src);
                        return;
                      }
                      if (id && tried === 1) {
                        // 第二次失敗 → 改用 Drive 縮圖服務（可指定寬度）
                        img.dataset.try = "2";
                        img.src = `https://drive.google.com/thumbnail?id=${id}&sz=w1600`;
                        console.warn("↪️ fallback → thumbnail:", img.src);
                        return;
                      }
                  
                      console.error("❌ 圖片載入最終失敗：", srcNow);
                    }}
                  />
                )}
              </div>
            </div>
          )}
          {isAvailable && image2Used && (
            <div className="mt-8">
              <div className="mx-auto w-full max-w-screen-lg">
                {link2Used ? (
                  <a
                    href={activityInfo!.secondPromoLink!}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="前往活動宣傳連結（另開視窗）"
                  >
                    <img
                      src={activityInfo!.secondPromoImage!}
                      alt="活動宣傳"
                      className="w-full rounded-lg shadow hover:opacity-90 object-contain"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onLoad={() => console.log("✅ 圖片載入成功")}
                      onError={(ev) => {
                        const img = ev.currentTarget as HTMLImageElement;
                    
                        // 已嘗試次數（避免無限遞迴）
                        const tried = Number(img.dataset.try || "0");
                    
                        // 從目前 src 取 Drive 檔案 ID（支援 ?id=... 或 /d/.../）
                        const srcNow = img.src;
                        const m =
                          srcNow.match(/[?&]id=([a-zA-Z0-9_-]{10,})/) ||
                          srcNow.match(/\/d\/([a-zA-Z0-9_-]{10,})\b/);
                        const id = m ? m[1] : "";
                    
                        if (id && tried === 0) {
                          // 第一次失敗 → 改用 Google 圖片 CDN（最穩）
                          img.dataset.try = "1";
                          // ✅ FIX: 將 http 改為 https 解決 Mixed Content 錯誤
                          img.src = `https://googleusercontent.com/profile/picture/15${id}=s1600`;
                          console.warn("↪️ fallback → lh3:", img.src);
                          return;
                        }
                        if (id && tried === 1) {
                          // 第二次失敗 → 改用 Drive 縮圖服務（可指定寬度）
                          img.dataset.try = "2";
                          img.src = `https://drive.google.com/thumbnail?id=${id}&sz=w1600`;
                          console.warn("↪️ fallback → thumbnail:", img.src);
                          return;
                        }
                    
                        console.error("❌ 圖片載入最終失敗：", srcNow);
                      }}
                    />
                  </a>
                ) : (
                  <img
                    src={activityInfo!.secondPromoImage!}
                    alt="活動宣傳"
                    className="w-full rounded-lg shadow hover:opacity-90 object-contain"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onLoad={() => console.log("✅ 圖片載入成功")}
                    onError={(ev) => {
                      const img = ev.currentTarget as HTMLImageElement;
                  
                      // 已嘗試次數（避免無限遞迴）
                      const tried = Number(img.dataset.try || "0");
                  
                      // 從目前 src 取 Drive 檔案 ID（支援 ?id=... 或 /d/.../）
                      const srcNow = img.src;
                      const m =
                        srcNow.match(/[?&]id=([a-zA-Z0-9_-]{10,})/) ||
                        srcNow.match(/\/d\/([a-zA-Z0-9_-]{10,})\b/);
                      const id = m ? m[1] : "";
                  
                      if (id && tried === 0) {
                        // 第一次失敗 → 改用 Google 圖片 CDN（最穩）
                        img.dataset.try = "1";
                        // ✅ FIX: 將 http 改為 https 解決 Mixed Content 錯誤
                        img.src = `https://googleusercontent.com/profile/picture/16${id}=s1600`;
                        console.warn("↪️ fallback → lh3:", img.src);
                        return;
                      }
                      if (id && tried === 1) {
                        // 第二次失敗 → 改用 Drive 縮圖服務（可指定寬度）
                        img.dataset.try = "2";
                        img.src = `https://drive.google.com/thumbnail?id=${id}&sz=w1600`;
                        console.warn("↪️ fallback → thumbnail:", img.src);
                        return;
                      }
                  
                      console.error("❌ 圖片載入最終失敗：", srcNow);
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}