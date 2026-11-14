import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { GisService } from './gis.service';
import { VerifyParcelDto } from './dto/verify-parcel.dto';
import { CreateParcelDto } from './dto/create-parcel.dto';

@Controller('gis')
export class GisController {
  constructor(private readonly gisService: GisService) {}

  // POST /api/gis/verify
  @Post('verify')
  verifyParcel(@Body() dto: VerifyParcelDto) {
    return this.gisService.verifyParcel(dto);
  }

  // GET /api/gis/parcels?status=active&lga=Ikeja
  @Get('parcels')
  getParcels(
    @Query('status') status?: string,
    @Query('lga') lga?: string,
  ) {
    return this.gisService.getParcels({ status, lga });
  }

  // GET /api/gis/parcels/:id/geojson — must come before /:id to avoid route conflict
  @Get('parcels/:id/geojson')
  async getParcelGeoJSON(@Param('id') id: string) {
    const parcel = await this.gisService.getParcelById(id);
    if (!parcel) throw new NotFoundException(`Parcel ${id} not found`);
    return {
      type: 'Feature',
      geometry: parcel.geometry,
      properties: {
        id: parcel.id,
        parcelNumber: parcel.parcelNumber,
        status: parcel.status,
        areaSqm: parcel.areaSqm,
        lga: parcel.lga,
        address: parcel.address,
      },
    };
  }

  // GET /api/gis/parcels/:id
  @Get('parcels/:id')
  async getParcelById(@Param('id') id: string) {
    const parcel = await this.gisService.getParcelById(id);
    if (!parcel) throw new NotFoundException(`Parcel ${id} not found`);
    return parcel;
  }

  // POST /api/gis/parcels
  @Post('parcels')
  createParcel(@Body() dto: CreateParcelDto) {
    return this.gisService.createParcel(dto);
  }
}
