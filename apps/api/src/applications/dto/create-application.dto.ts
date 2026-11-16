import { IsNotEmpty, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateApplicationDto {
  @IsUUID()
  @IsOptional()
  parcelId?: string;

  @IsString()
  @IsNotEmpty()
  parcelReference: string;

  @IsString()
  @IsNotEmpty()
  claimantName: string;

  @IsOptional()
  @IsString()
  nationalIdHash?: string;

  @IsOptional()
  @IsString()
  titleDeedHash?: string;

  @IsOptional()
  @IsObject()
  applicationData?: Record<string, unknown>;
}
