# 安全说明

## 本地运行边界

- 内容工作站按单机工具设计，网页与 Codex Bridge 只应监听本机回环地址，不应直接暴露到公网。
- Codex 登录凭据由本机 Codex CLI 管理；仓库和工作站不会读取、展示或提交认证文件。
- `.data/`、`work/`、`outputs/`、`.env*` 和生成产物不进入 Git。提交前可运行 `npm run check:privacy`。

## 依赖审计

发布前执行：

```bash
npm audit --omit=dev
npm audit
npm run test:ci
```

当前生产依赖审计为 0 项。开发依赖仍有两条上游链路、共 6 项报告：

- `drizzle-kit` 间接依赖旧版 `esbuild`；只在手工执行 `npm run db:generate` 时使用，不由本地工作站运行时启动。
- `vinext` 固定依赖 `image-size@2.0.2`；上游尚未发布修复版本。当前工作站只处理其自身生成或用户确认的 PNG、JPEG、SVG 封面，不接收 ICNS、JXL 或 HEIF 文件作为公开输入。

不要执行 `npm audit fix --force`：当前建议会降级 `drizzle-kit` 和 `vinext`，可能破坏构建及本地运行。待上游发布兼容修复后，再升级并执行完整回归。

## 报告问题

公开发布后如发现安全问题，请通过仓库的 Security Advisory 私下报告，不要在 Issue 中粘贴密钥、认证文件或个人内容。
