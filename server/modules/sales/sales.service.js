const { Order, OrderDetail } = require('./order.model');
const { Inventory, InventoryTransaction } = require('../inventory/inventory.model');
const FinanceTransaction = require('../finance/transaction.model'); 
const Member = require('../members/member.model'); // THÊM MỚI: Gọi bảng Member để cập nhật nợ
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
            orderType: orderType,
            customerName: data.customerName,
            phone: data.phone,
            memberPhone: data.memberPhone, // Thêm SĐT thành viên
            deliveryAddress: data.deliveryAddress,
            orderDate: data.orderDate || new Date(),
            status: data.status,
            paymentStatus: orderType === 'Thu mua' ? 'Chưa thanh toán' : data.paymentStatus, 
            advancePayment: parseFloat(data.advancePayment) || 0, // Tiền tạm ứng
            note: data.note,
            orderCode: orderCode
        }, { transaction: t });

        let totalAmount = 0;

        for (let item of data.products) {
            const product = await Inventory.findByPk(item.productId);
            if (!product) throw new Error(`Không tìm thấy sản phẩm trong kho!`);
            
            // XỬ LÝ KHO KHI "ĐÃ GIAO" (hoặc hoàn tất)
            if (data.status === 'Đã giao') {
                if (orderType === 'Bán hàng') {
                    // LOGIC BÁN HÀNG (TRỪ KHO) - GIỮ NGUYÊN
                    if (product.quantity < item.quantity) throw new Error(`Kho không đủ "${product.itemName}" (Chỉ còn: ${product.quantity})`);
                    await product.update({ quantity: product.quantity - parseFloat(item.quantity) }, { transaction: t });
                    await InventoryTransaction.create({
                        ticketCode: `PX-${Date.now()}-${item.productId}`, type: 'Xuất', creator: data.creator || 'Hệ thống',
                        date: data.orderDate || new Date(), reason: 'Bán hàng', note: `Xuất bán đơn ${orderCode}`,
                        quantity: item.quantity, unitPrice: item.price, InventoryId: item.productId
                    }, { transaction: t });
                } else if (orderType === 'Thu mua') {
                    // LOGIC THU MUA (CỘNG KHO THÀNH PHẨM)
                    await product.update({ quantity: product.quantity + parseFloat(item.quantity) }, { transaction: t });
                    await InventoryTransaction.create({
                        ticketCode: `PN-${Date.now()}-${item.productId}`, type: 'Nhập', creator: data.creator || 'Hệ thống',
                        date: data.orderDate || new Date(), reason: 'Thu mua nông sản', note: `Nhập kho từ đơn thu mua ${orderCode} (Xã viên: ${data.customerName})`,
                        quantity: item.quantity, unitPrice: item.price, InventoryId: item.productId
                    }, { transaction: t });
                }
            }

            await OrderDetail.create({
                OrderId: order.id, InventoryId: item.productId, quantity: item.quantity,
                unitPrice: item.price, unit: product.unit, quality: item.quality || null
            }, { transaction: t });

            totalAmount += item.quantity * item.price;
        }

        await order.update({ totalAmount }, { transaction: t });
        
        // ===========================================
        // XỬ LÝ THANH TOÁN VÀ CÔNG NỢ (TÁCH BIỆT 2 LUỒNG)
        // ===========================================
        if (orderType === 'Bán hàng') {
            // LOGIC BÁN HÀNG CŨ: Thu tiền
            if (data.paymentStatus === 'Đã thanh toán') {
                await FinanceTransaction.create({
                    recordDate: data.orderDate || new Date(), type: 'Thu', category: 'Bán nông sản',
                    amount: totalAmount, paymentMethod: data.paymentMethod || 'Tiền mặt', 
                    creator: data.creator || 'Hệ thống', actor: data.customerName,
                    description: `Thu tiền bán hàng đơn ${orderCode}`, referenceCode: orderCode, status: 'Hoàn thành'
                }, { transaction: t });
            }
        } else if (orderType === 'Thu mua') {
            // LOGIC THU MUA MỚI: Chi tạm ứng & Ghi nợ thành viên
            const advPayment = parseFloat(data.advancePayment) || 0;
            if (advPayment > 0) {
                // 1. Chi tiền từ Quỹ HTX
                await FinanceTransaction.create({
                    recordDate: data.orderDate || new Date(), type: 'Chi', category: 'Chi mua hàng',
                    amount: advPayment, paymentMethod: data.paymentMethod || 'Tiền mặt',
                    creator: data.creator || 'Hệ thống', actor: data.customerName,
                    description: `Chi tạm ứng thu mua nông sản đơn ${orderCode}`, referenceCode: orderCode, status: 'Hoàn thành'
                }, { transaction: t });
            }
            // 2. Ghi nợ vào ví NỢ THU MUA (Màu xanh) của thành viên
            const debtRemaining = totalAmount - advPayment;
            if (debtRemaining > 0 && data.memberPhone) {
                const member = await Member.findOne({ where: { phone: data.memberPhone } });
                if (member) {
                    await member.update({ debtPurchase: Number(member.debtPurchase) + debtRemaining }, { transaction: t });
                }
            }
        }

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

        // 1. LOGIC HỦY ĐƠN HÀNG (HOÀN TRẢ TỰ ĐỘNG CẢ 2 LOẠI)
        if (updateData.status === 'Đã hủy' && order.status !== 'Đã hủy') {
            // Hoàn Kho
            if (order.status === 'Đã giao') {
                for (let detail of order.OrderDetails) {
                    const product = await Inventory.findByPk(detail.InventoryId);
                    if (product) {
                        if (order.orderType === 'Bán hàng') {
                            await product.update({ quantity: product.quantity + detail.quantity }, { transaction: t });
                            await InventoryTransaction.create({ ticketCode: `PN-${Date.now()}`, type: 'Nhập', creator: updateData.creator, date: new Date(), reason: 'Khác', note: `Hoàn kho Hủy Đơn ${order.orderCode}`, quantity: detail.quantity, unitPrice: detail.unitPrice, InventoryId: detail.InventoryId }, { transaction: t });
                        } else if (order.orderType === 'Thu mua') {
                            await product.update({ quantity: product.quantity - detail.quantity }, { transaction: t });
                            await InventoryTransaction.create({ ticketCode: `PX-${Date.now()}`, type: 'Xuất', creator: updateData.creator, date: new Date(), reason: 'Khác', note: `Hoàn kho Hủy Đơn Thu Mua ${order.orderCode}`, quantity: detail.quantity, unitPrice: detail.unitPrice, InventoryId: detail.InventoryId }, { transaction: t });
                        }
                    }
                }
            }

            // Hoàn Tiền / Công nợ
            if (order.orderType === 'Bán hàng' && order.paymentStatus === 'Đã thanh toán') {
                await FinanceTransaction.create({ recordDate: new Date(), type: 'Chi', category: 'Chi khác', amount: order.totalAmount, paymentMethod: 'Tiền mặt', creator: updateData.creator, actor: order.customerName, description: `Hoàn tiền Hủy Đơn ${order.orderCode}`, referenceCode: order.orderCode, status: 'Hoàn thành' }, { transaction: t });
                updateData.paymentStatus = 'Chưa thanh toán'; 
            } else if (order.orderType === 'Thu mua') {
                if (order.advancePayment > 0) {
                    await FinanceTransaction.create({ recordDate: new Date(), type: 'Thu', category: 'Thu khác', amount: order.advancePayment, paymentMethod: 'Tiền mặt', creator: updateData.creator, actor: order.customerName, description: `Thu hồi tạm ứng Hủy Đơn ${order.orderCode}`, referenceCode: order.orderCode, status: 'Hoàn thành' }, { transaction: t });
                }
                const debt = order.totalAmount - order.advancePayment;
                if (debt > 0 && order.memberPhone) {
                    const member = await Member.findOne({ where: { phone: order.memberPhone } });
                    if (member) await member.update({ debtPurchase: Number(member.debtPurchase) - debt }, { transaction: t });
                }
            }
        }

        // 2. LOGIC ĐÃ GIAO (Bán hàng trừ kho, Thu mua đã cộng lúc tạo rồi nên không cần làm gì thêm ở đây trừ khi bạn muốn update lại)
        if (updateData.status === 'Đã giao' && order.status !== 'Đã giao' && order.status !== 'Đã hủy') {
            if (order.orderType === 'Bán hàng') {
                for (let detail of order.OrderDetails) {
                    const product = await Inventory.findByPk(detail.InventoryId);
                    if (product.quantity < detail.quantity) throw new Error(`Kho không đủ ${product.itemName}`);
                    await product.update({ quantity: product.quantity - detail.quantity }, { transaction: t });
                    await InventoryTransaction.create({ ticketCode: `PX-${Date.now()}`, type: 'Xuất', creator: updateData.creator, date: new Date(), reason: 'Bán hàng', note: `Xuất kho Đơn ${order.orderCode}`, quantity: detail.quantity, unitPrice: detail.unitPrice, InventoryId: detail.InventoryId }, { transaction: t });
                }
            }
        }

        // 3. LOGIC ĐÃ THANH TOÁN (CỘNG TIỀN CHO BÁN HÀNG)
        if (order.orderType === 'Bán hàng' && updateData.paymentStatus === 'Đã thanh toán' && order.paymentStatus !== 'Đã thanh toán' && order.status !== 'Đã hủy') {
            await FinanceTransaction.create({ recordDate: new Date(), type: 'Thu', category: 'Bán nông sản', amount: order.totalAmount, paymentMethod: updateData.paymentMethod || 'Tiền mặt', creator: updateData.creator, actor: order.customerName, description: `Thu tiền Đơn ${order.orderCode}`, referenceCode: order.orderCode, status: 'Hoàn thành' }, { transaction: t });
        }

        await order.update(updateData, { transaction: t });
        await t.commit();
        return order;
    } catch (error) {
        await t.rollback();
        throw error;
    }
};

const deleteOrder = async (id) => {
    return await Order.destroy({ where: { id } });
};

module.exports = { getAllOrders, createOrder, updateOrderStatus, deleteOrder };