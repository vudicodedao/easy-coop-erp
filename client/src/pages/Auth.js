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
        <div className="auth-wrapper">
            <style>{`
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
                
                .auth-wrapper {
                    display: flex;
                    min-height: 100vh;
                    background-color: #f0f2f5;
                }

                /* NỬA TRÁI: KHU VỰC HÌNH ẢNH VÀ SLOGAN */
                .auth-left {
                    flex: 1;
                    background: linear-gradient(rgba(44, 62, 80, 0.7), rgba(39, 174, 96, 0.8)), url('${process.env.PUBLIC_URL}/login-bg.jpg') center / cover no-repeat;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    padding: 60px;
                    color: white;
                    box-shadow: inset -10px 0 20px rgba(0,0,0,0.1);
                }

                .brand-title {
                    font-size: 3.5rem;
                    font-weight: 800;
                    margin-bottom: 20px;
                    letter-spacing: 1px;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
                }

                .brand-slogan {
                    font-size: 1.5rem;
                    line-height: 1.6;
                    max-width: 80%;
                    text-shadow: 1px 1px 3px rgba(0,0,0,0.3);
                }

                /* NỬA PHẢI: KHU VỰC FORM ĐĂNG NHẬP */
                .auth-right {
                    flex: 1;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    background-color: #ffffff;
                    padding: 40px;
                }

                .auth-box {
                    width: 100%;
                    max-width: 450px;
                    padding: 40px;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.08);
                    border: 1px solid #eee;
                }

                .form-header {
                    text-align: center;
                    margin-bottom: 30px;
                }

                .form-header h3 {
                    color: #2c3e50;
                    font-size: 24px;
                    margin-bottom: 10px;
                }

                .form-header p {
                    color: #7f8c8d;
                    font-size: 15px;
                }

                .auth-form {
                    display: flex;
                    flex-direction: column;
                    gap: 18px;
                }

                .input-group {
                    position: relative;
                    display: flex;
                    align-items: center;
                }

                .auth-input {
                    width: 100%;
                    padding: 14px 16px;
                    border: 2px solid #e0e0e0;
                    border-radius: 8px;
                    outline: none;
                    font-size: 16px;
                    transition: border-color 0.3s;
                    background-color: #f9f9f9;
                }

                .auth-input:focus {
                    border-color: #3498db;
                    background-color: #fff;
                }

                .eye-icon {
                    position: absolute;
                    right: 15px;
                    cursor: pointer;
                    background: none;
                    border: none;
                    font-size: 20px;
                    color: #95a5a6;
                    outline: none;
                }

                .auth-btn {
                    padding: 15px;
                    background-color: #27ae60;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 18px;
                    font-weight: bold;
                    transition: 0.3s;
                    margin-top: 10px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }

                .auth-btn:hover {
                    background-color: #219a52;
                    box-shadow: 0 4px 12px rgba(39, 174, 96, 0.3);
                    transform: translateY(-1px);
                }

                .error-msg {
                    background-color: #fdeaea;
                    color: #e74c3c;
                    padding: 12px;
                    border-radius: 6px;
                    font-size: 14px;
                    margin-bottom: 20px;
                    border-left: 4px solid #e74c3c;
                }

                .auth-toggle {
                    margin-top: 25px;
                    text-align: center;
                    color: #7f8c8d;
                    font-size: 15px;
                    border-top: 1px solid #eee;
                    padding-top: 20px;
                }

                .auth-toggle span {
                    color: #3498db;
                    cursor: pointer;
                    font-weight: bold;
                    transition: 0.2s;
                }

                .auth-toggle span:hover {
                    color: #2980b9;
                    text-decoration: underline;
                }

                /* RESPONSIVE CHO ĐIỆN THOẠI (Dưới 900px) */
                @media (max-width: 900px) {
                    .auth-wrapper {
                        flex-direction: column;
                    }
                    .auth-left {
                        padding: 40px 20px;
                        text-align: center;
                        align-items: center;
                    }
                    .brand-title {
                        font-size: 2.5rem;
                    }
                    .brand-slogan {
                        font-size: 1.2rem;
                        max-width: 100%;
                    }
                    .auth-right {
                        padding: 20px;
                        align-items: flex-start;
                        padding-top: 40px;
                    }
                    .auth-box {
                        box-shadow: none;
                        border: none;
                        padding: 20px;
                    }
                }
            `}</style>

            <div className="auth-left">
                <h1 className="brand-title">🌱 EASY CO-OP</h1>
                <p className="brand-slogan">
                    Nền tảng số hóa toàn diện, đồng hành cùng sự phát triển bền vững của Hợp tác xã Nông nghiệp.
                </p>
            </div>

            <div className="auth-right">
                <div className="auth-box">
                    <div className="form-header">
                        <h3>{isLoginView ? 'Đăng Nhập Hệ Thống' : 'Đăng Ký Tài Khoản'}</h3>
                        <p>{isLoginView ? 'Nhập số điện thoại và mật khẩu để tiếp tục' : 'Điền thông tin để tham gia Hợp tác xã'}</p>
                    </div>
                    
                    {error && <div className="error-msg">⚠️ {error}</div>}

                    <form className="auth-form" onSubmit={handleSubmit}>
                        {!isLoginView && (
                            <input className="auth-input" name="fullName" placeholder="Họ và tên đầy đủ (*)" value={formData.fullName} onChange={handleChange} required />
                        )}

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
        </div>
    );
};

export default Auth;