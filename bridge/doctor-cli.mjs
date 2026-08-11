import { createBridgeConfig } from "./config.mjs";
import { runDoctor } from "./doctor.mjs";

const report = await runDoctor(createBridgeConfig());
if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  const symbol = { pass: "✓", warn: "!", fail: "×" };
  process.stdout.write("\n内容工作站环境检查\n\n");
  for (const check of report.checks) {
    process.stdout.write(`${symbol[check.status]} ${check.message}\n`);
    if (check.fix) process.stdout.write(`  处理方式：${check.fix}\n`);
  }
  process.stdout.write(`\n检查结果：${report.overall === "pass" ? "可以启动内容工作站" : report.overall === "warn" ? "可以启动，但有提醒项" : "请先处理失败项"}\n\n`);
}
if (report.overall === "fail") process.exitCode = 1;
