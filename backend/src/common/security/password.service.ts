import { hash, verify, Algorithm } from '@node-rs/argon2';

/**
 * Password Security Service using Argon2id
 *
 * WHY ARGON2id (@node-rs/argon2):
 * 1. Winner of the Password Hashing Competition (PHC) and RFC 9106 standard.
 * 2. Written in Rust with SIMD acceleration and precompiled multi-platform binaries.
 * 3. Zero dynamic linker issues (musl vs glibc) eliminating Linux container SIGSEGV crashes.
 * 4. Memory-Hard: Requires 64MB of RAM per hash, rendering GPU brute-force attacks infeasible.
 * 5. Constant-time verification prevents timing side-channel attacks.
 */
export class PasswordService {
  /**
   * Hashes a raw plaintext password using Argon2id
   */
  async hash(password: string): Promise<string> {
    return hash(password, {
      algorithm: Algorithm.Argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3, // 3 iterations over memory
      parallelism: 4, // 4 threads
    });
  }

  /**
   * Verifies a raw plaintext password against a stored Argon2 hash
   */
  async verify(hashStr: string, plainText: string): Promise<boolean> {
    try {
      return await verify(hashStr, plainText);
    } catch {
      return false;
    }
  }
}

export const passwordService = new PasswordService();
