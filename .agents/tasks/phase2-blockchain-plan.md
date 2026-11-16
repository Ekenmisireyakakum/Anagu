# Implementation Plan — Phase 2: Blockchain

**Workspace root:** `C:\Users\StarLab\Desktop\Library\Anagu`

## Exploration findings

- `packages/contracts/` contains only `hardhat.config.ts`, `package.json`, `tsconfig.json` — no contracts, scripts, test, artifacts, or node_modules. All Solidity files must be created from scratch.
- `packages/contracts/package.json` uses `@openzeppelin/contracts ^5.0.2` and `hardhat ^2.22.6` with `@nomicfoundation/hardhat-toolbox ^5.0.0`.
- `hardhat.config.ts` targets Solidity `0.8.24`, `typechain` output is `typechain-types` with `ethers-v6` target, `paths.artifacts = "./artifacts"`.
- `apps/api/package.json` already has `ethers ^6.13.1` in dependencies and `@nestjs/config`, `class-validator`, `class-transformer` — no installs needed for FEAT-003.
- `apps/api/src/app.module.ts` currently imports `GisModule`, `AuthModule`, `UsersModule` — `BlockchainModule` must be added.
- `apps/api/tsconfig.json` has `strictNullChecks: false` and `noImplicitAny: false` — contracts TypeChain types resolve fine.
- `infrastructure/besu/validators/node{1..4}/` directories exist with only `.gitkeep` files — key files must be written.
- `infrastructure/besu/genesis.json` has placeholder validator addresses `0x0000...0001` through `0x0000...0004` and must be updated.
- `infrastructure/besu/genesis.README.md` already exists; it must be replaced with the required content.
- QBFT extraData computed for the 4 Hardhat test addresses (sorted ascending):
  - `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` (node3)
  - `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` (node2)
  - `0x90F79bf6EB2c4f870365E785982E1f101E93b906` (node4)
  - `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` (node1)
  - **extraData:** `0xf87aa00000000000000000000000000000000000000000000000000000000000000000f854943c44cdddb6a900fa2b585dd299e03d12fa4293bc9470997970c51812dc3a010c7d01b50e0d17dc79c89490f79bf6eb2c4f870365e785982e1f101e93b90694f39fd6e51aad88f6f4ce6ab8827279cfffb92266c080c0`
- `@ethereumjs/rlp` and root `node_modules/hardhat` are present (hoisted from packages/contracts before `npm install` there), but `packages/contracts/node_modules` does not exist — `npm install` must run first.
- OZ v5 uses `_update` hook instead of `_beforeTokenTransfer`/`_afterTokenTransfer`. Transfer restriction must override `_update`.
- The `deployments/` directory under `packages/contracts` does not exist — `deploy.ts` must create it.

---

## Implementation Steps

