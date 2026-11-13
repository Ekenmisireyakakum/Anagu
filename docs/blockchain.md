# ANAGU Blockchain Architecture

## Network

- **Platform**: Hyperledger Besu
- **Consensus**: QBFT (Quorum Byzantine Fault Tolerant)
- **Chain ID**: 1337
- **Validators**: 4 nodes
- **Block period**: 1 second
- **Gas price**: 0 (permissioned)

## Setting Up the Network

### 1. Generate Validator Keys

```bash
# Using the Besu CLI:
besu operator generate-blockchain-config \
  --config-file=config.json \
  --to=infrastructure/besu/networkFiles \
  --private-key-file-name=key
```

This generates key pairs for each validator. Copy the keys:
```
infrastructure/besu/validators/node1/key   ← private key (NEVER commit)
infrastructure/besu/validators/node1/key.pub
```

### 2. Update genesis.json extraData

The `extraData` field in genesis.json encodes the initial validator set.
After generating keys, run:

```bash
besu rlp encode --type=QBFT_EXTRA_DATA \
  --validators=0xADDR1,0xADDR2,0xADDR3,0xADDR4
```

Replace the placeholder in `infrastructure/besu/genesis.json`.

### 3. Start the Network

```bash
docker compose up besu-node1 besu-node2 besu-node3 besu-node4
```

## Smart Contracts

### LandRegistry.sol (Phase 2)
- Stores land parcel registrations on-chain
- Functions: `registerParcel`, `transferOwnership`, `getParcel`

### LandTitleNFT.sol (Phase 3)
- ERC-721 NFT representing a land title deed
- Functions: `mintTitle`, `revokeTitle`, `tokenURI`
- Access-controlled: only GOVERNOR role can mint/revoke

## Deploying Contracts

```bash
cd packages/contracts
npm run deploy:local
```

After deployment, update `.env`:
```
LAND_REGISTRY_CONTRACT_ADDRESS=0x...
LAND_TITLE_NFT_CONTRACT_ADDRESS=0x...
```
