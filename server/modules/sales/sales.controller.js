const salesService = require('./sales.service');

const getOrders = async (req, res) => {
    try {
        const orders = await salesService.getAllOrders();
        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ message: "Lỗi lấy danh sách đơn hàng" });
    }
};

const addOrder = async (req, res) => {
    try {
        const newOrder = await salesService.createOrder(req.body);
        res.status(201).json(newOrder);
    } catch (error) {
        res.status(400).json({ message: error.message || "Lỗi tạo đơn hàng" });
    }
};

const updateStatus = async (req, res) => {
    try {
        await salesService.updateOrderStatus(req.params.id, req.body);
        res.status(200).json({ message: "Cập nhật trạng thái thành công" });
    } catch (error) {
        res.status(500).json({ message: "Lỗi cập nhật đơn hàng" });
    }
};

const removeOrder = async (req, res) => {
    try {
        await salesService.deleteOrder(req.params.id);
        res.status(200).json({ message: "Đã xóa đơn hàng" });
    } catch (error) {
        res.status(500).json({ message: "Lỗi khi xóa" });
    }
};

module.exports = { getOrders, addOrder, updateStatus, removeOrder };