- [ ] 1. Write 4 Besu validator key files.
      Write the hex private key (no `0x` prefix, no trailing newline) for each node into the placeholder directories.
      - `C:\Users\StarLab\Desktop\Library\Anagu\infrastructure\besu\validators\node1\key` → `ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
      - `C:\Users\StarLab\Desktop\Library\Anagu\infrastructure\besu\validators\node2\key` → `59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`
      - `C:\Users\StarLab\Desktop\Library\Anagu\infrastructure\besu\validators\node3\key` → `5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a`
      - `C:\Users\StarLab\Desktop\Library\Anagu\infrastructure\besu\validators\node4\key` → `7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6`
      Files:
      - `infrastructure/besu/validators/node1/key`
      - `infrastructure/besu/validators/node2/key`
      - `infrastructure/besu/validators/node3/key`
      - `infrastructure/besu/validators/node4/key`
      Verify: `Get-Content infrastructure\besu\validators\node1\key` → prints exactly `ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` (64 hex chars, nothing else).

- [ ] 2. Update `genesis.json` with real validator addresses and computed extraData.
      Replace the two existing placeholder `alloc` entries with all 4 Hardhat validator addresses, each with balance `0xad78ebc5ac6200000`. Replace `extraData` with the QBFT-encoded value computed for the 4 real addresses.
      File: `C:\Users\StarLab\Desktop\Library\Anagu\infrastructure\besu\genesis.json`
      New `alloc`:
      ```json
      "alloc": {
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266": { "balance": "0xad78ebc5ac6200000" },
        "0x70997970C51812dc3A010C7d01b50e0d17dc79C8": { "balance": "0xad78ebc5ac6200000" },
        "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC": { "balance": "0xad78ebc5ac6200000" },
        "0x90F79bf6EB2c4f870365E785982E1f101E93b906": { "balance": "0xad78ebc5ac6200000" }
      }
      ```
      New `extraData`:
      `0xf87aa00000000000000000000000000000000000000000000000000000000000000000f854943c44cdddb6a900fa2b585dd299e03d12fa4293bc9470997970c51812dc3a010c7d01b50e0d17dc79c89490f79bf6eb2c4f870365e785982e1f101e93b90694f39fd6e51aad88f6f4ce6ab8827279cfffb92266c080c0`
      Verify: `Get-Content infrastructure\besu\genesis.json | ConvertFrom-Json | Select -ExpandProperty extraData` → prints the exact extraData string above.

- [ ] 3. Replace `genesis.README.md` with the required content.
      The file must document: (a) these are Hardhat test keys, never use in production; (b) how to generate real keys with `docker run hyperledger/besu:latest operator generate-blockchain-config`; (c) the validator address list; (d) how to update extraData using `besu rlp encode`.
      File: `C:\Users\StarLab\Desktop\Library\Anagu\infrastructure\besu\genesis.README.md`
      Verify: file exists and contains the string "NEVER use in production".

- [ ] 4. Install npm dependencies in `packages/contracts`.
      Run `npm install` from `packages/contracts`. This installs `hardhat`, `@nomicfoundation/hardhat-toolbox`, `@openzeppelin/contracts v5`, `typescript`, `ts-node`, ethers, typechain, etc.
      Command: `cd C:\Users\StarLab\Desktop\Library\Anagu\packages\contracts && npm install`
      Verify: `packages/contracts/node_modules/@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol` exists.

- [ ] 5. Create `LandTitleNFT.sol`.
      File: `C:\Users\StarLab\Desktop\Library\Anagu\packages\contracts\contracts\LandTitleNFT.sol`
      Solidity 0.8.24. Inherits `ERC721URIStorage`, `AccessControl`, `ReentrancyGuard` from OZ v5.
      Key implementation details:
      - `bytes32 public constant REGISTRY_ROLE = keccak256("REGISTRY_ROLE");`
      - `bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");`
      - `TitleMetadata` struct with fields: `parcelReference`, `spatialHash`, `ownerReference`, `documentHash`, `issuedAt`, `isRevoked`, `revokedAt`, `revocationGrounds`, `revokedBy`.
      - `mapping(uint256 => TitleMetadata) public titleMetadata`
      - `mapping(uint256 => bool) public isRevoked` (separate flag for quick checks)
      - `_update(address to, uint256 tokenId, address auth)` override: if `auth != address(0)` and `!hasRole(REGISTRY_ROLE, msg.sender)`, revert with `"LandTitleNFT: direct transfer not allowed"`.
      - `mint(address to, uint256 tokenId, string memory uri)` — `onlyRole(REGISTRY_ROLE)`, calls `_mint` then `_setTokenURI`, populates `titleMetadata`, emits `TitleIssued(tokenId, to)`.
      - `burn(uint256 tokenId)` — `onlyRole(REGISTRY_ROLE)`, calls `_burn`.
      - `revoke(uint256 tokenId, string memory grounds)` — `onlyRole(GOVERNOR_ROLE)`, requires `!isRevoked[tokenId]`, sets `titleMetadata[tokenId].isRevoked = true`, `isRevoked[tokenId] = true`, sets `revokedAt`, `revocationGrounds`, `revokedBy = msg.sender`, emits `TitleRevoked(tokenId, msg.sender, grounds)`.
      - `getTitleMetadata(uint256 tokenId)` returns `TitleMetadata memory`.
      - Constructor `(address admin)`: grants `DEFAULT_ADMIN_ROLE`, `REGISTRY_ROLE`, `GOVERNOR_ROLE` to `admin`.
      - Events: `TitleIssued(uint256 indexed tokenId, address indexed to)`, `TitleRevoked(uint256 indexed tokenId, address indexed by, string grounds)`.
      Verify: `cd packages/contracts && npx hardhat compile` succeeds (can compile this file alone once LandRegistry and ValidatorRegistry also exist — but partial compile works if only this file is present).

