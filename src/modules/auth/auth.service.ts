import { randomUUID } from 'crypto';
import type { IUserRepository } from '../users/user.repository.interface.js';
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
 * Authentication Business Logic Service
 * 
 * WHY:
 * 1. Uses Constructor Dependency Injection for testability and inversion of control.
 * 2. Enforces security best practices: constant-time password verification,
 *    safe user sanitization (never leaking password hashes), and generic login error messages.
 */
export class AuthService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly passwordService: PasswordService = defaultPasswordService,
    private readonly jwtService: JwtService = defaultJwtService
  ) {}

  private sanitizeUser(user: User): UserWithoutPassword {
    const { passwordHash: _, ...sanitized } = user;
    return sanitized;
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

    const tokenFamilyId = randomUUID();
    const accessToken = this.jwtService.generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = this.jwtService.generateRefreshToken({
      userId: user.id,
      tokenFamilyId,
    });

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

    const tokenFamilyId = randomUUID();
    const accessToken = this.jwtService.generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = this.jwtService.generateRefreshToken({
      userId: user.id,
      tokenFamilyId,
    });

    return {
      user: this.sanitizeUser(user),
      tokens: { accessToken, refreshToken },
    };
  }

  async getProfile(userId: string): Promise<UserWithoutPassword> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return this.sanitizeUser(user);
  }
}
