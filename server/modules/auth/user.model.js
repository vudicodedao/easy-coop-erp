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
});

module.exports = User;