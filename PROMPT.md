# Prompt gốc — Yêu cầu xây dựng Google Ads Spy Tool

Đây là nội dung phân tích yêu cầu được cung cấp để xây dựng tool này.

---

## Phân tích video yêu cầu

Dựa vào nội dung video, người nói đang mô tả yêu cầu thiết kế và xây dựng một công cụ (tool) tự động hóa để theo dõi chiến dịch quảng cáo của đối thủ cạnh tranh trên nền tảng Google.

---

## 1. Vấn đề hiện tại (Pain points)

Việc tra cứu thủ công thông tin quảng cáo của đối thủ trên Trung tâm minh bạch quảng cáo của Google (Google Ads Transparency Center) đang diễn ra quá rườm rà và mất thời gian.

Hiện tại, người dùng phải:
1. Tìm quảng cáo
2. Nhấn xem thông tin nhà quảng cáo
3. Sao chép ID hoặc tên pháp lý
4. Dán vào thanh tìm kiếm
5. Sau đó lướt và lọc thủ công để xem các dự án/ứng dụng nào đang được chạy

---

## 2. Yêu cầu chức năng của Tool (Features)

**Đầu vào (Input):**
Cung cấp trường nhập liệu để dán ID của nhà quảng cáo (Advertiser ID) vào hệ thống.

**Đầu ra (Output):**
Tool sẽ tự động cào dữ liệu (crawl/scrape) và trả về một danh sách (list) tổng hợp các dự án, chiến dịch mà tài khoản đó đang chạy hoặc đã từng chạy.

**Các dữ liệu cụ thể cần trích xuất:**
- Tên các dự án, ứng dụng, hoặc link đích (ví dụ: các game như Dragon & Hero hay TriDom xuất hiện trong video)
- Thời gian chạy của từng dự án (ngày bắt đầu, ngày kết thúc)
- Trạng thái của quảng cáo (đang hoạt động hay đã tắt)
- Hình ảnh thumbnail của quảng cáo
- Format quảng cáo (Search, Display, YouTube, v.v.)

---

## 3. Mục đích cốt lõi của công cụ

- Rút ngắn tối đa thời gian nghiên cứu và "spy" (theo dõi) đối thủ
- Nhanh chóng phát hiện ra các dự án, sản phẩm, hoặc chiến dịch quảng cáo "đang ngon" (mang lại hiệu quả cao) mà các nhà quảng cáo khác đang đẩy mạnh
- Giúp người dùng đưa ra quyết định hoặc chiến lược cạnh tranh nhanh chóng hơn

**Tóm lại:** Yêu cầu cốt lõi là tạo ra một công cụ Data Scraper chuyên dụng cho trang `adstransparency.google.com`. Tool này sẽ thay thế thao tác lướt web thủ công bằng cách tự động lấy ID nhà quảng cáo và xuất ra một danh sách trực quan các dự án họ đang triển khai.

---

## 4. Các lựa chọn thiết kế (Brainstorming decisions)

| Câu hỏi | Lựa chọn |
|---|---|
| Giao diện | Web app (chạy local trên trình duyệt) |
| Phương pháp scraping | Playwright + network interception (khuyến nghị) |
| Hiển thị kết quả | Card view + Table view (có thể toggle) |
| Phạm vi sử dụng | Cá nhân, chạy local, không cần deploy |
| Dữ liệu lấy thêm | Thumbnail + format quảng cáo |

---

## 5. Kiến trúc đã xây dựng

**Stack:** Node.js + Express + Playwright + HTML/CSS/JS thuần

```
ads-spy-tool/
  src/
    server.js     — Express API (POST /api/scrape, GET /api/export)
    start.js      — Entry point (port 3000)
    scraper.js    — Playwright + network interception
    parser.js     — Parse raw API → AdCampaign[]
    cache.js      — File-based TTL cache (1 giờ)
  public/
    index.html    — Giao diện chính
    style.css     — Styling
    app.js        — Frontend logic (card/table view, export)
  discover.js     — Script tìm API endpoint của Google
  tests/
    cache.test.js
    parser.test.js
    server.test.js
```

**Tổng số tests:** 15 tests, tất cả passing.

---

## 6. Tài liệu liên quan

- **Design spec:** `docs/superpowers/specs/2026-05-14-google-ads-spy-tool-design.md`
- **Implementation plan:** `docs/superpowers/plans/2026-05-14-google-ads-spy-tool.md`
- **Hướng dẫn sử dụng:** `README.md`
