const Member = require('./member.model');
const User = require('../auth/user.model'); 
const bcrypt = require('bcryptjs'); // Thêm thư viện băm mật khẩu

// Hàm kiểm tra định dạng SĐT (10 số, bắt đầu bằng 0)
const isValidPhone = (phone) => /^0\d{9}$/.test(phone);

const findAllMembers = async () => {
    return await Member.findAll({ order: [['createdAt', 'DESC']] });
};

const createNewMember = async (data) => {
    if (!isValidPhone(data.phone)) {
        throw new Error("Số điện thoại không hợp lệ! Vui lòng nhập 10 chữ số và bắt đầu bằng số 0.");
    }

    // Kiểm tra xem SĐT đã tồn tại chưa
    const existingMember = await Member.findOne({ where: { phone: data.phone } });
    if (existingMember) {
        throw new Error("Số điện thoại này đã được đăng ký cho một thành viên khác!");
    }

    // 1. Tạo Thành viên trong danh bạ
    const newMember = await Member.create(data);

    // 2. Tự động tạo Tài khoản Đăng nhập (Mật khẩu mặc định là SĐT)
    const hashedPassword = await bcrypt.hash(data.phone, 10);
    await User.create({
        phone: data.phone,
        password: hashedPassword,
        fullName: data.name,
        role: data.role || 'Xã viên'
    });

    return newMember;
};

const deleteMemberById = async (id) => {
    const member = await Member.findByPk(id);
    if (member) {
        // Xóa luôn tài khoản đăng nhập để thống nhất
        await User.destroy({ where: { phone: member.phone } }); 
        await member.destroy();
    }
    return true;
};

const updateMemberById = async (id, data) => {
    const member = await Member.findByPk(id);
    if (!member) throw new Error("Không tìm thấy thành viên");

    await Member.update(data, { where: { id: id } });

    if (data.name || data.role) {
        const updatePayload = {};
        if (data.name) updatePayload.fullName = data.name;
        if (data.role) updatePayload.role = data.role; 
        
        await User.update(updatePayload, { where: { phone: member.phone } });
    }

    return true;
};

module.exports = { findAllMembers, createNewMember, deleteMemberById, updateMemberById };