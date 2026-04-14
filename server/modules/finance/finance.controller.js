const financeService = require('./finance.service');

const getRecords = async (req, res) => {
    try {
        const records = await financeService.getAllRecords();
        res.status(200).json(records);
    } catch (error) {
        res.status(500).json({ message: "Lỗi lấy danh sách giao dịch" });
    }
};

const addRecord = async (req, res) => {
    try {
        const newRecord = await financeService.createRecord(req.body);
        res.status(201).json(newRecord);
    } catch (error) {
        console.error("Lỗi tạo giao dịch:", error);
        res.status(500).json({ message: "Lỗi khi tạo giao dịch mới" });
    }
};

const updateRecord = async (req, res) => {
    try {
        await financeService.updateRecordById(req.params.id, req.body);
        res.status(200).json({ message: "Cập nhật thành công" });
    } catch (error) {
        res.status(500).json({ message: "Lỗi cập nhật giao dịch" });
    }
};

const deleteRecord = async (req, res) => {
    try {
        await financeService.deleteRecordById(req.params.id);
        res.status(200).json({ message: "Đã xóa giao dịch" });
    } catch (error) {
        res.status(500).json({ message: "Lỗi khi xóa giao dịch" });
    }
};

module.exports = { getRecords, addRecord, updateRecord, deleteRecord };