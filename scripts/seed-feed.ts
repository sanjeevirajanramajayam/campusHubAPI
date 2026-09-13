import { PrismaClient } from '@prisma/client';
import { passwordService } from '../src/common/security/password.service.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding CampusHub Brutalist Community Feed...');

  // 1. Create or upsert Demo Users
  const passwordHash = await passwordService.hash('Password123!');

  const alice = await prisma.user.upsert({
    where: { email: 'alice@campus.edu' },
    update: {},
    create: {
      email: 'alice@campus.edu',
      firstName: 'Alice',
      lastName: 'Turing',
      passwordHash,
      role: 'STUDENT',
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@campus.edu' },
    update: {},
    create: {
      email: 'bob@campus.edu',
      firstName: 'Bob',
      lastName: 'Dijkstra',
      passwordHash,
      role: 'CLUB_ADMIN',
    },
  });

  const charlie = await prisma.user.upsert({
    where: { email: 'charlie@campus.edu' },
    update: {},
    create: {
      email: 'charlie@campus.edu',
      firstName: 'Charlie',
      lastName: 'Hopper',
      passwordHash,
      role: 'STUDENT',
    },
  });

  // 2. Create or upsert Clubs
  const acm = await prisma.club.upsert({
    where: { name: 'ACM Chapter' },
    update: {},
    create: {
      name: 'ACM Chapter',
      slug: 'acm',
      description: 'Association for Computing Machinery student community and coding workshops.',
    },
  });

  const robotics = await prisma.club.upsert({
    where: { name: 'Robotics & Hardware' },
    update: {},
    create: {
      name: 'Robotics & Hardware',
      slug: 'robotics',
      description: 'Autonomous rovers, embedded firmware, and physical computing lab.',
    },
  });

  const design = await prisma.club.upsert({
    where: { name: 'Design & Brutalism' },
    update: {},
    create: {
      name: 'Design & Brutalism',
      slug: 'design',
      description: 'Minimalist UX, Swiss typography, and high-density industrial telemetry.',
    },
  });

  // 3. Create Posts
  const post1 = await prisma.post.create({
    data: {
      title: 'ANNOUNCEMENT: Fall Hackathon Registration Opens Monday at 08:00 UTC',
      content:
        'All teams of 2-4 students must register their repos before Friday. We will provide dedicated compute clusters, local PostgreSQL nodes, and continuous telemetry monitoring.',
      authorId: bob.id,
      tags: ['acm', 'hackathon'],
    },
  });

  const post2 = await prisma.post.create({
    data: {
      title: 'Why Industrial Brutalism and high information density beat modern flat UI',
      content:
        'Conventional web design wastes 80% of screen real estate with excessive margins and rounded cards. Old Reddit and Swiss print prove that strict grids, monospace telemetry, and instant scanning maximize user efficiency.',
      authorId: alice.id,
      tags: ['design', 'brutalism'],
    },
  });

  const post3 = await prisma.post.create({
    data: {
      title: 'Lab Bench 4 Oscilloscope calibration procedure [DOC REV 2]',
      content:
        'Please ensure all probes are grounded before powering on the signal generator. If you observe 60Hz hum, check the power line filter on rack B.',
      authorId: charlie.id,
      tags: ['robotics', 'hardware'],
    },
  });

  // 4. Create Threaded Comments (Depth 1, Depth 2, Depth 3)
  const comment1 = await prisma.comment.create({
    data: {
      postId: post2.id,
      authorId: bob.id,
      content:
        'Completely agree. The cognitive load of navigating infinite white-space cards is exhausting compared to Old Reddit.',
    },
  });

  const comment1Reply = await prisma.comment.create({
    data: {
      postId: post2.id,
      authorId: charlie.id,
      parentId: comment1.id,
      content:
        'Especially when debugging distributed systems. You want raw tabular telemetry, not decorative gradients.',
    },
  });

  await prisma.comment.create({
    data: {
      postId: post2.id,
      authorId: alice.id,
      parentId: comment1Reply.id,
      content:
        'Exactly why we enforced BR-COMM-003: strict 3-level depth keeps threads focused without infinite wandering.',
    },
  });

  // Seed some likes
  await prisma.postLike.create({ data: { postId: post1.id, userId: alice.id } });
  await prisma.postLike.create({ data: { postId: post2.id, userId: bob.id } });
  await prisma.postLike.create({ data: { postId: post2.id, userId: charlie.id } });
  await prisma.commentLike.create({ data: { commentId: comment1.id, userId: alice.id } });

  console.log('✅ Seeding complete! Created users, clubs, posts, and 3-level threaded comments.');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
