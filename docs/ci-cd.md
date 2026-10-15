# Personal showcase CI/CD

## Scope

The deployment target is the private `nishank23/ResumeForge` repository and the existing `resume-forge-dev/us-central1-a/resumeforge-demo` VM. On 2026-10-15 the user explicitly overrode the organization-only publication rule for this deployment task. The primary `feature` checkout and other worktrees remain in place. Unrelated feature changes are not part of this release.

The existing cloud runtime is already merged into personal `main` at `df3b866`. The deployment candidate started from that release. It requires that branch's Dockerfile cloud targets, `compose.cloud.yaml`, cloud runtime guards and isolated integration override. Copying only the workflow into the organization checkout does not supply those prerequisites. The deployment candidate also carries the already-live first-load screen and bootstrap preloads so a full rebuild preserves them.

## Release behavior

1. Pull requests to personal `main` or `codex/cloud-deploy` run lint, type checks, unit tests, image builds and the isolated production integration suite. They receive no deployment identity.
2. Pushes to personal `main` repeat those checks and, once enabled, deploy the exact checked images. Manual dispatch also requires `main`. Workflows in organization copies do not deploy.
3. Linux amd64 GitHub-hosted runners build the images. No build, self-hosted runner or registry runs on the 1 GB VM. Server/provider secrets never enter build arguments or the transfer bundle.
4. After verification, GitHub obtains short-lived Google credentials through Workload Identity Federation. Images travel through the existing IAP SSH path. No new public IPv4, ingress rule, registry or bucket is required.
5. The VM serializes releases with `flock`, checks disk space/checksums/platform and compares schema/bootstrap/credential code with the running image. Schema changes stop for a separate reviewed migration release; this script never runs bootstrap or provisions credentials.
6. The existing private backup helper must complete its restore verification before app changes. The deployer retains previous app/web images, replaces only those two services, waits for health and restores both previous images on startup/health failure. Database and credential volumes stay mounted unchanged.
7. The operation runs as a transient systemd service so an SSH disconnect does not interrupt the VM halfway through an update. The workflow checks `main` again before starting, rejecting a superseded release.

The app restarts during deployment. On this VM previous startup took about 105 seconds; this is not a zero-downtime rollout. The 240-second app health deadline accommodates that observed startup. Provider keys stay in root-private `/etc/resumeforge/provider.env`; the existing Compose file remains `/opt/resumeforge/compose.cloud.yaml`. Compose/network/resource configuration changes require separate installation and review.

## One-time cloud trust setup

The user approved these permissions and the first automated deployment on 2026-10-15. The dedicated identity and grants are configured. No service-account JSON key or GitHub provider secret is required.

The configured service account is `resumeforge-github@resume-forge-dev.iam.gserviceaccount.com`. Workload Identity pool `resumeforge-github` and OIDC provider `github-main` use issuer `https://token.actions.githubusercontent.com` in project number `551688915016`.

GitHub API verification confirmed private repository ID `1417241992` and owner ID `80453652`. The provider maps:

```text
google.subject=assertion.sub
attribute.repository_id=assertion.repository_id
attribute.repository_owner_id=assertion.repository_owner_id
attribute.repository=assertion.repository
attribute.repository_visibility=assertion.repository_visibility
attribute.event_name=assertion.event_name
attribute.ref=assertion.ref
attribute.workflow_ref=assertion.workflow_ref
```

The configured admission condition is:

```text
assertion.repository_id == '1417241992' &&
assertion.repository_owner_id == '80453652' &&
assertion.repository == 'nishank23/ResumeForge' &&
assertion.repository_visibility == 'private' &&
assertion.ref == 'refs/heads/main' &&
assertion.workflow_ref == 'nishank23/ResumeForge/.github/workflows/cloud-deploy.yml@refs/heads/main' &&
assertion.event_name in ['push', 'workflow_dispatch']
```

The verified grants are:

| Recipient                                                      | Grant                                                                                             | Scope                                                               |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| This pool's `attribute.repository_id/1417241992` principal set | `roles/iam.workloadIdentityUser`                                                                  | The deployment service account only                                 |
| Deployment service account                                     | `roles/compute.osAdminLogin`                                                                      | VM `resumeforge-demo` only                                          |
| Deployment service account                                     | `roles/iap.tunnelResourceAccessor`                                                                | That VM's IAP TCP resource only, condition `destination.port == 22` |
| Deployment service account                                     | Custom lookup role with `compute.instances.get`, `compute.instances.list`, `compute.projects.get` | Project `resume-forge-dev`                                          |

OS Admin Login permits root commands on this VM. Consequently this identity can access the VM's application secrets and private database; main-branch writers become deployment administrators. Restrict write/merge access to personal `main`. The VM currently has no attached service account, so no permission to impersonate a VM service account is needed. Do not grant Owner, Editor, Compute Instance Admin or project-wide SSH administration.

