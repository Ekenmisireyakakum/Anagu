import { Controller, Get, Param } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';

@Controller('blockchain')
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) {}

  @Get('status')
  async getStatus() {
    return this.blockchainService.isConnected();
  }

  @Get('record/:parcelRef')
  async getRecord(@Param('parcelRef') parcelRef: string) {
    return this.blockchainService.getRecord(parcelRef);
  }

  @Get('title/:tokenId')
  async getTitleMetadata(@Param('tokenId') tokenId: string) {
    return this.blockchainService.getTitleMetadata(+tokenId);
  }
}
