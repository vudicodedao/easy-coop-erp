const memberService = require('./member.service');

const getMembers = async (req, res) => {
    try {
        const members = await memberService.findAllMembers();
        res.status(200).json(members);
    } catch (error) {
        res.status(500).json({ message: "Lỗi khi lấy danh sách" });
    }
};

const addMember = async (req, res) => {
    try {
        const newMember = await memberService.createNewMember(req.body);
        res.status(201).json(newMember);
    } catch (error) {
        res.status(400).json({ message: error.message || "Lỗi khi thêm thành viên" });
    }
};

const deleteMember = async (req, res) => {
    try {
        await memberService.deleteMemberById(req.params.id);
        res.status(200).json({ message: "Đã xóa thành công" });
    } catch (error) {
        res.status(500).json({ message: "Lỗi khi xóa" });
    }
};

const updateMember = async (req, res) => {
    try {
        await memberService.updateMemberById(req.params.id, req.body);
        res.status(200).json({ message: "Đã cập nhật thành công" });
    } catch (error) {
        res.status(400).json({ message: error.message || "Lỗi khi cập nhật" });
    }
};

// [THÊM MỚI] - CONTROLLER KHÔI PHỤC MẬT KHẨU
const resetPassword = async (req, res) => {
    try {
        const phone = await memberService.resetPasswordById(req.params.id);
        res.status(200).json({ message: `Đã khôi phục mật khẩu thành công! Mật khẩu mới là: ${phone}` });
    } catch (error) {
        res.status(400).json({ message: error.message || "Lỗi khi khôi phục mật khẩu" });
    }
};

module.exports = { getMembers, addMember, deleteMember, updateMember, resetPassword };