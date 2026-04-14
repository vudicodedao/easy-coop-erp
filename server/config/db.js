const { Sequelize } = require('sequelize');
require('dotenv').config(); // Để đọc file .env

// Thiết lập thông số kết nối
const sequelize = new Sequelize(
    process.env.DB_NAME, 
    process.env.DB_USER, 
    process.env.DB_PASSWORD, 
    {
        host: process.env.DB_HOST,
        dialect: 'mysql',
        logging: false, // Để terminal không hiện quá nhiều dòng lệnh SQL khó hiểu
    }
);

// Hàm kiểm tra kết nối
const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Chúc mừng! Node.js đã kết nối được với XAMPP MySQL.');
    } catch (error) {
        console.error('❌ Lỗi kết nối: Bạn đã bật XAMPP chưa?', error);
    }
};

module.exports = { sequelize, connectDB };