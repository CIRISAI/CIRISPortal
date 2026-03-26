import { NextResponse } from 'next/server';
import { getByDeviceCode, updateRecord } from '@/lib/device-auth/store';
import { activateSelfCustodyKey } from '@/lib/grpc/client';

/**
 * POST /api/device/activate-key
 *
 * Self-custody flow: Agent proves possession by signing activation challenge.
 * This completes the key registration and makes the key ACTIVE.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      device_code,
      key_id,
      activation_challenge, // hex-encoded
      ed25519_signature, // hex-encoded
      agent_hash,
    } = body;

    if (
      !device_code ||
      !key_id ||
      !activation_challenge ||
      !ed25519_signature
    ) {
      return NextResponse.json(
        {
          error:
            'device_code, key_id, activation_challenge, and ed25519_signature are required',
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

    // 2. Convert hex to Uint8Array
    const challengeBytes = new Uint8Array(
      Buffer.from(activation_challenge, 'hex')
    );
    const sigBytes = new Uint8Array(Buffer.from(ed25519_signature, 'hex'));

    if (sigBytes.length !== 64) {
      return NextResponse.json(
        { error: 'Invalid signature length. Expected 64 bytes.' },
        { status: 400 }
      );
    }

    // 3. Activate self-custody key in Registry
    const result = await activateSelfCustodyKey({
      orgId: record.orgId,
      keyId: key_id,
      activationChallenge: challengeBytes,
      ed25519Signature: sigBytes,
      agentHash: agent_hash || record.agentInfo?.agentHash || '',
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.message || 'Activation failed' },
        { status: 400 }
      );
    }

    // 4. Update device record - mark as provisioned with self-custody key
    await updateRecord(record.deviceCode, {
      status: 'provisioned',
      keyActivated: true,
      provisionedKey: {
        keyId: key_id,
        orgId: record.orgId,
        ed25519PublicKey: '', // Agent holds public key
        ed25519PrivateKey: '', // NOT STORED - self-custody
      },
    });

    console.log(
      `[Device Activate Key] Self-custody key activated for ${record.userCode} ` +
        `(org=${record.orgId}, key_id=${key_id})`
    );

    return NextResponse.json({
      activated: true,
      key_id,
      custody_model: 'SELF_SOVEREIGN',
      message:
        'Self-custody key activated. You control the private key. ' +
        'CIRIS cannot sign on your behalf.',
      disclaimer: {
        key_custody:
          'You are solely responsible for the security of your private key.',
        no_recovery: 'CIRIS cannot recover your private key if lost.',
        no_signing: 'CIRIS cannot sign transactions on your behalf.',
        liability: 'You accept all liability for key compromise or loss.',
      },
    });
  } catch (error: any) {
    console.error('[Device Activate Key] Error:', error);

    if (error.message?.includes('verification failed')) {
      return NextResponse.json(
        {
          error:
            'Activation signature verification failed. ' +
            'Ensure you signed the correct activation_challenge.',
        },
        { status: 403 }
      );
    }

    if (error.message?.includes('not in PENDING')) {
      return NextResponse.json(
        { error: 'Key is not in PENDING status. It may already be activated.' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Key activation failed' },
      { status: 500 }
    );
  }
}
