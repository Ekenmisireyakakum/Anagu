# Besu Validator Keys — genesis.json

## ⚠ WARNING: These are Hardhat test keys — NEVER use in production

The private keys stored under `validators/node*/key` are the well-known Hardhat
development accounts. They are public knowledge. NEVER use in production or on
any network that holds real assets.

---

## Validator Addresses

| Node  | Address |
|-------|---------|
| node1 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |
| node2 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` |
| node3 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` |
| node4 | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` |

---

## Generating Real Keys for Production

Use the Besu operator tool to generate a full network config with fresh keys:

```bash
docker run hyperledger/besu:latest operator generate-blockchain-config \
  --config-file=/config/config.json \
  --to=/config/networkFiles \
  --private-key-file-name=key
```

Copy the generated `key` files from `networkFiles/keys/<address>/key` into the
appropriate `validators/node*/key` paths, and replace the validator addresses in
`genesis.json`.

---

## Updating extraData

The `extraData` field in `genesis.json` encodes the initial validator set as
QBFT RLP. To regenerate it after changing the validator list:

1. Create a JSON file listing the validator addresses, e.g. `validators.json`:
   ```json
   [
     "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
     "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
     "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
     "0x90F79bf6EB2c4f870365E785982E1f101E93b906"
   ]
   ```

2. Run:
   ```bash
   besu rlp encode --type=QBFT_EXTRA_DATA --input=<validators-json-file>
   ```

3. Paste the output as the `extraData` value in `genesis.json`.
