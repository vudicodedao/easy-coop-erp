const ProductionLog = require('./productionLog.model');
const { Inventory, InventoryTransaction } = require('../inventory/inventory.model');
const Member = require('../members/member.model');
const { sequelize } = require('../../config/db');

const getAllLogs = async () => {
    return await ProductionLog.findAll({ order: [['activityDate', 'DESC']] });
};

const createLog = async (data) => {
    const t = await sequelize.transaction();
    try {
        let totalMaterialCost = 0;
        let usedItemsList = [];
        let materialsUsedText = [];

        if (data.usedItems && data.usedItems.length > 0) {
            for (let item of data.usedItems) {
                if (!item.inventoryId || !item.quantity) continue;
                
                const inventoryItem = await Inventory.findByPk(item.inventoryId);
                if (!inventoryItem) throw new Error("Không tìm thấy vật tư/công cụ trong kho!");
                if (inventoryItem.quantity < item.quantity) {
                    throw new Error(`Kho không đủ "${inventoryItem.itemName}". Chỉ còn: ${inventoryItem.quantity}`);
                }

                // Trừ Kho
                await inventoryItem.update({ quantity: inventoryItem.quantity - parseFloat(item.quantity) }, { transaction: t });
                
                // PHÂN LOẠI: Nếu là Công cụ thì KHÔNG TÍNH TIỀN
                let itemCost = 0;
                let isTool = inventoryItem.category === 'Công cụ dụng cụ';
                
                if (!isTool) {
                    itemCost = parseFloat(item.quantity) * parseFloat(inventoryItem.unitPrice || 0);
                    totalMaterialCost += itemCost;
                }

                // Ghi phiếu xuất
                await InventoryTransaction.create({
                    ticketCode: `PX-CANHTAC-${Date.now()}-${item.inventoryId}`,
                    type: 'Xuất', creator: data.executor, date: data.activityDate || new Date(),
                    reason: isTool ? 'Xuất cho mượn' : 'Xuất sử dụng',
                    note: `Xuất cho hoạt động: ${data.activityType} (${data.seasonName})`,
                    quantity: item.quantity, unitPrice: inventoryItem.unitPrice,
                    InventoryId: item.inventoryId, memberPhone: data.creatorPhone,
                    isCredit: !isTool // Chỉ ghi nợ tài chính nếu không phải công cụ
                }, { transaction: t });

                materialsUsedText.push(`${inventoryItem.itemName} (SL: ${item.quantity})`);
                
                // LƯU CẢ TRẠNG THÁI CỦA MÓN ĐỒ VÀO JSON ĐỂ QUẢN LÝ
                usedItemsList.push({ 
                    id: inventoryItem.id, itemName: inventoryItem.itemName, qty: item.quantity, 
                    unitPrice: inventoryItem.unitPrice || 0, cost: itemCost, 
                    isTool: isTool, status: isTool ? 'Đang mượn' : 'Đã tiêu hao' 
                });
            }
        }

        // Ghi Nợ Vật Tư cho Xã viên (Chỉ tiền vật tư, hạt giống)
        if (data.creatorPhone && totalMaterialCost > 0) {
            const member = await Member.findOne({ where: { phone: data.creatorPhone } });
            if (member) await member.update({ debtMaterial: Number(member.debtMaterial) + totalMaterialCost }, { transaction: t });
        }

        data.isDebt = true; 
        data.materialCost = totalMaterialCost;
        data.materialsUsed = materialsUsedText.join(' + ');
        data.toolsUsed = JSON.stringify(usedItemsList); // Lưu ẩn JSON

        const log = await ProductionLog.create(data, { transaction: t });
        await t.commit();
        return log;
    } catch (error) {
        await t.rollback();
        throw error;
    }
};

const updateLogById = async (id, data) => { return await ProductionLog.update(data, { where: { id: id } }); };

