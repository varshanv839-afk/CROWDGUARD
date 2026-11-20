# CROWGUARD Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Identity & Privilege Integrity**: Users cannot self-assign `role: "admin"` during account registration or profile updates. Only verified administrators (`isAdmin()`) may write to `/admins/{adminId}` or modify `role` / `status` on `/users/{userId}`.
2. **Account Status Enforcement**: Deactivated accounts (`status: "inactive"`) are blocked at both Firestore Rules (`isActiveUser()`) and the application UI from accessing operational monitoring or creating new records.
3. **PII Isolation**: User email addresses are stored exclusively in `/users/{userId}/private/contact` and are readable/writable only by the owning user or verified admin.
4. **Immutable Audit Trail**: `/activityLogs/{logId}` entries cannot be updated or deleted once created; `list` queries enforce `resource.data.userId == request.auth.uid || isAdmin()`.
5. **Referential Consistency**: A `CrowdAlert` cannot be created without an existing parent `MonitoringSession` owned by the caller (or admin). A `GateRecommendation` cannot be created without an existing parent `CrowdAlert` owned by the caller (or admin).
6. **Immutable Ownership & Temporal Integrity**: `ownerId` and `createdAt` cannot be modified after creation; `createdAt` and `updatedAt` must equal `request.time`.
7. **Terminal State Locking**: Once an alert reaches `status: "resolved"` or a gate recommendation reaches `approvalStatus: "approved"` or `"rejected"`, non-admin operators cannot re-open or overwrite the terminal decision.
8. **Strict Schema Enforcement**: No shadow/ghost fields allowed on any create or update (`keys().hasOnly(...)` and `affectedKeys().hasOnly(...)`).
9. **Query Enforcement**: Every `list` rule validates `resource.data.ownerId == request.auth.uid || isAdmin()`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Self-Assigned Admin**: `POST /users/u1` with `{ uid: "u1", displayName: "Eve", role: "admin", ... }` -> DENIED.
2. **Profile Role Escalation**: `PATCH /users/u1` updating `{ role: "admin" }` -> DENIED.
3. **Self-Reactivation After Deactivation**: Inactive user `u1` updating `{ status: "active" }` -> DENIED.
4. **Unauthorized Admin Registry Write**: Non-admin writing `/admins/u1` -> DENIED.
5. **PII Cross-Read**: User `u2` reading `/users/u1/private/contact` -> DENIED.
6. **Email Spoofing Admin Bypass**: Signed-in user with `email == "varshanv839@gmail.com"` and `email_verified: false` listing `/users` -> DENIED.
7. **Owner Spoofing on Session**: User `u2` creating `/monitoringSessions/s1` with `ownerId: "u1"` -> DENIED.
8. **Orphaned Alert**: Creating `/alerts/a1` referencing non-existent `sessionId: "missing"` -> DENIED.
9. **Shadow Ghost Field**: Creating `/alerts/a1` with extra field `isBypassed: true` -> DENIED.
10. **Client Timestamp Forgery**: Creating `/activityLogs/l1` with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> DENIED.
11. **Terminal State Mutation**: Updating `/gateRecommendations/g1` from `approvalStatus: "approved"` back to `"pending"` as non-admin -> DENIED.
12. **Blanket List Scraping**: User `u2` querying `/alerts` or `/activityLogs` without matching `uid` -> DENIED.
