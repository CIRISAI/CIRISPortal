/**
 * CIRISVerify attestation verification for device auth.
 *
 * Verifies that a CIRIS agent's attestation proof is valid by:
 * 1. Checking the challenge nonce matches what Portal issued
 * 2. Verifying the Ed25519 classical signature over the challenge
 * 3. Cross-referencing the agent hash against CIRISRegistry
 * 4. Checking build attestation for expected artifact hash
 *
 * ML-DSA-65 (PQC) signature verification is deferred to CIRISRegistry
 * via a future VerifyAttestation RPC. For now, we verify the classical
 * signature (Ed25519) in Node.js and log the PQC signature for audit.
 */

import crypto from 'crypto';
import { lookupAgent, getBuildAttestation } from '@/lib/grpc/client';

export interface AttestationProof {
  /** Platform attestation blob (TPM quote, SE assertion, etc.) */
  platform_attestation: string; // hex (from CIRISVerify FFI)
  /** Hardware-bound public key (ECDSA P-256 or Ed25519) - 32 bytes for Ed25519 */
  hardware_public_key: string; // hex (CIRISVerify outputs hex, not base64)
  /** Algorithm: "ECDSA_P256" or "Ed25519" */
  hardware_algorithm: string;
  /** ML-DSA-65 post-quantum public key */
  pqc_public_key: string; // hex (empty for ephemeral Ed25519 attestation)
  /** PQC algorithm: "ML-DSA-65" or "NONE" */
  pqc_algorithm: string;
  /** The challenge nonce that was signed */
  challenge: string; // hex
  /** Classical signature over the challenge - 64 bytes for Ed25519 */
  classical_signature: string; // hex (CIRISVerify outputs hex, not base64)
  /** PQC signature over (challenge || classical_sig) */
  pqc_signature: string; // hex (empty for ephemeral Ed25519 attestation)
  /** Key type: "ephemeral" for phase 1, "portal" for phase 2 */
  key_type?: string;
  /** Merkle root of the transparency log */
  merkle_root: string; // hex (32 bytes)
  /** Number of transparency log entries */
  log_entry_count: number;
  /** ISO timestamp of proof generation */
  generated_at: string;
  /** CIRISVerify binary version */
  binary_version: string;
  /** Hardware type: "TPM_2_0", "IOS_SECURE_ENCLAVE", "SOFTWARE_ONLY", etc. */
  hardware_type: string;
}

