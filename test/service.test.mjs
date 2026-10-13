import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const t = JSON.parse(fs.readFileSync("public/templates/counter.json"));
let code = t.artifacts.Counter.runtime,
  reads = 0;
const fake = http.createServer(async (req, res) => {
  let body = "";
  for await (const x of req) body += x;
  const q = JSON.parse(body);
  reads++;
  const result =
    q.method === "eth_chainId"
      ? "0x57c"
      : q.method === "eth_blockNumber"
        ? "0x175e001"
        : q.method === "eth_getCode"
          ? code
          : q.method === "eth_getTransactionReceipt"
            ? null
            : {
                hash: "0x" + "11".repeat(32),
                stateRoot: "0x" + "22".repeat(32),
              };
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ jsonrpc: "2.0", id: 1, result }));
});
await new Promise((r) => fake.listen(0, "127.0.0.1", r));
const url = "http://127.0.0.1:" + fake.address().port;
process.env.NODE_ENV = "test";
process.env.RPC_URL = url;
process.env.TEST_PEERS = JSON.stringify([url, url]);
const data = fs.mkdtempSync(path.join(os.tmpdir(), "macula-verification-"));
process.env.DATA_DIR = data;
const { server } = await import("../server.mjs");
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = "http://127.0.0.1:" + server.address().port;
const post = (body, ip) =>
  fetch(base + "/api/v1/verification", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip },
    body: JSON.stringify(body),
  });
const p = {
  address: "0x" + "ab".repeat(20),
  filename: t.filename,
  source: t.source,
  contract: t.name,
};
test("network status is independently checked and cached", async () => {
  const a = await (await fetch(base + "/api/v1/status")).json();
  assert.equal(a.checkpoint_agree, true);
  const n = reads;
  await fetch(base + "/api/v1/status");
  assert.equal(reads, n);
});
test("exact runtime verifier persists opt-in source and rejects mismatch", async () => {
  let r = await post({ ...p, publish: false }, "test1");
  assert.equal(r.status, 200);
  assert.equal((await r.json()).status, "exact-runtime-match");
  let records = await (
    await fetch(base + "/api/v1/verification?address=" + p.address)
  ).json();
  assert.equal(records[0].source, null);
  r = await post({ ...p, publish: true }, "test1");
  assert.equal(r.status, 200);
  records = await (
    await fetch(base + "/api/v1/verification?address=" + p.address)
  ).json();
  assert.equal(records[0].source, p.source);
  code = "0x6000";
  r = await post(p, "test1");
  assert.equal(r.status, 422);
  assert.equal((await r.json()).status, "mismatch");
  r = await post(p, "test1");
  assert.equal(r.status, 429);
  code = t.artifacts.Counter.runtime;
});
test("invalid source fields, invalid hashes and disallowed methods are rejected", async () => {
  let r = await post({ ...p, filename: "../../secret" }, "test2");
  assert.equal(r.status, 400);
  r = await fetch(base + "/api/v1/receipt?hash=invalid");
  assert.equal(r.status, 400);
  r = await fetch(base + "/api/v1/verification?address=no");
  assert.equal(r.status, 400);
  r = await fetch(base + "/api/v1/network", { method: "DELETE" });
  assert.equal(r.status, 405);
});
test("compiler errors fail without recording a match", async () => {
  const r = await post({ ...p, source: "invalid Solidity!" }, "test3");
  assert.equal(r.status, 503);
  assert.match((await r.json()).error, /ParserError/);
});
test.after(async () => {
  await new Promise((r) => server.close(r));
  await new Promise((r) => fake.close(r));
  fs.rmSync(data, { recursive: true, force: true });
});