- [ ] 6. Create `LandRegistry.sol`.
      File: `C:\Users\StarLab\Desktop\Library\Anagu\packages\contracts\contracts\LandRegistry.sol`
      Solidity 0.8.24. Inherits `AccessControl`, `ReentrancyGuard` from OZ v5. Holds a reference to `LandTitleNFT`.
      Key implementation details:
      - `bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");`
      - `bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");`
      - `RecordStatus` enum: `Active`, `Transferred`, `Revoked`, `Cancelled`.
      - `LandRecord` struct: `tokenId`, `parcelReference`, `currentOwner`, `spatialHash`, `ownerReference`, `documentHash`, `registeredAt`, `lastUpdatedAt`, `RecordStatus status`.
      - `mapping(string => LandRecord) public records`
      - `mapping(string => address[]) public ownershipHistory`
      - `uint256 private _tokenIdCounter = 1`
      - `LandTitleNFT public landTitleNFT`
      - `registerLand(address owner, string memory parcelReference, string memory spatialHash, string memory ownerReference, string memory documentHash, string memory uri)` — `onlyRole(REGISTRAR_ROLE)`, `nonReentrant`. Requires `records[parcelReference].registeredAt == 0` (not already registered). Mints via `landTitleNFT.mint(owner, _tokenIdCounter, uri)`. Creates `LandRecord`. Pushes `owner` to `ownershipHistory[parcelReference]`. Increments `_tokenIdCounter`. Emits `LandRegistered(parcelReference, _tokenIdCounter - 1, owner)`.
      - `transferOwnership(string memory parcelReference, address newOwner)` — `onlyRole(REGISTRAR_ROLE)`, `nonReentrant`. Requires record is `Active`. Gets `currentOwner` from record. Calls `landTitleNFT.safeTransferFrom(currentOwner, newOwner, tokenId)`. Updates `records[parcelReference].currentOwner = newOwner`, `status = Transferred` then back to `Active`, `lastUpdatedAt`. Pushes `newOwner` to `ownershipHistory`. Emits `OwnershipTransferred(parcelReference, tokenId, oldOwner, newOwner)`.
      - `revokeTitle(string memory parcelReference, string memory grounds)` — `onlyRole(GOVERNOR_ROLE)`, `nonReentrant`. Requires record exists and is `Active`. Calls `landTitleNFT.revoke(tokenId, grounds)`. Updates `records[parcelReference].status = Revoked`, `lastUpdatedAt`. Emits `LandRevoked(parcelReference, tokenId, grounds)`.
      - `getRecord(string memory parcelReference)` returns `LandRecord memory`.
      - `getOwnershipHistory(string memory parcelReference)` returns `address[] memory`.
      - Constructor `(address admin, address _landTitleNFT)`: grants `DEFAULT_ADMIN_ROLE`, `REGISTRAR_ROLE`, `GOVERNOR_ROLE` to `admin`. Sets `landTitleNFT`.
      - Events: `LandRegistered(string indexed parcelReference, uint256 indexed tokenId, address indexed owner)`, `OwnershipTransferred(string indexed parcelReference, uint256 indexed tokenId, address indexed from, address to)`, `LandRevoked(string indexed parcelReference, uint256 indexed tokenId, string grounds)`.
      Verify: `cd packages/contracts && npx hardhat compile` — both contracts compile without errors.

