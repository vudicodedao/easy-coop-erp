const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
require('dotenv').config();
const { connectDB, sequelize } = require('./config/db');
const memberRoutes = require('./modules/members/member.route');

// Import Model để Sequelize biết đường tạo bảng
const Member = require('./modules/members/member.model');

const app = express();

app.use(cors({
    origin: 'http://localhost:3000', // Chỉ đích danh Frontend của bạn
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
}));

app.use(express.json());

// CẤU HÌNH UPLOAD ẢNH (MULTER)
// ==========================================
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true }); // Tự động tạo thư mục nếu chưa có
}
app.use('/uploads', express.static(uploadDir)); // Cho phép Frontend đọc file ảnh qua URL

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        // TỰ ĐỘNG ĐỔI TÊN FILE: Bỏ qua tên tiếng Việt, thay bằng chuỗi số ngẫu nhiên cho an toàn tuyệt đối
        const ext = path.extname(file.originalname) || '.jpg';
        const safeName = Date.now() + '-' + Math.floor(Math.random() * 100000) + ext;
        cb(null, safeName);
    }
});
const upload = multer({ storage: storage });

// API Nhận file ảnh từ Frontend và trả về cái Link
app.post('/api/upload', upload.single('image'), (req, res) => {
   console.log("\n📥 CÓ NGƯỜI ĐANG GỌI CỬA UPLOAD ẢNH!"); // Ghi log ra terminal
    
    if (!req.file) {
        console.log("❌ Báo cáo: Gọi cửa nhưng không mang theo file ảnh.");
        return res.status(400).json({ message: 'Không có file' });
    }
    
    console.log("✅ Thành công! Đã lưu ảnh tên là:", req.file.filename);
    res.status(200).json({ url: `/uploads/${req.file.filename}` });
});

// Cấu hình Middleware
app.use(cors());
app.use(express.json()); // Để server đọc được dữ liệu dạng JSON từ React gửi lên
app.use('/api/members', memberRoutes);
// Khai báo route cho Inventory
const inventoryRoute = require('./modules/inventory/inventory.route');
app.use('/api/inventory', inventoryRoute);

// Khai báo route cho module Production (Sản xuất/Canh tác)
const productionRoute = require('./modules/production/production.route');
app.use('/api/production', productionRoute);

// Khai báo route Tài chính (Sổ quỹ & Công nợ)
const financeRoute = require('./modules/finance/finance.route');
app.use('/api/finance', financeRoute);

const salesRoute = require('./modules/sales/sales.route');
app.use('/api/sales', salesRoute);

const reportRoute = require('./modules/reports/report.route');
app.use('/api/reports', reportRoute);

// Thêm Model User vào để Sequelize tạo bảng
const User = require('./modules/auth/user.model'); 

// Khai báo Route cho Đăng nhập / Đăng ký
const authRoute = require('./modules/auth/auth.route');
app.use('/api/auth', authRoute);

// Kết nối Database và Đồng bộ bảng
connectDB();
sequelize.sync({ alter: true }) 
    .then(() => console.log('✅ Bảng Members đã sẵn sàng trong database!'))
    .catch(err => console.log('❌ Lỗi đồng bộ bảng: ', err));

// Chạy server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại: http://localhost:${PORT}`);
});