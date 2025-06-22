import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { AppLogger } from './logger/app-logger.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService, private readonly logger: AppLogger) {}

  @Get()
  getHello(): string {
    this.logger.log('Hello endpoint was called', AppController.name);
    return this.appService.getHello();
  }
}
