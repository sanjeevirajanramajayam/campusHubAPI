import { describe, it, expect } from 'vitest';
import { PasswordService } from '../../src/common/security/password.service.js';

describe('PasswordService (Argon2id)', () => {
  const passwordService = new PasswordService();

  it('should hash a password into an Argon2id string with salt', async () => {
    const rawPassword = 'SuperSecretPassword123!';
    const hash = await passwordService.hash(rawPassword);

    expect(hash).toBeDefined();
    expect(hash).toContain('$argon2id$');
    expect(hash).not.toBe(rawPassword);
  });

  it('should verify a correct password against its hash', async () => {
    const rawPassword = 'ValidPassword_2026';
    const hash = await passwordService.hash(rawPassword);

    const isValid = await passwordService.verify(hash, rawPassword);
    expect(isValid).toBe(true);
  });

  it('should reject an incorrect password', async () => {
    const rawPassword = 'MySecretPassword!';
    const wrongPassword = 'WrongPasswordAttempt!';
    const hash = await passwordService.hash(rawPassword);

    const isValid = await passwordService.verify(hash, wrongPassword);
    expect(isValid).toBe(false);
  });

  it('should generate unique hashes for the same password due to random salting', async () => {
    const rawPassword = 'IdenticalPassword123!';
    const hash1 = await passwordService.hash(rawPassword);
    const hash2 = await passwordService.hash(rawPassword);

    expect(hash1).not.toBe(hash2);
    expect(await passwordService.verify(hash1, rawPassword)).toBe(true);
    expect(await passwordService.verify(hash2, rawPassword)).toBe(true);
  });
});
