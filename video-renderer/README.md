# Remotion V0 样片工程

这是内容工作站的视频技术闸门，独立于现有 Web、Codex Bridge 和 HTML 录屏生产链路。

## 安装与验证

```bash
npm install
npm run validate:sample
npm test
npm run typecheck
```

## 预览与渲染

```bash
npm run studio
npm run still:sample
npm run render:sample
```

- Studio：`http://localhost:3100/`
- 输入：`fixtures/sample-scene-plan.json`
- Poster：`output/sample-poster.png`
- MP4：`output/sample-16x9.mp4`

`output/` 与 `node_modules/` 不进入 Git。固定样片为 1920×1080、30fps、900 帧、30 秒，并包含开场、观点、流程、对比、后台示意和总结六种场景。工作站运行时还支持 9000 帧（5 分钟）和 14400 帧（8 分钟）合同；长视频在场景边界按约 1800 帧拆段，检查点保存在任务工作区的 `output/render-checkpoint.json`，分段保存在 `output/segments/`，继续同一任务时会复用通过大小与方案哈希校验的分段。

Remotion `4.0.508` 使用特殊许可证。当前安装包说明：个人、最多 3 名员工的营利组织、非营利组织和评估使用符合免费许可资格；更大的营利组织需要公司许可证。对外开放内容工作站前应再次核对当时的官方许可证，不能仅依据本样片结论。
