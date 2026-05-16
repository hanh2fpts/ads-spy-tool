# Google Ads Spy Tool

Công cụ xem và phân tích quảng cáo Google của bất kỳ doanh nghiệp nào thông qua Google Ads Transparency Center.

---

## Tính năng

- Nhập Advertiser ID → tự động lấy toàn bộ danh sách chiến dịch quảng cáo
- Hiển thị: tên dự án, homepage URL, ngày bắt đầu/kết thúc, số ngày chạy, format, trạng thái
- Xem link quảng cáo trực tiếp trên Google
- Xuất file CSV đầy đủ
- Tự động nhận diện tên thương hiệu và URL từ ảnh quảng cáo (OCR)
- Cache kết quả 1 giờ — có nút **Clear Cache** để xóa cache của nhà quảng cáo đang xem và scrape lại dữ liệu mới nhất ngay lập tức

---

## Cài đặt (chỉ làm 1 lần)

### Bước 1 — Cài Node.js

Tải và cài đặt Node.js tại: https://nodejs.org (chọn bản **LTS**)

Sau khi cài xong, mở **Command Prompt** (nhấn `Win + R`, gõ `cmd`, Enter) và kiểm tra:

```
node -v
```

Nếu hiện ra số phiên bản (vd: `v20.11.0`) là thành công.

---

### Bước 2 — Tải code về

Nếu dùng Git:
```
git clone <link-repo>
cd ads-spy-tool
```

Hoặc tải file ZIP từ GitHub → giải nén → mở thư mục đó trong Command Prompt:
```
cd đường-dẫn-đến-thư-mục
```

---

### Bước 3 — Cài thư viện

Chạy lần lượt 2 lệnh sau trong Command Prompt (trong thư mục project):

```
npm install
npx playwright install chromium
```

> Lệnh này tải về ~200MB trình duyệt Chromium để tự động hóa scraping. Chỉ cần làm 1 lần.

---

### Bước 4 — Cài pm2 (auto-start khi bật máy)

```
npm install -g pm2 pm2-windows-startup
pm2-startup install
pm2 start src/start.js --name "ads-spy-tool"
pm2 save
```

Sau bước này, **mỗi lần bật máy server sẽ tự chạy ngầm** — không cần mở terminal hay gõ lệnh gì thêm.

---

## Sử dụng

1. Bật máy lên, mở trình duyệt (Chrome, Edge, Firefox...)
2. Vào địa chỉ: **http://localhost:3000**
3. Nhập **Advertiser ID** của nhà quảng cáo muốn tra cứu (có dạng `AR` + dãy số, vd: `AR12345678`)
4. Nhấn **Scrape** và chờ kết quả (thường mất 30–60 giây)

> **Lấy Advertiser ID ở đâu?**
> Vào https://adstransparency.google.com → tìm tên doanh nghiệp → click vào → copy phần `AR...` trên URL trình duyệt.

---

## Các nút chức năng

| Nút | Chức năng |
|-----|-----------|
| **Scrape** | Lấy dữ liệu quảng cáo |
| **Card / Table** | Chuyển đổi kiểu hiển thị |
| **CSV** | Tải về file Excel |
| **Clear Cache** | Xóa cache của nhà quảng cáo **đang xem** và tự động scrape lại dữ liệu mới nhất từ Google |

---

## Cập nhật code mới

Khi có phiên bản mới, mở Command Prompt trong thư mục project và chạy:

```
git pull
npm install
pm2 restart ads-spy-tool
```

---

## Quản lý server (khi cần)

```
pm2 status                  # xem server đang chạy không
pm2 logs ads-spy-tool       # xem log lỗi
pm2 restart ads-spy-tool    # khởi động lại server
pm2 stop ads-spy-tool       # tắt server
pm2 start ads-spy-tool      # bật lại server
```

---

## Lưu ý

- Tool chỉ xem được quảng cáo **đã được Google công khai** tại Ads Transparency Center
- Kết quả scrape được lưu cache 1 giờ. Nếu muốn lấy dữ liệu mới trước khi hết 1 giờ: nhấn **Clear Cache** — tool sẽ tự động scrape lại ngay
- Nếu scrape thất bại, thử lại sau vài phút (Google đôi khi giới hạn request)
