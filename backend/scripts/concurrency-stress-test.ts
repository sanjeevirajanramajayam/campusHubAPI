import { createApp } from '../src/app.js';
import { prisma } from '../src/infrastructure/prisma/client.js';
import { jwtService } from '../src/common/security/jwt.service.js';

/**
 * HIGH-CONCURRENCY ACID STRESS TEST RUNNER
 * Proves PostgreSQL row-level pessimistic locking (SELECT ... FOR UPDATE)
 * prevents race conditions and overselling under heavy burst traffic.
 */
async function runConcurrencyStressTest() {
  const PORT = 5098;
  const app = createApp();

  const server = app.listen(PORT, () => {
    console.log(`\n[INIT] Stress-Test Server initialized on port ${PORT}`);
  });

  const timestamp = Date.now();
  const CAPACITY = 5;
  const CONCURRENT_WORKERS = 50;

  console.log('================================================================');
  console.log('⚡ CAMPUSHUB ACID PESSIMISTIC LOCKING STRESS TEST');
  console.log('================================================================');
  console.log(`[CONFIG] Event Capacity:     ${CAPACITY} seats`);
  console.log(`[CONFIG] Concurrent Requests: ${CONCURRENT_WORKERS} simultaneous workers`);
  console.log(`[CONFIG] Target Endpoint:    POST /api/v1/events/:id/register`);
  console.log('----------------------------------------------------------------');

  try {
    // 1. Create Host Admin User
    const host = await prisma.user.create({
      data: {
        email: `stress-host-${timestamp}@campus.edu`,
        firstName: 'Stress',
        lastName: 'Admin',
        passwordHash: 'argon2-dummy-hash',
        role: 'ADMIN',
      },
    });

    // 2. Create Club
    const club = await prisma.club.create({
      data: {
        name: `Stress Test Lab ${timestamp}`,
        slug: `stress-lab-${timestamp}`,
        description: 'High concurrency testing ground',
        members: {
          create: {
            userId: host.id,
            role: 'ADMIN',
          },
        },
      },
    });

    // 3. Create Event with Capacity = 5
    const event = await prisma.event.create({
      data: {
        clubId: club.id,
        title: `Ultra-Limited Keynote ${timestamp}`,
        description: 'Only 5 seats available for 50 attendees.',
        location: 'Turing Hall A',
        startTime: new Date(Date.now() + 86400000),
        endTime: new Date(Date.now() + 90000000),
        capacity: CAPACITY,
        registeredCount: 0,
      },
    });

    console.log(`[SETUP] Created Event: "${event.title}" (ID: ${event.id})`);
    console.log(`[SETUP] Provisioning ${CONCURRENT_WORKERS} distinct student tokens...`);

    // 4. Provision 50 users and tokens
    const students: { id: string; email: string; token: string }[] = [];
    for (let i = 0; i < CONCURRENT_WORKERS; i++) {
      const student = await prisma.user.create({
        data: {
          email: `stress-student-${timestamp}-${i}@campus.edu`,
          firstName: 'Worker',
          lastName: `${i + 1}`,
          passwordHash: 'dummy',
          role: 'STUDENT',
        },
      });

      const token = jwtService.generateAccessToken({
        userId: student.id,
        email: student.email,
        role: student.role,
      });

      students.push({ id: student.id, email: student.email, token });
    }

    console.log(`[READY] All ${CONCURRENT_WORKERS} workers armed.`);
    console.log(`[EXEC] 💥 FIRING ${CONCURRENT_WORKERS} SIMULTANEOUS BURST REGISTRATIONS...`);

    const startTime = performance.now();

    // 5. Fire all 50 requests in parallel
    const results = await Promise.all(
      students.map(async (student, idx) => {
        const reqStart = performance.now();
        try {
          const res = await fetch(`http://localhost:${PORT}/api/v1/events/${event.id}/register`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${student.token}`,
            },
          });
          const latency = performance.now() - reqStart;
          const body = await res.json();
          return {
            worker: idx + 1,
            status: res.status,
            latency,
            success: res.status === 201,
            ticketCode: body.data?.ticket?.ticketCode || null,
            message: body.message || body.error?.message || '',
          };
        } catch (err: any) {
          return {
            worker: idx + 1,
            status: 500,
            latency: performance.now() - reqStart,
            success: false,
            ticketCode: null,
            message: err.message,
          };
        }
      }),
    );

    const totalDuration = performance.now() - startTime;

    // 6. Aggregate Metrics
    const confirmed = results.filter((r) => r.status === 201);
    const rejected409 = results.filter((r) => r.status === 409);
    const errors = results.filter((r) => r.status !== 201 && r.status !== 409);

    const latencies = results.map((r) => r.latency).sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)]?.toFixed(2);
    const p95 = latencies[Math.floor(latencies.length * 0.95)]?.toFixed(2);
    const maxLat = latencies[latencies.length - 1]?.toFixed(2);

    // 7. Verify Database Rows directly in PostgreSQL
    const freshEvent = await prisma.event.findUnique({
      where: { id: event.id },
    });
    const ticketCount = await prisma.eventRegistration.count({
      where: { eventId: event.id },
    });

    console.log('\n================================================================');
    console.log('📊 TEST RESULTS & TELEMETRY SUMMARY');
    console.log('================================================================');
    console.log(`Total Execution Time:        ${totalDuration.toFixed(2)} ms`);
    console.log(`Total Requests Executed:     ${results.length}`);
    console.log(`Confirmed Registrations (201): ${confirmed.length} / ${CAPACITY} (EXPECTED: ${CAPACITY})`);
    console.log(`Sold Out Rejections (409):    ${rejected409.length} / ${CONCURRENT_WORKERS - CAPACITY} (EXPECTED: ${CONCURRENT_WORKERS - CAPACITY})`);
    console.log(`Unexpected Errors:            ${errors.length} (EXPECTED: 0)`);
    console.log(`Latency p50:                 ${p50} ms`);
    console.log(`Latency p95:                 ${p95} ms`);
    console.log(`Latency Max:                 ${maxLat} ms`);
    console.log('----------------------------------------------------------------');
    console.log(`PostgreSQL event.registeredCount: ${freshEvent?.registeredCount} (EXPECTED: ${CAPACITY})`);
    console.log(`PostgreSQL tickets in table:      ${ticketCount} (EXPECTED: ${CAPACITY})`);
    console.log('----------------------------------------------------------------');

    const passed =
      confirmed.length === CAPACITY &&
      rejected409.length === CONCURRENT_WORKERS - CAPACITY &&
      errors.length === 0 &&
      freshEvent?.registeredCount === CAPACITY &&
      ticketCount === CAPACITY;

    if (passed) {
      console.log('✅ PASS: ZERO OVERSELLING DETECTED! Pessimistic locking is airtight.');
    } else {
      console.error('❌ FAIL: CONCURRENCY RACE CONDITION DETECTED! Inconsistent state.');
      process.exitCode = 1;
    }

    console.log('================================================================\n');

    // Clean up test records
    await prisma.eventRegistration.deleteMany({ where: { eventId: event.id } });
    await prisma.event.delete({ where: { id: event.id } });
    await prisma.clubMember.deleteMany({ where: { clubId: club.id } });
    await prisma.club.delete({ where: { id: club.id } });
    await prisma.user.deleteMany({
      where: { id: { in: [host.id, ...students.map((s) => s.id)] } },
    });
  } catch (err) {
    console.error('Stress test aborted with error:', err);
    process.exitCode = 1;
  } finally {
    server.close();
    process.exit();
  }
}

runConcurrencyStressTest();
