const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');

const Member = sequelize.define('Member', {
    name: { type: DataTypes.STRING, allowNull: false },
    
    // ĐÃ FIX: Khai báo tên index cụ thể để Sequelize không đẻ thêm key rác
    cccd: { type: DataTypes.STRING, unique: 'idx_unique_cccd' }, 
    phone: { type: DataTypes.STRING, unique: 'idx_unique_phone', allowNull: false }, 
    
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
    
    role: { 
        type: DataTypes.STRING, 
        defaultValue: 'Xã viên' 
    },
    
    portraitUrl: { type: DataTypes.STRING }, 
    debtMaterial: { type: DataTypes.BIGINT, defaultValue: 0 }, 
    debtPurchase: { type: DataTypes.BIGINT, defaultValue: 0 },
    advancePayment: { type: DataTypes.BIGINT, defaultValue: 0 } 
});

module.exports = Member;