# MACULA Developers

Self-hosted developer portal for the independently operated MACULA BlockDAG RPC. Includes a browser-local Paris EVM sandbox, pinned Solidity/OpenZeppelin templates, self-hosted Remix, live checkpoint comparisons, wallet-owned mainnet interactions, and bounded exact-runtime source verification.

## Build
Node 22.20+, `npm ci`, `node scripts/fetch-remix.mjs`, `npm run build`, `npm test`, then `RPC_URL=https://rpc.macula.co.za node server.mjs` for local preview. The full Remix bundle is pinned to upstream remix-live b8ff3b694dc1d71840fa72a83c8e1be050fc1b02. Its upstream licenses remain in the bundle. Generated libraries and compiled artifacts are rebuilt from pinned dependencies.

## Runtime
Node service binds loopback 8120. Docker runs as user node with read-only root filesystem, writable `/data` for the SQLite verification registry, 0.75 CPU and bounded Node heaps (API 256 MiB, one compiler job 512 MiB). The host kernel currently lacks memory cgroup support; a requested container memory limit is not enforced. Compiler time/output/concurrency and Node heap limits are active. Existing DreamPIE explorer gateway proxies the `/developer/` prefix; the Cloudflare Worker routes dev.macula.co.za to this path. No keys or unlocked accounts are held by the service.

Compiler: 0.8.37; optimizer 200; EVM Paris. NFT/ERC1155 use OpenZeppelin 4.9.6 because the newer implementation produces unsupported opcodes on the current node. Chain ID 1404 alone is insufficient: mainnet signing requires independent checkpoint agreement and the wallet RPC must match that history.

Examples are educational and require review before handling real funds. Runtime correspondence is not a security audit. Historical indexing and public WSS are not provided. Mainnet funded signing requires the owner's wallet; automated tests use sandbox funds only.
