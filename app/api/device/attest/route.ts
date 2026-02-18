import { NextResponse } from 'next/server';
import { getByDeviceCode, updateRecord } from '@/lib/device-auth/store';
import {
  verifyAttestation,
  type AttestationProof,
} from '@/lib/device-auth/attestation';

/**
 * POST /api/device/attest
 *
 * Called by the agent (unauthenticated — device_code is the secret) after
 * receiving the challenge_nonce from /api/device/authorize.
 *
 * The agent calls CIRISVerify's export_attestation(challenge_nonce) and
 * check_agent_integrity(), then submits the results here.
 *
 * Portal verifies:
 * 1. Challenge nonce matches what was issued
 * 2. Ed25519 classical signature is valid
 * 3. Agent hash is known in CIRISRegistry (if available)
 * 4. Build attestation exists (SLSA provenance)
 * 5. Agent file integrity passed
 *
 * On success, marks the device record as attestation_verified.
 * The /api/device/complete endpoint requires this flag for CIRIS agents.
 *
 * Non-CIRIS agents skip this step entirely.
 *
 * Body: {
 *   device_code: string,
 *   attestation_proof: AttestationProof,
 *   agent_hash?: string,          // SHA-256 hex of agent binary
 *   integrity_passed: boolean     // Result of check_agent_integrity()
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { device_code, attestation_proof, agent_hash, integrity_passed } =
      body as {
        device_code: string;
        attestation_proof: AttestationProof;
        agent_hash?: string;
        integrity_passed: boolean;
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
      !attestation_proof.classical_signature
    ) {
      return NextResponse.json(
        {
          error:
            'attestation_proof must include challenge and classical_signature',
        },
        { status: 400 }
      );
    }

    // Look up device record by device code (agent's secret)
    const record = getByDeviceCode(device_code);
    if (!record) {
      return NextResponse.json(
        { error: 'Invalid or expired device code' },
        { status: 404 }
      );
    }

    if (record.attestationVerified) {
      return NextResponse.json({
        verified: true,
        message: 'Attestation already verified',
      });
    }

    if (!record.challengeNonce) {
      return NextResponse.json(
        { error: 'No challenge nonce found on device record' },
        { status: 500 }
      );
    }

    // Verify the attestation proof
    const result = await verifyAttestation(
      attestation_proof,
      record.challengeNonce,
      agent_hash,
      integrity_passed ?? false
    );

    console.log(
      `[Device Attest] Verification result for ${record.userCode}: ` +
        `verified=${result.verified}, hw=${result.hardware_type}, ` +
        `sig_valid=${result.classical_sig_valid}, agent_known=${result.agent_known}, ` +
        `errors=${result.errors.length}, warnings=${result.warnings.length}`
    );

    if (result.verified) {
      // Store attestation data on the device record
      updateRecord(record.deviceCode, {
        attestationProof: attestation_proof as unknown as Record<
          string,
          unknown
        >,
        attestationVerified: true,
        hardwareType: result.hardware_type,
      });

      // Update agent info with the verified hash
      if (agent_hash) {
        updateRecord(record.deviceCode, {
          agentInfo: {
            ...record.agentInfo,
            agentHash: agent_hash,
          },
        });
      }

      return NextResponse.json({
        verified: true,
        hardware_type: result.hardware_type,
        agent_known: result.agent_known,
        build_attested: result.build_attested,
        warnings: result.warnings,
      });
    }

    // Attestation failed
    return NextResponse.json(
      {
        verified: false,
        errors: result.errors,
        warnings: result.warnings,
        hardware_type: result.hardware_type,
      },
      { status: 403 }
    );
  } catch (error) {
    console.error('[Device Attest] Error:', error);
    return NextResponse.json(
      { error: 'Attestation verification failed' },
      { status: 500 }
    );
  }
}
