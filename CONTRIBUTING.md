# 贡献指南

## 开发模式

本项目采用 **Vibecoding** 模式：人类定义需求和审查设计，AI（Codex、CloudCode、Cursor 等）负责编码和测试。

## 角色体系

| 代号 | 角色 | 职责 | 可以改 | 不能碰 |
|------|------|------|--------|--------|
| **PO** | 产品总监 | 提需求、验收、拍板 | — | — |
| **PA** | 架构师 | framework、原子Skill、规范、生产部署 | `packages/` `framework/` | `bots/` `composite-skills/` |
| **PM** | 项目经理 | Bot 配置 + 组合Skill + 本地测试 | `bots/{name}/` `composite-skills/` | `packages/` `framework/` 其他Bot |
| **PC** | 运营协调 | 日报/周报/宣传材料 | `docs/pc/` | 其他所有 |

**权限红线**：
- PA 独占生产服务器部署权限
- PM 不能动 `packages/` 和 `framework/`
- PC 不能动任何代码

## 多工具兼容

所有规范文件为纯 Markdown，不依赖任何特定 AI 工具。

## 开发流程

```
PO 提需求 → PM 开发 Bot + Skill → 本地测试通过 → PO 验收 → PA 部署到生产
                                         ↕
                                    PC 汇总日报/周报
```

1. **需求讨论**（PO + PM/PA）：明确场景、方案、验收标准
2. **本地开发**（PM）：pa-bot + 本地服务，跑通所有测试
3. **测试验证**：`npx vitest run` + `npx tsx scripts/pre-commit-scan.ts` + 集成测试 + 场景测试
4. **PO 验收**：在企业微信中实际交互验证效果
5. **生产部署**（PA）：创建正式 Bot 凭据 → Docker 部署 → 验收

## 多 PM 并行

- 各 PM 独立 Session，独立 pa-bot 凭据
- 通过 Git 分支隔离，合入通过 PR
- 不跨 Bot 修改

## 分支策略

```
main ← 生产就绪
  ├─ develop ← 集成分支
  │   ├─ feature/<描述>
  │   ├─ skill/<名称>
  │   └─ bot/<名称>
  └─ release/v<版本>
```

## Commit 格式

```
<type>(<scope>): <描述>
[AI: <tool>]
```

## 安全自检

```bash
npx tsx scripts/pre-commit-scan.ts
```
