# FSD-002: Self-Custody Key Generation

**Status:** DRAFT
**Author:** CIRISPortal Team
**Created:** 2026-03-25
**Last Updated:** 2026-03-25

---

## 1. Executive Summary

This document specifies the Self-Custody (Self-Sovereign) key model for CIRIS agent identity. Under this model, agents generate their own cryptographic signing keys locally, and only register the **public key** with CIRISRegistry. The private key never leaves the agent's control.

### 1.1 Regulatory Context

**Critical requirement:** CIRIS must not be perceived as facilitating money transfers or acting as a custodian of assets.

Under the current "Custodied" model:

- Portal generates Ed25519 signing keys on behalf of agents
- Private keys are encrypted and stored in Cloudflare KV
- Portal can theoretically sign on behalf of any agent

**Risk:** If agent signing keys are ever used to authorize financial transactions (DeFi, payments, etc.), Portal holding private keys could constitute:

- Money transmission (FinCEN MSB registration required)
- Custodianship (SEC/state licensing implications)
- Fiduciary responsibility for key security

**Solution:** Self-Custody model eliminates these risks:

- Agent generates keys locally (on-device or in customer's HSM/KMS)
- Portal stores **only public keys** for signature verification
- Portal cannot sign anything — it is purely an identity registry
- No custodial relationship exists

### 1.2 Model Comparison

| Aspect              | Custodied (Current)       | Self-Custody (Proposed)   |
| ------------------- | ------------------------- | ------------------------- |
| Key Generation      | Registry/Portal           | Agent (local)             |
| Private Key Storage | Cloudflare KV (encrypted) | Agent-controlled          |
| Signing Capability  | Portal can sign           | Portal cannot sign        |
| Public Key Storage  | Registry                  | Registry                  |
| Regulatory Risk     | Potential MSB/custodian   | Identity registry only    |
| Key Recovery        | Steward escrow            | Customer responsibility   |
| Setup Complexity    | Lower (automatic)         | Higher (customer manages) |

---

## 2. Current Model: Custodied Keys

### 2.1 Flow Overview

```
┌─────────────┐     1. Device Auth      ┌─────────────┐
│   Agent     │ ──────────────────────► │   Portal    │
│  (Device)   │                         │  (Next.js)  │
└─────────────┘                         └──────┬──────┘
       ▲                                       │
       │                                       │ 2. GenerateKeyPair RPC
       │                                       ▼
       │                                ┌─────────────┐
       │   4. Private Key (one-time)    │  Registry   │
       │ ◄──────────────────────────────│   (Rust)    │
       │                                └─────────────┘
       │                                       │
       │   5. Activation Proof                 │ 3. Store public key
       │ ──────────────────────────────────────┤    Return private key
       ▼                                       ▼
┌─────────────┐                         ┌─────────────┐
│  Agent Key  │                         │  Public Key │
│  Storage    │                         │   Record    │
└─────────────┘                         └─────────────┘
```

### 2.2 Security Properties

1. **Private key returned once** — Never stored in Registry after generation
2. **Activation proof required** — Agent must sign challenge to prove possession
3. **Key reuse detection** — Same public key on multiple devices triggers revocation
4. **Envelope encryption** — If stored (KV), uses per-org derived keys

### 2.3 Limitations

1. **Portal generates keys** — Creates implicit custodial relationship
2. **Signing delegation possible** — `RequestSignature` RPC exists in proto
3. **Key recovery via escrow** — Steward holds encrypted backup
4. **Regulatory ambiguity** — Could be classified as custodian

---

## 3. Proposed Model: Self-Custody Keys

### 3.1 Design Principles

1. **Agent owns the key** — Private key generated and stored by agent
2. **Portal is a registry** — Stores only public keys for verification
3. **No signing capability** — Portal cannot sign on behalf of agents
4. **Customer responsibility** — Key backup/recovery is customer's concern
5. **Attestation optional** — Hardware binding recommended but not required

### 3.2 Flow Overview

```
┌─────────────┐                         ┌─────────────┐
│   Agent     │  1. Generate keypair    │   Portal    │
│  (Device)   │      locally            │  (Next.js)  │
└──────┬──────┘                         └──────┬──────┘
       │                                       │
       │  2. RegisterPublicKey(pub_key)        │
       │ ─────────────────────────────────────►│
       │                                       │
       │                                       │ 3. Store public key
       │                                       │    in Registry
       │                                       ▼
       │                                ┌─────────────┐
       │                                │  Registry   │
       │                                │   (Rust)    │
       │                                └──────┬──────┘
       │                                       │
       │  4. Challenge for activation          │
       │ ◄─────────────────────────────────────│
       │                                       │
       │  5. Signed challenge (proof)          │
       │ ─────────────────────────────────────►│
       │                                       │
       │  6. Key ACTIVE                        │
       │ ◄─────────────────────────────────────│
       ▼                                       ▼
┌─────────────┐                         ┌─────────────┐
│  Agent Key  │                         │  Public Key │
│  (Private)  │                         │   Record    │
│  LOCAL ONLY │                         │  (No Priv)  │
└─────────────┘                         └─────────────┘
```

### 3.3 Key Generation Requirements

Agents MUST generate keys using approved algorithms:

| Algorithm | Purpose                 | Key Size    | Signature Size |
| --------- | ----------------------- | ----------- | -------------- |
| Ed25519   | Classical signing       | 32 bytes    | 64 bytes       |
| ML-DSA-65 | Post-quantum (optional) | ~1952 bytes | ~3309 bytes    |

**Entropy requirements:**

- CSPRNG with minimum 256 bits entropy
- Hardware RNG preferred (TPM, Secure Enclave)
- MUST NOT use deterministic derivation from low-entropy seeds

### 3.4 Public Key Registration

New RPC for registering agent-generated public keys:

```protobuf
// Register an externally-generated public key
rpc RegisterPublicKey(RegisterPublicKeyRequest) returns (RegisterPublicKeyResponse);

message RegisterPublicKeyRequest {
  string org_id = 1;

  // Public keys (at least ed25519 required)
  bytes ed25519_public_key = 2;       // 32 bytes
  bytes ml_dsa_65_public_key = 3;     // ~1952 bytes (optional)

  // Proof of possession (sign a server-provided challenge)
  bytes registration_challenge = 10;   // Server-issued nonce
  bytes ed25519_signature = 11;        // Signature over challenge
  bytes ml_dsa_65_signature = 12;      // Optional PQ signature

  // Metadata
  string requester_user_id = 20;
  string key_label = 21;               // Human-readable label
  KeyGenerationAttestation attestation = 22;  // Optional hardware attestation

  RequestContext context = 50;
}

message RegisterPublicKeyResponse {
  PartnerKeyRecord key_record = 1;     // Created record (PENDING status)
  bytes activation_challenge = 2;       // Challenge for activation step

  ErrorDetail error = 40;
  ResponseContext context = 50;
}

// Optional: Attestation that key was generated in secure hardware
message KeyGenerationAttestation {
  string hardware_type = 1;            // "TPM_2_0", "IOS_SECURE_ENCLAVE", etc.
  bytes attestation_certificate = 2;   // Hardware-signed certificate
  bytes key_attestation = 3;           // Proof key is non-exportable
}
```

### 3.5 Activation Flow

After registration, key must be activated via proof of possession:

```protobuf
// Activate a self-custody key by proving possession
rpc ActivateSelfCustodyKey(ActivateSelfCustodyKeyRequest) returns (AdminResponse);

message ActivateSelfCustodyKeyRequest {
  string org_id = 1;
  string key_id = 2;

  // Sign the activation_challenge from registration response
  bytes activation_challenge = 10;
  bytes ed25519_signature = 11;
  bytes ml_dsa_65_signature = 12;      // Required if PQ key was registered

  // Bind to agent identity
  string agent_hash = 20;              // SHA-256 of agent binary

  RequestContext context = 50;
}
```

### 3.6 Key Lifecycle

Self-custody keys follow the same lifecycle as custodied keys:

```
PENDING ──► ACTIVE ──► ROTATED
                │
                ▼
             REVOKED
```

**Rotation for self-custody:**

1. Agent generates new keypair locally
2. Agent calls `RegisterPublicKey` with new public key
3. Agent calls `RotateSelfCustodyKey` to transition
4. Old key enters grace period (configurable, default 72h)
5. Old key auto-transitions to ROTATED after grace period

```protobuf
rpc RotateSelfCustodyKey(RotateSelfCustodyKeyRequest) returns (RotateKeyResponse);

message RotateSelfCustodyKeyRequest {
  string org_id = 1;
  string new_key_id = 2;               // Key registered via RegisterPublicKey

  // Prove ownership of BOTH old and new keys
  bytes rotation_challenge = 10;
  bytes old_key_signature = 11;        // Signed by current active key
  bytes new_key_signature = 12;        // Signed by new key

  KeyRotationMode mode = 20;
  int32 grace_period_hours = 21;
  string reason = 22;

  RequestContext context = 50;
}
```

---

## 4. Security Considerations

### 4.1 Threat Model

| Threat            | Custodied Model   | Self-Custody Model           |
| ----------------- | ----------------- | ---------------------------- |
| Portal compromise | All keys exposed  | Public keys only (no impact) |
| Agent compromise  | Single agent key  | Single agent key             |
| Key theft         | Portal liable     | Customer liable              |
| Insider threat    | Portal staff risk | No Portal access to keys     |
| Regulatory action | Portal as target  | Customer as target           |

### 4.2 Key Security Requirements

**For agent implementations:**

1. **Secure storage** — Private keys MUST be stored in:
   - Hardware security module (HSM)
   - Trusted Platform Module (TPM)
   - Secure Enclave (iOS/macOS)
   - Encrypted keystore with hardware-backed key
   - At minimum: OS keychain with biometric protection

2. **Key isolation** — Private key MUST NOT be:
   - Logged or printed
   - Transmitted over network (except as signatures)
   - Stored in plaintext files
   - Accessible to other processes

3. **Backup responsibility** — Customer MUST:
   - Maintain secure backups of private keys
   - Implement key recovery procedures
   - Accept liability for key loss

### 4.3 Proof of Possession

All public key registrations MUST include cryptographic proof:

1. **Registration challenge** — Server issues random 32-byte nonce
2. **Signature required** — Agent signs: `SHA256("CIRIS-KEY-REGISTER:" || nonce || org_id || timestamp)`
3. **Replay prevention** — Challenge valid for 5 minutes, single use
4. **Binding** — Signature binds key to specific org and registration request

### 4.4 Key Reuse Prevention

Same protections as custodied model:

1. **Public key hash indexed** — Prevents same key registered to multiple orgs
2. **Cross-org detection** — Registry checks all orgs for duplicate public keys
3. **Revocation on reuse** — Attempted reuse triggers automatic revocation

---

## 5. Regulatory Compliance

### 5.1 Money Transmission Analysis

**FinCEN MSB Definition (31 CFR 1010.100(ff)(5)):**

> "Money transmitter" includes a person that provides money transmission services, or any other person engaged in the transfer of funds.

**Self-Custody Model Analysis:**

| Factor                               | Assessment                          |
| ------------------------------------ | ----------------------------------- |
| Does Portal hold customer funds?     | NO — Portal holds no private keys   |
| Can Portal transfer value?           | NO — Cannot sign transactions       |
| Does Portal control access to funds? | NO — Customer controls private keys |
| Is Portal an intermediary?           | NO — Only verifies signatures       |

**Conclusion:** Self-custody model positions Portal as an **identity verification service**, not a money transmitter.

### 5.2 Custody Analysis

**SEC Custody Rule (17 CFR 275.206(4)-2):**
Applies to investment advisers with custody of client assets.

**Self-Custody Model:**

- Portal never has custody of private keys
- Portal cannot sign or authorize transactions
- Portal is a public key registry only

**Conclusion:** No custody relationship exists.

### 5.3 Required Disclaimers

All self-custody key registrations MUST include acknowledgment:

```
By registering a self-custody key, you acknowledge:

1. You are solely responsible for the security of your private key
2. CIRIS does not have access to your private key
3. CIRIS cannot recover your private key if lost
4. CIRIS cannot sign transactions on your behalf
5. You accept all liability for key compromise or loss
6. You have implemented appropriate backup procedures
```

### 5.4 Audit Trail

Self-custody operations logged for compliance:

| Event                  | Data Logged                                     |
| ---------------------- | ----------------------------------------------- |
| Key Registration       | org_id, public_key_hash, timestamp, user_id, IP |
| Key Activation         | key_id, agent_hash, timestamp                   |
| Key Rotation           | old_key_id, new_key_id, reason, timestamp       |
| Key Revocation         | key_id, reason, timestamp, actor                |
| Signature Verification | key_id, message_hash, result, timestamp         |

---

## 6. Implementation Plan

### 6.1 Phase 1: Proto and Registry (Week 1-2)

**CIRISRegistry changes:**

1. Add proto messages:
   - `RegisterPublicKeyRequest/Response`
   - `ActivateSelfCustodyKeyRequest`
   - `RotateSelfCustodyKeyRequest`
   - `KeyGenerationAttestation`

2. Implement RPCs:
   - `RegisterPublicKey` — Store public key, return challenge
   - `ActivateSelfCustodyKey` — Verify proof, activate key
   - `RotateSelfCustodyKey` — Dual-signature rotation

3. Database schema:
   - Add `custody_model` column to keys table
   - Index for `public_key_hash` uniqueness check
   - No private key storage for self-custody

### 6.2 Phase 2: Portal Integration (Week 2-3)

**CIRISPortal changes:**

1. gRPC client functions:
   - `registerPublicKey()`
   - `activateSelfCustodyKey()`
   - `rotateSelfCustodyKey()`

2. Device auth flow update:
   - New path for self-custody agents
   - Skip key generation step
   - Accept public key from agent

3. UI updates:
   - Key management page shows custody model
   - Self-custody keys show "Customer Managed" badge
   - No "Rotate" button for self-custody (agent must initiate)

### 6.3 Phase 3: Agent SDK (Week 3-4)

**Agent implementation:**

1. Key generation utilities:
   - Ed25519 keypair generation
   - Secure storage abstraction (HSM, TPM, Keychain)
   - ML-DSA-65 generation (when available)

2. Registration flow:
   - Generate keypair locally
   - Request registration challenge from Portal
   - Sign challenge and submit with public key
   - Store private key securely

3. Signing utilities:
   - Load private key from secure storage
   - Sign messages/transactions
   - Clear key from memory after use

### 6.4 Phase 4: Migration Path (Week 4-5)

**For existing custodied keys:**

1. No forced migration — custodied keys remain valid
2. Optional migration path:
   - Agent generates new self-custody keypair
   - Agent registers new public key
   - Agent requests rotation from custodied to self-custody
   - Old custodied key marked ROTATED after grace period

3. Org-level setting:
   - `require_self_custody: bool` — Reject new custodied registrations
   - Allows gradual transition

---

## 7. API Reference

### 7.1 RegisterPublicKey

**Endpoint:** `PortalService.RegisterPublicKey`

**Request:**

```json
{
  "org_id": "uuid",
  "ed25519_public_key": "base64",
  "ml_dsa_65_public_key": "base64 (optional)",
  "registration_challenge": "base64 (from GetRegistrationChallenge)",
  "ed25519_signature": "base64",
  "requester_user_id": "string",
  "key_label": "Production Signing Key"
}
```

**Response:**

```json
{
  "key_record": {
    "key_id": "uuid",
    "org_id": "uuid",
    "status": "KEY_PENDING",
    "custody_model": "SELF_SOVEREIGN",
    "public_keys": {
      "ed25519_public_key": "base64",
      "ed25519_fingerprint": "SHA256:..."
    }
  },
  "activation_challenge": "base64"
}
```

### 7.2 ActivateSelfCustodyKey

**Endpoint:** `PortalService.ActivateSelfCustodyKey`

**Request:**

```json
{
  "org_id": "uuid",
  "key_id": "uuid",
  "activation_challenge": "base64",
  "ed25519_signature": "base64",
  "agent_hash": "sha256hex"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Key activated"
}
```

### 7.3 GetRegistrationChallenge

**Endpoint:** `PortalService.GetRegistrationChallenge`

**Request:**

```json
{
  "org_id": "uuid"
}
```

**Response:**

```json
{
  "challenge": "base64 (32 bytes)",
  "expires_at": 1234567890
}
```

---

## 8. Testing Requirements

### 8.1 Unit Tests

1. Key generation produces valid Ed25519 keypairs
2. Signature verification accepts valid signatures
3. Signature verification rejects invalid signatures
4. Challenge expiration enforced
5. Duplicate public key detection works

### 8.2 Integration Tests

1. Full registration flow (generate → register → activate)
2. Rotation flow (register new → rotate → grace period)
3. Revocation flow
4. Cross-org duplicate detection
5. Concurrent registration handling

### 8.3 Security Tests

1. Challenge replay rejected
2. Expired challenge rejected
3. Wrong org signature rejected
4. Tampered public key rejected
5. Invalid signature format rejected

---

## 9. Open Questions

1. **ML-DSA-65 requirement** — Should PQ keys be mandatory for self-custody?
2. **Hardware attestation** — Require proof of secure hardware for certain tiers?
3. **Key escrow option** — Allow optional steward escrow for self-custody?
4. **Rotation grace period** — Default 72h appropriate for self-custody?
5. **Rate limiting** — Max key registrations per org per day?

---

## 10. Appendix

### A. Signature Format

```
message = SHA256(
  "CIRIS-" || operation || ":" ||
  challenge || ":" ||
  org_id || ":" ||
  timestamp_unix
)

signature = Ed25519.sign(private_key, message)
```

Operations:

- `KEY-REGISTER` — Public key registration
- `KEY-ACTIVATE` — Key activation
- `KEY-ROTATE` — Key rotation (signed by both old and new)
- `KEY-REVOKE` — Voluntary revocation

### B. Hardware Attestation (Optional)

For TPM 2.0:

```
attestation = {
  "type": "TPM_2_0",
  "ak_certificate": "base64 (Attestation Key cert)",
  "key_attestation": "base64 (TPM2_Certify output)",
  "pcr_values": { "0": "hex", "7": "hex" }
}
```

For iOS Secure Enclave:

```
attestation = {
  "type": "IOS_SECURE_ENCLAVE",
  "device_attestation": "base64 (DeviceCheck attestation)",
  "key_attestation": "base64 (SecKeyCreateAttestation output)"
}
```

### C. Migration Checklist

- [ ] Proto definitions added to CIRISRegistry
- [ ] Registry RPCs implemented and tested
- [ ] Portal gRPC client updated
- [ ] Device auth flow supports self-custody
- [ ] Key management UI updated
- [ ] Agent SDK key generation utilities
- [ ] Documentation updated
- [ ] Legal review of disclaimers
- [ ] Security audit completed
