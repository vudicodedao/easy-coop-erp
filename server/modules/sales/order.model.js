const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');
const { Inventory } = require('../inventory/inventory.model');

const Order = sequelize.define('Order', {
    orderCode: { type: DataTypes.STRING, unique: true }, // Mã đơn hàng (VD: DH-171092)
    
    // --- THÊM MỚI (V3.1): Phân loại đơn và thông tin thu mua ---
    orderType: { type: DataTypes.ENUM('Bán hàng', 'Thu mua'), defaultValue: 'Bán hàng' },
    memberPhone: { type: DataTypes.STRING }, // Lưu SĐT nếu là xã viên
    advancePayment: { type: DataTypes.BIGINT, defaultValue: 0 }, // Tiền tạm ứng (đưa tiền mặt ngay lúc cân)
    
    customerName: { type: DataTypes.STRING, allowNull: false }, // Tên khách hàng / Thương lái / Xã viên
    phone: { type: DataTypes.STRING },
    deliveryAddress: { type: DataTypes.STRING },
    orderDate: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW },
    totalAmount: { type: DataTypes.BIGINT, defaultValue: 0 },
    status: { 
        type: DataTypes.ENUM('Chờ xử lý', 'Đang giao', 'Đã giao', 'Đã hủy'), 
        defaultValue: 'Đã giao' 
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
    // --- THÊM MỚI (V3.1): Phân loại chất lượng ---
    quality: { type: DataTypes.STRING } // Loại 1, Loại 2, Hàng dạt...
});

// Thiết lập mối quan hệ
Order.hasMany(OrderDetail, { onDelete: 'CASCADE' }); // Xóa đơn hàng sẽ xóa luôn chi tiết
OrderDetail.belongsTo(Order);
OrderDetail.belongsTo(Inventory); // Nối với bảng Kho để biết bán/mua món gì

module.exports = { Order, OrderDetail };