const deleteLogById = async (id) => {
    const t = await sequelize.transaction();
    try {
        const log = await ProductionLog.findByPk(id);
        if (!log) throw new Error("Không tìm thấy nhật ký!");

        let usedItemsList = [];
        try { usedItemsList = JSON.parse(log.toolsUsed || '[]'); } catch(e) {}

        // Hoàn Kho và Hoàn Tiền Nợ
        if (usedItemsList.length > 0) {
            for (let item of usedItemsList) {
                // Chỉ hoàn kho những đồ chưa trả hoặc vật tư
                if (item.status === 'Đã trả' || item.status === 'Đã đền bù') continue;

                const inventoryItem = await Inventory.findByPk(item.id);
                if (inventoryItem) {
                    await inventoryItem.update({ quantity: inventoryItem.quantity + parseFloat(item.qty) }, { transaction: t });
                    await InventoryTransaction.create({
                        ticketCode: `PN-HOAN-${Date.now()}-${item.id}`, type: 'Nhập', creator: 'Hệ thống',
                        date: new Date(), reason: 'Khác', note: `Hoàn kho do xóa nhật ký (ID: ${log.id})`,
                        quantity: item.qty, unitPrice: inventoryItem.unitPrice || 0, InventoryId: item.id
                    }, { transaction: t });
                }
            }
        }

        if (log.creatorPhone && log.materialCost > 0) {
            const member = await Member.findOne({ where: { phone: log.creatorPhone } });
            if (member) await member.update({ debtMaterial: Math.max(0, Number(member.debtMaterial) - Number(log.materialCost)) }, { transaction: t });
        }

        await log.destroy({ transaction: t });
        await t.commit();
        return true;
    } catch (error) {
        await t.rollback();
        throw error;
    }
};

// [THÊM MỚI] - XỬ LÝ NÚT BẤM MƯỢN TRẢ ĐỀN BÙ
const processToolAction = async (logId, toolId, action, creatorPhone, executor) => {
    const t = await sequelize.transaction();
    try {
        const log = await ProductionLog.findByPk(logId);
        if (!log) throw new Error("Không tìm thấy nhật ký");

        let usedItemsList = JSON.parse(log.toolsUsed || '[]');
        let targetToolIndex = usedItemsList.findIndex(i => i.id === toolId && i.isTool === true);
        if (targetToolIndex === -1) throw new Error("Không tìm thấy công cụ này trong nhật ký");

        let targetTool = usedItemsList[targetToolIndex];

        if (action === 'return') {
            // 1. TRẢ ĐỒ: Cộng lại kho
            const inventoryItem = await Inventory.findByPk(toolId);
            if (inventoryItem) {
                await inventoryItem.update({ quantity: inventoryItem.quantity + parseFloat(targetTool.qty) }, { transaction: t });
                await InventoryTransaction.create({
                    ticketCode: `PN-TRA-${Date.now()}`, type: 'Nhập', creator: executor,
                    date: new Date(), reason: 'Khác', note: `Trả công cụ mượn (Nhật ký: ${log.id})`,
                    quantity: targetTool.qty, unitPrice: inventoryItem.unitPrice, InventoryId: toolId
                }, { transaction: t });
            }
            usedItemsList[targetToolIndex].status = 'Đã trả';

        } else if (action === 'lost') {
            // 2. LÀM MẤT/HỎNG: Không cộng kho, Phạt tiền cộng vào Nợ Vật tư
            const penaltyCost = parseFloat(targetTool.qty) * parseFloat(targetTool.unitPrice);
            if (creatorPhone) {
                const member = await Member.findOne({ where: { phone: creatorPhone } });
                if (member) {
                    await member.update({ debtMaterial: Number(member.debtMaterial) + penaltyCost }, { transaction: t });
                }
            }
            usedItemsList[targetToolIndex].status = 'Đã đền bù';
            
            // Cập nhật lại tổng tiền nợ hiển thị trong log
            log.materialCost = Number(log.materialCost || 0) + penaltyCost;
        }

        // Lưu lại JSON mới
        log.toolsUsed = JSON.stringify(usedItemsList);
        await log.save({ transaction: t });

        await t.commit();
        return true;
    } catch (error) {
        await t.rollback();
        throw error;
    }
};

module.exports = { getAllLogs, createLog, updateLogById, deleteLogById, processToolAction };