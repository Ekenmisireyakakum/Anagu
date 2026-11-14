import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateParcelDto {
  @IsString()
  @IsNotEmpty()
  wkt: string;

  @IsString()
  @IsNotEmpty()
  parcelNumber: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  lga?: string;

  @IsString()
  @IsOptional()
  address?: string;
}
