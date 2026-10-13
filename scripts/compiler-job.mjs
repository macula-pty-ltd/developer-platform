import fs from "node:fs";
import solc from "solc";
import { createInput, contractArtifacts } from "../src/lib/compiler-input.js";
try {
  const payload = JSON.parse(fs.readFileSync(0, "utf8")),
    imports = JSON.parse(
      fs.readFileSync(
        new URL("../public/imports.json", import.meta.url),
        "utf8",
      ),
    );
  const input = createInput(payload.filename, payload.source, imports);
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const artifacts = contractArtifacts(output, payload.filename);
  const artifact = artifacts[payload.contract];
  if (!artifact)
    throw Error("Contract name was not found in the supplied file.");
  process.stdout.write(
    JSON.stringify({ artifact, input, compiler: solc.version() }),
  );
} catch (e) {
  process.stdout.write(JSON.stringify({ error: e.message.slice(0, 8000) }));
  process.exitCode = 1;
}
