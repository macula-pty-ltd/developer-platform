# Operating the developer service

The application, local compiler bundle, self-hosted Remix, template assets and verifier run on DreamPIE. Cloudflare supplies only HTTPS routing for dev.macula.co.za. Existing explorer gateway forwards /developer/ to loopback 8120. The worker adds a release query to prevent stale upstream cache entries. Remix uses a versioned asset base at /remix/macula-20261013-v1/; bump this in both patch-remix.mjs and server.mjs for a new modified bundle.

Build from the source repository with Node 22.20.0+, npm ci, node scripts/fetch-remix.mjs, npm run build and npm test. The bundle fetch uses a pinned upstream commit, sparse checkout, published compiler metadata and a checked compiler hash. Keep all license/notice files. The local compiler and worker URL patches are documented in MACULA-MODIFICATIONS.txt.

The Docker image contains dependencies and compiler job code. Rebuild it whenever those change. Runtime server, dist and public are read-only bind mounts; the SQLite database lives outside the release at /home/dreampie/macula-developer-data. Keep this directory when replacing a release. Back it up before registry migrations.

Ship new hashed assets before index.html, preserve the mounted server file inode when updating it, then restart only macula-developers. Gateway changes must preserve the explorer server.py inode and restart only explorer. Node, pool, stratum and cloudflared need no restart for this release.

Verify /api/v1/network, /api/v1/status, the compiler walkthrough and the source rejection path. Check ordinary explorer/RPC behaviour and protected mining routes after a gateway change. Roll back the served index/assets and server file to the previous release if checks fail; the gateway backup is server.py.bak-developers-20261013. Do not roll back/delete the persistent verification database without a migration plan.

Resource limits: nonroot process, read-only filesystem, all capabilities dropped, no-new-privileges, 64 processes, 0.75 CPU, API heap 256 MiB, one compiler child heap 512 MiB, compiler timeout 20 seconds and output bound 4 MB. Requested Docker memory cgroup limiting is unavailable on this host kernel and reports Memory=0; never claim it is enforced. Kernel/cgroup enablement requires separate maintenance and is not part of a portal restart.

Mainnet writes require a funded developer wallet, independent checkpoint agreement, and wallet RPC history matching. No service key or unlocked account exists. The implementation has automated sandbox proof and live read-only node checks; funded browser-wallet signing needs a human-controlled demonstration. Public WSS, a funded faucet, full historical indexing, and generalized immutable/proxy source verification are separate infrastructure work.

Shared navigation: edit src/suite-navigation.js and src/suite-navigation.css in this repository. With the Explorer checkout next to this project, run node scripts/sync-explorer-navigation.mjs, then rebuild both applications. This generates the matching Explorer header, styles and menu behaviour. Publish new developer assets before index.html; preserve the Explorer mounted server inode and restart the gateway once the batch is ready. The routing worker caches only successful asset responses, so transient gateway failures are not given a long browser cache lifetime.
