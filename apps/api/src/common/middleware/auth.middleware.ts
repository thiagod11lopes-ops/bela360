import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { env } from '../../config';
import { AuthenticationError } from '../errors';

interface AccessTokenPayload {
  userId: string;
  businessId: string;
  role: UserRole | string;
  phone?: string;
  iat?: number;
  exp?: number;
}

export function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new AuthenticationError('Token não fornecido');
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2) {
      throw new AuthenticationError('Token mal formatado');
    }

    const [scheme, token] = parts;

    if (!/^Bearer$/i.test(scheme)) {
      throw new AuthenticationError('Token mal formatado');
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;

    if (!decoded.userId || !decoded.businessId) {
      throw new AuthenticationError('Token inválido');
    }

    req.user = {
      userId: decoded.userId,
      businessId: decoded.businessId,
      role: decoded.role as UserRole,
    };

    req.business = {
      id: decoded.businessId,
      phone: decoded.phone || '',
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new AuthenticationError('Token expirado'));
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      next(new AuthenticationError('Token inválido'));
      return;
    }

    next(error);
  }
}
