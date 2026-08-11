import { createBridgeConfig } from "./config.mjs";
import { runDoctor } from "./doctor.mjs";

const report = await runDoctor(createBridgeConfig());
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (report.overall === "fail") process.exitCode = 1;
