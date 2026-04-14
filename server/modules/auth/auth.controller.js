const User = require('./user.model');
const Member = require('../members/member.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET || 'EASY_COOP_SECRET_KEY_2026';

// Hàm kiểm tra định dạng SĐT tái sử dụng ở Backend
const isValidPhone = (phone) => {
    return /^0\d{9}$/.test(phone);
};

const register = async (req, res) => {
    try {
        const { phone, password, fullName } = req.body;

        // KIỂM TRA ĐỊNH DẠNG SỐ ĐIỆN THOẠI
        if (!isValidPhone(phone)) {
            return res.status(400).json({ message: "Số điện thoại không hợp lệ! Vui lòng nhập đúng 10 chữ số và bắt đầu bằng số 0." });
        }

        const existingUser = await User.findOne({ where: { phone } });
        if (existingUser) {
            return res.status(400).json({ message: "Số điện thoại này đã được đăng ký!" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = await User.create({ 
            phone, 
            password: hashedPassword, 
            fullName, 
            role: 'Xã viên' 
        });

        await Member.create({
            name: fullName,
            phone: phone,
            joinDate: new Date()
        });
        
        res.status(201).json({ message: "Tạo tài khoản và hồ sơ Xã viên thành công!", phone: newUser.phone });
    } catch (error) {
        console.error("Lỗi đăng ký:", error);
        res.status(500).json({ message: "Lỗi hệ thống khi đăng ký tài khoản" });
    }
};

const login = async (req, res) => {
    try {
        const { phone, password } = req.body;
        
        // KIỂM TRA ĐỊNH DẠNG SỐ ĐIỆN THOẠI
        if (!isValidPhone(phone)) {
            return res.status(400).json({ message: "Số điện thoại không hợp lệ!" });
        }

        const user = await User.findOne({ where: { phone } });
        if (!user) return res.status(404).json({ message: "Số điện thoại chưa được đăng ký" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Sai mật khẩu" });

        const token = jwt.sign(
            { id: user.id, role: user.role, fullName: user.fullName, phone: user.phone }, 
            SECRET_KEY, 
            { expiresIn: '1d' }
        );

        res.status(200).json({ 
            message: "Đăng nhập thành công", 
            token, 
            user: { phone: user.phone, fullName: user.fullName, role: user.role } 
        });
    } catch (error) {
        res.status(500).json({ message: "Lỗi server khi đăng nhập" });
    }
};

module.exports = { register, login };