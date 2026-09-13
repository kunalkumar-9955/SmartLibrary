# QR Attendance Specification & Cryptography

## Security Objectives
1. **Prevent Static Screenshot Reuse**: Static QRs can be photographed and shared over WhatsApp to falsify attendance. The dynamic QR token contains a timestamp expiring in 60 seconds.
2. **Prevent Tampering**: The payload is signed with HMAC-SHA256 using a server-side secret (`QR_SECRET`).
3. **Replay Protection**: Even within the 60-second window, each token includes a UUID nonce stored in an in-memory replay cache upon first consumption.
4. **Cross-Tenant Prevention**: QR encodes `libraryId`. A student enrolled in Library Branch A cannot scan Library Branch B's QR code.
5. **State Machine Integrity**:
   - Entry requires: Active membership, no active attendance session, available seat.
   - Exit requires: Active attendance session currently inside.

## Payload Schema
```json
{
  "libraryId": "66bc...",
  "qrType": "ENTRY",
  "token": "d748f270-4f9e-4e4b-972a-c71b69bc4123",
  "expiresAt": 1723456789000,
  "signature": "a93f48a1c9703...",
  "libraryName": "Central City Study Hub",
  "libraryCode": "CCSH-01"
}
```
