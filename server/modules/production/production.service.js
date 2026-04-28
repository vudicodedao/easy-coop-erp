const ProductionLog = require('./productionLog.model');
const { Inventory, InventoryTransaction } = require('../inventory/inventory.model');
const Member = require('../members/member.model');
const { sequelize } = require('../../config/db');

const getAllLogs = async () => {
    return await ProductionLog.findAll({
        order: [['activityDate', 'DESC']]
    });
};

const createLog = async (data) => {
    const t = await sequelize.transaction();
    try {
        let totalMaterialCost = 0;
        let usedItemsList = [];
        let materialsUsedText = [];

        // 1. Quét mảng danh sách các vật tư/công cụ được thêm vào
        if (data.usedItems && data.usedItems.length > 0) {
            for (let item of data.usedItems) {
                if (!item.inventoryId || !item.quantity) continue;
                
                const inventoryItem = await Inventory.findByPk(item.inventoryId);
                if (!inventoryItem) throw new Error("Không tìm thấy vật tư/công cụ trong kho!");
                if (inventoryItem.quantity < item.quantity) {
                    throw new Error(`Kho không đủ "${inventoryItem.itemName}". Chỉ còn: ${inventoryItem.quantity}`);
                }

                // Trừ số lượng tồn kho
                await inventoryItem.update({ quantity: inventoryItem.quantity - parseFloat(item.quantity) }, { transaction: t });
                
                // Tính tiền (chỉ những món có đơn giá mới phát sinh chi phí)
                const itemCost = parseFloat(item.quantity) * parseFloat(inventoryItem.unitPrice || 0);
                totalMaterialCost += itemCost;

                // Tạo phiếu Xuất Kho cho từng món
                await InventoryTransaction.create({
                    ticketCode: `PX-CANHTAC-${Date.now()}-${item.inventoryId}`,
                    type: 'Xuất',
                    creator: data.executor,
                    date: data.activityDate || new Date(),
                    reason: 'Xuất sử dụng',
                    note: `Xuất cho hoạt động: ${data.activityType} (${data.seasonName})`,
                    quantity: item.quantity,
                    unitPrice: inventoryItem.unitPrice,
                    InventoryId: item.inventoryId,
                    memberPhone: data.creatorPhone,
                    isCredit: true // Ghi nợ
                }, { transaction: t });

                materialsUsedText.push(`${inventoryItem.itemName} (SL: ${item.quantity})`);
                usedItemsList.push({ id: inventoryItem.id, qty: item.quantity, cost: itemCost });
            }
        }

        // 2. LUÔN LUÔN Cộng tổng tiền vào ví NỢ VẬT TƯ của đúng Xã viên (Fix lỗi Giám đốc)
        if (data.creatorPhone && totalMaterialCost > 0) {
            const member = await Member.findOne({ where: { phone: data.creatorPhone } });
            if (member) {
                await member.update({ debtMaterial: Number(member.debtMaterial) + totalMaterialCost }, { transaction: t });
            }
        }

        // 3. Chuẩn bị dữ liệu ghi vào bảng Nhật ký
        data.isDebt = true; 
        data.materialCost = totalMaterialCost;
        data.materialsUsed = materialsUsedText.join(' + ');
        
        // MẸO ERP: Lưu mảng JSON vào cột toolsUsed để giữ được ID và số lượng gốc, phục vụ việc hoàn trả sau này
        data.toolsUsed = JSON.stringify(usedItemsList);

        const log = await ProductionLog.create(data, { transaction: t });
        await t.commit();
        return log;
    } catch (error) {
        await t.rollback();
        throw error;
    }
};

const updateLogById = async (id, data) => {
    // Các trường vật tư và người thực hiện đã bị khóa ở Frontend nên chỉ update Text
    return await ProductionLog.update(data, { where: { id: id } });
};

const deleteLogById = async (id) => {
    const t = await sequelize.transaction();
    try {
        const log = await ProductionLog.findByPk(id);
        if (!log) throw new Error("Không tìm thấy nhật ký!");

        // Giải mã chuỗi JSON để lấy danh sách vật tư đã dùng
        let usedItemsList = [];
        try { usedItemsList = JSON.parse(log.toolsUsed || '[]'); } catch(e) {}

        // Tương thích ngược với dữ liệu cũ (chỉ có 1 vật tư)
        if (usedItemsList.length === 0 && log.inventoryId && log.materialQuantity > 0) {
            usedItemsList.push({ id: log.inventoryId, qty: log.materialQuantity, cost: log.materialCost });
        }

        // 1. Dùng vòng lặp để Hoàn trả tất cả vật tư vào kho
        if (usedItemsList.length > 0) {
            for (let item of usedItemsList) {
                const inventoryItem = await Inventory.findByPk(item.id);
                if (inventoryItem) {
                    await inventoryItem.update({ quantity: inventoryItem.quantity + parseFloat(item.qty) }, { transaction: t });
                    await InventoryTransaction.create({
                        ticketCode: `PN-HOAN-${Date.now()}-${item.id}`, type: 'Nhập', creator: 'Hệ thống',
                        date: new Date(), reason: 'Khác', note: `Hoàn kho do xóa nhật ký canh tác (ID: ${log.id})`,
                        quantity: item.qty, unitPrice: inventoryItem.unitPrice || 0, InventoryId: item.id
                    }, { transaction: t });
                }
            }
        }

        // 2. Hoàn (Trừ đi) tiền nợ cho Xã viên
        if (log.creatorPhone) {
            const member = await Member.findOne({ where: { phone: log.creatorPhone } });
            if (member) {
                await member.update({ debtMaterial: Math.max(0, Number(member.debtMaterial) - Number(log.materialCost || 0)) }, { transaction: t });
            }
        }

        await log.destroy({ transaction: t });
        await t.commit();
        return true;
    } catch (error) {
        await t.rollback();
        throw error;
    }
};

module.exports = { getAllLogs, createLog, updateLogById, deleteLogById };