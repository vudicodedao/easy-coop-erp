import React, { useEffect, useState } from 'react';
import { getAllOrders, createOrder, deleteOrder, updateOrder } from '../api/salesApi';
import { getAllItems } from '../api/inventoryApi';
import { getAllMembers } from '../api/memberApi'; 
import * as XLSX from 'xlsx';

const Sales = () => {
    const currentUser = JSON.parse(localStorage.getItem('user')) || {};
    const role = currentUser.role;
    // [THÊM MỚI] Biến kiểm tra Quyền Giám Đốc
    const isAdmin = role === 'Giám đốc'; 
    const canCreate = ['Giám đốc', 'Kế toán'].includes(role); 
    const canUpdateStatus = ['Giám đốc', 'Kế toán'].includes(role);
    const canDelete = role === 'Giám đốc'; 

    const [orders, setOrders] = useState([]);
    const [inventoryItems, setInventoryItems] = useState([]);
    const [membersList, setMembersList] = useState([]); 
    const [searchTerm, setSearchTerm] = useState('');
    const [filterOrderType, setFilterOrderType] = useState('All');
    const [isModalOpen, setIsModalOpen] = useState(false);

    const initialForm = { 
        orderType: 'Bán hàng', customerName: '', phone: '', memberPhone: '', 
        status: 'Chờ xử lý', paymentStatus: 'Chưa thanh toán', paymentMethod: 'Tiền mặt', 
        advancePayment: 0, marginRate: 0, vatRate: 0 
    };
    const [formData, setFormData] = useState(initialForm);
    const [selectedProducts, setSelectedProducts] = useState([{ productId: '', quantity: 1, price: 0 }]); 

    const fetchData = async () => {
        const [ordersRes, invRes, membersRes] = await Promise.all([getAllOrders(), getAllItems(), getAllMembers()]);
        setOrders(ordersRes.data);
        setInventoryItems(invRes.data.filter(item => item.category === 'Nông sản đầu ra'));
        setMembersList(membersRes.data);
    };

    useEffect(() => { fetchData(); }, []);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleMemberSelect = (e) => {
        const phone = e.target.value;
        const member = membersList.find(m => m.phone === phone);
        if (member) setFormData({ ...formData, memberPhone: phone, customerName: member.name, phone: member.phone });
        else setFormData({ ...formData, memberPhone: '', customerName: '', phone: '' });
    };

    const handleProductChange = (index, field, value) => {
        const newProducts = [...selectedProducts];
        newProducts[index][field] = value;
        if (field === 'productId') {
            const selectedItem = inventoryItems.find(item => item.id.toString() === value);
            if (selectedItem) {
                newProducts[index].price = selectedItem.unitPrice || 0;
                newProducts[index].quality = selectedItem.quality || 'Tiêu chuẩn';
            }
        }
        setSelectedProducts(newProducts);
    };
    
    const addProductRow = () => setSelectedProducts([...selectedProducts, { productId: '', quantity: 1, price: 0 }]);
    const removeProductRow = (index) => setSelectedProducts(selectedProducts.filter((_, i) => i !== index));

    const getCalculations = () => {
        const subTotal = selectedProducts.reduce((sum, item) => sum + (item.quantity * item.price), 0);
        const marginValue = formData.orderType === 'Bán hàng' ? (subTotal * (formData.marginRate || 0) / 100) : 0;
        const totalWithMargin = subTotal + marginValue;
        const vatValue = totalWithMargin * (formData.vatRate || 0) / 100;
        const totalAmount = totalWithMargin + vatValue;
        return { subTotal, marginValue, vatValue, totalAmount };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.customerName) return alert("Vui lòng nhập tên khách/xã viên!");
        if (selectedProducts.some(p => !p.productId)) return alert("Vui lòng chọn sản phẩm!");

        try {
            await createOrder({ ...formData, products: selectedProducts, creator: currentUser.fullName });
            setFormData(initialForm); setSelectedProducts([{ productId: '', quantity: 1, price: 0 }]);
            setIsModalOpen(false); fetchData();
        } catch (error) {
            alert(error.response?.data?.message || "Lỗi khi tạo đơn!");
        }
    };

    const handleQuickUpdate = async (id, field, value) => {
        if (!canUpdateStatus) return alert("Bạn không có quyền cập nhật trạng thái!");
        
        let extraData = {};
        if (field === 'paymentStatus' && value === 'Đã thanh toán') {
            const method = window.prompt("Chọn Hình thức thanh toán:\nNhập '1' cho Tiền mặt\nNhập '2' cho Chuyển khoản", "1");
            if (method === null) return; 
            extraData.paymentMethod = method === "2" ? 'Chuyển khoản' : 'Tiền mặt';
        }

        if (field === 'status' && value === 'Đã hủy') {
            if (!window.confirm("Hủy đơn hàng này sẽ tự động hoàn trả lại Kho và rút lại Tiền Quỹ / Công nợ. Tiếp tục?")) return;
        }

        try {
            await updateOrder(id, { [field]: value, creator: currentUser.fullName, ...extraData });
            fetchData();
        } catch (error) {
            alert(error.response?.data?.message || "Lỗi cập nhật! (Có thể do thiếu hàng trong kho)");
            fetchData(); 
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("CẢNH BÁO: Xóa cứng đơn hàng sẽ làm mất lịch sử (Nên dùng tính năng 'Đã hủy'). Bạn có chắc chắn xóa?")) {
            await deleteOrder(id); fetchData();
        }
    };

    const filteredOrders = orders.filter(o => 
        (o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || o.orderCode.toLowerCase().includes(searchTerm.toLowerCase())) &&
        (filterOrderType === 'All' || o.orderType === filterOrderType)
    );

    const handleExportExcel = () => {
        const dataToExport = filteredOrders.map((o, index) => {
            const productsStr = o.OrderDetails?.map(d => `${d.Inventory?.itemName} (${d.quantity} ${d.unit})`).join(', ') || '';
            return {
                "STT": index + 1, "Loại Đơn": o.orderType, "Mã Đơn": o.orderCode, "Ngày": o.orderDate,
                "Khách hàng": o.customerName, "SĐT": o.phone || '', "Hàng hóa": productsStr,
                "Tiền gốc": o.subTotal || 0, "Lãi suất (%)": o.marginRate || 0, "Thuế VAT (%)": o.vatRate || 0,
                "Tổng thu (VNĐ)": o.totalAmount, "Trạng thái": o.status, "Thanh toán": o.paymentStatus
            };
        });
        const ws = XLSX.utils.json_to_sheet(dataToExport); const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "GiaoDich"); XLSX.writeFile(wb, "Lich_Su_Giao_Dich.xlsx");
    };

    const calc = getCalculations();

    return (
        <div className="page-wrapper" style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <style>{`
                * { box-sizing: border-box; }
                .header-section { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #bdc3c7; padding-bottom: 15px; margin-bottom: 20px; }
                .toolbar { display: flex; gap: 10px; margin-bottom: 15px; background: white; padding: 15px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); align-items: center; flex-wrap: wrap;}
                .tool-input, .tool-select { padding: 8px 12px; border: 1px solid #dcdde1; border-radius: 4px; outline: none; }
                .btn { padding: 10px 16px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; color: white; background: #f39c12; transition: 0.2s; display: flex; align-items: center; justify-content: center; }
                .btn:hover { background: #e67e22; }
                .card-container { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); flex: 1; overflow: hidden; display: flex; flex-direction: column; }
                .table-scroll { width: 100%; flex: 1; overflow: auto; max-height: 80vh;}
                table { width: 100%; border-collapse: collapse; min-width: 1200px; table-layout: fixed; }
                th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #f1f2f6; word-wrap: break-word; vertical-align: top;}
                th { background: #f8f9fa; position: sticky; top: 0; z-index: 10; color: #2c3e50; box-shadow: 0 2px 2px -1px rgba(0,0,0,0.1); }
                .select-status { padding: 6px; border-radius: 4px; border: 1px solid #ccc; font-weight: bold; outline: none; cursor: pointer; width: 100%;}
                .select-status:disabled { background: #f1f2f6; cursor: not-allowed; opacity: 0.8; }
                
                .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; padding: 10px; }
                .modal-content { background: white; width: 100%; max-width: 850px; max-height: 95vh; border-radius: 8px; display: flex; flex-direction: column; }
                .modal-header { padding: 15px 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
                .modal-body { padding: 20px; overflow-y: auto; flex: 1; overflow-x: hidden; }
                .modal-footer { padding: 15px 20px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; background: #f8f9fa; gap: 10px; }
                
                .product-row { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 1fr) minmax(0, 1.5fr) 40px; gap: 10px; align-items: center; margin-bottom: 10px; background: #f8f9fa; padding: 12px; border-radius: 6px; border: 1px solid #e0e0e0; width: 100%;}
                
                .type-tab { flex: 1; padding: 12px; text-align: center; font-weight: bold; cursor: pointer; border-bottom: 3px solid transparent; transition: 0.3s; }
                .type-tab.active-sale { border-bottom: 3px solid #f39c12; color: #d35400; background: #fff8e1; }
                .type-tab.active-buy { border-bottom: 3px solid #27ae60; color: #1e8449; background: #eafaf1; }

                .filter-tab-container { display: flex; background: #ecf0f1; border-radius: 6px; padding: 3px; }
                .filter-tab { padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 14px; transition: 0.2s; border: none; background: transparent; color: #7f8c8d; }
                .filter-tab.active { background: white; color: #2c3e50; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            `}</style>

            <div className="header-section">
                <h2 style={{ margin: 0, color: '#2c3e50' }}>🛒 Quản lý Bán hàng & Thu mua</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn" style={{background: 'white', color: '#333', border: '1px solid #ccc'}} onClick={handleExportExcel}>📥 Xuất Excel</button>
                    {canCreate && <button className="btn" onClick={() => { 
                        setFormData({...initialForm, status: 'Chờ xử lý'}); setIsModalOpen(true); 
                    }}>+ Tạo Phiếu Mới</button>}
                </div>
            </div>

            <div className="toolbar">
                <input className="tool-input" style={{width: '350px'}} placeholder="🔍 Tìm theo Tên khách hàng, Mã đơn..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                <div className="filter-tab-container">
                    <button className={`filter-tab ${filterOrderType === 'All' ? 'active' : ''}`} onClick={() => setFilterOrderType('All')}>Tất cả</button>
                    <button className={`filter-tab ${filterOrderType === 'Bán hàng' ? 'active' : ''}`} onClick={() => setFilterOrderType('Bán hàng')}>🛒 Bán hàng</button>
                    <button className={`filter-tab ${filterOrderType === 'Thu mua' ? 'active' : ''}`} onClick={() => setFilterOrderType('Thu mua')}>📥 Thu mua</button>
                </div>
            </div>

            <div className="card-container">
                <div className="table-scroll">
                    <table>
                        <colgroup>
                            <col style={{ width: '13%' }} /><col style={{ width: '13%' }} /><col style={{ width: '22%' }} /><col style={{ width: '18%' }} /><col style={{ width: '15%' }} /><col style={{ width: '14%' }} />
                            {canDelete && <col style={{ width: '5%' }} />}
                        </colgroup>
                        <thead>
                            <tr>
                                <th>Mã đơn & Loại</th><th>Khách / Xã Viên</th><th>Chi tiết hàng hóa</th><th>Kế toán (VNĐ)</th><th>Trạng thái (Kho)</th><th>Thanh toán (Sổ Quỹ)</th>
                                {canDelete && <th></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredOrders.length > 0 ? filteredOrders.map((order) => (
                                <tr key={order.id} style={{backgroundColor: order.orderType === 'Thu mua' ? '#fdfefe' : '#fff'}}>
                                    <td>
                                        <span style={{padding: '3px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', backgroundColor: order.orderType === 'Thu mua' ? '#eafaf1' : '#fef5e7', color: order.orderType === 'Thu mua' ? '#27ae60' : '#f39c12'}}>
                                            {order.orderType === 'Thu mua' ? '📥 THU MUA' : '🛒 BÁN HÀNG'}
                                        </span><br/>
                                        <b style={{marginTop: '5px', display: 'inline-block'}}>{order.orderCode}</b><br/>
                                        <small style={{color: '#7f8c8d'}}>{order.orderDate}</small>
                                    </td>
                                    <td><b>{order.customerName}</b><br/><small>{order.phone}</small></td>
                                    <td>
                                        <ul style={{ margin: 0, paddingLeft: '15px', fontSize: '13px' }}>
                                            {order.OrderDetails?.map(detail => (
                                                <li key={detail.id}>{detail.Inventory?.itemName}: {detail.quantity} {detail.unit} x {detail.unitPrice.toLocaleString()}</li>
                                            ))}
                                        </ul>
                                    </td>
                                    <td>
                                        <div style={{fontSize: '12px', lineHeight: '1.4'}}>
                                            Gốc: {Number(order.subTotal).toLocaleString()}đ<br/>
                                            {order.marginRate > 0 && <span style={{color: '#f39c12'}}>+ Lãi ({order.marginRate}%): {Number(order.subTotal * order.marginRate / 100).toLocaleString()}đ<br/></span>}
                                            {order.vatRate > 0 && <span style={{color: '#e74c3c'}}>+ VAT ({order.vatRate}%): {Number((order.subTotal + (order.subTotal * order.marginRate / 100)) * order.vatRate / 100).toLocaleString()}đ<br/></span>}
                                            <b style={{ color: order.orderType === 'Thu mua' ? '#27ae60' : '#8e44ad', fontSize: '15px' }}>Tổng: {Number(order.totalAmount).toLocaleString()}đ</b>
                                            {order.orderType === 'Thu mua' && order.advancePayment > 0 && (
                                                <div style={{color: '#2980b9'}}>Đã ứng: {Number(order.advancePayment).toLocaleString()}đ</div>
                                            )}
                                        </div>
                                    </td>
                                    
                                    <td>
                                        <select 
                                            className="select-status" 
                                            disabled={!canUpdateStatus || order.status === 'Đã hủy'} 
                                            style={{ color: (order.status === 'Đã giao' || order.status === 'Hoàn tất cân & Nhập kho') ? '#27ae60' : order.status === 'Đã hủy' ? '#e74c3c' : '#f39c12' }} 
                                            value={order.status} 
                                            onChange={(e) => handleQuickUpdate(order.id, 'status', e.target.value)}
                                        >
                                            {order.orderType === 'Bán hàng' ? (
                                                <>
                                                    {/* KHÓA LÙI TRẠNG THÁI (Chỉ hiện nếu chưa giao) */}
                                                    {order.status !== 'Đã giao' && <option value="Chờ xử lý">Chờ xử lý (Chưa trừ kho)</option>}
                                                    {order.status !== 'Đã giao' && <option value="Đang giao">Đang giao</option>}
                                                    <option value="Đã giao">Đã giao (Trừ kho)</option>
                                                </>
                                            ) : (
                                                <>
                                                    {order.status !== 'Hoàn tất cân & Nhập kho' && <option value="Chờ cân">Chờ cân (Chưa nhập kho)</option>}
                                                    {order.status !== 'Hoàn tất cân & Nhập kho' && <option value="Đang xử lý">Đang xử lý</option>}
                                                    <option value="Hoàn tất cân & Nhập kho">Hoàn tất (Nhập kho)</option>
                                                </>
                                            )}

                                            {/* PHÂN QUYỀN HỦY: Kế toán chỉ hủy được khi Đơn chưa hoàn tất. Giám đốc có toàn quyền hủy. */}
                                            {((order.status !== 'Đã giao' && order.status !== 'Hoàn tất cân & Nhập kho') || isAdmin || order.status === 'Đã hủy') && (
                                                <option value="Đã hủy">Đã hủy</option>
                                            )}
                                        </select>
                                    </td>

                                    <td>
                                        {order.orderType === 'Bán hàng' ? (
                                            <select 
                                                className="select-status" 
                                                disabled={!canUpdateStatus || order.paymentStatus === 'Đã thanh toán' || order.status === 'Đã hủy'} 
                                                style={{ color: order.paymentStatus === 'Đã thanh toán' ? '#27ae60' : '#e74c3c' }} 
                                                value={order.paymentStatus} 
                                                onChange={(e) => handleQuickUpdate(order.id, 'paymentStatus', e.target.value)}
                                            >
                                                <option value="Chưa thanh toán">Chưa thu tiền</option>
                                                <option value="Đã thanh toán">Đã thu (Vào sổ quỹ)</option>
                                            </select>
                                        ) : (
                                            <span style={{fontSize: '12px', fontWeight: 'bold', color: '#3498db'}}>Hệ thống Đối trừ Công nợ</span>
                                        )}
                                    </td>

                                    {canDelete && <td><button onClick={() => handleDelete(order.id)} style={{background:'none', border:'none', cursor:'pointer', fontSize:'16px'}}>🗑️</button></td>}
                                </tr>
                            )) : <tr><td colSpan="7" style={{textAlign: 'center', padding: '30px', color: '#7f8c8d'}}>Không tìm thấy dữ liệu!</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3 style={{ margin: 0, color: '#2c3e50' }}>📝 Tạo Phiếu Mới</h3>
                            <button style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#999' }} onClick={() => setIsModalOpen(false)}>✕</button>
                        </div>
                        
                        <div style={{ display: 'flex', borderBottom: '1px solid #ccc' }}>
                            <div className={`type-tab ${formData.orderType === 'Bán hàng' ? 'active-sale' : ''}`} onClick={() => setFormData({...initialForm, orderType: 'Bán hàng', status: 'Chờ xử lý'})}>🛒 LẬP ĐƠN BÁN HÀNG</div>
                            <div className={`type-tab ${formData.orderType === 'Thu mua' ? 'active-buy' : ''}`} onClick={() => setFormData({...initialForm, orderType: 'Thu mua', status: 'Chờ cân'})}>🌾 LẬP PHIẾU THU MUA</div>
                        </div>

                        <div className="modal-body">
                            <form id="salesForm" onSubmit={handleSubmit}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #eee' }}>
                                    
                                    {formData.orderType === 'Thu mua' && (
                                        <label style={{display:'block', gridColumn: 'span 2'}}>
                                            <b style={{color: '#27ae60'}}>QUÉT MÃ QR / Chọn Xã viên để thu mua:</b>
                                            <select className="tool-select" style={{width:'100%', marginTop:'5px', border: '2px solid #27ae60'}} value={formData.memberPhone} onChange={handleMemberSelect} required>
                                                <option value="">-- Chọn danh sách xã viên --</option>
                                                {membersList.map(m => <option key={m.id} value={m.phone}>{m.name} - SĐT: {m.phone}</option>)}
                                            </select>
                                        </label>
                                    )}

                                    <label style={{display:'block'}}><b>Tên {formData.orderType === 'Thu mua' ? 'Xã viên' : 'Khách hàng'}:</b><input className="tool-input" style={{width:'100%', marginTop:'5px'}} name="customerName" value={formData.customerName} onChange={handleChange} required disabled={formData.orderType === 'Thu mua'} /></label>
                                    <label style={{display:'block'}}><b>Số điện thoại:</b><input className="tool-input" style={{width:'100%', marginTop:'5px'}} name="phone" value={formData.phone} onChange={handleChange} disabled={formData.orderType === 'Thu mua'} /></label>
                                    
                                    <label style={{display:'block'}}><b>Trạng thái Khởi tạo:</b>
                                        <select className="tool-select" style={{width:'100%', marginTop:'5px', fontWeight: 'bold'}} name="status" value={formData.status} onChange={handleChange}>
                                            {formData.orderType === 'Bán hàng' ? (
                                                <><option value="Chờ xử lý">Chờ xử lý</option><option value="Đã giao">Giao ngay (Trừ kho)</option></>
                                            ) : (
                                                <><option value="Chờ cân">Chờ cân</option><option value="Hoàn tất cân & Nhập kho">Hoàn tất (Nhập kho)</option></>
                                            )}
                                        </select>
                                    </label>
                                    
                                    {formData.orderType === 'Bán hàng' ? (
                                        <label style={{display:'block'}}><b>Thanh toán:</b>
                                            <select className="tool-select" style={{width:'100%', marginTop:'5px'}} name="paymentStatus" value={formData.paymentStatus} onChange={handleChange}>
                                                <option value="Chưa thanh toán">Chưa thanh toán</option><option value="Đã thanh toán">Thanh toán ngay (Vào Sổ Quỹ)</option>
                                            </select>
                                        </label>
                                    ) : (
                                        <label style={{display:'block', background: '#fff3e0', padding: '10px', borderRadius: '4px', border: '1px solid #f39c12'}}>
                                            <b style={{color: '#d35400'}}>Tiền mặt Tạm ứng ngay (VNĐ):</b>
                                            <input type="number" className="tool-input" style={{width:'100%', marginTop:'5px'}} name="advancePayment" value={formData.advancePayment} onChange={handleChange} placeholder="Đưa tiền mặt bao nhiêu?" />
                                        </label>
                                    )}
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', background: '#ecf0f1', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                                    {formData.orderType === 'Bán hàng' && (
                                        <label><b>Tỷ suất Lợi nhuận (% Margin):</b>
                                            <input type="number" step="0.1" className="tool-input" style={{width:'100%', marginTop:'5px'}} name="marginRate" value={formData.marginRate} onChange={handleChange} placeholder="Vd: 10" />
                                        </label>
                                    )}
                                    <label><b>Thuế VAT (%):</b>
                                        <input type="number" step="0.1" className="tool-input" style={{width:'100%', marginTop:'5px'}} name="vatRate" value={formData.vatRate} onChange={handleChange} placeholder="Vd: 8" />
                                    </label>
                                </div>

                                <h4 style={{borderBottom: '2px solid #f39c12', paddingBottom: '10px', color: '#e67e22'}}>🛒 CHỌN NÔNG SẢN {formData.orderType.toUpperCase()}</h4>
                                {selectedProducts.map((prod, index) => (
                                    <div className="product-row" key={index}>
                                        <select className="tool-select" value={prod.productId} onChange={(e) => handleProductChange(index, 'productId', e.target.value)} required>
                                            <option value="">-- Chọn nông sản --</option>
                                            {inventoryItems.map(item => (
                                                <option key={item.id} value={item.id}>
                                                    {item.itemName} ({item.quality || 'Tiêu chuẩn'}) - Giá vốn: {new Intl.NumberFormat('vi-VN').format(item.unitPrice)}đ
                                                </option>
                                            ))}
                                        </select>
                                        <input type="number" step="0.1" className="tool-input" placeholder="SL" value={prod.quantity} onChange={(e) => handleProductChange(index, 'quantity', e.target.value)} required />
                                        <input type="number" className="tool-input" placeholder="Đơn giá GỐC" value={prod.price} onChange={(e) => handleProductChange(index, 'price', e.target.value)} required />
                                        <button type="button" onClick={() => removeProductRow(index)} style={{background: '#ffeaa7', border: '1px solid #fdcb6e', color: '#d63031', cursor: 'pointer', fontSize: '16px', width: '100%', height: '100%', borderRadius: '4px', fontWeight: 'bold'}}>✕</button>
                                    </div>
                                ))}
                                <button type="button" style={{ width: '100%', padding: '10px', background: 'white', border: '1px dashed #f39c12', color: '#f39c12', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer' }} onClick={addProductRow}>
                                    + Thêm hàng hóa vào danh sách
                                </button>
                                
                                <div style={{ textAlign: 'right', marginTop: '20px', padding: '15px', background: '#f4f6f7', borderRadius: '8px' }}>
                                    <div style={{color: '#7f8c8d', marginBottom: '5px'}}>Tiền hàng gốc: {Number(calc.subTotal).toLocaleString()} VNĐ</div>
                                    {formData.orderType === 'Bán hàng' && <div style={{color: '#f39c12', marginBottom: '5px'}}>+ Lợi nhuận ({formData.marginRate}%): {Number(calc.marginValue).toLocaleString()} VNĐ</div>}
                                    <div style={{color: '#e74c3c', marginBottom: '10px'}}>+ Thuế VAT ({formData.vatRate}%): {Number(calc.vatValue).toLocaleString()} VNĐ</div>
                                    
                                    <h3 style={{ margin: '10px 0', color: '#2c3e50', fontSize: '22px' }}>TỔNG THANH TOÁN: {Number(calc.totalAmount).toLocaleString()} VNĐ</h3>
                                    
                                    {formData.orderType === 'Thu mua' && (
                                        <>
                                            <h4 style={{ margin: '0 0 10px 0', color: '#e67e22' }}>Đã chi tạm ứng: - {Number(formData.advancePayment).toLocaleString()} VNĐ</h4>
                                            <h3 style={{ margin: 0, color: '#27ae60' }}>Ghi nợ tự động: {Math.max(0, calc.totalAmount - Number(formData.advancePayment)).toLocaleString()} VNĐ</h3>
                                        </>
                                    )}
                                </div>
                            </form>
                        </div>
                        <div className="modal-footer">
                            <button type="button" style={{padding: '10px 16px', background: '#f1f3f4', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'}} onClick={() => setIsModalOpen(false)}>Hủy</button>
                            <button form="salesForm" type="submit" className="btn" style={{background: formData.orderType === 'Thu mua' ? '#27ae60' : '#f39c12'}}>
                                {formData.orderType === 'Thu mua' ? 'LƯU PHIẾU THU MUA' : 'LƯU ĐƠN BÁN HÀNG'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sales;