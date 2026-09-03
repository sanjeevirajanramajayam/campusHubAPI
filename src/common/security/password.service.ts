import argon2 from 'argon2';

/**
 * Password Security Service using Argon2id
 *
 * WHY ARGON2id:
 * 1. Winner of the Password Hashing Competition (PHC) and RFC 9106 standard.
 * 2. Memory-Hard: Requires 64MB of RAM per hash, rendering GPU brute-force attacks infeasible.
 * 3. Constant-time verification prevents timing side-channel attacks.
 */
export class PasswordService {
  /**
   * Hashes a raw plaintext password using Argon2id
   */
  async hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3, // 3 iterations over memory
      parallelism: 4, // 4 threads
    });
  }

  /**
   * Verifies a raw plaintext password against a stored Argon2 hash
   */
  async verify(hash: string, plainText: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plainText);
    } catch {
      return false;
    }
  }
}

export const passwordService = new PasswordService();
