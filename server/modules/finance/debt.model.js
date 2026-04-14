const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');

const Debt = sequelize.define('Debt', {
    actor: { type: DataTypes.STRING, allowNull: false }, // Tên người nợ / Chủ nợ
    type: { type: DataTypes.ENUM('Phải thu', 'Phải trả'), allowNull: false },
    amount: { type: DataTypes.BIGINT, allowNull: false },
    description: { type: DataTypes.TEXT },
    status: { 
        type: DataTypes.ENUM('Chưa thanh toán', 'Đã thanh toán'), 
        defaultValue: 'Chưa thanh toán' 
    },
    transactionId: { type: DataTypes.INTEGER } // ID của giao dịch Thu/Chi gốc
});

module.exports = Debt;