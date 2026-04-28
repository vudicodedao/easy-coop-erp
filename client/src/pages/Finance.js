import React, { useEffect, useState } from 'react';
import { getAllRecords, createRecord, deleteRecord, updateRecord } from '../api/financeApi';
import { getAllMembers } from '../api/memberApi'; 
import * as XLSX from 'xlsx';

const Finance = () => {
    const currentUser = JSON.parse(localStorage.getItem('user')) || {};
    const role = currentUser.role;
    const isAdmin = role === 'Giám đốc';
    const canCreate = ['Giám đốc', 'Kế toán'].includes(role);

    const [records, setRecords] = useState([]);
    const [membersList, setMembersList] = useState([]); 
    
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [filterType, setFilterType] = useState('');
    const [sortDate, setSortDate] = useState('DESC');
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false); 
    const [selectedMember, setSelectedMember] = useState(null); 
    
    const [editingId, setEditingId] = useState(null);

    const initForm = {
        recordDate: new Date().toISOString().split('T')[0], 
        type: 'Thu', category: 'Bán nông sản', amount: '', paymentMethod: 'Tiền mặt',
        creator: currentUser.fullName, actor: '', description: '', referenceCode: '', status: 'Hoàn thành',
        memberPhone: '' 
    };
    const [formData, setFormData] = useState(initForm);

    const fetchRecords = async () => {
        try { 
            const [recordsRes, membersRes] = await Promise.all([getAllRecords(), getAllMembers()]);
            setRecords(recordsRes.data); 
            setMembersList(membersRes.data);
        } 
        catch (error) { console.error("Lỗi tải dữ liệu tài chính"); }
    };
    useEffect(() => { fetchRecords(); }, []);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleMemberSelect = (e) => {
        const phone = e.target.value;
        const member = membersList.find(m => m.phone === phone);
        if (member) setFormData({ ...formData, memberPhone: phone, actor: member.name });
        else setFormData({ ...formData, memberPhone: '', actor: '' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.amount || !formData.category) return alert("Vui lòng nhập Danh mục và Số tiền!");
        
        // [THÊM MỚI]: BỘ LỌC AN TOÀN CHẶN LỖI LẬP PHIẾU LỐ TIỀN
        if (formData.memberPhone && ['Thu nợ vật tư', 'Thu hồi tạm ứng', 'Chi trả nợ thu mua'].includes(formData.category)) {
            const member = membersList.find(m => m.phone === formData.memberPhone);
            if (member) {
                const amt = Number(formData.amount);
                if (formData.category === 'Thu nợ vật tư' && amt > Number(member.debtMaterial || 0)) {
                    return alert(`❌ LỖI: Xã viên này chỉ đang nợ vật tư ${new Intl.NumberFormat('vi-VN').format(member.debtMaterial || 0)}đ. Không thể thu lố!`);
                }
                if (formData.category === 'Thu hồi tạm ứng' && amt > Number(member.advancePayment || 0)) {
                    return alert(`❌ LỖI: Xã viên này chỉ đang nợ tạm ứng ${new Intl.NumberFormat('vi-VN').format(member.advancePayment || 0)}đ. Không thể thu lố!`);
                }
                if (formData.category === 'Chi trả nợ thu mua' && amt > Number(member.debtPurchase || 0)) {
                    return alert(`❌ LỖI: HTX chỉ nợ xã viên này ${new Intl.NumberFormat('vi-VN').format(member.debtPurchase || 0)}đ. Không thể chi lố!`);
                }
            }
        }

        const dataToSave = { ...formData };
        try {
            if (editingId) await updateRecord(editingId, dataToSave);
            else await createRecord(dataToSave);
            setIsModalOpen(false); fetchRecords();
        } catch (error) { alert("Lỗi khi lưu giao dịch! " + (error.response?.data?.message || "")); }
    };

    const handleSettlementSelect = (e) => {
        const member = membersList.find(m => m.phone === e.target.value);
        setSelectedMember(member || null);
    };

    const handleSettlementSubmit = async (e) => {
        e.preventDefault();
        if (!selectedMember) return alert("Vui lòng chọn Xã viên cần quyết toán!");
        
        const htxNo = Number(selectedMember.debtPurchase || 0); 
        const xvNo = Number(selectedMember.debtMaterial || 0);  
        const xvUng = Number(selectedMember.advancePayment || 0); 
        
        const finalAmount = htxNo - xvNo - xvUng;
        let transType = 'Thu'; let transAmount = 0;
        
        if (finalAmount > 0) { transType = 'Chi'; transAmount = finalAmount; } 
        else if (finalAmount < 0) { transType = 'Thu'; transAmount = Math.abs(finalAmount); }

        const dataToSave = {
            recordDate: new Date().toISOString().split('T')[0], type: transType,
            category: 'Quyết toán công nợ', amount: transAmount, paymentMethod: 'Tiền mặt', 
            creator: currentUser.fullName, actor: selectedMember.name, memberPhone: selectedMember.phone,
            description: `Quyết toán bù trừ cuối vụ cho ${selectedMember.name} (Nợ VT: ${xvNo}, Tạm ứng: ${xvUng}, HTX nợ: ${htxNo})`,
            status: 'Hoàn thành'
        };

        if (window.confirm(`Xác nhận quyết toán cho ${selectedMember.name}? Hành động này sẽ đưa 3 ví công nợ về 0 đ và tạo phiếu ${transType} trị giá ${new Intl.NumberFormat('vi-VN').format(transAmount)} đ.`)) {
            try {
                await createRecord(dataToSave);
                alert("✅ Quyết toán thành công! Sổ quỹ và Công nợ đã được cập nhật.");
                setIsSettlementModalOpen(false); setSelectedMember(null); fetchRecords();
            } catch (error) { alert("Lỗi khi quyết toán!"); }
        }
    };

    const handleEditClick = (record) => { setFormData({ ...initForm, ...record }); setEditingId(record.id); setIsModalOpen(true); };
    const handleDelete = async (id) => {
        if (window.confirm("CẢNH BÁO: Xóa giao dịch này sẽ làm thay đổi Tồn quỹ (và Công nợ nếu có). Chắc chắn xóa?")) {
            await deleteRecord(id); fetchRecords();
        }
    };

    const filteredRecords = records.filter(r => {
        const matchSearch = (r.category?.toLowerCase().includes(searchTerm.toLowerCase())) || (r.actor?.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchType = filterType === '' || r.type === filterType;
        const matchStart = startDate ? new Date(r.recordDate) >= new Date(startDate) : true;
        const matchEnd = endDate ? new Date(r.recordDate) <= new Date(endDate) : true;
        return matchSearch && matchType && matchStart && matchEnd;
    }).sort((a, b) => sortDate === 'DESC' ? new Date(b.recordDate) - new Date(a.recordDate) : new Date(a.recordDate) - new Date(b.recordDate));

    const completedRecords = records.filter(r => r.status === 'Hoàn thành'); 
    
    const cashIncome = completedRecords.filter(r => r.type === 'Thu' && r.paymentMethod === 'Tiền mặt').reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const cashExpense = completedRecords.filter(r => r.type === 'Chi' && r.paymentMethod === 'Tiền mặt').reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const cashBalance = cashIncome - cashExpense;

    const bankIncome = completedRecords.filter(r => r.type === 'Thu' && r.paymentMethod === 'Chuyển khoản').reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const bankExpense = completedRecords.filter(r => r.type === 'Chi' && r.paymentMethod === 'Chuyển khoản').reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const bankBalance = bankIncome - bankExpense;

    const totalIncome = cashIncome + bankIncome;
    const totalExpense = cashExpense + bankExpense;
    const totalBalance = cashBalance + bankBalance;

    const handleExportExcel = () => {
        const dataToExport = filteredRecords.map((r, index) => ({
            "STT": index + 1, "Ngày giao dịch": r.recordDate, "Mã tham chiếu": r.referenceCode || '',
            "Loại": r.type, "Hình thức": r.paymentMethod || 'Tiền mặt', "Danh mục": r.category,
            "Số tiền (VNĐ)": r.amount, "Người nộp/nhận": r.actor || '', "Diễn giải": r.description || '', "Trạng thái": r.status
        }));
        const ws = XLSX.utils.json_to_sheet(dataToExport); const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "SoQuy"); XLSX.writeFile(wb, "So_Quy_Thu_Chi.xlsx");
    };

    return (
        <div className="page-wrapper" style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <style>{`
                .header-section { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #bdc3c7; padding-bottom: 15px; margin-bottom: 20px; }
                .dashboard-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 20px; }
                .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
                .toolbar { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 15px; background: white; padding: 15px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); align-items: center; }
                .tool-input, .tool-select { padding: 8px 12px; border: 1px solid #dcdde1; border-radius: 4px; outline: none; }
                .btn { padding: 10px 16px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; color: white; display: flex; align-items: center; justify-content: center; text-align: center;}
                .btn-success { background: #27ae60; } .btn-danger { background: #e74c3c; } .btn-primary { background: #3498db; } .btn-warning { background: #f39c12; }
                .card-container { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; flex-direction: column; margin-bottom: 20px; }
                .table-scroll { width: 100%; overflow: auto; max-height: 80vh; }
                table { width: 100%; border-collapse: collapse; min-width: 900px; }
                th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #f1f2f6; }
                th { background: #f8f9fa; position: sticky; top: 0; z-index: 5; }
                .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; padding: 10px;}
                .modal-content { background: white; width: 100%; max-width: 600px; max-height: 90vh; border-radius: 8px; display: flex; flex-direction: column; }
                .modal-header { padding: 15px 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
                .modal-body { padding: 20px; overflow-y: auto; flex: 1; }
                .modal-footer { padding: 15px 20px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 10px; background: #f8f9fa; }
                .split-line { display: flex; justify-content: space-between; font-size: 13px; color: #555; margin-top: 8px; border-top: 1px dashed #eee; padding-top: 5px; }
                @media (max-width: 768px) {
                    .page-wrapper { padding: 15px !important; }
                    .header-section { flex-direction: column; align-items: flex-start !important; gap: 15px; }
                    .header-section > div, .action-buttons { width: 100%; flex-direction: column; display: flex; gap: 10px; }
                    .header-section .btn { width: 100%; justify-content: center; margin: 0 !important; padding: 12px; }
                    .toolbar { flex-direction: column; align-items: stretch !important; gap: 10px; padding: 15px 10px; }
                    .toolbar > * { width: 100% !important; margin: 0 !important; }
                    .dashboard-cards { grid-template-columns: 1fr !important; }
                }
            `}</style>

            <div className="header-section">
                <h2 style={{ margin: 0, color: '#2c3e50' }}>💰 Sổ Quỹ Thu Chi</h2>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {canCreate && (
                        <>
                            <button className="btn btn-success" onClick={() => { setFormData({...initForm, type: 'Thu'}); setEditingId(null); setIsModalOpen(true); }}>📥 Tạo Phiếu Thu</button>
                            <button className="btn btn-danger" onClick={() => { setFormData({...initForm, type: 'Chi'}); setEditingId(null); setIsModalOpen(true); }}>📤 Tạo Phiếu Chi</button>
                            <button className="btn btn-warning" onClick={() => { setSelectedMember(null); setIsSettlementModalOpen(true); }}>🤝 Quyết Toán Công Nợ</button>
                            <button className="btn" style={{background: 'white', color: '#333', border: '1px solid #ccc'}} onClick={handleExportExcel}>📥 Xuất Excel</button>
                        </>
                    )}
                </div>
            </div>

            <div className="dashboard-cards">
                <div className="stat-card">
                    <div style={{color:'#7f8c8d', fontWeight:'bold', marginBottom: '5px'}}>TỔNG TIỀN THU</div>
                    <div style={{fontSize:'24px', color:'#27ae60', fontWeight:'bold'}}>+{new Intl.NumberFormat('vi-VN').format(totalIncome)} đ</div>
                    <div className="split-line"><span>Tiền mặt:</span> <b>{new Intl.NumberFormat('vi-VN').format(cashIncome)} đ</b></div>
                    <div className="split-line" style={{border: 'none', paddingTop: 0}}><span>Ngân hàng:</span> <b>{new Intl.NumberFormat('vi-VN').format(bankIncome)} đ</b></div>
                </div>
                
                <div className="stat-card">
                    <div style={{color:'#7f8c8d', fontWeight:'bold', marginBottom: '5px'}}>TỔNG TIỀN CHI</div>
                    <div style={{fontSize:'24px', color:'#e74c3c', fontWeight:'bold'}}>-{new Intl.NumberFormat('vi-VN').format(totalExpense)} đ</div>
                    <div className="split-line"><span>Tiền mặt:</span> <b>{new Intl.NumberFormat('vi-VN').format(cashExpense)} đ</b></div>
                    <div className="split-line" style={{border: 'none', paddingTop: 0}}><span>Ngân hàng:</span> <b>{new Intl.NumberFormat('vi-VN').format(bankExpense)} đ</b></div>
                </div>
                
                <div className="stat-card" style={{borderLeft: '4px solid #2980b9'}}>
                    <div style={{color:'#7f8c8d', fontWeight:'bold', marginBottom: '5px'}}>TỒN QUỸ HIỆN TẠI (CÂN ĐỐI)</div>
                    <div style={{fontSize:'24px', color:'#2980b9', fontWeight:'bold'}}>{new Intl.NumberFormat('vi-VN').format(totalBalance)} đ</div>
                    <div className="split-line"><span>Quỹ Tiền mặt:</span> <b style={{color: '#2c3e50'}}>{new Intl.NumberFormat('vi-VN').format(cashBalance)} đ</b></div>
                    <div className="split-line" style={{border: 'none', paddingTop: 0}}><span>Quỹ Ngân hàng:</span> <b style={{color: '#2c3e50'}}>{new Intl.NumberFormat('vi-VN').format(bankBalance)} đ</b></div>
                </div>
            </div>

            <div className="toolbar">
                <input className="tool-input" placeholder="🔍 Tìm danh mục, người nộp..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                <select className="tool-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
                    <option value="">-- Tất cả Loại --</option><option value="Thu">Chỉ Phiếu Thu</option><option value="Chi">Chỉ Phiếu Chi</option>
                </select>
                <span style={{fontSize: '14px', fontWeight: 'bold', color: '#555'}}>Từ:</span>
                <input type="date" className="tool-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
                <span style={{fontSize: '14px', fontWeight: 'bold', color: '#555'}}>Đến:</span>
                <input type="date" className="tool-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
                <select className="tool-select" value={sortDate} onChange={e => setSortDate(e.target.value)}>
                    <option value="DESC">Ngày: Gần nhất</option><option value="ASC">Ngày: Xa nhất</option>
                </select>
            </div>

            <div className="card-container">
                <div className="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>Ngày & Mã</th><th>Loại & Hình thức</th><th>Danh mục</th><th>Số tiền</th><th>Người nộp/nhận</th><th>Trạng thái</th>
                                {isAdmin && <th>Hành động</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRecords.map((r) => (
                                <tr key={r.id}>
                                    <td><b>{r.recordDate}</b><br/><small>{r.referenceCode}</small></td>
                                    <td><span style={{padding:'4px 8px', borderRadius:'4px', background: r.type==='Thu'?'#e6f4ea':'#fce8e6', color: r.type==='Thu'?'#1e8e3e':'#d93025', fontWeight:'bold'}}>{r.type}</span><br/><small>{r.paymentMethod}</small></td>
                                    <td><b>{r.category}</b></td>
                                    <td style={{fontWeight: 'bold', color: r.type==='Thu'?'#27ae60':'#e74c3c'}}>{r.type==='Thu'?'+':'-'} {new Intl.NumberFormat('vi-VN').format(r.amount)} đ</td>
                                    <td><b>{r.actor}</b><br/><small>{r.description}</small></td>
                                    <td><span style={{padding:'4px 8px', borderRadius:'4px', background: r.status === 'Hoàn thành' ? '#e6f4ea' : '#f1f3f4', color: r.status === 'Hoàn thành' ? '#1e8e3e' : '#555', fontSize:'12px'}}>{r.status}</span></td>
                                    {isAdmin && (
                                        <td>
                                            <button onClick={() => handleEditClick(r)} style={{background:'none', border:'none', cursor:'pointer', marginRight:'10px'}}>✏️</button>
                                            <button onClick={() => handleDelete(r.id)} style={{background:'none', border:'none', cursor:'pointer'}}>🗑️</button>
                                        </td>
                                    )}
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
                            <h3 style={{margin:0, color: formData.type === 'Thu' ? '#27ae60' : '#e74c3c'}}>📝 LẬP PHIẾU {formData.type.toUpperCase()}</h3>
                            <button onClick={() => setIsModalOpen(false)} style={{background:'none', border:'none', fontSize:'18px', cursor:'pointer'}}>✕</button>
                        </div>
                        <form id="financeForm" onSubmit={handleSubmit} className="modal-body">
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', background:'#f8f9fa', padding:'15px', borderRadius:'8px', marginBottom:'15px'}}>
                                <div><b style={{fontSize:'14px'}}>Người lập phiếu:</b><input className="tool-input" style={{width:'100%', marginTop:'5px', background:'#eee'}} value={formData.creator} disabled /></div>
                                <div><b style={{fontSize:'14px'}}>Ngày giao dịch:</b><input className="tool-input" type="date" name="recordDate" style={{width:'100%', marginTop:'5px'}} value={formData.recordDate} onChange={handleChange} required /></div>
                            </div>

                            <label style={{display:'block', marginBottom:'10px'}}><b>Danh mục {formData.type}:</b>
                                <select className="tool-select" name="category" style={{width:'100%', marginTop:'5px'}} value={formData.category} onChange={handleChange} required>
                                    {formData.type === 'Thu' ? (
                                        <><option value="Bán nông sản">Bán nông sản</option><option value="Thu nợ vật tư">Thu nợ vật tư của Xã viên</option><option value="Thu hồi tạm ứng">Thu hồi tiền ứng trước</option><option value="Góp vốn xã viên">Góp vốn xã viên</option><option value="Thu khác">Thu khác</option></>
                                    ) : (
                                        <><option value="Mua vật tư">Mua vật tư / Hàng hóa</option><option value="Chi ứng trước">Chi ứng trước cho Xã viên</option><option value="Chi trả nợ thu mua">Chi trả nợ Thu mua</option><option value="Trả lương">Trả lương / Nhân công</option><option value="Trả nợ nhà cung cấp">Trả nợ nhà cung cấp</option><option value="Chi phí vận hành">Chi phí vận hành (Điện, nước...)</option><option value="Chi khác">Chi khác</option></>
                                    )}
                                </select>
                            </label>

                            {['Thu nợ vật tư', 'Thu hồi tạm ứng', 'Chi ứng trước', 'Chi trả nợ thu mua', 'Góp vốn xã viên'].includes(formData.category) && (
                                <div style={{background: '#fff3e0', padding: '10px', borderRadius: '4px', marginBottom: '10px', border: '1px dashed #e67e22'}}>
                                    <label style={{display:'block'}}><b>🔄 Chọn Xã viên để liên kết hệ thống:</b>
                                        <select className="tool-select" style={{width:'100%', marginTop:'5px', border: '2px solid #e67e22'}} value={formData.memberPhone || ''} onChange={handleMemberSelect}>
                                            <option value="">-- Chọn thành viên --</option>
                                            {membersList.map(m => <option key={m.id} value={m.phone}>{m.name} - {m.phone}</option>)}
                                        </select>
                                    </label>
                                    
                                    {/* [THÊM MỚI]: BÁO CÁO CÔNG NỢ NGAY TRÊN GIAO DIỆN */}
                                    {formData.memberPhone && ['Thu nợ vật tư', 'Thu hồi tạm ứng', 'Chi trả nợ thu mua'].includes(formData.category) && (
                                        <div style={{fontSize: '12px', color: '#e74c3c', marginTop: '8px', fontWeight: 'bold'}}>
                                            {(() => {
                                                const m = membersList.find(x => x.phone === formData.memberPhone);
                                                if (!m) return '';
                                                if (formData.category === 'Thu nợ vật tư') return `⚠️ Cảnh báo: Xã viên này chỉ nợ tối đa: ${new Intl.NumberFormat('vi-VN').format(m.debtMaterial || 0)} đ`;
                                                if (formData.category === 'Thu hồi tạm ứng') return `⚠️ Cảnh báo: Tiền tạm ứng chưa thu là: ${new Intl.NumberFormat('vi-VN').format(m.advancePayment || 0)} đ`;
                                                if (formData.category === 'Chi trả nợ thu mua') return `⚠️ Cảnh báo: HTX chỉ nợ người này: ${new Intl.NumberFormat('vi-VN').format(m.debtPurchase || 0)} đ`;
                                                return '';
                                            })()}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginBottom:'10px'}}>
                                <label><b>Số tiền (VNĐ):</b><input className="tool-input" type="number" name="amount" style={{width:'100%', marginTop:'5px'}} value={formData.amount} onChange={handleChange} required /></label>
                                <label><b>Hình thức:</b>
                                    <select className="tool-select" name="paymentMethod" style={{width:'100%', marginTop:'5px', fontWeight: 'bold'}} value={formData.paymentMethod} onChange={handleChange}>
                                        <option value="Tiền mặt">Tiền mặt</option><option value="Chuyển khoản">Chuyển khoản (Ngân hàng)</option>
                                    </select>
                                </label>
                            </div>

                            <label style={{display:'block', marginBottom:'10px'}}><b>Người {formData.type === 'Thu' ? 'nộp' : 'nhận'} tiền:</b><input className="tool-input" name="actor" style={{width:'100%', marginTop:'5px'}} value={formData.actor} onChange={handleChange} /></label>
                            <label style={{display:'block', marginBottom:'10px'}}><b>Diễn giải / Ghi chú:</b><textarea className="tool-input" name="description" rows="2" style={{width:'100%', marginTop:'5px'}} value={formData.description} onChange={handleChange}></textarea></label>
                            
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                                <label><b>Mã tham chiếu (Phiếu kho):</b><input className="tool-input" name="referenceCode" style={{width:'100%', marginTop:'5px'}} value={formData.referenceCode} onChange={handleChange} /></label>
                                <label><b>Trạng thái:</b>
                                    <select className="tool-select" name="status" style={{width:'100%', marginTop:'5px'}} value={formData.status} onChange={handleChange}>
                                        <option value="Hoàn thành">Đã thanh toán (Hoàn thành)</option><option value="Chờ xử lý">Chờ xử lý (Cho nợ)</option>
                                    </select>
                                </label>
                            </div>
                        </form>
                        <div className="modal-footer">
                            <button className="btn" style={{backgroundColor: '#f1f3f4', color: '#333'}} onClick={() => setIsModalOpen(false)}>Hủy bỏ</button>
                            <button className={`btn ${formData.type === 'Thu' ? 'btn-success' : 'btn-danger'}`} form="financeForm" type="submit">LƯU PHIẾU {formData.type.toUpperCase()}</button>
                        </div>
                    </div>
                </div>
            )}

            {isSettlementModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header" style={{background: '#f39c12', color: 'white', borderRadius: '8px 8px 0 0'}}>
                            <h3 style={{margin:0}}>🤝 QUYẾT TOÁN BÙ TRỪ CÔNG NỢ CUỐI VỤ</h3>
                            <button onClick={() => setIsSettlementModalOpen(false)} style={{background:'none', border:'none', fontSize:'18px', cursor:'pointer', color: 'white'}}>✕</button>
                        </div>
                        <form id="settlementForm" onSubmit={handleSettlementSubmit} className="modal-body">
                            <label style={{display:'block', marginBottom: '20px'}}><b>Bước 1: Chọn Xã viên cần quyết toán:</b>
                                <select className="tool-select" style={{width:'100%', marginTop:'5px', fontSize: '16px', border: '2px solid #3498db'}} onChange={handleSettlementSelect} required>
                                    <option value="">-- Click để chọn Xã viên --</option>
                                    {membersList.map(m => <option key={m.id} value={m.phone}>{m.name} - SĐT: {m.phone}</option>)}
                                </select>
                            </label>

                            {selectedMember && (
                                <div style={{background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #dcdde1'}}>
                                    <h4 style={{marginTop: 0, color: '#2c3e50', textAlign: 'center', textTransform: 'uppercase'}}>TÌNH TRẠNG 3 VÍ CÔNG NỢ CỦA {selectedMember.name}</h4>
                                    
                                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '15px'}}>
                                        <span>[+] HTX nợ thu mua (Ví Xanh):</span>
                                        <b style={{color: '#27ae60'}}>{new Intl.NumberFormat('vi-VN').format(selectedMember.debtPurchase || 0)} đ</b>
                                    </div>
                                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '15px'}}>
                                        <span>[-] Xã viên nợ vật tư (Ví Đỏ):</span>
                                        <b style={{color: '#e74c3c'}}>{new Intl.NumberFormat('vi-VN').format(selectedMember.debtMaterial || 0)} đ</b>
                                    </div>
                                    <div style={{display: 'flex', justifyContent: 'space-between', paddingBottom: '15px', borderBottom: '2px dashed #ccc', fontSize: '15px'}}>
                                        <span>[-] Xã viên đã tạm ứng (Ví Cam):</span>
                                        <b style={{color: '#e67e22'}}>{new Intl.NumberFormat('vi-VN').format(selectedMember.advancePayment || 0)} đ</b>
                                    </div>

                                    {(() => {
                                        const finalAmount = Number(selectedMember.debtPurchase || 0) - Number(selectedMember.debtMaterial || 0) - Number(selectedMember.advancePayment || 0);
                                        if (finalAmount > 0) {
                                            return (
                                                <div style={{textAlign: 'center', marginTop: '20px'}}>
                                                    <div style={{color: '#7f8c8d', marginBottom: '5px'}}>KẾT QUẢ BÙ TRỪ:</div>
                                                    <div style={{fontSize: '18px', color: '#2c3e50'}}>HTX CẦN CHI TRẢ CHO XÃ VIÊN</div>
                                                    <div style={{fontSize: '32px', color: '#e74c3c', fontWeight: 'bold'}}>{new Intl.NumberFormat('vi-VN').format(finalAmount)} đ</div>
                                                    <p style={{color: '#e74c3c', fontSize: '13px', margin: '5px 0'}}>*(Hệ thống sẽ tự động tạo Phiếu CHI tiền mặt & Xóa 0đ các ví nợ)*</p>
                                                </div>
                                            )
                                        } else if (finalAmount < 0) {
                                            return (
                                                <div style={{textAlign: 'center', marginTop: '20px'}}>
                                                    <div style={{color: '#7f8c8d', marginBottom: '5px'}}>KẾT QUẢ BÙ TRỪ:</div>
                                                    <div style={{fontSize: '18px', color: '#2c3e50'}}>XÃ VIÊN CẦN NỘP BÙ CHO HTX</div>
                                                    <div style={{fontSize: '32px', color: '#27ae60', fontWeight: 'bold'}}>{new Intl.NumberFormat('vi-VN').format(Math.abs(finalAmount))} đ</div>
                                                    <p style={{color: '#27ae60', fontSize: '13px', margin: '5px 0'}}>*(Hệ thống sẽ tự động tạo Phiếu THU tiền mặt & Xóa 0đ các ví nợ)*</p>
                                                </div>
                                            )
                                        } else {
                                            return (
                                                <div style={{textAlign: 'center', marginTop: '20px', color: '#2980b9'}}>
                                                    <div style={{fontSize: '18px', fontWeight: 'bold'}}>VỪA ĐỦ ĐỂ CẤN TRỪ (0 đ)</div>
                                                    <p style={{fontSize: '13px', margin: '5px 0'}}>*(Hệ thống sẽ đưa các ví nợ về 0đ mà không tác động đến Tồn quỹ)*</p>
                                                </div>
                                            )
                                        }
                                    })()}
                                </div>
                            )}
                        </form>
                        <div className="modal-footer">
                            <button className="btn" style={{backgroundColor: '#ecf0f1', color: '#333'}} onClick={() => setIsSettlementModalOpen(false)}>Hủy bỏ</button>
                            <button className="btn btn-warning" form="settlementForm" type="submit" disabled={!selectedMember}>✅ XÁC NHẬN QUYẾT TOÁN</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Finance;