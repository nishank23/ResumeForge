# @resume-forge/access-policy

Server-side personal policy primitives and the canonical 27-permission vocabulary.

- [x] ✅ Personal actor/action/workspace/resource ownership checks and safe allow/deny results.
- [x] ✅ Consumers in profile/resume use cases and authorized current-version downloads.
- [ ] Complete organization/vendor role/consent and field/output privacy parity are not implemented here.
- [ ] MCP adapters and background-job policy parity remain future work.

Membership persistence, session resolution, audit capture and output projection are orchestrated by services/adapters rather than this pure policy boundary. A separate workspace RBAC resolver exists but is not a complete shared release. Profile contact handlers currently use broad professional permissions; see [audit findings](../../docs/implementation-audit.md#priority-findings-in-existing-source) before extending access.

```sh
pnpm --filter @resume-forge/access-policy build
pnpm --filter @resume-forge/access-policy test
```
