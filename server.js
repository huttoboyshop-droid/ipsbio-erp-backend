const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken'); 

const app = express();
app.use(cors());
// 允许接收大文件（比如 Base64 图片），上限 50MB
app.use(express.json({ limit: '50mb' }));

// 你的系统专属数字签名密钥
const JWT_SECRET = 'ipsbio_super_secret_key_2026';

// 1. 连接数据库
const DB_URL = "mongodb+srv://huttoboyshop:yy1217175801@cluster0.cwqyxkf.mongodb.net/ipsbio_erp?retryWrites=true&w=majority&appName=Cluster0";
mongoose.connect(DB_URL)
    .then(() => console.log('✅ 成功连接到云端 MongoDB 数据库！'))
    .catch(err => console.error('❌ 数据库连接失败:', err));

// ==================== 🛠️ 1. 数据库模型区 (Models) ====================

// 👤 用户表
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user' },
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// 📦 订单表
const orderSchema = new mongoose.Schema({ 
    owner: { type: String, required: true }, 
    id: String 
}, { strict: false });
const Order = mongoose.model('Order', orderSchema);

// 👕 产品库表 (空白底衫 Blank)
const productSchema = new mongoose.Schema({
    owner: { type: String, required: true },
    brand: String,
    model: String,
    color: String,
    gsm: Number,
    costPrice: Number,
    createdAt: { type: Date, default: Date.now }
});
const Product = mongoose.model('Product', productSchema);

// 🖼️ 图库表 (Gallery)
const gallerySchema = new mongoose.Schema({
    owner: { type: String, required: true },
    imageName: String,
    imageBase64: String, // 初期存 Base64 字符串
    tags: String,
    createdAt: { type: Date, default: Date.now }
});
const Gallery = mongoose.model('Gallery', gallerySchema);

// 🛍️ 成品库表 (My Items = Blank + Image)
// 🚨 加上 strict: false 才能保存前端传来的复杂嵌套数据（如图片缩略图，多变体数组等）
const itemSchema = new mongoose.Schema({
    owner: { type: String, required: true },
    id: String
}, { strict: false });
const Item = mongoose.model('Item', itemSchema);

// 📊 表格模板表
const templateSchema = new mongoose.Schema({
    owner: { type: String, required: true },
    templateName: String,
    columns: [String], 
    createdAt: { type: Date, default: Date.now }
});
const Template = mongoose.model('Template', templateSchema);

// 👕 [新增] 基础底板库 (Base Products)
// 包含底板视角、坐标、阴影图等庞大数据
const baseProductSchema = new mongoose.Schema({
    owner: { type: String, required: true },
    id: String
}, { strict: false });
const BaseProduct = mongoose.model('BaseProduct', baseProductSchema);


// ==================== 🛡️ 2. 鉴权中间件 (保安拦截器) ====================
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: '未授权，请先登录！' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: '通行证无效或已过期！' });
        req.user = user; // 验明正身，把用户信息挂在请求上
        next(); // 放行
    });
};


// ==================== 🚪 3. API 接口区 ====================

// --- 登录注册 ---
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const existingUser = await User.findOne({ username });
        if (existingUser) return res.status(400).json({ success: false, message: '账号已存在' });
        const hashedPassword = await bcrypt.hash(password, 10);
        await new User({ username, password: hashedPassword }).save();
        res.json({ success: true, message: '注册成功' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ success: false, message: '账号或密码错误' });
        }
        const token = jwt.sign({ userId: user._id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, username: user.username });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// --- 📦 订单 API ---
