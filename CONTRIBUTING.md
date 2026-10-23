# Contributing

Group 1 uses Node.js 24 and npm workspaces.

```sh
npm ci
npm run check
```

Do not manually edit generated `dist/` files. Keep CLI operations thin and share functionality through packages. Do not duplicate Gungnir's compiler/parser or bypass workspace permission checks in future groups.

A change that introduces native commands must include tests for subprocess arguments, exit status, timeouts, cancellation and untrusted workspaces. Package/runtime publication remains manual.
