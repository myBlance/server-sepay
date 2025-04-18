require('dotenv').config(); // Load biến môi trường từ .env

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json()); // Cho phép đọc JSON từ body

const PORT = 4000;
const orders = {}; // Lưu trữ đơn hàng tạm thời trong RAM

const SEPAY_API_KEY = process.env.SEPAY_API_KEY;

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

// ✅ Gọi API SePay kiểm tra giao dịch theo addInfo (orderId)
async function checkWithSePay(orderId) {
    try {
        console.log(`🔍 Gọi SePay tìm theo addInfo: ${orderId}`);
        
        const res = await axios.get(`https://my.sepay.vn/userapi/transactions/search?addInfo=${orderId}`, {
            headers: {
                Authorization: `Bearer ${SEPAY_API_KEY}`,
                'Content-Type': 'application/json',
            }
        });

        console.log('📦 Dữ liệu trả về từ SePay:', res.data);

        const transaction = res.data?.data?.[0]; // Lấy giao dịch đầu tiên nếu có
        return transaction || null;

    } catch (err) {
        if (err.response) {
            console.error('❌ Lỗi khi gọi SePay:');
            console.error('Status:', err.response.status);
            console.error('Headers:', err.response.headers);
            console.error('Data:', err.response?.data || 'Không có dữ liệu phản hồi');
        } else {
            console.error('❌ Lỗi không có phản hồi từ SePay:', err.message);
        }
        
        return null;
    }
}

// ✅ API kiểm tra trạng thái thanh toán đơn hàng
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
            console.log(`✅ Đơn hàng ${orderId} đã thanh toán (SePay xác nhận).`);
        }
    }

    res.json({
        orderId: order.orderId,
        name: order.name,
        amount: order.amount,
        status: order.status,
    });
});

// ✅ API xem tất cả đơn hàng đang lưu
app.get('/api/orders', (req, res) => {
    res.json(orders);
});

// ✅ API nhận webhook từ SePay
app.post('/api/webhook', (req, res) => {
    const data = req.body;

    console.log('📩 Nhận webhook từ SePay:', data);

    const { addInfo, status } = data;

    if (!addInfo || !status) {
        return res.status(400).json({ message: 'Thiếu addInfo hoặc status trong dữ liệu webhook.' });
    }

    const order = orders[addInfo];
    if (!order) {
        return res.status(404).json({ message: `Không tìm thấy đơn hàng với addInfo: ${addInfo}` });
    }

    if (status === 'PAID') {
        order.status = 'Paid';
        console.log(`✅ Đơn hàng ${addInfo} đã cập nhật sang Paid qua webhook.`);
    }

    res.json({ message: 'Webhook đã xử lý thành công.' });
});

// ✅ Khởi động server
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});
