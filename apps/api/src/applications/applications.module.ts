import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MqttModule } from '../mqtt/mqtt.module';
import { OracleModule } from '../oracle/oracle.module';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

@Module({
  imports: [DatabaseModule, MqttModule, OracleModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
