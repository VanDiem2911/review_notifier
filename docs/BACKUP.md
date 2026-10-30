# Sao lưu tự động lên Google Drive

Workflow [`.github/workflows/backup.yml`](../.github/workflows/backup.yml) chạy trên GitHub Actions, không cần VPS (phù hợp web chạy Vercel + MongoDB Atlas).

| Loại | Lịch (giờ VN) | Nội dung | Giữ lại |
|---|---|---|---|
| `db` | 02:00 hằng ngày | `mongodump` toàn bộ DB → `db-YYYY-MM-DD.archive.gz` | 7 bản |
| `web` | 03:00 Chủ nhật | Nén toàn bộ mã nguồn của repo → `web-YYYY-MM-DD.tar.gz` | 3 bản |

File nằm ở `Backup-TourWeb/db/` và `Backup-TourWeb/web/` trên Drive. Bản cũ vượt số lượng giữ lại sẽ tự bị xoá.

## Tích hợp vào dự án mới

1. Copy `.github/workflows/backup.yml` vào repo của dự án.
2. Nếu cần, sửa khối `env` ở đầu file: `REMOTE` (thư mục trên Drive), `KEEP_DB`, `KEEP_WEB`.
3. Kết nối Google Drive trên máy có trình duyệt:
   ```powershell
   winget install Rclone.Rclone
   rclone config          # n → tên: gdrive → Storage: drive → scope 1 → web browser: y
   rclone mkdir gdrive:Backup-TourWeb
   rclone config show gdrive   # copy cả khối [gdrive]
   ```
4. Tạo 2 secret ở GitHub: Settings → Secrets and variables → Actions
   - `RCLONE_CONF`: dán khối `[gdrive]` ở trên
   - `MONGODB_URI`: chuỗi kết nối Atlas (nên là user chỉ có quyền `read`)
5. Atlas → Network Access: cho phép `0.0.0.0/0` (IP runner của GitHub thay đổi liên tục).
6. Tab Actions → **Backup to Google Drive** → Run workflow → chọn `db` hoặc `web` để chạy thử, rồi kiểm tra file trên Drive.

## Lưu ý

- Khối `[gdrive]` chứa token truy cập Drive, chỉ để trong GitHub Secrets, không commit.
- Nên dùng tài khoản Google của khách hoặc của công ty, không dùng tài khoản cá nhân.
- Vercel không giữ file upload. Nếu ảnh nằm ở Cloudinary/Blob/S3 thì backup `web` không chứa ảnh, cần backup riêng chỗ đó.
- Nếu bản sao toàn bộ web có thư mục lớn không cần thiết, thêm `--exclude=...` ở bước "Tạo file sao lưu".
- Khôi phục DB: `mongorestore --uri="<URI>" --archive=db-YYYY-MM-DD.archive.gz --gzip`.
- Hợp đồng ghi "VPS": nếu dùng Vercel + Atlas, nên sửa mục 6.4/6.5 cho khớp.