Enable IAM, IAM Service Account Credentials, Security Token Service, OS Login and IAP APIs where not already enabled. Keep the existing OS Login metadata and IAP-only firewall intact. Use the [Google federation setup](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines), [OS Login roles](https://docs.cloud.google.com/compute/docs/oslogin/set-up-oslogin) and [VM-scoped IAP grant](https://docs.cloud.google.com/iap/docs/using-tcp-forwarding#grant-access-to-specific-vm) instructions. Preserve existing IAM policy bindings and etags when editing policies.

## GitHub activation

Repository Actions variables are configured on personal `nishank23/ResumeForge`:

| Variable                     | Value                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| `GCP_WIF_PROVIDER`           | `projects/551688915016/locations/global/workloadIdentityPools/resumeforge-github/providers/github-main` |
| `GCP_DEPLOY_SERVICE_ACCOUNT` | `resumeforge-github@resume-forge-dev.iam.gserviceaccount.com`                                           |
| `CLOUD_DEPLOY_ENABLED`       | `true` after the approved activation; use `false` to disable future deployments                         |

Personal PR #2 merged the deployment candidate. Its verification passed before activation. PR #3 fixed a concurrent state-file race in the mocked deployment test; no production application code changed in that repair. Enabling deployment before PR #3 merged triggered the first automatic release from personal `main`. The successful run is recorded below. Future pushes to `main` deploy after their checks pass; manual dispatch is also available from the Cloud release workflow on `main`.

Disable future deployments by setting `CLOUD_DEPLOY_ENABLED=false`. This does not stop an already-running systemd deployment. Inspect its VM unit rather than cancelling it mid-update. Revoke access by removing the service account's federation binding or disabling its provider; preserve existing human access.

## Recovery and retention

The immediate previous images are `forge-studio:ci-rollback` and `forge-studio-web:ci-rollback`. A failed deployment exits nonzero even after successful rollback. If rollback also fails, it prints an operator-attention message; inspect the transient unit's journal and the existing private backup. Do not restore a database dump automatically over newer user writes.

The deployer consumes this run's transferred image archive after loading it. Docker images and verified private backups are retained; no image/volume prune or backup deletion runs automatically. Review disk usage and retention before enabling frequent releases. A failed preflight may leave its incoming bundle for inspection. Low disk space fails before changing running services.

## Cost and evidence

GitHub Free currently includes 2,000 standard-runner minutes per month for private repositories. This workflow stores no Actions artifacts or registry images and uses no remote build cache. Build time and IAP transfer consume runner minutes; other account usage shares the allowance. Over-quota runs can cost money if billing permits it. Check account usage and a zero-spend Actions budget before activation. [GitHub billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

Local deployment orchestration tests use mocked Docker/backup/network commands; they exercise success, rollback, retry and fail-closed behavior without reading production secrets. The first real release also verified GitHub checks/builds/integration, federation, IAP transfer, systemd execution, backup restoration and successful health gates. Failure and rollback on the actual VM have not been fault-injected.

## First automated production release — 2026-10-15

- [Deployment run 38737963254](https://github.com/nishank23/ResumeForge/actions/runs/38737963254) passed at 13:09:13 UTC. It ran automatically on the merge of [PR #3](https://github.com/nishank23/ResumeForge/pull/3), following [PR #2](https://github.com/nishank23/ResumeForge/pull/2). Total workflow duration was 17m 4s, including checks, builds and transfer. The VM update ran for about seven minutes; this is not a measurement of application downtime.
- Runtime source commit: `0fa056f81751045660f54885bed7088409cf5a3d`. Installed release: `0fa056f81751045660f54885bed7088409cf5a3d-38737963254-1`. Later documentation-only commits do not imply a new runtime release.
- New app image: `sha256:df6e02265f5c3d8976415088a5f531c4e278f513c211acb416226ff33fee3e19`. New web image: `sha256:09b4cf16ca2204310d9fbf88190bb9199d83399a860e5d495f59792a9f0fec4e`. Both services became healthy; their previous images remain under the rollback tags.
- The existing private backup helper created and successfully restored `/var/backups/resumeforge/resumeforge-20261015T130626Z-514969.tar.gz` before restarting the app. This backup remains private on the VM.
- Before/after snapshots matched: the database container/start time, database and credential volume names, 51 users, 43 resumes and 122 versions were unchanged. Provider and Compose file checksums also matched. These checks read counts and configuration checksums, not private resume contents.
- Private and public health checks returned HTTP 200. Public and VM-served HTML matched SHA-256 `1f4e886d88f703290cfda86acf6a4b6e64dca6ff47ce8b34e70bf41fd61d68d8`, retained the resume/AI loader and included all 16 core preloads. A fresh live browser visit showed the loader followed by Google sign-in. A signed-in production resume edit/PDF was not repeated in this activation; isolated production integration passed in the workflow.
- The dedicated identity audit confirmed the exact repository/main/workflow admission condition, VM-scoped SSH/IAP grants and zero user-managed service-account keys. The temporary human CLI login was revoked after verification; its one-hour SSH key was already absent from OS Login. Existing human GitHub login and application provider credentials were preserved.

The first merged-main check exposed a race in the test mocks before any deployment. The repair gives only the Docker mock ownership of its state file. PR and main verification then passed. A real success path and backup restoration do not prove failure recovery on the production VM; retain that limitation when assessing readiness.
