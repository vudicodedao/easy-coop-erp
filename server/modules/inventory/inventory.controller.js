const inventoryService = require('./inventory.service');

// --- DANH MỤC HÀNG HÓA ---
const getItems = async (req, res) => {
    try { res.status(200).json(await inventoryService.getAllItems()); } 
    catch (error) { res.status(500).json({ message: "Lỗi lấy dữ liệu kho" }); }
};
const addItem = async (req, res) => {
    try { res.status(201).json(await inventoryService.createItem(req.body)); } 
    catch (error) { res.status(500).json({ message: "Lỗi thêm vật tư mới" }); }
};
const updateItem = async (req, res) => {
    try { await inventoryService.updateItemById(req.params.id, req.body); res.status(200).json({ message: "Cập nhật thành công" }); } 
    catch (error) { res.status(500).json({ message: "Lỗi cập nhật kho" }); }
};
const deleteItem = async (req, res) => {
    try { await inventoryService.deleteItemById(req.params.id); res.status(200).json({ message: "Xóa thành công" }); } 
    catch (error) { res.status(500).json({ message: "Lỗi xóa vật tư" }); }
};

// --- GIAO DỊCH NHẬP / XUẤT ---
const getTransactions = async (req, res) => {
    try { res.status(200).json(await inventoryService.getTransactions(req.query.type)); } 
    catch (error) { res.status(500).json({ message: "Lỗi lấy danh sách phiếu" }); }
};
const addTransaction = async (req, res) => {
    try { await inventoryService.createTransaction(req.body); res.status(201).json({ message: "Tạo phiếu thành công" }); } 
    catch (error) { res.status(400).json({ message: error.message || "Lỗi tạo phiếu" }); }
};
const removeTransaction = async (req, res) => {
    try { await inventoryService.deleteTransaction(req.params.id); res.status(200).json({ message: "Đã xóa phiếu" }); } 
    catch (error) { res.status(500).json({ message: "Lỗi khi xóa phiếu" }); }
};

module.exports = { getItems, addItem, updateItem, deleteItem, getTransactions, addTransaction, removeTransaction };