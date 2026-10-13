# Contributing

Open an issue or pull request at https://github.com/macula-pty-ltd/developer-platform.

For a new template, include the contract source, exact compiler/library versions, explicit EVM target, permission model, and meaningful tests for successful behaviour and rejected unauthorized actions. Run the build and tests before proposing a change. Do not label a template audited on the strength of compilation or a runtime match.

For a bug report, provide reproduction steps, compiler settings, the network profile, expected/actual results, and a public transaction hash if relevant. Never include a private key, seed phrase, token, cookie, or private source code in an issue.

Use the local sandbox first. Automated checks must never broadcast a mainnet transaction or request a wallet signature. Changes to the network profile must compare fixed block hashes/state roots with independently operated peers; chain ID alone is insufficient.
