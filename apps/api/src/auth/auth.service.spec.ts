import { Pool } from 'pg';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

jest.setTimeout(30000);

describe('AuthService Integration', () => {
  let pool: Pool;
  let usersService: UsersService;
  let authService: AuthService;
  const testEmails: string[] = [];

  beforeAll(async () => {
    pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ||
        'postgresql://anagu:anagu_password@localhost:5432/anagu_db',
    });
    usersService = new UsersService(pool);
    const jwtService = new JwtService({
      secret: 'test-secret',
      signOptions: { expiresIn: '1h' },
    });
    authService = new AuthService(usersService, jwtService);
  });

  afterAll(async () => {
    // Remove test users
    if (testEmails.length > 0) {
      await pool.query(
        'DELETE FROM anagu.users WHERE email = ANY($1)',
        [testEmails],
      );
    }
    await pool.end();
  });

  it('should register a new user and return tokens', async () => {
    const email = `test-register-${Date.now()}@anagu-test.ng`;
    testEmails.push(email);

    const result = await authService.register({
      email,
      password: 'TestPass123!',
      fullName: 'Test Registrant',
    });

    expect(result.user.email).toBe(email);
    expect(result.user.role).toBe('CITIZEN');
    expect(result.accessToken).toBeDefined();
    expect(typeof result.accessToken).toBe('string');
    expect(result.expiresIn).toBe(86400);
  });

  it('should reject duplicate email registration', async () => {
    const email = `test-dup-${Date.now()}@anagu-test.ng`;
    testEmails.push(email);

    await authService.register({
      email,
      password: 'TestPass123!',
      fullName: 'First User',
    });

    await expect(
      authService.register({
        email,
        password: 'OtherPass456!',
        fullName: 'Duplicate User',
      }),
    ).rejects.toThrow('Email already registered');
  });

  it('should login with correct credentials', async () => {
    const email = `test-login-${Date.now()}@anagu-test.ng`;
    testEmails.push(email);

    await authService.register({
      email,
      password: 'LoginPass789!',
      fullName: 'Login Test User',
    });

    const result = await authService.login({ email, password: 'LoginPass789!' });

    expect(result.user.email).toBe(email);
    expect(result.accessToken).toBeDefined();
  });

  it('should reject login with wrong password', async () => {
    const email = `test-wrongpw-${Date.now()}@anagu-test.ng`;
    testEmails.push(email);

    await authService.register({
      email,
      password: 'CorrectPass1!',
      fullName: 'Wrong PW User',
    });

    await expect(
      authService.login({ email, password: 'WrongPassword!' }),
    ).rejects.toThrow('Invalid credentials');
  });

  it('should reject login for unknown email', async () => {
    await expect(
      authService.login({
        email: 'nobody@anagu-test.ng',
        password: 'AnyPassword1!',
      }),
    ).rejects.toThrow('Invalid credentials');
  });

  it('should return profile for a valid user id', async () => {
    const email = `test-profile-${Date.now()}@anagu-test.ng`;
    testEmails.push(email);

    const reg = await authService.register({
      email,
      password: 'ProfilePass1!',
      fullName: 'Profile Test User',
    });

    const profile = await authService.getProfile(reg.user.id);

    expect(profile.id).toBe(reg.user.id);
    expect(profile.email).toBe(email);
    expect(profile.fullName).toBe('Profile Test User');
    expect(profile).not.toHaveProperty('passwordHash');
  });
});
