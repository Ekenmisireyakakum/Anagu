# Phase 2 Blockchain — Validation Report

Date: 2026-11-16T10:23:21+01:00

## Check Results

| Check | Result |
|---|---|
| 1. Hardhat compile | PASS |
| 2. LandTitleNFT tests (9/9) | PASS |
| 3. LandRegistry tests (10/10) | PASS |
| 4. ValidatorRegistry tests (5/5) | PASS |
| 5. Full suite (24/24) | PASS |
| 6. NestJS tsc --noEmit | PASS |

## Full Hardhat Test Output

```
npm warn config ignoring workspace config at C:\Users\StarLab\Desktop\Library\Anagu\packages\contracts/.npmrc

  LandRegistry
    √ register parcel and mint NFT (4781ms)
    √ emit LandRegistered event (210ms)
    √ prevent duplicate registration (106ms)
    √ REGISTRAR transfers ownership (79ms)
    √ prevent direct NFT transfer bypassing registry (48ms)
    √ GOVERNOR revokes through registry (53ms)
    √ prevent non-GOVERNOR revocation (50ms)
    √ prevent transfer of revoked parcel (67ms)
    √ maintain full ownership history (3 entries) (290ms)
    √ gas for registerLand < 500000 (128ms)
  LandTitleNFT
    √ deploy with correct roles (919ms)
    √ mint with metadata (159ms)
    √ emit TitleIssued event
    √ prevent direct user transfer
    √ GOVERNOR revokes title
    √ prevent double revocation (59ms)
    √ prevent non-GOVERNOR revocation
    √ prevent transfer of revoked title
    √ store and retrieve full metadata (89ms)
  ValidatorRegistry
    √ addValidator sets correct state (85ms)
    √ getTotalWeight sums all weights
    √ removeValidator removes from list (53ms)
    √ updateWeight changes weight
    √ prevent non-ADMIN from adding validator

  24 passing (8s)
```

## Commit

`0390db0` — feat: add NestJS BlockchainModule with service, controller, DTOs

> Phase 2 work was already committed in full; the working tree was clean at validation time.
> This validation file is committed as a separate chore commit.
