# Personal showcase CI/CD

## Scope

The deployment target is the private `nishank23/ResumeForge` repository and the existing `resume-forge-dev/us-central1-a/resumeforge-demo` VM. On 2026-10-15 the user explicitly overrode the organization-only publication rule for this deployment task. The primary `feature` checkout and other worktrees remain in place. Unrelated feature changes are not part of this release.

The existing cloud runtime is already merged into personal `main` at `df3b866`. This candidate starts from that release. It requires that branch's Dockerfile cloud targets, `compose.cloud.yaml`, cloud runtime guards and isolated integration override. Copying only the workflow into the organization checkout does not supply those prerequisites. The deployment candidate also carries the already-live first-load screen and bootstrap preloads so a full rebuild preserves them.

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

Review and approve these new permissions before applying them. No service-account JSON key or GitHub provider secret is required.

Create service account `resumeforge-github@resume-forge-dev.iam.gserviceaccount.com`. Create Workload Identity pool `resumeforge-github` and OIDC provider `github-main`, issuer `https://token.actions.githubusercontent.com`, in project number `551688915016`.

Resolve the personal repository's numeric ID from GitHub while authenticated before creating the provider. Map:

```text
google.subject=assertion.sub
attribute.repository_id=assertion.repository_id
attribute.repository_owner_id=assertion.repository_owner_id
attribute.ref=assertion.ref
attribute.workflow_ref=assertion.workflow_ref
```

Restrict admission with the following condition, replacing `REPOSITORY_ID` with that verified numeric ID:

```text
assertion.repository_id == 'REPOSITORY_ID' &&
assertion.repository_owner_id == '80453652' &&
assertion.repository == 'nishank23/ResumeForge' &&
assertion.repository_visibility == 'private' &&
assertion.ref == 'refs/heads/main' &&
assertion.workflow_ref == 'nishank23/ResumeForge/.github/workflows/cloud-deploy.yml@refs/heads/main' &&
assertion.event_name in ['push', 'workflow_dispatch']
```

Grant only:

| Recipient                                                         | Grant                                                                                             | Scope                                                               |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| This pool's `attribute.repository_id/REPOSITORY_ID` principal set | `roles/iam.workloadIdentityUser`                                                                  | The deployment service account only                                 |
| Deployment service account                                        | `roles/compute.osAdminLogin`                                                                      | VM `resumeforge-demo` only                                          |
| Deployment service account                                        | `roles/iap.tunnelResourceAccessor`                                                                | That VM's IAP TCP resource only, condition `destination.port == 22` |
| Deployment service account                                        | Custom lookup role with `compute.instances.get`, `compute.instances.list`, `compute.projects.get` | Project `resume-forge-dev`                                          |

OS Admin Login permits root commands on this VM. Consequently this identity can access the VM's application secrets and private database; main-branch writers become deployment administrators. Restrict write/merge access to personal `main`. The VM currently has no attached service account, so no permission to impersonate a VM service account is needed. Do not grant Owner, Editor, Compute Instance Admin or project-wide SSH administration.

Enable IAM, IAM Service Account Credentials, Security Token Service, OS Login and IAP APIs where not already enabled. Keep the existing OS Login metadata and IAP-only firewall intact. Use the [Google federation setup](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines), [OS Login roles](https://docs.cloud.google.com/compute/docs/oslogin/set-up-oslogin) and [VM-scoped IAP grant](https://docs.cloud.google.com/iap/docs/using-tcp-forwarding#grant-access-to-specific-vm) instructions. Preserve existing IAM policy bindings and etags when editing policies.

## GitHub activation

Set repository Actions variables on personal `nishank23/ResumeForge`:

| Variable                     | Value                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| `GCP_WIF_PROVIDER`           | `projects/551688915016/locations/global/workloadIdentityPools/resumeforge-github/providers/github-main` |
| `GCP_DEPLOY_SERVICE_ACCOUNT` | `resumeforge-github@resume-forge-dev.iam.gserviceaccount.com`                                           |
| `CLOUD_DEPLOY_ENABLED`       | Leave absent until the cloud permissions and first release are approved; then set `true`                |

Merge the reviewed CI/CD candidate into personal `main`. First run verification with deployment disabled, then enable deployment and manually dispatch `main`. Confirm image IDs, VM/local/public health, sign-in and saved-resume/PDF behavior before treating the first release as verified. Merely merging YAML does not prove cloud authentication, IAP transfer or rollback on the actual VM.

Disable future deployments by setting `CLOUD_DEPLOY_ENABLED=false`. This does not stop an already-running systemd deployment. Inspect its VM unit rather than cancelling it mid-update. Revoke access by removing the service account's federation binding or disabling its provider; preserve existing human access.

## Recovery and retention

The immediate previous images are `forge-studio:ci-rollback` and `forge-studio-web:ci-rollback`. A failed deployment exits nonzero even after successful rollback. If rollback also fails, it prints an operator-attention message; inspect the transient unit's journal and the existing private backup. Do not restore a database dump automatically over newer user writes.

The deployer consumes this run's transferred image archive after loading it. Docker images and verified private backups are retained; no image/volume prune or backup deletion runs automatically. Review disk usage and retention before enabling frequent releases. A failed preflight may leave its incoming bundle for inspection. Low disk space fails before changing running services.

## Cost and evidence

GitHub Free currently includes 2,000 standard-runner minutes per month for private repositories. This workflow stores no Actions artifacts or registry images and uses no remote build cache. Build time and IAP transfer consume runner minutes; other account usage shares the allowance. Over-quota runs can cost money if billing permits it. Check account usage and a zero-spend Actions budget before activation. [GitHub billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

Local deployment orchestration tests use mocked Docker/backup/network commands; they exercise success, rollback, retry and fail-closed behavior without reading production secrets. GitHub CI, first real IAP transfer, the VM's systemd execution and real-VM rollback still require live verification after activation. This document does not claim those have passed.
