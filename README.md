# 🔍 Google Ads Spy Tool

Công cụ tự động theo dõi chiến dịch quảng cáo của đối thủ trên [Google Ads Transparency Center](https://adstransparency.google.com). Thay vì mất hàng chục phút lướt tay, chỉ cần dán Advertiser ID vào — tool sẽ cho bạn ngay danh sách toàn bộ dự án họ đang chạy.

---

## 📋 Yêu cầu cài đặt

Trước khi dùng, máy bạn cần có **Node.js**. Kiểm tra bằng cách mở Terminal (Mac) hoặc Command Prompt (Windows) và gõ:

```
node --version
```

Nếu hiện số phiên bản như `v20.0.0` → bạn đã có rồi, bỏ qua bước này.

Nếu chưa có → tải tại: **https://nodejs.org** (chọn bản **LTS**, nhấn Download, cài như phần mềm bình thường).

---

## 🚀 Cài đặt lần đầu (chỉ làm 1 lần)

### Bước 1 — Mở Terminal

- **Mac:** Nhấn `Cmd + Space`, gõ `Terminal`, Enter
- **Windows:** Nhấn `Win + R`, gõ `cmd`, Enter

### Bước 2 — Di chuyển vào thư mục tool

```
cd Desktop/MMO/ads-spy-tool
```

*(Thay đường dẫn nếu bạn để tool ở chỗ khác)*

### Bước 3 — Cài các gói cần thiết

```
npm install
```

Lệnh này sẽ tải thêm các thư viện cần thiết. Chờ khoảng 1-2 phút cho đến khi hiện dấu nhắc `$` hoặc `>` trở lại.

### Bước 4 — Cài trình duyệt tự động

```
npx playwright install chromium
```

Tool dùng trình duyệt Chrome ảo để tự động truy cập Google. Bước này tải Chrome về (khoảng 150MB), chờ xong rồi tiếp.

---

## ▶️ Cách chạy tool (mỗi lần dùng)

### Bước 1 — Mở Terminal và vào thư mục tool

```
cd Desktop/MMO/ads-spy-tool
```

### Bước 2 — Khởi động server

```
npm start
```

Bạn sẽ thấy dòng chữ:
```
Ads Spy Tool chạy tại http://localhost:3000
```

**Giữ cửa sổ Terminal này mở** trong suốt quá trình dùng (đừng tắt).

### Bước 3 — Mở trình duyệt

Mở Chrome hoặc Safari, vào địa chỉ:

```
http://localhost:3000
```

Giao diện tool sẽ hiện ra.

---

## 🕵️ Cách lấy Advertiser ID của đối thủ

Đây là bước quan trọng nhất. Bạn cần lấy ID của nhà quảng cáo muốn theo dõi.

### Cách 1 — Từ quảng cáo trên Google Search

1. Tìm kiếm bất kỳ từ khoá liên quan đến đối thủ trên Google
2. Thấy quảng cáo của họ → nhấn vào **dấu ba chấm (⋮)** bên cạnh tiêu đề quảng cáo
3. Chọn **"About this advertiser"** (Về nhà quảng cáo này)
4. Trang mới mở ra trên **adstransparency.google.com**
5. Nhìn lên thanh địa chỉ trình duyệt, URL có dạng:
   ```
   https://adstransparency.google.com/advertiser/AR1234567890
   ```
6. Phần `AR1234567890` chính là **Advertiser ID** — copy lại

### Cách 2 — Tìm trực tiếp trên ATC

1. Vào **https://adstransparency.google.com**
2. Gõ tên công ty/thương hiệu đối thủ vào ô tìm kiếm
3. Chọn kết quả đúng → URL sẽ hiện Advertiser ID như trên

---

## 📊 Cách dùng giao diện

### 1. Nhập ID và Scrape

- Dán Advertiser ID vào ô nhập (ví dụ: `AR1234567890`)
- Nhấn nút **▶ Scrape** hoặc nhấn **Enter**
- Chờ khoảng **10-30 giây** (tool đang mở Chrome ảo và lấy dữ liệu)
- Kết quả hiện ra tự động

### 2. Xem dạng Card (mặc định)

Mỗi dự án hiện thành 1 thẻ gồm:
- **Hình ảnh** thumbnail của quảng cáo
- **Tên dự án** (app/game/website)
- **Thời gian chạy** (ngày bắt đầu → ngày kết thúc)
- **Format quảng cáo** (Display, Search, YouTube...)
- **Trạng thái:** `● Đang chạy` (xanh) hoặc `⏹ Đã tắt` (đỏ)

### 3. Xem dạng Bảng (Table)

Nhấn nút **☰ Table** để chuyển sang bảng. Có thể click vào tiêu đề cột để **sắp xếp** theo:
- Ngày bắt đầu
- Ngày kết thúc
- Trạng thái

Nhấn **🗂 Card** để quay lại dạng thẻ.

### 4. Xuất CSV

Nhấn **⬇ CSV** để tải file Excel-compatible về máy. File chứa toàn bộ dữ liệu dự án của nhà quảng cáo đó.

---

## ⚠️ Xử lý lỗi thường gặp

| Thông báo lỗi | Nguyên nhân | Cách xử lý |
|---|---|---|
| "Advertiser ID không hợp lệ" | ID sai format | ID phải bắt đầu bằng `AR` và chỉ có số |
| "Không tìm thấy dữ liệu cho ID này" | ID không tồn tại hoặc trang trống | Kiểm tra lại ID có đúng không |
| "Hết thời gian chờ, vui lòng thử lại" | Mạng chậm hoặc Google phản hồi chậm | Thử lại sau vài giây |
| "Google tạm thời chặn, chờ vài phút rồi thử lại" | Đã scrape quá nhiều liên tiếp | Đợi 2-5 phút rồi thử lại |
| "Không thể kết nối server" | Terminal bị tắt | Mở lại Terminal và chạy `npm start` |

---

## 💡 Mẹo sử dụng hiệu quả

- **Cache tự động 1 giờ:** Nếu bạn scrape cùng 1 ID trong vòng 1 giờ, kết quả sẽ hiện ngay lập tức (không cần đợi).
- **Dự án "đang ngon":** Tập trung vào các dự án có badge `● Đang chạy` và ngày bắt đầu gần đây — đó là những campaign đang được đẩy mạnh.
- **Export CSV rồi mở Excel:** Filter theo cột "Is Active = TRUE" để chỉ xem dự án đang chạy. Sort theo "Start Date" giảm dần để thấy dự án mới nhất lên đầu.
- **Không cần internet liên tục:** Sau khi scrape xong, bạn có thể tắt mạng và vẫn xem được dữ liệu đã cache.

---

## 🛑 Tắt tool

Khi dùng xong, quay lại cửa sổ Terminal và nhấn **Ctrl + C** để dừng server.

---

## 🔧 Dành cho người biết code — Cập nhật API pattern

Nếu tool báo "Không tìm thấy dữ liệu" dù ID đúng (xảy ra khi Google thay đổi API):

1. Chạy discovery script với ID thật:
   ```
   node discover.js AR_ID_THẬT_CỦA_BẠN
   ```
2. Quan sát output — tìm dòng `=== RESPONSE ===` có chứa data campaign
3. Copy URL pattern từ đó
4. Mở `src/scraper.js`, tìm dòng `API_URL_PATTERN` và cập nhật regex theo URL mới
