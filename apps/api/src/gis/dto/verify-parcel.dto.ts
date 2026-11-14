import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class VerifyParcelDto {
  @IsString()
  @IsNotEmpty()
  wkt: string;

  @IsUUID()
  applicationId: string;

  @IsUUID()
  @IsOptional()
  excludeParcelId?: string;
}
