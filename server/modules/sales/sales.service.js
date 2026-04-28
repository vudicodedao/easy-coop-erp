const { Order, OrderDetail } = require('./order.model');
const { Inventory, InventoryTransaction } = require('../inventory/inventory.model');
const FinanceTransaction = require('../finance/transaction.model'); 
const Member = require('../members/member.model'); 
const { sequelize } = require('../../config/db');

const getAllOrders = async () => {
    return await Order.findAll({
        include: [{ model: OrderDetail, include: [Inventory] }], 
        order: [['createdAt', 'DESC']]
    });
};

const createOrder = async (data) => {
    const t = await sequelize.transaction();
    try {
        const orderType = data.orderType || 'Bán hàng';
        const orderCode = orderType === 'Thu mua' ? `TM-${Date.now()}` : `DH-${Date.now()}`;
        
        const order = await Order.create({
            orderType: orderType, customerName: data.customerName, phone: data.phone,
            memberPhone: data.memberPhone, deliveryAddress: data.deliveryAddress,
            orderDate: data.orderDate || new Date(),
            status: data.status, 
            paymentStatus: orderType === 'Thu mua' ? 'Chưa thanh toán' : data.paymentStatus, 
            advancePayment: parseFloat(data.advancePayment) || 0, 
            marginRate: parseFloat(data.marginRate) || 0,
            vatRate: parseFloat(data.vatRate) || 0,
            note: data.note, orderCode: orderCode
        }, { transaction: t });

        let subTotal = 0;

        for (let item of data.products) {
            const product = await Inventory.findByPk(item.productId);
            if (!product) throw new Error(`Sản phẩm đã chọn không tồn tại trong kho!`);
            
            await OrderDetail.create({
                OrderId: order.id, InventoryId: item.productId, quantity: item.quantity,
                unitPrice: item.price, unit: product.unit, quality: item.quality || null
            }, { transaction: t });
            
            subTotal += item.quantity * item.price;
        }

        const margin = orderType === 'Bán hàng' ? (subTotal * order.marginRate / 100) : 0;
        const totalWithMargin = subTotal + margin;
        const totalAmount = totalWithMargin + (totalWithMargin * order.vatRate / 100);

        await order.update({ subTotal, totalAmount }, { transaction: t });

        // ========================================================
        // [VÁ LỖI CẤP ERP] - LƯU TẠM ỨNG NGAY KHI LẬP ĐƠN
        // ========================================================
        if (orderType === 'Thu mua' && order.advancePayment > 0) {
            await FinanceTransaction.create({ 
                recordDate: order.orderDate, type: 'Chi', category: 'Chi ứng trước', 
                amount: order.advancePayment, paymentMethod: 'Tiền mặt', 
                creator: data.creator || 'Hệ thống', actor: order.customerName, memberPhone: order.memberPhone,
                description: `Chi tạm ứng lúc lập đơn thu mua ${orderCode}`, referenceCode: orderCode, status: 'Hoàn thành' 
            }, { transaction: t });
            
            // Đồng thời cộng vào ví Tạm Ứng của Xã Viên
            if (order.memberPhone) {
                const member = await Member.findOne({ where: { phone: order.memberPhone } });
                if (member) await member.update({ advancePayment: Number(member.advancePayment) + order.advancePayment }, { transaction: t });
            }
        }
        
        await executeStatusTriggers(order, data.status, data.paymentStatus, data, t, false);

        await t.commit();
        return order;
    } catch (error) {
        await t.rollback();
        throw error;
    }
};

