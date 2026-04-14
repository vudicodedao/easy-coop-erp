const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');

// BẢNG 1: DANH MỤC VÀ TỒN KHO GỐC
const Inventory = sequelize.define('Inventory', {
    itemName: { type: DataTypes.STRING, allowNull: false }, 
    category: { 
        type: DataTypes.ENUM('Vật tư đầu vào', 'Nông sản đầu ra', 'Công cụ dụng cụ'),
        allowNull: false 
    },
    quantity: { type: DataTypes.FLOAT, defaultValue: 0 }, 
    unit: { type: DataTypes.STRING }, 
    unitPrice: { type: DataTypes.BIGINT, defaultValue: 0 }, 
    supplier: { type: DataTypes.STRING }, 
    lastUpdated: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    
    // --- PHẦN THÊM MỚI (V3.1) ---
    batchNumber: { type: DataTypes.STRING }, // Số lô hàng
    expiryDate: { type: DataTypes.DATEONLY } // Hạn sử dụng
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
    
    // --- PHẦN THÊM MỚI (V3.1) ---
    memberPhone: { type: DataTypes.STRING }, // Lưu số điện thoại nếu xuất bán cho thành viên
    isCredit: { type: DataTypes.BOOLEAN, defaultValue: false } // Cờ đánh dấu Mua chịu (Nợ)
});

// THIẾT LẬP MỐI QUAN HỆ
Inventory.hasMany(InventoryTransaction, { onDelete: 'CASCADE' });
InventoryTransaction.belongsTo(Inventory);

module.exports = { Inventory, InventoryTransaction };