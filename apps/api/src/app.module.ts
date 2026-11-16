import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GisModule } from './gis/gis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BlockchainModule } from './blockchain/blockchain.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    GisModule,
    AuthModule,
    UsersModule,
    BlockchainModule,
  ],
})
export class AppModule {}
