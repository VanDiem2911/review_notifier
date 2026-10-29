# Review Notifier (Next.js)

Gửi tin nhắn Telegram khi có review mới của **Vietlook Travel** trên Google Maps và TripAdvisor.

Một route duy nhất, `GET /api/cron`, làm việc kiểm tra: lấy review → so với danh sách đã gửi → gửi Telegram review mới. Bạn cần một bộ lập lịch gọi route này định kỳ.

## Cài đặt

```bash
npm install
copy .env.example .env.local    # rồi điền giá trị
npm run dev
```

1. **Tạo bot**: chat với [@BotFather](https://t.me/BotFather) → `/newbot` → điền `TELEGRAM_BOT_TOKEN`.
2. Đặt `CRON_SECRET` là một chuỗi ngẫu nhiên dài (bảo vệ endpoint).
3. Nhắn `/start` cho bot (hoặc thêm bot vào nhóm và nhắn 1 tin), mở `http://localhost:3000/api/cron?action=chat-id&secret=<CRON_SECRET>` → điền `TELEGRAM_CHAT_ID`.
4. `…/api/cron?action=test&secret=…` để gửi tin thử.
5. Điền key nguồn review (bên dưới), rồi mở `…/api/cron?secret=…`.

Lần chạy đầu của mỗi nguồn chỉ **ghi nhận** review hiện có (không gửi, tránh spam). Thêm `&notifyExisting=1` ở lần đầu nếu muốn gửi cả review hiện có.

## Nguồn dữ liệu

Google và TripAdvisor chặn scraping trực tiếp, nên dùng API chính thức:

| Nguồn | Key | Ghi chú |
|---|---|---|
| TripAdvisor (Content API) | `TRIPADVISOR_API_KEY` ([đăng ký](https://www.tripadvisor.com/developers)) | `location_id` = `27950353` lấy từ URL, đã điền sẵn. Gói Discover chỉ trả tối đa 3 review mới nhất mỗi ngôn ngữ (gói Growth 5), nên cần gọi cron đủ dày; mặc định theo dõi `en,vi`. |
| Google Maps (A) – SerpApi | `SERPAPI_KEY` ([serpapi.com](https://serpapi.com)) | Sắp xếp mới nhất, đáng tin cậy nhất. Gói free ~100 lượt/tháng, nên gọi cron thưa (vd. 6 tiếng/lần). |
| Google Maps (B) – Places API (New) | `GOOGLE_API_KEY` | Chỉ trả 5 review "liên quan nhất", **có thể bỏ sót review mới**. |

Có cả hai key Google thì dùng SerpApi. `GOOGLE_DATA_ID` lấy từ link Maps bạn đưa; `GOOGLE_PLACE_ID` (`ChIJ…`) mình suy ra thủ công từ cùng link đó, chưa kiểm chứng với API — nếu báo không tìm thấy, lấy lại ở [Place ID Finder](https://developers.google.com/maps/documentation/places/web-service/place-id).

## Lập lịch

- **Vercel**: cron của gói Hobby chỉ chạy tối đa 1 lần/ngày. Muốn mỗi 15–30 phút thì dùng gói Pro, hoặc dịch vụ ngoài như [cron-job.org](https://cron-job.org) / GitHub Actions gọi `https://<domain>/api/cron` với header `Authorization: Bearer <CRON_SECRET>` (hoặc `?secret=`). Vercel Cron tự gửi header này nếu bạn đặt `CRON_SECRET` trong Environment Variables.
- **VPS / máy riêng**: `npm run build && npm start`, rồi dùng crontab hoặc Task Scheduler gọi route.

## Lưu trạng thái

Danh sách review đã gửi lưu trong Upstash Redis nếu có `UPSTASH_REDIS_REST_URL`/`TOKEN` (hoặc `KV_REST_API_*` của Vercel KV), nếu không thì lưu file `.data/state.json`. **Trên Vercel/serverless bắt buộc dùng Redis** vì ổ đĩa không bền vững. Nếu gửi Telegram lỗi, review đó được gửi lại ở lần sau.
