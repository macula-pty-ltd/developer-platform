import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Sandbox } from "../src/lib/sandbox.js";
import { Interface, keccak256, toUtf8Bytes, AbiCoder } from "ethers";
const load = (id) =>
  JSON.parse(fs.readFileSync("public/templates/" + id + ".json"));
test("Counter deploys, writes, emits and preserves bytecode in a Paris EVM", async () => {
  const s = await Sandbox.create();
  const a = load("counter").artifacts.Counter;
  const d = await s.deploy(a);
  assert.equal((await s.read(d.address, a.abi, "number"))[0], 0n);
  const r = await s.write(d.address, a.abi, "increment");
  assert.equal((await s.read(d.address, a.abi, "number"))[0], 1n);
  assert.equal(r.logs.length, 1);
  assert.equal(await s.code(d.address), a.runtime);
});
test("ERC20 fixed supply and transfer", async () => {
  const s = await Sandbox.create(),
    a = load("erc20").artifacts.BuilderToken,
    d = await s.deploy(a);
  assert.equal(
    (await s.read(d.address, a.abi, "totalSupply"))[0],
    1000000n * 10n ** 18n,
  );
  await s.write(d.address, a.abi, "transfer", [s.accounts[1].hex, 5n]);
  assert.equal(
    (await s.read(d.address, a.abi, "balanceOf", [s.accounts[1].hex]))[0],
    5n,
  );
});
test("Managed token rejects unauthorized minting and paused transfers", async () => {
  const s = await Sandbox.create(),
    a = load("managed-token").artifacts.ManagedToken,
    d = await s.deploy(a);
  await assert.rejects(
    s.write(d.address, a.abi, "mint", [s.accounts[1].hex, 1n], 1),
  );
  await s.write(d.address, a.abi, "pause");
  await assert.rejects(
    s.write(d.address, a.abi, "transfer", [s.accounts[1].hex, 1n]),
  );
  await s.write(d.address, a.abi, "unpause");
  await s.write(d.address, a.abi, "transfer", [s.accounts[1].hex, 1n]);
});
test("NFT Paris-compatible mint and owner boundary", async () => {
  const s = await Sandbox.create(),
    a = load("erc721").artifacts.BuilderNFT,
    d = await s.deploy(a);
  await s.write(d.address, a.abi, "mint", [
    s.accounts[1].hex,
    "ipfs://example",
  ]);
  assert.equal(
    (await s.read(d.address, a.abi, "ownerOf", [0]))[0].toLowerCase(),
    s.accounts[1].hex,
  );
  await assert.rejects(
    s.write(d.address, a.abi, "mint", [s.accounts[1].hex, "ipfs://x"], 1),
  );
});
test("Multi-token mint and owner boundary", async () => {
  const s = await Sandbox.create(),
    a = load("erc1155").artifacts.BuilderMultiToken,
    d = await s.deploy(a);
  await s.write(d.address, a.abi, "mint", [s.accounts[1].hex, 7, 10]);
  assert.equal(
    (await s.read(d.address, a.abi, "balanceOf", [s.accounts[1].hex, 7]))[0],
    10n,
  );
  await assert.rejects(
    s.write(d.address, a.abi, "mint", [s.accounts[1].hex, 7, 1], 1),
  );
});
test("Digest registry rejects zero and duplicate digest", async () => {
  const s = await Sandbox.create(),
    a = load("registry").artifacts.DigestRegistry,
    d = await s.deploy(a),
    digest = keccak256(toUtf8Bytes("Example"));
  await s.write(d.address, a.abi, "register", [digest]);
  assert.equal(
    (await s.read(d.address, a.abi, "registeredBy", [digest]))[0].toLowerCase(),
    s.accounts[0].hex,
  );
  await assert.rejects(s.write(d.address, a.abi, "register", [digest]));
  await assert.rejects(
    s.write(d.address, a.abi, "register", ["0x" + "00".repeat(32)]),
  );
});
test("Merkle claim distributes once and rejects invalid proofs", async () => {
  const s = await Sandbox.create(),
    token = load("erc20").artifacts.BuilderToken,
    t = await s.deploy(token),
    a = load("merkle").artifacts.MerkleClaim,
    amount = 100n;
  const leaf = keccak256(
    keccak256(
      AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256"],
        [s.accounts[0].hex, amount],
      ),
    ),
  );
  const d = await s.deploy(a, [t.address, leaf]);
  await s.write(t.address, token.abi, "transfer", [d.address, amount]);
  await assert.rejects(s.write(d.address, a.abi, "claim", [101n, []]));
  await s.write(d.address, a.abi, "claim", [amount, []]);
  await assert.rejects(s.write(d.address, a.abi, "claim", [amount, []]));
});
test("UUPS implementation is locked and proxy initialization cannot replay", async () => {
  const s = await Sandbox.create(),
    artifacts = load("uups").artifacts,
    a = artifacts.UpgradeableCounter,
    d = await s.deploy(a);
  await assert.rejects(
    s.write(d.address, a.abi, "initialize", [s.accounts[0].hex]),
  );
  const data = new Interface(a.abi).encodeFunctionData("initialize", [
    s.accounts[0].hex,
  ]);
  const p = await s.deploy(artifacts.BuilderProxy, [d.address, data]);
  assert.equal(
    (await s.read(p.address, a.abi, "owner"))[0].toLowerCase(),
    s.accounts[0].hex,
  );
  await assert.rejects(
    s.write(p.address, a.abi, "initialize", [s.accounts[0].hex]),
  );
  await s.write(p.address, a.abi, "increment");
  assert.equal((await s.read(p.address, a.abi, "number"))[0], 1n);
  await assert.rejects(
    s.write(p.address, a.abi, "upgradeToAndCall", [d.address, "0x"], 1),
  );
});
