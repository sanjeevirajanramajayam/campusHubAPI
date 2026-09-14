import autocannon from 'autocannon';
import { createApp } from '../src/app.js';
import { redis } from '../src/infrastructure/redis/client.js';
import { jwtService } from '../src/common/security/jwt.service.js';

/**
 * High-Throughput Performance & Latency Benchmark (Autocannon)
 *
 * Measures:
 * 1. Health check baseline latency & maximum RPS.
 * 2. RFC 9440 Idempotency Redis Cache-Replay latency & throughput.
 */
async function runLoadTests() {
  const PORT = 5099;
  const app = createApp();

  const server = app.listen(PORT, () => {
    console.log(`⚡ Benchmark server listening on http://localhost:${PORT}`);
  });

  try {
    // 1. Setup Test Token & Pre-cached Idempotent Response
    const testToken = jwtService.generateAccessToken({
      userId: 'load-test-user-id',
      email: 'loadtest@stanford.edu',
      role: 'STUDENT',
    });

    const idempotencyKey = 'load-test-idempotency-key';
    const payload = JSON.stringify({
      name: 'Load Test Club',
      description: 'High throughput benchmarking club entity.',
    });

    // Compute expected fingerprint
    const { createHash } = await import('crypto');
    const fingerprint = createHash('sha256')
      .update(`POST:/api/v1/clubs:${payload}`)
      .digest('hex');

    // Seed Redis cache directly for sub-millisecond replay benchmark
    await redis.set(
      `idemp:${idempotencyKey}`,
      JSON.stringify({
        status: 'COMPLETED',
        fingerprint,
        statusCode: 201,
        body: { success: true, message: 'Cached replay benchmark' },
      }),
      'EX',
      300,
    );

    console.log('\n======================================================');
    console.log('🚀 1. RUNNING BASELINE HEALTH CHECK BENCHMARK');
    console.log('======================================================');

    const healthResult = await autocannon({
      url: `http://localhost:${PORT}/health`,
      connections: 50,
      duration: 5, // 5 seconds
      pipelining: 1,
    });

    console.log(`Requests/sec: Average = ${healthResult.requests.average.toFixed(0)}, Max = ${healthResult.requests.max}`);
    console.log(`Latency (ms): p50 = ${healthResult.latency.p50}, p99 = ${healthResult.latency.p99}, Max = ${healthResult.latency.max}`);

    console.log('\n======================================================');
    console.log('🚀 2. RUNNING IDEMPOTENCY REDIS CACHE-REPLAY BENCHMARK');
    console.log('======================================================');

    const idempotencyResult = await autocannon({
      url: `http://localhost:${PORT}/api/v1/clubs`,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${testToken}`,
        'idempotency-key': idempotencyKey,
      },
      body: payload,
      connections: 50,
      duration: 5, // 5 seconds
      pipelining: 1,
    });

    console.log(`Requests/sec: Average = ${idempotencyResult.requests.average.toFixed(0)}, Max = ${idempotencyResult.requests.max}`);
    console.log(`Latency (ms): p50 = ${idempotencyResult.latency.p50}, p99 = ${idempotencyResult.latency.p99}, Max = ${idempotencyResult.latency.max}`);
    console.log(`Total Requests Processed: ${idempotencyResult.requests.total}`);

    console.log('\n✅ Performance benchmark finished successfully!\n');
  } finally {
    server.close();
    process.exit(0);
  }
}

runLoadTests().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
