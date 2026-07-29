import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { ExemptTier } from '../common/throttle/tiers.decorator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  @Get('live')
  @ExemptTier()
  @ApiOperation({ summary: 'Liveness probe — returns 200 when process is up' })
  checkLiveness(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ExemptTier()
  @HealthCheck()
  @ApiOperation({
    summary:
      'Readiness probe — returns 200 when DB is reachable, 503 otherwise',
  })
  checkReadiness() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }
}
