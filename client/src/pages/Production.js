import React, { useEffect, useState } from 'react';
import { getAllLogs, createLog, deleteLog, updateLog } from '../api/productionApi';
import { getAllMembers } from '../api/memberApi';
import { getAllItems } from '../api/inventoryApi';
import * as XLSX from 'xlsx'; 

const Production = () => {
    const currentUser = JSON.parse(localStorage.getItem('user')) || {};
    const role = currentUser.role;
    const isAdmin = role === 'Giám đốc';
    const isFarmer = role === 'Xã viên';
    const canEdit = isAdmin || isFarmer; 

    const [logs, setLogs] = useState([]);
    const [membersList, setMembersList] = useState([]);
    const [inventoryItems, setInventoryItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const initForm = {
        seasonName: 'Xuân - Hè', cropType: '', activityDate: new Date().toISOString().split('T')[0], 
        activityType: 'Làm đất', description: '', weather: 'Nắng đẹp', 
        materialsUsed: '', toolsUsed: '', executor: currentUser.fullName, creatorPhone: currentUser.phone, status: 'Đã hoàn thành',
        inventoryId: '', materialQuantity: '', isDebt: true 
    };
    const [formData, setFormData] = useState(initForm);

    const fetchData = async () => {
        try {
            const [logsRes, membersRes, invRes] = await Promise.all([
                getAllLogs(), getAllMembers(), getAllItems()
            ]);
            setLogs(logsRes.data);
            setMembersList(membersRes.data);
            setInventoryItems(invRes.data);
        } catch (error) { console.error("Lỗi khi tải dữ liệu:", error); }
    };
    useEffect(() => { fetchData(); }, []);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleMaterialChange = (e) => {
        const selectedId = e.target.value;
        if (!selectedId) {
            setFormData({ ...formData, inventoryId: '', materialsUsed: '', materialQuantity: '' });
            return;
        }
        const item = inventoryItems.find(i => i.id.toString() === selectedId);
        if (item) {
            setFormData({ ...formData, inventoryId: item.id, materialsUsed: item.itemName });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                await updateLog(editingId, formData);
            } else {
                await createLog(formData);
            }
            setIsModalOpen(false); fetchData();
        } catch (error) { 
            alert(error.response?.data?.message || "Lỗi khi lưu nhật ký! (Kho có thể không đủ)"); 
        }
    };

    const handleEditClick = (log) => { setFormData({ ...initForm, ...log }); setEditingId(log.id); setIsModalOpen(true); };
    
    const handleDelete = async (id) => {
        if (window.confirm("Bạn có chắc chắn muốn xóa? Hệ thống sẽ tự động hoàn lại Vật tư và Nợ nếu có.")) {
            await deleteLog(id); fetchData();
        }
    };

    const filteredLogs = logs.filter(log => 
        log.seasonName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (log.activityType && log.activityType.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.executor && log.executor.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleExportExcel = () => {
        const dataToExport = filteredLogs.map((log, index) => ({
            "STT": index + 1, "Ngày thực hiện": log.activityDate, "Vụ mùa": log.seasonName,
            "Cây trồng": log.cropType || '', "Hoạt động": log.activityType,
            "Người phụ trách": log.executor || '',
            "Vật tư sử dụng": log.materialsUsed ? `${log.materialsUsed} (SL: ${log.materialQuantity || 0})` : 'Không',
            "Công cụ sử dụng": log.toolsUsed || 'Không',
            "Thời tiết": log.weather || '', "Nội dung / Ghi chú": log.description || '', "Trạng thái": log.status
        }));
        const ws = XLSX.utils.json_to_sheet(dataToExport); const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "NhatKy"); XLSX.writeFile(wb, "Nhat_Ky_Canh_Tac.xlsx");
    };

    return (
        <div className="page-wrapper" style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <style>{`
                * { box-sizing: border-box; }
                .header-section { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #bdc3c7; padding-bottom: 15px; margin-bottom: 20px; }
                .toolbar { display: flex; gap: 10px; margin-bottom: 15px; background: white; padding: 15px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
                .tool-input, .tool-select { padding: 8px 12px; border: 1px solid #dcdde1; border-radius: 4px; outline: none; }
                .btn { padding: 10px 16px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; color: white; background: #3498db; transition: 0.2s; }
                .btn:hover { background: #2980b9; }
                
                /* ÁP DỤNG CUỘN LỒNG KÉP */
                .card-container { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; flex-direction: column; margin-bottom: 20px; }
                .table-scroll { width: 100%; flex: 1; overflow: auto; max-height: 80vh;}
                
                table { width: 100%; border-collapse: collapse; min-width: 1050px; table-layout: fixed; }
                th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #f1f2f6; word-wrap: break-word; vertical-align: top;}
                th { background: #f8f9fa; position: sticky; top: 0; z-index: 10; color: #2c3e50; box-shadow: 0 2px 2px -1px rgba(0,0,0,0.1); }
                .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; }
                .modal-content { background: white; width: 100%; max-width: 800px; max-height: 90vh; border-radius: 8px; display: flex; flex-direction: column; }
                .modal-header { padding: 15px 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
                .modal-body { padding: 20px; overflow-y: auto; flex: 1; }
                .modal-footer { padding: 15px 20px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; background: #f8f9fa; }
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
                <h2 style={{ margin: 0, color: '#2c3e50' }}>🌾 Nhật ký Canh tác & Xuất vật tư</h2>
                <div>
                    <button className="btn" style={{background: 'white', color: '#333', border: '1px solid #ccc', marginRight: '10px'}} onClick={handleExportExcel}>📥 Xuất Excel</button>
                    {canEdit && <button className="btn" onClick={() => { setFormData(initForm); setEditingId(null); setIsModalOpen(true); }}>+ Ghi Nhật ký</button>}
                </div>
            </div>

            <div className="toolbar">
                <input className="tool-input" style={{width: '350px'}} placeholder="🔍 Tìm theo Vụ mùa, Hoạt động, Người thực hiện..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>

            <div className="card-container">
                <div className="table-scroll">
                    <table>
                        <colgroup>
                            <col style={{ width: '13%' }} /><col style={{ width: '15%' }} /><col style={{ width: '15%' }} />
                            <col style={{ width: '22%' }} /><col style={{ width: '15%' }} /><col style={{ width: '13%' }} />
                            {canEdit && <col style={{ width: '7%' }} />}
                        </colgroup>
                        <thead>
                            <tr>
                                <th>Ngày & Vụ</th><th>Hoạt động</th><th>Người thực hiện</th><th>Vật tư (Tự động ghi nợ)</th><th>Công cụ sử dụng</th><th>Trạng thái</th>{canEdit && <th></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLogs.map((log) => (
                                <tr key={log.id}>
                                    <td><b>{log.activityDate}</b><br/><small style={{color: '#27ae60', fontWeight:'bold'}}>{log.seasonName}</small></td>
                                    <td><span style={{ color: '#2980b9', fontWeight: 'bold' }}>{log.activityType}</span><br/><small>{log.cropType}</small></td>
                                    <td>{log.executor}</td>
                                    <td>
                                        {log.materialsUsed ? (
                                            <>
                                                <b>{log.materialsUsed}</b> (SL: {log.materialQuantity})<br/>
                                                <span style={{fontSize: '11px', color: 'white', background: '#e74c3c', padding: '2px 5px', borderRadius: '3px'}}>Đã nợ: {Number(log.materialCost).toLocaleString()}đ</span>
                                            </>
                                        ) : <span style={{color: '#bdc3c7', fontStyle: 'italic'}}>Không dùng</span>}
                                    </td>
                                    <td>{log.toolsUsed || <span style={{color: '#bdc3c7', fontStyle: 'italic'}}>Không</span>}</td>
                                    <td><span style={{padding:'4px 8px', borderRadius:'4px', fontSize:'11px', fontWeight: 'bold', color: log.status==='Đã hoàn thành'?'#1e8e3e':'#d35400', background: log.status==='Đã hoàn thành'?'#e6f4ea':'#fdf2d0'}}>{log.status}</span></td>
                                    {canEdit && (isAdmin || log.creatorPhone === currentUser.phone) && (
                                        <td>
                                            <button onClick={() => handleEditClick(log)} style={{background:'none', border:'none', cursor:'pointer', marginRight:'10px'}}>✏️</button>
                                            <button onClick={() => handleDelete(log.id)} style={{background:'none', border:'none', cursor:'pointer'}}>🗑️</button>
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
                            <h3 style={{margin:0, color: '#2c3e50'}}>📝 {editingId ? "Cập nhật Nhật ký" : "Ghi Nhật ký Canh tác"}</h3>
                            <button onClick={() => setIsModalOpen(false)} style={{background:'none', border:'none', fontSize:'18px', cursor:'pointer'}}>✕</button>
                        </div>
                        <form id="productionForm" onSubmit={handleSubmit} className="modal-body">
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', background:'#f8f9fa', padding:'15px', borderRadius:'8px', marginBottom:'15px', border: '1px solid #eee'}}>
                                <label><b>Người thực hiện:</b>
                                    <select className="tool-select" name="executor" style={{width:'100%', marginTop:'5px', background: isAdmin?'#fff':'#eee'}} value={formData.executor} onChange={handleChange} disabled={!isAdmin}>
                                        <option value={currentUser.fullName}>{currentUser.fullName} (Bạn)</option>
                                        {isAdmin && membersList.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                                    </select>
                                </label>
                                <label><b>Ngày thực hiện:</b><input type="date" className="tool-input" name="activityDate" style={{width:'100%', marginTop:'5px'}} value={formData.activityDate} onChange={handleChange} required/></label>
                            </div>

                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginBottom:'15px'}}>
                                <label><b>Vụ mùa:</b>
                                    <select className="tool-select" name="seasonName" style={{width:'100%', marginTop:'5px'}} value={formData.seasonName} onChange={handleChange}>
                                        <option value="Xuân - Hè">Vụ Xuân - Hè</option><option value="Thu - Đông">Vụ Thu - Đông</option>
                                    </select>
                                </label>
                                <label><b>Loại Giống / Cây trồng:</b>
                                    <select className="tool-select" name="cropType" style={{width:'100%', marginTop:'5px'}} value={formData.cropType} onChange={handleChange}>
                                        <option value="">-- Chọn Giống từ Kho --</option>
                                        {inventoryItems.filter(i => i.category === 'Nông sản đầu ra' || i.itemName.toLowerCase().includes('giống')).map(i => <option key={i.id} value={i.itemName}>{i.itemName}</option>)}
                                    </select>
                                </label>
                            </div>

                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginBottom:'15px'}}>
                                <label><b>Loại hoạt động:</b>
                                    <select className="tool-select" name="activityType" style={{width:'100%', marginTop:'5px'}} value={formData.activityType} onChange={handleChange}>
                                        <option value="Làm đất">Làm đất</option><option value="Gieo trồng">Gieo trồng / Xuống giống</option><option value="Bón phân">Bón phân</option><option value="Phun thuốc">Phun thuốc / Phòng bệnh</option><option value="Chăm sóc">Chăm sóc / Làm cỏ</option><option value="Thu hoạch">Thu hoạch</option>
                                    </select>
                                </label>
                                <label><b>Thời tiết:</b>
                                    <select className="tool-select" name="weather" style={{width:'100%', marginTop:'5px'}} value={formData.weather} onChange={handleChange}>
                                        <option value="Nắng đẹp">Nắng đẹp</option><option value="Nắng gắt">Nắng gắt</option><option value="Mưa rào">Mưa rào</option><option value="Âm u / Lạnh">Âm u / Lạnh</option>
                                    </select>
                                </label>
                            </div>

                            <div style={{borderLeft:'3px solid #3498db', paddingLeft:'15px', marginBottom:'15px', background: '#fdfdfe', padding: '15px', borderRadius: '0 8px 8px 0'}}>
                                
                                {editingId && formData.inventoryId && (
                                    <p style={{color: '#e74c3c', fontSize: '13px', fontStyle: 'italic', marginBottom: '10px'}}>
                                        ⚠️ Không thể thay đổi vật tư sau khi đã lưu. Hãy xóa và tạo lại nhật ký nếu nhập sai.
                                    </p>
                                )}

                                <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:'10px', alignItems: 'end', marginBottom: '15px'}}>
                                    <label><b>Vật tư tiêu hao (Trừ từ Kho & Tự động ghi nợ):</b>
                                        <select className="tool-select" style={{width:'100%', marginTop:'5px'}} value={formData.inventoryId || ''} onChange={handleMaterialChange} disabled={!!editingId}>
                                            <option value="">-- Không dùng vật tư --</option>
                                            {inventoryItems.filter(i => i.category === 'Vật tư đầu vào').map(i => <option key={i.id} value={i.id}>{i.itemName} (Tồn: {i.quantity} {i.unit})</option>)}
                                        </select>
                                    </label>
                                    <label><b>Số lượng:</b>
                                        <input type="number" step="0.1" min="0" className="tool-input" style={{width:'100%', marginTop:'5px'}} name="materialQuantity" value={formData.materialQuantity} onChange={handleChange} disabled={!formData.inventoryId || !!editingId} placeholder="SL" />
                                    </label>
                                </div>

                                <label style={{display:'block'}}><b>Công cụ sử dụng:</b>
                                    <select className="tool-select" name="toolsUsed" style={{width:'100%', marginTop:'5px'}} value={formData.toolsUsed} onChange={handleChange}>
                                        <option value="">-- Không dùng hoặc Chọn Công cụ --</option>
                                        {inventoryItems.filter(i => i.category === 'Công cụ dụng cụ').map(i => <option key={i.id} value={i.itemName}>{i.itemName}</option>)}
                                    </select>
                                </label>
                            </div>

                            <label style={{display:'block', marginBottom:'15px'}}><b>Nội dung chi tiết / Ghi chú:</b>
                                <textarea className="tool-input" name="description" rows="2" style={{width:'100%', marginTop:'5px'}} value={formData.description} onChange={handleChange} placeholder="Ghi chú chi tiết công việc đã làm..."></textarea>
                            </label>
                            
                            <label style={{display:'block'}}><b>Trạng thái:</b>
                                <select className="tool-select" name="status" style={{width:'100%', marginTop:'5px'}} value={formData.status} onChange={handleChange}>
                                    <option value="Đã hoàn thành">Đã hoàn thành</option><option value="Đang thực hiện">Đang thực hiện</option><option value="Sự cố/Dịch bệnh">Sự cố / Báo cáo bệnh</option>
                                </select>
                            </label>
                        </form>
                        <div className="modal-footer">
                            <button className="btn" style={{backgroundColor: '#f1f3f4', color: '#333'}} onClick={() => setIsModalOpen(false)}>Hủy bỏ</button>
                            <button className="btn" form="productionForm" type="submit">Lưu Nhật ký</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Production;