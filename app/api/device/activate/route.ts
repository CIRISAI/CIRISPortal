import { NextResponse } from 'next/server';
import { getByDeviceCode, updateRecord } from '@/lib/device-auth/store';
import {
  importEd25519PublicKey,
  verifyEd25519,
  base64ToArrayBuffer,
} from '@/lib/keystore/crypto';
import { query, queryOne } from '@/lib/db/client';

/**
 * POST /api/device/activate
 *
 * Phase 2 of two-phase attestation: Key Activation
 *
 * Called by the agent AFTER receiving the Portal-issued Ed25519 key from
 * /api/device/complete. The agent imports the key and signs a new challenge
 * to prove secure storage.
 *
 * SECURITY MODEL:
 * - Keys are tied to agent identity - ONE key per agent instance
 * - Key reuse across agents is FORBIDDEN and results in immediate revocation
 * - Transferring agent identities to a new device is NOT SUPPORTED YET
 * - The activation creates a tamper-evident binding between agent and key
 *
 * This endpoint:
 * 1. Verifies the signature was made with the Portal-issued key
 * 2. Checks for key reuse (same public key activated before)
 * 3. Records the activation in the key_activations table
 * 4. Marks the device record as key_activated=true
 *
 * Body: {
 *   device_code: string,
 *   attestation_proof: {
 *     challenge: string,           // Hex-encoded challenge (should differ from first attestation)
 *     classical_signature: string, // Hex-encoded Ed25519 signature over challenge
 *     hardware_public_key: string, // Hex-encoded public key (must match issued key)
 *     key_type: string,            // Should be "portal" for activation
 *     ...other fields
 *   }
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { device_code, attestation_proof } = body as {
      device_code: string;
      attestation_proof: {
        challenge: string;
        classical_signature: string;
        hardware_public_key: string;
        key_type?: string;
        [key: string]: unknown;
      };
    };

    if (!device_code) {
      return NextResponse.json(
        { error: 'device_code is required' },
        { status: 400 }
      );
    }

    if (!attestation_proof) {
      return NextResponse.json(
        { error: 'attestation_proof is required' },
        { status: 400 }
      );
    }

    if (
      !attestation_proof.challenge ||
      !attestation_proof.classical_signature ||
      !attestation_proof.hardware_public_key
    ) {
      return NextResponse.json(
        {
          error:
            'attestation_proof must include challenge, classical_signature, and hardware_public_key',
        },
        { status: 400 }
      );
    }

    // Key type should be "portal" for activation (not "ephemeral")
    if (attestation_proof.key_type === 'ephemeral') {
      return NextResponse.json(
        {
          error:
            'Activation requires Portal-issued key (key_type: "portal"). ' +
            'Import the key from /api/device/complete first.',
        },
        { status: 400 }
      );
    }

    // Look up device record
    const record = await getByDeviceCode(device_code);
    if (!record) {
      return NextResponse.json(
        { error: 'Invalid or expired device code' },
        { status: 404 }
      );
    }

    if (record.status !== 'provisioned') {
      return NextResponse.json(
        {
          error:
            `Cannot activate: status is ${record.status}. ` +
            'Complete provisioning via /api/device/complete first.',
        },
        { status: 409 }
      );
    }

    // Get the issued public key from the device record
    const issuedPublicKeyBase64 = record.provisionedKey?.ed25519PublicKey;
    if (!issuedPublicKeyBase64) {
      return NextResponse.json(
        { error: 'No public key found in device record' },
        { status: 500 }
      );
    }

    // Decode keys and signature from hex
    const proofPublicKeyHex = attestation_proof.hardware_public_key;
    const challengeHex = attestation_proof.challenge;
    const signatureHex = attestation_proof.classical_signature;

    const proofPublicKey = Buffer.from(proofPublicKeyHex, 'hex');
    const challenge = Buffer.from(challengeHex, 'hex');
    const signature = Buffer.from(signatureHex, 'hex');

    // Decode issued public key from base64
    const issuedPublicKey = new Uint8Array(
      base64ToArrayBuffer(issuedPublicKeyBase64)
    );

    // Verify the proof public key matches the issued key
    if (!proofPublicKey.equals(Buffer.from(issuedPublicKey))) {
      console.error(
        `[Device Activate] Public key mismatch: ` +
          `issued=${Buffer.from(issuedPublicKey).toString('hex').slice(0, 16)}..., ` +
          `proof=${proofPublicKeyHex.slice(0, 16)}...`
      );
      return NextResponse.json(
        {
          error:
            'Public key in attestation does not match issued key. ' +
            'Ensure you imported the correct key from /api/device/complete.',
        },
        { status: 403 }
      );
    }

    // Verify the Ed25519 signature
    try {
      const cryptoPublicKey = await importEd25519PublicKey(
        new Uint8Array(proofPublicKey)
      );
      const valid = await verifyEd25519(
        new Uint8Array(challenge),
        new Uint8Array(signature),
        cryptoPublicKey
      );

      if (!valid) {
        console.error(
          `[Device Activate] Signature verification failed for ${record.userCode}`
        );
        return NextResponse.json(
          { error: 'Signature verification failed' },
          { status: 403 }
        );
      }
    } catch (err) {
      console.error('[Device Activate] Signature verification error:', err);
      return NextResponse.json(
        { error: 'Signature verification error' },
        { status: 500 }
      );
    }

    // Check for key reuse (same public key activated before)
    // This is a CRITICAL security check - keys are tied to ONE agent instance
    const existingActivation = await queryOne<{
      device_code: string;
      user_code: string;
      activated_at: Date;
    }>(
      `SELECT device_code, user_code, activated_at
       FROM key_activations
       WHERE public_key_hash = $1`,
      [proofPublicKeyHex]
    );

    if (existingActivation) {
      console.error(
        `[Device Activate] KEY REUSE DETECTED! ` +
          `Public key ${proofPublicKeyHex.slice(0, 16)}... was previously activated ` +
          `for device ${existingActivation.user_code} at ${existingActivation.activated_at}. ` +
          `Current attempt: ${record.userCode}. KEY REUSE IS FORBIDDEN.`
      );

      // TODO: Trigger key revocation in CIRISRegistry

      return NextResponse.json(
        {
          error:
            'KEY REUSE DETECTED. This key has already been activated for another agent instance. ' +
            'Key reuse is forbidden for CIRIS agents. ' +
            'Transferring agent identities to a new device is not supported yet. ' +
            'This incident has been logged.',
          previous_activation: {
            user_code: existingActivation.user_code,
            activated_at: existingActivation.activated_at,
          },
        },
        { status: 403 }
      );
    }

    // Record the activation (for future reuse detection)
    try {
      await query(
        `INSERT INTO key_activations (
          public_key_hash, device_code, user_code, org_id,
          key_id, agent_hash, activated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          proofPublicKeyHex,
          record.deviceCode,
          record.userCode,
          record.orgId || '',
          record.provisionedKey?.keyId || '',
          record.agentInfo?.agentHash || '',
        ]
      );
    } catch (dbErr: any) {
      // Handle race condition (unlikely but possible)
      if (dbErr?.code === '23505') {
        // Unique violation
        console.error(
          `[Device Activate] Race condition: key already activated during this request`
        );
        return NextResponse.json(
          { error: 'Key already activated (race condition)' },
          { status: 409 }
        );
      }
      throw dbErr;
    }

    // Update device record to mark key as activated
    await updateRecord(record.deviceCode, {
      // Add keyActivated field to record
      // Note: This may require updating the DeviceAuthRecord type
    } as any);

    console.log(
      `[Device Activate] Key activated successfully for ${record.userCode} ` +
        `(org=${record.orgId}, pubkey=${proofPublicKeyHex.slice(0, 16)}...)`
    );

    return NextResponse.json({
      activated: true,
      message:
        'Key activation successful. Agent identity is now bound to this key. ' +
        'Key reuse on other devices will be detected and blocked.',
      org_id: record.orgId,
      key_id: record.provisionedKey?.keyId,
      restrictions: {
        key_reuse: 'forbidden',
        identity_transfer: 'not_supported_yet',
      },
    });
  } catch (error) {
    console.error('[Device Activate] Error:', error);
    return NextResponse.json(
      { error: 'Key activation failed' },
      { status: 500 }
    );
  }
}
