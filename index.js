const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

const PORT = 4000;
const orders = {};

const SEPAY_API_KEY = '1QUOLYUEX2PV9FPFMBTRS5GKTXHWFVDMXDYPJBHBQK4ESISLACMQYGZCIZDYNJWN';

// ✅ API tạo đơn hàng mới
app.post('/api/create-order', (req, res) => {
    const { name, amount } = req.body;

    if (!name || !amount) {
        return res.status(400).json({ message: 'Vui lòng cung cấp name và amount.' });
    }

    const orderId = `ORDER${Date.now()}`;
    const qrUrl = `https://img.vietqr.io/image/MB-0917436401-print.png?amount=${amount}&addInfo=${orderId}`;

    orders[orderId] = {
        orderId,
        name,
        amount,
        status: 'Unpaid',
        createdAt: new Date(),
    };

    console.log(`🆕 Đã tạo đơn hàng: ${orderId}`);

    res.json({
        orderId,
        qrUrl,
        status: 'pending',
    });
});

// ✅ Gọi API SePay để tìm giao dịch qua orderId
async function checkWithSePay(orderId) {
    try {
        const res = await axios.get(`https://my.sepay.vn/userapi/transactions/search?addInfo=${orderId}`, {
            headers: {
                Authorization: `Bearer ${SEPAY_API_KEY}`,
                'Content-Type': 'application/json',
            }
        });

        if (res.data?.success && res.data?.data?.length > 0) {
            return res.data.data[0]; // ✅ Trả về giao dịch đầu tiên
        } else {
            console.log(`⚠️ SePay trả về success: false hoặc không có dữ liệu cho ${orderId}`);
            return null;
        }

    } catch (err) {
        console.error('❌ Lỗi khi gọi SePay:', err.response?.data || err.message);
        return null;
    }
}

// ✅ Kiểm tra trạng thái thanh toán đơn hàng
app.post('/api/check-payment-status', async (req, res) => {
    const { orderId } = req.body;

    const order = orders[orderId];
    if (!order) {
        return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
    }

    if (order.status !== 'Paid') {
        const result = await checkWithSePay(orderId);

        if (result && result.status === 'PAID') {
            order.status = 'Paid';
            console.log(`✅ Đơn hàng ${orderId} đã thanh toán.`);
        }
    }

    res.json({
        orderId: order.orderId,
        name: order.name,
        amount: order.amount,
        status: order.status,
    });
});

// ✅ Xem tất cả đơn hàng
app.get('/api/orders', (req, res) => {
    res.json(orders);
});

// ✅ Nhận webhook từ SePay
app.post('/api/webhook', (req, res) => {
    const data = req.body;
    console.log('📩 Nhận webhook từ SePay:', data);

    const content = data.content || data.description || '';
    const transferAmount = data.transferAmount;
    const match = content.match(/ORDER\d+/);
    if (!match) {
        return res.status(400).json({ message: 'Không tìm thấy orderId trong nội dung.' });
    }

    const orderId = match[0];
    const order = orders[orderId];

    if (!order) {
        return res.status(404).json({ message: `Không tìm thấy đơn hàng với orderId: ${orderId}` });
    }

    if (transferAmount > 0 && order.status !== 'Paid') {
        order.status = 'Paid';
        console.log(`✅ Đơn hàng ${orderId} cập nhật sang Paid qua webhook.`);
    }

    res.json({ message: 'Webhook đã xử lý thành công.' });
});

app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});
