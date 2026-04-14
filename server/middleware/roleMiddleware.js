// Hàm nhận vào một mảng các quyền được phép (VD: ['Giám đốc', 'Kế toán'])
const checkRole = (allowedRoles) => {
    return (req, res, next) => {
        // req.user được truyền từ authMiddleware sang
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: "Bạn không có quyền truy cập chức năng này!" });
        }
        next(); // Đúng quyền -> Cho đi tiếp
    };
};

module.exports = checkRole;