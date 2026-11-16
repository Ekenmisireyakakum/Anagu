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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';

@Controller('applications')
@UseGuards(JwtAuthGuard)
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  createApplication(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateApplicationDto,
  ) {
    return this.applicationsService.createApplication(user.id, dto);
  }

  @Get()
  listApplications(@CurrentUser() user: AuthenticatedUser) {
    return this.applicationsService.listApplications(user.id);
  }

  @Get(':id')
  async getApplicationById(@Param('id') id: string) {
    const app = await this.applicationsService.getApplicationById(id);
    if (!app) {
      throw new NotFoundException(`Application ${id} not found`);
    }
    return app;
  }
}
