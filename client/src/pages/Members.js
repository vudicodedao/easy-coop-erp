import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom'; 
import { getAllMembers, createMember, deleteMember, updateMember } from '../api/memberApi';
import * as XLSX from 'xlsx';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';

const Members = () => {
    const [members, setMembers] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    
    const location = useLocation();
    const isProfileView = location.pathname === '/'; 

    const currentUser = JSON.parse(localStorage.getItem('user')) || {};
    const isAdmin = currentUser.role === 'Giám đốc';

    const [myProfileData, setMyProfileData] = useState({});

    const initialForm = {
        name: '', cccd: '', phone: '', email: '', address: '', 
        landArea: '', mainCrop: '', capital: '', joinDate: '', status: 'Hoạt động', role: 'Xã viên',
        portraitUrl: '', debtMaterial: 0, debtPurchase: 0, advancePayment: 0
    };
    const [formData, setFormData] = useState(initialForm);

    const fetchMembers = async () => {
        try {
            const res = await getAllMembers();
            setMembers(res.data);
            if (isProfileView) {
                const myProfile = res.data.find(m => m.phone === currentUser.phone);
                if (myProfile) setMyProfileData(myProfile);
            }
        } catch (error) { console.error("Lỗi lấy dữ liệu", error); }
    };
    
    useEffect(() => { fetchMembers(); // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isProfileView]);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleUpload = async (file) => {
        if (!file) return null;
        const data = new FormData();
        data.append('image', file);
        try {
            setIsUploading(true);
            const res = await axios.post('http://localhost:5000/api/upload', data);
            setIsUploading(false);
            return `http://localhost:5000${res.data.url}`;
        } catch (error) {
            setIsUploading(false);
            console.error("LỖI UPLOAD CHI TIẾT:", error);
            if (error.response) {
                alert(`❌ Lỗi từ Server: ${error.response.status} - ${error.response.data?.message || 'Không rõ nguyên nhân'}`);
            } else if (error.request) {
                alert("❌ Lỗi Mạng: Không thể kết nối đến Server (Server có đang chạy cổng 5000 không?)");
            } else {
                alert(`❌ Lỗi React: ${error.message}`);
            }
            return null;
        }
    };
    
    const validatePhone = (phone) => /^0\d{9}$/.test(phone);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name || !formData.phone) return alert("Vui lòng nhập Tên và Số điện thoại!");
        
        if (!validatePhone(formData.phone)) {
            return alert("❌ Số điện thoại không hợp lệ! Vui lòng nhập đúng 10 chữ số và bắt đầu bằng số 0.");
        }

        const dataToSave = { ...formData };
        Object.keys(dataToSave).forEach(key => { if (dataToSave[key] === '') dataToSave[key] = null; });
        
        try {
            if (editingId) {
                await updateMember(editingId, dataToSave);
                alert("Cập nhật thành công!");
            } else {
                await createMember(dataToSave);
                alert(`Tạo thành công! Mật khẩu đăng nhập mặc định của ${dataToSave.name} là: ${dataToSave.phone}`);
            }
            setFormData(initialForm); setEditingId(null); setIsModalOpen(false); fetchMembers(); 
        } catch (error) { 
            alert("⚠️ LỖI: " + (error.response?.data?.message || "Có thể SĐT hoặc CCCD bị trùng!")); 
        }
    };

    const handleEditClick = (member) => { setFormData({ ...initialForm, ...member }); setEditingId(member.id); setIsModalOpen(true); };
    
    const handleDelete = async (id) => { 
        if (window.confirm("CẢNH BÁO: Xóa thành viên này sẽ xóa luôn cả tài khoản đăng nhập của họ. Bạn có chắc chắn xóa?")) { 
            await deleteMember(id); 
            fetchMembers(); 
        } 
    };

    const handleExportExcel = () => { 
        const dataToExport = filteredMembers.map((m, index) => ({ 
            "STT": index + 1, "Họ tên": m.name, "Chức vụ": m.role || 'Xã viên', 
            "Số CCCD": m.cccd || '', "Số điện thoại": m.phone, "Email": m.email || '', 
            "Địa chỉ": m.address || '', "Cây trồng/Vật nuôi": m.mainCrop || '', 
            "Diện tích (ha)": m.landArea || 0, "Vốn góp (VNĐ)": m.capital || 0, 
            "Nợ Vật tư": m.debtMaterial || 0, "Nợ Thu mua": m.debtPurchase || 0, "Ứng trước": m.advancePayment || 0,
            "Ngày gia nhập": m.joinDate || '', "Trạng thái": m.status 
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport); const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "DanhSachThanhVien"); XLSX.writeFile(workbook, "Danh_Sach_Thanh_Vien.xlsx");
    };

    const filteredMembers = members.filter(member => 
        member.name.toLowerCase().includes(searchTerm.toLowerCase()) || (member.phone && member.phone.includes(searchTerm))
    );

    // ==========================================
    // GIAO DIỆN 1: HỒ SƠ CÁ NHÂN
    // ==========================================
    if (isProfileView) {
        const handleMyProfileChange = (e) => setMyProfileData({ ...myProfileData, [e.target.name]: e.target.value });
        const handleMyProfileSubmit = async (e) => {
            e.preventDefault();
            try {
                await updateMember(myProfileData.id, myProfileData);
                alert("Cập nhật thông tin cá nhân thành công!");
                
                const updatedUser = { ...currentUser, fullName: myProfileData.name, role: myProfileData.role || currentUser.role };
                localStorage.setItem('user', JSON.stringify(updatedUser));
                window.location.reload(); 
            } catch (err) { alert("Lỗi cập nhật!"); }
        };

        return (
            <div className="page-wrapper" style={{ padding: '20px', paddingBottom: '40px', maxWidth: '800px', margin: '0 auto', width: '100%', height: '100%', overflowY: 'auto' }}>
                <style>{`
                    .page-wrapper::-webkit-scrollbar { width: 8px; }
                    .page-wrapper::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 4px; }
                    .page-wrapper::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 4px; }
                    .profile-card { background: white; border-radius: 10px; padding: 30px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
                    
                    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; width: 100%; }
                    .form-group { display: flex; flex-direction: column; width: 100%; }
                    .form-label { font-weight: bold; color: #34495e; margin-bottom: 8px; font-size: 14px; }
                    .form-input { width: 100%; padding: 12px; border: 1px solid #dcdde1; border-radius: 6px; font-size: 15px; outline: none; transition: 0.3s; box-sizing: border-box; }
                    .form-input:disabled { background-color: #f1f2f6; color: #7f8c8d; cursor: not-allowed; border-color: #eee; }
                    .btn-save { background-color: #3498db; color: white; border: none; padding: 14px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 16px; margin-top: 15px; width: 100%; transition: 0.3s; text-transform: uppercase; box-sizing: border-box;}
                    .btn-save:hover { background-color: #2980b9; transform: translateY(-2px); box-shadow: 0 4px 10px rgba(41, 128, 185, 0.3); }
                    
                    .full-width { grid-column: span 2; width: 100%; }

                    @media (max-width: 768px) {
                        .page-wrapper { padding: 15px !important; }
                        .profile-card { padding: 15px !important; }
                        
                        .header-section { flex-direction: column; align-items: flex-start !important; gap: 15px; }
                        .header-section > div, .action-buttons { width: 100%; flex-direction: column; display: flex; gap: 10px; }
                        .header-section .btn { width: 100%; justify-content: center; margin: 0 !important; padding: 12px; }
                        
                        .toolbar { flex-direction: column; align-items: stretch !important; gap: 10px; padding: 15px 10px; }
                        .toolbar > * { width: 100% !important; margin: 0 !important; }
                        
                        .form-grid, .modal-body > div, .product-row { grid-template-columns: 1fr !important; gap: 15px; }
                        .full-width { grid-column: span 1 !important; }
                        
                        .form-group-modal { flex-direction: column; align-items: flex-start; }
                        .form-label-modal { width: 100%; margin-bottom: 5px; }
                        
                        .dashboard-cards, .kpi-grid, .charts-wrapper { grid-template-columns: 1fr !important; }
                        
                        .tab-header { overflow-x: auto; white-space: nowrap; padding-bottom: 5px; width: 100%; }
                        .tab-btn { flex-shrink: 0; }
                    }
                `}</style>

                <h2 style={{ color: '#2c3e50', borderBottom: '2px solid #3498db', paddingBottom: '10px', marginBottom: '15px' }}>👤 Hồ Sơ Cá Nhân</h2>
                
                <h3 style={{ color: '#34495e', marginBottom: '10px', marginTop: '20px' }}>💳 Tình Trạng Công Nợ HTX</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '25px' }}>
                    <div style={{ background: 'linear-gradient(135deg, #e74c3c, #c0392b)', padding: '15px', borderRadius: '8px', color: 'white', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                        <div style={{ fontSize: '13px', textTransform: 'uppercase', opacity: 0.9 }}>Nợ Vật Tư (Bạn nợ HTX)</div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '5px' }}>{new Intl.NumberFormat('vi-VN').format(myProfileData.debtMaterial || 0)} đ</div>
                    </div>
                    <div style={{ background: 'linear-gradient(135deg, #2ecc71, #27ae60)', padding: '15px', borderRadius: '8px', color: 'white', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                        <div style={{ fontSize: '13px', textTransform: 'uppercase', opacity: 0.9 }}>Nợ Thu Mua (HTX nợ bạn)</div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '5px' }}>{new Intl.NumberFormat('vi-VN').format(myProfileData.debtPurchase || 0)} đ</div>
                    </div>
                    <div style={{ background: 'linear-gradient(135deg, #f39c12, #e67e22)', padding: '15px', borderRadius: '8px', color: 'white', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                        <div style={{ fontSize: '13px', textTransform: 'uppercase', opacity: 0.9 }}>Tiền Ứng Trước (Đã ứng)</div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '5px' }}>{new Intl.NumberFormat('vi-VN').format(myProfileData.advancePayment || 0)} đ</div>
                    </div>
                </div>

                <div className="profile-card">
                    <form onSubmit={handleMyProfileSubmit}>
                        
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', marginBottom: '30px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ width: '130px', height: '130px', borderRadius: '50%', border: '4px solid #ecf0f1', overflow: 'hidden', backgroundColor: '#f9f9f9', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                                    {myProfileData.portraitUrl ? (
                                        <img src={myProfileData.portraitUrl} alt="Portrait" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <span style={{ color: '#95a5a6', fontSize: '14px' }}>Chưa có ảnh</span>
                                    )}
                                </div>
                                <label style={{ marginTop: '15px', cursor: 'pointer', color: '#3498db', fontWeight: 'bold', textDecoration: 'underline' }}>
                                    {isUploading ? 'Đang tải ảnh...' : '📷 Thay đổi ảnh'}
                                    <input type="file" accept="image/*" onChange={async (e) => {
                                       const file = e.target.files[0];
                                        if (!file) return;

                                        const localUrl = URL.createObjectURL(file);
                                        setMyProfileData({ ...myProfileData, portraitUrl: localUrl });

                                        const url = await handleUpload(file);
                                        if (url) {
                                            setMyProfileData(prev => ({ ...prev, portraitUrl: url }));
                                        } else {
                                            setMyProfileData(prev => ({ ...prev, portraitUrl: '' })); 
                                        }
                                    }} style={{ display: 'none' }} disabled={isUploading} />
                                </label>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ padding: '10px', background: 'white', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', border: '2px dashed #3498db' }}>
                                    {myProfileData.phone ? (
                                        <QRCodeSVG value={myProfileData.phone} size={110} level={"H"} includeMargin={false} />
                                    ) : (
                                        <span style={{ color: '#95a5a6', fontSize: '14px', width: '110px', height: '110px', display: 'flex', alignItems: 'center', textAlign: 'center' }}>Chưa có SĐT</span>
                                    )}
                                </div>
                                <span style={{ marginTop: '10px', fontWeight: 'bold', color: '#2c3e50', textTransform: 'uppercase' }}>Mã Thẻ QR</span>
                            </div>
                        </div>

                        <div className="form-grid">
                            <div className="form-group"><label className="form-label">Họ và tên:</label>
                                <input className="form-input" name="name" value={myProfileData.name || ''} onChange={handleMyProfileChange} required /></div>
                            <div className="form-group"><label className="form-label">Số điện thoại (Tài khoản):</label>
                                <input className="form-input" value={myProfileData.phone || ''} disabled /></div>
                            <div className="form-group"><label className="form-label">Số CCCD:</label>
                                <input className="form-input" name="cccd" value={myProfileData.cccd || ''} onChange={handleMyProfileChange} /></div>
                            <div className="form-group"><label className="form-label">Email:</label>
                                <input className="form-input" name="email" value={myProfileData.email || ''} onChange={handleMyProfileChange} /></div>
                            
                            <div className="form-group full-width"><label className="form-label">Địa chỉ cư trú / canh tác:</label>
                                <input className="form-input" name="address" value={myProfileData.address || ''} onChange={handleMyProfileChange} /></div>
                            
                            <div className="form-group"><label className="form-label">Diện tích canh tác (ha):</label>
                                <input className="form-input" type="number" step="0.1" name="landArea" value={myProfileData.landArea || ''} onChange={handleMyProfileChange} /></div>
                            <div className="form-group"><label className="form-label">Cây trồng / Vật nuôi chính:</label>
                                <input className="form-input" name="mainCrop" value={myProfileData.mainCrop || ''} onChange={handleMyProfileChange} /></div>

                            <div className="form-group"><label className="form-label">Vai trò hệ thống:</label>
                                <select className="form-input" name="role" value={myProfileData.role || 'Xã viên'} onChange={handleMyProfileChange} disabled={!isAdmin}>
                                    <option value="Xã viên">Xã viên</option><option value="Thủ kho">Thủ kho</option><option value="Kế toán">Kế toán</option><option value="Giám đốc">Giám đốc</option>
                                </select>
                            </div>
                            <div className="form-group"><label className="form-label">Vốn góp (VNĐ):</label>
                                <input className="form-input" type="number" name="capital" value={myProfileData.capital || 0} onChange={handleMyProfileChange} disabled={!isAdmin} /></div>
                            <div className="form-group"><label className="form-label">Ngày tham gia:</label>
                                <input className="form-input" type="date" name="joinDate" value={myProfileData.joinDate || ''} onChange={handleMyProfileChange} disabled={!isAdmin} /></div>
                            <div className="form-group"><label className="form-label">Trạng thái:</label>
                                <select className="form-input" name="status" value={myProfileData.status || ''} onChange={handleMyProfileChange} disabled={!isAdmin}>
                                    <option value="Hoạt động">Hoạt động</option><option value="Tạm ngưng">Tạm ngưng</option><option value="Đã rời">Đã rời</option>
                                </select>
                            </div>
                            
                            <div className="full-width"><button type="submit" className="btn-save">💾 Lưu Cập Nhật Hồ Sơ</button></div>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    // ==========================================
    // GIAO DIỆN 2: BẢNG QUẢN LÝ (Cho Giám đốc)
    // ==========================================
    return (
        <div className="page-wrapper">
            <style>{`
                /* BAO TRÙM NGOÀI CÙNG LÀ CUỘN DỌC */
                .page-wrapper { display: flex; flex-direction: column; height: 100%; padding: 20px; overflow-y: auto; }
                .header-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-shrink: 0; }
                .action-buttons { display: flex; gap: 10px; }
                .btn { padding: 10px 16px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
                .btn-primary { background-color: #00a8ff; color: white; }
                .btn-outline { background-color: white; color: #333; border: 1px solid #ccc; }
                
                .card-container { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; flex-direction: column; margin-bottom: 20px; }
                .toolbar { padding: 15px; border-bottom: 1px solid #eee; flex-shrink: 0; }
                .search-input { padding: 10px; border-radius: 4px; border: 1px solid #ccc; outline: none; width: 300px; }
                
                /* ĐÂY LÀ CHÌA KHÓA: CUỘN KÉP CHO BẢNG */
                .table-scroll { 
                    width: 100%; 
                    overflow: auto; /* Tự động hiện thanh cuộn cả ngang lẫn dọc */
                    max-height: 60vh; /* Giới hạn chiều cao để sinh ra thanh cuộn dọc cục bộ */
                }
                
                table { width: 100%; border-collapse: collapse; table-layout: fixed; min-width: 1050px; }
                th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #eee; word-wrap: break-word; }
                th { background-color: #f8f9fa; color: #333; position: sticky; top: 0; z-index: 10; box-shadow: 0 2px 2px -1px rgba(0,0,0,0.1); }
                tbody tr:nth-child(even) { background-color: #fafafa; }
                .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
                .icon-btn { background: none; border: none; cursor: pointer; font-size: 16px; margin-right: 10px; }
                
                .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; padding: 10px; }
                .modal-content { background: white; width: 100%; max-width: 600px; max-height: 95vh; border-radius: 8px; display: flex; flex-direction: column; }
                .modal-header { padding: 15px 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
                .modal-body { padding: 20px; overflow-y: auto; }
                .form-group-modal { display: flex; align-items: center; margin-bottom: 15px; }
                .form-label-modal { width: 140px; font-weight: bold; color: #555; font-size: 14px; flex-shrink: 0; }
                
                .form-input-modal { flex: 1; padding: 10px; border-radius: 4px; border: 1px solid #ccc; outline: none; width: 100%; box-sizing: border-box; }
                .modal-footer { padding: 15px 20px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 10px; }
                .avatar-thumbnail { width: 35px; height: 35px; border-radius: 50%; object-fit: cover; border: 1px solid #ccc; margin-right: 10px; flex-shrink: 0;}
                
                @media (max-width: 768px) {
                    .page-wrapper { padding: 15px !important; }
                    .header-section { flex-direction: column; align-items: flex-start !important; gap: 15px; }
                    .header-section > div, .action-buttons { width: 100%; flex-direction: column; display: flex; gap: 10px; }
                    .header-section .btn { width: 100%; justify-content: center; margin: 0 !important; padding: 12px; }
                    .toolbar { flex-direction: column; align-items: stretch !important; gap: 10px; padding: 15px 10px; }
                    .toolbar > * { width: 100% !important; margin: 0 !important; }
                    .form-grid, .modal-body > div, .product-row { grid-template-columns: 1fr !important; gap: 15px; }
                    .form-group-modal { flex-direction: column; align-items: flex-start; }
                    .form-label-modal { width: 100%; margin-bottom: 5px; }
                    .dashboard-cards, .kpi-grid, .charts-wrapper { grid-template-columns: 1fr !important; }
                    .tab-header { overflow-x: auto; white-space: nowrap; padding-bottom: 5px; width: 100%; }
                    .tab-btn { flex-shrink: 0; }
                }
            `}</style>

            <div className="header-section">
                <h2 style={{ margin: 0, color: '#333' }}>Quản lý Thành viên</h2>
                <div className="action-buttons">
                    <button className="btn btn-outline" onClick={handleExportExcel}>📥 Xuất Excel</button>
                    <button className="btn btn-primary" onClick={() => { setEditingId(null); setFormData(initialForm); setIsModalOpen(true); }}>+ Thêm thành viên</button>
                </div>
            </div>

            <div className="card-container">
                <div className="toolbar">
                    <input className="search-input" placeholder="🔍 Tìm kiếm theo tên, SĐT..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <div className="table-scroll">
                    <table>
                        <colgroup>
                            <col style={{ width: '18%' }} /><col style={{ width: '12%' }} /><col style={{ width: '13%' }} /><col style={{ width: '10%' }} /><col style={{ width: '12%' }} /><col style={{ width: '16%' }} /><col style={{ width: '10%' }} /><col style={{ width: '9%' }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th>Họ tên</th>
                                <th>Điện thoại</th>
                                <th>Cây trồng/Vật nuôi</th>
                                <th>Diện tích (ha)</th>
                                <th>Vốn góp (VNĐ)</th>
                                <th>Chi tiết Công nợ (VNĐ)</th>
                                <th>Trạng thái</th>
                                <th>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredMembers.map((m) => (
                                <tr key={m.id}>
                                    <td style={{ display: 'flex', alignItems: 'center' }}>
                                        {m.portraitUrl ? <img src={m.portraitUrl} alt="avatar" className="avatar-thumbnail" /> : <div className="avatar-thumbnail" style={{background:'#eee', display:'flex', justifyContent:'center', alignItems:'center', fontSize:'10px'}}>Trống</div>}
                                        <div>
                                            <b>{m.name}</b><br/><small style={{color: '#e67e22', fontWeight: 'bold'}}>{m.role || 'Xã viên'}</small>
                                        </div>
                                    </td>
                                    <td>{m.phone}</td>
                                    <td>{m.mainCrop}</td>
                                    <td>{m.landArea}</td>
                                    <td>{new Intl.NumberFormat('vi-VN').format(m.capital || 0)}</td>
                                    <td>
                                        <div style={{fontSize: '12px', lineHeight: '1.4'}}>
                                            <span style={{color: '#e74c3c'}}>Nợ VT: {new Intl.NumberFormat('vi-VN').format(m.debtMaterial || 0)}</span><br/>
                                            <span style={{color: '#27ae60'}}>HTX Nợ: {new Intl.NumberFormat('vi-VN').format(m.debtPurchase || 0)}</span><br/>
                                            <span style={{color: '#f39c12'}}>Ứng: {new Intl.NumberFormat('vi-VN').format(m.advancePayment || 0)}</span>
                                        </div>
                                    </td>
                                    <td><span className="badge" style={{backgroundColor: m.status === 'Hoạt động' ? '#e6f4ea' : '#fce8e6', color: m.status === 'Hoạt động' ? '#1e8e3e' : '#d93025'}}>{m.status}</span></td>
                                    <td>
                                        <button className="icon-btn" onClick={() => handleEditClick(m)}>✏️</button>
                                        <button className="icon-btn" onClick={() => handleDelete(m.id)}>🗑️</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3 style={{ margin: 0 }}>{editingId ? "Cập nhật thành viên" : "Tạo thành viên"}</h3>
                            <button style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#999' }} onClick={() => setIsModalOpen(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <form id="memberForm" onSubmit={handleSubmit}>
                                
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', marginBottom: '20px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <div style={{ width: '100px', height: '100px', borderRadius: '50%', border: '2px dashed #ccc', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9f9f9', marginBottom: '10px' }}>
                                            {formData.portraitUrl ? <img src={formData.portraitUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '12px', color: '#999' }}>Chưa có ảnh</span>}
                                        </div>
                                        <input type="file" accept="image/*" onChange={async (e) => {
                                            const file = e.target.files[0];
                                            if (!file) return;

                                            const localUrl = URL.createObjectURL(file);
                                            setFormData({ ...formData, portraitUrl: localUrl });

                                            const url = await handleUpload(file);
                                            if (url) {
                                                setFormData(prev => ({ ...prev, portraitUrl: url }));
                                            } else {
                                                setFormData(prev => ({ ...prev, portraitUrl: '' }));
                                            }
                                        }} style={{ fontSize: '12px' }} disabled={isUploading} />
                                        {isUploading && <span style={{fontSize: '12px', color: 'blue'}}>Đang tải...</span>}
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <div style={{ width: '100px', height: '100px', padding: '5px', background: 'white', borderRadius: '8px', border: '2px solid #ecf0f1', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                            {formData.phone ? (
                                                <QRCodeSVG value={formData.phone} size={90} level={"H"} />
                                            ) : (
                                                <span style={{ fontSize: '12px', color: '#999', textAlign: 'center' }}>Nhập SĐT để tạo mã</span>
                                            )}
                                        </div>
                                        <span style={{ fontSize: '12px', color: '#555', marginTop: '5px', fontWeight: 'bold' }}>Mã QR Quét</span>
                                    </div>
                                </div>

                                <div className="form-group-modal"><label className="form-label-modal"><span style={{color: 'red'}}>*</span> Họ tên:</label><input className="form-input-modal" name="name" value={formData.name} onChange={handleChange} required /></div>
                                <div className="form-group-modal"><label className="form-label-modal"><span style={{color: 'red'}}>*</span> Điện thoại:</label><input className="form-input-modal" name="phone" value={formData.phone} onChange={handleChange} required disabled={!!editingId} /></div>
                                <div className="form-group-modal"><label className="form-label-modal">Vai trò:</label>
                                    <select className="form-input-modal" name="role" value={formData.role || 'Xã viên'} onChange={handleChange}>
                                        <option value="Xã viên">Xã viên</option><option value="Thủ kho">Thủ kho</option><option value="Kế toán">Kế toán</option><option value="Giám đốc">Giám đốc</option>
                                    </select>
                                </div>
                                <div className="form-group-modal"><label className="form-label-modal">Số CCCD:</label><input className="form-input-modal" name="cccd" value={formData.cccd} onChange={handleChange} /></div>
                                <div className="form-group-modal"><label className="form-label-modal">Email:</label><input className="form-input-modal" name="email" value={formData.email} onChange={handleChange} /></div>
                                <div className="form-group-modal"><label className="form-label-modal">Địa chỉ:</label><input className="form-input-modal" name="address" value={formData.address} onChange={handleChange} /></div>
                                <div className="form-group-modal"><label className="form-label-modal">Diện tích (ha):</label><input className="form-input-modal" type="number" step="10" min="0" name="landArea" value={formData.landArea} onChange={handleChange} /></div>
                                <div className="form-group-modal"><label className="form-label-modal">Cây trồng, vật nuôi chính:</label><input className="form-input-modal" name="mainCrop" value={formData.mainCrop} onChange={handleChange} /></div>
                                <div className="form-group-modal"><label className="form-label-modal">Vốn góp (VNĐ):</label><input className="form-input-modal" type="number" step="100000" min="0" name="capital" value={formData.capital} onChange={handleChange} /></div>
                                <div className="form-group-modal"><label className="form-label-modal">Ngày tham gia:</label><input className="form-input-modal" type="date" name="joinDate" value={formData.joinDate} onChange={handleChange} /></div>
                                <div className="form-group-modal"><label className="form-label-modal">Trạng thái:</label>
                                    <select className="form-input-modal" name="status" value={formData.status} onChange={handleChange}>
                                        <option value="Hoạt động">Hoạt động</option><option value="Tạm ngưng">Tạm ngưng</option><option value="Đã rời">Đã rời</option>
                                    </select>
                                </div>

                                <h4 style={{ borderBottom: '1px solid #ccc', paddingBottom: '5px', marginTop: '20px', color: '#2980b9' }}>💰 Khởi tạo Số dư Công nợ ban đầu</h4>
                                <div className="form-group-modal"><label className="form-label-modal">Nợ Vật tư (VNĐ):</label><input className="form-input-modal" type="number" name="debtMaterial" value={formData.debtMaterial} onChange={handleChange} /></div>
                                <div className="form-group-modal"><label className="form-label-modal">Nợ Thu mua (VNĐ):</label><input className="form-input-modal" type="number" name="debtPurchase" value={formData.debtPurchase} onChange={handleChange} /></div>
                                <div className="form-group-modal"><label className="form-label-modal">Tiền Ứng (VNĐ):</label><input className="form-input-modal" type="number" name="advancePayment" value={formData.advancePayment} onChange={handleChange} /></div>

                            </form>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Hủy bỏ</button>
                            <button form="memberForm" type="submit" className="btn btn-primary" disabled={isUploading}>Lưu thông tin</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Members;