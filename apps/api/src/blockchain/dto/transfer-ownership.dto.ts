import { IsString, IsNotEmpty, IsEthereumAddress } from 'class-validator';

export class TransferOwnershipDto {
  @IsString() @IsNotEmpty() parcelReference: string;
  @IsEthereumAddress() newOwnerAddress: string;
}
