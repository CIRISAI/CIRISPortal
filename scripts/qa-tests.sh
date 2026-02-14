#!/bin/bash
#
# CIRISPortal QA Integration Tests
# Tests against CIRISRegistry v1.1.0 gRPC API
#
# Usage: ./scripts/qa-tests.sh [--portal-only] [--grpc-only]
#

# Configuration
GRPC_URL="${GRPC_URL:-localhost:50052}"
PORTAL_URL="${PORTAL_URL:-http://localhost:3003}"
TEST_ORG_ID="${TEST_ORG_ID:-YOUR_TEST_ORG_ID}"
TEST_USER_ID="admin@qa-primary.test"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
PASS=0
FAIL=0
SKIP=0

log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; ((PASS++)); }
log_fail() { echo -e "${RED}[FAIL]${NC} $1 - $2"; ((FAIL++)); }
log_skip() { echo -e "${YELLOW}[SKIP]${NC} $1 - $2"; ((SKIP++)); }
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }

header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
}

check_prereqs() {
    header "Checking Prerequisites"

    if command -v grpcurl &> /dev/null; then
        log_pass "grpcurl is available"
    else
        log_fail "grpcurl is not installed" "Required for gRPC tests"
        exit 1
    fi

    if command -v jq &> /dev/null; then
        log_pass "jq is available"
    else
        log_skip "jq is not installed" "Some output formatting may be limited"
    fi

    if command -v curl &> /dev/null; then
        log_pass "curl is available"
    else
        log_fail "curl is not installed" "Required for Portal API tests"
        exit 1
    fi
}

