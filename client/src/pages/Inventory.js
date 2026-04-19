import React, { useEffect, useState } from 'react';
import { getAllItems, createItem, deleteItem, updateItem, getTransactions, createTransaction, deleteTransaction } from '../api/inventoryApi';
import { getAllMembers } from '../api/memberApi'; 

const Inventory = () => {
    const currentUser = JSON.parse(localStorage.getItem('user')) || {};
    const role = currentUser.role;
    const canManageCategory = role === 'Giám đốc'; 
    const canCreateReceipt = ['Giám đốc', 'Thủ kho'].includes(role); 
    const canDeleteReceipt = role === 'Giám đốc'; 

    const [activeTab, setActiveTab] = useState('Kho Vật tư'); 
    
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

    // ==========================================
    // CẤU HÌNH ARRAY ĐỂ THÊM NHIỀU DÒNG CÙNG LÚC
    // ==========================================
    const initSingleItem = { itemName: '', category: 'Vật tư đầu vào', quality: 'Tiêu chuẩn', unit: '', supplier: '', batchNumber: '', expiryDate: '', unitPrice: '' };
    const [multiItemForm, setMultiItemForm] = useState([initSingleItem]);

    const handleMultiChange = (index, field, value) => {
        const newData = [...multiItemForm];
        newData[index][field] = value;
        setMultiItemForm(newData);
    };

    const addMultiRow = () => {
        if (multiItemForm.length < 20) {
            setMultiItemForm([...multiItemForm, { ...initSingleItem, category: activeTab === 'Kho Nông sản' ? 'Nông sản đầu ra' : 'Vật tư đầu vào' }]);
        } else {
            alert("Chỉ được thêm tối đa 20 mặt hàng mỗi lần để đảm bảo hiệu suất hệ thống!");
        }
    };

    const removeMultiRow = (index) => {
        if (multiItemForm.length > 1) {
            setMultiItemForm(multiItemForm.filter((_, i) => i !== index));
        }
    };

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
            if (activeTab === 'Đã nhập' || activeTab === 'Đã xuất') setTransactions(transRes.data);
        } catch (error) { console.error("Lỗi lấy dữ liệu:", error); }
    };

    // ĐÃ FIX WARNING: Thêm comment bỏ qua cảnh báo của React
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { fetchData(); }, [activeTab]);

    const checkExpiry = (dateString) => {
        if (!dateString) return { text: '-', color: 'black' };
        const daysLeft = (new Date(dateString) - new Date()) / (1000 * 60 * 60 * 24);
        if (daysLeft < 0) return { text: 'Quá hạn', color: '#c0392b' }; 
        if (daysLeft <= 30) return { text: `Còn ${Math.ceil(daysLeft)} ngày`, color: '#e67e22' }; 
        return { text: new Date(dateString).toLocaleDateString('vi-VN'), color: '#27ae60' }; 
    };

    // ==========================================
    // LOGIC LƯU HÀNG LOẠT VÀO DATABASE
    // ==========================================
    const handleItemSubmit = async (e) => {
        e.preventDefault();
        
        try {
            if (editingId) {
                // SỬA 1 MẶT HÀNG
                const dataToSave = { ...multiItemForm[0] };
                Object.keys(dataToSave).forEach(key => { if (dataToSave[key] === '') dataToSave[key] = null; });
                await updateItem(editingId, dataToSave);
                alert("Cập nhật mặt hàng thành công!");
            } else {
                // THÊM HÀNG LOẠT
                const validItems = multiItemForm.filter(item => item.itemName.trim() !== '');
                if (validItems.length === 0) return alert("Vui lòng nhập ít nhất 1 mặt hàng hợp lệ (Phải có tên mặt hàng)!");
                
                await Promise.all(validItems.map(item => {
                    const dataToSave = { ...item };
                    Object.keys(dataToSave).forEach(key => { if (dataToSave[key] === '') dataToSave[key] = null; });
                    return createItem(dataToSave);
                }));
                alert(`Đã thêm thành công ${validItems.length} mặt hàng vào kho!`);
            }
            
            setIsItemModalOpen(false); 
            setEditingId(null); 
            fetchData();
        } catch (error) { 
            alert("Lỗi lưu hàng hóa! " + (error.response?.data?.message || "Vui lòng kiểm tra lại")); 
        }
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
        } catch (error) { alert(error.response?.data?.message || "Lỗi tạo phiếu! (Có thể do kho không đủ số lượng)"); }
    };
    
    const handleDeleteTrans = async (id) => {
        if (window.confirm("Xóa phiếu này hệ thống sẽ tự động hoàn lại số lượng vào kho. Bạn có chắc?")) {
            await deleteTransaction(id); fetchData();
        }
    };

    const filteredItems = items.filter(item => {
        const matchName = item.itemName.toLowerCase().includes(searchItem.toLowerCase());
        const matchTab = activeTab === 'Kho Nông sản' ? item.category === 'Nông sản đầu ra' : (item.category === 'Vật tư đầu vào' || item.category === 'Công cụ dụng cụ');
        const matchCat = filterCategory === '' || item.category === filterCategory;
        return matchName && matchTab && matchCat;
    }).sort((a, b) => {
        if (sortItemName === 'ASC') return a.itemName.localeCompare(b.itemName);
        if (sortItemName === 'DESC') return b.itemName.localeCompare(a.itemName);
        return 0;
    });

    const filteredTrans = transactions.filter(t => {
        const matchSearch = t.Inventory?.itemName.toLowerCase().includes(searchTrans.toLowerCase()) || t.ticketCode?.toLowerCase().includes(searchTrans.toLowerCase());
        const matchStart = startDate ? new Date(t.date) >= new Date(startDate) : true;
        const matchEnd = endDate ? new Date(t.date) <= new Date(endDate) : true;
        return matchSearch && matchStart && matchEnd;
    }).sort((a, b) => sortDate === 'DESC' ? new Date(b.date) - new Date(a.date) : new Date(a.date) - new Date(b.date));

    return (
        <div className="page-wrapper" style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <style>{`
                * { box-sizing: border-box; }
                .header-section { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #bdc3c7; padding-bottom: 15px; margin-bottom: 20px; flex-wrap: wrap; gap: 10px; flex-shrink: 0; }
                
                .tab-header { display: flex; gap: 15px; margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 10px; flex-shrink: 0; overflow-x: auto; white-space: nowrap; }
                .tab-btn { background: none; border: none; font-size: 15px; font-weight: bold; color: #7f8c8d; cursor: pointer; padding: 10px 15px; position: relative; transition: 0.3s; border-radius: 8px 8px 0 0; flex-shrink: 0; }
                .tab-btn:hover { color: #3498db; background: #f0f8ff;}
                .tab-btn.active { color: #2980b9; background: #eaf2f8;}
                .tab-btn.active::after { content: ''; position: absolute; bottom: -12px; left: 0; width: 100%; height: 3px; background-color: #3498db; border-radius: 3px; }
                
                .toolbar { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 15px; align-items: center; background: white; padding: 15px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); flex-shrink: 0; }
                .tool-input, .tool-select { padding: 8px 12px; border: 1px solid #dcdde1; border-radius: 4px; outline: none; width: 100%; }
                .btn { padding: 10px 16px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 5px; justify-content: center; }
                .btn-primary { background: #3498db; color: white; } .btn-primary:hover { background: #2980b9; }
                .btn-success { background: #27ae60; color: white; } .btn-success:hover { background: #2ecc71; }
                .btn-danger { background: #e74c3c; color: white; } .btn-danger:hover { background: #c0392b; }
                .btn-outline { background: white; color: #333; border: 1px solid #ccc; }
                
                .card-container { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; flex-direction: column; flex: 1; min-height: 0; margin-bottom: 10px; }
                .table-scroll { width: 100%; flex: 1; overflow: auto; }
                
                table { width: 100%; border-collapse: collapse; min-width: 1050px; }
                th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #f1f2f6; }
                th { background: #f8f9fa; color: #2c3e50; position: sticky; top: 0; z-index: 10; box-shadow: 0 2px 2px -1px rgba(0,0,0,0.1); }
                
                .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; padding: 10px; }
                .modal-content { background: white; border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; transition: max-width 0.3s ease; }
                .modal-body { padding: 20px; overflow-y: auto; overflow-x: hidden; flex: 1; max-height: 75vh; }
                .modal-footer { padding: 15px 20px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 10px; background: #f8f9fa; }
                
                .product-row { display: grid; grid-template-columns: 3fr 1fr 1.5fr 40px; gap: 10px; align-items: center; margin-bottom: 10px; background: #f8f9fa; padding: 12px; border-radius: 6px; border: 1px solid #e0e0e0; }
                
                /* ĐÃ FIX LẠI BẢNG NHẬP (Căn đều và ép nút X sang phải) */
                .bulk-row { 
                    display: grid; 
                    grid-template-columns: 2fr 1.3fr 1fr 1fr 1.2fr 1.2fr 1.2fr 1.5fr 40px; 
                    gap: 12px; 
                    align-items: center; 
                    margin-bottom: 10px; 
                    padding: 10px 15px; 
                    background: #f8f9fa; 
                    border-radius: 6px; 
                    border: 1px solid #e0e0e0; 
                    width: 100%;
                }
                .bulk-header { 
                    display: grid; 
                    grid-template-columns: 2fr 1.3fr 1fr 1fr 1.2fr 1.2fr 1.2fr 1.5fr 40px; 
                    gap: 12px; 
                    font-weight: bold; 
                    color: #2c3e50; 
                    margin-bottom: 10px; 
                    padding: 0 15px; 
                    width: 100%;
                }

                @media (max-width: 768px) {
                    .page-wrapper { padding: 15px !important; }
                    .header-section { flex-direction: column; align-items: flex-start !important; gap: 15px; }
                    .header-section > div, .action-buttons { width: 100%; flex-direction: column; display: flex; gap: 10px; }
                    .header-section .btn { width: 100%; justify-content: center; margin: 0 !important; padding: 12px; }
                    .toolbar { flex-direction: column; align-items: stretch !important; gap: 10px; padding: 15px 10px; }
                    .toolbar > * { width: 100% !important; margin: 0 !important; }
                    .form-grid, .modal-body > div, .product-row, .bulk-row { grid-template-columns: 1fr !important; gap: 10px; }
                    .bulk-header { display: none; }
                    .form-group-modal { flex-direction: column; align-items: flex-start; }
                    .form-label-modal { width: 100%; margin-bottom: 5px; }
                }
            `}</style>

            <div className="header-section">
                <h2 style={{ margin: 0, color: '#2c3e50', display: 'flex', alignItems: 'center' }}>📦 Quản Trị Kho Hàng</h2>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {canManageCategory && (
                        <button className="btn btn-outline" onClick={() => { 
                            setMultiItemForm([{...initSingleItem, category: activeTab === 'Kho Nông sản' ? 'Nông sản đầu ra' : 'Vật tư đầu vào'}]); 
                            setEditingId(null); 
                            setIsItemModalOpen(true); 
                        }}>
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
                <button className={`tab-btn ${activeTab === 'Kho Vật tư' ? 'active' : ''}`} onClick={() => setActiveTab('Kho Vật tư')}>🛠️ Kho Vật tư & Công cụ</button>
                <button className={`tab-btn ${activeTab === 'Kho Nông sản' ? 'active' : ''}`} onClick={() => setActiveTab('Kho Nông sản')}>🌾 Kho Nông sản</button>
                <button className={`tab-btn ${activeTab === 'Đã nhập' ? 'active' : ''}`} onClick={() => setActiveTab('Đã nhập')}>📥 Lịch sử Đã Nhập</button>
                <button className={`tab-btn ${activeTab === 'Đã xuất' ? 'active' : ''}`} onClick={() => setActiveTab('Đã xuất')}>📤 Lịch sử Đã Xuất</button>
            </div>

            {/* HIỂN THỊ KHO HÀNG */}
            {(activeTab === 'Kho Vật tư' || activeTab === 'Kho Nông sản') && (
                <>
                    <div className="toolbar">
                        <input className="tool-input" style={{width: '250px'}} placeholder="🔍 Tìm theo tên..." value={searchItem} onChange={(e) => setSearchItem(e.target.value)} />
                        {activeTab === 'Kho Vật tư' && (
                            <select className="tool-select" style={{width: 'auto'}} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                                <option value="">-- Tất cả phân loại --</option>
                                <option value="Vật tư đầu vào">Vật tư đầu vào</option>
                                <option value="Công cụ dụng cụ">Công cụ dụng cụ</option>
                            </select>
                        )}
                        <select className="tool-select" style={{width: 'auto'}} value={sortItemName} onChange={(e) => setSortItemName(e.target.value)}>
                            <option value="">Sắp xếp Tên: Mặc định</option>
                            <option value="ASC">Từ A - Z</option>
                            <option value="DESC">Từ Z - A</option>
                        </select>
                    </div>
                    <div className="card-container">
                        <div className="table-scroll">
                            <table>
                                <colgroup>
                                    <col style={{ width: '15%' }} />
                                    {activeTab === 'Kho Nông sản' && <col style={{ width: '10%' }} />}
                                    <col style={{ width: '12%' }} /><col style={{ width: '10%' }} /> 
                                    <col style={{ width: '8%' }} /><col style={{ width: '10%' }} /><col style={{ width: '10%' }} />
                                    <col style={{ width: '12%' }} /><col style={{ width: '15%' }} />
                                    {canManageCategory && <col style={{ width: '8%' }} />}
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th>Tên mặt hàng</th>
                                        {activeTab === 'Kho Nông sản' && <th>Chất lượng</th>}
                                        <th>Phân loại</th><th>Số lượng</th><th>Đơn vị</th>
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
                                            {activeTab === 'Kho Nông sản' && <td><span style={{fontWeight: 'bold', color: '#8e44ad', background: '#f5eef8', padding: '2px 8px', borderRadius: '4px'}}>{item.quality || 'Tiêu chuẩn'}</span></td>}
                                            <td><span style={{color: item.category === 'Nông sản đầu ra' ? '#27ae60' : '#e67e22', fontWeight: 'bold'}}>{item.category}</span></td>
                                            <td><b style={{fontSize: '16px', color: '#27ae60'}}>{item.quantity}</b></td>
                                            <td><span style={{color: '#7f8c8d'}}>{item.unit}</span></td>
                                            
                                            <td><span style={{background: '#ecf0f1', padding: '2px 6px', borderRadius: '4px', fontSize: '12px'}}>{item.batchNumber || '-'}</span></td>
                                            <td style={{color: expiryInfo.color, fontWeight: 'bold', fontSize: '13px'}}>{expiryInfo.text}</td>
                                            
                                            <td>{new Intl.NumberFormat('vi-VN').format(item.unitPrice || 0)} đ</td>
                                            <td>{item.supplier}</td>
                                            {canManageCategory && (
                                                <td>
                                                    <button onClick={() => { setMultiItemForm([{...item}]); setEditingId(item.id); setIsItemModalOpen(true); }} style={{border: 'none', background: 'none', cursor:'pointer', marginRight: '10px'}}>✏️</button>
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

            {/* HIỂN THỊ LỊCH SỬ NHẬP XUẤT */}
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
                                        <th>Thời gian & Mã Phiếu</th><th>Người tạo</th><th>Sản phẩm</th><th>Chất lượng</th><th>Số lượng</th>
                                        <th>{activeTab === 'Đã nhập' ? 'Nhà cung cấp' : 'Lý do xuất'}</th>
                                        {canDeleteReceipt && <th>Hành động</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTrans.map(t => (
                                        <tr key={t.id}>
                                            <td><b>{t.date}</b><br/><small style={{color: '#95a5a6'}}>{t.ticketCode}</small></td>
                                            <td>{t.creator}</td>
                                            <td><b>{t.Inventory?.itemName}</b><br/><small style={{color: '#7f8c8d'}}>Lô: {t.Inventory?.batchNumber || '-'}</small></td>
                                            <td>{t.Inventory?.category === 'Nông sản đầu ra' ? <span style={{fontWeight: 'bold', color: '#8e44ad'}}>{t.Inventory?.quality || 'Tiêu chuẩn'}</span> : '-'}</td>
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

            {/* MODAL THÊM / SỬA DANH MỤC HÀNG HÓA */}
            {isItemModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ width: '95%', maxWidth: editingId ? '500px' : '1300px' }}>
                        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', borderBottom: '1px solid #eee' }}>
                            <h3 style={{margin: 0}}>{editingId ? "Sửa Danh Mục" : `Tạo Danh Mục Mới (${multiItemForm.length}/20)`}</h3>
                            <button onClick={() => setIsItemModalOpen(false)} style={{border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer'}} >✕</button>
                        </div>
                        <form id="itemForm" onSubmit={handleItemSubmit} className="modal-body">
                            
                            {editingId ? (
                                // ---------------- FORM SỬA (GIỮ NGUYÊN GIAO DIỆN DỌC DỄ NHÌN) ----------------
                                <>
                                    <label style={{display: 'block', marginBottom: '15px'}}><b>Tên mặt hàng:</b>
                                        <input className="tool-input" style={{marginTop: '5px'}} value={multiItemForm[0].itemName} onChange={e => handleMultiChange(0, 'itemName', e.target.value)} required/>
                                    </label>
                                    <label style={{display: 'block', marginBottom: '15px'}}><b>Phân loại:</b>
                                        <select className="tool-select" style={{marginTop: '5px'}} value={multiItemForm[0].category} onChange={e => handleMultiChange(0, 'category', e.target.value)}>
                                            <option value="Vật tư đầu vào">Vật tư đầu vào</option>
                                            <option value="Công cụ dụng cụ">Công cụ dụng cụ</option>
                                            <option value="Nông sản đầu ra">Nông sản đầu ra</option>
                                        </select>
                                    </label>
                                    
                                    {/* Khóa/Làm mờ nếu không phải nông sản */}
                                    <label style={{display: 'block', marginBottom: '15px'}}><b>Phân loại chất lượng:</b>
                                        <select className="tool-select" style={{marginTop: '5px', opacity: multiItemForm[0].category !== 'Nông sản đầu ra' ? 0.3 : 1, border: multiItemForm[0].category === 'Nông sản đầu ra' ? '2px solid #8e44ad' : ''}} value={multiItemForm[0].quality || 'Tiêu chuẩn'} onChange={e => handleMultiChange(0, 'quality', e.target.value)} disabled={multiItemForm[0].category !== 'Nông sản đầu ra'}>
                                            <option value="Tiêu chuẩn">Tiêu chuẩn</option>
                                            <option value="Loại 1">Loại 1</option>
                                            <option value="Loại 2">Loại 2</option>
                                            <option value="Loại 3">Loại 3</option>
                                            <option value="Hàng dạt">Hàng dạt</option>
                                        </select>
                                    </label>
                                    
                                    <label style={{display: 'block', marginBottom: '15px'}}><b>Đơn vị tính:</b>
                                        <select className="tool-select" style={{marginTop: '5px'}} value={multiItemForm[0].unit} onChange={e => handleMultiChange(0, 'unit', e.target.value)} required>
                                            <option value="" disabled>-- Chọn Đơn vị --</option>
                                            <option value="kg">kg</option><option value="tấn">Tấn</option><option value="tạ">Tạ</option><option value="yến">Yến</option><option value="bao">Bao / Cùi</option><option value="lít">Lít</option><option value="chai">Chai / Lọ</option><option value="hộp">Hộp / Thùng</option><option value="cây">Cây giống</option><option value="con">Con</option><option value="cái">Cái / Chiếc</option><option value="gói">Gói / Túi</option>
                                        </select>
                                    </label>
                                    
                                    <label style={{display: 'block', marginBottom: '15px'}}><b>Số Lô hàng:</b>
                                        <input className="tool-input" style={{marginTop: '5px'}} value={multiItemForm[0].batchNumber || ''} onChange={e => handleMultiChange(0, 'batchNumber', e.target.value)}/>
                                    </label>
                                    
                                    <label style={{display: 'block', marginBottom: '15px'}}><b>Hạn sử dụng:</b>
                                        <input className="tool-input" type="date" style={{marginTop: '5px'}} value={multiItemForm[0].expiryDate || ''} onChange={e => handleMultiChange(0, 'expiryDate', e.target.value)}/>
                                    </label>

                                    <label style={{display: 'block', marginBottom: '15px'}}><b>Nhà cung cấp:</b>
                                        <input className="tool-input" style={{marginTop: '5px'}} value={multiItemForm[0].supplier || ''} onChange={e => handleMultiChange(0, 'supplier', e.target.value)}/>
                                    </label>

                                    <label style={{display: 'block', marginBottom: '10px'}}><b>Đơn giá gốc (VNĐ):</b>
                                        <input className="tool-input" type="number" style={{marginTop: '5px'}} value={multiItemForm[0].unitPrice || ''} onChange={e => handleMultiChange(0, 'unitPrice', e.target.value)}/>
                                    </label>
                                </>
                            ) : (
                                // ---------------- FORM THÊM HÀNG LOẠT (GIAO DIỆN NGANG TỐI ƯU CỘT & CĂN LỀ) ----------------
                                <div style={{overflowX: 'auto', paddingBottom: '10px'}}>
                                    <div style={{minWidth: '1100px', width: '100%'}}>
                                        <div className="bulk-header">
                                            <div>Tên mặt hàng (*)</div>
                                            <div>Phân loại</div>
                                            <div>Chất lượng</div>
                                            <div>Đơn vị (*)</div>
                                            <div>Số lô</div>
                                            <div>Hạn sử dụng</div>
                                            <div>Đơn giá (VNĐ)</div>
                                            <div>Nhà cung cấp</div>
                                            <div></div> {/* Cột trống cho nút Xóa */}
                                        </div>
                                        
                                        {multiItemForm.map((item, index) => (
                                            <div className="bulk-row" key={index}>
                                                <input className="tool-input" placeholder="Tên sản phẩm..." value={item.itemName} onChange={e => handleMultiChange(index, 'itemName', e.target.value)} required />
                                                
                                                <select className="tool-select" value={item.category} onChange={e => handleMultiChange(index, 'category', e.target.value)}>
                                                    <option value="Vật tư đầu vào">Vật tư đầu vào</option>
                                                    <option value="Công cụ dụng cụ">Công cụ dụng cụ</option>
                                                    <option value="Nông sản đầu ra">Nông sản đầu ra</option>
                                                </select>

                                                {/* Nút Chất lượng sẽ mờ đi nếu không phải Nông sản */}
                                                <select className="tool-select" value={item.quality || 'Tiêu chuẩn'} onChange={e => handleMultiChange(index, 'quality', e.target.value)} disabled={item.category !== 'Nông sản đầu ra'} style={{opacity: item.category !== 'Nông sản đầu ra' ? 0.3 : 1, border: item.category === 'Nông sản đầu ra' ? '2px solid #8e44ad' : ''}}>
                                                    <option value="Tiêu chuẩn">Tiêu chuẩn</option>
                                                    <option value="Loại 1">Loại 1</option>
                                                    <option value="Loại 2">Loại 2</option>
                                                    <option value="Loại 3">Loại 3</option>
                                                    <option value="Hàng dạt">Hàng dạt</option>
                                                </select>

                                                <select className="tool-select" value={item.unit} onChange={e => handleMultiChange(index, 'unit', e.target.value)} required>
                                                    <option value="" disabled>- Chọn -</option>
                                                    <option value="kg">kg</option><option value="tấn">Tấn</option><option value="tạ">Tạ</option><option value="yến">Yến</option><option value="bao">Bao</option><option value="lít">Lít</option><option value="chai">Chai</option><option value="hộp">Hộp</option><option value="cây">Cây</option><option value="con">Con</option><option value="cái">Cái</option><option value="gói">Gói</option>
                                                </select>

                                                <input className="tool-input" placeholder="Mã lô" value={item.batchNumber || ''} onChange={e => handleMultiChange(index, 'batchNumber', e.target.value)} />
                                                <input className="tool-input" type="date" value={item.expiryDate || ''} onChange={e => handleMultiChange(index, 'expiryDate', e.target.value)} />
                                                <input className="tool-input" type="number" placeholder="Giá..." value={item.unitPrice || ''} onChange={e => handleMultiChange(index, 'unitPrice', e.target.value)} />
                                                <input className="tool-input" placeholder="Nhà CC..." value={item.supplier || ''} onChange={e => handleMultiChange(index, 'supplier', e.target.value)} />
                                                
                                                <button type="button" onClick={() => removeMultiRow(index)} style={{background: '#ffeaa7', border: '1px solid #fdcb6e', color: '#d63031', cursor: 'pointer', fontSize: '16px', width: '100%', height: '100%', minHeight: '38px', borderRadius: '4px', fontWeight: 'bold'}} title="Xóa dòng này">✕</button>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    {multiItemForm.length < 20 && (
                                        <button type="button" className="btn btn-outline" style={{borderStyle: 'dashed', color: '#27ae60', borderColor: '#27ae60', width: '100%', marginTop: '10px'}} onClick={addMultiRow}>
                                            + Thêm một dòng (Đang có: {multiItemForm.length}/20)
                                        </button>
                                    )}
                                </div>
                            )}
                        </form>
                        <div className="modal-footer">
                            <button className="btn btn-primary" form="itemForm" type="submit">Lưu Danh Mục</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL LẬP PHIẾU NHẬP / XUẤT */}
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
                                        {items.map(item => (
                                            <option key={item.id} value={item.id}>
                                                {item.itemName} {item.category === 'Nông sản đầu ra' ? `(${item.quality || 'Tiêu chuẩn'})` : ''} - Tồn: {item.quantity}
                                            </option>
                                        ))}
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