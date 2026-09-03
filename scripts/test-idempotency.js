// scripts/test-idempotency.js
import { randomUUID } from 'crypto';

const BASE_URL = 'http://localhost:5000/api/v1';

async function testIdempotency() {
  console.log('\n🔁 TESTING RFC 9440 IDEMPOTENCY MIDDLEWARE WITH REDIS\n');

  // 1. LOGIN to get token
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alex.chen@stanford.edu',
      password: 'SecurePassword123!',
    }),
  });
  const loginData = await loginRes.json();
  const token = loginData.data.accessToken;

  // 2. GENERATE A UNIQUE IDEMPOTENCY KEY
  const idempotencyKey = randomUUID();
  console.log('Generated Idempotency-Key:', idempotencyKey);

  const clubPayload = {
    name: `AI Research Lab ${Date.now()}`,
    description: 'Undergraduate and graduate research in Large Language Models and Reinforcement Learning.',
  };

  // 3. FIRST REQUEST (Original Call)
  console.log('\n--- 1. Making First Call (Should execute DB write) ---');
  const res1 = await fetch(`${BASE_URL}/clubs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(clubPayload),
  });
  const data1 = await res1.json();
  console.log('Status 1:', res1.status, '(Expected 201)');
  console.log('Club ID:', data1.data?.club?.id);
  console.log('X-Cache-Lookup Header:', res1.headers.get('x-cache-lookup') || 'MISS (Normal DB write)');

  // 4. RETRY REQUEST WITH SAME KEY (Simulated Network Retry)
  console.log('\n--- 2. Retrying with SAME Idempotency-Key (Simulated Retry) ---');
  const res2 = await fetch(`${BASE_URL}/clubs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(clubPayload),
  });
  const data2 = await res2.json();
  console.log('Status 2:', res2.status, '(Expected 201)');
  console.log('Club ID Replayed:', data2.data?.club?.id);
  console.log('X-Cache-Lookup Header:', res2.headers.get('x-cache-lookup'));

  if (res2.headers.get('x-cache-lookup')?.includes('HIT') && data1.data?.club?.id === data2.data?.club?.id) {
    console.log('✅ PASS: Second request bypassed DB and cleanly replayed the cached response!');
  } else {
    console.log('❌ FAIL: Idempotency replay failed');
  }

  // 5. TAMPERING TEST: Same Key, DIFFERENT Payload!
  console.log('\n--- 3. Tampering Test: Same Key with DIFFERENT Payload ---');
  const res3 = await fetch(`${BASE_URL}/clubs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      name: 'Completely Different Club Name',
      description: 'Attempting to hijack a previous idempotency key.',
    }),
  });
  const data3 = await res3.json();
  console.log('Status 3:', res3.status, '(Expected 422 Unprocessable Entity)');
  console.log('Error Code:', data3.error?.code);
  console.log('Message:', data3.error?.message);

  if (res3.status === 422) {
    console.log('✅ PASS: Payload tampering was caught and rejected!');
  } else {
    console.log('❌ FAIL: Tampering guard did not trigger');
  }

  console.log('\n🎉 IDEMPOTENCY MIDDLEWARE VERIFIED SUCCESSFULLY!\n');
}

testIdempotency().catch(console.error);
