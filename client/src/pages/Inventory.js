import React, { useEffect, useState } from 'react';
import { getAllItems, createItem, deleteItem, updateItem, getTransactions, createTransaction, deleteTransaction } from '../api/inventoryApi';
import { getAllMembers } from '../api/memberApi'; 

const Inventory = () => {
    const currentUser = JSON.parse(localStorage.getItem('user')) || {};
    const role = currentUser.role;
    const canManageCategory = role === 'Giám đốc'; 
    const canCreateReceipt = ['Giám đốc', 'Thủ kho'].includes(role); 
    const canDeleteReceipt = role === 'Giám đốc'; 

    const [activeTab, setActiveTab] = useState('Kho hàng'); 
    
    const [items, setItems] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [membersList, setMembersList] = useState([]); 

    const [searchItem, setSearchItem] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [sortItemName, setSortItemName] = useState(''); 

    const [searchTrans, setSearchTrans] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [sortDate, setSortDate] = useState('DESC'); 

    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [isTransModalOpen, setIsTransModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const initItemForm = { itemName: '', category: 'Vật tư đầu vào', unit: '', supplier: '', batchNumber: '', expiryDate: '' };
    const [itemForm, setItemForm] = useState(initItemForm);

    const initTransForm = { 
        type: 'Nhập', creator: currentUser.fullName || '', date: new Date().toISOString().split('T')[0], 
        supplier: '', reason: 'Bán hàng', note: '', memberPhone: '', isCredit: false,
        products: [{ inventoryId: '', quantity: '', unitPrice: '' }] 
    };
    const [transForm, setTransForm] = useState(initTransForm);

    const fetchData = async () => {
        try {
            const [itemsRes, transRes, membersRes] = await Promise.all([
                getAllItems(),
                getTransactions(activeTab === 'Đã nhập' ? 'Nhập' : activeTab === 'Đã xuất' ? 'Xuất' : ''),
                getAllMembers()
            ]);
            setItems(itemsRes.data);
            setMembersList(membersRes.data);
            if (activeTab !== 'Kho hàng') setTransactions(transRes.data);
        } catch (error) { console.error("Lỗi lấy dữ liệu:", error); }
    };

    useEffect(() => { 
        fetchData(); 
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    const checkExpiry = (dateString) => {
        if (!dateString) return { text: '-', color: 'black' };
        const daysLeft = (new Date(dateString) - new Date()) / (1000 * 60 * 60 * 24);
        if (daysLeft < 0) return { text: 'Quá hạn', color: '#c0392b' }; 
        if (daysLeft <= 30) return { text: `Còn ${Math.ceil(daysLeft)} ngày`, color: '#e67e22' }; 
        return { text: new Date(dateString).toLocaleDateString('vi-VN'), color: '#27ae60' }; 
    };

    const handleItemSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingId) await updateItem(editingId, itemForm);
            else await createItem(itemForm);
            setIsItemModalOpen(false); setEditingId(null); fetchData();
        } catch (error) { alert("Lỗi lưu hàng hóa!"); }
    };
    const handleDeleteItem = async (id) => {
        if (window.confirm("CẢNH BÁO: Xóa hàng hóa sẽ xóa luôn lịch sử Nhập/Xuất của nó. Chắc chắn xóa?")) {
            await deleteItem(id); fetchData();
        }
    };

    const handleProductRowChange = (index, field, value) => {
        const newProducts = [...transForm.products];
        newProducts[index][field] = value;
        if (field === 'inventoryId' && transForm.type === 'Nhập') {
            const selectedItem = items.find(i => i.id.toString() === value);
            if (selectedItem) newProducts[index].unitPrice = selectedItem.unitPrice || 0;
        }
        setTransForm({ ...transForm, products: newProducts });
    };
    const addProductRow = () => setTransForm({ ...transForm, products: [...transForm.products, { inventoryId: '', quantity: '', unitPrice: '' }] });
    const removeProductRow = (index) => setTransForm({ ...transForm, products: transForm.products.filter((_, i) => i !== index) });

    const handleTransSubmit = async (e) => {
        e.preventDefault();
        const validProducts = transForm.products.filter(p => p.inventoryId && p.quantity);
        if (validProducts.length === 0) return alert("Vui lòng nhập ít nhất 1 sản phẩm hợp lệ!");

        if (transForm.type === 'Xuất') {
            for (let prod of validProducts) {
                const stockItem = items.find(i => i.id.toString() === prod.inventoryId);
                if (stockItem && stockItem.expiryDate && new Date(stockItem.expiryDate) < new Date()) {
                    if (!window.confirm(`⚠️ CẢNH BÁO: Mặt hàng "${stockItem.itemName}" ĐÃ QUÁ HẠN. Bạn chắc chắn muốn xuất kho không?`)) return;
                }
            }
        }

        try {
            await createTransaction({ ...transForm, items: validProducts });
            alert(`Tạo phiếu ${transForm.type} kho thành công!`);
            setIsTransModalOpen(false); fetchData();
        } catch (error) {
            alert(error.response?.data?.message || "Lỗi tạo phiếu! (Có thể do kho không đủ số lượng)");
        }
    };
    const handleDeleteTrans = async (id) => {
        if (window.confirm("Xóa phiếu này hệ thống sẽ tự động hoàn lại số lượng vào kho. Bạn có chắc?")) {
            await deleteTransaction(id); fetchData();
        }
    };

    const filteredItems = items.filter(item => {
        return item.itemName.toLowerCase().includes(searchItem.toLowerCase()) &&
               (filterCategory === '' || item.category === filterCategory);
    }).sort((a, b) => {
        if (sortItemName === 'ASC') return a.itemName.localeCompare(b.itemName);
        if (sortItemName === 'DESC') return b.itemName.localeCompare(a.itemName);
        return 0;
    });

    const filteredTrans = transactions.filter(t => {
        const matchSearch = t.Inventory?.itemName.toLowerCase().includes(searchTrans.toLowerCase()) ||
                            t.ticketCode?.toLowerCase().includes(searchTrans.toLowerCase());
        const matchStart = startDate ? new Date(t.date) >= new Date(startDate) : true;
        const matchEnd = endDate ? new Date(t.date) <= new Date(endDate) : true;
        return matchSearch && matchStart && matchEnd;
    }).sort((a, b) => {
        return sortDate === 'DESC' ? new Date(b.date) - new Date(a.date) : new Date(a.date) - new Date(b.date);
    });

    return (
        <div className="page-wrapper" style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <style>{`
                * { box-sizing: border-box; }
                .header-section { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #bdc3c7; padding-bottom: 15px; margin-bottom: 20px; flex-wrap: wrap; gap: 10px; }
                .tab-header { display: flex; gap: 15px; margin-bottom: 15px; }
                .tab-btn { background: none; border: none; font-size: 16px; font-weight: bold; color: #7f8c8d; cursor: pointer; padding: 10px 15px; position: relative; transition: 0.3s; }
                .tab-btn:hover { color: #3498db; }
                .tab-btn.active { color: #2980b9; }
                .tab-btn.active::after { content: ''; position: absolute; bottom: -5px; left: 0; width: 100%; height: 3px; background-color: #3498db; border-radius: 3px; }
                .toolbar { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 15px; align-items: center; background: white; padding: 15px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
                .tool-input, .tool-select { padding: 8px 12px; border: 1px solid #dcdde1; border-radius: 4px; outline: none; width: 100%; }
                .btn { padding: 10px 16px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 5px; justify-content: center; }
                .btn-primary { background: #3498db; color: white; } .btn-primary:hover { background: #2980b9; }
                .btn-success { background: #27ae60; color: white; } .btn-success:hover { background: #2ecc71; }
                .btn-danger { background: #e74c3c; color: white; } .btn-danger:hover { background: #c0392b; }
                .btn-outline { background: white; color: #333; border: 1px solid #ccc; }
                
                /* ÁP DỤNG CUỘN LỒNG KÉP */
                .card-container { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; flex-direction: column; margin-bottom: 20px; }
                .table-scroll { width: 100%; overflow: auto; max-height: 60vh;}
                
                table { width: 100%; border-collapse: collapse; min-width: 1050px; }
                th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #f1f2f6; }
                th { background: #f8f9fa; color: #2c3e50; position: sticky; top: 0; z-index: 10; box-shadow: 0 2px 2px -1px rgba(0,0,0,0.1); }
                
                .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; padding: 10px; }
                .modal-content { background: white; width: 100%; max-width: 800px; max-height: 90vh; border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; }
                .modal-body { padding: 20px; overflow-y: auto; overflow-x: hidden; flex: 1; }
                .modal-footer { padding: 15px 20px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 10px; background: #f8f9fa; }
                
                .product-row { display: grid; grid-template-columns: 3fr 1fr 1.5fr 40px; gap: 10px; align-items: center; margin-bottom: 10px; background: #f8f9fa; padding: 12px; border-radius: 6px; border: 1px solid #e0e0e0; }
                @media (max-width: 600px) {
                    .product-row { grid-template-columns: 1fr; }
                    .product-row > button { justify-self: end; }
                }

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
                <h2 style={{ margin: 0, color: '#2c3e50', display: 'flex', alignItems: 'center' }}>📦 Quản Trị Kho Hàng</h2>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {canManageCategory && (
                        <button className="btn btn-outline" onClick={() => { setItemForm(initItemForm); setEditingId(null); setIsItemModalOpen(true); }}>
                            ➕ Thêm danh mục
                        </button>
                    )}
                    {canCreateReceipt && (
                        <>
                            <button className="btn btn-success" onClick={() => { 
                                setTransForm({ ...initTransForm, type: 'Nhập', reason: 'Nhập mới' }); setIsTransModalOpen(true); 
                            }}>📥 Lập Phiếu Nhập</button>
                            <button className="btn btn-danger" onClick={() => { 
                                setTransForm({ ...initTransForm, type: 'Xuất', reason: 'Bán hàng' }); setIsTransModalOpen(true); 
                            }}>📤 Lập Phiếu Xuất</button>
                        </>
                    )}
                </div>
            </div>

            <div className="tab-header">
                <button className={`tab-btn ${activeTab === 'Kho hàng' ? 'active' : ''}`} onClick={() => setActiveTab('Kho hàng')}>🏢 Danh mục Kho</button>
                <button className={`tab-btn ${activeTab === 'Đã nhập' ? 'active' : ''}`} onClick={() => setActiveTab('Đã nhập')}>📥 Lịch sử Đã Nhập</button>
                <button className={`tab-btn ${activeTab === 'Đã xuất' ? 'active' : ''}`} onClick={() => setActiveTab('Đã xuất')}>📤 Lịch sử Đã Xuất</button>
            </div>

            {activeTab === 'Kho hàng' && (
                <>
                    <div className="toolbar">
                        <input className="tool-input" style={{width: '250px'}} placeholder="🔍 Tìm theo tên..." value={searchItem} onChange={(e) => setSearchItem(e.target.value)} />
                        <select className="tool-select" style={{width: 'auto'}} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                            <option value="">-- Tất cả phân loại --</option>
                            <option value="Vật tư đầu vào">Vật tư đầu vào</option>
                            <option value="Nông sản đầu ra">Nông sản đầu ra</option>
                            <option value="Công cụ dụng cụ">Công cụ dụng cụ</option>
                        </select>
                        <select className="tool-select" style={{width: 'auto'}} value={sortItemName} onChange={(e) => setSortItemName(e.target.value)}>
                            <option value="">Mặc định (Sắp xếp theo Tên)</option>
                            <option value="ASC">Từ A - Z</option>
                            <option value="DESC">Từ Z - A</option>
                        </select>
                    </div>
                    <div className="card-container">
                        <div className="table-scroll">
                            <table>
                                <colgroup>
                                    <col style={{ width: '15%' }} /><col style={{ width: '12%' }} /><col style={{ width: '10%' }} /> 
                                    <col style={{ width: '8%' }} /><col style={{ width: '10%' }} /><col style={{ width: '10%' }} />
                                    <col style={{ width: '12%' }} /><col style={{ width: '15%' }} />
                                    {canManageCategory && <col style={{ width: '8%' }} />}
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th>Tên mặt hàng</th><th>Phân loại</th><th>Số lượng</th><th>Đơn vị</th>
                                        <th>Lô hàng</th><th>Hạn dùng</th>
                                        <th>Đơn giá gốc</th><th>Nhà cung cấp</th>
                                        {canManageCategory && <th>Hành động</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredItems.map(item => {
                                        const expiryInfo = checkExpiry(item.expiryDate);
                                        return (
                                        <tr key={item.id}>
                                            <td><b>{item.itemName}</b></td>
                                            <td><span style={{color: '#e67e22', fontWeight: 'bold'}}>{item.category}</span></td>
                                            <td><b style={{fontSize: '16px', color: '#27ae60'}}>{item.quantity}</b></td>
                                            <td><span style={{color: '#7f8c8d'}}>{item.unit}</span></td>
                                            
                                            <td><span style={{background: '#ecf0f1', padding: '2px 6px', borderRadius: '4px', fontSize: '12px'}}>{item.batchNumber || '-'}</span></td>
                                            <td style={{color: expiryInfo.color, fontWeight: 'bold', fontSize: '13px'}}>{expiryInfo.text}</td>
                                            
                                            <td>{new Intl.NumberFormat('vi-VN').format(item.unitPrice)} đ</td>
                                            <td>{item.supplier}</td>
                                            {canManageCategory && (
                                                <td>
                                                    <button onClick={() => { setItemForm(item); setEditingId(item.id); setIsItemModalOpen(true); }} style={{border: 'none', background: 'none', cursor:'pointer', marginRight: '10px'}}>✏️</button>
                                                    <button onClick={() => handleDeleteItem(item.id)} style={{border: 'none', background: 'none', cursor:'pointer'}}>🗑️</button>
                                                </td>
                                            )}
                                        </tr>
                                    )})}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {(activeTab === 'Đã nhập' || activeTab === 'Đã xuất') && (
                <>
                    <div className="toolbar">
                        <input className="tool-input" style={{width: '250px'}} placeholder="🔍 Tìm tên SP, mã phiếu..." value={searchTrans} onChange={(e) => setSearchTrans(e.target.value)} />
                        <span style={{color: '#7f8c8d', fontSize: '14px', fontWeight: 'bold'}}>Từ:</span>
                        <input className="tool-input" style={{width: 'auto'}} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        <span style={{color: '#7f8c8d', fontSize: '14px', fontWeight: 'bold'}}>Đến:</span>
                        <input className="tool-input" style={{width: 'auto'}} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                        <select className="tool-select" style={{width: 'auto'}} value={sortDate} onChange={(e) => setSortDate(e.target.value)}>
                            <option value="DESC">Thời gian: Gần nhất</option><option value="ASC">Thời gian: Xa nhất</option>
                        </select>
                    </div>
                    <div className="card-container">
                        <div className="table-scroll">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Thời gian & Mã Phiếu</th><th>Người tạo</th><th>Sản phẩm</th><th>Số lượng</th>
                                        <th>{activeTab === 'Đã nhập' ? 'Nhà cung cấp' : 'Lý do xuất'}</th>
                                        {canDeleteReceipt && <th>Hành động</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTrans.map(t => (
                                        <tr key={t.id}>
                                            <td><b>{t.date}</b><br/><small style={{color: '#95a5a6'}}>{t.ticketCode}</small></td>
                                            <td>{t.creator}</td>
                                            <td><b>{t.Inventory?.itemName}</b></td>
                                            <td><b style={{color: t.type === 'Nhập' ? '#27ae60' : '#e74c3c'}}>{t.type === 'Nhập' ? '+' : '-'}{t.quantity}</b> {t.Inventory?.unit}</td>
                                            <td>
                                                {activeTab === 'Đã nhập' ? t.supplier : (
                                                    <>
                                                        <span style={{fontWeight: 'bold'}}>{t.reason}</span> <br/>
                                                        <small>{t.note}</small>
                                                        {t.memberPhone && <><br/><small style={{color: '#3498db'}}>SĐT: {t.memberPhone}</small></>}
                                                        {t.isCredit && <span style={{marginLeft: '5px', background: '#e74c3c', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold'}}>GHI NỢ</span>}
                                                    </>
                                                )}
                                            </td>
                                            {canDeleteReceipt && (
                                                <td><button onClick={() => handleDeleteTrans(t.id)} style={{border: 'none', background: 'none', cursor:'pointer'}}>🗑️</button></td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {isItemModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{maxWidth: '500px'}}>
                        <div className="modal-header" style={{padding: '15px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between'}}>
                            <h3 style={{margin: 0}}>{editingId ? "Sửa Danh Mục" : "Tạo Danh Mục Mới"}</h3>
                            <button style={{border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer'}} onClick={() => setIsItemModalOpen(false)}>✕</button>
                        </div>
                        <form id="itemForm" onSubmit={handleItemSubmit} className="modal-body">
                            <label style={{display: 'block', marginBottom: '15px'}}><b>Tên mặt hàng:</b>
                                <input className="tool-input" style={{marginTop: '5px'}} value={itemForm.itemName} onChange={e => setItemForm({...itemForm, itemName: e.target.value})} required/>
                            </label>
                            <label style={{display: 'block', marginBottom: '15px'}}><b>Phân loại:</b>
                                <select className="tool-select" style={{marginTop: '5px'}} value={itemForm.category} onChange={e => setItemForm({...itemForm, category: e.target.value})}>
                                    <option value="Vật tư đầu vào">Vật tư đầu vào</option><option value="Nông sản đầu ra">Nông sản đầu ra</option><option value="Công cụ dụng cụ">Công cụ dụng cụ</option>
                                </select>
                            </label>
                            
                            <label style={{display: 'block', marginBottom: '15px'}}><b>Đơn vị tính:</b>
                                <select className="tool-select" style={{marginTop: '5px'}} value={itemForm.unit} onChange={e => setItemForm({...itemForm, unit: e.target.value})} required>
                                    <option value="" disabled>-- Chọn Đơn vị --</option>
                                    <option value="kg">Kilogram (kg)</option>
                                    <option value="tấn">Tấn</option>
                                    <option value="tạ">Tạ</option>
                                    <option value="yến">Yến</option>
                                    <option value="bao">Bao / Cùi</option>
                                    <option value="lít">Lít (l)</option>
                                    <option value="chai">Chai / Lọ</option>
                                    <option value="hộp">Hộp / Thùng</option>
                                    <option value="cây">Cây (Giống cây)</option>
                                    <option value="con">Con (Vật nuôi)</option>
                                    <option value="cái">Cái / Chiếc</option>
                                    <option value="gói">Gói / Túi</option>
                                </select>
                            </label>
                            
                            <label style={{display: 'block', marginBottom: '15px'}}><b>Số Lô hàng:</b>
                                <input className="tool-input" style={{marginTop: '5px'}} value={itemForm.batchNumber || ''} onChange={e => setItemForm({...itemForm, batchNumber: e.target.value})}/>
                            </label>
                            
                            <label style={{display: 'block', marginBottom: '15px'}}><b>Hạn sử dụng:</b>
                                <input className="tool-input" type="date" style={{marginTop: '5px'}} value={itemForm.expiryDate || ''} onChange={e => setItemForm({...itemForm, expiryDate: e.target.value})}/>
                            </label>

                            <label style={{display: 'block', marginBottom: '10px'}}><b>Đơn giá dự kiến (VNĐ):</b>
                                <input className="tool-input" type="number" style={{marginTop: '5px'}} value={itemForm.unitPrice} onChange={e => setItemForm({...itemForm, unitPrice: e.target.value})}/>
                            </label>
                        </form>
                        <div className="modal-footer">
                            <button className="btn btn-primary" form="itemForm" type="submit">Lưu Danh Mục</button>
                        </div>
                    </div>
                </div>
            )}

            {isTransModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header" style={{padding: '15px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between'}}>
                            <h3 style={{margin: 0, color: transForm.type === 'Nhập' ? '#27ae60' : '#e74c3c'}}>📝 LẬP PHIẾU {transForm.type.toUpperCase()} KHO</h3>
                            <button style={{border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer'}} onClick={() => setIsTransModalOpen(false)}>✕</button>
                        </div>
                        <form id="transForm" onSubmit={handleTransSubmit} className="modal-body">
                            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '25px', background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #e0e0e0'}}>
                                <div><b style={{color: '#34495e'}}>Người lập phiếu:</b> <input className="tool-input" style={{marginTop: '5px', background: '#eee'}} value={transForm.creator} disabled /></div>
                                <div><b style={{color: '#34495e'}}>Ngày lập:</b> <input type="date" className="tool-input" style={{marginTop: '5px'}} value={transForm.date} onChange={e => setTransForm({...transForm, date: e.target.value})} required/></div>
                                
                                {transForm.type === 'Nhập' ? (
                                    <div style={{gridColumn: 'span 2'}}><b style={{color: '#34495e'}}>Nhà cung cấp:</b> <input className="tool-input" style={{marginTop: '5px'}} value={transForm.supplier} onChange={e => setTransForm({...transForm, supplier: e.target.value})}/></div>
                                ) : (
                                    <>
                                        <div><b style={{color: '#34495e'}}>Lý do xuất:</b> 
                                            <select className="tool-select" style={{marginTop: '5px'}} value={transForm.reason} onChange={e => setTransForm({...transForm, reason: e.target.value})}>
                                                <option value="Bán hàng">Bán hàng</option>
                                                <option value="Xuất sử dụng">Xuất sử dụng (Canh tác)</option>
                                                <option value="Khác">Khác</option>
                                            </select>
                                        </div>
                                        
                                        {transForm.reason === 'Khác' && (
                                            <div><b style={{color: '#34495e'}}>Ghi chú lý do:</b> <input className="tool-input" style={{marginTop: '5px'}} value={transForm.note} onChange={e => setTransForm({...transForm, note: e.target.value})} required/></div>
                                        )}

                                        {transForm.reason === 'Bán hàng' && (
                                            <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                                                <div><b style={{color: '#34495e'}}>Khách hàng (Xã Viên):</b>
                                                    <select className="tool-select" style={{marginTop: '5px', border: '2px solid #3498db'}} value={transForm.memberPhone} onChange={e => setTransForm({...transForm, memberPhone: e.target.value})}>
                                                        <option value="">-- Khách lẻ ngoài HTX --</option>
                                                        {membersList.map(m => <option key={m.id} value={m.phone}>{m.name} - SĐT: {m.phone}</option>)}
                                                    </select>
                                                </div>
                                                
                                                {transForm.memberPhone && (
                                                    <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer', background: '#fad390', padding: '8px', borderRadius: '4px'}}>
                                                        <input type="checkbox" style={{width: '20px', height: '20px', marginRight: '10px'}} checked={transForm.isCredit} onChange={e => setTransForm({...transForm, isCredit: e.target.checked})} />
                                                        <b style={{color: '#d35400'}}>Cho phép mua chịu (Cộng vào ví Nợ)</b>
                                                    </label>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            <h4 style={{borderBottom: '2px solid #3498db', paddingBottom: '10px', color: '#2980b9'}}>🛒 DANH SÁCH HÀNG HÓA</h4>
                            {transForm.products.map((prod, index) => (
                                <div className="product-row" key={index}>
                                    <select className="tool-select" value={prod.inventoryId} onChange={(e) => handleProductRowChange(index, 'inventoryId', e.target.value)} required>
                                        <option value="">-- Chọn mặt hàng từ kho --</option>
                                        {items.map(item => <option key={item.id} value={item.id}>{item.itemName} (Lô: {item.batchNumber || '-'}) - Tồn: {item.quantity}</option>)}
                                    </select>
                                    <input type="number" step="0.1" className="tool-input" placeholder="Số lượng" value={prod.quantity} onChange={(e) => handleProductRowChange(index, 'quantity', e.target.value)} required />
                                    <input type="number" className="tool-input" placeholder="Đơn giá (VNĐ)" value={prod.unitPrice} onChange={(e) => handleProductRowChange(index, 'unitPrice', e.target.value)} />
                                    <button type="button" onClick={() => removeProductRow(index)} style={{background: '#ffeaa7', border: '1px solid #fdcb6e', color: '#d63031', cursor: 'pointer', fontSize: '16px', width: '100%', height: '100%', borderRadius: '4px', fontWeight: 'bold'}}>✕</button>
                                </div>
                            ))}
                            <button type="button" className="btn btn-outline" style={{width: '100%', borderStyle: 'dashed', marginTop: '10px', color: '#3498db', borderColor: '#3498db'}} onClick={addProductRow}>
                                + Thêm sản phẩm vào phiếu
                            </button>
                        </form>
                        <div className="modal-footer">
                            <button className={`btn ${transForm.type === 'Nhập' ? 'btn-success' : 'btn-danger'}`} form="transForm" type="submit">LƯU PHIẾU {transForm.type.toUpperCase()}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventory;