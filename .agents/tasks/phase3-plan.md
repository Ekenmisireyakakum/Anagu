# Implementation Plan — Phase 3: MQTT, Ownership Oracle, Applications

**Workspace root:** `C:\Users\StarLab\Desktop\Library\Anagu`
**Artifact root:** `C:\Users\StarLab\Desktop\Library\Anagu\.agents\tasks\task-phase3\`

## Exploration findings

- `apps/api/src/app.module.ts` currently imports `GisModule, AuthModule, UsersModule, BlockchainModule`. Three new modules join it this phase.
- `DATABASE_POOL` injection pattern is in `database.providers.ts` and used identically in `gis.service.ts` via `@Inject('DATABASE_POOL') private readonly pool: Pool`. All new services follow this pattern.
- `apps/api/package.json` already has `mqtt: ^5.9.1` in dependencies — no install needed.
- Jest config is embedded in `package.json` under the `"jest"` key. No `jest.config.js` exists — the plan creates one so `moduleNameMapper` can be added for `@anagu/shared` resolution without touching `package.json`.
- `@anagu/shared` is hoisted to `node_modules/@anagu/shared` at the repo root, accessible to `apps/api` via `moduleNameMapper` in `jest.config.js`.
- `ApplicationStatus` enum is in `packages/shared/src/types/application-status.ts`. `OWNERSHIP_VERIFICATION` (not `APPROVED`) is the correct post-oracle status.
- `MQTT_TOPICS` constants are in `packages/shared/src/types/mqtt-topics.ts`. Relevant: `APPLICATION_SUBMITTED`, `APPLICATION_STATUS_CHANGED`, `OWNERSHIP_VERIFIED`.
- Existing spec files (`gis.service.spec.ts`, `auth.service.spec.ts`) use real Postgres with `new Pool({ connectionString })` — no mocking. MQTT spec follows the same pattern against real Mosquitto.
- Migrations 001–003 already applied. Migration 004 creates `anagu.applications` and `anagu.oracle_verifications`.
- **Key constraint:** Oracle service writes to `oracle_verifications` and publishes MQTT — it never updates `applications.status`. That is `ApplicationsService`'s job. When oracle outcome is `VERIFIED`, `ApplicationsService` moves status to `OWNERSHIP_VERIFICATION`, not `APPROVED`.

---

## Implementation Plan

- [ ] 1. Create the database migration file `004_applications_oracle_tables.sql`.
      Creates `anagu.applications` (id, applicant_id FK→users, parcel_id FK→land_parcels, status VARCHAR with CHECK constraint covering all 11 `ApplicationStatus` values, application_data JSONB, submitted_at, updated_at) and `anagu.oracle_verifications` (id, application_id FK→applications, institutional_verified, community_verified, institutional_details JSONB, community_details JSONB, overall_outcome VARCHAR CHECK IN ('VERIFIED','DISPUTED','INCONCLUSIVE','PENDING'), notes, verified_at). Include `updated_at` trigger on `applications` using the existing `anagu.update_updated_at()` function. Add indexes on `applications(applicant_id)`, `applications(status)`, `oracle_verifications(application_id)`.
      Files: `packages/database/migrations/004_applications_oracle_tables.sql`
      Verify: `psql postgresql://anagu:anagu_password@localhost:5432/anagu_db -f packages/database/migrations/004_applications_oracle_tables.sql` exits 0 with no errors.

- [ ] 2. Create `apps/api/jest.config.js`.
      A CommonJS module.exports that re-states the same config embedded in `package.json` and adds `moduleNameMapper: { '^@anagu/shared$': '<rootDir>/../../node_modules/@anagu/shared/src/index.ts' }`. Use bare `'ts-jest'` as the transform value (not a `<rootDir>` path) so Jest resolves it normally. The `package.json` `"jest"` key remains in place and does not need to be removed — Jest will prefer `jest.config.js` when it exists.
      Files: `apps/api/jest.config.js`
      Verify: `cd apps/api && npx jest --listTests` exits 0.

