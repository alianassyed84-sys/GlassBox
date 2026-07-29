import requests

API = "http://127.0.0.1:8000"

print("Starting end-to-end security & isolation verification tests...")

# Setup mock tokens for User A and User B
headers_user_a = {
    "Authorization": "Bearer mock-token-a",
    "X-User-Id": "user_user_a_clerk"
}

headers_user_b = {
    "Authorization": "Bearer mock-token-b",
    "X-User-Id": "user_user_b_clerk"
}

# Setup User A: submit 2 runs
run_a1 = requests.post(f"{API}/runs", json={"goal": "User A goal one"}, headers=headers_user_a).json()["run_id"]
run_a2 = requests.post(f"{API}/runs", json={"goal": "User A goal two"}, headers=headers_user_a).json()["run_id"]
print(f"Setup: User A runs created: Run #{run_a1}, Run #{run_a2}")

# Setup User B: submit 1 run
run_b1 = requests.post(f"{API}/runs", json={"goal": "User B goal one"}, headers=headers_user_b).json()["run_id"]
print(f"Setup: User B runs created: Run #{run_b1}")


# TEST 1 — Basic isolation:
# Log in as User B. Confirm dashboard shows ONLY User B's runs, not User A's runs.
runs_b = requests.get(f"{API}/runs", headers=headers_user_b).json()
run_ids_b = [r["id"] for r in runs_b]
print(f"User B runs list: {run_ids_b}")
assert run_b1 in run_ids_b, "Test 1 Failed: User B run missing"
assert run_a1 not in run_ids_b, "Test 1 Failed: User A run leaked to User B"
assert run_a2 not in run_ids_b, "Test 1 Failed: User A run leaked to User B"
print("TEST 1 (Basic isolation) passed.")


# TEST 2 — Direct URL access:
# While logged in as User B, try to access User A's run.
r2 = requests.get(f"{API}/runs/{run_a1}", headers=headers_user_b)
print(f"User B accessing User A run status: {r2.status_code}")
assert r2.status_code == 403, f"Test 2 Failed: Expected 403, got {r2.status_code}"
print("TEST 2 (Direct URL access 403) passed.")


# TEST 3 — API direct call:
# Access node of User A with User B's headers.
nodes_a = requests.get(f"{API}/runs/{run_a1}/nodes", headers=headers_user_a).json()
if nodes_a:
    node_id_a = nodes_a[0]["id"]
    r3 = requests.get(f"{API}/nodes/{node_id_a}", headers=headers_user_b)
    print(f"User B accessing User A node status: {r3.status_code}")
    assert r3.status_code == 403, f"Test 3 Failed: Expected 403, got {r3.status_code}"
print("TEST 3 (API direct call node 403) passed.")


# TEST 4 — API Key isolation
# Create API key as User B. Ensure User B key cannot retrieve User A run trace.
key_res = requests.post(f"{API}/api-keys", json={"label": "User B key"}, headers=headers_user_b).json()
plain_key = key_res["plain_key"]

r4 = requests.get(f"{API}/api/v1/runs/{run_a1}", headers={"X-Glassbox-Key": plain_key})
print(f"User B API key accessing User A run trace status: {r4.status_code}")
assert r4.status_code == 403, f"Test 4 Failed: Expected 403, got {r4.status_code}"
print("TEST 4 (API Key isolation 403) passed.")


# TEST 5 — Public share links still work:
# Verify unshared run returns 404 without auth
r5_unshared = requests.get(f"{API}/public/runs/{run_b1}")
print(f"Anonymous accessing unshared run trace status: {r5_unshared.status_code}")
assert r5_unshared.status_code == 404, f"Test 5 Failed: Expected 404, got {r5_unshared.status_code}"

# Share User B's run
requests.post(f"{API}/runs/{run_b1}/share", headers=headers_user_b)

# Verify shared run trace returns successfully without auth
r5_shared = requests.get(f"{API}/public/runs/{run_b1}")
print(f"Anonymous accessing shared run trace status: {r5_shared.status_code}")
assert r5_shared.status_code == 200, f"Test 5 Failed: Expected 200, got {r5_shared.status_code}"
print("TEST 5 (Public share link access) passed.")

print("\nCONGRATULATIONS! ALL SECURITY & PRIVACY DATA ISOLATION TESTS PASSED SUCCESSFULLY!")
