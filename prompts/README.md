# Session 启动提示词

> 每个角色一个文件，**完整复制粘贴**到新的 AI 开发工具 Session 即可。

## 使用方式

1. 打开对应角色的 `.md` 文件
2. PM 需要将 `{BOT_NAME}` 替换为实际 Bot 名（如 `party-bot`）
3. 全选 → 复制 → 粘贴到新 Session 的第一条消息
4. AI 会自动读取项目文件、确认角色、汇报状态、开始工作

## 文件清单

| 文件 | 角色 | 替换变量 | 适用场景 |
|------|------|---------|---------|
| `PA.md` | 架构师 | 无 | 维护 framework、原子Skill、生产部署 |
| `PM.md` | 项目经理 | `{BOT_NAME}` | 开发 Bot 配置、组合 Skill、本地测试 |
| `PC.md` | 运营协调 | 无 | 日报/周报、宣传材料 |

## PM 提示词使用示例

开发党建 Bot 时：
1. 打开 `PM.md`
2. 全文搜索替换 `{BOT_NAME}` → `party-bot`
3. 复制粘贴到新 Session

## 多 PM 并行

- PM A：用 `PM.md`（替换为 `party-bot`）→ 新的 Session
- PM B：用 `PM.md`（替换为 `project-bot`）→ 另一个新的 Session
- 两个 Session 互不干扰，各自工作在自己的 Bot 目录下

## PO 注意事项

PO（产品总监）是真人，不使用 AI Session。PO 的职责：
- 向 PM 提供需求、场景和验收标准
- 向 PA 提供新技术调研方向
- 验收 PM 交付的 Bot 效果
- 协调各角色之间的依赖和阻塞
