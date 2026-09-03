import { randomUUID, createHash } from 'crypto';
import type { IUserRepository } from '../users/user.repository.interface.js';
import type { IRefreshTokenRepository } from './refresh-token.repository.interface.js';
import { PrismaRefreshTokenRepository } from './refresh-token.repository.js';
import { PasswordService, passwordService as defaultPasswordService } from '../../common/security/password.service.js';
import { JwtService, jwtService as defaultJwtService } from '../../common/security/jwt.service.js';
import { ConflictError, UnauthorizedError, NotFoundError } from '../../common/errors/app-error.js';
import type { RegisterInput, LoginInput } from './auth.dto.js';
import type { User } from '@prisma/client';

export type UserWithoutPassword = Omit<User, 'passwordHash'>;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: UserWithoutPassword;
  tokens: AuthTokens;
}

/**
 * Authentication Business Logic Service with Token Family Rotation
 * 
 * WHY:
 * 1. Constructor Dependency Injection for IUserRepository and IRefreshTokenRepository.
 * 2. Implements Refresh Token Rotation (RTR): tokens are single-use only.
 * 3. Automated Theft Detection: Attempted reuse of an already-used token instantly
 *    wipes out the entire token family, neutralizing stolen credentials (Fail-Closed Security).
 */
export class AuthService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly refreshTokenRepo: IRefreshTokenRepository = new PrismaRefreshTokenRepository(),
    private readonly passwordService: PasswordService = defaultPasswordService,
    private readonly jwtService: JwtService = defaultJwtService
  ) {}

  private sanitizeUser(user: User): UserWithoutPassword {
    const { passwordHash: _, ...sanitized } = user;
    return sanitized;
  }

  /**
   * Hashes a raw JWT token using SHA-256 for secure database storage
   */
  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Helper to sign, hash, and persist a new refresh token session
   */
  private async createRefreshTokenSession(userId: string, familyId: string): Promise<string> {
    const rawToken = this.jwtService.generateRefreshToken({
      userId,
      tokenFamilyId: familyId,
    });

    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.refreshTokenRepo.create({
      userId,
      tokenHash,
      familyId,
      expiresAt,
    });

    return rawToken;
  }

  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) {
      throw new ConflictError('A user with this email address already exists');
    }

    const hashedPassword = await this.passwordService.hash(input.password);

    const user = await this.userRepo.create({
      email: input.email,
      passwordHash: hashedPassword,
      firstName: input.firstName,
      lastName: input.lastName,
    });

    const familyId = randomUUID();
    const accessToken = this.jwtService.generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = await this.createRefreshTokenSession(user.id, familyId);

    return {
      user: this.sanitizeUser(user),
      tokens: { accessToken, refreshToken },
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.userRepo.findByEmail(input.email);
    if (!user) {
      // Generic error message prevents username/email enumeration attacks
      throw new UnauthorizedError('Invalid email or password');
    }

    const isPasswordValid = await this.passwordService.verify(user.passwordHash, input.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const familyId = randomUUID();
    const accessToken = this.jwtService.generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = await this.createRefreshTokenSession(user.id, familyId);

    return {
      user: this.sanitizeUser(user),
      tokens: { accessToken, refreshToken },
    };
  }

  /**
   * Refresh Token Rotation with Automated Theft Detection
   */
  async refresh(rawRefreshToken: string): Promise<AuthResult> {
    // 1. Verify cryptographic JWT signature
    const payload = this.jwtService.verifyRefreshToken(rawRefreshToken);

    // 2. Hash token to look up in database
    const tokenHash = this.hashToken(rawRefreshToken);
    const tokenRecord = await this.refreshTokenRepo.findByTokenHash(tokenHash);

    // 3. If token record doesn't exist, session was revoked or invalid
    if (!tokenRecord) {
      throw new UnauthorizedError('Invalid or expired refresh token session');
    }

    // 4. 🚨 AUTOMATED THEFT DETECTION:
    // If this token was ALREADY marked as used, someone is replaying a stolen token!
    if (tokenRecord.isUsed) {
      // Nuclear Revocation: Wipe the entire compromised token family!
      await this.refreshTokenRepo.revokeFamily(tokenRecord.familyId);
      throw new UnauthorizedError('Security alert: Token reuse detected. All sessions revoked.');
    }

    // 5. Check database expiration
    if (tokenRecord.expiresAt < new Date()) {
      await this.refreshTokenRepo.deleteByTokenHash(tokenHash);
      throw new UnauthorizedError('Refresh token has expired');
    }

    // 6. Look up current user details
    const user = await this.userRepo.findById(payload.userId);
    if (!user) {
      throw new UnauthorizedError('User account not found');
    }

    // 7. ROTATE: Mark the incoming token as used
    await this.refreshTokenRepo.markAsUsed(tokenRecord.id);

    // 8. Issue new Access Token and new Refresh Token inside the SAME family
    const newAccessToken = this.jwtService.generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    const newRefreshToken = await this.createRefreshTokenSession(user.id, tokenRecord.familyId);

    return {
      user: this.sanitizeUser(user),
      tokens: { accessToken: newAccessToken, refreshToken: newRefreshToken },
    };
  }

  /**
   * Logout user by invalidating the refresh token session
   */
  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken);
    await this.refreshTokenRepo.deleteByTokenHash(tokenHash);
  }

  async getProfile(userId: string): Promise<UserWithoutPassword> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return this.sanitizeUser(user);
  }
}