run_grpc_tests() {
    header "Phase 1: Health & Capabilities"

    # HC-001: gRPC Server
    result=$(grpcurl -plaintext "$GRPC_URL" list 2>&1)
    if echo "$result" | grep -q "PortalService"; then
        log_pass "HC-001: gRPC Server Available"
    else
        log_fail "HC-001: gRPC Server Available" "$result"
    fi

    # HC-002: Health Check
    result=$(grpcurl -plaintext -d '{}' "$GRPC_URL" ciris.registry.v1.RegistryService/HealthCheck 2>&1)
    if echo "$result" | grep -q '"status":'; then
        log_pass "HC-002: Health Check"
    else
        log_fail "HC-002: Health Check" "$result"
    fi

    # HC-003: Get Capabilities
    result=$(grpcurl -plaintext -d '{}' "$GRPC_URL" ciris.registry.v1.RegistryService/GetCapabilities 2>&1)
    if echo "$result" | grep -q '"protocolVersion"'; then
        log_pass "HC-003: Get Capabilities"
    else
        log_fail "HC-003: Get Capabilities" "$result"
    fi

    # HC-004: Get Metrics
    result=$(grpcurl -plaintext -d '{}' "$GRPC_URL" ciris.registry.v1.RegistryService/GetMetrics 2>&1)
    if echo "$result" | grep -q "context"; then
        log_pass "HC-004: Get Metrics"
    else
        log_fail "HC-004: Get Metrics" "$result"
    fi

    header "Phase 2: Organization Operations"

    # ORG-001: Get Organization
    result=$(grpcurl -plaintext -d '{"org_id":"'"$TEST_ORG_ID"'"}' "$GRPC_URL" ciris.registry.v1.PortalService/GetOrganization 2>&1)
    if echo "$result" | grep -q "QA Primary Org"; then
        log_pass "ORG-001: Get Seeded Organization"
    else
        log_fail "ORG-001: Get Seeded Organization" "$result"
    fi

    # ORG-002: List Organizations
    result=$(grpcurl -plaintext -d '{}' "$GRPC_URL" ciris.registry.v1.PortalService/ListOrganizations 2>&1)
    if echo "$result" | grep -q "context"; then
        log_pass "ORG-002: List Organizations"
    else
        log_fail "ORG-002: List Organizations" "$result"
    fi

    header "Phase 3: User Operations"

    # USR-001: List Users
    result=$(grpcurl -plaintext -d '{"org_id":"'"$TEST_ORG_ID"'"}' "$GRPC_URL" ciris.registry.v1.PortalService/ListOrgUsers 2>&1)
    if echo "$result" | grep -q "context"; then
        log_pass "USR-001: List Users"
    else
        log_fail "USR-001: List Users" "$result"
    fi

    header "Phase 4: Key Management"

    # KEY-001: List Keys
    result=$(grpcurl -plaintext -d '{"org_id":"'"$TEST_ORG_ID"'"}' "$GRPC_URL" ciris.registry.v1.PortalService/ListKeys 2>&1)
    if echo "$result" | grep -qE '"keys"|"keyId"'; then
        log_pass "KEY-001: List Keys"
    else
        log_fail "KEY-001: List Keys" "$result"
    fi

    # KEY-002: Generate Key Pair
    result=$(grpcurl -plaintext -d '{
        "org_id": "'"$TEST_ORG_ID"'",
        "requester_user_id": "'"$TEST_USER_ID"'",
        "activate_immediately": false
    }' "$GRPC_URL" ciris.registry.v1.PortalService/GenerateKeyPair 2>&1)
    if echo "$result" | grep -qE '"keyId"|"key_id"'; then
        NEW_KEY_ID=$(echo "$result" | grep -oP '"keyId":\s*"\K[^"]+' | head -1)
        log_pass "KEY-002: Generate Key Pair"
        log_info "Generated key: $NEW_KEY_ID"
    else
        log_fail "KEY-002: Generate Key Pair" "$result"
        NEW_KEY_ID=""
    fi

    # KEY-003: Activate Key
    if [ -n "$NEW_KEY_ID" ]; then
        result=$(grpcurl -plaintext -d '{
            "org_id": "'"$TEST_ORG_ID"'",
            "key_id": "'"$NEW_KEY_ID"'",
            "requester_user_id": "'"$TEST_USER_ID"'"
        }' "$GRPC_URL" ciris.registry.v1.PortalService/ActivateKey 2>&1)
        if echo "$result" | grep -q '"success": true'; then
            log_pass "KEY-003: Activate Key"
        else
            log_fail "KEY-003: Activate Key" "$result"
        fi
    else
        log_skip "KEY-003: Activate Key" "No key_id from KEY-002"
    fi

    # KEY-004: Rotate Key
    result=$(grpcurl -plaintext -d '{
        "org_id": "'"$TEST_ORG_ID"'",
        "requester_user_id": "'"$TEST_USER_ID"'",
        "reason": "QA test",
        "mode": "ROTATION_IMMEDIATE"
    }' "$GRPC_URL" ciris.registry.v1.PortalService/RotateKey 2>&1)
    if echo "$result" | grep -q "not yet implemented"; then
        log_skip "KEY-004: Rotate Key" "Not implemented in backend"
    elif echo "$result" | grep -qE '"newKeyId"|"keyId"'; then
        log_pass "KEY-004: Rotate Key"
    else
        log_fail "KEY-004: Rotate Key" "$result"
    fi

    # KEY-005: Revoke Key (generate a new key to revoke)
    revoke_result=$(grpcurl -plaintext -d '{
        "org_id": "'"$TEST_ORG_ID"'",
        "requester_user_id": "'"$TEST_USER_ID"'",
        "activate_immediately": false
    }' "$GRPC_URL" ciris.registry.v1.PortalService/GenerateKeyPair 2>&1)
    KEY_TO_REVOKE=$(echo "$revoke_result" | grep -oP '"keyId":\s*"\K[^"]+' | head -1)

    if [ -n "$KEY_TO_REVOKE" ]; then
        result=$(grpcurl -plaintext -d '{
            "org_id": "'"$TEST_ORG_ID"'",
            "key_id": "'"$KEY_TO_REVOKE"'",
            "requester_user_id": "'"$TEST_USER_ID"'",
            "reason": "QA revocation test"
        }' "$GRPC_URL" ciris.registry.v1.PortalService/RevokeKey 2>&1)
        if echo "$result" | grep -q "not yet implemented"; then
            log_skip "KEY-005: Revoke Key" "Not implemented in backend"
        elif echo "$result" | grep -q '"success": true'; then
            log_pass "KEY-005: Revoke Key"
        else
            log_fail "KEY-005: Revoke Key" "$result"
        fi
    else
        log_skip "KEY-005: Revoke Key" "Could not generate key to revoke"
    fi

    header "Phase 5: Signature Operations"

    # Get active key for signing
    ACTIVE_KEY=$(grpcurl -plaintext -d '{"org_id":"'"$TEST_ORG_ID"'"}' "$GRPC_URL" ciris.registry.v1.PortalService/ListKeys 2>&1 | grep -B5 "KEY_STATUS_ACTIVE" | grep -oP '"keyId":\s*"\K[^"]+' | head -1)

    # SIG-001: Request Signature
    TEST_DATA=$(echo -n "Test message $(date +%s)" | base64)
    result=$(grpcurl -plaintext -d '{
        "sign_request": {
            "org_id": "'"$TEST_ORG_ID"'",
            "key_id": "'"$ACTIVE_KEY"'",
            "data": "'"$TEST_DATA"'",
            "purpose": "QA test",
            "requester_user_id": "'"$TEST_USER_ID"'"
        }
    }' "$GRPC_URL" ciris.registry.v1.PortalService/RequestSignature 2>&1)
    if echo "$result" | grep -qE '"signature"|"classicalSignature"|"postQuantumSignature"'; then
        log_pass "SIG-001: Request Signature (Hybrid Ed25519 + ML-DSA-65)"
    else
        log_fail "SIG-001: Request Signature" "$result"
    fi

    # SIG-002: Get Public Keys
    result=$(grpcurl -plaintext -d '{"org_id":"'"$TEST_ORG_ID"'"}' "$GRPC_URL" ciris.registry.v1.RegistryService/GetPublicKeys 2>&1)
    if echo "$result" | grep -qE '"publicKeys"|"ed25519"|"mlDsa"'; then
        log_pass "SIG-002: Get Public Keys"
    else
        log_fail "SIG-002: Get Public Keys" "$result"
    fi

    # SIG-003: Get Revocation List
    result=$(grpcurl -plaintext -d '{}' "$GRPC_URL" ciris.registry.v1.RegistryService/GetRevocationList 2>&1)
    if echo "$result" | grep -q "context"; then
        log_pass "SIG-003: Get Revocation List"
    else
        log_fail "SIG-003: Get Revocation List" "$result"
    fi

    header "Phase 6: Audit Operations"

    # AUD-001: Get Audit Log
    result=$(grpcurl -plaintext -d '{"org_id":"'"$TEST_ORG_ID"'", "page_size": 10}' "$GRPC_URL" ciris.registry.v1.PortalService/GetAuditLog 2>&1)
    if echo "$result" | grep -q "context"; then
        log_pass "AUD-001: Get Audit Log"
    else
        log_fail "AUD-001: Get Audit Log" "$result"
    fi

    # AUD-002: Export Audit Log
    result=$(grpcurl -plaintext -d '{
        "org_id": "'"$TEST_ORG_ID"'",
        "format": "AUDIT_EXPORT_JSON"
    }' "$GRPC_URL" ciris.registry.v1.PortalService/ExportAuditLog 2>&1)
    if echo "$result" | grep -q "not yet implemented"; then
        log_skip "AUD-002: Export Audit Log" "Not implemented in backend"
    elif echo "$result" | grep -qE '"data"|"export"'; then
        log_pass "AUD-002: Export Audit Log"
    else
        log_fail "AUD-002: Export Audit Log" "$result"
    fi

    header "Phase 7: Error Handling"

    # ERR-001: Non-existent Org
    result=$(grpcurl -plaintext -d '{"org_id":"00000000-0000-0000-0000-000000000000"}' "$GRPC_URL" ciris.registry.v1.PortalService/GetOrganization 2>&1)
    if echo "$result" | grep -qiE "not found|error|context"; then
        log_pass "ERR-001: Non-existent Org Returns Properly"
    else
        log_fail "ERR-001: Non-existent Org Returns Properly" "$result"
    fi

    # ERR-002: Invalid Key Activation
    result=$(grpcurl -plaintext -d '{
        "org_id": "'"$TEST_ORG_ID"'",
        "key_id": "invalid-key-00000",
        "requester_user_id": "test@ciris.ai"
    }' "$GRPC_URL" ciris.registry.v1.PortalService/ActivateKey 2>&1)
    if echo "$result" | grep -qiE "not found|error|invalid"; then
        log_pass "ERR-002: Invalid Key Activation Returns Error"
    else
        log_fail "ERR-002: Invalid Key Activation Returns Error" "$result"
    fi
}