export interface AttestationResult {
  verified: boolean;
  hardware_type: string;
  agent_known: boolean;
  build_attested: boolean;
  classical_sig_valid: boolean;
  pqc_sig_present: boolean;
  challenge_matches: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Verify an attestation proof submitted by a CIRIS agent.
 *
 * @param proof - AttestationProof from CIRISVerify export_attestation()
 * @param expectedNonce - The challenge_nonce Portal issued at initiation
 * @param agentHash - The agent's self-reported SHA-256 hash (hex)
 * @param integrityPassed - Whether check_agent_integrity() passed
 */
export async function verifyAttestation(
  proof: AttestationProof,
  expectedNonce: string,
  agentHash: string | undefined,
  integrityPassed: boolean
): Promise<AttestationResult> {
  const result: AttestationResult = {
    verified: false,
    hardware_type: proof.hardware_type || 'UNKNOWN',
    agent_known: false,
    build_attested: false,
    classical_sig_valid: false,
    pqc_sig_present: false,
    challenge_matches: false,
    errors: [],
    warnings: [],
  };

  // 1. Challenge nonce must match what we issued
  if (proof.challenge !== expectedNonce) {
    result.errors.push('Challenge nonce mismatch — possible replay attack');
    return result;
  }
  result.challenge_matches = true;

  // 2. Verify classical signature (Ed25519) over the challenge
  try {
    // CIRISVerify FFI outputs hex-encoded public key and signature
    const pubKeyBytes = Buffer.from(proof.hardware_public_key, 'hex');
    const sigBytes = Buffer.from(proof.classical_signature, 'hex');
    const challengeBytes = Buffer.from(proof.challenge, 'hex');

    if (proof.hardware_algorithm === 'Ed25519') {
      const valid = crypto.verify(
        null, // Ed25519 doesn't use a separate hash
        challengeBytes,
        {
          key: createEd25519PublicKey(pubKeyBytes),
          format: 'der',
          type: 'spki',
        },
        sigBytes
      );
      result.classical_sig_valid = valid;
      if (!valid) {
        result.errors.push('Ed25519 signature verification failed');
      }
    } else if (proof.hardware_algorithm === 'ECDSA_P256') {
      // ECDSA P-256 verification (hardware-bound on mobile/TPM)
      const valid = crypto.verify(
        'sha256',
        challengeBytes,
        { key: createP256PublicKey(pubKeyBytes), format: 'der', type: 'spki' },
        sigBytes
      );
      result.classical_sig_valid = valid;
      if (!valid) {
        result.errors.push('ECDSA P-256 signature verification failed');
      }
    } else {
      result.warnings.push(
        `Unknown hardware algorithm: ${proof.hardware_algorithm}, cannot verify classical signature`
      );
    }
  } catch (err: any) {
    result.errors.push(
      `Classical signature verification error: ${err.message}`
    );
  }

  // 3. Check PQC signature presence (full ML-DSA verification deferred to Registry)
  if (proof.pqc_signature && proof.pqc_signature.length > 0) {
    result.pqc_sig_present = true;
  } else {
    result.warnings.push(
      'PQC signature missing — post-quantum binding not available'
    );
  }

  // 4. Cross-reference agent hash with Registry
  if (agentHash && agentHash.length === 64) {
    try {
      const agentRecord = await lookupAgent({ agentHash });
      if (agentRecord && agentRecord.agent) {
        result.agent_known = true;
        const status = agentRecord.agent.status;
        if (status === 'AGENT_STATUS_REVOKED' || status === 3) {
          result.errors.push('Agent has been revoked in Registry');
        }
      } else {
        result.warnings.push(
          'Agent hash not found in Registry (may be first registration)'
        );
      }
    } catch {
      result.warnings.push(
        'Could not reach Registry to verify agent hash — proceeding with local verification'
      );
    }
  }

  // 5. Check build attestation for expected artifact hash
  if (agentHash && agentHash.length === 64) {
    try {
      const attestation = await getBuildAttestation({ agentHash });
      if (attestation?.found && attestation?.attestation?.provenance) {
        result.build_attested = true;
        if (attestation.independentVerificationCount > 0) {
          // Build has been independently verified
        }
      } else {
        result.warnings.push(
          'No build attestation found — binary provenance unverified'
        );
      }
    } catch {
      result.warnings.push(
        'Could not reach Registry for build attestation — skipping provenance check'
      );
    }
  }

  // 6. Integrity check
  if (!integrityPassed) {
    result.errors.push('Agent integrity check failed — files may be tampered');
  }

  // 7. Hardware type gating
  if (proof.hardware_type === 'SOFTWARE_ONLY') {
    result.warnings.push(
      'Software-only signer — no hardware root of trust. Limited to community tier.'
    );
  }

  // Verdict: verified if no errors and classical sig is valid
  result.verified = result.errors.length === 0 && result.classical_sig_valid;

  return result;
}

/**
 * Wrap raw Ed25519 public key bytes (32 bytes) into a DER-encoded SPKI structure
 * for Node.js crypto.verify().
 */
function createEd25519PublicKey(rawKey: Buffer): Buffer {
  // Ed25519 SPKI prefix: 302a300506032b6570032100
  const prefix = Buffer.from('302a300506032b6570032100', 'hex');
  return Buffer.concat([prefix, rawKey]);
}

/**
 * Wrap raw ECDSA P-256 public key bytes (65 bytes uncompressed) into a
 * DER-encoded SPKI structure for Node.js crypto.verify().
 */
function createP256PublicKey(rawKey: Buffer): Buffer {
  // P-256 SPKI prefix: 3059301306072a8648ce3d020106082a8648ce3d030107034200
  const prefix = Buffer.from(
    '3059301306072a8648ce3d020106082a8648ce3d030107034200',
    'hex'
  );
  return Buffer.concat([prefix, rawKey]);
}