const updateOrderStatus = async (id, updateData) => {
    const t = await sequelize.transaction();
    try {
        const order = await Order.findByPk(id, { include: [OrderDetail] });
        if (!order) throw new Error("Không tìm thấy đơn hàng");

        const isCurrentlyCompleted = (order.status === 'Đã giao' || order.status === 'Hoàn tất cân & Nhập kho');
        const isAttemptingToRevertStatus = (updateData.status && ['Chờ xử lý', 'Đang giao', 'Chờ cân', 'Đang xử lý'].includes(updateData.status));
        
        if (isCurrentlyCompleted && isAttemptingToRevertStatus) {
            throw new Error("⛔ KHÓA ERP: Không thể lùi trạng thái khi đơn đã chốt Kho. Vui lòng chọn 'Đã hủy' để hệ thống tự động hoàn Kho & Tiền!");
        }

        if (order.paymentStatus === 'Đã thanh toán' && updateData.paymentStatus === 'Chưa thanh toán' && updateData.status !== 'Đã hủy') {
            throw new Error("⛔ KHÓA ERP: Tiền đã vào Sổ Quỹ. Không thể sửa về Chưa thanh toán. Vui lòng Hủy đơn để rút quỹ!");
        }

        if (updateData.status === 'Đã hủy' && order.status !== 'Đã hủy') {
            await reverseOrderTriggers(order, updateData.creator, t);
            updateData.paymentStatus = 'Chưa thanh toán'; 
        }

        if (order.status !== 'Đã hủy') {
            await executeStatusTriggers(order, updateData.status || order.status, updateData.paymentStatus || order.paymentStatus, updateData, t, true);
        }

        await order.update(updateData, { transaction: t });
        await t.commit();
        return order;
    } catch (error) {
        await t.rollback();
        throw error;
    }
};

const executeStatusTriggers = async (order, newStatus, newPaymentStatus, reqData, t, isUpdate = false) => {
    const isCompletedStatus = (newStatus === 'Đã giao' || newStatus === 'Hoàn tất cân & Nhập kho');
    const wasNotCompleted = (order.status !== 'Đã giao' && order.status !== 'Hoàn tất cân & Nhập kho');

    if (isCompletedStatus && (!isUpdate || wasNotCompleted)) {
        const details = order.OrderDetails || await OrderDetail.findAll({ where: { OrderId: order.id } });
        
        for (let detail of details) {
            const product = await Inventory.findByPk(detail.InventoryId);
            if (!product) throw new Error("Mặt hàng trong đơn không còn tồn tại trong kho!"); 

            if (order.orderType === 'Bán hàng') {
                // ĐÃ FIX BẮT LỖI TẬN GỐC TẠI ĐÂY
                if (product.quantity < detail.quantity) {
                    throw new Error(`Kho không đủ [${product.itemName}]. Bạn muốn giao ${detail.quantity} nhưng kho chỉ còn ${product.quantity} ${product.unit}`);
                }
                
                await product.update({ quantity: product.quantity - detail.quantity }, { transaction: t });
                await InventoryTransaction.create({ ticketCode: `PX-${Date.now()}-${detail.InventoryId}`, type: 'Xuất', creator: reqData.creator || 'Hệ thống', date: new Date(), reason: 'Bán hàng', note: `Xuất bán đơn ${order.orderCode}`, quantity: detail.quantity, unitPrice: detail.unitPrice, InventoryId: detail.InventoryId }, { transaction: t });
            } else {
                await product.update({ quantity: product.quantity + detail.quantity }, { transaction: t });
                await InventoryTransaction.create({ ticketCode: `PN-${Date.now()}-${detail.InventoryId}`, type: 'Nhập', creator: reqData.creator || 'Hệ thống', date: new Date(), reason: 'Thu mua nông sản', note: `Nhập kho thu mua ${order.orderCode}`, quantity: detail.quantity, unitPrice: detail.unitPrice, InventoryId: detail.InventoryId }, { transaction: t });
            }
        }

        // Với Thu mua: Đã nhập kho thì mới bắt đầu Ghi nợ Thu Mua cho Xã viên
        if (order.orderType === 'Thu mua') {
            const advPayment = parseFloat(order.advancePayment) || 0;
            const debtRemaining = order.totalAmount - advPayment;
            if (debtRemaining > 0 && order.memberPhone) {
                const member = await Member.findOne({ where: { phone: order.memberPhone } });
                if (member) await member.update({ debtPurchase: Number(member.debtPurchase) + debtRemaining }, { transaction: t });
            }
        }
    }

    if (order.orderType === 'Bán hàng' && newPaymentStatus === 'Đã thanh toán' && (!isUpdate || order.paymentStatus !== 'Đã thanh toán')) {
        await FinanceTransaction.create({ recordDate: new Date(), type: 'Thu', category: 'Bán nông sản', amount: order.totalAmount, paymentMethod: reqData.paymentMethod || 'Tiền mặt', creator: reqData.creator || 'Hệ thống', actor: order.customerName, description: `Thu tiền Đơn ${order.orderCode}`, referenceCode: order.orderCode, status: 'Hoàn thành' }, { transaction: t });
    }
};