- [ ] 3. Create the MQTT module files (`mqtt.events.ts`, `mqtt.service.ts`, `mqtt.module.ts`).
      `mqtt.events.ts` — re-exports `MQTT_EVENTS` typed const pointing at MQTT_TOPICS values and `MqttPublishPayload` interface.
      `mqtt.service.ts` — `@Injectable()`, implements `OnModuleInit` / `OnModuleDestroy`. On init: `mqtt.connect(MQTT_BROKER_URL ?? 'mqtt://localhost:1883')`. Exposes `publish(topic, payload, qos=1): Promise<void>` and `subscribe(topic, handler): void`. Uses raw `mqtt` npm package, not `@nestjs/microservices`.
      `mqtt.module.ts` — `@Module({ providers:[MqttService], exports:[MqttService] })`. ConfigModule is global so no import needed.
      Files: `apps/api/src/mqtt/mqtt.events.ts`, `apps/api/src/mqtt/mqtt.service.ts`, `apps/api/src/mqtt/mqtt.module.ts`
      Verify: `cd apps/api && npx tsc --noEmit` — no errors from the new files.

- [ ] 4. Create `mqtt.service.spec.ts` and confirm all 3 MQTT tests pass against real Mosquitto.
      Tests: (1) connects to Mosquitto on localhost:1883 without error; (2) publishes a message to `anagu/test/phase3` and promise resolves; (3) round-trips a message — subscribe before publish to `anagu/test/roundtrip`, assert received payload matches sent. `jest.setTimeout(15000)`. `afterAll` calls `onModuleDestroy()`.
      Files: `apps/api/src/mqtt/mqtt.service.spec.ts`
      Verify: `cd apps/api && npx jest --testPathPattern=src/mqtt --forceExit` — 3 passing.

- [ ] 5. Create the Oracle module interfaces, DTOs, mock services, and oracle service.
      Depends on steps 1, 3 (migration + MqttService).
      - `oracle/interfaces/oracle.interfaces.ts` — `InstitutionalCheckResult`, `CommunityCheckResult`, `OracleVerificationResult` interfaces.
      - `oracle/dto/ownership-claim.dto.ts` — `OwnershipClaimDto` with `@IsUUID() applicationId`, `@IsString() @IsNotEmpty() parcelReference`, `claimantName`, optional `nationalIdHash`, optional `titleDeedHash`.
      - `oracle/mock-institutional.service.ts` — `@Injectable()`. `checkOwnership(parcelRef, claimantName, nationalIdHash?)`: 200ms simulated delay; if `parcelRef` ends with `-DISPUTED` returns `{ verified: false, ... }`; otherwise `{ verified: true, referenceId: 'INST-'+Date.now(), details: { registry:'LASRECCA', confirmedOwner: claimantName } }`.
      - `oracle/mock-community.service.ts` — `@Injectable()`. `getAttestation(parcelRef, claimantName)`: 100ms delay; if `parcelRef` ends with `-NOATTEST` returns `{ verified: false, attestationCount: 0, details: {} }`; otherwise `{ verified: true, attestationCount: 3, details: { witnesses: ['Elder A','Elder B','Elder C'] } }`.
      - `oracle/oracle.service.ts` — `@Injectable()`. Injects `DATABASE_POOL`, `MqttService`, `MockInstitutionalService`, `MockCommunityService`. Method `verifyOwnership(dto)`: runs both checks, determines `overallOutcome` (DISPUTED if institutional fails; INCONCLUSIVE if institutional passes but community fails; VERIFIED if both pass), INSERTs into `anagu.oracle_verifications`, publishes `MQTT_TOPICS.OWNERSHIP_VERIFIED` only when outcome is VERIFIED, returns `OracleVerificationResult`. **Does not read or write `anagu.applications`.**
      Files: `apps/api/src/oracle/interfaces/oracle.interfaces.ts`, `apps/api/src/oracle/dto/ownership-claim.dto.ts`, `apps/api/src/oracle/mock-institutional.service.ts`, `apps/api/src/oracle/mock-community.service.ts`, `apps/api/src/oracle/oracle.service.ts`
      Verify: `cd apps/api && npx tsc --noEmit` — no new errors.

