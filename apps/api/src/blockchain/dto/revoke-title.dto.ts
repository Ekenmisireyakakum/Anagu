import { IsString, IsNotEmpty } from 'class-validator';

export class RevokeTitleDto {
  @IsString() @IsNotEmpty() parcelReference: string;
  @IsString() @IsNotEmpty() grounds: string;
}
