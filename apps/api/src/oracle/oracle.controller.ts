import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OracleService } from './oracle.service';
import { OwnershipClaimDto } from './dto/ownership-claim.dto';

@Controller('oracle')
@UseGuards(JwtAuthGuard)
export class OracleController {
  constructor(private readonly oracleService: OracleService) {}

  @Post('verify')
  verifyOwnership(@Body() dto: OwnershipClaimDto) {
    return this.oracleService.verifyOwnership(dto);
  }

  @Get('verification/:applicationId')
  async getVerification(@Param('applicationId') applicationId: string) {
    const verification = await this.oracleService.getLatestVerification(applicationId);
    if (!verification) {
      throw new NotFoundException(
        `No oracle verification found for application ${applicationId}`,
      );
    }
    return verification;
  }
}
