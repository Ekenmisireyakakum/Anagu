#!/usr/bin/env bash
# Generate Hyperledger Besu validator key pairs for the ANAGU network.
# Prerequisites: Besu CLI must be installed (https://besu.hyperledger.org/)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")/infrastructure/besu"

echo "Generating Besu validator keys into $INFRA_DIR/validators/"

for i in 1 2 3 4; do
  NODE_DIR="$INFRA_DIR/validators/node$i"
  mkdir -p "$NODE_DIR"
  besu --data-path="$NODE_DIR" public-key export --to="$NODE_DIR/key.pub" 2>/dev/null || true
  echo "  node$i: keys generated in $NODE_DIR"
done

echo ""
echo "After generating keys, update genesis.json extraData with the validator addresses."
echo "Use: besu operator generate-blockchain-config --config-file=config.json --to=networkFiles --private-key-file-name=key"