- [ ] 6. Create `oracle.controller.ts` and `oracle.module.ts`.
      `oracle.controller.ts` — `@Controller('oracle')`. `POST /oracle/verify` (JwtAuthGuard, `@Body()` dto → `oracleService.verifyOwnership`). `GET /oracle/verification/:applicationId` (JwtAuthGuard, queries `anagu.oracle_verifications` for the most recent row, 404 if none).
      `oracle.module.ts` — `@Module({ imports:[DatabaseModule, MqttModule], controllers:[OracleController], providers:[OracleService, MockInstitutionalService, MockCommunityService], exports:[OracleService] })`.
      Files: `apps/api/src/oracle/oracle.controller.ts`, `apps/api/src/oracle/oracle.module.ts`
      Verify: `cd apps/api && npx tsc --noEmit` — no errors.

- [ ] 7. Create `oracle.service.spec.ts` and run all 5 oracle tests.
      Depends on steps 1, 3, 5, 6.
      Tests use real Postgres (localhost:5432) and real Mosquitto (localhost:1883). Instantiate `Pool`, `MqttService`, `MockInstitutionalService`, `MockCommunityService`, and `OracleService` directly (no NestJS test module needed — same pattern as `gis.service.spec.ts`).
      5 tests: (1) VERIFIED outcome for a normal parcel; (2) DISPUTED when parcel ref ends in `-DISPUTED`; (3) INCONCLUSIVE when parcel ref ends in `-NOATTEST`; (4) row written to `anagu.oracle_verifications`; (5) OWNERSHIP_VERIFIED MQTT published when outcome is VERIFIED (subscribe before call, await message in Promise with 5s timeout).
      `afterAll`: delete test rows by known application IDs, `pool.end()`, `mqttService.onModuleDestroy()`.
      Files: `apps/api/src/oracle/oracle.service.spec.ts`
      Verify: `cd apps/api && npx jest --testPathPattern=src/oracle --forceExit` — 5 passing.

- [ ] 8. Create the Applications module (`create-application.dto.ts`, `applications.service.ts`, `applications.controller.ts`, `applications.module.ts`).
      Depends on steps 1, 3, 5, 6.
      - `applications/dto/create-application.dto.ts` — `@IsUUID() @IsOptional() parcelId?`, `@IsString() @IsNotEmpty() parcelReference`, `claimantName`, optional `nationalIdHash`, `titleDeedHash`, `applicationData`.
      - `applications/applications.service.ts` — Injects `DATABASE_POOL`, `MqttService`, `OracleService`. `createApplication(applicantId, dto)`: INSERT → publish `APPLICATION_SUBMITTED` → fire oracle check as a **non-blocking** `.catch()`-guarded call → return `{ id, status:'SUBMITTED', submittedAt }`. When the oracle resolves VERIFIED, the callback (or `.then()`) calls `this.updateApplicationStatus(id, ApplicationStatus.OWNERSHIP_VERIFICATION)` — **not** `APPROVED`. `listApplications(applicantId?)`: SELECT with optional filter. `getApplicationById(id)`: SELECT, returns null if absent. `updateApplicationStatus(id, newStatus)`: UPDATE + publish `APPLICATION_STATUS_CHANGED`.
      - `applications/applications.controller.ts` — `@Controller('applications')`. All routes behind JwtAuthGuard. `POST /` → `createApplication(user.id, dto)`. `GET /` → `listApplications(user.id)`. `GET /:id` → `getApplicationById`, NotFoundException if null.
      - `applications/applications.module.ts` — `@Module({ imports:[DatabaseModule, MqttModule, OracleModule], controllers:[ApplicationsController], providers:[ApplicationsService], exports:[ApplicationsService] })`.
      Files: `apps/api/src/applications/dto/create-application.dto.ts`, `apps/api/src/applications/applications.service.ts`, `apps/api/src/applications/applications.controller.ts`, `apps/api/src/applications/applications.module.ts`
      Verify: `cd apps/api && npx tsc --noEmit` — no errors.

