# FSD-002: Self-Custody Key Generation

**Status:** IN PROGRESS (Registry Complete)
**Author:** CIRISPortal Team
**Created:** 2026-03-25
**Last Updated:** 2026-03-25
**Registry Commit:** 02a94ad

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

## 6. Implementation Scaffold

### 6.1 CIRISRegistry Proto Additions

Add to `protocol/ciris_registry.proto`:

```protobuf
// ============================================================================
// SELF-CUSTODY KEY REGISTRATION (v1.3.0)
// ============================================================================

message GetRegistrationChallengeRequest {
  string org_id = 1;
  RequestContext context = 10;
}

message GetRegistrationChallengeResponse {
  bytes challenge = 1;                 // 32-byte nonce
  int64 expires_at = 2;                // Unix timestamp
  ResponseContext context = 50;
}

message RegisterPublicKeyRequest {
  string org_id = 1;

  // Public keys
  bytes ed25519_public_key = 2;        // 32 bytes, required
  bytes ml_dsa_65_public_key = 3;      // ~1952 bytes, optional

  // Proof of possession
  bytes registration_challenge = 10;
  bytes ed25519_signature = 11;
  bytes ml_dsa_65_signature = 12;

  // Metadata
  string requester_user_id = 20;
  string key_label = 21;

  RequestContext context = 50;
}

message RegisterPublicKeyResponse {
  PartnerKeyRecord key_record = 1;
  bytes activation_challenge = 2;
  ErrorDetail error = 40;
  ResponseContext context = 50;
}

message ActivateSelfCustodyKeyRequest {
  string org_id = 1;
  string key_id = 2;

  bytes activation_challenge = 10;
  bytes ed25519_signature = 11;
  bytes ml_dsa_65_signature = 12;

  string agent_hash = 20;

  RequestContext context = 50;
}

message RotateSelfCustodyKeyRequest {
  string org_id = 1;
  string new_key_id = 2;

  bytes rotation_challenge = 10;
  bytes old_key_signature = 11;
  bytes new_key_signature = 12;

  KeyRotationMode mode = 20;
  int32 grace_period_hours = 21;
  string reason = 22;

  RequestContext context = 50;
}
```

Add to `service PortalService`:

```protobuf
  // Self-custody key management (v1.3.0)
  rpc GetRegistrationChallenge(GetRegistrationChallengeRequest) returns (GetRegistrationChallengeResponse);
  rpc RegisterPublicKey(RegisterPublicKeyRequest) returns (RegisterPublicKeyResponse);
  rpc ActivateSelfCustodyKey(ActivateSelfCustodyKeyRequest) returns (AdminResponse);
  rpc RotateSelfCustodyKey(RotateSelfCustodyKeyRequest) returns (RotateKeyResponse);
```

### 6.2 CIRISRegistry Rust Implementation

`rust-registry/src/services/portal.rs`:

