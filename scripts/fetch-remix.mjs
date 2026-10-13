import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "macula-remix-"));
try {
  execFileSync(
    "git",
    [
      "clone",
      "--filter=blob:none",
      "--no-checkout",
      "https://github.com/remix-project-org/remix-live.git",
      dir,
    ],
    { stdio: "inherit" },
  );
  execFileSync(
    "git",
    ["sparse-checkout", "set", "--no-cone", "/*", "!/*.zip", "!/*.map"],
    { cwd: dir, stdio: "inherit" },
  );
  execFileSync(
    "git",
    ["checkout", "b8ff3b694dc1d71840fa72a83c8e1be050fc1b02"],
    { cwd: dir, stdio: "inherit" },
  );
  fs.mkdirSync("public/remix", { recursive: true });
  fs.cpSync(dir, "public/remix", {
    recursive: true,
    filter: (p) => !p.includes("/.git") && !/\.(zip|map|md)$/.test(p),
  });
  const p = "public/remix/index.html";
  fs.writeFileSync(
    p,
    fs
      .readFileSync(p, "utf8")
      .replace('<base href="/"', '<base href="/remix/"'),
  );
  for (const f of fs
    .readdirSync("public/remix")
    .filter((f) => f.endsWith(".js"))) {
    const p = "public/remix/" + f;
    fs.writeFileSync(
      p,
      fs
        .readFileSync(p, "utf8")
        .replace(
          '__webpack_require__.p=\"/\"',
          '__webpack_require__.p=\"/remix/\"',
        ),
    );
  }
  const r = await fetch(
    "https://raw.githubusercontent.com/remix-project-org/remix-project/v2.6.6/LICENSE",
  );
  if (!r.ok) throw Error("Cannot retrieve upstream license");
  fs.writeFileSync("public/remix/UPSTREAM-LICENSE", await r.text());
  fs.copyFileSync(
    "node_modules/solc/soljson.js",
    "public/remix/assets/js/soljson.js",
  );
  fs.writeFileSync(
    "public/remix/MACULA-MODIFICATIONS.txt",
    "MACULA modifies base href and Webpack public path to /remix/. Upstream build b8ff3b694dc1d71840fa72a83c8e1be050fc1b02. See UPSTREAM-LICENSE.",
  );
  await import("./patch-remix.mjs");
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
