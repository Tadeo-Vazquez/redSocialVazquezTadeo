import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard.js';
import { StatisticsRangeDto } from './dtos/statistics-range.dto.js';
import { StatisticsService } from './statistics.service.js';

@Controller('statistics')
@UseGuards(AdminGuard)
export class EstadisticasController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('posts-per-user')
  postsPerUser(@Query() range: StatisticsRangeDto) {
    return this.statisticsService.postsPerUser(range);
  }

  @Get('comments')
  totalComments(@Query() range: StatisticsRangeDto) {
    return this.statisticsService.totalComments(range);
  }

  @Get('comments-per-post')
  commentsPerPost(@Query() range: StatisticsRangeDto) {
    return this.statisticsService.commentsPerPost(range);
  }
}