- [ ] 7. Create `ValidatorRegistry.sol`.
      File: `C:\Users\StarLab\Desktop\Library\Anagu\packages\contracts\contracts\ValidatorRegistry.sol`
      Solidity 0.8.24. Inherits `AccessControl` from OZ v5.
      Key implementation details:
      - `bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");`
      - `mapping(address => uint256) public validatorWeight`
      - `mapping(address => bool) public isValidator`
      - `address[] private _validators`
      - `addValidator(address validator, uint256 weight)` — `onlyRole(ADMIN_ROLE)`, requires `!isValidator[validator]`. Sets `isValidator[validator] = true`, `validatorWeight[validator] = weight`, pushes to `_validators`. Emits `ValidatorAdded(validator, weight)`.
      - `removeValidator(address validator)` — `onlyRole(ADMIN_ROLE)`, requires `isValidator[validator]`. Sets `isValidator[validator] = false`, `validatorWeight[validator] = 0`. Removes from `_validators` array by swap-and-pop. Emits `ValidatorRemoved(validator)`.
      - `updateWeight(address validator, uint256 weight)` — `onlyRole(ADMIN_ROLE)`, requires `isValidator[validator]`. Updates weight. Emits `ValidatorWeightUpdated(validator, weight)`.
      - `getValidators()` returns `address[] memory`.
      - `getTotalWeight()` returns `uint256` — iterates `_validators`, sums weights.
      - Constructor `(address admin)`: grants `DEFAULT_ADMIN_ROLE` and `ADMIN_ROLE` to `admin`.
      - NatSpec `@dev` on the contract: "Advisory registry only. QBFT consensus is not modified by this contract."
      - Events: `ValidatorAdded`, `ValidatorRemoved`, `ValidatorWeightUpdated`.
      Verify: `cd C:\Users\StarLab\Desktop\Library\Anagu\packages\contracts && npx hardhat compile` — all 3 contracts compile, artifacts appear under `packages/contracts/artifacts/contracts/`.

- [ ] 8. Create `deploy.ts` Hardhat script.
      File: `C:\Users\StarLab\Desktop\Library\Anagu\packages\contracts\scripts\deploy.ts`
      Steps in script:
      1. Deploy `LandTitleNFT` with `deployer.address` as admin.
      2. Deploy `LandRegistry` with `deployer.address` and `landTitleNFT.target` as constructor args.
      3. Grant `REGISTRY_ROLE` on `LandTitleNFT` to `LandRegistry` address: `await landTitleNFT.grantRole(await landTitleNFT.REGISTRY_ROLE(), landRegistry.target)`.
      4. Deploy `ValidatorRegistry` with `deployer.address` as admin.
      5. Create `packages/contracts/deployments/` directory if it does not exist.
      6. Write `packages/contracts/deployments/addresses.json` with:
         ```json
         {
           "network": "<network name>",
           "chainId": <chainId>,
           "LandTitleNFT": "<address>",
           "LandRegistry": "<address>",
           "ValidatorRegistry": "<address>",
           "deployedAt": "<ISO timestamp>"
         }
         ```
      Use `hre.network.name`, `hre.network.config.chainId`, `fs.writeFileSync` from `node:fs`.
      Verify: `cd C:\Users\StarLab\Desktop\Library\Anagu\packages\contracts && npx hardhat run scripts/deploy.ts` (runs on hardhat network) — exits 0 and prints deployed addresses.

- [ ] 9. Create `generate-test-accounts.ts` Hardhat script.
      File: `C:\Users\StarLab\Desktop\Library\Anagu\packages\contracts\scripts\generate-test-accounts.ts`
      Uses `hre.ethers.getSigners()` to get signers from the Hardhat built-in network (derived from default mnemonic: `test test test test test test test test test test test junk`).
      Prints index 0–4 labeled: deployer, governor, registrar, surveyor, citizen.
      Format per line: `<role>: <address>  (private key derivable from Hardhat default mnemonic, index N)`.
      Verify: `cd C:\Users\StarLab\Desktop\Library\Anagu\packages\contracts && npx hardhat run scripts/generate-test-accounts.ts` — prints 5 lines starting with `deployer:`.

