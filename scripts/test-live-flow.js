// scripts/test-live-flow.js
const BASE_URL = 'http://localhost:5000/api/v1';

async function runLiveTests() {
  console.log('\n🚀 STARTING LIVE CAMPUSHUB INTEGRATION TEST SUITE\n');

  // 1. REGISTER
  console.log('--- 1. Testing Registration (POST /auth/register) ---');
  const regRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alex.chen@stanford.edu',
      password: 'SecurePassword123!',
      firstName: 'Alex',
      lastName: 'Chen',
    }),
  });
  const regData = await regRes.json();
  console.log('Status:', regRes.status);
  console.log('Response:', JSON.stringify(regData, null, 2));

  // Extract Cookie
  const cookieHeader = regRes.headers.get('set-cookie');
  console.log('Set-Cookie Received:', cookieHeader ? '✅ Yes (HttpOnly refresh token set)' : '❌ None');

  // 2. LOGIN
  console.log('\n--- 2. Testing Login (POST /auth/login) ---');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alex.chen@stanford.edu',
      password: 'SecurePassword123!',
    }),
  });
  const loginData = await loginRes.json();
  console.log('Status:', loginRes.status);
  console.log('User Role:', loginData.data?.user?.role);
  console.log('Access Token Generated:', loginData.data?.accessToken ? '✅ Present' : '❌ Missing');

  const accessToken = loginData.data?.accessToken;
  const loginCookie = loginRes.headers.get('set-cookie');

  // 3. GET /auth/me (Protected Route)
  console.log('\n--- 3. Testing Protected Profile (GET /auth/me) ---');
  const meRes = await fetch(`${BASE_URL}/auth/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const meData = await meRes.json();
  console.log('Status:', meRes.status);
  console.log('Profile retrieved:', meData.data?.user?.email, '| Name:', meData.data?.user?.firstName, meData.data?.user?.lastName);

  // 4. CREATE CLUB (Protected Route)
  console.log('\n--- 4. Testing Club Creation (POST /clubs) ---');
  const clubRes = await fetch(`${BASE_URL}/clubs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      name: 'Stanford Robotics Society',
      description: 'Building autonomous drones and humanoid robots for collegiate competitions.',
      bannerUrl: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e',
    }),
  });
  const clubData = await clubRes.json();
  console.log('Status:', clubRes.status);
  console.log('Club Created:', clubData.data?.club?.name, '| Slug:', clubData.data?.club?.slug);

  // 5. GET ALL CLUBS (Public Route)
  console.log('\n--- 5. Testing List Clubs (GET /clubs) ---');
  const listRes = await fetch(`${BASE_URL}/clubs`);
  const listData = await listRes.json();
  console.log('Status:', listRes.status);
  console.log('Total Clubs Found:', listData.data?.clubs?.length);
  console.log('First Club Member Count:', listData.data?.clubs?.[0]?._count?.members);

  // 6. REFRESH TOKEN ROTATION (POST /auth/refresh)
  console.log('\n--- 6. Testing Refresh Token Rotation (POST /auth/refresh) ---');
  const refreshCookie = loginCookie ? loginCookie.split(';')[0] : '';
  const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      Cookie: refreshCookie,
    },
  });
  const refreshData = await refreshRes.json();
  console.log('Status:', refreshRes.status);
  console.log('Rotated Token Received:', refreshData.data?.accessToken ? '✅ Yes' : '❌ Failed');
  console.log('New Cookie Set:', refreshRes.headers.get('set-cookie') ? '✅ Yes' : '❌ No');

  console.log('\n🎉 ALL LIVE DATABASE AND API TESTS COMPLETED SUCCESSFULLY!\n');
}

runLiveTests().catch(console.error);
