// scripts/test-logout-invalidation.js
const BASE_URL = 'http://localhost:5000/api/v1';

async function testLogoutInvalidation() {
  console.log('\n🔒 TESTING INSTANT LOGOUT INVALIDATION VIA REDIS BLACKLIST\n');

  // 1. LOGIN to get fresh tokens
  console.log('--- 1. Logging in ---');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alex.chen@stanford.edu',
      password: 'SecurePassword123!',
    }),
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.accessToken;
  const cookie = loginRes.headers.get('set-cookie')?.split(';')[0];
  console.log('Login Status:', loginRes.status);
  console.log('Token Received:', token ? '✅ Yes' : '❌ No');

  // 2. VERIFY /auth/me WORKS BEFORE LOGOUT
  console.log('\n--- 2. Calling GET /auth/me BEFORE logout ---');
  const meBefore = await fetch(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meBeforeData = await meBefore.json();
  console.log('Status BEFORE Logout:', meBefore.status, '(Expected 200)');
  console.log('User:', meBeforeData.data?.user?.email);

  // 3. LOGOUT
  console.log('\n--- 3. Calling POST /auth/logout ---');
  const logoutRes = await fetch(`${BASE_URL}/auth/logout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Cookie: cookie,
    },
  });
  const logoutData = await logoutRes.json();
  console.log('Logout Status:', logoutRes.status, '(Expected 200)');
  console.log('Message:', logoutData.message);

  // 4. ATTEMPT /auth/me AFTER LOGOUT WITH SAME TOKEN
  console.log('\n--- 4. Calling GET /auth/me AFTER logout (Testing Invalidation) ---');
  const meAfter = await fetch(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meAfterData = await meAfter.json();
  console.log('Status AFTER Logout:', meAfter.status, '(Expected 401 Unauthorized!)');
  console.log('Response:', JSON.stringify(meAfterData, null, 2));

  if (meAfter.status === 401 && meAfterData.error?.message?.includes('revoked')) {
    console.log('\n🎉 SUCCESS! Access Token was instantly revoked in Redis! /auth/me is blocked!\n');
  } else {
    console.log('\n❌ FAILED: Token was not revoked properly.\n');
  }
}

testLogoutInvalidation().catch(console.error);
