import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class OwnershipClaimDto {
  @IsUUID()
  applicationId: string;

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
}
