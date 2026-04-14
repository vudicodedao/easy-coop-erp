const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');

const FinanceTransaction = sequelize.define('FinanceTransaction', {
    recordDate: { type: DataTypes.DATEONLY, allowNull: false },
    type: { type: DataTypes.ENUM('Thu', 'Chi'), allowNull: false },
    category: { type: DataTypes.STRING, allowNull: false }, // Danh mục
    amount: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
    paymentMethod: { type: DataTypes.ENUM('Tiền mặt', 'Chuyển khoản'), defaultValue: 'Tiền mặt' }, 
    creator: { type: DataTypes.STRING }, // Người tạo phiếu
    actor: { type: DataTypes.STRING }, // Người nộp / Người nhận
    description: { type: DataTypes.TEXT },
    referenceCode: { type: DataTypes.STRING },
    status: { 
        type: DataTypes.ENUM('Hoàn thành', 'Chờ xử lý', 'Đã hủy'), 
        defaultValue: 'Hoàn thành' 
    },
    // --- THÊM MỚI (V3.5): Liên kết an toàn với Xã viên ---
    memberPhone: { type: DataTypes.STRING } 
});

module.exports = FinanceTransaction;