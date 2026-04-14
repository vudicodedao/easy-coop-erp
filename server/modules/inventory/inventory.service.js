const { Inventory, InventoryTransaction } = require('./inventory.model');
const Member = require('../members/member.model'); // Import Model Member để thao tác ví công nợ
const { sequelize } = require('../../config/db');

// --- CÁC HÀM CHO DANH MỤC KHO GỐC ---
const getAllItems = async () => await Inventory.findAll();
const createItem = async (data) => await Inventory.create(data);
const updateItemById = async (id, data) => await Inventory.update(data, { where: { id } });
const deleteItemById = async (id) => await Inventory.destroy({ where: { id } });

// --- CÁC HÀM CHO LỊCH SỬ NHẬP / XUẤT KHO ---
const getTransactions = async (type) => {
    return await InventoryTransaction.findAll({
        where: type ? { type } : {},
        include: [Inventory],
        order: [['createdAt', 'DESC']]
    });
};

const createTransaction = async (data) => {
    const t = await sequelize.transaction();
    try {
        const ticketCode = data.type === 'Nhập' ? `PN-${Date.now()}` : `PX-${Date.now()}`;
        let totalDebt = 0; // Biến tính tổng tiền nợ
        
        for (let item of data.items) {
            const inventoryItem = await Inventory.findByPk(item.inventoryId);
            if (!inventoryItem) throw new Error("Không tìm thấy hàng hóa trong kho!");

            if (data.type === 'Xuất' && inventoryItem.quantity < item.quantity) {
                throw new Error(`Tồn kho không đủ cho "${inventoryItem.itemName}". Chỉ còn: ${inventoryItem.quantity}`);
            }

            const newQuantity = data.type === 'Nhập' 
                ? inventoryItem.quantity + parseFloat(item.quantity)
                : inventoryItem.quantity - parseFloat(item.quantity);
            
            await inventoryItem.update({ quantity: newQuantity, lastUpdated: new Date() }, { transaction: t });

            const finalUnitPrice = item.unitPrice || inventoryItem.unitPrice;

            // Tính tổng tiền nếu đây là phiếu Ghi nợ
            if (data.type === 'Xuất' && data.isCredit) {
                totalDebt += (parseFloat(item.quantity) * parseFloat(finalUnitPrice));
            }

            await InventoryTransaction.create({
                ticketCode,
                type: data.type,
                creator: data.creator,
                date: data.date,
                reason: data.reason,
                note: data.note,
                supplier: data.supplier,
                quantity: item.quantity,
                unitPrice: finalUnitPrice,
                InventoryId: item.inventoryId,
                memberPhone: data.memberPhone || null,
                isCredit: data.isCredit || false
            }, { transaction: t });
        }
        
        // NẾU LÀ PHIẾU XUẤT BÁN CHỊU: Tự động cộng tiền vào ví NỢ VẬT TƯ của Xã viên
        if (data.type === 'Xuất' && data.isCredit && data.memberPhone) {
            const member = await Member.findOne({ where: { phone: data.memberPhone } });
            if (!member) throw new Error("Không tìm thấy Xã viên với SĐT này để ghi nợ!");
            await member.update({ debtMaterial: Number(member.debtMaterial) + totalDebt }, { transaction: t });
        }
        
        await t.commit(); 
        return { message: "Đã lưu phiếu và cập nhật kho thành công!" };
    } catch (error) {
        await t.rollback(); 
        throw error;
    }
};

const deleteTransaction = async (id) => {
    const t = await sequelize.transaction();
    try {
        const record = await InventoryTransaction.findByPk(id);
        if (!record) throw new Error("Không tìm thấy phiếu!");

        const inventoryItem = await Inventory.findByPk(record.InventoryId);
        if (inventoryItem) {
            const rollbackQty = record.type === 'Nhập' 
                ? inventoryItem.quantity - record.quantity
                : inventoryItem.quantity + record.quantity;
            await inventoryItem.update({ quantity: rollbackQty }, { transaction: t });
        }

        // NẾU XÓA PHIẾU BÁN CHỊU: Tự động trừ lại tiền nợ cho Xã viên
        if (record.type === 'Xuất' && record.isCredit && record.memberPhone) {
            const member = await Member.findOne({ where: { phone: record.memberPhone } });
            if (member) {
                const debtToSubtract = parseFloat(record.quantity) * parseFloat(record.unitPrice);
                await member.update({ debtMaterial: Number(member.debtMaterial) - debtToSubtract }, { transaction: t });
            }
        }

        await record.destroy({ transaction: t });
        await t.commit();
        return { message: "Đã xóa phiếu và hoàn lại số lượng kho!" };
    } catch (error) {
        await t.rollback();
        throw error;
    }
};

module.exports = { 
    getAllItems, createItem, updateItemById, deleteItemById,
    getTransactions, createTransaction, deleteTransaction
};