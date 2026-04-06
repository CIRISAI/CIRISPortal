import { NextResponse } from 'next/server';
import { getByDeviceCode, updateRecord } from '@/lib/device-auth/store';
import { registerPublicKey } from '@/lib/grpc/client';

/**
 * POST /api/device/register-key
 *
 * Self-custody flow: Agent registers its own public key.
 * Agent generates keypair locally, sends public key + signature.
 * Portal stores ONLY the public key - no private key custody.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      device_code,
      ed25519_public_key, // hex-encoded 32 bytes
      ed25519_signature, // hex-encoded 64 bytes (over challenge)
      key_label,
    } = body;

    if (!device_code || !ed25519_public_key || !ed25519_signature) {
      return NextResponse.json(
        {
          error:
            'device_code, ed25519_public_key, and ed25519_signature are required',
        },
        { status: 400 }
      );
    }

    // 1. Validate device session
    const record = await getByDeviceCode(device_code);
    if (!record) {
      return NextResponse.json(
        { error: 'Invalid or expired device code' },
        { status: 404 }
      );
    }

    if (record.status !== 'authorized') {
      return NextResponse.json(
        { error: `Device not authorized. Status: ${record.status}` },
        { status: 403 }
      );
    }

    if (!record.orgId) {
      return NextResponse.json(
        { error: 'Device not linked to organization' },
        { status: 400 }
      );
    }

    // 2. Use the stored registration challenge from /api/device/token
    if (!record.registrationChallenge) {
      return NextResponse.json(
        {
          error:
            'No registration challenge found. Poll /api/device/token first to get the challenge.',
        },
        { status: 400 }
      );
    }

    const challenge = Buffer.from(record.registrationChallenge, 'hex');

    // 3. Convert hex to Uint8Array
    const pubKeyBytes = new Uint8Array(Buffer.from(ed25519_public_key, 'hex'));
    const sigBytes = new Uint8Array(Buffer.from(ed25519_signature, 'hex'));

    if (pubKeyBytes.length !== 32) {
      return NextResponse.json(
        { error: 'Invalid public key length. Expected 32 bytes.' },
        { status: 400 }
      );
    }

    if (sigBytes.length !== 64) {
      return NextResponse.json(
        { error: 'Invalid signature length. Expected 64 bytes.' },
        { status: 400 }
      );
    }

    // 4. Register public key with Registry
    const { keyRecord, activationChallenge } = await registerPublicKey({
      orgId: record.orgId,
      ed25519PublicKey: pubKeyBytes,
      registrationChallenge: new Uint8Array(challenge),
      ed25519Signature: sigBytes,
      requesterUserId: record.userId || 'device-auth',
      keyLabel: key_label || `Agent ${record.userCode}`,
    });

    // 5. Store self-custody key info in device record (public key only!)
    const fingerprint =
      keyRecord.publicKeys?.ed25519Fingerprint ||
      keyRecord.publicKeys?.ed25519_fingerprint ||
      '';

    await updateRecord(record.deviceCode, {
      selfCustodyKey: {
        keyId: keyRecord.keyId,
        ed25519PublicKeyFingerprint: fingerprint,
        ed25519PublicKey: ed25519_public_key, // hex, for reference
        registeredAt: Date.now(),
        activated: false, // Will be set true after activate-key
      },
    });

    console.log(
      `[Device Register Key] Public key registered for ${record.userCode} ` +
        `(org=${record.orgId}, key_id=${keyRecord.keyId}, fingerprint=${fingerprint})`
    );

    // 6. Return activation challenge for agent to sign
    return NextResponse.json({
      key_id: keyRecord.keyId,
      activation_challenge: Buffer.from(activationChallenge).toString('hex'),
      public_key_fingerprint: fingerprint,
      custody_model: 'SELF_SOVEREIGN',
      message:
        'Public key registered. Sign the activation_challenge with your private key ' +
        'and call /api/device/activate-key to complete activation.',
    });
  } catch (error: any) {
    console.error('[Device Register Key] Error:', error);

    // Handle specific gRPC errors
    if (error.message?.includes('already registered')) {
      return NextResponse.json(
        { error: 'This public key is already registered' },
        { status: 409 }
      );
    }

    if (error.message?.includes('verification failed')) {
      return NextResponse.json(
        {
          error:
            'Signature verification failed. Ensure you signed the correct challenge.',
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Key registration failed' },
      { status: 500 }
    );
  }
}
