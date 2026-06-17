# 市政景观项目现场数据采集APP

一个用于市政景观项目现场数据采集的移动端应用，支持手动录入、拍照OCR识别、本地存储和云端同步。

## 功能特性

- ✅ 用户注册和登录
- ✅ 手动录入材料信息（名称、供应商、规格、数量、到货时间）
- ✅ 拍照识别送货单（OCR）
- ✅ 本地存储（离线可用）
- ✅ 云端数据同步
- ✅ Excel/CSV导出
- ✅ 微信/QQ分享

## 技术栈

### 后端
- Node.js + Express
- SQLite 数据库
- JWT 认证
- bcrypt 密码加密

### 前端
- React + Vite
- Ant Design Mobile
- Tesseract.js (OCR)
- IndexedDB (本地存储)
- xlsx (Excel导出)

## 快速开始

### 1. 安装依赖

```bash
# 后端依赖
cd backend
npm install

# 前端依赖
cd ../frontend
npm install
```

### 2. 启动后端服务

```bash
cd backend
npm start
```

后端服务将在 http://localhost:5006 运行

### 3. 启动前端应用

```bash
cd frontend
npm run dev
```

前端应用将在 http://localhost:4005 运行

### 4. 访问应用

打开浏览器访问 http://localhost:3000

首次使用需要注册账户，之后可以登录使用所有功能。

## 项目结构

```
├── backend/
│   ├── server.js          # 主服务器文件
│   ├── database.js        # 数据库配置
│   ├── auth.js            # 认证中间件
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── pages/         # 页面组件
    │   │   ├── HomePage.jsx
    │   │   ├── LoginPage.jsx
    │   │   ├── RegisterPage.jsx
    │   │   ├── AddMaterialPage.jsx
    │   │   ├── MaterialListPage.jsx
    │   │   ├── MaterialDetailPage.jsx
    │   │   └── ExportPage.jsx
    │   ├── context/
    │   │   └── AuthContext.jsx
    │   ├── utils/
    │   │   ├── api.js
    │   │   ├── db.js
    │   │   ├── ocr.js
    │   │   └── export.js
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    └── package.json
```

## API 接口

### 认证接口
- `POST /api/register` - 用户注册
- `POST /api/login` - 用户登录
- `GET /api/user` - 获取当前用户信息

### 数据接口（需认证）
- `GET /api/materials` - 获取材料列表
- `POST /api/materials` - 创建材料记录
- `GET /api/materials/:id` - 获取材料详情
- `PUT /api/materials/:id` - 更新材料
- `DELETE /api/materials/:id` - 删除材料

- `GET /api/projects` - 获取项目列表
- `POST /api/projects` - 创建项目
- `DELETE /api/projects/:id` - 删除项目

- `GET /api/stats` - 获取统计数据
- `GET /api/export/materials` - 导出材料数据

### 公共接口
- `GET /health` - 健康检查