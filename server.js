const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // 密码加密插件
const jwt = require('jsonwebtoken'); // 通行证插件

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 🌟 这是你的数字签名密钥（不要泄露给别人）
const JWT_SECRET = 'ipsbio_super_secret_key_2026';

// 1. 连接数据库
const DB_URL = "mongodb+srv://huttoboyshop:yy1217175801@cluster0.cwqyxkf.mongodb.net/ipsbio_erp?retryWrites=true&w=majority&appName=Cluster0";
mongoose.connect(DB_URL)
    .then(() => console.log('✅ 成功连接到云端 MongoDB 数据库！'))
    .catch(err => console.error('❌ 数据库连接失败:', err));

// ==================== 数据库模型 ====================

// [新增] 用户模型
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user' }, // 默认是普通用户，以后你可以给自己改成 'admin'
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// 订单模型 (保持不变)
const orderSchema = new mongoose.Schema({ id: String }, { strict: false });
const Order = mongoose.model('Order', orderSchema);

// ==================== API 接口 ====================

// 🚪 [新增] 注册接口
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        // 1. 检查账号是否已存在
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ success: false, message: '账号已被注册！' });
        }
        // 2. 将密码加密
        const hashedPassword = await bcrypt.hash(password, 10);
        // 3. 保存新用户
        const newUser = new User({ username, password: hashedPassword });
        await newUser.save();
        
        res.json({ success: true, message: '注册成功！请登录。' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 🔑 [新增] 登录接口
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        // 1. 找用户
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ success: false, message: '账号不存在！' });
        }
        // 2. 核对密码 (把输入的明文和数据库里的密文比对)
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: '密码错误！' });
        }
        // 3. 密码正确，颁发“通行证” (Token)
        const token = jwt.sign(
            { userId: user._id, username: user.username, role: user.role }, 
            JWT_SECRET, 
            { expiresIn: '7d' } // 通行证 7 天有效
        );
        
        res.json({ success: true, message: '登录成功！', token: token, username: user.username });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 订单接口 (先保持原样，下一步我们再给它加上“查验通行证”的关卡)
app.get('/api/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ timeOrder: -1 });
        res.json({ success: true, data: orders });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
app.post('/api/orders/sync', async (req, res) => {
    // ... 原来的同步逻辑
    res.json({ success: true, message: '云端同步成功' });
});

// 启动服务器
app.listen(3000, () => {
    console.log('🚀 ERP 真实后端已启动：http://localhost:3000');
});