#!/bin/bash
# ============================================
# 企业微信智能机器人框架 — 服务器部署脚本
# 在腾讯云服务器上执行（Ubuntu 24.04）
# ============================================

set -e

echo "===== Step 1: 安装 Docker ====="
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker ubuntu
    echo "Docker 安装完成，请重新登录使 docker 组生效"
else
    echo "Docker 已安装: $(docker --version)"
fi

echo ""
echo "===== Step 2: 安装 Docker Compose 插件 ====="
if ! docker compose version &> /dev/null; then
    sudo apt update && sudo apt install -y docker-compose-v2
    echo "Docker Compose 安装完成"
else
    echo "Docker Compose 已安装: $(docker compose version)"
fi

echo ""
echo "===== Step 3: 克隆项目 ====="
cd ~
if [ ! -d "wecom-bot-framework" ]; then
    git clone <REPO_URL> wecom-bot-framework
else
    cd wecom-bot-framework && git pull
fi

echo ""
echo "===== Step 4: 配置 Bot 环境变量 ====="
cd ~/wecom-bot-framework
echo "请确保已创建以下文件（参考 .env.example）："
echo "  bots/pa-bot/.env"
echo "  bots/project-bot/.env"
echo "  bots/party-bot/.env"

echo ""
echo "===== Step 5: 构建并启动 ====="
docker compose build
docker compose up -d

echo ""
echo "===== Step 6: 验证 ====="
sleep 5
docker compose ps
echo ""
echo "查看日志: docker compose logs -f bot-test"