app.get('/api/orders', authenticateToken, async (req, res) => {
    try {
        const orders = await Order.find({ owner: req.user.username }).sort({ timeOrder: -1 });
        res.json({ success: true, data: orders });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.post('/api/orders/sync', authenticateToken, async (req, res) => {
    try {
        const orders = req.body.orders;
        for (let o of orders) {
            o.owner = req.user.username;
            await Order.findOneAndUpdate({ id: o.id, owner: req.user.username }, o, { upsert: true });
        }
        res.json({ success: true, message: '同步成功' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// --- 👕 简单底衫产品库 API ---
app.get('/api/products', authenticateToken, async (req, res) => {
    try {
        const products = await Product.find({ owner: req.user.username }).sort({ createdAt: -1 });
        res.json({ success: true, data: products });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.post('/api/products', authenticateToken, async (req, res) => {
    try {
        const data = req.body;
        data.owner = req.user.username;
        await new Product(data).save();
        res.json({ success: true, message: '产品保存成功' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// --- 🖼️ 图库素材 API ---
app.get('/api/gallery', authenticateToken, async (req, res) => {
    try {
        const images = await Gallery.find({ owner: req.user.username }).sort({ createdAt: -1 });
        res.json({ success: true, data: images });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.post('/api/gallery', authenticateToken, async (req, res) => {
    try {
        const data = req.body;
        data.owner = req.user.username;
        await new Gallery(data).save();
        res.json({ success: true, message: '图片保存成功' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// 🗑️ 批量删除图库图片
app.post('/api/gallery/batch-delete', authenticateToken, async (req, res) => {
    try {
        const { ids } = req.body;
        await Gallery.deleteMany({ _id: { $in: ids }, owner: req.user.username });
        res.json({ success: true, message: '批量删除成功' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// --- 🛍️ 成品库 API ---
app.get('/api/items', authenticateToken, async (req, res) => {
    try {
        const items = await Item.find({ owner: req.user.username }).sort({ createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.post('/api/items', authenticateToken, async (req, res) => {
    try {
        const data = req.body;
        data.owner = req.user.username;
        await new Item(data).save();
        res.json({ success: true, message: '成品保存成功' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// 🔄 更新成品信息 (如标题、描述)
app.post('/api/items/update', authenticateToken, async (req, res) => {
    try {
        const data = req.body;
        await Item.findOneAndUpdate(
            { $or: [{ _id: data._id }, { id: data.id }], owner: req.user.username }, 
            data
        );
        res.json({ success: true, message: '成品更新成功' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// 🗑️ 批量删除成品
app.post('/api/items/batch-delete', authenticateToken, async (req, res) => {
    try {
        const { ids } = req.body;
        await Item.deleteMany({ 
            $or: [{ _id: { $in: ids } }, { id: { $in: ids } }],
            owner: req.user.username 
        });
        res.json({ success: true, message: '批量删除成功' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// --- 📊 模板库 API ---
app.get('/api/templates', authenticateToken, async (req, res) => {
    try {
        const templates = await Template.find({ owner: req.user.username }).sort({ createdAt: -1 });
        res.json({ success: true, data: templates });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.post('/api/templates', authenticateToken, async (req, res) => {
    try {
        const data = req.body;
        data.owner = req.user.username;
        await new Template(data).save();
        res.json({ success: true, message: '模板保存成功' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// --- 👕 [新增] 基础底板库 API ---
app.get('/api/base-products', authenticateToken, async (req, res) => {
    try {
        const products = await BaseProduct.find({ owner: req.user.username }).sort({ timestamp: -1 });
        res.json({ success: true, data: products });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.post('/api/base-products/update', authenticateToken, async (req, res) => {
    try {
        const data = req.body;
        data.owner = req.user.username;
        // 有则更新，无则新建
        await BaseProduct.findOneAndUpdate(
            { id: data.id, owner: req.user.username }, 
            data, 
            { upsert: true, new: true }
        );
        res.json({ success: true, message: '底板保存成功' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.post('/api/base-products/batch-delete', authenticateToken, async (req, res) => {
    try {
        const { ids } = req.body;
        await BaseProduct.deleteMany({ id: { $in: ids }, owner: req.user.username });
        res.json({ success: true, message: '批量删除成功' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});


// 启动服务器
app.listen(3000, () => {
    console.log('🚀 IPSBIO ERP 终极后端已在 3000 端口全速运行');
});