- [ ] 10. Create `LandTitleNFT.test.ts` with 9 test cases.
       File: `C:\Users\StarLab\Desktop\Library\Anagu\packages\contracts\test\LandTitleNFT.test.ts`
       Uses `@nomicfoundation/hardhat-toolbox` fixtures (`loadFixture`), `ethers`, and `expect` from `chai` (all provided by the toolbox). No extra imports needed.

       Test fixture `deployLandTitleNFT`:
       - Gets signers: `[admin, governor, registrar, user1, user2]`
       - Deploys `LandTitleNFT(admin.address)`
       - Grants `REGISTRY_ROLE` to `registrar`; grants `GOVERNOR_ROLE` to `governor` (admin already has both from constructor — grant to separate signers for negative tests)

       **9 test cases:**
       1. `deploy with correct roles` — admin has `DEFAULT_ADMIN_ROLE`, `REGISTRY_ROLE`, `GOVERNOR_ROLE`. registrar has `REGISTRY_ROLE`. governor has `GOVERNOR_ROLE`. user1 has none.
       2. `mint with metadata` — `registrar.mint(user1.address, 1, "ipfs://test")`. `titleMetadata[1].issuedAt > 0`. `ownerOf(1) == user1.address`. `tokenURI(1) == "ipfs://test"`.
       3. `emit TitleIssued event` — expect `TitleIssued(1, user1.address)` from `mint(user1.address, 1, "ipfs://test")`.
       4. `prevent direct user transfer` — mint token 1 to user1. Call `contract.connect(user1).transferFrom(user1.address, user2.address, 1)`. Expect revert with `"LandTitleNFT: direct transfer not allowed"`.
       5. `GOVERNOR revokes title` — mint token 1. `governor.revoke(1, "fraud")`. `isRevoked[1] == true`. `titleMetadata[1].isRevoked == true`.
       6. `prevent double revocation` — mint token 1, revoke it. Second `governor.revoke(1, "again")` reverts.
       7. `prevent non-GOVERNOR revocation` — mint token 1. `contract.connect(user1).revoke(1, "try")` reverts (AccessControl error).
       8. `prevent transfer of revoked title` — mint token 1, revoke it. `contract.connect(registrar).transferFrom(user1.address, user2.address, 1)` reverts (direct REGISTRY transfer of a revoked title should fail — add a check in `_update`: if `isRevoked[tokenId]`, revert `"LandTitleNFT: title is revoked"`).
       9. `store and retrieve full metadata` — mint with specific struct values. Call `getTitleMetadata(1)`. Assert all struct fields match.

       Note on test 8: `_update` must also check `isRevoked[tokenId]` and revert even for REGISTRY_ROLE callers — add this check before the role check.

       Verify: `cd C:\Users\StarLab\Desktop\Library\Anagu\packages\contracts && npx hardhat test test/LandTitleNFT.test.ts` — 9/9 pass.

- [ ] 11. Create `LandRegistry.test.ts` with 10 test cases.
       File: `C:\Users\StarLab\Desktop\Library\Anagu\packages\contracts\test\LandRegistry.test.ts`

       Test fixture `deployLandRegistry`:
       - Gets signers: `[admin, governor, registrar, user1, user2]`
       - Deploys `LandTitleNFT(admin.address)` → deploys `LandRegistry(admin.address, nft.target)`
       - Grants `REGISTRY_ROLE` on NFT to `LandRegistry.target`
       - Grants `REGISTRAR_ROLE` on LandRegistry to `registrar`
       - Grants `GOVERNOR_ROLE` on LandRegistry to `governor`

       **10 test cases:**
       1. `register parcel and mint NFT` — `registrar.registerLand(user1.address, "LG-001", "hash1", "owner-ref-1", "doc-hash-1", "ipfs://1")`. `records["LG-001"].tokenId == 1`. `nft.ownerOf(1) == user1.address`.
       2. `emit LandRegistered event` — expect `LandRegistered("LG-001", 1, user1.address)`.
       3. `prevent duplicate registration` — register "LG-001", then register "LG-001" again. Second call reverts.
       4. `REGISTRAR transfers ownership` — register to user1, then `registrar.transferOwnership("LG-001", user2.address)`. `records["LG-001"].currentOwner == user2.address`. `nft.ownerOf(1) == user2.address`.
       5. `prevent direct NFT transfer bypassing registry` — register to user1. `nft.connect(user1).transferFrom(user1.address, user2.address, 1)` reverts.
       6. `GOVERNOR revokes through registry` — register, then `governor.revokeTitle("LG-001", "fraud")`. `records["LG-001"].status == RecordStatus.Revoked`. `nft.isRevoked(1) == true`.
       7. `prevent non-GOVERNOR revocation` — register, then `contract.connect(user1).revokeTitle("LG-001", "try")` reverts.
       8. `prevent transfer of revoked parcel` — register, revoke, then `registrar.transferOwnership("LG-001", user2.address)` reverts (require status == Active).
       9. `maintain full ownership history (3 entries)` — register to user1 (1st), transfer to user2 (2nd), transfer to user1 again (3rd). `getOwnershipHistory("LG-001").length == 3`.
       10. `gas for registerLand < 500000` — call `registerLand`, get `receipt.gasUsed`. `expect(receipt.gasUsed).to.be.lessThan(500000n)`.

       Verify: `cd C:\Users\StarLab\Desktop\Library\Anagu\packages\contracts && npx hardhat test test/LandRegistry.test.ts` — 10/10 pass.

