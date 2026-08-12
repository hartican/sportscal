#!/usr/bin/env bash

set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
test -d .vercel

NS_DEPLOY_DIR="$(mktemp -d /tmp/nothingsport-deploy.XXXXXX)"
test -n "${NS_DEPLOY_DIR:-}"
test -d "${NS_DEPLOY_DIR:?}"

git archive HEAD | tar -x -C "${NS_DEPLOY_DIR:?}"
cp -R .vercel "${NS_DEPLOY_DIR:?}/.vercel"
vercel --prod --yes "${NS_DEPLOY_DIR:?}"
