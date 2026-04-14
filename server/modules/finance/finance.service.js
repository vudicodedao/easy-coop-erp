const FinanceTransaction = require('./transaction.model');
const Debt = require('./debt.model');
const Member = require('../members/member.model'); // Import Member để tương tác ví
const { sequelize } = require('../../config/db');

const getAllRecords = async () => {
    return await FinanceTransaction.findAll({
        order: [['recordDate', 'DESC'], ['createdAt', 'DESC']]
    });
};

const createRecord = async (data) => {
    const t = await sequelize.transaction();
    try {
        // 1. Tạo giao dịch Thu/Chi
        const transaction = await FinanceTransaction.create(data, { transaction: t });

        // 2. LOGIC TỰ ĐỘNG CẬP NHẬT 3 VÍ CÔNG NỢ (Nếu đã Hoàn thành)
        if (data.status === 'Hoàn thành' && data.memberPhone) {
            const member = await Member.findOne({ where: { phone: data.memberPhone } });
            if (member) {
                // Tương tác trực tiếp với các Ví
                if (data.category === 'Chi ứng trước') {
                    await member.update({ advancePayment: Number(member.advancePayment) + Number(data.amount) }, { transaction: t });
                }
                else if (data.category === 'Thu nợ vật tư') {
                    await member.update({ debtMaterial: Math.max(0, Number(member.debtMaterial) - Number(data.amount)) }, { transaction: t });
                }
                else if (data.category === 'Thu hồi tạm ứng') {
                    await member.update({ advancePayment: Math.max(0, Number(member.advancePayment) - Number(data.amount)) }, { transaction: t });
                }
                else if (data.category === 'Chi trả nợ thu mua') {
                    await member.update({ debtPurchase: Math.max(0, Number(member.debtPurchase) - Number(data.amount)) }, { transaction: t });
                }
                else if (data.category === 'Quyết toán công nợ') {
                    // SIÊU NÚT BẤM: Reset cả 3 ví về 0 (Đã bù trừ xong)
                    await member.update({ debtMaterial: 0, debtPurchase: 0, advancePayment: 0 }, { transaction: t });
                }
            }
        }

        // 3. LOGIC TỰ ĐỘNG CỦA BẠN: Ghi vào Sổ Công Nợ nếu "Chờ xử lý"
        if (data.status === 'Chờ xử lý') {
            await Debt.create({
                actor: data.actor || 'Không xác định',
                type: data.type === 'Thu' ? 'Phải thu' : 'Phải trả',
                amount: data.amount,
                description: `[Tự động] Công nợ từ giao dịch: ${data.category} (${data.description || ''})`,
                transactionId: transaction.id
            }, { transaction: t });
        }

        await t.commit();
        return transaction;
    } catch (error) {
        await t.rollback();
        throw error;
    }
};

const updateRecordById = async (id, data) => {
    // Cập nhật giao dịch Thu/Chi thông thường
    return await FinanceTransaction.update(data, { where: { id: id } });
};

const deleteRecordById = async (id) => {
    const t = await sequelize.transaction();
    try {
        const record = await FinanceTransaction.findByPk(id);
        if (!record) throw new Error("Không tìm thấy phiếu!");

        // HOÀN LẠI CÔNG NỢ NẾU XÓA PHIẾU (Safety rollback)
        if (record.status === 'Hoàn thành' && record.memberPhone && record.category !== 'Quyết toán công nợ') {
            const member = await Member.findOne({ where: { phone: record.memberPhone } });
            if (member) {
                if (record.category === 'Chi ứng trước') {
                    await member.update({ advancePayment: Math.max(0, Number(member.advancePayment) - Number(record.amount)) }, { transaction: t });
                } else if (record.category === 'Thu nợ vật tư') {
                    await member.update({ debtMaterial: Number(member.debtMaterial) + Number(record.amount) }, { transaction: t });
                } else if (record.category === 'Thu hồi tạm ứng') {
                    await member.update({ advancePayment: Number(member.advancePayment) + Number(record.amount) }, { transaction: t });
                } else if (record.category === 'Chi trả nợ thu mua') {
                    await member.update({ debtPurchase: Number(member.debtPurchase) + Number(record.amount) }, { transaction: t });
                }
            }
        }

        // Xóa luôn Công nợ chờ liên quan (Logic cũ của bạn)
        await Debt.destroy({ where: { transactionId: id }, transaction: t });
        await record.destroy({ transaction: t });
        
        await t.commit();
        return true;
    } catch (error) {
        await t.rollback();
        throw error;
    }
};

module.exports = { getAllRecords, createRecord, updateRecordById, deleteRecordById };