- [ ] 12. Create `ValidatorRegistry.test.ts` with 5 test cases.
       File: `C:\Users\StarLab\Desktop\Library\Anagu\packages\contracts\test\ValidatorRegistry.test.ts`

       Test fixture `deployValidatorRegistry`:
       - Gets signers: `[admin, validator1, validator2, nonAdmin]`
       - Deploys `ValidatorRegistry(admin.address)`

       **5 test cases:**
       1. `addValidator sets correct state` — `admin.addValidator(validator1.address, 100)`. `isValidator[validator1.address] == true`. `validatorWeight[validator1.address] == 100`. `getValidators()` contains `validator1.address`.
       2. `getTotalWeight sums all weights` — add validator1 (weight 100) and validator2 (weight 50). `getTotalWeight() == 150`.
       3. `removeValidator removes from list` — add validator1, remove validator1. `isValidator[validator1.address] == false`. `getValidators().length == 0`.
       4. `updateWeight changes weight` — add validator1 with weight 100, `updateWeight(validator1.address, 200)`. `validatorWeight[validator1.address] == 200`. `getTotalWeight() == 200`.
       5. `prevent non-ADMIN from adding validator` — `contract.connect(nonAdmin).addValidator(validator1.address, 100)` reverts.

       Verify: `cd C:\Users\StarLab\Desktop\Library\Anagu\packages\contracts && npx hardhat test test/ValidatorRegistry.test.ts` — 5/5 pass.

- [ ] 13. Run full Hardhat test suite.
       Command: `cd C:\Users\StarLab\Desktop\Library\Anagu\packages\contracts && npx hardhat test`
       Expected: 24 tests pass (9 + 10 + 5), 0 failing.
       Also check gas report output from `@nomicfoundation/hardhat-toolbox` — confirm `registerLand` gas < 500,000.

- [ ] 14. Create the NestJS `BlockchainModule` files.
       Depends on: step 13 (artifacts must exist for ABI loading path to be valid).

       **File: `C:\Users\StarLab\Desktop\Library\Anagu\apps\api\src\blockchain\dto\register-land.dto.ts`**
       ```typescript
       import { IsString, IsNotEmpty, IsEthereumAddress } from 'class-validator';

       export class RegisterLandDto {
         @IsEthereumAddress() ownerAddress: string;
         @IsString() @IsNotEmpty() parcelReference: string;
         @IsString() @IsNotEmpty() spatialHash: string;
         @IsString() @IsNotEmpty() ownerReference: string;
         @IsString() @IsNotEmpty() documentHash: string;
         @IsString() @IsNotEmpty() tokenUri: string;
       }
       ```

       **File: `C:\Users\StarLab\Desktop\Library\Anagu\apps\api\src\blockchain\dto\transfer-ownership.dto.ts`**
       ```typescript
       import { IsString, IsNotEmpty, IsEthereumAddress } from 'class-validator';

       export class TransferOwnershipDto {
         @IsString() @IsNotEmpty() parcelReference: string;
         @IsEthereumAddress() newOwnerAddress: string;
       }
       ```

       **File: `C:\Users\StarLab\Desktop\Library\Anagu\apps\api\src\blockchain\dto\revoke-title.dto.ts`**
       ```typescript
       import { IsString, IsNotEmpty } from 'class-validator';

       export class RevokeTitleDto {
         @IsString() @IsNotEmpty() parcelReference: string;
         @IsString() @IsNotEmpty() grounds: string;
       }
       ```

       Files: all 3 DTOs under `apps/api/src/blockchain/dto/`.
       Verify: `cd C:\Users\StarLab\Desktop\Library\Anagu\apps\api && npx tsc --noEmit` after all blockchain module files are created (run as final step 17).

