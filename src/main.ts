import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './exception/globalException.filter';
// import { appDataSource } from './migrations/appDataSource';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new GlobalExceptionFilter());
  await app.listen(process.env.PORT ?? 3000);
  // appDataSource.initialize().then(async () => {
  //   await appDataSource.runMigrations();
  // });
}
bootstrap();
