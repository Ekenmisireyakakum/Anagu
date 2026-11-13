# genesis.json — Important Notes

## extraData Placeholder

The `extraData` field in `genesis.json` currently uses **zero addresses** as placeholder validator addresses:

```
0x0000000000000000000000000000000000000001
0x0000000000000000000000000000000000000002
0x0000000000000000000000000000000000000003
0x0000000000000000000000000000000000000004
```

These are **not real validator keys** and must be replaced before starting the network.

## Generating Real Validator Keys

Use the Besu CLI to generate a full blockchain config including validator key pairs:

```bash
besu operator generate-blockchain-config \
  --config-file=config.json \
  --to=networkFiles \
  --private-key-file-name=key
```

This command generates:
- A `genesis.json` with the correct `extraData` encoding the real validator addresses
- Key pair files for each validator node

## Placing the Key Files

After generation, copy the private key files into the validator node directories:

```
infrastructure/besu/validators/node1/key   ← node 1 private key
infrastructure/besu/validators/node2/key   ← node 2 private key
infrastructure/besu/validators/node3/key   ← node 3 private key
infrastructure/besu/validators/node4/key   ← node 4 private key
```

> **Never commit private key files to git.** They are excluded by `.gitignore`.

## Updating extraData

After generating keys, replace the placeholder `extraData` in `genesis.json` with the value
produced by:

```bash
besu rlp encode --type=QBFT_EXTRA_DATA \
  --validators=0xADDR1,0xADDR2,0xADDR3,0xADDR4
```

Where `0xADDRN` are the Ethereum addresses derived from the generated public keys.
