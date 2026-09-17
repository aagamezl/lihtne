# ESLint Configuration

## Structure

```text
lihtne
├── eslint.config.js          # wires everything together
└── eslint-config/
    ├── base.js                # StandardJS's core logic rules (no-unused-vars, eqeqeq, etc.)
    ├── stylistic.js            # StandardJS's exact formatting, via @stylistic/eslint-plugin
    ├── node-and-imports.js     # eslint-plugin-n / promise / import-x, as Standard uses
    ├── typescript.js           # TS-aware overrides + a couple of TS-only rules
    └── perfectionist.js        # sorting rules, isolated so it's easy to drop/retune
```