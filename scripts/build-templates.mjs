import fs from "node:fs";
import path from "node:path";
import solc from "solc";
import { createInput, contractArtifacts } from "../src/lib/compiler-input.js";
export const definitions = [
  [
    "counter",
    "Counter",
    "Your first contract",
    "Store a number, change it and inspect emitted events.",
    "Beginner",
  ],
  [
    "erc20",
    "BuilderToken",
    "Fixed-supply token",
    "One million BUILD units, allocated to the deployer. No mint function.",
    "Beginner",
  ],
  [
    "managed-token",
    "ManagedToken",
    "Managed token",
    "Explicit administrator, minter and pauser roles.",
    "Intermediate",
  ],
  [
    "erc721",
    "BuilderNFT",
    "NFT collection",
    "Owner-controlled minting and token metadata. Paris-compatible OpenZeppelin 4.9.6.",
    "Intermediate",
  ],
  [
    "erc1155",
    "BuilderMultiToken",
    "Multi-token collection",
    "Owner-controlled minting of multiple token IDs. OpenZeppelin 4.9.6.",
    "Intermediate",
  ],
  [
    "registry",
    "DigestRegistry",
    "Digest registry",
    "Register a public digest without uploading the underlying document.",
    "Beginner",
  ],
  [
    "merkle",
    "MerkleClaim",
    "Merkle claim",
    "A funded token distributor with proof validation and replay protection.",
    "Advanced",
  ],
  [
    "uups",
    "UpgradeableCounter",
    "UUPS counter",
    "Locked implementation, initialized proxy and owner-controlled upgrades.",
    "Advanced",
  ],
];
const imports = {};
for (const prefix of [
  "@openzeppelin/contracts",
  "@openzeppelin/contracts-upgradeable",
  "@openzeppelin/contracts-v4",
]) {
  const base = path.resolve("node_modules", prefix);
  const scan = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) scan(file);
      else if (entry.name.endsWith(".sol"))
        imports[
          prefix + "/" + path.relative(base, file).split(path.sep).join("/")
        ] = fs.readFileSync(file, "utf8");
    }
  };
  scan(base);
}
fs.mkdirSync("public/templates", { recursive: true });
fs.writeFileSync("public/imports.json", JSON.stringify(imports));
const list = [];
for (const [id, name, title, description, level] of definitions) {
  const filename = "contracts/" + name + ".sol",
    source = fs.readFileSync(filename, "utf8"),
    input = createInput(filename, source, imports),
    output = JSON.parse(solc.compile(JSON.stringify(input))),
    artifacts = contractArtifacts(output, filename);
  const template = {
    id,
    name,
    title,
    description,
    level,
    filename,
    source,
    compiler: solc.version(),
    evmVersion: "paris",
    openzeppelin: id === "erc721" || id === "erc1155" ? "4.9.6" : "5.6.1",
    artifacts,
    input,
  };
  fs.writeFileSync(
    "public/templates/" + id + ".json",
    JSON.stringify(template),
  );
  fs.writeFileSync("public/templates/" + name + ".sol", source);
  list.push({ ...template, input: undefined, artifacts: undefined });
  console.log(
    "Compiled",
    name,
    "Paris",
    artifacts[name].runtime.length / 2 - 1,
    "runtime bytes",
  );
}
fs.writeFileSync("public/templates.json", JSON.stringify(list));
fs.copyFileSync("node_modules/solc/soljson.js", "public/compiler/soljson.js");

fs.mkdirSync("public/licenses",{recursive:true});for(const [name,file] of [["solc","solc-js-MIT.txt"],["@openzeppelin/contracts","OpenZeppelin-MIT.txt"],["@openzeppelin/contracts-v4","OpenZeppelin-v4-MIT.txt"]])fs.copyFileSync("node_modules/"+name+"/LICENSE","public/licenses/"+file);