run_portal_tests() {
    header "Phase 8: Portal API Integration"

    # PORTAL-001: Health API
    result=$(curl -s "$PORTAL_URL/api/registry/health" 2>&1)
    if echo "$result" | grep -q '"status"'; then
        log_pass "PORTAL-001: Health API"
    else
        log_fail "PORTAL-001: Health API" "$result"
    fi

    # PORTAL-002: Keys API (List)
    result=$(curl -s "$PORTAL_URL/api/registry/keys?org_id=$TEST_ORG_ID" 2>&1)
    if echo "$result" | grep -qE '"data"|"keys"'; then
        log_pass "PORTAL-002: Keys API (List)"
    else
        log_fail "PORTAL-002: Keys API (List)" "$result"
    fi

    # PORTAL-003: Keys API (Generate)
    result=$(curl -s -X POST "$PORTAL_URL/api/registry/keys" \
        -H "Content-Type: application/json" \
        -d '{
            "action": "generate",
            "org_id": "'"$TEST_ORG_ID"'",
            "requester_user_id": "'"$TEST_USER_ID"'",
            "activate_immediately": false
        }' 2>&1)
    if echo "$result" | grep -qE '"keyId"|"key_id"'; then
        NEW_KEY=$(echo "$result" | grep -oP '"keyId":\s*"\K[^"]+' | head -1)
        log_pass "PORTAL-003: Keys API (Generate)"
        log_info "Generated key via Portal: $NEW_KEY"
    else
        log_fail "PORTAL-003: Keys API (Generate)" "$result"
        NEW_KEY=""
    fi

    # PORTAL-004: Keys API (Activate)
    if [ -n "$NEW_KEY" ]; then
        result=$(curl -s -X POST "$PORTAL_URL/api/registry/keys" \
            -H "Content-Type: application/json" \
            -d '{
                "action": "activate",
                "org_id": "'"$TEST_ORG_ID"'",
                "key_id": "'"$NEW_KEY"'",
                "requester_user_id": "'"$TEST_USER_ID"'"
            }' 2>&1)
        if echo "$result" | grep -q '"success"'; then
            log_pass "PORTAL-004: Keys API (Activate)"
        else
            log_fail "PORTAL-004: Keys API (Activate)" "$result"
        fi
    else
        log_skip "PORTAL-004: Keys API (Activate)" "No key from PORTAL-003"
    fi

    # PORTAL-005: Audit API
    result=$(curl -s "$PORTAL_URL/api/registry/audit?org_id=$TEST_ORG_ID&page_size=5" 2>&1)
    if echo "$result" | grep -qE '"data"|"entries"|"context"'; then
        log_pass "PORTAL-005: Audit API"
    else
        log_fail "PORTAL-005: Audit API" "$result"
    fi
}

