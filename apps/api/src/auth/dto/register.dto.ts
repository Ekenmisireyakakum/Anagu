import { IsEmail, IsString, IsNotEmpty, MinLength, IsOptional, IsEnum } from 'class-validator';

export enum UserRole {
  CITIZEN = 'CITIZEN',
  SURVEYOR = 'SURVEYOR',
  REGISTRAR = 'REGISTRAR',
  LAND_ADMINISTRATOR = 'LAND_ADMINISTRATOR',
  GOVERNOR = 'GOVERNOR',
}

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}
