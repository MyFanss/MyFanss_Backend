import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './exception/globalException.filter';
import { AppLogger } from './logger/app-logger.service';
// import { appDataSource } from './migrations/appDataSource';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    logger: new AppLogger(),
  });
  app.useGlobalFilters(new GlobalExceptionFilter());
  await app.listen(process.env.PORT ?? 3000);
  // appDataSource.initialize().then(async () => {
  //   await appDataSource.runMigrations();
  // });
}
bootstrap();
