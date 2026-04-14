# 🌱 EASY CO-OP - Hệ thống ERP Quản trị Hợp tác xã Nông nghiệp

EASY CO-OP là một giải pháp phần mềm quản trị doanh nghiệp (ERP) toàn diện, được thiết kế chuyên biệt để giải quyết các bài toán vận hành thực tế tại các Hợp tác xã Nông nghiệp. Hệ thống giúp số hóa toàn bộ quy trình từ quản lý nhân sự, kho bãi, quy trình canh tác cho đến khâu thu mua, bán hàng và quyết toán công nợ phức tạp.

## 🚀 Các Tính năng Nổi bật (Core Features)

Hệ thống được chia thành 6 phân hệ liên kết chặt chẽ với nhau:

* **👥 Quản lý Xã viên (Members):** Quản lý hồ sơ điện tử, theo dõi diện tích canh tác, vốn góp. Tích hợp tính năng sinh mã QR tự động làm Thẻ Thành Viên, giúp định danh nhanh chóng khi thu mua hoặc xuất vật tư.

* **📦 Quản trị Kho hàng (Inventory):** Quản lý vật tư đầu vào, nông sản đầu ra và công cụ dụng cụ. Áp dụng chuẩn quản lý theo **Số Lô (Batch Tracking)** và **Hạn sử dụng**. Tự động cảnh báo thông minh khi hàng sắp hết hoặc sắp hết hạn.

* **🌾 Nhật ký Canh tác (Production):** Xã viên trực tiếp ghi nhận các hoạt động làm đất, gieo hạt, bón phân... Đặc biệt, tích hợp luồng **Tự động hóa 100%**: Khi báo cáo sử dụng vật tư, hệ thống tự động trừ tồn kho và tự động cộng dồn vào "Ví Nợ Vật Tư" của xã viên đó.

* **💰 Sổ Quỹ Thu Chi & Công nợ (Finance):** Quản lý dòng tiền mặt và tiền gửi ngân hàng một cách minh bạch. Sở hữu **"Siêu nút Quyết Toán"** - tự động bù trừ giữa 3 ví: *Tiền HTX nợ thu mua*, *Tiền Xã viên nợ vật tư*, và *Tiền Xã viên đã tạm ứng* để ra kết quả thanh toán cuối vụ chuẩn xác nhất.

* **🛒 Bán hàng & Thu mua (Sales):** Phân hệ kép hỗ trợ lập đơn bán nông sản ra thị trường và lập phiếu thu mua lúa/nông sản từ xã viên. Hỗ trợ quét mã QR để chốt đơn thần tốc.

* **📊 Bảng Tổng quan (Dashboard):** Dành riêng cho Ban Giám đốc với các chỉ số tài chính (KPI) theo thời gian thực và biểu đồ trực quan (Recharts) về cơ cấu kho, doanh thu và dòng tiền. Đảm bảo giao diện tương thích hoàn hảo (Responsive) trên cả PC và Mobile.

## 🛠️ Công nghệ Sử dụng (Tech Stack)

**Frontend:**
* React.js
* React Router DOM
* Recharts (Vẽ biểu đồ dữ liệu)
* qrcode.react (Tạo mã QR điện tử)
* XLSX (Xuất báo cáo ra file Excel)
* Axios

**Backend & Database:**
* Node.js & Express.js
* MySQL
* Sequelize ORM (Quản lý Models và Transactions)

## ⚙️ Hướng dẫn Cài đặt (Installation)

### 1. Yêu cầu môi trường
* Node.js (Phiên bản v14 trở lên)
* MySQL Server (XAMPP, WAMP hoặc MySQL độc lập)

### 2. Thiết lập Cơ sở dữ liệu (Database)
1. Mở MySQL/phpMyAdmin và tạo một Database mới có tên: `easy_coop_db`.
2. Cấu hình lại thông tin kết nối (Username, Password) trong file `server/config/db.js` hoặc file `.env` của thư mục Backend.

### 3. Cài đặt và Khởi chạy
Mở 2 Terminal/Command Prompt để chạy song song Server và Client.

**Chạy Backend (Server):**
```bash
cd server
npm install
npm start
# Server sẽ chạy ở cổng http://localhost:5000

**Chạy Frontend (Client):**
```bash
cd client
npm install
npm start
# Client sẽ mở trên trình duyệt tại http://localhost:3000

## 🔒 Phân quyền Hệ thống (Role-based Access Control)
Phần mềm có cơ chế bảo vệ Route chặt chẽ dựa trên 4 vai trò:

Giám đốc: Toàn quyền truy cập, xem báo cáo, quyết toán công nợ và thêm/sửa/xóa thành viên.

Kế toán: Quản lý sổ quỹ, lập phiếu thu chi, đơn hàng và xem báo cáo.

Thủ kho: Quản lý danh mục kho, lập phiếu nhập/xuất vật tư.

Xã viên: Chỉ được xem hồ sơ cá nhân (kèm QR Code), theo dõi công nợ của bản thân và ghi Nhật ký canh tác.

## 📝 Tác giả (Author)
[Nguyễn Tuấn Vũ] - Software Engineering Student at VNUA

## Dự án được phát triển nhằm mục đích số hóa nông nghiệp và áp dụng kiến trúc phần mềm vào thực tiễn vận hành Hợp tác xã.


***