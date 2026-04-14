const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');

const Member = sequelize.define('Member', {
    name: { type: DataTypes.STRING, allowNull: false },
    cccd: { type: DataTypes.STRING, unique: true }, 
    phone: { type: DataTypes.STRING, unique: true, allowNull: false }, // Đã khóa KHÔNG CHO TRÙNG SĐT
    email: { type: DataTypes.STRING }, 
    address: { type: DataTypes.STRING }, 
    landArea: { type: DataTypes.FLOAT, defaultValue: 0 }, 
    mainCrop: { type: DataTypes.STRING }, 
    capital: { type: DataTypes.BIGINT, defaultValue: 0 }, 
    joinDate: { type: DataTypes.DATEONLY }, 
    status: { 
        type: DataTypes.ENUM('Hoạt động', 'Tạm ngưng', 'Đã rời'),
        defaultValue: 'Hoạt động'
    },
    portraitUrl: { type: DataTypes.STRING }, // Đường dẫn ảnh chân dung
    debtMaterial: { type: DataTypes.BIGINT, defaultValue: 0 }, // VÍ 1: Nợ vật tư (Thành viên nợ HTX)
    debtPurchase: { type: DataTypes.BIGINT, defaultValue: 0 }, // VÍ 2: Nợ thu mua (HTX nợ Thành viên)
    advancePayment: { type: DataTypes.BIGINT, defaultValue: 0 } // VÍ 3: Tiền ứng trước (HTX ứng cho Thành viên)
});

module.exports = Member;