- [ ] 15. Create `blockchain.service.ts`.
       File: `C:\Users\StarLab\Desktop\Library\Anagu\apps\api\src\blockchain\blockchain.service.ts`
       Uses `ethers` v6 (`JsonRpcProvider`, `Contract`, `Wallet`). Loads ABIs from artifact files at relative path `../../../../packages/contracts/artifacts/contracts/<Name>.sol/<Name>.json` (resolved at runtime with `path.resolve(__dirname, ...)`).
       Constructor: decorated `@Injectable()`, injected `ConfigService`. Builds `JsonRpcProvider` from `BESU_RPC_URL`. Creates contract instances for `LandTitleNFT` and `LandRegistry` using addresses from `LAND_TITLE_NFT_CONTRACT_ADDRESS` and `LAND_REGISTRY_CONTRACT_ADDRESS` env vars. If addresses are empty, the service logs a warning but does not throw (allows compile-time check without running Besu).

       **Methods:**
       - `async isConnected(): Promise<{ connected: boolean; blockNumber?: number; chainId?: number }>` — calls `provider.getBlockNumber()` and `provider.getNetwork()`. Returns `{ connected: true, blockNumber, chainId }` on success; `{ connected: false }` on error.
       - `async registerLand(dto: RegisterLandDto): Promise<{ txHash: string; tokenId: number }>` — calls `landRegistry.registerLand(...)`, awaits receipt, extracts `tokenId` from `LandRegistered` event log.
       - `async transferOwnership(dto: TransferOwnershipDto): Promise<{ txHash: string }>` — calls `landRegistry.transferOwnership(...)`, awaits receipt.
       - `async revokeTitle(dto: RevokeTitleDto): Promise<{ txHash: string }>` — calls `landRegistry.revokeTitle(...)`, awaits receipt.
       - `async getTitleMetadata(tokenId: number): Promise<object>` — calls `landTitleNFT.getTitleMetadata(tokenId)`, returns the struct as a plain object.
       - `async getRecord(parcelReference: string): Promise<object>` — calls `landRegistry.getRecord(parcelReference)`, returns struct as plain object.
       - `async listenToEvents(eventName: string, callback: (event: any) => void): Promise<void>` — calls `landRegistry.on(eventName, callback)`.

       Signing wallet: load from `DEPLOYER_PRIVATE_KEY` env var (if set), connect to provider, then connect contracts with the signer. If key is absent, contracts are read-only.
       Files: `apps/api/src/blockchain/blockchain.service.ts`

- [ ] 16. Create `blockchain.controller.ts` and `blockchain.module.ts`.
       **File: `C:\Users\StarLab\Desktop\Library\Anagu\apps\api\src\blockchain\blockchain.controller.ts`**
       ```
       GET  /blockchain/status               → blockchainService.isConnected()
       GET  /blockchain/record/:parcelRef    → blockchainService.getRecord(parcelRef)
       GET  /blockchain/title/:tokenId       → blockchainService.getTitleMetadata(+tokenId)
       ```
       All 3 routes. No auth guard needed for Phase 2 (can be added later).

       **File: `C:\Users\StarLab\Desktop\Library\Anagu\apps\api\src\blockchain\blockchain.module.ts`**
       ```typescript
       import { Module } from '@nestjs/common';
       import { ConfigModule } from '@nestjs/config';
       import { BlockchainService } from './blockchain.service';
       import { BlockchainController } from './blockchain.controller';

       @Module({
         imports: [ConfigModule],
         providers: [BlockchainService],
         controllers: [BlockchainController],
         exports: [BlockchainService],
       })
       export class BlockchainModule {}
       ```

       Files: `apps/api/src/blockchain/blockchain.controller.ts`, `apps/api/src/blockchain/blockchain.module.ts`