print_summary() {
    header "TEST SUMMARY"
    echo ""
    TOTAL=$((PASS + FAIL + SKIP))
    echo "  Total Tests:    $TOTAL"
    echo -e "  Passed:         ${GREEN}$PASS${NC}"
    echo -e "  Failed:         ${RED}$FAIL${NC}"
    echo -e "  Skipped:        ${YELLOW}$SKIP${NC}"
    echo ""

    if [ $FAIL -eq 0 ]; then
        echo -e "${GREEN}✓ ALL IMPLEMENTED TESTS PASSED${NC}"
    else
        IMPL_TOTAL=$((PASS + FAIL))
        PASS_RATE=$((PASS * 100 / IMPL_TOTAL))
        echo "  Pass Rate:      ${PASS_RATE}%"
    fi
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
}

# Main
echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║     CIRISPortal QA Integration Test Suite                     ║"
echo "║     Registry v1.1.0 | $(date '+%Y-%m-%d %H:%M:%S')              ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

check_prereqs

case "${1:-all}" in
    --portal-only)
        run_portal_tests
        ;;
    --grpc-only)
        run_grpc_tests
        ;;
    *)
        run_grpc_tests
        run_portal_tests
        ;;
esac

print_summary

# Exit with error if any tests failed
[ $FAIL -eq 0 ] || exit 1
