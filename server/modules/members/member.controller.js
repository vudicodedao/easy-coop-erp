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
        // Trả về chính xác thông báo lỗi từ Service (SĐT trùng, SĐT sai định dạng...)
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

module.exports = { getMembers, addMember, deleteMember, updateMember };