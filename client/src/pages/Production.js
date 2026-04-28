import React, { useEffect, useState } from 'react';
import { getAllLogs, createLog, deleteLog, updateLog, handleToolAction } from '../api/productionApi';
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
        executor: currentUser.fullName, creatorPhone: currentUser.phone, status: 'Đã hoàn thành'
    };
    const [formData, setFormData] = useState(initForm);
    const [usedItems, setUsedItems] = useState([{ inventoryId: '', quantity: '' }]);

    const fetchData = async () => {
        try {
            const [logsRes, membersRes, invRes] = await Promise.all([ getAllLogs(), getAllMembers(), getAllItems() ]);
            setLogs(logsRes.data); setMembersList(membersRes.data); setInventoryItems(invRes.data);
        } catch (error) { console.error("Lỗi khi tải dữ liệu:", error); }
    };
    useEffect(() => { fetchData(); }, []);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleMemberChange = (e) => {
        const phone = e.target.value;
        const member = membersList.find(m => m.phone === phone);
        if (member) { setFormData({...formData, creatorPhone: phone, executor: member.name}); } 
        else if (phone === currentUser.phone) { setFormData({...formData, creatorPhone: currentUser.phone, executor: currentUser.fullName}); }
    }

    const handleItemChange = (index, field, value) => {
        const newItems = [...usedItems];
        newItems[index][field] = value;
        setUsedItems(newItems);
    };
    const addUsedItem = () => setUsedItems([...usedItems, { inventoryId: '', quantity: '' }]);
    const removeUsedItem = (index) => setUsedItems(usedItems.filter((_, i) => i !== index));

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const validItems = usedItems.filter(i => i.inventoryId && i.quantity);
            const payload = { ...formData, usedItems: validItems };

            if (editingId) await updateLog(editingId, payload);
            else await createLog(payload);
            
            setIsModalOpen(false); fetchData();
        } catch (error) { alert(error.response?.data?.message || "Lỗi khi lưu nhật ký! (Kho có thể không đủ số lượng)"); }
    };

    const handleEditClick = (log) => { 
        setFormData({ ...initForm, ...log }); 
        let items = [];
        try { items = JSON.parse(log.toolsUsed || '[]'); } catch(e){}
        const mappedItems = items.map(i => ({ inventoryId: i.id || i.inventoryId, quantity: i.qty || i.quantity }));
        setUsedItems(mappedItems.length > 0 ? mappedItems : [{ inventoryId: '', quantity: '' }]);
        setEditingId(log.id); setIsModalOpen(true); 
    };
    
    const handleDelete = async (id) => {
        if (window.confirm("CẢNH BÁO: Xóa nhật ký sẽ hoàn trả Kho và Hủy toàn bộ công nợ liên quan. Chắc chắn xóa?")) {
            await deleteLog(id); fetchData();
        }
    };

    // [THÊM MỚI] - GỌI API TRẢ ĐỒ HOẶC BÁO MẤT
    const triggerToolAction = async (logId, toolId, action, toolName) => {
        const actionText = action === 'return' ? `TRẢ công cụ [${toolName}] vào kho?` : `BÁO MẤT [${toolName}]? (Hệ thống sẽ trừ tiền đền bù vào Nợ Vật tư của bạn)`;
        if (window.confirm(`Bạn có chắc chắn muốn ${actionText}`)) {
            try {
                const log = logs.find(l => l.id === logId);
                await handleToolAction({ logId, toolId, action, creatorPhone: log.creatorPhone, executor: currentUser.fullName });
                alert("Xử lý thành công!"); fetchData();
            } catch (error) { alert("Lỗi hệ thống: " + error.message); }
        }
    };

    const filteredLogs = logs.filter(log => 
        log.seasonName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (log.activityType && log.activityType.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.executor && log.executor.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleExportExcel = () => {
        // Rút gọn Logic Excel để code ngắn gọn
        const ws = XLSX.utils.json_to_sheet(filteredLogs); const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "NhatKy"); XLSX.writeFile(wb, "Nhat_Ky_Canh_Tac.xlsx");
    };

    const allowedInventoryItems = inventoryItems.filter(i => i.category === 'Vật tư đầu vào' || i.category === 'Công cụ dụng cụ' || i.itemName.toLowerCase().includes('giống') || i.itemName.toLowerCase().includes('hạt'));

    return (
        <div className="page-wrapper" style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <style>{`
                * { box-sizing: border-box; }
                .header-section { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #bdc3c7; padding-bottom: 15px; margin-bottom: 20px; }
                .toolbar { display: flex; gap: 10px; margin-bottom: 15px; background: white; padding: 15px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
                .tool-input, .tool-select { padding: 8px 12px; border: 1px solid #dcdde1; border-radius: 4px; outline: none; }
                .btn { padding: 10px 16px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; color: white; background: #3498db; transition: 0.2s; }
                .btn:hover { background: #2980b9; }
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
                
                /* Nút xử lý công cụ */
                .btn-tool { border: none; padding: 3px 6px; border-radius: 3px; font-size: 10px; font-weight: bold; cursor: pointer; margin-right: 5px; color: white;}
                .btn-return { background-color: #27ae60; } .btn-return:hover { background-color: #219a52; }
                .btn-lost { background-color: #e74c3c; } .btn-lost:hover { background-color: #c0392b; }
            `}</style>

            <div className="header-section">
                <h2 style={{ margin: 0, color: '#2c3e50' }}>🌾 Nhật ký Canh tác & Xuất vật tư</h2>
                <div>
                    <button className="btn" style={{background: 'white', color: '#333', border: '1px solid #ccc', marginRight: '10px'}} onClick={handleExportExcel}>📥 Xuất Excel</button>
                    {canEdit && <button className="btn" onClick={() => { setFormData(initForm); setUsedItems([{ inventoryId: '', quantity: '' }]); setEditingId(null); setIsModalOpen(true); }}>+ Ghi Nhật ký</button>}
                </div>
            </div>

            <div className="toolbar">
                <input className="tool-input" style={{width: '350px'}} placeholder="🔍 Tìm theo Vụ, Người thực hiện..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>

            <div className="card-container">
                <div className="table-scroll">
                    <table>
                        <colgroup>
                            <col style={{ width: '13%' }} /><col style={{ width: '15%' }} /><col style={{ width: '15%' }} />
                            <col style={{ width: '25%' }} /><col style={{ width: '13%' }} />
                            {canEdit && <col style={{ width: '7%' }} />}
                        </colgroup>
                        <thead>
                            <tr>
                                <th>Ngày & Vụ</th><th>Hoạt động</th><th>Người thực hiện</th><th>Vật tư & Công cụ (Quản lý mượn/trả)</th><th>Trạng thái</th>{canEdit && <th></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLogs.map((log) => {
                                // Giải mã JSON để hiển thị và tạo nút bấm Trả đồ
                                let usedToolsArr = [];
                                try { usedToolsArr = JSON.parse(log.toolsUsed || '[]'); } catch(e){}

                                return (
                                <tr key={log.id}>
                                    <td><b>{log.activityDate}</b><br/><small style={{color: '#27ae60', fontWeight:'bold'}}>{log.seasonName}</small></td>
                                    <td><span style={{ color: '#2980b9', fontWeight: 'bold' }}>{log.activityType}</span><br/><small>{log.cropType}</small></td>
                                    <td>{log.executor}</td>
                                    <td>
                                        {usedToolsArr.length > 0 ? (
                                            <ul style={{ margin: 0, paddingLeft: '15px', fontSize: '13px' }}>
                                                {usedToolsArr.map((item, idx) => (
                                                    <li key={idx} style={{marginBottom: '5px'}}>
                                                        <b>{item.itemName}</b> (SL: {item.qty}) <br/>
                                                        
                                                        {item.isTool ? (
                                                            // Giao diện của Công cụ (Có nút bấm Trả / Báo hỏng)
                                                            item.status === 'Đang mượn' ? (
                                                                <div style={{marginTop: '3px'}}>
                                                                    <button className="btn-tool btn-return" onClick={() => triggerToolAction(log.id, item.id, 'return', item.itemName)}>🔄 Trả đồ</button>
                                                                    <button className="btn-tool btn-lost" onClick={() => triggerToolAction(log.id, item.id, 'lost', item.itemName)}>⚠️ Báo mất</button>
                                                                </div>
                                                            ) : (
                                                                <span style={{fontSize: '11px', color: item.status==='Đã trả'?'#27ae60':'#c0392b', fontWeight:'bold'}}>
                                                                    [{item.status}]
                                                                </span>
                                                            )
                                                        ) : (
                                                            // Giao diện của Vật tư tiêu hao (Hạt giống, Phân bón)
                                                            <span style={{color: '#7f8c8d', fontSize: '11px'}}>- Tiêu hao -</span>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : <span style={{color: '#bdc3c7', fontStyle: 'italic'}}>Không dùng gì</span>}
                                        
                                        {Number(log.materialCost) > 0 && (
                                            <div style={{fontSize: '11px', color: 'white', background: '#e74c3c', padding: '3px 6px', borderRadius: '3px', marginTop:'8px', display:'inline-block'}}>
                                                Đã tính nợ: {Number(log.materialCost).toLocaleString()}đ
                                            </div>
                                        )}
                                    </td>
                                    <td><span style={{padding:'4px 8px', borderRadius:'4px', fontSize:'11px', fontWeight: 'bold', color: log.status==='Đã hoàn thành'?'#1e8e3e':'#d35400', background: log.status==='Đã hoàn thành'?'#e6f4ea':'#fdf2d0'}}>{log.status}</span></td>
                                    {canEdit && (isAdmin || log.creatorPhone === currentUser.phone) && (
                                        <td>
                                            <button onClick={() => handleEditClick(log)} style={{background:'none', border:'none', cursor:'pointer', marginRight:'10px'}}>✏️</button>
                                            <button onClick={() => handleDelete(log.id)} style={{background:'none', border:'none', cursor:'pointer'}}>🗑️</button>
                                        </td>
                                    )}
                                </tr>
                            )})}
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
                            
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', background:'#fdfefe', padding:'15px', borderRadius:'8px', marginBottom:'15px', border: '2px solid #3498db'}}>
                                <label style={{gridColumn: 'span 2'}}>
                                    <b style={{color: '#2980b9'}}>Xã viên thực hiện (Định danh người ghi nợ):</b>
                                    <select className="tool-select" name="creatorPhone" style={{width:'100%', marginTop:'5px', background: isAdmin?'#fff':'#eee', fontWeight:'bold'}} value={formData.creatorPhone} onChange={handleMemberChange} disabled={!isAdmin || !!editingId}>
                                        <option value={currentUser.phone}>{currentUser.fullName} (Bạn)</option>
                                        {isAdmin && membersList.map(m => <option key={m.id} value={m.phone}>{m.name} - {m.phone}</option>)}
                                    </select>
                                    <small style={{color: '#7f8c8d'}}>Công cụ là mượn miễn phí. Vật tư / Hạt giống sẽ tự tính tiền cộng vào nợ Xã viên.</small>
                                </label>
                            </div>

                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginBottom:'15px'}}>
                                <label><b>Ngày thực hiện:</b><input type="date" className="tool-input" name="activityDate" style={{width:'100%', marginTop:'5px'}} value={formData.activityDate} onChange={handleChange} required/></label>
                                <label><b>Vụ mùa:</b>
                                    <select className="tool-select" name="seasonName" style={{width:'100%', marginTop:'5px'}} value={formData.seasonName} onChange={handleChange}>
                                        <option value="Xuân - Hè">Vụ Xuân - Hè</option><option value="Thu - Đông">Vụ Thu - Đông</option>
                                    </select>
                                </label>
                            </div>

                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginBottom:'15px'}}>
                                <label><b>Loại hoạt động:</b>
                                    <select className="tool-select" name="activityType" style={{width:'100%', marginTop:'5px'}} value={formData.activityType} onChange={handleChange}>
                                        <option value="Làm đất">Làm đất</option><option value="Gieo trồng">Gieo trồng / Xuống giống</option><option value="Bón phân">Bón phân</option><option value="Phun thuốc">Phun thuốc / Phòng bệnh</option><option value="Chăm sóc">Chăm sóc / Làm cỏ</option><option value="Thu hoạch">Thu hoạch</option>
                                    </select>
                                </label>
                                <label><b>Ghi chú loại cây (nếu có):</b><input className="tool-input" name="cropType" style={{width:'100%', marginTop:'5px'}} value={formData.cropType} onChange={handleChange} placeholder="Ví dụ: Cà chua Beef..."/></label>
                            </div>

                            {/* KHU VỰC THÊM VẬT TƯ / CÔNG CỤ / GIỐNG */}
                            <div style={{borderLeft:'3px solid #e67e22', paddingLeft:'15px', marginBottom:'15px', background: '#fffcf5', padding: '15px', borderRadius: '0 8px 8px 0'}}>
                                <h4 style={{ margin: '0 0 15px 0', color: '#d35400' }}>📦 XUẤT KHO SỬ DỤNG LÀM ĐỒNG</h4>
                                
                                {editingId && (
                                    <p style={{color: '#e74c3c', fontSize: '13px', fontStyle: 'italic', marginBottom: '10px'}}>
                                        ⚠️ Tính năng thay đổi vật tư đã bị khóa. Nếu nhập sai, vui lòng xóa Nhật ký này và tạo lại để hệ thống tự động hoàn trả Kho và Công Nợ.
                                    </p>
                                )}

                                {usedItems.map((item, index) => (
                                    <div key={index} style={{display:'grid', gridTemplateColumns:'2fr 1fr 40px', gap:'10px', alignItems: 'center', marginBottom: '10px'}}>
                                        <select className="tool-select" value={item.inventoryId} onChange={(e) => handleItemChange(index, 'inventoryId', e.target.value)} disabled={!!editingId}>
                                            <option value="">-- Chọn Công cụ mượn / Vật tư tiêu hao --</option>
                                            {allowedInventoryItems.map(i => <option key={i.id} value={i.id}>{i.itemName} (Tồn: {i.quantity} {i.unit})</option>)}
                                        </select>
                                        <input type="number" step="0.1" min="0" className="tool-input" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} disabled={!!editingId || !item.inventoryId} placeholder="SL" />
                                        {!editingId && <button type="button" onClick={() => removeUsedItem(index)} style={{background: '#ffeaa7', border: '1px solid #fdcb6e', color: '#d63031', cursor: 'pointer', borderRadius: '4px', fontWeight: 'bold', height: '100%'}}>✕</button>}
                                    </div>
                                ))}
                                
                                {!editingId && <button type="button" className="btn btn-outline" style={{width: '100%', borderStyle: 'dashed', color: '#e67e22', borderColor: '#e67e22'}} onClick={addUsedItem}>+ Thêm đồ cần xuất kho</button>}
                            </div>

                            <label style={{display:'block', marginBottom:'15px'}}><b>Thời tiết:</b>
                                <select className="tool-select" name="weather" style={{width:'100%', marginTop:'5px'}} value={formData.weather} onChange={handleChange}>
                                    <option value="Nắng đẹp">Nắng đẹp</option><option value="Nắng gắt">Nắng gắt</option><option value="Mưa rào">Mưa rào</option><option value="Âm u / Lạnh">Âm u / Lạnh</option>
                                </select>
                            </label>

                            <label style={{display:'block', marginBottom:'15px'}}><b>Nội dung chi tiết / Ghi chú:</b>
                                <textarea className="tool-input" name="description" rows="2" style={{width:'100%', marginTop:'5px'}} value={formData.description} onChange={handleChange} placeholder="Ví dụ: Làm đất kỹ chuẩn bị gieo hạt..."></textarea>
                            </label>
                            
                            <label style={{display:'block'}}><b>Trạng thái công việc:</b>
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