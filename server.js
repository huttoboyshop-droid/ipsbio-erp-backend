const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // 允许传输大文件

// 1. 连上你的专属云数据库！🔑
const DB_URL = "mongodb+srv://huttoboyshop:yy1217175801@cluster0.cwqyxkf.mongodb.net/ipsbio_erp?retryWrites=true&w=majority&appName=Cluster0";
mongoose.connect(DB_URL)
    .then(() => console.log('✅ 太牛了！成功连接到云端 MongoDB 数据库！'))
    .catch(err => console.error('❌ 数据库连接失败:', err));

// 2. 定义订单的数据模型
const orderSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    platform: String,
    buyer: String,
    address: String,
    phone: String,
    timeOrder: String,
    status: String,
    subStatus: String,
    remark: String,
    shipMethod: String,
    trackingNumber: String,
    isPrinted: Boolean,
    items: Array
}, { strict: false });

const Order = mongoose.model('Order', orderSchema);

// 3. 接口：获取所有订单
app.get('/api/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ timeOrder: -1 });
        res.json({ success: true, data: orders });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4. 接口：同步保存订单到云端
app.post('/api/orders/sync', async (req, res) => {
    try {
        const orders = req.body.orders;
        for (let orderData of orders) {
            await Order.findOneAndUpdate(
                { id: orderData.id }, 
                orderData,            
                { upsert: true, new: true } 
            );
        }
        res.json({ success: true, message: '云端同步成功' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 5. 启动服务器
app.listen(3000, () => {
    console.log('====================================');
    console.log('🚀 ERP 真实后端已启动：http://localhost:3000');
    console.log('====================================');
});