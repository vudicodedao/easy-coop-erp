const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');

const User = sequelize.define('User', {
    phone: { type: DataTypes.STRING, unique: true, allowNull: false }, 
    password: { type: DataTypes.STRING, allowNull: false },
    fullName: { type: DataTypes.STRING, allowNull: false },
    role: { 
        type: DataTypes.ENUM('Giám đốc', 'Kế toán', 'Thủ kho', 'Xã viên'), 
        defaultValue: 'Xã viên' 
    }
}, {
    hooks: {
        // [BẢO MẬT ERP] - Trigger đồng bộ tự động từ User sang Member
        afterUpdate: async (user, options) => {
            // Chỉ chạy đồng bộ nếu thực sự có sự thay đổi ở Quyền, Tên hoặc SĐT
            if (user.changed('role') || user.changed('fullName') || user.changed('phone')) {
                
                // Require Member bên trong hook để tránh lỗi vòng lặp (Circular Dependency)
                const Member = require('../members/member.model');
                
                await Member.update({
                    role: user.role,
                    name: user.fullName,
                    phone: user.phone
                }, {
                    // Tìm đúng hồ sơ dựa trên số điện thoại cũ (phòng trường hợp đổi SĐT)
                    where: { phone: user.previous('phone') || user.phone },
                    transaction: options.transaction
                });
            }
        }
    }
});

module.exports = User;