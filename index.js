const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

const PORT = 4000;
const orders = {}; // Lưu đơn hàng tạm thời

const SEPAY_API_KEY = 'QRIL9UKEWEM1XXPCATUVVDMZ6HKBHDRM87FKLSECXJYCJNHB8AGYDLUWH0OSOONZ';

// Tạo đơn hàng mới
app.post('/api/create-order', (req, res) => {
    const { name, amount } = req.body;

    if (!name || !amount) {
        return res.status(400).json({ message: 'Vui lòng cung cấp name và amount.' });
    }

    const orderId = `ORDER_${Date.now()}`;
    const qrUrl = `https://img.vietqr.io/image/MB-0917436401-print.png?amount=${amount}&addInfo=${orderId}`;

    orders[orderId] = {
        orderId,
        name,
        amount,
        status: 'Unpaid',
        createdAt: new Date(),
    };

    res.json({
        orderId,
        qrUrl,
        status: 'pending',
    });
});

// Gọi API SePay để kiểm tra đơn hàng
async function checkWithSePay(orderId) {
    try {
        const res = await axios.get(`https://my.sepay.vn/userapi/transactions/details/${orderId}`, {
            headers: {
                Authorization: `Bearer ${SEPAY_API_KEY}`,
                'Content-Type': 'application/json',
            }
        });

        return res.data;
    } catch (err) {
        console.error(`❌ Lỗi gọi API SePay:`, err.message);
        return null;
    }
}


// Kiểm tra trạng thái đơn hàng 
app.post('/api/check-payment-status', async (req, res) => {
    const { orderId } = req.body;

    const order = orders[orderId];
    if (!order) {
        return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
    }

    // Gọi SePay kiểm tra trạng thái thanh toán
    if (order.status !== 'Paid') {
        const result = await checkWithSePay(orderId);

        if (result && result.status === 'Paid') {
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

app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});
