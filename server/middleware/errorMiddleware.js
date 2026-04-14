const errorHandler = (err, req, res, next) => {
    console.error("Lỗi hệ thống: ", err.stack); // In lỗi ra Terminal để DEV dễ sửa
    
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode).json({
        message: err.message || 'Đã xảy ra lỗi nghiêm trọng trên Server!',
        // Chỉ hiện chi tiết lỗi nếu đang ở chế độ phát triển (development)
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};

module.exports = errorHandler;