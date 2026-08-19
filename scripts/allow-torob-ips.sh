#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/allow-torob-ips.sh" >&2
  exit 1
fi

if ! command -v ufw >/dev/null 2>&1; then
  echo "UFW is not installed. Add the Torob networks to your provider firewall instead." >&2
  exit 1
fi

# Exact decomposition of 81.12.31.192-81.12.31.254, plus Torob's fixed IPs.
TOROB_NETWORKS=(
  "81.12.31.192/27"
  "81.12.31.224/28"
  "81.12.31.240/29"
  "81.12.31.248/30"
  "81.12.31.252/31"
  "81.12.31.254/32"
  "91.107.165.81/32"
  "188.121.119.29/32"
  "195.201.30.135/32"
)

for network in "${TOROB_NETWORKS[@]}"; do
  ufw allow proto tcp from "${network}" to any port 80 comment 'Torob API'
  ufw allow proto tcp from "${network}" to any port 443 comment 'Torob API'
done

ufw reload
ufw status numbered
echo "Torob IP ranges are allowed on ports 80 and 443."
