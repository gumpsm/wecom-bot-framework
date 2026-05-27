# ============================================
# 企业微信智能机器人框架 — Docker 镜像
# 
# 构建：docker build -t wecom-bot-framework .
# 运行：docker compose up -d
# ============================================

FROM node:22-alpine

# 安全：创建非 root 用户
RUN addgroup -g 1001 botgroup && \
    adduser -u 1001 -G botgroup -s /bin/sh -D botuser

WORKDIR /app

# 复制全部源码（.dockerignore 排除 node_modules/logs/.git 等）
COPY --chown=botuser:botgroup . .

# 安装依赖（含 tsx，用于运行时执行 TypeScript）
RUN npm install --ignore-scripts && \
    npm cache clean --force

# 切换到非 root 用户
USER botuser

# 健康检查：用进程存活判断
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
    CMD pgrep -f "tsx packages/server" > /dev/null || exit 1

# 入口（BOT_NAME 在 docker-compose environment 中设置）
CMD ["sh", "-c", "npx tsx packages/server/src/index.ts"]
