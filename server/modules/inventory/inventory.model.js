const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');

// BẢNG 1: DANH MỤC VÀ TỒN KHO GỐC
const Inventory = sequelize.define('Inventory', {
    itemName: { type: DataTypes.STRING, allowNull: false }, 
    category: { 
        type: DataTypes.ENUM('Vật tư đầu vào', 'Nông sản đầu ra', 'Công cụ dụng cụ'),
        allowNull: false 
    },
    quality: { type: DataTypes.STRING, defaultValue: 'Tiêu chuẩn' }, 
    quantity: { type: DataTypes.FLOAT, defaultValue: 0 }, 
    unit: { type: DataTypes.STRING }, 
    unitPrice: { type: DataTypes.BIGINT, defaultValue: 0 }, 
    supplier: { type: DataTypes.STRING }, 
    lastUpdated: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    batchNumber: { type: DataTypes.STRING }, 
    expiryDate: { type: DataTypes.DATEONLY } 
});

// BẢNG 2: LỊCH SỬ GIAO DỊCH (PHIẾU NHẬP / PHIẾU XUẤT)
const InventoryTransaction = sequelize.define('InventoryTransaction', {
    ticketCode: { type: DataTypes.STRING }, 
    type: { type: DataTypes.ENUM('Nhập', 'Xuất'), allowNull: false },
    creator: { type: DataTypes.STRING }, 
    date: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW },
    reason: { type: DataTypes.STRING }, 
    note: { type: DataTypes.TEXT }, 
    supplier: { type: DataTypes.STRING }, 
    quantity: { type: DataTypes.FLOAT, allowNull: false }, 
    unitPrice: { type: DataTypes.BIGINT, defaultValue: 0 },
    
    // --- THÊM MỚI CHO GIAI ĐOẠN 1: KẾ TOÁN VAT & CHI TIẾT ---
    vatRate: { type: DataTypes.FLOAT, defaultValue: 0 }, // % Thuế VAT
    totalAmount: { type: DataTypes.BIGINT, defaultValue: 0 }, // Thành tiền sau VAT
    paymentMethod: { type: DataTypes.STRING }, // Tiền mặt / Chuyển khoản
    paymentStatus: { type: DataTypes.STRING }, // Đã thanh toán / Ghi nợ
    
    memberPhone: { type: DataTypes.STRING }, 
    isCredit: { type: DataTypes.BOOLEAN, defaultValue: false } 
});

Inventory.hasMany(InventoryTransaction, { onDelete: 'CASCADE' });
InventoryTransaction.belongsTo(Inventory);

module.exports = { Inventory, InventoryTransaction };