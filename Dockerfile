# syntax=docker/dockerfile:1
# Multi-platform index digest (amd64 and arm64); update deliberately with checks.
FROM node:24-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global pnpm@12.6.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/auth-mfe/package.json apps/auth-mfe/package.json
COPY apps/profile-mfe/package.json apps/profile-mfe/package.json
COPY apps/resume-mfe/package.json apps/resume-mfe/package.json
COPY apps/shell/package.json apps/shell/package.json
COPY packages/access-policy/package.json packages/access-policy/package.json
COPY packages/audit-contracts/package.json packages/audit-contracts/package.json
COPY packages/prisma-client/package.json packages/prisma-client/package.json
COPY packages/resume-core/package.json packages/resume-core/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY services/auth-service/package.json services/auth-service/package.json
COPY services/gateway/package.json services/gateway/package.json
COPY services/profile-service/package.json services/profile-service/package.json
COPY services/resume-service/package.json services/resume-service/package.json
COPY services/workspace-service/package.json services/workspace-service/package.json
RUN pnpm install --frozen-lockfile
COPY . .
ARG FORGE_PUBLIC_ORIGIN=""
RUN pnpm build --concurrency=2

FROM build AS checks
RUN test ! -e .env && test ! -e .local && test ! -e .git && test ! -e check_resumes \
    && pnpm check --concurrency=2 && pnpm test --concurrency=2 \
    && node --test scripts/test/development-task.test.mjs scripts/test/local-vector-config.test.mjs docker/test/*.test.mjs

FROM build AS cloud-runtime
RUN chmod -R a+rX /app
ENV NODE_ENV=production RESUME_FORGE_RUNTIME=cloud RESUME_FORGE_LOCAL_ROOT=/app
USER node
CMD ["node", "docker/start-app.mjs"]

# Serve only built public assets; no provider settings or database credentials enter this image.
FROM nginx:stable-alpine@sha256:0985e772fb9f729e6fa0980da05fca5d9c468e870eed43071545afa9d2e27d94 AS cloud-web
COPY docker/cloud.nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/apps/shell/dist /usr/share/nginx/html
COPY --from=build /app/apps/auth-mfe/dist /usr/share/nginx/html/mfe/auth
COPY --from=build /app/apps/profile-mfe/dist /usr/share/nginx/html/mfe/profile
COPY --from=build /app/apps/resume-mfe/dist /usr/share/nginx/html/mfe/resume
USER nginx
ENTRYPOINT []
CMD ["nginx", "-g", "daemon off;"]

# Preserve the default local target as well as Compose's explicit runtime target.
FROM build AS runtime
RUN chmod -R a+rX /app
ENV NODE_ENV=development RESUME_FORGE_RUNTIME=docker RESUME_FORGE_LOCAL_ROOT=/app
USER node
CMD ["node", "docker/start-app.mjs"]
