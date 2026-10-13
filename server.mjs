import { fileURLToPath } from "node:url";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
const ROOT = path.dirname(fileURLToPath(import.meta.url)),
  STATIC = path.join(ROOT, "dist"),
  DATA = process.env.DATA_DIR || path.join(ROOT, ".data");
fs.mkdirSync(DATA, { recursive: true });
const db = new DatabaseSync(path.join(DATA, "developer.sqlite"));
db.exec(
  "CREATE TABLE IF NOT EXISTS verification (id TEXT PRIMARY KEY,address TEXT,contract TEXT,status TEXT,source_hash TEXT,runtime_hash TEXT,created_at TEXT,source TEXT,abi TEXT,compiler TEXT)",
);
const PEERS =
  process.env.NODE_ENV === "test" && process.env.TEST_PEERS
    ? JSON.parse(process.env.TEST_PEERS)
    : [
        "https://rpc.blockdag.engineering",
        "https://rpc.capedag.com",
        "https://rpc.dagcore.net",
      ];
const NETWORK = JSON.parse(
    fs.readFileSync(path.join(ROOT, "public/chain.json")),
  ),
  RPC = process.env.RPC_URL || "http://127.0.0.1:18545",
  rates = new Map();
let jobBusy = false,
  statusCache = null,
  statusTime = 0;
