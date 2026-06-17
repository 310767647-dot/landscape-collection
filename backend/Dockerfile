# 使用 Node.js 20 作为基础镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 先复制依赖文件，利用 Docker 缓存
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

# 复制源代码
COPY . .

# 构建前端
RUN cd frontend && npm run build

# 创建数据目录（挂载点）
RUN mkdir -p /app/backend/data

# 设置工作目录到后端
WORKDIR /app/backend

# 暴露端口
EXPOSE 5006

# 启动
CMD ["node", "server.js"]
