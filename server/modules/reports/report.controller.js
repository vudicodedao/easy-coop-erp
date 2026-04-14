const reportService = require('./report.service');

const getStats = async (req, res) => {
    try {
        const stats = await reportService.getDashboardStats();
        res.status(200).json(stats);
    } catch (error) {
        console.error("Lỗi lấy báo cáo:", error);
        res.status(500).json({ message: "Lỗi hệ thống khi lấy báo cáo" });
    }
};

module.exports = { getStats };