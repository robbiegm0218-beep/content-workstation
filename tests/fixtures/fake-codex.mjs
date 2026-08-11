const shouldFail = process.env.FAKE_CODEX_EXIT === "2";

process.stdout.write(`${JSON.stringify({ type: "thread.started", thread_id: "thread-test-001" })}\n`);
if (shouldFail) {
  process.stdout.write(`${JSON.stringify({ type: "turn.failed", error: { message: "fixture failure" } })}\n`);
  process.exitCode = 2;
} else {
  process.stdout.write(`${JSON.stringify({
    type: "item.completed",
    item: { type: "agent_message", text: "{\"ok\":true}" }
  })}\n`);
}
