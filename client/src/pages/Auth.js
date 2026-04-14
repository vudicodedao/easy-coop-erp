import React, { useState } from 'react';
import { login, register } from '../api/authApi';

const Auth = ({ onLoginSuccess }) => {
    const [isLoginView, setIsLoginView] = useState(true);
    const [formData, setFormData] = useState({ phone: '', password: '', confirmPassword: '', fullName: '' });
    const [error, setError] = useState('');
    
    // Tách riêng 2 state để ẩn/hiện mật khẩu độc lập
    const [showPassword, setShowPassword] = useState(false); 
    const [showConfirmPassword, setShowConfirmPassword] = useState(false); 

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    // Hàm kiểm tra định dạng số điện thoại (Bắt đầu bằng 0, theo sau là 9 chữ số)
    const validatePhone = (phone) => {
        const phoneRegex = /^0\d{9}$/;
        return phoneRegex.test(phone);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Kiểm tra số điện thoại hợp lệ trước khi gửi API (Cho cả Đăng nhập & Đăng ký)
        if (!validatePhone(formData.phone)) {
            return setError("Số điện thoại không hợp lệ! Vui lòng nhập đúng 10 chữ số và bắt đầu bằng số 0.");
        }

        try {
            if (isLoginView) {
                // XỬ LÝ ĐĂNG NHẬP
                const res = await login({ phone: formData.phone, password: formData.password });
                localStorage.setItem('token', res.data.token);
                localStorage.setItem('user', JSON.stringify(res.data.user));
                onLoginSuccess(res.data.user);
            } else {
                // XỬ LÝ ĐĂNG KÝ
                if (formData.password !== formData.confirmPassword) {
                    return setError("Mật khẩu nhập lại không khớp!");
                }

                await register({
                    phone: formData.phone,
                    password: formData.password,
                    fullName: formData.fullName
                });
                
                alert("Đăng ký thành công! Bạn đã tự động trở thành Xã viên. Vui lòng đăng nhập.");
                setIsLoginView(true);
                setFormData({ phone: '', password: '', confirmPassword: '', fullName: '' });
                setShowPassword(false);
                setShowConfirmPassword(false);
            }
        } catch (err) {
            setError(err.response?.data?.message || "Đã xảy ra lỗi, vui lòng thử lại!");
        }
    };

    return (
        <div className="auth-container">
            <style>{`
                .auth-container { display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f0f2f5; font-family: Arial, sans-serif; }
                .auth-box { background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: 100%; max-width: 400px; text-align: center; }
                .auth-title { margin-bottom: 20px; color: #2c3e50; font-size: 24px; }
                .auth-form { display: flex; flex-direction: column; gap: 15px; }
                
                .input-group { position: relative; display: flex; align-items: center; }
                .auth-input { width: 100%; padding: 12px; border: 1px solid #ccc; border-radius: 4px; outline: none; font-size: 16px; box-sizing: border-box; }
                .eye-icon { position: absolute; right: 10px; cursor: pointer; background: none; border: none; font-size: 20px; user-select: none; }
                
                .auth-btn { padding: 12px; background-color: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: bold; transition: 0.3s; margin-top: 10px; }
                .auth-btn:hover { background-color: #2ecc71; }
                .auth-toggle { margin-top: 20px; color: #7f8c8d; font-size: 14px; }
                .auth-toggle span { color: #27ae60; cursor: pointer; font-weight: bold; }
                .error-msg { color: #e74c3c; font-size: 14px; margin-bottom: 10px; text-align: left; line-height: 1.4; }
            `}</style>

            <div className="auth-box">
                <h2 className="auth-title">🌱 EASY CO-OP</h2>
                <h3 style={{marginTop: 0, color: '#7f8c8d', fontSize: '16px'}}>
                    {isLoginView ? 'Đăng Nhập Hệ Thống' : 'Đăng Ký Tài Khoản'}
                </h3>
                
                {error && <div className="error-msg">⚠️ {error}</div>}

                <form className="auth-form" onSubmit={handleSubmit}>
                    {!isLoginView && (
                        <input className="auth-input" name="fullName" placeholder="Họ và tên đầy đủ (*)" value={formData.fullName} onChange={handleChange} required />
                    )}

                    {/* Thêm maxLength để giới hạn chỉ được gõ 10 ký tự */}
                    <input className="auth-input" type="tel" name="phone" placeholder="Số điện thoại (*)" maxLength="10" value={formData.phone} onChange={handleChange} required />
                    
                    <div className="input-group">
                        <input className="auth-input" type={showPassword ? "text" : "password"} name="password" placeholder="Mật khẩu (*)" value={formData.password} onChange={handleChange} required />
                        <button type="button" className="eye-icon" onClick={() => setShowPassword(!showPassword)}>
                            {showPassword ? "🙉" : "🙈"} 
                        </button>
                    </div>

                    {!isLoginView && (
                        <div className="input-group">
                            <input className="auth-input" type={showConfirmPassword ? "text" : "password"} name="confirmPassword" placeholder="Nhập lại mật khẩu (*)" value={formData.confirmPassword} onChange={handleChange} required />
                            <button type="button" className="eye-icon" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                                {showConfirmPassword ? "🙉" : "🙈"}
                            </button>
                        </div>
                    )}
                    
                    <button type="submit" className="auth-btn">
                        {isLoginView ? 'Đăng Nhập' : 'Tạo Tài Khoản'}
                    </button>
                </form>

                <div className="auth-toggle">
                    {isLoginView ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
                    <span onClick={() => { 
                        setIsLoginView(!isLoginView); 
                        setError(''); 
                        setFormData({ phone: '', password: '', confirmPassword: '', fullName: '' }); 
                        setShowPassword(false);
                        setShowConfirmPassword(false);
                    }}>
                        {isLoginView ? "Đăng ký ngay" : "Đăng nhập"}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default Auth;