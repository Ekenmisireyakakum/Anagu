# ANAGU Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Identity Integrity**: Users may only create `/users/{userId}`, `/users/{userId}/private/{infoId}`, `/applications/{applicationId}`, `/audit_logs/{logId}`, and `/contacts/{contactId}` where the owner UID (`uid`, `applicantId`, `actorId`, `senderUid`) equals `request.auth.uid` (unless `isAdmin()`).
2. **Privilege Escalation Prevention**: New users creating `/users/{userId}` can only set `role == 'CITIZEN'` and `isActive == true`. Users cannot modify `role` or `isActive` on update unless `isAdmin()`.
3. **PII Isolation**: Email and phone live exclusively in `/users/{userId}/private/{infoId}` and are readable/writable only by the owning user (`userId == request.auth.uid`) or `isAdmin()`.
4. **Terminal State Locking**: Once an application reaches `REGISTERED`, `REVOKED`, or `CANCELLED`, non-admin users cannot update it. Once a title reaches `isRevoked == true`, it cannot be transferred or mutated.
5. **Temporal Integrity**: All `createdAt` and `updatedAt` timestamps must match `request.time`.
6. **Audit Log Immutability**: `/audit_logs/{logId}` documents are append-only (`allow update, delete: if false;`).

## 2. "Dirty Dozen" Adversarial Payloads (Expected: PERMISSION_DENIED)
1. **Self-Assigned Admin Role**: `CREATE /users/{uid}` with `role: 'GOVERNOR'` by non-admin user -> DENIED.
2. **Shadow Field Injection**: `CREATE /users/{uid}` with extra field `isSuperAdmin: true` -> DENIED (`keys().hasOnly(...)`).
3. **Unverified Email Spoof**: Request with matching admin email where `request.auth.token.email_verified == false` -> DENIED (`isVerifiedUser()`).
4. **PII Cross-Read**: `GET /users/{otherUid}/private/info` by non-owner non-admin -> DENIED.
5. **Blanket List Scraping**: `LIST /applications` without `applicantId == request.auth.uid` filter by non-admin -> DENIED.
6. **Identity Spoofing on Application**: `CREATE /applications/{id}` with `applicantId: "someone-else"` -> DENIED.
7. **Timestamp Forgery**: `CREATE /applications/{id}` with client-backdated `createdAt` != `request.time` -> DENIED.
8. **ID Poisoning**: `CREATE /applications/{1500-char-id}` -> DENIED (`isValidId()`).
9. **Array Type/Size Poisoning**: `CREATE /applications/{id}` with 15 `documentHashes` or integer element -> DENIED (`size() <= 10`, `[0] is string`).
10. **Terminal State Bypass**: `UPDATE /applications/{id}` when `existing().status == 'REGISTERED'` by non-admin -> DENIED.
11. **Non-Admin Title Mint/Revoke**: `CREATE /titles/{id}` or `UPDATE /titles/{id}` setting `isRevoked: true` by non-admin -> DENIED.
12. **Audit Log Tampering**: `UPDATE` or `DELETE` on `/audit_logs/{id}` -> DENIED.
