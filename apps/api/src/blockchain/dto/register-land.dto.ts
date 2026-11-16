import { IsString, IsNotEmpty, IsEthereumAddress } from 'class-validator';

export class RegisterLandDto {
  @IsEthereumAddress() ownerAddress: string;
  @IsString() @IsNotEmpty() parcelReference: string;
  @IsString() @IsNotEmpty() spatialHash: string;
  @IsString() @IsNotEmpty() ownerReference: string;
  @IsString() @IsNotEmpty() documentHash: string;
  @IsString() @IsNotEmpty() tokenUri: string;
}
