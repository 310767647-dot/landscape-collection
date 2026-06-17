const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('./database');
const { authenticateToken, generateToken } = require('./auth');

process.on('unhandledRejection', (reason, promise) => {
  console.error('=== Unhandled Rejection ===');
  console.error('Promise:', promise);
  console.error('Reason:', reason);
  console.error('Stack:', reason?.stack);
});

process.on('uncaughtException', (error) => {
  console.error('=== Uncaught Exception ===');
  console.error('Error:', error);
  console.error('Message:', error?.message);
  console.error('Stack:', error?.stack);
  // 不要立即退出，让服务继续运行
});

const app = express();
const PORT = process.env.PORT || 5006;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use('/uploads', express.static(path.join(__dirname, 'data', 'uploads')));

const frontendDistPath = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, 'data', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({ storage: storage });

function parsePermissions(permissions) {
  try {
    return JSON.parse(permissions || '{}');
  } catch {
    return {};
  }
}

// 判断是否为首个创建的管理员（超级管理员不可被删除/降级）
function isFirstAdmin(userId) {
  try {
    const firstAdmin = db.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1").get();
    return firstAdmin && firstAdmin.id === userId;
  } catch {
    return false;
  }
}

// 记录操作日志
function logAction(req, action, targetType, targetId, targetName, details) {
  try {
    const { v4: uuidv4 } = require('uuid');
    const logId = uuidv4();
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, username, action, target_type, target_id, target_name, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(logId, req.user?.id || 'system', req.user?.username || 'system', action, targetType, targetId || '', targetName || '', details || '');
  } catch (error) {
    console.error('日志记录失败:', error);
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '无权限访问' });
  }
  next();
}

