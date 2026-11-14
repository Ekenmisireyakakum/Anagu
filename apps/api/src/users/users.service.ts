import { Injectable, Inject, ConflictException, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import * as bcryptjs from 'bcryptjs';
import { RegisterDto, UserRole } from '../auth/dto/register.dto';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  fullName: string;
  phone: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UsersService {
  constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) {}

  private mapRow(row: any): User {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role as UserRole,
      fullName: row.full_name,
      phone: row.phone,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.pool.query(
      `SELECT id, email, password_hash, role, full_name, phone, is_active, created_at, updated_at
       FROM anagu.users WHERE email = $1`,
      [email],
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.pool.query(
      `SELECT id, email, password_hash, role, full_name, phone, is_active, created_at, updated_at
       FROM anagu.users WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async create(dto: RegisterDto): Promise<User> {
    const existing = await this.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcryptjs.hash(dto.password, 12);
    const role = dto.role ?? UserRole.CITIZEN;

    const result = await this.pool.query(
      `INSERT INTO anagu.users (email, password_hash, role, full_name, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, password_hash, role, full_name, phone, is_active, created_at, updated_at`,
      [dto.email, passwordHash, role, dto.fullName, dto.phone ?? null],
    );
    return this.mapRow(result.rows[0]);
  }

  async findAll(): Promise<Omit<User, 'passwordHash'>[]> {
    const result = await this.pool.query(
      `SELECT id, email, role, full_name, phone, is_active, created_at, updated_at
       FROM anagu.users ORDER BY created_at DESC`,
    );
    return result.rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role as UserRole,
      fullName: row.full_name,
      phone: row.phone,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }
}
