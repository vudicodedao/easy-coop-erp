import React, { useEffect, useState } from 'react';
import { getDashboardStats } from '../api/reportApi';
import { getAllMembers } from '../api/memberApi'; 
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const Dashboard = () => {
    const currentUser = JSON.parse(localStorage.getItem('user')) || {};
    const role = currentUser.role;
    const hasAccess = ['Giám đốc', 'Kế toán'].includes(role);

    const [stats, setStats] = useState({
        totalMembers: 0, totalInventoryValue: 0, inventoryByCategory: [], inventoryAlerts: [],
        totalIncome: 0, totalExpense: 0, fundBalance: 0, totalSalesRevenue: 0,
        totalDebtMaterial: 0, totalAdvancePayment: 0, totalDebtPurchase: 0,
        totalProductionLogs: 0, activeCrops: 0
    });
    
    const [capitalData, setCapitalData] = useState([]);
    const [totalCapital, setTotalCapital] = useState(0); // [THÊM MỚI] LƯU TỔNG VỐN

    useEffect(() => {
        if (!hasAccess) return; 
        const fetchStats = async () => {
            try {
                const [resStats, resMembers] = await Promise.all([
                    getDashboardStats(),
                    getAllMembers()
                ]);
                
                setStats(resStats.data);
                
                const members = resMembers.data;
                const capData = members
                    .filter(m => m.capital > 0) 
                    .map(m => ({ name: m.name, value: Number(m.capital) }))
                    .sort((a, b) => b.value - a.value); 
                
                setCapitalData(capData);
                
                // Tính tổng vốn góp
                const totalCap = capData.reduce((sum, item) => sum + item.value, 0);
                setTotalCapital(totalCap);

            } catch (error) {
                console.error("Lỗi tải số liệu tổng quan", error);
            }
        };
        fetchStats();
    }, [hasAccess]);

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

    const financeChartData = [
        { name: 'Tồn Quỹ (TM)', value: stats.fundBalance, fill: '#2980b9' },
        { name: 'Doanh Thu', value: stats.totalSalesRevenue, fill: '#8e44ad' },
        { name: 'Phải Thu (Nợ VT)', value: stats.totalDebtMaterial + stats.totalAdvancePayment, fill: '#f39c12' },
        { name: 'Phải Trả (Nợ TM)', value: stats.totalDebtPurchase, fill: '#c0392b' }
    ];

    const PIE_COLORS = ['#2ecc71', '#f39c12', '#95a5a6'];
    const PIE_COLORS_CAPITAL = ['#3498db', '#9b59b6', '#e67e22', '#1abc9c', '#e74c3c', '#34495e'];

    return (
        <div className="page-wrapper">
            <style>{`
                .page-wrapper { padding: 20px; font-family: Arial, sans-serif; background: #f4f7f6; height: 100%; overflow-y: auto; display: flex; flex-direction: column;}
                .header-title { color: #2c3e50; margin-bottom: 25px; border-bottom: 2px solid #3498db; padding-bottom: 10px; display: inline-block;}
                
                .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-bottom: 25px; }
                .kpi-card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); border-left: 5px solid #ccc; display: flex; flex-direction: column; justify-content: center; transition: 0.3s;}
                .kpi-card:hover { transform: translateY(-5px); box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
                
                .kpi-card.blue { border-left-color: #3498db; }
                .kpi-card.green { border-left-color: #2ecc71; }
                .kpi-card.yellow { border-left-color: #f1c40f; }
                .kpi-card.orange { border-left-color: #e67e22; }
                .kpi-card.red { border-left-color: #e74c3c; }
                .kpi-card.purple { border-left-color: #9b59b6; }
                .kpi-card.dark { border-left-color: #34495e; } /* Thêm màu cho Vốn góp */
                
                .kpi-title { font-size: 12px; color: #7f8c8d; text-transform: uppercase; font-weight: bold; margin-bottom: 8px; }
                .kpi-value { font-size: 24px; font-weight: bold; color: #2c3e50; }
                .kpi-sub { font-size: 12px; color: #95a5a6; margin-top: 5px; }
                
                .charts-wrapper { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; flex: 1; min-height: 450px; }
                
                .chart-box { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); display: flex; flex-direction: column; min-height: 450px; max-height: 450px; }
                .chart-title { margin-top: 0; color: #34495e; font-size: 16px; border-bottom: 1px dashed #eee; padding-bottom: 10px; margin-bottom: 15px; flex-shrink: 0; }
                
                .alert-item { padding: 12px 10px; border-bottom: 1px solid #f1f2f6; display: flex; justify-content: space-between; align-items: center; transition: 0.2s;}
                .alert-item:hover { background: #fdfefe; }

                .custom-scroll::-webkit-scrollbar { width: 6px; }
                .custom-scroll::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 4px; }
                .custom-scroll::-webkit-scrollbar-thumb { background: #bdc3c7; border-radius: 4px; }
                .custom-scroll::-webkit-scrollbar-thumb:hover { background: #95a5a6; }
                
                @media (max-width: 1200px) {
                    .charts-wrapper { grid-template-columns: 1fr 1fr; }
                }
                
                @media (max-width: 768px) {
                    .page-wrapper { padding: 15px !important; }
                    .header-title { font-size: 20px; }
                    .charts-wrapper, .kpi-grid { grid-template-columns: 1fr !important; display: grid !important;}
                    .chart-box { padding: 15px !important; width: 100%; overflow: visible; min-height: 400px;}
                }
            `}</style>

            <h2 className="header-title">📊 Bảng Tổng Quan Quản Trị ERP</h2>

            <div className="kpi-grid">
                <div className="kpi-card green">
                    <div className="kpi-title">💰 Tồn Quỹ Tiền Mặt</div>
                    <div className="kpi-value">{Number(stats.fundBalance).toLocaleString()} <span style={{fontSize: '14px', color:'#7f8c8d'}}>đ</span></div>
                </div>
                <div className="kpi-card dark">
                    <div className="kpi-title">💎 Tổng Vốn Góp (Chủ Sở Hữu)</div>
                    <div className="kpi-value">{Number(totalCapital).toLocaleString()} <span style={{fontSize: '14px', color:'#7f8c8d'}}>đ</span></div>
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

            <div className="charts-wrapper">
                
                {/* 1. Biểu đồ Cột */}
                <div className="chart-box">
                    <h3 className="chart-title">📈 Toàn Cảnh Tài Chính & Công Nợ</h3>
                    <div style={{ flex: 1, width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={financeChartData} margin={{ top: 10, right: 10, left: 0, bottom: 80 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#555'}} angle={-45} textAnchor="end" height={80} interval={0} />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} tickFormatter={(value) => new Intl.NumberFormat('vi-VN', { notation: "compact", compactDisplay: "short" }).format(value)} />
                                <Tooltip cursor={{fill: '#f4f7f6'}} formatter={(value) => new Intl.NumberFormat('vi-VN').format(value) + ' đ'} />
                                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Biểu đồ Tròn VỐN GÓP */}
                <div className="chart-box">
                    <h3 className="chart-title">💎 Tỷ Trọng Vốn Góp Xã Viên</h3>
                    <div style={{ flex: 1, width: '100%' }}>
                        {capitalData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                    <Pie data={capitalData} cx="50%" cy="45%" innerRadius={45} outerRadius={95} paddingAngle={2} dataKey="value">
                                        {capitalData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={PIE_COLORS_CAPITAL[index % PIE_COLORS_CAPITAL.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => new Intl.NumberFormat('vi-VN').format(value) + ' VNĐ'} />
                                    <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: '20px', fontSize: '12px', lineHeight: '18px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ textAlign: 'center', color: '#7f8c8d', marginTop: '100px' }}>Chưa có dữ liệu vốn góp</div>
                        )}
                    </div>
                </div>

                {/* 3. Biểu đồ Tròn KHO HÀNG */}
                <div className="chart-box">
                    <h3 className="chart-title">🍩 Cơ cấu Danh mục Kho hàng</h3>
                    <div style={{ flex: 1, width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                <Pie data={stats.inventoryByCategory} cx="50%" cy="45%" innerRadius={50} outerRadius={95} paddingAngle={5} dataKey="value">
                                    {stats.inventoryByCategory?.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => value + ' mã hàng'} />
                                <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 4. Bảng Cảnh báo */}
                <div className="chart-box">
                    <h3 className="chart-title">⚠️ Cảnh Báo Thông Minh</h3>
                    <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
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
        </div>
    );
};

export default Dashboard;