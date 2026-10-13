import {suiteHeader} from "./suite-navigation.js";
import "./suite-navigation.css";
import "./styles.css";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { keymap } from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  BrowserProvider,
  JsonRpcProvider,
  ContractFactory,
  Contract,
  Interface,
  keccak256,
  toUtf8Bytes,
  AbiCoder,
} from "ethers";
import { zipSync, strToU8 } from "fflate";
import { contractArtifacts } from "./lib/compiler-input.js";
const templates = await (await fetch("/templates.json")).json(),
  network = await (await fetch("/chain.json")).json();
const state = {
  template: null,
  artifact: null,
  artifacts: null,
  input: null,
  source: "",
  sandbox: null,
  deployed: null,
  mode: "sandbox",
  signer: null,
  account: null,
  editor: null,
  busy: false,
  worker: null,
  compileId: 0,
};
const $ = (id) => document.getElementById(id),
  esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    ),
  pretty = (x) =>
    JSON.stringify(x, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2),
  short = (x) => (x ? x.slice(0, 8) + "…" + x.slice(-6) : ""),
  link = (id) => "#/playground?template=" + id;
function toast(s) {
  document.querySelector(".toast")?.remove();
  const d = document.createElement("div");
  d.className = "toast";
  d.setAttribute("role", "status");
  d.textContent = s;
  document.body.append(d);
  setTimeout(() => d.remove(), 4000);
}
function saveFile(name, data, type = "application/json") {
  const u = URL.createObjectURL(new Blob([data], { type })),
    a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
function output(s, error = false) {
  const e = $("output");
  if (e) {
    e.textContent = typeof s === "string" ? s : pretty(s);
    e.classList.toggle("error", error);
  }
}
function busy(v) {
  state.busy = v;
  document
    .querySelectorAll("button[data-job]")
    .forEach((b) => (b.disabled = v));
  if ($("compile")) $("compile").textContent = v ? "Working…" : "Compile";
  if ($("deploy")) $("deploy").disabled = v || !state.artifact;
  if ($("guided")) $("guided").disabled = v || state.template?.id !== "counter";
  for (const id of ["call", "sandbox-verify"])
    if ($(id)) $(id).disabled = v || !state.deployed;
}
async function job(fn) {
  busy(true);
  try {
    await fn();
  } catch (e) {
    output(e.shortMessage || e.message || String(e), true);
  } finally {
    busy(false);
  }
}
const header = route => `<a class="skip" href="#main">Skip to developer tools</a>`+suiteHeader({active:route==='/status'?'network':'developers',section:'Developer tools',current:route,items:[['/','Overview','#/'],['/playground','Playground','#/playground'],['/contracts','Contracts','#/contracts'],['/docs','Docs & API','#/docs'],['/verify','Verify','#/verify'],['/projects','Community','#/projects']]});
const footer = `<footer class="wrap footer"><p>MACULA (Pty) Ltd · Registration 2013/028237/07<br>Art &amp; Design Centre, 72 Loop Street, Cape Town, 8001, South Africa</p><nav aria-label="Footer"><a href="https://explorer.macula.co.za/" target="_blank" rel="noopener">Explorer</a><a href="https://macula.co.za/privacy">Privacy</a><a href="https://macula.co.za/contact">Contact</a></nav></footer>`;
function rows(list) {
  return `<div class="catalog">${list.map((t) => `<article class="template-row"><h3>${esc(t.title)}</h3><p>${esc(t.description)}</p><span class="level">${esc(t.level)}</span><a class="button secondary" href="${link(t.id)}">Open example</a></article>`).join("")}</div>`;
}
function home() {
  return `<div class="home-intro"><div><h1>Build on BlockDAG.</h1><p class="lead">Write your first contract, run it in a sandbox, then connect to Macula’s RPC when you’re ready.</p><div class="actions"><a class="button" href="${link("counter")}">Open the playground</a><a class="button secondary" href="#/docs">Read the quickstart</a></div><p class="hint">Start with fake funds. No wallet needed.</p></div><div class="preview"><div class="preview-head"><span>Counter.sol</span><span>Solidity ${network.compiler} · Paris</span></div><pre><code>contract Counter {
    uint256 public number;

    function increment() external {
        number += 1;
    }
}</code></pre><div class="steps">Compile → deploy → increment → read.<br><a href="/remix/macula-20261013-v1/#optimize=true&runs=200&evmVersion=paris&version=soljson-v0.8.37%2Bcommit.f401782d.js&activate=solidity" target="_blank" rel="noopener">Prefer the full IDE? Open Remix</a></div></div></div><div class="start-grid"><section class="section"><div class="section-head"><h2>Start with an example</h2><a href="#/contracts">All eight contracts</a></div>${rows(templates.filter(t=>t.level==='Beginner'))}<p class="hint library-note">Sandbox-tested teaching projects. Review your application before using real funds.</p></section><aside class="section connect-panel"><h2>Connect your application</h2><p class="muted">Use Macula’s public RPC for chain reads and wallet-signed transactions.</p><div class="copy-row"><code>https://rpc.macula.co.za/</code><button class="secondary" data-copy="https://rpc.macula.co.za/">Copy</button></div><dl class="network-facts"><div><dt>Network</dt><dd>BlockDAG · 1404</dd></div><div><dt>Gas currency</dt><dd>BDAG</dd></div><div><dt>Compiler target</dt><dd>Paris</dd></div></dl><a href="#/docs?section=network">Network setup & API documentation</a><div class="explorer-bridge"><h3>Follow your transactions</h3><p class="muted">Search blocks, addresses and transaction receipts in the Macula Explorer.</p><a href="https://explorer.macula.co.za/">Open Explorer</a></div></aside></div>`;
}
function contracts() {
  return `<h1>Start with a working example.</h1><p class="lead">Solidity ${network.compiler}, Paris target, OpenZeppelin 5.6.1 for core components and 4.9.6 for the compatible NFT examples. Every example includes source, artifacts and executable tests.</p>${rows(templates)}<div class="notice" style="margin-top:24px">The NFT examples deliberately use a separate compatible library release. Keep the supplied imports and compiler target. Upgrades are an advanced track, not a default for new applications.</div>`;
}
function playground() {
  return `<div class="work-header"><div><h1>Solidity playground</h1><p class="muted">Edit, compile and run. Your source is saved locally in this browser.</p></div><label class="mode">Environment <select id="mode"><option value="sandbox">Sandbox · fake funds · 31337</option><option value="mainnet">Mainnet · real BDAG · 1404</option></select></label></div><div class="notice" id="environment-note">The sandbox executes real EVM bytecode in your browser. Its accounts and contracts do not exist on mainnet.</div><div class="workspace"><section class="editor-panel"><div class="toolbar"><select id="template" aria-label="Contract example">${templates.map((t) => `<option value="${t.id}">${esc(t.title)}</option>`).join("")}</select><span>Solidity ${network.compiler} · Paris</span></div><div id="editor"></div><div class="editor-bottom"><button id="export-source" class="secondary">Export source</button><button id="export-project" class="secondary" data-job>Export project ZIP</button><button id="reset-source" class="secondary">Reset example</button><a class="button secondary" id="remix-open" href="/remix/macula-20261013-v1/#optimize=true&runs=200&evmVersion=paris&version=soljson-v0.8.37%2Bcommit.f401782d.js&activate=solidity" target="_blank" rel="noopener">Full Remix IDE</a></div></section><aside class="console-panel"><div class="step"><h2>Compile</h2><p class="hint">Imports resolve to the locally packaged, pinned libraries.</p><button id="compile" data-job>Compile</button><select id="contract-name" aria-label="Compiled contract" hidden></select></div><div class="step"><h2>Deploy</h2><p id="deploy-note" class="hint">Deployment uses fake funds in the browser sandbox.</p><div class="actions"><button id="connect" class="secondary" hidden>Connect wallet</button><button id="new-sandbox" class="secondary">New sandbox</button></div><p class="wallet-details" id="account"></p><label for="constructor-args">Constructor arguments · JSON array</label><input id="constructor-args" value="[]" spellcheck="false"><button id="deploy" data-job disabled>Deploy to sandbox</button><button id="guided" class="secondary" data-job>Run Counter walkthrough</button></div><div class="step"><h2>Interact</h2><p class="hint" id="contract-address">Deploy a contract to enable its functions.</p><div class="function-line"><select id="function" aria-label="Contract function" disabled><option>No deployed contract</option></select></div><label for="function-args">Function arguments · JSON array</label><input id="function-args" value="[]" spellcheck="false"><button id="call" class="secondary" data-job disabled>Run function</button><button id="sandbox-verify" class="secondary" data-job disabled>Check sandbox runtime</button></div><div class="step"><h2>Results</h2><div id="output" class="output" role="status">Choose an example, then compile it.</div></div></aside></div>`;
}
function docs() {
  return `<div class="docs"><nav class="doc-nav" aria-label="Documentation"><a href="#/docs?section=quickstart">Quickstart</a><a href="#/docs?section=network">Network configuration</a><a href="#/docs?section=workflow">Deployment workflow</a><a href="#/docs?section=api">RPC & API</a><a href="#/docs?section=remix">Full Remix</a><a href="#/docs?section=tools">Local tools & tests</a></nav><article class="prose"><h1>Build, test, then deploy.</h1><h2 id="quickstart">Your first contract</h2><ol><li>Open the Counter in the Playground. Keep Sandbox selected.</li><li>Compile, then choose Run Counter walkthrough. It deploys bytecode, increments the counter and reads back 1.</li><li>Change the code or use individual functions. Results include transaction hashes, gas used and emitted logs.</li><li>Export the project ZIP. Browser storage is convenient, but it is not a backup.</li></ol><a class="button" href="${link("counter")}">Open Counter</a><h2 id="network">Network configuration</h2><div class="copy-row"><code>https://rpc.macula.co.za/</code><button class="secondary" data-copy="https://rpc.macula.co.za/">Copy RPC</button></div><pre>${esc(pretty(network))}</pre><p class="muted">Chain 1404 uses native BDAG with 18 decimals. A different history can use the same chain ID. The Mainnet workflow compares your wallet’s checkpoint with the Macula node before signing.</p><h2 id="workflow">From sandbox to mainnet</h2><ol><li>Finish tests and review permissions, supply and constructor arguments.</li><li>Choose Mainnet. Connect a browser-extension wallet and add the Macula network if it is missing.</li><li>Your wallet must have real BDAG for gas. No mainnet faucet or gas sponsorship is provided.</li><li>Compile and deploy only when ready. The wallet displays the actual signing request.</li><li>Follow the receipt. The service compares its block hash with independent RPCs; this is evidence of observation, not a finality guarantee.</li><li>Use Verify to compare your source’s compiled runtime with the live contract. A runtime match is not a security audit.</li></ol><h2 id="api">RPC & developer APIs</h2><p class="muted">The <a href="https://explorer.macula.co.za/api/explorer/overview" target="_blank" rel="noopener">Explorer snapshot API</a> supplies the current node head, rolling block window, recent transactions and observed activity. The same data powers the Explorer dashboard.</p><p class="muted">Public RPC allows standard reads, gas estimation and caller-signed raw transaction broadcast. Unlocked-account transactions, personal/account management and debug tracing are not enabled.</p><pre>curl https://rpc.macula.co.za/ \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}'</pre><p><a href="/api/v1/network" target="_blank">Network profile</a> · <a href="/api/v1/capabilities" target="_blank">Capability manifest</a> · <a href="/api/v1/status" target="_blank">Live status</a> · <a href="/api/v1/templates" target="_blank">Templates API</a></p><p class="muted">RPC limits: 120 requests/minute, burst 30; maximum body 1 MiB, batch 50 calls, log range 2,000 blocks. Verification: 3 requests/minute, source 64 KiB, 20-second compiler timeout, one compiler job at a time. Read the capability manifest before relying on a method. Historical indexing and public WebSocket subscriptions are not provided by this release.</p><h2 id="remix">Full Remix IDE</h2><p class="muted">The full IDE is self-hosted from a pinned upstream build. The guided playground is the fastest way to use Macula’s tested compiler profile. In Remix, select the bundled compiler (${network.compiler}), optimizer enabled / 200 runs, and EVM version Paris before compiling.</p><p class="muted">Start in Remix VM. For live deployment use Browser Extension, check chain 1404 and configure the RPC as above. Do not use an unlocked-account provider against mainnet.</p><a class="button secondary" href="/remix/macula-20261013-v1/#optimize=true&runs=200&evmVersion=paris&version=soljson-v0.8.37%2Bcommit.f401782d.js&activate=solidity" target="_blank" rel="noopener">Open full Remix</a><h2 id="tools">Export and run locally</h2><pre>unzip macula-developer-starter.zip
cd macula-developer-starter
npm install --ignore-scripts
npm run compile
npm test</pre><p class="muted">The starter contains complete standard compiler inputs, pinned dependencies, all eight templates and the same Paris EVM tests. The selected editor source is included in the export. Adjust tests when changing the example’s behaviour.</p><p><a href="https://www.getfoundry.sh/anvil/index.html" target="_blank" rel="noopener">Foundry / Anvil</a> · <a href="https://remix-ide.readthedocs.io/en/latest/" target="_blank" rel="noopener">Remix documentation</a> · <a href="https://docs.openzeppelin.com/contracts/" target="_blank" rel="noopener">OpenZeppelin documentation</a></p></article></div>`;
}
function statusPage() {
  return `<h1>The network behind your build.</h1><p class="lead">Live data from DreamPIE, with an independent checkpoint comparison. These are observations of named nodes, not a count of every peer on the network.</p><div id="status-content" class="notice">Checking the node…</div><button id="refresh-status" class="secondary">Refresh status</button>`;
}
function verifyPage() {
  return `<h1>Check the source against the chain.</h1><p class="lead">Recompile with the pinned profile and compare exact runtime bytes with the contract at an address. No wallet signature is required.</p><div class="notice">Source is sent to Macula’s compiler service only when you select Verify. Publishing source is optional. Immutable-runtime profiles require a fuller metadata workflow and are reported as unsupported.</div><form id="verify-form" class="form"><div class="field"><label for="verify-address">Mainnet contract address</label><input id="verify-address" placeholder="0x…" required></div><div class="two"><div class="field"><label for="verify-filename">Source filename</label><input id="verify-filename" value="contracts/Counter.sol" required></div><div class="field"><label for="verify-name">Contract name</label><input id="verify-name" value="Counter" required></div></div><div class="field"><label for="verify-source">Solidity source</label><textarea id="verify-source" rows="15" required>${esc(templates[0].source)}</textarea></div><label class="check"><input type="checkbox" id="publish"><span>Publish the source and ABI if the runtime matches. I am authorised to publish this code.</span></label><div class="actions"><button type="submit" id="verify-submit">Verify runtime</button><button type="button" class="secondary" id="load-verified">Look up existing verification</button></div><div id="verify-result" class="output" role="status">No verification submitted.</div></form><section class="section" style="margin-top:32px"><h2>Interact with a deployed contract</h2><p class="muted">Open a compiled template in the Playground, switch to Mainnet, then load its deployed address. Read functions need no wallet; writes need your explicit wallet approval.</p><a href="#/playground">Open the Playground</a></section>`;
}
function projects() {
  return `<h1>Build with the community.</h1><p class="lead">Keep your work portable, contribute improvements and report problems with enough detail to reproduce them.</p><div class="path"><article><h3>Contribute a template</h3><p>Include source, exact compiler settings, tests, a licence and a clear explanation of permissions.</p><a id="source-repo" href="https://github.com/macula-pty-ltd/developer-platform" target="_blank" rel="noopener">Source repository</a></article><article><h3>Report a problem</h3><p>Include your network profile, steps, error message and public transaction hash. Never send a private key or recovery phrase.</p><a href="https://macula.co.za/contact">Contact Macula</a></article><article><h3>Community network</h3><p>Read the operator-maintained network information and independently verify the endpoints you use.</p><a href="https://bdag.community/chain" target="_blank" rel="noopener">BDAG community network</a></article></div><section class="section"><h2>Upstream tools</h2><p class="muted">This environment builds on Solidity, Remix, EthereumJS, ethers and OpenZeppelin. Keep the included licences and version pins when redistributing examples.</p><div class="actions"><a href="https://github.com/remix-project-org/remix-project" target="_blank">Remix source</a><a href="https://github.com/OpenZeppelin/openzeppelin-contracts" target="_blank">OpenZeppelin source</a><a href="https://github.com/ethereumjs/ethereumjs-monorepo" target="_blank">EthereumJS source</a></div></section>`;
}
async function compileSource() {
  output("Loading the pinned compiler…");
  state.worker ||= new Worker("/compiler/worker.js");
  const id = ++state.compileId;
  const source = state.source;
  const response = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          Error("Compilation timed out. Reduce the source size and retry."),
        ),
      60000,
    );
    const listener = ({ data }) => {
      if (data.id !== id) return;
      clearTimeout(timer);
      state.worker.removeEventListener("message", listener);
      data.error ? reject(Error(data.error)) : resolve(data);
    };
    state.worker.addEventListener("message", listener);
    state.worker.postMessage({ id, filename: state.template.filename, source });
  });
  if (source !== state.source)
    throw Error("Source changed during compilation. Compile again.");
  state.artifacts = contractArtifacts(response.output, state.template.filename);
  const deployable = Object.values(state.artifacts).filter(
    (a) => a.bytecode !== "0x",
  );
  if (!deployable.length) throw Error("No deployable contract was produced.");
  state.artifact =
    deployable.find((a) => a.name === state.template.name) || deployable[0];
  state.input = response.input;
  const select = $("contract-name");
  select.hidden = false;
  select.innerHTML = deployable
    .map(
      (a) =>
        `<option ${a.name === state.artifact.name ? "selected" : ""}>${esc(a.name)}</option>`,
    )
    .join("");
  output({
    compiled: state.artifact.name,
    compiler: response.version,
    target: "paris",
    runtimeBytes: (state.artifact.runtime.length - 2) / 2,
    warnings: (response.output.errors || [])
      .filter((e) => e.severity !== "error")
      .map((e) => e.formattedMessage),
  });
}
async function ensureSandbox() {
  if (!state.sandbox) {
    const { Sandbox } = await import("./lib/sandbox.js");
    state.sandbox = await Sandbox.create();
  }
  state.account = state.sandbox.accounts[0].hex;
  $("account").textContent = "Sandbox account: " + state.account;
  return state.sandbox;
}
async function walletGate() {
  if (!window.ethereum)
    throw Error(
      "A browser-extension wallet is required for Mainnet. Sandbox does not need one.",
    );
  const chain = await window.ethereum.request({ method: "eth_chainId" });
  if (chain !== "0x57c")
    throw Error("Select BlockDAG chain 1404 in your wallet before signing.");
  const r = await fetch("/api/v1/status"),
    s = await r.json();
  if (!r.ok || !s.ok || !s.checkpoint_agree)
    throw Error("Independent network checkpoint verification is unavailable.");
  const block = await window.ethereum.request({
    method: "eth_getBlockByNumber",
    params: ["0x" + s.checkpoint_height.toString(16), false],
  });
  if (!block || block.hash.toLowerCase() !== s.checkpoint_hash.toLowerCase())
    throw Error(
      "Your wallet serves a different chain history. Set its RPC to rpc.macula.co.za before signing.",
    );
  return s;
}
async function connectWallet() {
  if (!window.ethereum)
    throw Error(
      "No browser-extension wallet detected. Open this page in a wallet-enabled browser.",
    );
  await window.ethereum.request({ method: "eth_requestAccounts" });
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x57c" }],
    });
  } catch (e) {
    if (e.code === 4902)
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: network.chainIdHex,
            chainName: network.chainName,
            nativeCurrency: network.nativeCurrency,
            rpcUrls: network.rpcUrls,
            blockExplorerUrls: network.blockExplorerUrls,
          },
        ],
      });
    else throw e;
  }
  await walletGate();
  const provider = new BrowserProvider(window.ethereum);
  state.signer = await provider.getSigner();
  state.account = await state.signer.getAddress();
  $("account").textContent = "Mainnet wallet: " + state.account;
  output(
    "Wallet connected and checkpoint matched. No transaction has been requested.",
  );
}
function parseArgs(id) {
  const x = JSON.parse($(id).value);
  if (!Array.isArray(x))
    throw Error(
      "Arguments must be a JSON array. Use quoted strings for large integers.",
    );
  return x;
}
function functions() {
  const fns = new Interface(state.artifact.abi).fragments.filter(
    (f) => f.type === "function",
  );
  $("function").disabled = false;
  $("function").innerHTML = fns
    .map(
      (f) =>
        `<option value="${esc(f.format("sighash"))}">${esc(f.name)} · ${f.stateMutability === "view" || f.stateMutability === "pure" ? "read" : "write"}</option>`,
    )
    .join("");
  $("call").disabled = false;
  $("sandbox-verify").disabled = false;
  $("function").onchange = () => {
    const f = new Interface(state.artifact.abi).getFunction(
      $("function").value,
    );
    $("function-args").value = pretty(
      f.inputs.map((p) =>
        p.type === "address"
          ? state.account
          : p.type === "string"
            ? "ipfs://example"
            : p.type === "bytes32"
              ? keccak256(toUtf8Bytes("example"))
              : p.type.endsWith("[]")
                ? []
                : p.type === "bool"
                  ? true
                  : p.type === "bytes"
                    ? "0x"
                    : 0,
      ),
    );
  };
  if (fns.length) $("function").onchange();
  else {
    $("function").disabled = true;
    $("call").disabled = true;
  }
}
async function deploy() {
  if (!state.artifact) throw Error("Compile the source first.");
  let args = parseArgs("constructor-args");
  if (state.mode === "sandbox") {
    const s = await ensureSandbox();
    let d;
    if (
      state.template.id === "uups" &&
      state.artifact.name === "UpgradeableCounter" &&
      state.artifacts.BuilderProxy
    ) {
      const implementation = await s.deploy(state.artifact);
      const initialization = new Interface(
        state.artifact.abi,
      ).encodeFunctionData("initialize", [s.accounts[0].hex]);
      d = await s.deploy(state.artifacts.BuilderProxy, [
        implementation.address,
        initialization,
      ]);
      state.deployed = d.address;
      output({
        ...d,
        implementation: implementation.address,
        note: "Initialized proxy; the implementation cannot be initialized directly.",
      });
    } else if (
      state.template.id === "merkle" &&
      state.source === state.template.source
    ) {
      const token = (await (await fetch("/templates/erc20.json")).json())
        .artifacts.BuilderToken;
      const t = await s.deploy(token),
        amount = 100n,
        root = keccak256(
          keccak256(
            AbiCoder.defaultAbiCoder().encode(
              ["address", "uint256"],
              [s.accounts[0].hex, amount],
            ),
          ),
        );
      d = await s.deploy(state.artifact, [t.address, root]);
      await s.write(t.address, token.abi, "transfer", [d.address, amount]);
      state.deployed = d.address;
      output({
        ...d,
        token: t.address,
        claimArgs: ["100", []],
        note: "Sandbox fixture: distributor funded with 100 base units and a one-account Merkle root.",
      });
    } else {
      d = await s.deploy(state.artifact, args);
      state.deployed = d.address;
      output(d);
    }
  } else {
    if (state.template.id === "uups")
      throw Error(
        "Use the exported tested proxy workflow or full Remix for the two-stage mainnet deployment.",
      );
    await walletGate();
    if (!state.signer) throw Error("Connect your own wallet first.");
    output("Review the deployment in your wallet. Real BDAG gas is required.");
    const factory = new ContractFactory(
        state.artifact.abi,
        state.artifact.bytecode,
        state.signer,
      ),
      contract = await factory.deploy(...args);
    const tx = contract.deploymentTransaction();
    output({ status: "broadcast", hash: tx.hash });
    await contract.waitForDeployment();
    state.deployed = await contract.getAddress();
    const receipt = await tx.wait();
    const check = await (await fetch("/api/v1/receipt?hash=" + tx.hash)).json();
    output({
      status: check.status,
      address: state.deployed,
      hash: tx.hash,
      gasUsed: receipt.gasUsed.toString(),
      independentMatch: check.independent_match,
    });
  }
  $("contract-address").textContent =
    state.mode === "sandbox"
      ? "Sandbox contract: " + state.deployed
      : "Mainnet contract: " + state.deployed;
  functions();
}
async function callFunction() {
  if (!state.deployed) throw Error("Deploy or load a contract first.");
  const fn = $("function").value,
    args = parseArgs("function-args"),
    fragment = new Interface(state.artifact.abi).getFunction(fn),
    read = ["view", "pure"].includes(fragment.stateMutability);
  if (state.mode === "sandbox") {
    const s = await ensureSandbox();
    output(
      read
        ? await s.read(state.deployed, state.artifact.abi, fn, args)
        : await s.write(state.deployed, state.artifact.abi, fn, args),
    );
  } else {
    const provider = new JsonRpcProvider(
      network.rpcUrls[0],
      { chainId: 1404, name: "Macula" },
      { staticNetwork: true },
    );
    if (read)
      output(
        await new Contract(state.deployed, state.artifact.abi, provider)[fn](
          ...args,
        ),
      );
    else {
      await walletGate();
      if (!state.signer) throw Error("Connect a wallet to write.");
      const tx = await new Contract(
        state.deployed,
        state.artifact.abi,
        state.signer,
      )[fn](...args);
      output({ status: "broadcast", hash: tx.hash });
      await tx.wait();
      output(await (await fetch("/api/v1/receipt?hash=" + tx.hash)).json());
    }
  }
}
async function guided() {
  if (state.mode !== "sandbox")
    throw Error("The guided walkthrough runs only in Sandbox.");
  await compileSource();
  await deploy();
  const s = await ensureSandbox();
  const before = await s.read(state.deployed, state.artifact.abi, "number"),
    tx = await s.write(state.deployed, state.artifact.abi, "increment"),
    after = await s.read(state.deployed, state.artifact.abi, "number");
  output({
    test: "Counter walkthrough",
    passed: after[0] === before[0] + 1n,
    before: before[0],
    after: after[0],
    transactionHash: tx.hash,
    gasUsed: tx.gasUsed,
    eventCount: tx.logs.length,
    address: state.deployed,
    note: "Real Paris EVM execution in this browser. No mainnet transaction.",
  });
}
async function exportProject() {
  const files = {};
  const prefix = "macula-developer-starter/";
  for (const t of templates) {
    const full = await (await fetch("/templates/" + t.id + ".json")).json();
    let input = full.input;
    if (t.id === state.template?.id && state.input) input = state.input;
    for (const [sourcePath,entry] of Object.entries(input.sources)) files[prefix+sourcePath]=strToU8(entry.content);
    files[prefix + "standard-inputs/" + t.id + ".json"] = strToU8(
      pretty({ input, filename: t.filename, name: t.name }),
    );
    files[prefix + t.filename] = strToU8(
      t.id === state.template?.id ? state.source : t.source,
    );
    files[prefix + "public/templates/" + t.id + ".json"] = strToU8(
      pretty(full),
    );
  }
  const base = await (await fetch("/starter-files.json")).json();
  for (const [name, text] of Object.entries(base))
    files[prefix + name] = strToU8(text);
  saveFile(
    "macula-developer-starter.zip",
    zipSync(files, { level: 6 }),
    "application/zip",
  );
  toast("Project exported with source, compiler inputs and tests.");
}
async function bindPlayground(params) {
  const id = params.get("template") || "counter",
    t = templates.find((t) => t.id === id) || templates[0];
  state.template = t;
  state.source = localStorage.getItem("macula.dev.source." + t.id) || t.source;
  state.artifact = null;
  state.artifacts = null;
  state.input = null;
  state.deployed = null;
  $("template").value = t.id;
  $("mode").value = state.mode;
  state.editor?.destroy();
  state.editor = new EditorView({
    state: EditorState.create({
      doc: state.source,
      extensions: [
        lineNumbers(),
        history(),
        highlightActiveLine(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        EditorView.contentAttributes.of({ "aria-label": "Solidity source" }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            state.source = update.state.doc.toString();
            try {
              localStorage.setItem("macula.dev.source." + t.id, state.source);
            } catch {
              toast("Browser storage is full. Export your source.");
            }
            state.artifact = null;
            state.deployed = null;
            $("deploy").disabled = true;
            for (const id of ["call", "sandbox-verify"])
              if ($(id)) $(id).disabled = true;
          }
        }),
      ],
    }),
    parent: $("editor"),
  });
  $("template").onchange = () =>
    (location.hash = link($("template").value).slice(1));
  $("compile").onclick = () => job(compileSource);
  $("deploy").onclick = () => job(deploy);
  $("guided").onclick = () => job(guided);
  $("call").onclick = () => job(callFunction);
  $("connect").onclick = () => job(connectWallet);
  $("new-sandbox").onclick = () =>
    job(async () => {
      state.sandbox = null;
      state.deployed = null;
      await ensureSandbox();
      output(
        "New isolated sandbox created. Previous sandbox contracts are no longer available.",
      );
    });
  $("export-source").onclick = () =>
    saveFile(t.name + ".sol", state.source, "text/plain");
  $("export-project").onclick = () => job(exportProject);
  $("reset-source").onclick = () => {
    localStorage.removeItem("macula.dev.source." + t.id);
    state.editor.dispatch({
      changes: { from: 0, to: state.editor.state.doc.length, insert: t.source },
    });
    toast("Example restored.");
  };
  $("contract-name").onchange = () => {
    state.artifact = state.artifacts[$("contract-name").value];
    state.deployed = null;
    busy(false);
  };
  $("sandbox-verify").onclick = () =>
    job(async () => {
      if (state.mode !== "sandbox") {
        location.hash = "/verify";
        return;
      }
      const code = await state.sandbox.code(state.deployed),
        expected =
          state.template.id === "uups" && state.artifacts.BuilderProxy
            ? state.artifacts.BuilderProxy.runtime
            : state.artifact.runtime;
      const immutables = Object.keys(
        (state.template.id === "uups" && state.artifacts.BuilderProxy
          ? state.artifacts.BuilderProxy
          : state.artifact
        ).immutableReferences || {},
      );
      output({
        status: immutables.length
          ? "Immutable runtime needs constructor-aware comparison"
          : code === expected
            ? "Exact sandbox runtime match"
            : "Runtime mismatch",
        address: state.deployed,
        notice: "A code match is not a security audit.",
      });
    });
  $("mode").onchange = () => {
    state.mode = $("mode").value;
    state.deployed = null;
    state.account = null;
    state.signer = null;
    for (const id of ["call", "sandbox-verify"]) $(id).disabled = true;
    $("sandbox-verify").textContent =
      state.mode === "mainnet"
        ? "Verify mainnet source"
        : "Check sandbox runtime";
    $("account").textContent = "";
    $("environment-note").textContent =
      state.mode === "sandbox"
        ? "The sandbox executes real EVM bytecode in your browser. Its accounts and contracts do not exist on mainnet."
        : "Mainnet uses real BDAG. Your wallet signs transactions; Macula checks the chain history before requesting a signature.";
    $("environment-note").classList.toggle("warning", state.mode === "mainnet");
    $("connect").hidden = state.mode !== "mainnet";
    $("new-sandbox").hidden = state.mode !== "sandbox";
    $("deploy").textContent =
      state.mode === "sandbox" ? "Deploy to sandbox" : "Deploy with wallet";
    $("deploy-note").textContent =
      state.mode === "sandbox"
        ? "Fake funds; no wallet needed."
        : "Use your own funded wallet. No automatic mainnet deployment.";
    $("guided").hidden = state.mode !== "sandbox" || state.template?.id !== "counter";
    if (state.mode === "mainnet") {
      $("contract-address").innerHTML =
        '<label for="load-address">Existing mainnet address</label><input id="load-address" placeholder="0x…"><button id="load-contract" class="secondary">Load compiled ABI at address</button>';
      $("load-contract").onclick = () =>
        job(async () => {
          if (!state.artifact) throw Error("Compile an ABI first.");
          const addr = $("load-address").value;
          if (!/^0x[0-9a-fA-F]{40}$/.test(addr))
            throw Error("Enter a valid contract address.");
          const provider = new JsonRpcProvider(network.rpcUrls[0]);
          if ((await provider.getCode(addr)) === "0x")
            throw Error("No contract code at that address.");
          state.deployed = addr;
          functions();
          output(
            "Loaded contract ABI. Read functions are available; connect a wallet for writes.",
          );
        });
    } else
      $("contract-address").textContent =
        "Deploy a contract to enable its functions.";
  };
  $("mode").onchange();
  busy(false);
}
async function renderStatus() {
  const e = $("status-content");
  try {
    e.textContent = "Checking the node and independent checkpoints…";
    const r = await fetch("/api/v1/status"),
      s = await r.json();
    if (!r.ok) throw Error(s.error);
    e.className = "";
    e.innerHTML = `<div class="notice">${s.ok && s.checkpoint_agree ? "Node online · independent checkpoint agrees" : "Network verification unavailable"} · observed ${esc(new Date(s.updated_at).toLocaleString())}</div><div class="status-grid"><div><small>EVM head</small><strong>${Number(s.head).toLocaleString()}</strong></div><div><small>Chain ID</small><strong>${s.chainId}</strong></div><div><small>RPC observation</small><strong>${s.latency_ms} ms</strong></div><div><small>Explorer window</small><strong>${s.overview?.blocks ?? "—"} blocks</strong></div></div><h2>Independent history checks</h2>${s.peers.map((p) => `<div class="peer-row"><span>${esc(p.url)}</span><span class="chip ${p.agrees ? "" : "warn"}">${p.agrees ? "Matches checkpoint" : "Unavailable or different"}</span></div>`).join("")}<p class="hint" style="margin-top:18px">Comparison at block ${s.checkpoint_height.toLocaleString()}. This is checkpoint agreement, not universal canonicality or a promise of uptime.</p><div class="actions"><a href="/api/v1/capabilities" target="_blank">Read capability manifest</a><a href="https://explorer.macula.co.za/" target="_blank">Open explorer</a></div>`;
  } catch (err) {
    e.className = "notice warning";
    e.textContent = "Unable to read live status: " + err.message;
  }
}
async function bindVerify() {
  if (state.template) {
    $("verify-filename").value = state.template.filename;
    $("verify-name").value = state.artifact?.name || state.template.name;
    $("verify-source").value = state.source;
    if (state.mode === "mainnet" && state.deployed)
      $("verify-address").value = state.deployed;
  }
  const run = async (fn) => {
    const b = $("verify-submit");
    b.disabled = true;
    try {
      $("verify-result").textContent = "Working…";
      const x = await fn();
      $("verify-result").textContent = pretty(x);
      $("verify-result").classList.toggle("error", !!x.error);
    } catch (e) {
      $("verify-result").textContent = e.message;
      $("verify-result").classList.add("error");
    } finally {
      b.disabled = false;
    }
  };
  $("verify-form").onsubmit = (e) => {
    e.preventDefault();
    run(async () => {
      const r = await fetch("/api/v1/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: $("verify-address").value,
          filename: $("verify-filename").value,
          contract: $("verify-name").value,
          source: $("verify-source").value,
          publish: $("publish").checked,
        }),
      });
      return r.json();
    });
  };
  $("load-verified").onclick = () =>
    run(async () => {
      const r = await fetch(
        "/api/v1/verification?address=" +
          encodeURIComponent($("verify-address").value),
      );
      return r.json();
    });
}
async function route() {
  const url = new URL(location.hash.slice(1) || "/", "https://routes.invalid"),
    route = url.pathname;
  const views = {
    "/": home,
    "/contracts": contracts,
    "/playground": playground,
    "/docs": docs,
    "/status": statusPage,
    "/verify": verifyPage,
    "/projects": projects,
  };
  state.editor?.destroy();
  $("app").innerHTML =
    header(route) +
    `<main id="main" class="wrap">${(views[route] || home)()}</main>` +
    footer;
  document.querySelectorAll("[data-copy]").forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          await navigator.clipboard.writeText(b.dataset.copy);
          toast("Copied");
        } catch {
          toast("Select and copy the text manually.");
        }
      }),
  );
  if (route === "/playground") await bindPlayground(url.searchParams);
  if (route === "/status") {
    renderStatus();
    $("refresh-status").onclick = renderStatus;
  }
  if (route === "/verify") bindVerify();
  if (route === "/docs" && url.searchParams.get("section"))
    document.getElementById(url.searchParams.get("section"))?.scrollIntoView();
}
addEventListener("hashchange", route);
await route();

if (window.ethereum?.on)
  for (const event of ["accountsChanged", "chainChanged"])
    window.ethereum.on(event, () => {
      state.signer = null;
      if (state.mode === "mainnet") {
        state.account = null;
        output(
          "Wallet changed. Reconnect and recheck the network before writing.",
        );
      }
    });
