const Member = require('../members/member.model');
const { Inventory } = require('../inventory/inventory.model');
const FinanceTransaction = require('../finance/transaction.model');
const { Order } = require('../sales/order.model');
const ProductionLog = require('../production/productionLog.model'); 

const getDashboardStats = async () => {
    // 1. TỔNG THÀNH VIÊN & TỔNG CÔNG NỢ
    const members = await Member.findAll();
    const totalMembers = members.length;
    
    let totalDebtMaterial = 0;
    let totalDebtPurchase = 0;
    let totalAdvancePayment = 0;
    
    members.forEach(m => {
        totalDebtMaterial += Number(m.debtMaterial || 0);
        totalDebtPurchase += Number(m.debtPurchase || 0);
        totalAdvancePayment += Number(m.advancePayment || 0);
    });

    // 2. KHO HÀNG & CẢNH BÁO THÔNG MINH
    const inventory = await Inventory.findAll();
    const totalInventoryValue = inventory.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    
    const inventoryByCategory = [
        { name: 'Vật tư', value: inventory.filter(i => i.category === 'Vật tư đầu vào').length },
        { name: 'Nông sản', value: inventory.filter(i => i.category === 'Nông sản đầu ra').length },
        { name: 'Công cụ', value: inventory.filter(i => i.category === 'Công cụ dụng cụ').length }
    ];

    // Tạo danh sách cảnh báo: Tồn kho thấp (<=10) hoặc Sắp hết hạn (<= 30 ngày)
    const inventoryAlerts = [];
    const today = new Date();
    inventory.forEach(item => {
        // Cảnh báo hết hàng (Trừ công cụ dụng cụ ra)
        if (item.quantity <= 10 && item.category !== 'Công cụ dụng cụ') {
            inventoryAlerts.push({ type: 'low_stock', item: item.itemName, quantity: item.quantity, message: 'Sắp hết hàng!' });
        }
        // Cảnh báo Hạn sử dụng
        if (item.expiryDate) {
            const daysLeft = (new Date(item.expiryDate) - today) / (1000 * 60 * 60 * 24);
            if (daysLeft < 0) {
                inventoryAlerts.push({ type: 'expired', item: item.itemName, message: 'ĐÃ QUÁ HẠN!' });
            } else if (daysLeft <= 30) {
                inventoryAlerts.push({ type: 'expiring_soon', item: item.itemName, message: `Còn ${Math.ceil(daysLeft)} ngày` });
            }
        }
    });

    // 3. QUỸ THU CHI (TIỀN MẶT THỰC TẾ)
    const finances = await FinanceTransaction.findAll();
    const totalIncome = finances.filter(f => f.type === 'Thu' && f.status === 'Hoàn thành').reduce((sum, f) => sum + Number(f.amount), 0);
    const totalExpense = finances.filter(f => f.type === 'Chi' && f.status === 'Hoàn thành').reduce((sum, f) => sum + Number(f.amount), 0);
    const fundBalance = totalIncome - totalExpense;

    // 4. TỔNG DOANH THU BÁN HÀNG (Chỉ tính các đơn Bán Hàng đã giao, không tính Thu Mua)
    const sales = await Order.findAll({ where: { status: 'Đã giao', orderType: 'Bán hàng' } });
    const totalSalesRevenue = sales.reduce((sum, s) => sum + Number(s.totalAmount), 0);

    // 5. THỐNG KÊ CANH TÁC
    const totalProductionLogs = await ProductionLog.count();
    const activeCrops = await ProductionLog.count({ where: { status: 'Đang thực hiện' } });

    return {
        totalMembers,
        totalDebtMaterial,
        totalDebtPurchase,
        totalAdvancePayment,
        totalInventoryValue,
        inventoryByCategory,
        inventoryAlerts, // Data cảnh báo trả về Frontend
        totalIncome,
        totalExpense,
        fundBalance,
        totalSalesRevenue,
        totalProductionLogs,
        activeCrops
    };
};

module.exports = { getDashboardStats };