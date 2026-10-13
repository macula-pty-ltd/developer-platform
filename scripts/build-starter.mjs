import fs from "node:fs";
const pkg = JSON.parse(fs.readFileSync("package.json"));
pkg.name = "macula-developer-starter";
pkg.scripts = {
  compile: "node scripts/compile.mjs",
  test: "node --test test/*.test.mjs",
};
delete pkg.devDependencies;
const files = {
  "package.json": JSON.stringify(pkg, null, 2),
  "package-lock.json": fs
    .readFileSync("package-lock.json", "utf8")
    .replaceAll("macula-developer-platform", "macula-developer-starter"),
  "src/lib/sandbox.js": fs.readFileSync("src/lib/sandbox.js", "utf8"),
  "test/templates.test.mjs": fs.readFileSync("test/templates.test.mjs", "utf8"),
  "scripts/compile.mjs": `import fs from 'node:fs';import solc from 'solc';
fs.mkdirSync('artifacts',{recursive:true});
for(const file of fs.readdirSync('standard-inputs')){const {input,filename,name}=JSON.parse(fs.readFileSync('standard-inputs/'+file));const output=JSON.parse(solc.compile(JSON.stringify(input)));const errors=(output.errors||[]).filter(e=>e.severity==='error');if(errors.length)throw Error(errors.map(e=>e.formattedMessage).join('\\n'));fs.writeFileSync('artifacts/'+name+'.json',JSON.stringify(output.contracts[filename],null,2));console.log('Compiled',name,'Paris');}
`,
  "README.md":
    "# MACULA developer starter\n\nRun `npm ci`, `npm run compile`, then `npm test`. Solidity 0.8.37, optimizer 200 runs, Paris EVM. Standard compiler inputs include every dependency and may be imported into explorer verification workflows. Sandbox tests use fake funds and do not broadcast transactions.\n\nFor live deployment use your own wallet and confirm the network history at https://dev.macula.co.za. Chain ID alone does not identify a fork. No private keys belong in this project.\n\nOpenZeppelin core 5.6.1 and Paris-compatible NFT examples 4.9.6 are pinned. Examples are educational and require review before handling real funds.\n",
};
fs.writeFileSync("public/starter-files.json", JSON.stringify(files));
