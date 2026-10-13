export const COMPILER_VERSION = "0.8.37";
export const EVM_TARGET = "paris";
export function resolveImport(path, importer) {
  if (!path.startsWith(".")) return path;
  return new URL(path, "https://sources.invalid/" + importer).pathname.slice(1);
}
export function createInput(filename, source, imports, extras = {}) {
  if (typeof source !== "string" || source.length > 65536)
    throw Error("Source must contain at most 64 KiB.");
  const available = { ...imports, ...extras, [filename]: source },
    sources = {},
    queue = [filename];
  while (queue.length) {
    const name = queue.shift();
    if (sources[name]) continue;
    if (!(name in available))
      throw Error("Import not available in the pinned library: " + name);
    sources[name] = { content: available[name] };
    const matches = available[name].matchAll(
      /import\s+(?:[^;]*?\sfrom\s*)?["']([^"']+)["']\s*;/g,
    );
    for (const m of matches) queue.push(resolveImport(m[1], name));
    if (Object.keys(sources).length > 180)
      throw Error("Import graph exceeds the supported limit.");
  }
  return {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: EVM_TARGET,
      outputSelection: {
        "*": {
          "*": [
            "abi",
            "metadata",
            "evm.bytecode.object",
            "evm.deployedBytecode.object",
            "evm.deployedBytecode.immutableReferences",
          ],
        },
      },
    },
  };
}
export function contractArtifacts(output, filename) {
  const errors = (output.errors || []).filter((x) => x.severity === "error");
  if (errors.length)
    throw Error(errors.map((x) => x.formattedMessage).join("\n"));
  return Object.fromEntries(
    Object.entries(output.contracts?.[filename] || {}).map(([name, a]) => [
      name,
      {
        name,
        abi: a.abi,
        bytecode: "0x" + a.evm.bytecode.object,
        runtime: "0x" + a.evm.deployedBytecode.object,
        immutableReferences: a.evm.deployedBytecode.immutableReferences,
        metadata: a.metadata,
      },
    ]),
  );
}
