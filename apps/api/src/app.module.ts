import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GisModule } from './gis/gis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { MqttModule } from './mqtt/mqtt.module';
import { OracleModule } from './oracle/oracle.module';
import { ApplicationsModule } from './applications/applications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    GisModule,
    AuthModule,
    UsersModule,
    BlockchainModule,
    MqttModule,
    OracleModule,
    ApplicationsModule,
  ],
})
export class AppModule {}
