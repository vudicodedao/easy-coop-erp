const FinanceTransaction = require('./transaction.model');
const Debt = require('./debt.model');
const Member = require('../members/member.model'); 
const { sequelize } = require('../../config/db');

const getAllRecords = async () => {
    return await FinanceTransaction.findAll({
        order: [['recordDate', 'DESC'], ['createdAt', 'DESC']]
    });
};

const createRecord = async (data) => {
    const t = await sequelize.transaction();
    try {
        // [KIỂM TRA AN TOÀN BƯỚC 1]: Nếu là Thu/Chi công nợ, không cho phép nhập số tiền lớn hơn số nợ thực tế
        if (data.status === 'Hoàn thành' && data.memberPhone) {
            const member = await Member.findOne({ where: { phone: data.memberPhone } });
            if (member) {
                const amt = Number(data.amount);
                if (data.category === 'Thu nợ vật tư' && amt > Number(member.debtMaterial || 0)) {
                    throw new Error(`Xã viên chỉ nợ vật tư ${member.debtMaterial}đ. Không thể thu vượt mức!`);
                }
                if (data.category === 'Thu hồi tạm ứng' && amt > Number(member.advancePayment || 0)) {
                    throw new Error(`Xã viên chỉ nợ tạm ứng ${member.advancePayment}đ. Không thể thu vượt mức!`);
                }
                if (data.category === 'Chi trả nợ thu mua' && amt > Number(member.debtPurchase || 0)) {
                    throw new Error(`HTX chỉ nợ Xã viên ${member.debtPurchase}đ. Không thể chi trả vượt mức!`);
                }
                
                // [TƯƠNG TÁC VÍ NẾU HỢP LỆ]
                if (data.category === 'Chi ứng trước') {
                    await member.update({ advancePayment: Number(member.advancePayment) + amt }, { transaction: t });
                }
                else if (data.category === 'Thu nợ vật tư') {
                    await member.update({ debtMaterial: Number(member.debtMaterial) - amt }, { transaction: t });
                }
                else if (data.category === 'Thu hồi tạm ứng') {
                    await member.update({ advancePayment: Number(member.advancePayment) - amt }, { transaction: t });
                }
                else if (data.category === 'Chi trả nợ thu mua') {
                    await member.update({ debtPurchase: Number(member.debtPurchase) - amt }, { transaction: t });
                }
                else if (data.category === 'Góp vốn xã viên') {
                    // [THÊM MỚI]: Cập nhật Vốn góp
                    await member.update({ capital: Number(member.capital || 0) + amt }, { transaction: t });
                }
                else if (data.category === 'Quyết toán công nợ') {
                    await member.update({ debtMaterial: 0, debtPurchase: 0, advancePayment: 0 }, { transaction: t });
                }
            }
        }

        // Tạo giao dịch Thu/Chi
        const transaction = await FinanceTransaction.create(data, { transaction: t });

        // Tạo Sổ Công Nợ nếu "Chờ xử lý"
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
    return await FinanceTransaction.update(data, { where: { id: id } });
};

const deleteRecordById = async (id) => {
    const t = await sequelize.transaction();
    try {
        const record = await FinanceTransaction.findByPk(id);
        if (!record) throw new Error("Không tìm thấy phiếu!");

        // HOÀN LẠI CÔNG NỢ & VỐN GÓP NẾU XÓA PHIẾU
        if (record.status === 'Hoàn thành' && record.memberPhone && record.category !== 'Quyết toán công nợ') {
            const member = await Member.findOne({ where: { phone: record.memberPhone } });
            if (member) {
                const amt = Number(record.amount);
                if (record.category === 'Chi ứng trước') {
                    await member.update({ advancePayment: Math.max(0, Number(member.advancePayment) - amt) }, { transaction: t });
                } else if (record.category === 'Thu nợ vật tư') {
                    await member.update({ debtMaterial: Number(member.debtMaterial) + amt }, { transaction: t });
                } else if (record.category === 'Thu hồi tạm ứng') {
                    await member.update({ advancePayment: Number(member.advancePayment) + amt }, { transaction: t });
                } else if (record.category === 'Chi trả nợ thu mua') {
                    await member.update({ debtPurchase: Number(member.debtPurchase) + amt }, { transaction: t });
                } else if (record.category === 'Góp vốn xã viên') {
                    await member.update({ capital: Math.max(0, Number(member.capital || 0) - amt) }, { transaction: t });
                }
            }
        }

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