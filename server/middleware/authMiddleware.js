const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET || 'EASY_COOP_SECRET_KEY_2026';

const verifyToken = (req, res, next) => {
    // Tìm thẻ authorization trong header của request
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ message: "Bạn chưa đăng nhập!" });

    // Cắt lấy đoạn mã Token (Bỏ chữ Bearer ở trước)
    const token = authHeader.split(" ")[1]; 
    
    try {
        // Dùng chìa khóa để giải mã token
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded; // Gắn thông tin user (id, role, name) vào req để dùng cho bước sau
        next(); // Hợp lệ -> Cho đi tiếp
    } catch (err) {
        return res.status(401).json({ message: "Phiên đăng nhập hết hạn hoặc không hợp lệ" });
    }
};

module.exports = verifyToken;