- [ ] 17. Wire `BlockchainModule` into `app.module.ts` and run TypeScript compile check.
       Add `BlockchainModule` import to `apps/api/src/app.module.ts`:
       ```typescript
       import { BlockchainModule } from './blockchain/blockchain.module';
       // add to @Module imports array alongside GisModule, AuthModule, UsersModule
       ```
       Then run the compile check.
       Files: `apps/api/src/app.module.ts`
       Verify: `cd C:\Users\StarLab\Desktop\Library\Anagu\apps\api && npx tsc --noEmit` — zero TypeScript errors.

- [ ] 18. Phase 2 validation gate — run all checks and report pass/fail.
       Execute each check in order and record result:

       **Check 1 — Hardhat compile:**
       ```powershell
       cd C:\Users\StarLab\Desktop\Library\Anagu\packages\contracts
       npx hardhat compile
       ```
       Pass: exits 0, prints "Compiled N Solidity files successfully".

       **Check 2 — LandTitleNFT tests (9/9):**
       ```powershell
       npx hardhat test test/LandTitleNFT.test.ts
       ```
       Pass: `9 passing`.

       **Check 3 — LandRegistry tests (10/10):**
       ```powershell
       npx hardhat test test/LandRegistry.test.ts
       ```
       Pass: `10 passing`.

       **Check 4 — ValidatorRegistry tests (5/5):**
       ```powershell
       npx hardhat test test/ValidatorRegistry.test.ts
       ```
       Pass: `5 passing`.

       **Check 5 — Gas for registerLand < 500,000:**
       From the receipt captured in LandRegistry test 10: `gasUsed < 500000`.

       **Check 6 — Revocation blocked for non-GOVERNOR:**
       Covered by LandTitleNFT test 7 and LandRegistry test 7.

       **Check 7 — Direct transfer blocked:**
       Covered by LandTitleNFT test 4 and LandRegistry test 5.

       **Check 8 — NestJS blockchain module compiles:**
       ```powershell
       cd C:\Users\StarLab\Desktop\Library\Anagu\apps\api
       npx tsc --noEmit
       ```
       Pass: exits 0, zero errors.

       Record results as `PASS` or `FAIL` for each check in a summary comment.

---

## File manifest

New files to create:

| File | Step |
|---|---|
| `infrastructure/besu/validators/node1/key` | 1 |
| `infrastructure/besu/validators/node2/key` | 1 |
| `infrastructure/besu/validators/node3/key` | 1 |
| `infrastructure/besu/validators/node4/key` | 1 |
| `infrastructure/besu/genesis.json` (modified) | 2 |
| `infrastructure/besu/genesis.README.md` (replaced) | 3 |
| `packages/contracts/contracts/LandTitleNFT.sol` | 5 |
| `packages/contracts/contracts/LandRegistry.sol` | 6 |
| `packages/contracts/contracts/ValidatorRegistry.sol` | 7 |
| `packages/contracts/scripts/deploy.ts` | 8 |
| `packages/contracts/scripts/generate-test-accounts.ts` | 9 |
| `packages/contracts/test/LandTitleNFT.test.ts` | 10 |
| `packages/contracts/test/LandRegistry.test.ts` | 11 |
| `packages/contracts/test/ValidatorRegistry.test.ts` | 12 |
| `apps/api/src/blockchain/dto/register-land.dto.ts` | 14 |
| `apps/api/src/blockchain/dto/transfer-ownership.dto.ts` | 14 |
| `apps/api/src/blockchain/dto/revoke-title.dto.ts` | 14 |
| `apps/api/src/blockchain/blockchain.service.ts` | 15 |
| `apps/api/src/blockchain/blockchain.controller.ts` | 16 |
| `apps/api/src/blockchain/blockchain.module.ts` | 16 |
| `apps/api/src/app.module.ts` (modified) | 17 |