- [ ] 9. Update `apps/api/src/app.module.ts` to wire in `MqttModule`, `OracleModule`, and `ApplicationsModule`.
      Add three import statements at the top and three entries in the `@Module` imports array alongside the existing modules.
      Files: `apps/api/src/app.module.ts`
      Verify: `cd apps/api && npx tsc --noEmit` — zero errors.

- [ ] 10. Final verification gate — run all checks and record pass/fail.
       Run each in order:
       - **Migration check:** `psql postgresql://anagu:anagu_password@localhost:5432/anagu_db -c "\dt anagu.*"` — both `applications` and `oracle_verifications` appear.
       - **MQTT tests:** `cd apps/api && npx jest --testPathPattern=src/mqtt --forceExit` — 3 passing.
       - **Oracle tests:** `cd apps/api && npx jest --testPathPattern=src/oracle --forceExit` — 5 passing.
       - **TypeScript compile:** `cd apps/api && npx tsc --noEmit` — 0 errors.
       If any check fails, fix the root cause before marking Phase 3 complete.
       Files: none (verification only)
       Verify: all four commands above exit 0.

---

## File manifest

| File | Step |
|---|---|
| `packages/database/migrations/004_applications_oracle_tables.sql` | 1 |
| `apps/api/jest.config.js` | 2 |
| `apps/api/src/mqtt/mqtt.events.ts` | 3 |
| `apps/api/src/mqtt/mqtt.service.ts` | 3 |
| `apps/api/src/mqtt/mqtt.module.ts` | 3 |
| `apps/api/src/mqtt/mqtt.service.spec.ts` | 4 |
| `apps/api/src/oracle/interfaces/oracle.interfaces.ts` | 5 |
| `apps/api/src/oracle/dto/ownership-claim.dto.ts` | 5 |
| `apps/api/src/oracle/mock-institutional.service.ts` | 5 |
| `apps/api/src/oracle/mock-community.service.ts` | 5 |
| `apps/api/src/oracle/oracle.service.ts` | 5 |
| `apps/api/src/oracle/oracle.controller.ts` | 6 |
| `apps/api/src/oracle/oracle.module.ts` | 6 |
| `apps/api/src/oracle/oracle.service.spec.ts` | 7 |
| `apps/api/src/applications/dto/create-application.dto.ts` | 8 |
| `apps/api/src/applications/applications.service.ts` | 8 |
| `apps/api/src/applications/applications.controller.ts` | 8 |
| `apps/api/src/applications/applications.module.ts` | 8 |
| `apps/api/src/app.module.ts` (modified) | 9 |

---

## Key architectural decisions

**Decision 1 — Raw `mqtt` npm package, not NestJS microservices.**
`MqttService` calls `mqtt.connect()` directly in `OnModuleInit`. This keeps the broker optional at startup (a failed connection logs a warning but doesn't crash the process) and avoids the opinionated message-pattern model of `@nestjs/microservices`.

**Decision 2 — Oracle service writes to DB and publishes MQTT; it never touches `applications` status.**
The two concerns are separated: `OracleService` is the verifier; `ApplicationsService` is the state machine. `ApplicationsService` fires the oracle call non-blocking and handles the result in a `.then()` callback to update application status. This prevents the oracle from accidentally auto-approving applications.

**Decision 3 — Status after VERIFIED oracle = `OWNERSHIP_VERIFICATION`, not `APPROVED`.**
`ApplicationStatus.OWNERSHIP_VERIFICATION` signals that the oracle has verified ownership and the record is waiting for a human registrar to review and move it to `PENDING_APPROVAL`. Auto-approval is explicitly blocked.

**Decision 4 — Community attestation alone is never sufficient.**
The `overallOutcome` logic tree makes institutional result the gating factor: if institutional is not verified, outcome is `DISPUTED` regardless of community result. Community attestation can only push an institutionally-confirmed case from `INCONCLUSIVE` to `VERIFIED`.

**Decision 5 — Tests connect to real infrastructure.**
Consistent with the existing `gis.service.spec.ts` and `auth.service.spec.ts` patterns, tests use live Postgres and live Mosquitto. No broker mocking.
