const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');

const ProductionLog = sequelize.define('ProductionLog', {
    seasonName: { type: DataTypes.ENUM('Xuân - Hè', 'Thu - Đông'), allowNull: false }, 
    cropType: { type: DataTypes.STRING }, 
    activityDate: { type: DataTypes.DATEONLY, allowNull: false },
    activityType: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    weather: { type: DataTypes.STRING },
    materialsUsed: { type: DataTypes.STRING }, // Tên vật tư hiển thị
    toolsUsed: { type: DataTypes.STRING }, 
    executor: { type: DataTypes.STRING, allowNull: false }, 
    creatorPhone: { type: DataTypes.STRING }, 
    status: { 
        type: DataTypes.ENUM('Lên kế hoạch', 'Đang thực hiện', 'Đã hoàn thành', 'Sự cố/Dịch bệnh'),
        defaultValue: 'Đã hoàn thành'
    },

    // --- BỔ SUNG V3.2: LIÊN KẾT KHO & CÔNG NỢ ---
    inventoryId: { type: DataTypes.INTEGER, allowNull: true }, // ID của vật tư trong kho
    materialQuantity: { type: DataTypes.FLOAT, defaultValue: 0 }, // Số lượng xuất dùng
    materialCost: { type: DataTypes.BIGINT, defaultValue: 0 }, // Thành tiền (Số lượng * Đơn giá)
    isDebt: { type: DataTypes.BOOLEAN, defaultValue: false } // Có cộng vào ví nợ của Xã viên không?
});

module.exports = ProductionLog;