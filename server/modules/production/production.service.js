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
        if (data.inventoryId && data.materialQuantity > 0) {
            const inventoryItem = await Inventory.findByPk(data.inventoryId);
            if (!inventoryItem) throw new Error("Không tìm thấy vật tư trong kho!");
            if (inventoryItem.quantity < data.materialQuantity) {
                throw new Error(`Kho không đủ "${inventoryItem.itemName}". Chỉ còn: ${inventoryItem.quantity}`);
            }

            // 1. Trừ số lượng tồn kho
            await inventoryItem.update({ quantity: inventoryItem.quantity - parseFloat(data.materialQuantity) }, { transaction: t });

            // 2. Tính tổng tiền vật tư
            data.materialCost = parseFloat(data.materialQuantity) * parseFloat(inventoryItem.unitPrice || 0);

            // 3. Tạo phiếu Xuất Kho (Mặc định isCredit: true vì luôn luôn ghi nợ)
            await InventoryTransaction.create({
                ticketCode: `PX-CANHTAC-${Date.now()}`,
                type: 'Xuất',
                creator: data.executor,
                date: data.activityDate || new Date(),
                reason: 'Xuất sử dụng',
                note: `Xuất vật tư cho hoạt động: ${data.activityType} (${data.seasonName})`,
                quantity: data.materialQuantity,
                unitPrice: inventoryItem.unitPrice,
                InventoryId: data.inventoryId,
                memberPhone: data.creatorPhone,
                isCredit: true // LUÔN LUÔN GHI NỢ
            }, { transaction: t });

            // 4. LUÔN LUÔN Cộng tiền vào ví NỢ VẬT TƯ của Xã viên
            if (data.creatorPhone) {
                const member = await Member.findOne({ where: { phone: data.creatorPhone } });
                if (member) {
                    await member.update({ debtMaterial: Number(member.debtMaterial) + data.materialCost }, { transaction: t });
                }
            }
        }

        // Ép isDebt = true trước khi lưu vào database
        data.isDebt = true; 
        const log = await ProductionLog.create(data, { transaction: t });
        await t.commit();
        return log;
    } catch (error) {
        await t.rollback();
        throw error;
    }
};

const updateLogById = async (id, data) => {
    return await ProductionLog.update(data, { where: { id: id } });
};

const deleteLogById = async (id) => {
    const t = await sequelize.transaction();
    try {
        const log = await ProductionLog.findByPk(id);
        if (!log) throw new Error("Không tìm thấy nhật ký!");

        if (log.inventoryId && log.materialQuantity > 0) {
            const inventoryItem = await Inventory.findByPk(log.inventoryId);
            if (inventoryItem) {
                // 1. Hoàn Kho
                await inventoryItem.update({ quantity: inventoryItem.quantity + log.materialQuantity }, { transaction: t });
                await InventoryTransaction.create({
                    ticketCode: `PN-HOAN-${Date.now()}`, type: 'Nhập', creator: 'Hệ thống',
                    date: new Date(), reason: 'Khác', note: `Hoàn kho do xóa nhật ký canh tác (ID: ${log.id})`,
                    quantity: log.materialQuantity, unitPrice: inventoryItem.unitPrice || 0, InventoryId: log.inventoryId
                }, { transaction: t });
            }

            // 2. LUÔN LUÔN Hoàn (Trừ) tiền nợ cho Xã viên
            if (log.creatorPhone) {
                const member = await Member.findOne({ where: { phone: log.creatorPhone } });
                if (member) {
                    await member.update({ debtMaterial: Math.max(0, Number(member.debtMaterial) - log.materialCost) }, { transaction: t });
                }
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