const { Inventory, InventoryTransaction } = require('./inventory.model');
const Member = require('../members/member.model'); 
const FinanceTransaction = require('../finance/transaction.model'); 
const Debt = require('../finance/debt.model'); 
const { sequelize } = require('../../config/db');

const getAllItems = async () => await Inventory.findAll();
const createItem = async (data) => await Inventory.create(data);
const updateItemById = async (id, data) => await Inventory.update(data, { where: { id } });
const deleteItemById = async (id) => await Inventory.destroy({ where: { id } });

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
        let totalAmountWithVat = 0; // Biến tính tổng tiền cuối cùng (Đã gồm VAT)
        const vatRate = parseFloat(data.vatRate) || 0; // Lấy % VAT từ form

        // Xử lý Trạng thái Thanh toán để lưu vào DB hiển thị Read-only
        let finalPaymentStatus = data.paymentStatus;
        let finalPaymentMethod = data.paymentMethod;
        
        if (data.type === 'Xuất' && data.reason === 'Bán hàng') {
            if (data.isCredit) {
                finalPaymentStatus = 'Ghi nợ Xã viên';
                finalPaymentMethod = null;
            } else {
                finalPaymentStatus = 'Đã thanh toán';
            }
        }
        if (data.type === 'Xuất' && data.reason !== 'Bán hàng') {
            finalPaymentStatus = 'Không thu tiền';
            finalPaymentMethod = null;
        }
        
        for (let item of data.items) {
            const inventoryItem = await Inventory.findByPk(item.inventoryId);
            if (!inventoryItem) throw new Error("Không tìm thấy hàng hóa trong kho!");

            if (data.type === 'Xuất' && inventoryItem.quantity < item.quantity) {
                throw new Error(`Tồn kho không đủ cho "${inventoryItem.itemName}". Chỉ còn: ${inventoryItem.quantity}`);
            }

            const newQuantity = data.type === 'Nhập' 
                ? inventoryItem.quantity + parseFloat(item.quantity)
                : inventoryItem.quantity - parseFloat(item.quantity);
            
            const finalUnitPrice = item.unitPrice !== undefined && item.unitPrice !== '' ? item.unitPrice : inventoryItem.unitPrice;

            // TÍNH TOÁN DÒNG TIỀN CHO TỪNG DÒNG SẢN PHẨM CÓ THUẾ VAT
            const lineTotalRaw = parseFloat(item.quantity) * parseFloat(finalUnitPrice);
            const lineVatAmount = lineTotalRaw * (vatRate / 100);
            const lineTotalWithVat = lineTotalRaw + lineVatAmount;

            if (data.type === 'Nhập' || (data.type === 'Xuất' && data.reason === 'Bán hàng')) {
                totalAmountWithVat += lineTotalWithVat;
            }

            if (data.type === 'Nhập' && data.updateBasePrice) {
                inventoryItem.unitPrice = finalUnitPrice; // Giá vốn (Base Price) CHỈ LƯU GIÁ GỐC KHÔNG THUẾ
            }

            await inventoryItem.update({ quantity: newQuantity, lastUpdated: new Date() }, { transaction: t });

            // LƯU CHI TIẾT GIAO DỊCH VỚI ĐẦY ĐỦ THÔNG TIN ĐỂ XEM CHI TIẾT (READ-ONLY)
            await InventoryTransaction.create({
                ticketCode, type: data.type, creator: data.creator, date: data.date,
                reason: data.reason, note: data.note, supplier: data.supplier,
                quantity: item.quantity, unitPrice: finalUnitPrice, InventoryId: item.inventoryId,
                vatRate: vatRate, totalAmount: lineTotalWithVat, 
                paymentStatus: finalPaymentStatus, paymentMethod: finalPaymentMethod, 
                memberPhone: data.memberPhone || null, isCredit: data.isCredit || false
            }, { transaction: t });
        }
        
        // --- XỬ LÝ SỔ QUỸ & CÔNG NỢ BẰNG TỔNG TIỀN ĐÃ CỘNG VAT ---
        if (data.type === 'Nhập') {
            if (data.paymentStatus === 'Đã thanh toán') {
                const completedTrans = await FinanceTransaction.findAll({ where: { status: 'Hoàn thành' }, transaction: t });
                let currentBalance = 0;
                completedTrans.forEach(tr => {
                    if (tr.type === 'Thu') currentBalance += Number(tr.amount);
                    else currentBalance -= Number(tr.amount);
                });

                if (currentBalance < totalAmountWithVat) {
                    throw new Error(`⛔ LỖI KẾ TOÁN: Tồn quỹ hiện tại (${new Intl.NumberFormat('vi-VN').format(currentBalance)}đ) KHÔNG ĐỦ để thanh toán Phiếu nhập này (${new Intl.NumberFormat('vi-VN').format(totalAmountWithVat)}đ). Vui lòng chọn [Ghi nợ NCC] hoặc Nạp thêm Sổ quỹ!`);
                }

                await FinanceTransaction.create({
                    recordDate: data.date, type: 'Chi', category: 'Mua vật tư / Hàng hóa',
                    amount: totalAmountWithVat, paymentMethod: data.paymentMethod || 'Tiền mặt', 
                    creator: data.creator, actor: data.supplier || 'Nhà cung cấp',
                    description: `Thanh toán Phiếu Nhập Kho ${ticketCode} (Gồm VAT ${vatRate}%)`, referenceCode: ticketCode, status: 'Hoàn thành'
                }, { transaction: t });

            } else if (data.paymentStatus === 'Ghi nợ NCC') {
                const finTrans = await FinanceTransaction.create({
                    recordDate: data.date, type: 'Chi', category: 'Mua vật tư / Hàng hóa',
                    amount: totalAmountWithVat, paymentMethod: 'Tiền mặt', creator: data.creator, actor: data.supplier || 'Nhà cung cấp',
                    description: `Ghi nợ Nhà cung cấp Phiếu Nhập Kho ${ticketCode} (Gồm VAT ${vatRate}%)`, referenceCode: ticketCode, status: 'Chờ xử lý'
                }, { transaction: t });

                await Debt.create({
                    actor: data.supplier || 'Nhà cung cấp', type: 'Phải trả', amount: totalAmountWithVat,
                    description: `[Tự động] Ghi nợ mua hàng phiếu ${ticketCode}`, transactionId: finTrans.id
                }, { transaction: t });
            }
        }

        if (data.type === 'Xuất' && data.reason === 'Bán hàng') {
            if (data.isCredit && data.memberPhone) {
                const member = await Member.findOne({ where: { phone: data.memberPhone } });
                if (!member) throw new Error("Không tìm thấy Xã viên với SĐT này để ghi nợ!");
                await member.update({ debtMaterial: Number(member.debtMaterial) + totalAmountWithVat }, { transaction: t });
            } else if (!data.isCredit) {
                let actorName = 'Khách lẻ ngoài HTX';
                if (data.memberPhone) {
                    const member = await Member.findOne({ where: { phone: data.memberPhone } });
                    if (member) actorName = member.name;
                }
                await FinanceTransaction.create({
                    recordDate: data.date, type: 'Thu', category: 'Bán nông sản',
                    amount: totalAmountWithVat, paymentMethod: data.paymentMethod || 'Tiền mặt',
                    creator: data.creator, actor: actorName,
                    description: `Thu tiền Phiếu Xuất Kho bán hàng ${ticketCode} (Gồm VAT ${vatRate}%)`, referenceCode: ticketCode, status: 'Hoàn thành'
                }, { transaction: t });
            }
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

        // Hoàn tiền/nợ dựa vào con số Đã tính thuế (totalAmount) thay vì tính lại từ đầu
        const transCost = record.totalAmount || (parseFloat(record.quantity) * parseFloat(record.unitPrice));

        if (record.type === 'Xuất' && record.reason === 'Bán hàng') {
            if (record.isCredit && record.memberPhone) {
                const member = await Member.findOne({ where: { phone: record.memberPhone } });
                if (member) await member.update({ debtMaterial: Number(member.debtMaterial) - transCost }, { transaction: t });
            } else if (!record.isCredit) {
                const relatedFinTrans = await FinanceTransaction.findOne({ where: { referenceCode: record.ticketCode }, transaction: t });
                if (relatedFinTrans) await relatedFinTrans.destroy({ transaction: t });
            }
        }

        if (record.type === 'Nhập') {
            const relatedFinTrans = await FinanceTransaction.findOne({ where: { referenceCode: record.ticketCode }, transaction: t });
            if (relatedFinTrans) {
                await Debt.destroy({ where: { transactionId: relatedFinTrans.id }, transaction: t });
                await relatedFinTrans.destroy({ transaction: t });
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