```rust
async fn get_registration_challenge(
    &self,
    request: Request<GetRegistrationChallengeRequest>,
) -> Result<Response<GetRegistrationChallengeResponse>, Status> {
    let req = request.into_inner();

    // Generate 32-byte challenge
    let mut challenge = [0u8; 32];
    OsRng.fill_bytes(&mut challenge);

    // Store challenge with 5-minute expiry
    let expires_at = Utc::now().timestamp() + 300;
    self.challenge_store.insert(
        req.org_id.clone(),
        challenge.to_vec(),
        expires_at
    ).await?;

    Ok(Response::new(GetRegistrationChallengeResponse {
        challenge: challenge.to_vec(),
        expires_at,
        context: Some(build_response_context(&req.context)),
    }))
}

async fn register_public_key(
    &self,
    request: Request<RegisterPublicKeyRequest>,
) -> Result<Response<RegisterPublicKeyResponse>, Status> {
    let req = request.into_inner();

    // 1. Validate challenge
    let stored_challenge = self.challenge_store
        .get_and_remove(&req.org_id)
        .await?
        .ok_or_else(|| Status::invalid_argument("Invalid or expired challenge"))?;

    if stored_challenge != req.registration_challenge {
        return Err(Status::invalid_argument("Challenge mismatch"));
    }

    // 2. Verify signature over challenge
    let public_key = ed25519_dalek::VerifyingKey::from_bytes(
        &req.ed25519_public_key.try_into()
            .map_err(|_| Status::invalid_argument("Invalid public key length"))?
    ).map_err(|_| Status::invalid_argument("Invalid public key"))?;

    let signature = ed25519_dalek::Signature::from_bytes(
        &req.ed25519_signature.try_into()
            .map_err(|_| Status::invalid_argument("Invalid signature length"))?
    );

    public_key.verify_strict(&req.registration_challenge, &signature)
        .map_err(|_| Status::invalid_argument("Signature verification failed"))?;

    // 3. Check for duplicate public key across all orgs
    let pub_key_hash = sha256_hex(&req.ed25519_public_key);
    if self.db.public_key_exists(&pub_key_hash).await? {
        return Err(Status::already_exists("Public key already registered"));
    }

    // 4. Create key record (PENDING status)
    let key_id = Uuid::new_v4().to_string();
    let key_record = PartnerKeyRecord {
        key_id: key_id.clone(),
        org_id: req.org_id.clone(),
        custody_model: KeyCustodyModel::SelfSovereign as i32,
        status: KeyStatus::Pending as i32,
        public_keys: Some(PublicKeys {
            ed25519_public_key: req.ed25519_public_key.clone(),
            ed25519_fingerprint: format!("SHA256:{}", &pub_key_hash[..16]),
            ml_dsa65_public_key: req.ml_dsa_65_public_key.clone(),
            ..Default::default()
        }),
        created_at: Utc::now().timestamp_millis(),
        created_by: req.requester_user_id.clone(),
        ..Default::default()
    };

    self.db.insert_key_record(&key_record, &pub_key_hash).await?;

    // 5. Generate activation challenge
    let mut activation_challenge = [0u8; 32];
    OsRng.fill_bytes(&mut activation_challenge);
    self.activation_store.insert(&key_id, activation_challenge.to_vec()).await?;

    Ok(Response::new(RegisterPublicKeyResponse {
        key_record: Some(key_record),
        activation_challenge: activation_challenge.to_vec(),
        ..Default::default()
    }))
}

async fn activate_self_custody_key(
    &self,
    request: Request<ActivateSelfCustodyKeyRequest>,
) -> Result<Response<AdminResponse>, Status> {
    let req = request.into_inner();

    // 1. Get pending key record
    let key_record = self.db.get_key_record(&req.org_id, &req.key_id).await?
        .ok_or_else(|| Status::not_found("Key not found"))?;

    if key_record.status != KeyStatus::Pending as i32 {
        return Err(Status::failed_precondition("Key not in PENDING status"));
    }

    if key_record.custody_model != KeyCustodyModel::SelfSovereign as i32 {
        return Err(Status::failed_precondition("Not a self-custody key"));
    }

    // 2. Verify activation signature
    let stored_challenge = self.activation_store
        .get_and_remove(&req.key_id)
        .await?
        .ok_or_else(|| Status::invalid_argument("Invalid or expired activation challenge"))?;

    if stored_challenge != req.activation_challenge {
        return Err(Status::invalid_argument("Challenge mismatch"));
    }

    let public_keys = key_record.public_keys
        .ok_or_else(|| Status::internal("Key record missing public keys"))?;

    let public_key = ed25519_dalek::VerifyingKey::from_bytes(
        &public_keys.ed25519_public_key.try_into()
            .map_err(|_| Status::internal("Invalid stored public key"))?
    ).map_err(|_| Status::internal("Invalid stored public key"))?;

    let signature = ed25519_dalek::Signature::from_bytes(
        &req.ed25519_signature.try_into()
            .map_err(|_| Status::invalid_argument("Invalid signature"))?
    );

    public_key.verify_strict(&req.activation_challenge, &signature)
        .map_err(|_| Status::invalid_argument("Activation signature verification failed"))?;

    // 3. Activate key
    self.db.update_key_status(
        &req.org_id,
        &req.key_id,
        KeyStatus::Active,
        Some(&req.agent_hash),
    ).await?;

    // 4. Audit log
    self.audit_log(AuditActionType::KeyActivated, &req.org_id, &req.key_id).await?;

    Ok(Response::new(AdminResponse {
        success: true,
        message: "Key activated".to_string(),
        ..Default::default()
    }))
}
```

### 6.3 CIRISPortal gRPC Client

Add to `lib/grpc/client.ts`:

