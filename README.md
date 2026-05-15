# 🔍 Google Ads Spy Tool

Công cụ tự động theo dõi chiến dịch quảng cáo của đối thủ trên [Google Ads Transparency Center](https://adstransparency.google.com). Thay vì mất hàng chục phút lướt tay, chỉ cần dán Advertiser ID vào — tool sẽ cho bạn ngay danh sách toàn bộ dự án họ đang chạy, bao gồm mẫu quảng cáo và nội dung nhận dạng tự động.

---

## 📋 Yêu cầu cài đặt

Trước khi dùng, máy bạn cần có **Node.js**. Kiểm tra bằng cách mở Terminal (Mac) và gõ:

```
node --version
```

Nếu hiện số phiên bản như `v20.0.0` → bạn đã có rồi, bỏ qua bước này.

Nếu chưa có → tải tại: **https://nodejs.org** (chọn bản **LTS**, nhấn Download, cài như phần mềm bình thường).

---

## 🍎 Cài đặt trên macOS (chỉ làm 1 lần)

### Bước 1 — Mở Terminal

Có 3 cách:
- **Spotlight:** Nhấn `Cmd + Space` → gõ `Terminal` → Enter
- **Finder:** Vào menu Go → Utilities → Terminal
- **Launchpad:** Tìm thư mục "Other" → Terminal

### Bước 2 — Di chuyển vào thư mục tool

```
cd ~/Desktop/MMO/ads-spy-tool
```

*(Thay đường dẫn nếu bạn để tool ở chỗ khác. Dấu `~` là shortcut cho thư mục Home của bạn.)*

### Bước 3 — Cài các gói cần thiết

```
npm install
```

Lệnh này tải các thư viện cần thiết (Playwright, Tesseract OCR). Chờ khoảng 1–2 phút đến khi hiện lại dấu nhắc `$`.

### Bước 4 — Cài trình duyệt tự động

```
npx playwright install chromium
```

Tool dùng Chrome ảo để truy cập Google. Bước này tải Chromium về (~150MB), chờ xong rồi tiếp.

> **⚠️ macOS Gatekeeper:** Sau khi tải xong Chromium, lần đầu chạy tool macOS có thể hiện thông báo "cannot be opened because the developer cannot be verified". Xử lý:
> 1. Vào **System Settings** (hoặc System Preferences) → **Privacy & Security**
> 2. Kéo xuống phần Security, nhấn **"Allow Anyway"** cạnh tên file bị chặn
> 3. Chạy lại tool — lần sau không hỏi nữa

---

## ▶️ Cách chạy tool (mỗi lần dùng)

### Bước 1 — Mở Terminal và vào thư mục tool

```
cd ~/Desktop/MMO/ads-spy-tool
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
- Chờ khoảng **5-15 giây** (tool đang mở Chrome ảo và lấy dữ liệu)
- Kết quả hiện ra tự động, hiển thị tất cả quảng cáo từ mọi khu vực trên thế giới

### 2. Xem dạng Card (mặc định)

Mỗi dự án hiện thành 1 thẻ gồm:
- **Hình ảnh** thumbnail của quảng cáo
- **Tên dự án** — domain của trang đích (ví dụ: `wctrading.com`). Nếu không lấy được, hiện tên pháp lý của advertiser.
- **🔗 Link trang chủ** — đường dẫn đến website của dự án, click để mở trong tab mới
- **Thời gian chạy** (ngày bắt đầu → ngày kết thúc)
- **Format quảng cáo** (Display, Search, YouTube, Shopping)
- **Trạng thái:** `● Đang chạy` (xanh) hoặc `⏹ Đã tắt` (đỏ)
- Nút **🔍 Xem mẫu quảng cáo** để xem chi tiết

### 3. Xem mẫu quảng cáo

Nhấn nút **🔍 Xem mẫu quảng cáo** trên bất kỳ card nào để mở popup chi tiết, gồm:
- **Ảnh quảng cáo** các kích thước khác nhau
- **Tiêu đề** và **Mô tả** (tự động nhận dạng từ ảnh bằng OCR)
- **Link xem trực tiếp** mẫu quảng cáo được render

> Lần đầu xem mẫu chờ ~5 giây (khởi động engine OCR). Các lần sau nhanh hơn và kết quả được cache 1 giờ.

### 4. Xem dạng Bảng (Table)

Nhấn nút **☰ Table** để chuyển sang bảng. Có thể click vào tiêu đề cột để **sắp xếp** theo:
- Tên dự án (Dự Án)
- Link trang chủ (Trang Chủ)
- Ngày bắt đầu
- Ngày kết thúc
- Trạng thái

Nhấn **🗂 Card** để quay lại dạng thẻ.

### 5. Xuất CSV

Nhấn **⬇ CSV** để tải file về máy. File gồm các cột: **Name, Homepage URL, Start Date, End Date, Is Active, Formats**.

> **Mở CSV trên macOS:**
> - **Numbers (miễn phí, có sẵn trên Mac):** Double-click file → tự mở đúng format
> - **Excel:** Mở Excel → Data → From Text/CSV → chọn file → delimiter là dấu phẩy (`,`)
> - **Google Sheets:** Upload lên Google Drive → mở bằng Google Sheets

---

## ⚠️ Xử lý lỗi thường gặp

| Thông báo lỗi | Nguyên nhân | Cách xử lý |
|---|---|---|
| "Advertiser ID không hợp lệ" | ID sai format | ID phải bắt đầu bằng `AR` và chỉ có số |
| "Không tìm thấy dữ liệu cho ID này" | Advertiser không có quảng cáo nào | Thử advertiser khác; một số tài khoản không có quảng cáo public |
| "Hết thời gian chờ, vui lòng thử lại" | Mạng chậm hoặc Google phản hồi chậm | Thử lại sau vài giây |
| "Google tạm thời chặn, chờ vài phút rồi thử lại" | Đã scrape quá nhiều liên tiếp | Đợi 2-5 phút rồi thử lại |
| `EADDRINUSE: address already in use :::3000` | Server cũ chưa tắt hoặc app khác dùng port 3000 | Chạy: `kill -9 $(lsof -ti :3000)` rồi `npm start` lại |
| "Không thể kết nối server" | Terminal bị tắt | Mở lại Terminal và chạy `npm start` |
| "Tên dự án vẫn hiện tên công ty" | Google block request lấy URL | Bình thường khi scrape nhiều liên tiếp; chờ vài phút rồi scrape lại |
| "Không thể tải chi tiết quảng cáo" | Lỗi khi mở popup mẫu | Thử lại; nếu vẫn lỗi thì creative này không có data |

---

## 💡 Mẹo sử dụng hiệu quả

- **Cache tự động 1 giờ:** Nếu bạn scrape cùng 1 ID trong vòng 1 giờ, kết quả sẽ hiện ngay lập tức (không cần đợi).
- **Dự án "đang ngon":** Tập trung vào các dự án có badge `● Đang chạy` và ngày bắt đầu gần đây — đó là những campaign đang được đẩy mạnh.
- **Dùng link trang chủ để nghiên cứu nhanh:** Click vào `🔗` trong card để mở trực tiếp website của đối thủ trên tab mới.
- **Export CSV rồi lọc:** Filter theo "Is Active = TRUE" để chỉ xem dự án đang chạy. Sort theo "Start Date" giảm dần để thấy dự án mới nhất lên đầu. Cột "Homepage URL" giúp nhóm các creatives theo cùng 1 website.
- **OCR cho Search Ads:** Nội dung nhận dạng từ ảnh Search ad không phải lúc nào cũng hoàn hảo — dùng như tham khảo, kết hợp với ảnh preview để đọc chính xác hơn.
- **macOS — Nhiều tab Terminal:** Dùng `Cmd + T` để mở tab mới trong Terminal mà không đóng server đang chạy. Hoặc dùng `Cmd + N` để mở cửa sổ Terminal thứ hai.

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
2. Tìm dòng `[SearchCreatives captured]` trong output — đó là endpoint đang hoạt động
3. Nếu endpoint thay đổi, mở `src/scraper.js`, cập nhật `API_URL_PATTERN` theo tên endpoint mới
