import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GisModule } from './gis/gis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    GisModule,
    AuthModule,
    UsersModule,
  ],
})
export class AppModule {}