```typescript
export async function getRegistrationChallenge(params: {
  orgId: string;
}): Promise<{ challenge: Uint8Array; expiresAt: number }> {
  return promisifyUnaryAuth(getPortalClient(), 'getRegistrationChallenge', {
    context: buildContext(),
    orgId: params.orgId,
  });
}

export async function registerPublicKey(params: {
  orgId: string;
  ed25519PublicKey: Uint8Array;
  mlDsa65PublicKey?: Uint8Array;
  registrationChallenge: Uint8Array;
  ed25519Signature: Uint8Array;
  mlDsa65Signature?: Uint8Array;
  requesterUserId: string;
  keyLabel?: string;
}): Promise<{
  keyRecord: PartnerKeyRecord;
  activationChallenge: Uint8Array;
}> {
  return promisifyUnaryAuth(getPortalClient(), 'registerPublicKey', {
    context: buildContext(),
    ...params,
  });
}

export async function activateSelfCustodyKey(params: {
  orgId: string;
  keyId: string;
  activationChallenge: Uint8Array;
  ed25519Signature: Uint8Array;
  mlDsa65Signature?: Uint8Array;
  agentHash: string;
}): Promise<{ success: boolean; message: string }> {
  return promisifyUnaryAuth(getPortalClient(), 'activateSelfCustodyKey', {
    context: buildContext(),
    ...params,
  });
}

export async function rotateSelfCustodyKey(params: {
  orgId: string;
  newKeyId: string;
  rotationChallenge: Uint8Array;
  oldKeySignature: Uint8Array;
  newKeySignature: Uint8Array;
  mode?: KeyRotationMode;
  gracePeriodHours?: number;
  reason?: string;
}): Promise<RotateKeyResponse> {
  return promisifyUnaryAuth(getPortalClient(), 'rotateSelfCustodyKey', {
    context: buildContext(),
    ...params,
  });
}
```

### 6.4 CIRISPortal Device Auth Flow

Add to `app/api/device/register-key/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getByDeviceCode, updateRecord } from '@/lib/device-auth/store';
import {
  getRegistrationChallenge,
  registerPublicKey,
  activateSelfCustodyKey,
} from '@/lib/grpc/client';

/**
 * POST /api/device/register-key
 *
 * Self-custody flow: Agent registers its own public key
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      device_code,
      ed25519_public_key, // hex
      ed25519_signature, // hex (over challenge)
      agent_hash,
    } = body;

    // 1. Validate device session
    const record = await getByDeviceCode(device_code);
    if (!record || record.status !== 'authorized') {
      return NextResponse.json(
        { error: 'Invalid or unauthorized device' },
        { status: 403 }
      );
    }

    if (!record.orgId) {
      return NextResponse.json(
        { error: 'Device not linked to organization' },
        { status: 400 }
      );
    }

    // 2. Get registration challenge
    const { challenge } = await getRegistrationChallenge({
      orgId: record.orgId,
    });

    // 3. Register public key
    const pubKeyBytes = Buffer.from(ed25519_public_key, 'hex');
    const sigBytes = Buffer.from(ed25519_signature, 'hex');

    const { keyRecord, activationChallenge } = await registerPublicKey({
      orgId: record.orgId,
      ed25519PublicKey: new Uint8Array(pubKeyBytes),
      registrationChallenge: new Uint8Array(challenge),
      ed25519Signature: new Uint8Array(sigBytes),
      requesterUserId: record.userId || 'device-auth',
      keyLabel: `Agent ${record.userCode}`,
    });

    // 4. Return activation challenge for agent to sign
    return NextResponse.json({
      key_id: keyRecord.keyId,
      activation_challenge: Buffer.from(activationChallenge).toString('hex'),
      public_key_fingerprint: keyRecord.publicKeys?.ed25519Fingerprint,
    });
  } catch (error) {
    console.error('[Device Register Key] Error:', error);
    return NextResponse.json(
      { error: 'Key registration failed' },
      { status: 500 }
    );
  }
}
```

