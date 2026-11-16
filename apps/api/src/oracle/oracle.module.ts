import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MqttModule } from '../mqtt/mqtt.module';
import { OracleController } from './oracle.controller';
import { OracleService } from './oracle.service';
import { MockInstitutionalService } from './mock-institutional.service';
import { MockCommunityService } from './mock-community.service';

@Module({
  imports: [DatabaseModule, MqttModule],
  controllers: [OracleController],
  providers: [OracleService, MockInstitutionalService, MockCommunityService],
  exports: [OracleService],
})
export class OracleModule {}
