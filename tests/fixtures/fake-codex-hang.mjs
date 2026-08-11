process.stdout.write(`${JSON.stringify({ type: "thread.started", thread_id: "thread-hang-001" })}\n`);
process.stdout.write(`${JSON.stringify({ type: "turn.started" })}\n`);
setInterval(() => {}, 1_000);
