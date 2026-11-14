import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GisModule } from './gis/gis.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    GisModule,
  ],
})
export class AppModule {}