db.getReady().then(() => {
  console.log('Database initialized');

  app.post('/api/register', async (req, res) => {
    try {
      const { username, password, real_name, phone } = req.body;

      if (!username || !password || !real_name || !phone) {
        return res.status(400).json({ error: '用户名、密码、真实姓名和手机号不能为空' });
      }

      const existingUser = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
      if (existingUser) {
        return res.status(400).json({ error: '用户名已存在' });
      }

      const existingPhone = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
      if (existingPhone) {
        return res.status(400).json({ error: '该手机号已被注册' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = uuidv4();

      db.prepare('INSERT INTO users (id, username, password, display_name, real_name, phone, role) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(userId, username, hashedPassword, real_name, real_name, phone, 'user');

      const token = generateToken({ id: userId, username });

      res.json({
        success: true,
        message: '注册成功',
        user: { id: userId, username, display_name: real_name, real_name, phone, role: 'user', permissions: {} },
        token
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: '注册失败' });
    }
  });

  app.post('/api/login', async (req, res) => {
    try {
      console.log('=== 收到登录请求 ===');
      console.log('请求体:', JSON.stringify(req.body));
      console.log('Content-Type:', req.headers['content-type']);
      
      const { username, password } = req.body;

      if (!username || !password) {
        console.log('❌ 用户名或密码为空');
        return res.status(400).json({ error: '用户名和密码不能为空' });
      }

      const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
      console.log(`用户查询: username=${username}, 找到用户: ${!!user}`);
      
      if (!user) {
        console.log('❌ 用户不存在');
        return res.status(401).json({ error: '用户名或密码错误' });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      console.log(`密码验证: ${validPassword}`);
      
      if (!validPassword) {
        console.log('❌ 密码错误');
        return res.status(401).json({ error: '用户名或密码错误' });
      }

      const token = generateToken(user);
      console.log('✅ 登录成功, 用户ID:', user.id);

      res.json({
        success: true,
        message: '登录成功',
        user: {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          real_name: user.real_name,
          phone: user.phone,
          role: user.role || 'user',
          permissions: parsePermissions(user.permissions)
        },
        token
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: '登录失败' });
    }

  });

  const smsCodes = {};

  app.post('/api/send-sms-code', async (req, res) => {
    try {
      const { phone } = req.body;
      
      if (!phone) {
        return res.status(400).json({ error: '请输入手机号' });
      }

      const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
      if (!user) {
        return res.status(400).json({ error: '该手机号未注册' });
      }

      const code = Math.random().toString(10).substr(2, 6);
      smsCodes[phone] = {
        code,
        expiresAt: Date.now() + 5 * 60 * 1000
      };

      console.log(`发送验证码: phone=${phone}, code=${code}`);

      res.json({ success: true, message: '验证码已发送' });
    } catch (error) {
      console.error('Send SMS error:', error);
      res.status(500).json({ error: '发送失败' });
    }
  });

  app.post('/api/change-password', authenticateToken, async (req, res) => {
    try {
      const { oldPassword, newPassword } = req.body;

      if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: '请输入原密码和新密码' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: '密码至少需要6个字符' });
      }

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
      if (!user) {
        return res.status(404).json({ error: '用户不存在' });
      }

      const validPassword = await bcrypt.compare(oldPassword, user.password);
      if (!validPassword) {
        return res.status(400).json({ error: '原密码不正确' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.user.id);

      res.json({ success: true, message: '密码修改成功' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: '修改失败' });
    }
  });

  app.post('/api/users/change-password', authenticateToken, async (req, res) => {
    try {
      const { newPassword } = req.body;

      if (!newPassword) {
        return res.status(400).json({ success: false, message: '请输入新密码' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: '密码至少需要6个字符' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.user.id);

      res.json({ success: true, message: '密码修改成功' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ success: false, message: '修改失败' });
    }
  });

  app.post('/api/change-password-sms', async (req, res) => {
    try {
      const { phone, code, newPassword } = req.body;

      if (!phone || !code || !newPassword) {
        return res.status(400).json({ error: '请输入手机号、验证码和新密码' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: '密码至少需要6个字符' });
      }

      const smsCode = smsCodes[phone];
      if (!smsCode || smsCode.expiresAt < Date.now()) {
        return res.status(400).json({ error: '验证码已过期或不存在' });
      }

      if (smsCode.code !== code) {
        return res.status(400).json({ error: '验证码不正确' });
      }

      const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
      if (!user) {
        return res.status(404).json({ error: '用户不存在' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, user.id);

      delete smsCodes[phone];

      res.json({ success: true, message: '密码修改成功' });
    } catch (error) {
      console.error('Change password SMS error:', error);
      res.status(500).json({ error: '修改失败' });
    }
  });

  app.get('/api/user', authenticateToken, (req, res) => {
    try {
      const user = db.prepare('SELECT id, username, display_name, role, permissions, created_at FROM users WHERE id = ?')
        .get(req.user.id);

      if (!user) {
        return res.status(404).json({ error: '用户不存在' });
      }

      res.json({ ...user, permissions: parsePermissions(user.permissions) });
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ error: '获取用户信息失败' });
    }
  });

  app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
    try {
      const users = db.prepare('SELECT id, username, display_name, phone, role, created_at FROM users').all();
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: '获取用户列表失败' });
    }
  });

  app.put('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
      console.log('=== 收到用户更新请求 ===');
      console.log('用户ID:', req.params.id);
      console.log('请求体:', JSON.stringify(req.body));

      const { id } = req.params;
      const { username, role, display_name, displayName, phone, password } = req.body;
      
      // 支持两种命名方式
      const displayNameValue = display_name || displayName;
      
      // 获取要更新的用户信息
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      if (!user) {
        return res.status(404).json({ error: '用户不存在' });
      }
      
      // 保护超级管理员（首个创建的管理员）
      if (isFirstAdmin(id) && req.user.id !== id) {
        return res.status(403).json({ error: '不能修改超级管理员的信息' });
      }
      if (isFirstAdmin(id) && role !== undefined && role !== user.role) {
        return res.status(403).json({ error: '不能修改超级管理员角色' });
      }

      // 管理员可以修改任何用户的信息
      // 不能将自己降级为非管理员（避免系统没有管理员）
      if (role !== undefined && role !== user.role && req.user.id === id && role !== 'admin') {
        return res.status(403).json({ error: '不能将自己降级为非管理员' });
      }

      let updateFields = [];
      let updateValues = [];

      if (username !== undefined) {
        updateFields.push('username = ?');
        updateValues.push(username);
      }
      if (role !== undefined) {
        updateFields.push('role = ?');
        updateValues.push(role);
      }
      if (displayNameValue !== undefined) {
        updateFields.push('display_name = ?');
        updateValues.push(displayNameValue);
      }
      if (phone !== undefined) {
        updateFields.push('phone = ?');
        updateValues.push(phone);
      }
      if (password !== undefined) {
        const hashedPassword = await bcrypt.hash(password, 10);
        updateFields.push('password = ?');
        updateValues.push(hashedPassword);
      }
      
      if (updateFields.length === 0) {
        console.log('❌ 没有提供需要更新的字段');
        return res.status(400).json({ error: '没有提供需要更新的字段' });
      }
      
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      updateValues.push(id);

      console.log('更新字段:', updateFields);
      console.log('更新值:', updateValues);

      const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
      console.log('执行SQL:', query);
      
      const result = db.prepare(query).run(...updateValues);
      console.log('更新结果:', result);

      logAction(req, 'update', 'user', id, user.display_name || user.username, '更新用户信息');
      res.json({ success: true, message: '用户信息更新成功' });
    } catch (error) {
      console.error('Error updating user:', error);
      console.error('错误堆栈:', error.stack);
      res.status(500).json({ error: '更新用户信息失败' });
    }
  });

  app.post('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { username, password, display_name, phone, role } = req.body;
      
      if (!username || !password || !display_name || !phone) {
        return res.status(400).json({ error: '用户名、密码、真实姓名和手机号不能为空' });
      }
      
      // 检查用户名是否已存在
      const existingUser = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
      if (existingUser) {
        return res.status(400).json({ error: '用户名已存在' });
      }
      
      // 检查手机号是否已被注册
      const existingPhone = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
      if (existingPhone) {
        return res.status(400).json({ error: '该手机号已被注册' });
      }
      
      // 管理员可以创建管理员用户
      
      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = uuidv4();
      
      db.prepare(`
        INSERT INTO users (id, username, password, display_name, real_name, phone, role)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(userId, username, hashedPassword, display_name, display_name, phone, role || 'user');
      
      logAction(req, 'create', 'user', userId, username, `创建用户 ${displayNameValue}(${username})`);
      res.json({ success: true, message: '用户创建成功', userId });
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: '创建用户失败' });
    }
  });

  app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      if (!user) {
        return res.status(404).json({ error: '用户不存在' });
      }
      
      // 保护超级管理员（首个创建的管理员）
      if (isFirstAdmin(id)) {
        return res.status(403).json({ error: '不能删除超级管理员用户' });
      }
      
      // 管理员不能删除其他管理员（避免系统没有管理员）
      if (user.role === 'admin' && req.user.id !== user.id) {
        return res.status(403).json({ error: '不能删除其他管理员用户' });
      }
      
      db.prepare(`
        INSERT INTO deleted_users (id, username, password, display_name, real_name, phone, role, permissions, deleted_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(user.id, user.username, user.password, user.display_name || '', user.real_name || '', user.phone || '', user.role || 'user', user.permissions || '{}', req.user.id);
      
      db.prepare('DELETE FROM user_projects WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM users WHERE id = ?').run(id);

      logAction(req, 'delete', 'user', id, user.username, `删除用户 ${user.username}`);
      res.json({ success: true, message: '用户删除成功' });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: '删除用户失败' });
    }
  });

  app.post('/api/materials', authenticateToken, upload.array('photos', 10), (req, res) => {
    try {
      console.log('=== 收到材料保存请求 ===');
      console.log('请求体:', JSON.stringify(req.body));
      console.log('用户信息:', JSON.stringify(req.user));
      console.log('Content-Type:', req.headers['content-type']);
      console.log('上传的文件:', req.files ? req.files.map(f => f.filename) : '无');
      
      const { project_name, material_name, supplier_name, specifications, quantity, unit, arrival_time, ocr_text } = req.body;
      
      if (!material_name) {
        console.log('❌ 材料名称为空');
        return res.status(400).json({ error: '材料名称不能为空' });
      }

      const materialId = uuidv4();
      
      const safeProjectName = project_name || '';
      const safeSupplierName = supplier_name || '';
      const safeSpecifications = specifications || '';
      const safeQuantity = parseFloat(quantity) || 0;
      const safeUnit = unit || '';
      const safeArrivalTime = arrival_time || '';
      const safeOcrText = ocr_text || '';

      const photoPaths = req.files ? req.files.map(f => `/uploads/${f.filename}`).join(',') : null;

      console.log('准备插入数据库:', {
        materialId,
        userId: req.user.id,
        project_name: safeProjectName,
        material_name,
        supplier_name: safeSupplierName,
        specifications: safeSpecifications,
        quantity: safeQuantity,
        unit: safeUnit,
        arrival_time: safeArrivalTime,
        ocr_text: safeOcrText,
        photoPaths
      });

      const result = db.prepare(`
        INSERT INTO materials (
          id, user_id, project_name, material_name, supplier_name, 
          specifications, quantity, unit, arrival_time, photo_path, ocr_text
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        materialId, req.user.id, safeProjectName, material_name, safeSupplierName,
        safeSpecifications, safeQuantity, safeUnit, safeArrivalTime, photoPaths, safeOcrText
      );

      console.log('✅ 材料保存成功, ID:', materialId, '结果:', result);
      const materialName = req.body.material_name || '';
      logAction(req, 'create', 'material', materialId, materialName, `添加材料 ${materialName} (${safeProjectName})`);
      res.json({ success: true, id: materialId, message: '材料保存成功' });
    } catch (error) {
      console.error('❌ Error saving material:', error);
      console.error('错误堆栈:', error.stack);
      res.status(500).json({ error: '保存材料失败: ' + (error.message || String(error)) });
    }
  });

  app.get('/api/materials', authenticateToken, (req, res) => {
    try {
      const { project_name, material_name, supplier_name, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      let query = 'SELECT m.*, u.display_name as user_display_name, u.username as user_username FROM materials m LEFT JOIN users u ON m.user_id = u.id';
      let params = [];
      let hasWhere = false;

      if (req.user.role !== 'admin') {
        query += ' INNER JOIN user_projects up ON m.project_name = (SELECT p.name FROM projects p WHERE p.id = up.project_id)';
        query += ' WHERE up.user_id = ?';
        params.push(req.user.id);
        hasWhere = true;
      }

      if (project_name) {
        query += hasWhere ? ' AND' : ' WHERE';
        query += ' m.project_name LIKE ?';
        params.push(`%${project_name}%`);
        hasWhere = true;
      }

      if (material_name) {
        query += hasWhere ? ' AND' : ' WHERE';
        query += ' m.material_name LIKE ?';
        params.push(`%${material_name}%`);
        hasWhere = true;
      }

      if (supplier_name) {
        query += hasWhere ? ' AND' : ' WHERE';
        query += ' m.supplier_name LIKE ?';
        params.push(`%${supplier_name}%`);
        hasWhere = true;
      }

      query += ' ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), offset);

      const materials = db.prepare(query).all(...params);

      // 构建计数查询（复用相同的 WHERE 条件）
      let countConditions = [];
      let countParams = [];

      if (req.user.role !== 'admin') {
        countConditions.push('up.user_id = ?');
        countParams.push(req.user.id);
      }
      if (project_name) {
        countConditions.push('m.project_name LIKE ?');
        countParams.push(`%${project_name}%`);
      }
      if (material_name) {
        countConditions.push('m.material_name LIKE ?');
        countParams.push(`%${material_name}%`);
      }
      if (supplier_name) {
        countConditions.push('m.supplier_name LIKE ?');
        countParams.push(`%${supplier_name}%`);
      }

      const countQuery = req.user.role === 'admin'
        ? ('SELECT COUNT(*) as count FROM materials m' + (countConditions.length > 0 ? ' WHERE ' + countConditions.join(' AND ') : ''))
        : ('SELECT COUNT(*) as count FROM materials m INNER JOIN user_projects up ON m.project_name = (SELECT p.name FROM projects p WHERE p.id = up.project_id)' + (countConditions.length > 0 ? ' WHERE ' + countConditions.join(' AND ') : ''));

      const total = db.prepare(countQuery).get(...countParams)?.count || 0;

      res.json({
        materials,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching materials:', error);
      res.status(500).json({ error: '获取材料列表失败' });
    }
  });

  app.get('/api/materials/:id', authenticateToken, (req, res) => {
    try {
      const { id } = req.params;
      
      let material;
      if (req.user.role === 'admin') {
        material = db.prepare('SELECT * FROM materials WHERE id = ?').get(id);
      } else {
        material = db.prepare(`
          SELECT m.* FROM materials m 
          INNER JOIN user_projects up ON m.project_name = (SELECT p.name FROM projects p WHERE p.id = up.project_id) 
          WHERE m.id = ? AND up.user_id = ?
        `).get(id, req.user.id);
      }

      if (!material) {
        return res.status(404).json({ error: '材料不存在' });
      }

      res.json(material);
    } catch (error) {
      console.error('Error fetching material:', error);
      res.status(500).json({ error: '获取材料信息失败' });
    }
  });

  app.put('/api/materials/:id', authenticateToken, upload.single('photo'), (req, res) => {
    try {
      const { id } = req.params;
      const { project_name, material_name, supplier_name, specifications, quantity, unit, arrival_time, ocr_text } = req.body;

      let existingMaterial;
      if (req.user.role === 'admin') {
        existingMaterial = db.prepare('SELECT * FROM materials WHERE id = ?').get(id);
      } else {
        existingMaterial = db.prepare(`
          SELECT m.* FROM materials m 
          INNER JOIN user_projects up ON m.project_name = (SELECT p.name FROM projects p WHERE p.id = up.project_id) 
          WHERE m.id = ? AND up.user_id = ?
        `).get(id, req.user.id);
      }
      
      if (!existingMaterial) {
        return res.status(404).json({ error: '材料不存在' });
      }

      const photoPath = req.file ? `/uploads/${req.file.filename}` : existingMaterial.photo_path;

      if (req.user.role === 'admin') {
        db.prepare(`
          UPDATE materials SET 
            project_name = ?, material_name = ?, supplier_name = ?, 
            specifications = ?, quantity = ?, unit = ?, arrival_time = ?, 
            photo_path = ?, ocr_text = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          project_name, material_name, supplier_name, specifications,
          parseFloat(quantity) || 0, unit, arrival_time, photoPath, ocr_text,
          id
        );
      } else {
        db.prepare(`
          UPDATE materials m 
          SET project_name = ?, material_name = ?, supplier_name = ?, 
              specifications = ?, quantity = ?, unit = ?, arrival_time = ?, 
              photo_path = ?, ocr_text = ?, updated_at = CURRENT_TIMESTAMP
          WHERE m.id = ? 
            AND EXISTS (SELECT 1 FROM user_projects up 
                        WHERE m.project_name = (SELECT p.name FROM projects p WHERE p.id = up.project_id) 
                          AND up.user_id = ?)
        `).run(
          project_name, material_name, supplier_name, specifications,
          parseFloat(quantity) || 0, unit, arrival_time, photoPath, ocr_text,
          id, req.user.id
        );
      }

      logAction(req, 'update', 'material', id, req.body.material_name || '', `更新材料信息`);
      res.json({ success: true, message: '材料更新成功' });
    } catch (error) {
      console.error('Error updating material:', error);
      res.status(500).json({ error: '更新材料失败' });
    }
  });

  app.delete('/api/materials/:id', authenticateToken, (req, res) => {
    try {
      const { id } = req.params;

      let material;
      if (req.user.role === 'admin') {
        material = db.prepare('SELECT * FROM materials WHERE id = ?').get(id);
      } else {
        material = db.prepare(`
          SELECT m.* FROM materials m 
          INNER JOIN user_projects up ON m.project_name = (SELECT p.name FROM projects p WHERE p.id = up.project_id) 
          WHERE m.id = ? AND up.user_id = ?
        `).get(id, req.user.id);
      }
      
      if (!material) {
        return res.status(404).json({ error: '材料不存在' });
      }

      // 保存到删除记录表
      db.prepare(`
        INSERT INTO deleted_materials (id, user_id, project_name, material_name, supplier_name, specifications, quantity, unit, arrival_time, photo_path, ocr_text, deleted_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        material.id,
        material.user_id || '',
        material.project_name || '',
        material.material_name || '',
        material.supplier_name || '',
        material.specifications || '',
        material.quantity || 0,
        material.unit || '',
        material.arrival_time || '',
        material.photo_path || '',
        material.ocr_text || '',
        req.user.id
      );

      if (material.photo_path) {
        const photoPath = path.join(__dirname, 'uploads', path.basename(material.photo_path));
        if (fs.existsSync(photoPath)) {
          fs.unlinkSync(photoPath);
        }
      }

      if (req.user.role === 'admin') {
        db.prepare('DELETE FROM materials WHERE id = ?').run(id);
      } else {
        db.prepare(`
          DELETE FROM materials m 
          WHERE m.id = ? 
            AND EXISTS (SELECT 1 FROM user_projects up 
                        WHERE m.project_name = (SELECT p.name FROM projects p WHERE p.id = up.project_id) 
                          AND up.user_id = ?)
        `).run(id, req.user.id);
      }

      logAction(req, 'delete', 'material', id, material.material_name, `删除材料 ${material.material_name}`);
      res.json({ success: true, message: '材料删除成功' });
    } catch (error) {
      console.error('Error deleting material:', error);
      res.status(500).json({ error: '删除材料失败' });
    }
  });

  // ========== 微信小程序接口 ==========

  // 微信登录接口
  app.post('/api/wx-login', async (req, res) => {
    try {
      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({ error: '缺少code参数' });
      }

      // 向微信服务器换取openid和session_key
      const wxAppId = process.env.WX_APPID || 'your_wx_appid';
      const wxSecret = process.env.WX_SECRET || 'your_wx_secret';
      
      const wxResponse = await fetch(`https://api.weixin.qq.com/sns/jscode2session?appid=${wxAppId}&secret=${wxSecret}&js_code=${code}&grant_type=authorization_code`);
      const wxData = await wxResponse.json();
      
      if (wxData.errcode) {
        console.error('微信登录失败:', wxData);
        return res.status(400).json({ error: '微信登录失败: ' + wxData.errmsg });
      }

      const { openid, session_key } = wxData;

      // 查找或创建微信用户
      let user = db.prepare('SELECT * FROM users WHERE openid = ?').get(openid);
      
      if (!user) {
        // 创建新用户
        const userId = uuidv4();
        const username = `wx_${openid.substring(0, 8)}`;
        const displayName = '微信用户';
        
        db.prepare('INSERT INTO users (id, username, display_name, role, openid, session_key) VALUES (?, ?, ?, ?, ?, ?)')
          .run(userId, username, displayName, 'user', openid, session_key);
        
        user = {
          id: userId,
          username,
          display_name: displayName,
          role: 'user',
          openid
        };
      } else {
        // 更新session_key
        db.prepare('UPDATE users SET session_key = ? WHERE id = ?').run(session_key, user.id);
      }

      const token = generateToken(user);

      res.json({
        success: true,
        token,
        userInfo: {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          role: user.role
        }
      });
    } catch (error) {
      console.error('微信登录错误:', error);
      res.status(500).json({ error: '微信登录失败' });
    }
  });

  // 统计接口
  app.get('/api/stats', authenticateToken, (req, res) => {
    try {
      const userStats = db.prepare(`
        SELECT 
          COUNT(*) as total_materials,
          COUNT(DISTINCT project_name) as total_projects
        FROM materials WHERE user_id = ?
      `).get(req.user.id);

      const recentMaterials = db.prepare(`
        SELECT id, project_name, material_name, supplier_name, specifications, quantity, unit, arrival_time, created_at
        FROM materials 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 5
      `).all(req.user.id);

      res.json({
        totalMaterials: (userStats?.total_materials || 0),
        totalProjects: (userStats?.total_projects || 0),
        recentMaterials: recentMaterials || []
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ error: '获取统计数据失败' });
    }
  });

  // 已删除材料列表（回收站）
  app.get('/api/materials/deleted', authenticateToken, requireAdmin, (req, res) => {
    try {
      const deletedMaterials = db.prepare(`
        SELECT dm.*, u.display_name as deleted_by_name 
        FROM deleted_materials dm 
        LEFT JOIN users u ON dm.deleted_by = u.id 
        ORDER BY dm.deleted_at DESC
      `).all();
      
      res.json({
        success: true,
        data: deletedMaterials
      });
    } catch (error) {
      console.error('获取已删除材料错误:', error);
      res.status(500).json({ error: '获取已删除材料失败' });
    }
  });

  // 恢复已删除材料
  app.post('/api/materials/:id/restore', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      
      const deletedMaterial = db.prepare('SELECT * FROM deleted_materials WHERE id = ?').get(id);
      
      if (!deletedMaterial) {
        return res.status(404).json({ error: '材料不存在' });
      }

      // 恢复到materials表
      db.prepare(`
        INSERT INTO materials (
          id, user_id, project_name, material_name, supplier_name,
          specifications, quantity, unit, arrival_time, photo_path, ocr_text
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        deletedMaterial.id,
        deletedMaterial.user_id,
        deletedMaterial.project_name,
        deletedMaterial.material_name,
        deletedMaterial.supplier_name,
        deletedMaterial.specifications,
        deletedMaterial.quantity,
        deletedMaterial.unit,
        deletedMaterial.arrival_time,
        deletedMaterial.photo_path,
        deletedMaterial.ocr_text
      );

      // 从deleted_materials表删除
      db.prepare('DELETE FROM deleted_materials WHERE id = ?').run(id);

      res.json({
        success: true,
        message: '材料恢复成功'
      });
    } catch (error) {
      console.error('恢复材料错误:', error);
      res.status(500).json({ error: '恢复材料失败' });
    }
  });

  // 公开项目列表（小程序首页需要）
  app.get('/api/projects', authenticateToken, (req, res) => {
    try {
      let projects;
      if (req.user.role === 'admin') {
        // 管理员可以看到所有项目
        projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
      } else {
        // 普通用户可以看到所有项目（用于选择）
        projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
      }
      res.json({
        success: true,
        data: projects
      });
    } catch (error) {
      console.error('Error fetching projects:', error);
      res.status(500).json({ success: false, message: '获取项目列表失败' });
    }
  });

  app.post('/api/projects', authenticateToken, (req, res) => {
    try {
      const { name, description } = req.body;

      if (!name) {
        return res.status(400).json({ success: false, message: '项目名称不能为空' });
      }

      const projectId = uuidv4();

      db.prepare('INSERT INTO projects (id, user_id, name, description) VALUES (?, ?, ?, ?)')
        .run(projectId, req.user.id, name, description);

      logAction(req, 'create', 'project', projectId, name, `创建项目 ${name}`);
      res.json({ success: true, id: projectId, message: '项目创建成功' });
    } catch (error) {
      console.error('Error creating project:', error);
      res.status(500).json({ success: false, message: '创建项目失败' });
    }
  });

  app.get('/api/public/projects', authenticateToken, (req, res) => {
    try {
      const projects = db.prepare('SELECT id, name, description FROM projects ORDER BY created_at DESC').all();
      res.json(projects);
    } catch (error) {
      console.error('Error fetching public projects:', error);
      res.status(500).json({ error: '获取项目列表失败' });
    }
  });

  app.get('/api/user-projects/:userId', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '权限不足' });
    }
    try {
      const { userId } = req.params;
      const projects = db.prepare(`
        SELECT p.* FROM projects p 
        INNER JOIN user_projects up ON p.id = up.project_id 
        WHERE up.user_id = ?
        ORDER BY p.created_at DESC
      `).all(userId);
      res.json(projects);
    } catch (error) {
      console.error('Error fetching user projects:', error);
      res.status(500).json({ error: '获取用户项目失败' });
    }
  });

  app.post('/api/user-projects', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '权限不足' });
    }
    try {
      const { userId, projectIds } = req.body;

      if (!userId || !projectIds || !Array.isArray(projectIds)) {
        return res.status(400).json({ error: '参数错误' });
      }

      db.prepare('DELETE FROM user_projects WHERE user_id = ?').run(userId);

      for (const projectId of projectIds) {
        const id = uuidv4();
        db.prepare('INSERT INTO user_projects (id, user_id, project_id) VALUES (?, ?, ?)')
          .run(id, userId, projectId);
      }

      res.json({ success: true, message: '用户项目匹配成功' });
    } catch (error) {
      console.error('Error updating user projects:', error);
      res.status(500).json({ error: '更新用户项目失败' });
    }
  });

  app.post('/api/admin/projects', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { name, description } = req.body;

      if (!name) {
        return res.status(400).json({ error: '项目名称不能为空' });
      }

      const projectId = uuidv4();

      db.prepare('INSERT INTO projects (id, user_id, name, description) VALUES (?, ?, ?, ?)')
        .run(projectId, req.user.id, name, description);

      logAction(req, 'create', 'project', projectId, name, `创建项目 ${name}`);
      res.json({ success: true, id: projectId, message: '项目创建成功' });
    } catch (error) {
      console.error('Error creating admin project:', error);
      res.status(500).json({ error: '创建项目失败' });
    }
  });

  app.put('/api/admin/projects/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
      if (!project) {
        return res.status(404).json({ error: '项目不存在' });
      }

      if (!name) {
        return res.status(400).json({ error: '项目名称不能为空' });
      }

      const oldName = project.name;
      db.prepare('UPDATE projects SET name = ?, description = ? WHERE id = ?').run(name, description, id);
      
      if (oldName !== name) {
        db.prepare('UPDATE materials SET project_name = ? WHERE project_name = ?').run(name, oldName);
      }

      logAction(req, 'update', 'project', id, name, `更新项目 ${name}`);
      res.json({ success: true, message: '项目更新成功' });
    } catch (error) {
      console.error('Error updating admin project:', error);
      res.status(500).json({ error: '更新项目失败' });
    }
  });

  app.delete('/api/admin/projects/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { id } = req.params;

      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
      if (!project) {
        return res.status(404).json({ error: '项目不存在' });
      }

      // 保存到删除记录表
      db.prepare(`
        INSERT INTO deleted_projects (id, name, description, user_id, deleted_by)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        project.id,
        project.name,
        project.description || '',
        project.user_id || '',
        req.user.id
      );

      db.prepare('DELETE FROM materials WHERE project_name = ?').run(project.name);
      db.prepare('DELETE FROM projects WHERE id = ?').run(id);

      logAction(req, 'delete', 'project', id, project.name, `删除项目 ${project.name}`);
      res.json({ success: true, message: '项目删除成功' });
    } catch (error) {
      console.error('Error deleting admin project:', error);
      res.status(500).json({ error: '删除项目失败' });
    }
  });

  app.delete('/api/projects/:id', authenticateToken, (req, res) => {
    try {
      const { id } = req.params;

      const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(id, req.user.id);
      if (!project) {
        return res.status(404).json({ error: '项目不存在' });
      }

      db.prepare('DELETE FROM materials WHERE user_id = ? AND project_name = ?').run(req.user.id, project.name);
      db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').run(id, req.user.id);

      res.json({ success: true, message: '项目删除成功' });
    } catch (error) {
      console.error('Error deleting project:', error);
      res.status(500).json({ error: '删除项目失败' });
    }
  });

  app.get('/api/admin/materials', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { project_name, material_name, supplier_name, user_id, user_name, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      let query = 'SELECT m.*, u.username as user_name, u.display_name as user_display_name FROM materials m LEFT JOIN users u ON m.user_id = u.id';
      let params = [];
      let conditions = [];

      if (project_name) {
        conditions.push('m.project_name LIKE ?');
        params.push(`%${project_name}%`);
      }

      if (material_name) {
        conditions.push('m.material_name LIKE ?');
        params.push(`%${material_name}%`);
      }

      if (supplier_name) {
        conditions.push('m.supplier_name LIKE ?');
        params.push(`%${supplier_name}%`);
      }

      if (user_id) {
        conditions.push('m.user_id = ?');
        params.push(user_id);
      }

      if (user_name) {
        conditions.push('(u.username LIKE ? OR u.display_name LIKE ? OR u.real_name LIKE ?)');
        params.push(`%${user_name}%`, `%${user_name}%`, `%${user_name}%`);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), offset);

      const materials = db.prepare(query).all(...params);

      let countQuery = 'SELECT COUNT(*) as count FROM materials m LEFT JOIN users u ON m.user_id = u.id';
      if (conditions.length > 0) {
        countQuery += ' WHERE ' + conditions.join(' AND ');
      }
      const total = db.prepare(countQuery).get(...params.slice(0, -2))?.count || 0;

      res.json({
        materials,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching admin materials:', error);
      res.status(500).json({ error: '获取材料列表失败' });
    }
  });

  app.put('/api/admin/materials/:id', authenticateToken, requireAdmin, upload.single('photo'), (req, res) => {
    try {
      const { id } = req.params;
      const { project_name, material_name, supplier_name, specifications, quantity, unit, arrival_time, ocr_text } = req.body;

      const existingMaterial = db.prepare('SELECT * FROM materials WHERE id = ?').get(id);
      if (!existingMaterial) {
        return res.status(404).json({ error: '材料不存在' });
      }

      const photoPath = req.file ? `/uploads/${req.file.filename}` : existingMaterial.photo_path;

      db.prepare(`
        UPDATE materials SET 
          project_name = ?, material_name = ?, supplier_name = ?, 
          specifications = ?, quantity = ?, unit = ?, arrival_time = ?, 
          photo_path = ?, ocr_text = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        project_name, material_name, supplier_name, specifications,
        parseFloat(quantity) || 0, unit, arrival_time, photoPath, ocr_text, id
      );

      res.json({ success: true, message: '材料更新成功' });
    } catch (error) {
      console.error('Error updating admin material:', error);
      res.status(500).json({ error: '更新材料失败' });
    }
  });

  app.delete('/api/admin/materials/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      console.log('开始删除材料，ID:', id);

      const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(id);
      if (!material) {
        console.log('材料不存在，ID:', id);
        return res.status(404).json({ error: '材料不存在' });
      }

      console.log('准备插入删除记录，材料:', material.material_name);

      // 插入到删除记录表
      db.prepare(`
        INSERT INTO deleted_materials (id, user_id, project_name, material_name, supplier_name, specifications, quantity, unit, arrival_time, photo_path, ocr_text, deleted_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        material.id,
        material.user_id || '',
        material.project_name || '',
        material.material_name || '',
        material.supplier_name || '',
        material.specifications || '',
        material.quantity || 0,
        material.unit || '',
        material.arrival_time || '',
        material.photo_path || '',
        material.ocr_text || '',
        req.user.id
      );

      console.log('删除记录插入成功，准备删除材料');

      // 从materials表删除
      db.prepare('DELETE FROM materials WHERE id = ?').run(id);

      console.log('材料删除成功，ID:', id);
      logAction(req, 'delete', 'material', id, material.material_name, `删除材料 ${material.material_name}`);
      res.json({ success: true, message: '材料删除成功' });
    } catch (error) {
      console.error('删除材料错误:', error.message);
      console.error('错误详情:', error.stack);
      res.status(500).json({ error: '删除材料失败: ' + error.message });
    }
  });

  app.get('/api/export/materials', authenticateToken, (req, res) => {
    try {
      const { project_name } = req.query;

      let query = 'SELECT project_name, material_name, supplier_name, specifications, quantity, unit, arrival_time, created_at FROM materials WHERE user_id = ?';
      let params = [req.user.id];

      if (project_name) {
        query += ' AND project_name = ?';
        params.push(project_name);
      }

      const materials = db.prepare(query).all(...params);

      const headers = ['项目名称', '材料名称', '供应商', '规格型号', '数量', '单位', '到货时间', '创建时间'];
      const rows = materials.map(m => [
        m.project_name || '',
        m.material_name || '',
        m.supplier_name || '',
        m.specifications || '',
        m.quantity || '',
        m.unit || '',
        m.arrival_time || '',
        m.created_at || ''
      ]);

      const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=materials_${Date.now()}.csv`);
      res.send(`\uFEFF${csvContent}`);
    } catch (error) {
      console.error('Error exporting materials:', error);
      res.status(500).json({ error: '导出材料失败' });
    }
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/admin/deleted/users', authenticateToken, requireAdmin, (req, res) => {
    try {
      const deletedUsers = db.prepare('SELECT * FROM deleted_users ORDER BY deleted_at DESC').all();
      res.json({
        success: true,
        data: deletedUsers
      });
    } catch (error) {
      console.error('Error fetching deleted users:', error);
      res.status(500).json({ error: '获取删除用户记录失败' });
    }
  });

  app.get('/api/admin/deleted/materials', authenticateToken, requireAdmin, (req, res) => {
    try {
      const deletedMaterials = db.prepare('SELECT * FROM deleted_materials ORDER BY deleted_at DESC').all();
      res.json({
        success: true,
        data: deletedMaterials
      });
    } catch (error) {
      console.error('Error fetching deleted materials:', error);
      res.status(500).json({ error: '获取删除材料记录失败' });
    }
  });

  app.get('/api/admin/deleted/projects', authenticateToken, requireAdmin, (req, res) => {
    try {
      const deletedProjects = db.prepare('SELECT * FROM deleted_projects ORDER BY deleted_at DESC').all();
      res.json({
        success: true,
        data: deletedProjects
      });
    } catch (error) {
      console.error('Error fetching deleted projects:', error);
      res.status(500).json({ error: '获取删除项目记录失败' });
    }
  });

  // ========== 审计日志接口 ==========

  // 获取操作日志
  app.get('/api/admin/audit-logs', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;
      const logs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?').all(parseInt(limit), offset);
      const total = db.prepare('SELECT COUNT(*) as count FROM audit_logs').get()?.count || 0;
      res.json({ logs, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } });
    } catch (error) {
      console.error('获取审计日志错误:', error);
      res.status(500).json({ error: '获取审计日志失败' });
    }
  });

  // ========== 删除记录操作保护（仅超级管理员）==========

  // 恢复已删除材料
  app.post('/api/admin/deleted/materials/:id/restore', authenticateToken, requireAdmin, (req, res) => {
    if (!isFirstAdmin(req.user.id)) {
      return res.status(403).json({ error: '仅超级管理员可以恢复删除记录' });
    }
    try {
      const { id } = req.params;
      const deletedMaterial = db.prepare('SELECT * FROM deleted_materials WHERE id = ?').get(id);
      if (!deletedMaterial) return res.status(404).json({ error: '删除记录不存在' });
      db.prepare(`INSERT INTO materials (id, user_id, project_name, material_name, supplier_name, specifications, quantity, unit, arrival_time, photo_path, ocr_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(deletedMaterial.id, deletedMaterial.user_id, deletedMaterial.project_name, deletedMaterial.material_name, deletedMaterial.supplier_name, deletedMaterial.specifications, deletedMaterial.quantity, deletedMaterial.unit, deletedMaterial.arrival_time, deletedMaterial.photo_path || '', deletedMaterial.ocr_text || '');
      db.prepare('DELETE FROM deleted_materials WHERE id = ?').run(id);
      logAction(req, 'restore', 'material', id, deletedMaterial.material_name, '从回收站恢复材料');
      res.json({ success: true, message: '材料恢复成功' });
    } catch (error) {
      console.error('恢复材料错误:', error);
      res.status(500).json({ error: '恢复材料失败' });
    }
  });

  // 永久删除材料（回收站中彻底删除）
  app.delete('/api/admin/deleted/materials/:id', authenticateToken, requireAdmin, (req, res) => {
    if (!isFirstAdmin(req.user.id)) {
      return res.status(403).json({ error: '仅超级管理员可以永久删除记录' });
    }
    try {
      const { id } = req.params;
      const deletedMaterial = db.prepare('SELECT * FROM deleted_materials WHERE id = ?').get(id);
      if (deletedMaterial && deletedMaterial.photo_path) {
        const photoPath = path.join(__dirname, 'data', 'uploads', path.basename(deletedMaterial.photo_path));
        if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
      }
      db.prepare('DELETE FROM deleted_materials WHERE id = ?').run(id);
      logAction(req, 'permanent_delete', 'material', id, deletedMaterial?.material_name || '', '从回收站永久删除材料');
      res.json({ success: true, message: '删除记录已清除' });
    } catch (error) {
      console.error('清除删除记录错误:', error);
      res.status(500).json({ error: '清除删除记录失败' });
    }
  });

  // 恢复已删除用户
  app.post('/api/admin/deleted/users/:id/restore', authenticateToken, requireAdmin, (req, res) => {
    if (!isFirstAdmin(req.user.id)) {
      return res.status(403).json({ error: '仅超级管理员可以恢复删除记录' });
    }
    try {
      const { id } = req.params;
      const deletedUser = db.prepare('SELECT * FROM deleted_users WHERE id = ?').get(id);
      if (!deletedUser) return res.status(404).json({ error: '删除记录不存在' });
      const existingUser = db.prepare('SELECT * FROM users WHERE username = ?').get(deletedUser.username);
      if (existingUser) return res.status(400).json({ error: '用户名已存在' });
      db.prepare('INSERT INTO users (id, username, password, display_name, real_name, phone, role, permissions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(deletedUser.id, deletedUser.username, deletedUser.password, deletedUser.display_name || '', deletedUser.real_name || '', deletedUser.phone || '', deletedUser.role || 'user', deletedUser.permissions || '{}');
      db.prepare('DELETE FROM deleted_users WHERE id = ?').run(id);
      logAction(req, 'restore', 'user', id, deletedUser.username, '从回收站恢复用户');
      res.json({ success: true, message: '用户恢复成功' });
    } catch (error) {
      console.error('恢复用户错误:', error);
      res.status(500).json({ error: '恢复用户失败' });
    }
  });

  // 永久删除用户（回收站中彻底删除）
  app.delete('/api/admin/deleted/users/:id', authenticateToken, requireAdmin, (req, res) => {
    if (!isFirstAdmin(req.user.id)) {
      return res.status(403).json({ error: '仅超级管理员可以永久删除记录' });
    }
    try {
      const { id } = req.params;
      const deletedUser = db.prepare('SELECT * FROM deleted_users WHERE id = ?').get(id);
      db.prepare('DELETE FROM deleted_users WHERE id = ?').run(id);
      logAction(req, 'permanent_delete', 'user', id, deletedUser?.username || '', '从回收站永久删除用户');
      res.json({ success: true, message: '删除记录已清除' });
    } catch (error) {
      console.error('清除删除记录错误:', error);
      res.status(500).json({ error: '清除删除记录失败' });
    }
  });

  // 恢复已删除项目
  app.post('/api/admin/deleted/projects/:id/restore', authenticateToken, requireAdmin, (req, res) => {
    if (!isFirstAdmin(req.user.id)) {
      return res.status(403).json({ error: '仅超级管理员可以恢复删除记录' });
    }
    try {
      const { id } = req.params;
      const deletedProject = db.prepare('SELECT * FROM deleted_projects WHERE id = ?').get(id);
      if (!deletedProject) return res.status(404).json({ error: '删除记录不存在' });
      const existingProject = db.prepare('SELECT * FROM projects WHERE name = ?').get(deletedProject.name);
      if (existingProject) return res.status(400).json({ error: '项目名称已存在' });
      db.prepare('INSERT INTO projects (id, name, description, user_id) VALUES (?, ?, ?, ?)')
        .run(deletedProject.id, deletedProject.name, deletedProject.description || '', deletedProject.user_id || '');
      db.prepare('DELETE FROM deleted_projects WHERE id = ?').run(id);
      logAction(req, 'restore', 'project', id, deletedProject.name, '从回收站恢复项目');
      res.json({ success: true, message: '项目恢复成功' });
    } catch (error) {
      console.error('恢复项目错误:', error);
      res.status(500).json({ error: '恢复项目失败' });
    }
  });

  // 永久删除项目（回收站中彻底删除）
  app.delete('/api/admin/deleted/projects/:id', authenticateToken, requireAdmin, (req, res) => {
    if (!isFirstAdmin(req.user.id)) {
      return res.status(403).json({ error: '仅超级管理员可以永久删除记录' });
    }
    try {
      const { id } = req.params;
      const deletedProject = db.prepare('SELECT * FROM deleted_projects WHERE id = ?').get(id);
      db.prepare('DELETE FROM deleted_projects WHERE id = ?').run(id);
      logAction(req, 'permanent_delete', 'project', id, deletedProject?.name || '', '从回收站永久删除项目');
      res.json({ success: true, message: '删除记录已清除' });
    } catch (error) {
      console.error('清除删除记录错误:', error);
      res.status(500).json({ error: '清除删除记录失败' });
    }
  });

  app.get('*', (req, res) => {
    if (fs.existsSync(frontendDistPath)) {
      res.sendFile(path.join(frontendDistPath, 'index.html'));
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  });

  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  let networkAddress = 'localhost';
  for (const name of Object.keys(networkInterfaces)) {
    for (const iface of networkInterfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        networkAddress = iface.address;
        break;
      }
    }
    if (networkAddress !== 'localhost') break;
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Network access: http://${networkAddress}:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
  });
}).catch(error => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});