export async function rpc(method, params = [], url = RPC) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw Error("RPC HTTP " + response.status);
  const x = await response.json();
  if (x.error) throw Error(x.error.message);
  return x.result;
}
function allowed(ip) {
  const now = Date.now(),
    recent = (rates.get(ip) || []).filter((t) => now - t < 60000);
  if (recent.length >= 3) return false;
  rates.set(ip, [...recent, now]);
  if (rates.size > 10000) rates.clear();
  return true;
}
async function compile(payload) {
  if (jobBusy) throw Error("A verification is running. Please retry shortly.");
  jobBusy = true;
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ["--max-old-space-size=512", "scripts/compiler-job.mjs"],
        {
          cwd: ROOT,
          env: { PATH: process.env.PATH, NODE_ENV: "production" },
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
      let out = "";
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(Error("Compiler exceeded the 20-second job limit."));
      }, 20000);
      child.stdout.on("data", (x) => {
        out += x;
        if (out.length > 4000000) {
          child.kill("SIGKILL");
          reject(Error("Compiler output exceeds limit."));
        }
      });
      child.on("error", reject);
      child.on("close", () => {
        clearTimeout(timer);
        try {
          const x = JSON.parse(out);
          if (x.error) reject(Error(x.error));
          else resolve(x);
        } catch {
          reject(Error("Compiler could not complete this source."));
        }
      });
      child.stdin.end(JSON.stringify(payload));
    });
  } finally {
    jobBusy = false;
  }
}
async function status() {
  if (
    statusCache &&
    Date.now() - statusTime < (statusCache.checkpoint_agree ? 30000 : 10000)
  )
    return statusCache;
  const started = Date.now(),
    head = await rpc("eth_blockNumber"),
    chain = await rpc("eth_chainId"),
    checkpoint = await rpc("eth_getBlockByNumber", [
      String("0x" + (24500000).toString(16)),
      false,
    ]);
  const peers = await Promise.allSettled(
    PEERS.map(async (url) => {
      const b = await rpc(
        "eth_getBlockByNumber",
        ["0x" + (24500000).toString(16), false],
        url,
      );
      return {
        url,
        agrees:
          !!b &&
          b.hash === checkpoint.hash &&
          b.stateRoot === checkpoint.stateRoot,
      };
    }),
  );
  let overview = null;
  try {
    overview = await (
      await fetch("http://127.0.0.1:8090/api/explorer/overview", {
        signal: AbortSignal.timeout(3000),
      })
    ).json();
  } catch {}
  statusCache = {
    ok: chain === "0x57c",
    updated_at: new Date().toISOString(),
    head: parseInt(head, 16),
    chainId: parseInt(chain, 16),
    latency_ms: Date.now() - started,
    checkpoint_height: 24500000,
    checkpoint_hash: checkpoint?.hash,
    checkpoint_agree: peers.some(
      (p) => p.status === "fulfilled" && p.value.agrees,
    ),
    peers: peers.map((p, i) =>
      p.status === "fulfilled"
        ? p.value
        : { url: PEERS[i], agrees: false, error: "Unavailable" },
    ),
    overview: overview?.sample || null,
    snapshot_age: overview?.age_seconds,
    compiler: "0.8.37",
    evmVersion: "paris",
  };
  statusTime = Date.now();
  return statusCache;
}
function reply(res, code, data, type = "application/json") {
  const body =
    typeof data === "string" || Buffer.isBuffer(data)
      ? data
      : JSON.stringify(data);
  res.writeHead(code, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);
}
async function body(req) {
  let s = "";
  for await (const part of req) {
    s += part;
    if (Buffer.byteLength(s) > 131072)
      throw Error("Source request exceeds 128 KiB.");
  }
  return JSON.parse(s);
}
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".sol": "text/plain; charset=utf-8",
  ".zip": "application/zip",
};
const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, "http://localhost");
    if (req.method === "GET" && u.pathname === "/api/v1/network")
      return reply(res, 200, NETWORK);
    if (req.method === "GET" && u.pathname === "/api/v1/status")
      return reply(res, 200, await status());
    if (req.method === "GET" && u.pathname === "/api/v1/capabilities")
      return reply(res, 200, {
        schema: "macula.developer.capabilities.v1",
        profile: NETWORK.profile,
        limits: {
          ...NETWORK.rateLimit,
          body_bytes: 1048576,
          batch_calls: 50,
          log_range_blocks: 2000,
          compiler_source_bytes: 65536,
          compiler_job_seconds: 20,
          verification_per_minute: 3,
        },
        available: [
          "eth_chainId",
          "eth_blockNumber",
          "eth_getBlockByNumber",
          "eth_getTransactionReceipt",
          "eth_getBalance",
          "eth_getCode",
          "eth_call",
          "eth_estimateGas",
          "eth_getLogs",
          "eth_feeHistory",
          "eth_maxPriorityFeePerGas",
        ],
        unsupported: [
          "web3_clientVersion",
          "personal_*",
          "eth_sendTransaction",
          "debug_*",
        ],
        signed_broadcast: "eth_sendRawTransaction: caller-signed only",
        historical_index: "rolling explorer window, not a full-chain index",
        websocket: "not published",
        compiler: {
          version: "0.8.37",
          target: "paris",
          openzeppelin: { core: "5.6.1", nft: "4.9.6" },
        },
      });
    if (req.method === "GET" && u.pathname === "/api/v1/templates")
      return reply(
        res,
        200,
        fs.readFileSync(path.join(ROOT, "public/templates.json")),
      );
    if (req.method === "GET" && u.pathname === "/api/v1/receipt") {
      const hash = u.searchParams.get("hash");
      if (!/^0x[0-9a-fA-F]{64}$/.test(hash || ""))
        return reply(res, 400, { error: "Invalid transaction hash" });
      const receipt = await rpc("eth_getTransactionReceipt", [hash]);
      if (!receipt)
        return reply(res, 200, { status: "pending", receipt: null });
      const checks = await Promise.allSettled(
        [
          "https://rpc.blockdag.engineering",
          "https://rpc.capedag.com",
          "https://rpc.dagcore.net",
        ].map(async (url) => {
          const r = await rpc("eth_getTransactionReceipt", [hash], url);
          return {
            url,
            matches:
              !!r &&
              r.blockHash === receipt.blockHash &&
              r.status === receipt.status,
          };
        }),
      );
      return reply(res, 200, {
        status: receipt.status === "0x1" ? "mined" : "reverted",
        receipt,
        independent_match: checks.some(
          (r) => r.status === "fulfilled" && r.value.matches,
        ),
        checks: checks.map((r) =>
          r.status === "fulfilled"
            ? r.value
            : { matches: false, error: "Unavailable" },
        ),
      });
    }
    if (req.method === "GET" && u.pathname === "/api/v1/verification") {
      const address = u.searchParams.get("address");
      if (!/^0x[0-9a-fA-F]{40}$/.test(address || ""))
        return reply(res, 400, { error: "Invalid contract address" });
      return reply(
        res,
        200,
        db
          .prepare(
            "SELECT id,address,contract,status,source_hash,runtime_hash,created_at,source,abi,compiler FROM verification WHERE address=? ORDER BY created_at DESC",
          )
          .all(address.toLowerCase()),
      );
    }
    if (req.method === "POST" && u.pathname === "/api/v1/verification") {
      const ip =
        req.headers["cf-connecting-ip"] ||
        req.headers["x-forwarded-for"] ||
        req.socket.remoteAddress;
      if (!allowed(ip)) {
        res.setHeader("Retry-After", "60");
        return reply(res, 429, {
          error: "Verification limit reached. Retry in one minute.",
        });
      }
      const p = await body(req);
      if (
        !/^0x[0-9a-fA-F]{40}$/.test(p.address || "") ||
        !/^contracts\/[A-Za-z0-9_-]{1,64}\.sol$/.test(p.filename || "") ||
        !/^\w{1,64}$/.test(p.contract || "") ||
        typeof p.source !== "string" ||
        p.source.length > 65536
      )
        return reply(res, 400, {
          error:
            "Provide a valid address, contract name and contracts/Name.sol source (at most 64 KiB).",
        });
      const s = await status();
      if (!s.ok || !s.checkpoint_agree)
        return reply(res, 503, {
          error: "Network checkpoint verification is unavailable.",
        });
      const c = await compile(p);
      if (Object.keys(c.artifact.immutableReferences || {}).length)
        return reply(res, 422, {
          error:
            "This runtime contains immutable values. Exact runtime verification is not supported for this profile; use the full compiler metadata workflow.",
        });
      const code = await rpc("eth_getCode", [p.address, "latest"]);
      if (code === "0x")
        return reply(res, 422, { error: "No contract code at this address." });
      const match = code.toLowerCase() === c.artifact.runtime.toLowerCase();
      if (!match)
        return reply(res, 422, {
          error:
            "Compiled runtime does not match the code returned by the node.",
          status: "mismatch",
        });
      const id = crypto
          .createHash("sha256")
          .update(p.address.toLowerCase() + p.source)
          .digest("hex")
          .slice(0, 32),
        sourceHash = crypto.createHash("sha256").update(p.source).digest("hex"),
        runtimeHash = crypto.createHash("sha256").update(code).digest("hex");
      if (
        db.prepare("SELECT COUNT(*) AS n FROM verification").get().n >= 500 &&
        !db.prepare("SELECT id FROM verification WHERE id=?").get(id)
      )
        return reply(res, 503, {
          error: "Verification registry capacity reached.",
        });
      db.prepare(
        "INSERT OR REPLACE INTO verification VALUES (?,?,?,?,?,?,?,?,?,?)",
      ).run(
        id,
        p.address.toLowerCase(),
        p.contract,
        "exact-runtime-match",
        sourceHash,
        runtimeHash,
        new Date().toISOString(),
        p.publish === true ? p.source : null,
        p.publish === true ? JSON.stringify(c.artifact.abi) : null,
        c.compiler,
      );
      return reply(res, 200, {
        id,
        status: "exact-runtime-match",
        sourcePublished: p.publish === true,
        sourceHash,
        runtimeHash,
        notice: "Source/runtime correspondence is not a security audit.",
      });
    }
    if (req.method !== "GET" && req.method !== "HEAD")
      return reply(res, 405, { error: "Method not supported" });
    let pathname = decodeURIComponent(u.pathname).replace("/remix/macula-20261013-v1/", "/remix/"),
      file = path.resolve(STATIC, "." + pathname);
    if (file !== STATIC && !file.startsWith(STATIC + path.sep))
      return reply(res, 403, { error: "Invalid path" });
    if (!fs.existsSync(file) && pathname.startsWith("/assets/")) {
      const remixFile = path.resolve(STATIC, "remix", "." + pathname);
      if (
        remixFile.startsWith(path.join(STATIC, "remix") + path.sep) &&
        fs.existsSync(remixFile)
      )
        file = remixFile;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory())
      file = path.join(file, "index.html");
    if (!fs.existsSync(file)) {
      if (path.extname(pathname))
        return reply(res, 404, { error: "Not found" });
      file = path.join(STATIC, "index.html");
    }
    const type = types[path.extname(file)] || "application/octet-stream";
    res.setHeader("Content-Type", type);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=()",
    );
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-eval' https://www.googletagmanager.com https://binaries.soliditylang.org; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https: wss: blob:; worker-src 'self' blob:; frame-src 'self' https:; frame-ancestors 'self'; object-src 'none'; base-uri 'self'",
    );
    res.setHeader(
      "Cache-Control",
      pathname.startsWith("/assets/") ? "public, max-age=86400" : "no-cache",
    );
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    reply(res, 503, { error: e.message || "Service unavailable" });
  }
});
if (process.env.NODE_ENV !== "test")
  server.listen(Number(process.env.PORT || 8120), "127.0.0.1", () =>
    console.log(
      "MACULA developer service listening on loopback port " +
        (process.env.PORT || 8120),
    ),
  );
export { server, compile };
