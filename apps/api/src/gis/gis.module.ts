import { Module } from '@nestjs/common';
import { GisService } from './gis.service';
import { GisController } from './gis.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [GisController],
  providers: [GisService],
  exports: [GisService],
})
export class GisModule {}
