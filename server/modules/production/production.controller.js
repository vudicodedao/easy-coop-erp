const productionService = require('./production.service');

const getLogs = async (req, res) => {
    try {
        const logs = await productionService.getAllLogs();
        res.status(200).json(logs);
    } catch (error) {
        res.status(500).json({ message: "Lỗi khi lấy dữ liệu nhật ký canh tác" });
    }
};

const addLog = async (req, res) => {
    try {
        const newLog = await productionService.createLog(req.body);
        res.status(201).json(newLog);
    } catch (error) {
        res.status(500).json({ message: "Lỗi khi thêm nhật ký canh tác" });
    }
};

const updateLog = async (req, res) => {
    try {
        const id = req.params.id;
        await productionService.updateLogById(id, req.body);
        res.status(200).json({ message: "Cập nhật thành công" });
    } catch (error) {
        res.status(500).json({ message: "Lỗi khi cập nhật nhật ký" });
    }
};

const deleteLog = async (req, res) => {
    try {
        const id = req.params.id;
        await productionService.deleteLogById(id);
        res.status(200).json({ message: "Đã xóa thành công" });
    } catch (error) {
        res.status(500).json({ message: "Lỗi khi xóa nhật ký" });
    }
};

module.exports = {
    getLogs,
    addLog,
    updateLog,
    deleteLog
};