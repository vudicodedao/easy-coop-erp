import React, { useEffect, useState } from 'react';
import { getDashboardStats } from '../api/reportApi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const Dashboard = () => {
    // 1. KHÓA AN TOÀN KÉP TẠI COMPONENT
    const currentUser = JSON.parse(localStorage.getItem('user')) || {};
    const role = currentUser.role;
    const hasAccess = ['Giám đốc', 'Kế toán'].includes(role);

    const [stats, setStats] = useState({
        totalMembers: 0, totalInventoryValue: 0, inventoryByCategory: [], inventoryAlerts: [],
        totalIncome: 0, totalExpense: 0, fundBalance: 0, totalSalesRevenue: 0,
        totalDebtMaterial: 0, totalAdvancePayment: 0, totalDebtPurchase: 0,
        totalProductionLogs: 0, activeCrops: 0
    });

    useEffect(() => {
        if (!hasAccess) return; 
        const fetchStats = async () => {
            try {
                const res = await getDashboardStats();
                setStats(res.data);
            } catch (error) {
                console.error("Lỗi tải số liệu tổng quan", error);
            }
        };
        fetchStats();
    }, [hasAccess]);

    // Chặn người dùng không có quyền
    if (!hasAccess) {
        return (
            <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', background: '#f0f2f5'}}>
                <div style={{background: 'white', padding: '40px', borderRadius: '8px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}>
                    <h1 style={{color: '#e74c3c', fontSize: '50px', margin: 0}}>⛔</h1>
                    <h2 style={{color: '#2c3e50'}}>Truy cập bị từ chối</h2>
                    <p style={{color: '#7f8c8d'}}>Báo cáo Tổng quan chỉ dành cho Giám đốc và Kế toán.</p>
                </div>
            </div>
        );
    }

    // Dữ liệu cho Biểu đồ Cột
    const financeChartData = [
        { name: 'Tồn Quỹ (TM)', value: stats.fundBalance, fill: '#2980b9' },
        { name: 'Doanh Thu', value: stats.totalSalesRevenue, fill: '#8e44ad' },
        { name: 'Phải Thu (Nợ VT)', value: stats.totalDebtMaterial + stats.totalAdvancePayment, fill: '#f39c12' },
        { name: 'Phải Trả (Nợ TM)', value: stats.totalDebtPurchase, fill: '#c0392b' }
    ];

    const PIE_COLORS = ['#2ecc71', '#f39c12', '#95a5a6'];

    return (
        <div className="page-wrapper">
            <style>{`
                .page-wrapper { padding: 20px; font-family: Arial, sans-serif; background: #f4f7f6; height: 100%; overflow-y: auto; display: flex; flex-direction: column;}
                .header-title { color: #2c3e50; margin-bottom: 25px; border-bottom: 2px solid #3498db; padding-bottom: 10px; display: inline-block;}
                
                /* KPI CARDS THẾ HỆ MỚI */
                .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-bottom: 25px; }
                .kpi-card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); border-left: 5px solid #ccc; display: flex; flex-direction: column; justify-content: center; transition: 0.3s;}
                .kpi-card:hover { transform: translateY(-5px); box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
                
                .kpi-card.blue { border-left-color: #3498db; }
                .kpi-card.green { border-left-color: #2ecc71; }
                .kpi-card.yellow { border-left-color: #f1c40f; }
                .kpi-card.orange { border-left-color: #e67e22; }
                .kpi-card.red { border-left-color: #e74c3c; }
                .kpi-card.purple { border-left-color: #9b59b6; }
                
                .kpi-title { font-size: 12px; color: #7f8c8d; text-transform: uppercase; font-weight: bold; margin-bottom: 8px; }
                .kpi-value { font-size: 24px; font-weight: bold; color: #2c3e50; }
                .kpi-sub { font-size: 12px; color: #95a5a6; margin-top: 5px; }
                
                /* CHARTS LAYOUT */
                .charts-wrapper { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 20px; flex: 1; min-height: 400px; }
                .chart-box { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); display: flex; flex-direction: column; min-height: 350px;}
                .chart-title { margin-top: 0; color: #34495e; font-size: 16px; border-bottom: 1px dashed #eee; padding-bottom: 10px; margin-bottom: 20px; }
                
                /* CẢNH BÁO ITEM */
                .alert-item { padding: 12px 10px; border-bottom: 1px solid #f1f2f6; display: flex; justify-content: space-between; align-items: center; transition: 0.2s;}
                .alert-item:hover { background: #fdfefe; }
                
                /* RESPONSIVE CHO LAPTOP/TABLET */
                @media (max-width: 1200px) {
                    .charts-wrapper { grid-template-columns: 1fr 1fr; }
                    .charts-wrapper .chart-box:first-child { grid-column: span 2; }
                }
                
                /* ĐOẠN CSS THẦN THÁNH BẢO VỆ MOBILE */
                @media (max-width: 768px) {
                    .page-wrapper { padding: 15px !important; }
                    .header-title { font-size: 20px; }
                    
                    /* Ép tất cả về 1 cột trên Mobile */
                    .charts-wrapper, .kpi-grid { grid-template-columns: 1fr !important; display: grid !important;}
                    .charts-wrapper .chart-box:first-child { grid-column: span 1 !important; }
                    
                    /* Cung cấp chiều cao và không gian đủ lớn cho biểu đồ SVG để nó không bị cắt */
                    .chart-box { padding: 15px !important; width: 100%; overflow: visible; min-height: 400px;}
                }
            `}</style>

            <h2 className="header-title">📊 Bảng Tổng Quan Quản Trị ERP</h2>

            {/* HÀNG 1: THẺ CHỈ SỐ NHANH */}
            <div className="kpi-grid">
                <div className="kpi-card green">
                    <div className="kpi-title">💰 Tồn Quỹ Tiền Mặt</div>
                    <div className="kpi-value">{Number(stats.fundBalance).toLocaleString()} <span style={{fontSize: '14px', color:'#7f8c8d'}}>đ</span></div>
                </div>
                <div className="kpi-card orange">
                    <div className="kpi-title">📥 Tổng Nợ Phải Thu (Xã viên nợ)</div>
                    <div className="kpi-value">{Number(stats.totalDebtMaterial + stats.totalAdvancePayment).toLocaleString()} <span style={{fontSize: '14px', color:'#7f8c8d'}}>đ</span></div>
                    <div className="kpi-sub">Gồm: Nợ Vật tư + Tiền tạm ứng</div>
                </div>
                <div className="kpi-card red">
                    <div className="kpi-title">📤 Tổng Nợ Phải Trả (HTX nợ)</div>
                    <div className="kpi-value">{Number(stats.totalDebtPurchase).toLocaleString()} <span style={{fontSize: '14px', color:'#7f8c8d'}}>đ</span></div>
                    <div className="kpi-sub">Gồm: Nợ Thu mua nông sản</div>
                </div>
                <div className="kpi-card yellow">
                    <div className="kpi-title">📦 Giá Trị Tồn Kho</div>
                    <div className="kpi-value">{Number(stats.totalInventoryValue).toLocaleString()} <span style={{fontSize: '14px', color:'#7f8c8d'}}>đ</span></div>
                </div>
                <div className="kpi-card purple">
                    <div className="kpi-title">🛒 Doanh Thu Bán Hàng</div>
                    <div className="kpi-value">{Number(stats.totalSalesRevenue).toLocaleString()} <span style={{fontSize: '14px', color:'#7f8c8d'}}>đ</span></div>
                </div>
                <div className="kpi-card blue">
                    <div className="kpi-title">👥 Tổng Thành Viên</div>
                    <div className="kpi-value">{stats.totalMembers} <span style={{fontSize: '14px', color:'#7f8c8d'}}>người</span></div>
                </div>
            </div>

            {/* HÀNG 2: BIỂU ĐỒ VÀ CẢNH BÁO */}
            <div className="charts-wrapper">
                
                {/* 1. Biểu đồ Cột - Tình hình Tài chính */}
                <div className="chart-box">
                    <h3 className="chart-title">📈 Toàn Cảnh Tài Chính & Công Nợ</h3>
                    {/* BỌC BIỂU ĐỒ VÀO THẺ DIV CÓ CHIỀU CAO CỐ ĐỊNH, TĂNG CHIỀU CAO CHO MOBILE */}
                    <div style={{ width: '100%', height: 350, minHeight: 350 }}>
                        {/* THÊM bottom: 60 ĐỂ CÓ CHỖ CHO CHỮ XOAY NGHIÊNG BÊN DƯỚI */}
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={financeChartData} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                {/* XOAY NGHIÊNG 45 ĐỘ TRỤC X ĐỂ CHỮ KHÔNG BỊ ĐÈ */}
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fontSize: 11, fill: '#555'}} 
                                    angle={-45} 
                                    textAnchor="end" 
                                    height={60} 
                                    interval={0} 
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fontSize: 12}} 
                                    tickFormatter={(value) => new Intl.NumberFormat('vi-VN', { notation: "compact", compactDisplay: "short" }).format(value)} 
                                />
                                <Tooltip cursor={{fill: '#f4f7f6'}} formatter={(value) => new Intl.NumberFormat('vi-VN').format(value) + ' đ'} />
                                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Biểu đồ Tròn - Cơ cấu Kho */}
                <div className="chart-box">
                    <h3 className="chart-title">🍩 Cơ cấu Danh mục Kho hàng</h3>
                    <div style={{ width: '100%', height: 320, minHeight: 320 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            {/* THÊM MARGIN ĐỂ KHÔNG BỊ LẸM */}
                            <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 20 }}>
                                <Pie
                                    data={stats.inventoryByCategory}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}  /* THU NHỎ LẠI BÁN KÍNH MỘT CHÚT ĐỂ HIỂN THỊ ĐỦ TRÊN MÀN NHỎ */
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {stats.inventoryByCategory?.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => value + ' mã hàng'} />
                                <Legend verticalAlign="bottom" height={36}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 3. Bảng Cảnh báo Kho Hàng */}
                <div className="chart-box" style={{ overflowY: 'auto', maxHeight: '400px' }}>
                    <h3 className="chart-title">⚠️ Cảnh Báo Thông Minh</h3>
                    {stats.inventoryAlerts && stats.inventoryAlerts.length > 0 ? (
                        <div style={{ padding: 0, margin: 0 }}>
                            {stats.inventoryAlerts.map((alert, idx) => (
                                <div className="alert-item" key={idx}>
                                    <div>
                                        <b style={{ color: '#2c3e50', fontSize: '14px' }}>{alert.item}</b>
                                        <br/>
                                        <small style={{ color: alert.type === 'expired' ? '#c0392b' : '#e67e22', fontWeight: 'bold' }}>
                                            {alert.type === 'low_stock' ? 'Tồn kho thấp' : alert.message}
                                        </small>
                                    </div>
                                    {alert.quantity !== undefined && (
                                        <span style={{ background: '#f39c12', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                                            Còn: {alert.quantity}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', color: '#7f8c8d', marginTop: '40px' }}>
                            <h1 style={{fontSize: '40px', margin: '0 0 10px 0'}}>✅</h1>
                            <b>Kho hàng an toàn!</b>
                            <p style={{fontSize: '13px'}}>Không có vật tư sắp hết hạn hay cạn kho.</p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default Dashboard;