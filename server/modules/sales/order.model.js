const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');
const { Inventory } = require('../inventory/inventory.model');

const Order = sequelize.define('Order', {
    orderCode: { type: DataTypes.STRING, unique: true }, // Mã đơn hàng
    
    orderType: { type: DataTypes.ENUM('Bán hàng', 'Thu mua'), defaultValue: 'Bán hàng' },
    memberPhone: { type: DataTypes.STRING }, 
    advancePayment: { type: DataTypes.BIGINT, defaultValue: 0 }, 
    
    customerName: { type: DataTypes.STRING, allowNull: false }, 
    phone: { type: DataTypes.STRING },
    deliveryAddress: { type: DataTypes.STRING },
    orderDate: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW },
    
    // --- THÊM MỚI (GĐ3): Kế toán VAT và Tỷ suất lợi nhuận ---
    subTotal: { type: DataTypes.BIGINT, defaultValue: 0 }, // Tổng tiền gốc (Chưa VAT/Lãi)
    marginRate: { type: DataTypes.FLOAT, defaultValue: 0 }, // % Lợi nhuận (Margin)
    vatRate: { type: DataTypes.FLOAT, defaultValue: 0 },    // % Thuế VAT
    totalAmount: { type: DataTypes.BIGINT, defaultValue: 0 }, // Tổng thanh toán cuối cùng
    
    // --- CẬP NHẬT: Thêm các trạng thái thực tế cho luồng Thu mua ---
    status: { 
        type: DataTypes.ENUM('Chờ xử lý', 'Đang giao', 'Đã giao', 'Chờ cân', 'Hoàn tất cân & Nhập kho', 'Đã hủy'), 
        defaultValue: 'Chờ xử lý' 
    },
    paymentStatus: { 
        type: DataTypes.ENUM('Chưa thanh toán', 'Đã thanh toán'), 
        defaultValue: 'Chưa thanh toán' 
    },
    note: { type: DataTypes.TEXT }
});

const OrderDetail = sequelize.define('OrderDetail', {
    quantity: { type: DataTypes.FLOAT, allowNull: false },
    unitPrice: { type: DataTypes.BIGINT, allowNull: false },
    unit: { type: DataTypes.STRING },
    quality: { type: DataTypes.STRING } 
});

Order.hasMany(OrderDetail, { onDelete: 'CASCADE' }); 
OrderDetail.belongsTo(Order);
OrderDetail.belongsTo(Inventory); 

module.exports = { Order, OrderDetail };