const reverseOrderTriggers = async (order, creator, t) => {
    if (order.status === 'Đã giao' || order.status === 'Hoàn tất cân & Nhập kho') {
        for (let detail of order.OrderDetails) {
            const product = await Inventory.findByPk(detail.InventoryId);
            if (product) {
                if (order.orderType === 'Bán hàng') {
                    await product.update({ quantity: product.quantity + detail.quantity }, { transaction: t });
                    await InventoryTransaction.create({ ticketCode: `PN-HOAN-${Date.now()}`, type: 'Nhập', creator: creator, date: new Date(), reason: 'Khác', note: `Hoàn kho Hủy Đơn ${order.orderCode}`, quantity: detail.quantity, unitPrice: detail.unitPrice, InventoryId: detail.InventoryId }, { transaction: t });
                } else {
                    await product.update({ quantity: product.quantity - detail.quantity }, { transaction: t });
                    await InventoryTransaction.create({ ticketCode: `PX-HOAN-${Date.now()}`, type: 'Xuất', creator: creator, date: new Date(), reason: 'Khác', note: `Hủy nhập kho Thu Mua ${order.orderCode}`, quantity: detail.quantity, unitPrice: detail.unitPrice, InventoryId: detail.InventoryId }, { transaction: t });
                }
            }
        }
    }

    if (order.orderType === 'Bán hàng' && order.paymentStatus === 'Đã thanh toán') {
        await FinanceTransaction.create({ recordDate: new Date(), type: 'Chi', category: 'Chi khác', amount: order.totalAmount, paymentMethod: 'Tiền mặt', creator: creator, actor: order.customerName, description: `Hoàn tiền Hủy Đơn ${order.orderCode}`, referenceCode: order.orderCode, status: 'Hoàn thành' }, { transaction: t });
    } else if (order.orderType === 'Thu mua') {
        if (order.advancePayment > 0) {
            await FinanceTransaction.create({ recordDate: new Date(), type: 'Thu', category: 'Thu hồi tạm ứng', amount: order.advancePayment, paymentMethod: 'Tiền mặt', creator: creator, actor: order.customerName, memberPhone: order.memberPhone, description: `Thu hồi tạm ứng Hủy Đơn ${order.orderCode}`, referenceCode: order.orderCode, status: 'Hoàn thành' }, { transaction: t });
            if (order.memberPhone) {
                const member = await Member.findOne({ where: { phone: order.memberPhone } });
                if (member) await member.update({ advancePayment: Math.max(0, Number(member.advancePayment) - order.advancePayment) }, { transaction: t });
            }
        }
        if (order.status === 'Hoàn tất cân & Nhập kho') {
            const debt = order.totalAmount - order.advancePayment;
            if (debt > 0 && order.memberPhone) {
                const member = await Member.findOne({ where: { phone: order.memberPhone } });
                if (member) await member.update({ debtPurchase: Math.max(0, Number(member.debtPurchase) - debt) }, { transaction: t });
            }
        }
    }
};

const deleteOrder = async (id) => { return await Order.destroy({ where: { id } }); };
module.exports = { getAllOrders, createOrder, updateOrderStatus, deleteOrder };