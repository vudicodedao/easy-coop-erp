const Member = require('./member.model');
const User = require('../auth/user.model'); 
const bcrypt = require('bcryptjs');
const { sequelize } = require('../../config/db'); 

const isValidPhone = (phone) => /^0\d{9}$/.test(phone);

const findAllMembers = async () => {
    return await Member.findAll({ order: [['createdAt', 'DESC']] });
};

const createNewMember = async (data) => {
    if (!isValidPhone(data.phone)) {
        throw new Error("Số điện thoại không hợp lệ! Vui lòng nhập 10 chữ số và bắt đầu bằng số 0.");
    }

    const existingMember = await Member.findOne({ where: { phone: data.phone } });
    const existingUser = await User.findOne({ where: { phone: data.phone } });
    if (existingMember || existingUser) {
        throw new Error("Số điện thoại này đã được đăng ký tài khoản cho người khác!");
    }

    const transaction = await sequelize.transaction();
    try {
        const newMember = await Member.create(data, { transaction });

        const hashedPassword = await bcrypt.hash(data.phone, 10);
        await User.create({
            phone: data.phone,
            password: hashedPassword,
            fullName: data.name,
            role: data.role || 'Xã viên'
        }, { transaction });

        await transaction.commit();
        return newMember;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

const updateMemberById = async (id, data) => {
    const transaction = await sequelize.transaction();
    try {
        const member = await Member.findByPk(id);
        if (!member) throw new Error("Không tìm thấy thành viên");

        const oldPhone = member.phone;

        if (data.phone && data.phone !== oldPhone) {
            if (!isValidPhone(data.phone)) throw new Error("Số điện thoại mới không hợp lệ!");
            const checkUser = await User.findOne({ where: { phone: data.phone } });
            if (checkUser) throw new Error("Số điện thoại mới đã có người sử dụng!");
        }

        await member.update(data, { transaction });

        const user = await User.findOne({ where: { phone: oldPhone }, transaction });
        if (user) {
            await user.update({
                fullName: data.name || user.fullName,
                phone: data.phone || user.phone, 
                role: data.role || user.role     
            }, { transaction });
        }

        await transaction.commit();
        return member;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

const deleteMemberById = async (id) => {
    const transaction = await sequelize.transaction();
    try {
        const member = await Member.findByPk(id);
        if (!member) throw new Error("Không tìm thấy thành viên");

        const phoneToDelete = member.phone;

        await member.destroy({ transaction });
        await User.destroy({ where: { phone: phoneToDelete }, transaction }); 

        await transaction.commit();
        return true;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

// [THÊM MỚI] - LOGIC KHÔI PHỤC MẬT KHẨU
const resetPasswordById = async (id) => {
    const transaction = await sequelize.transaction();
    try {
        const member = await Member.findByPk(id);
        if (!member) throw new Error("Không tìm thấy thành viên");

        const user = await User.findOne({ where: { phone: member.phone }, transaction });
        if (!user) throw new Error("Thành viên này chưa có tài khoản đăng nhập Hệ thống!");

        // Lấy chính số điện thoại làm mật khẩu mới
        const hashedNewPassword = await bcrypt.hash(member.phone, 10);
        
        await user.update({ password: hashedNewPassword }, { transaction });

        await transaction.commit();
        return member.phone; // Trả về SĐT để Frontend thông báo
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

module.exports = { findAllMembers, createNewMember, deleteMemberById, updateMemberById, resetPasswordById };