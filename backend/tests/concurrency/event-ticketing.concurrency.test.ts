import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/infrastructure/prisma/client.js';
import { jwtService } from '../../src/common/security/jwt.service.js';

describe('Concurrency Guard: Event Ticketing (Pessimistic Row Locking)', () => {
  const app = createApp();

  it('should guarantee ZERO overselling when 20 students compete for 5 tickets simultaneously', async () => {
    const timestamp = Date.now();

    // 1. Create Host User (Admin)
    const hostUser = await prisma.user.create({
      data: {
        email: `host-${timestamp}@stanford.edu`,
        firstName: 'Host',
        lastName: 'Admin',
        passwordHash: 'dummy-hash',
        role: 'ADMIN',
      },
    });

    // 2. Create Club
    const club = await prisma.club.create({
      data: {
        name: `Robotics Club ${timestamp}`,
        slug: `robotics-club-${timestamp}`,
        description: 'Autonomous robotics racing team',
        members: {
          create: {
            userId: hostUser.id,
            role: 'ADMIN',
          },
        },
      },
    });

    // 3. Create Event with STRICT CAPACITY = 5
    const CAPACITY = 5;
    const event = await prisma.event.create({
      data: {
        clubId: club.id,
        title: `Exclusive AI Workshop ${timestamp}`,
        description: 'Hands-on training with GPU clusters',
        location: 'Gates CS Building 104',
        startTime: new Date(Date.now() + 86400000), // Tomorrow
        endTime: new Date(Date.now() + 90000000),
        capacity: CAPACITY,
        registeredCount: 0,
      },
    });

    // 4. Create 20 distinct student accounts with JWT tokens
    const TOTAL_STUDENTS = 20;
    const studentTokens: string[] = [];

    for (let i = 0; i < TOTAL_STUDENTS; i++) {
      const student = await prisma.user.create({
        data: {
          email: `student-${timestamp}-${i}@stanford.edu`,
          firstName: 'Student',
          lastName: `${i}`,
          passwordHash: 'dummy-hash',
          role: 'STUDENT',
        },
      });

      const token = jwtService.generateAccessToken({
        userId: student.id,
        email: student.email,
        role: student.role,
      });

      studentTokens.push(token);
    }

    // 5. 🔥 THE HIGH-CONCURRENCY RACE CONDITION:
    // Fire all 20 requests at the EXACT same millisecond!
    const responses = await Promise.all(
      studentTokens.map((token) =>
        request(app)
          .post(`/api/v1/events/${event.id}/register`)
          .set('Authorization', `Bearer ${token}`),
      ),
    );

    // 6. Tally the results
    const successfulRegistrations = responses.filter((res) => res.status === 201);
    const soldOutRejections = responses.filter((res) => res.status === 409);

    // 🎯 MATHEMATICAL CONCURRENCY PROOF:
    expect(successfulRegistrations.length).toBe(CAPACITY); // Exactly 5
    expect(soldOutRejections.length).toBe(TOTAL_STUDENTS - CAPACITY); // Exactly 15

    // 7. Verify Database Integrity in PostgreSQL:
    const freshEvent = await prisma.event.findUnique({
      where: { id: event.id },
    });

    expect(freshEvent?.registeredCount).toBe(CAPACITY); // Must NOT be 6 or 20!

    const totalTicketsInDb = await prisma.eventRegistration.count({
      where: { eventId: event.id },
    });

    expect(totalTicketsInDb).toBe(CAPACITY); // Exactly 5 rows on disk!
  });
});
