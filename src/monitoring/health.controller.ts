import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  TypeOrmHealthIndicator,
  HealthCheck,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ExemptTier } from '../common/throttle/tiers.decorator';

@ApiTags('Health')
@Controller('health')
@ExemptTier()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  @Get('live')
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Returns 200 when the process is up, no DB check required.',
  })
  @ApiResponse({ status: 200, description: 'Application is alive' })
  getLive(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness probe',
    description:
      'Returns 200 when PostgreSQL is reachable, 503 when it is not.',
  })
  @ApiResponse({ status: 200, description: 'Application is ready' })
  @ApiResponse({ status: 503, description: 'Database is unreachable' })
  checkReady() {
    return this.health.check([
      () => this.db.pingCheck('postgres', { timeout: 5000 }),
    ]);
  }
}
