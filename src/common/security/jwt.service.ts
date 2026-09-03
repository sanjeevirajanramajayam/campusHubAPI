import { randomUUID } from 'crypto';
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { UnauthorizedError } from '../errors/app-error.js';
import type { Role } from '@prisma/client';

/**
 * Payload encoded inside every Access Token
 */
export interface AccessTokenPayload {
  userId: string;
  email: string;
  role: Role;
}

/**
 * Payload encoded inside every Refresh Token
 */
export interface RefreshTokenPayload {
  userId: string;
  tokenFamilyId: string;
}

/**
 * JWT Security Service
 * 
 * WHY:
 * 1. Encapsulates token signing, verification, and expiration parameters.
 * 2. Isolates cryptographic JWT errors into friendly domain AppError (UnauthorizedError).
 */
export class JwtService {
  /**
   * Generates a short-lived Access Token (15 minutes)
   */
  generateAccessToken(payload: AccessTokenPayload): string {
    const options: SignOptions = {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    };
    return jwt.sign(payload, env.JWT_ACCESS_SECRET as Secret, options);
  }

  /**
   * Generates a long-lived Refresh Token (7 days)
   */
  generateRefreshToken(payload: RefreshTokenPayload): string {
    const options: SignOptions = {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
      jwtid: randomUUID(), // ⚡ Guarantees every single refresh token string is 100% unique!
    };
    return jwt.sign(payload, env.JWT_REFRESH_SECRET as Secret, options);
  }

  /**
   * Verifies and decodes an Access Token
   */
  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      return jwt.verify(token, env.JWT_ACCESS_SECRET as Secret) as AccessTokenPayload;
    } catch {
      throw new UnauthorizedError('Invalid or expired access token');
    }
  }

  /**
   * Verifies and decodes a Refresh Token
   */
  verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      return jwt.verify(token, env.JWT_REFRESH_SECRET as Secret) as RefreshTokenPayload;
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }
  }
}

export const jwtService = new JwtService();