Add `app/api/device/activate-key/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getByDeviceCode, updateRecord } from '@/lib/device-auth/store';
import { activateSelfCustodyKey } from '@/lib/grpc/client';

/**
 * POST /api/device/activate-key
 *
 * Self-custody flow: Agent proves possession by signing activation challenge
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      device_code,
      key_id,
      activation_challenge, // hex
      ed25519_signature, // hex
      agent_hash,
    } = body;

    // 1. Validate device session
    const record = await getByDeviceCode(device_code);
    if (!record || record.status !== 'authorized') {
      return NextResponse.json(
        { error: 'Invalid or unauthorized device' },
        { status: 403 }
      );
    }

    // 2. Activate key
    const result = await activateSelfCustodyKey({
      orgId: record.orgId!,
      keyId: key_id,
      activationChallenge: new Uint8Array(
        Buffer.from(activation_challenge, 'hex')
      ),
      ed25519Signature: new Uint8Array(Buffer.from(ed25519_signature, 'hex')),
      agentHash: agent_hash,
    });

    // 3. Update device record
    await updateRecord(record.deviceCode, {
      status: 'provisioned',
      keyActivated: true,
      provisionedKey: {
        keyId: key_id,
        orgId: record.orgId!,
        ed25519PublicKey: '', // Agent holds private key
        ed25519PrivateKey: '', // NOT STORED
      },
    });

    return NextResponse.json({
      activated: true,
      key_id,
      message: 'Self-custody key activated. You control the private key.',
    });
  } catch (error) {
    console.error('[Device Activate Key] Error:', error);
    return NextResponse.json(
      { error: 'Key activation failed' },
      { status: 500 }
    );
  }
}
```

### 6.5 Database Schema

Add to CIRISRegistry migrations:

```sql
-- Add public_key_hash index for duplicate detection
CREATE INDEX idx_partner_keys_public_key_hash
ON partner_keys(public_key_hash);

-- Add unique constraint
ALTER TABLE partner_keys
ADD CONSTRAINT unique_public_key_hash UNIQUE (public_key_hash);

-- Challenge store table
CREATE TABLE registration_challenges (
  org_id TEXT NOT NULL,
  challenge BYTEA NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (org_id)
);

CREATE TABLE activation_challenges (
  key_id TEXT NOT NULL,
  challenge BYTEA NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (key_id)
);

-- Cleanup job
CREATE INDEX idx_challenges_expires ON registration_challenges(expires_at);
CREATE INDEX idx_activation_expires ON activation_challenges(expires_at);
```

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

## 9. Build Checklist

### Registry (CIRISRegistry) ✅ COMPLETE

- [x] Add proto messages to `protocol/ciris_registry.proto`
- [x] Add RPCs to `service PortalService`
- [x] Create `registration_challenges` table migration
- [x] Create `activation_challenges` table migration
- [x] Add `public_key_hash` unique constraint migration
- [x] Implement `get_registration_challenge` in `portal.rs`
- [x] Implement `register_public_key` in `portal.rs`
- [x] Implement `activate_self_custody_key` in `portal.rs`
- [x] Implement `rotate_self_custody_key` in `portal.rs`
- [x] Add audit logging for self-custody operations
- [ ] Unit tests for signature verification
- [ ] Integration tests for full flow

### Portal (CIRISPortal)

- [ ] Sync proto file from Registry
- [ ] Add `getRegistrationChallenge` to gRPC client
- [ ] Add `registerPublicKey` to gRPC client
- [ ] Add `activateSelfCustodyKey` to gRPC client
- [ ] Add `rotateSelfCustodyKey` to gRPC client
- [ ] Create `/api/device/register-key` endpoint
- [ ] Create `/api/device/activate-key` endpoint
- [ ] Update device auth flow to support self-custody path
- [ ] Update keys page to show custody model badge
- [ ] Add self-custody disclaimer acceptance UI

### Agent SDK

- [ ] Ed25519 keypair generation utility
- [ ] Secure storage abstraction (platform-specific)
- [ ] Self-custody registration flow
- [ ] Signing utility with memory clearing

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

### C. Signature Verification Reference

```rust
use ed25519_dalek::{Signature, VerifyingKey};

fn verify_registration(
    public_key: &[u8; 32],
    challenge: &[u8],
    signature: &[u8; 64],
) -> Result<(), &'static str> {
    let verifying_key = VerifyingKey::from_bytes(public_key)
        .map_err(|_| "Invalid public key")?;

    let sig = Signature::from_bytes(signature);

    verifying_key.verify_strict(challenge, &sig)
        .map_err(|_| "Signature verification failed")
}
```

```typescript
// Portal-side verification (for testing)
import { verify } from '@noble/ed25519';

async function verifySignature(
  publicKey: Uint8Array,
  challenge: Uint8Array,
  signature: Uint8Array
): Promise<boolean> {
  return verify(signature, challenge, publicKey);
}
```
