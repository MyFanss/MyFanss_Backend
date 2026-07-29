import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './exception/globalException.filter';
import { AppLogger } from './logger/app-logger.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    logger: new AppLogger(),
    // Needed so the billing webhook controller can verify the HMAC
    // signature against the exact bytes the provider sent, before any JSON
    // parsing/transformation touches the body.
    rawBody: true,
  });

  // Serve uploaded files (local storage only — S3 serves its own URLs)
  const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? './uploads');
  app.useStaticAssets(uploadDir, { prefix: '/uploads' });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        const details = errors.map((error) => ({
          field: error.property,
          message: Object.values(error.constraints || {}).join(', '),
        }));
        return new BadRequestException({
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details,
        });
      },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('MyFans Backend API')
    .setDescription(
      `## MyFans REST API

Welcome to the interactive API docs for the MyFans backend.

---

### Authentication flow

MyFans uses **JWT Bearer tokens**. Here is the full login → authorize cycle:

1. **Sign up or log in**

   \`POST /api/v1/auth/signup\` or \`POST /api/v1/auth/login\`

   **Request body**
   \`\`\`json
   {
     "email": "user@example.com",
     "password": "password123"
   }
   \`\`\`

   **Response**
   \`\`\`json
   {
     "accessToken": "<JWT>",
     "refreshToken": "<token>",
     "expiresIn": 900,
     "refreshExpiresIn": 604800,
     "tokenType": "Bearer"
   }
   \`\`\`

2. **Authorise in Swagger UI**

   Click the **Authorize 🔒** button at the top of this page, paste the \`accessToken\` value (without the \`Bearer \` prefix), then click **Authorize**.

3. **Refresh an expired access token**

   \`POST /api/v1/auth/refresh\` — supply the \`refreshToken\` to receive a new token pair.

4. **Revoke a session**

   \`POST /api/v1/auth/logout\` — revokes the current refresh token.
   \`POST /api/v1/auth/logout-all\` — revokes all sessions for your account.

---

### Route groups

| Tag | Description |
|-----|-------------|
| **Authentication** | Signup, login, refresh, logout, session management |
| **Users** | User CRUD, profile updates, admin user management |
| **Posts** | Create / read / update / delete creator posts |
| **Subscriptions** | Fan subscription management |
| **Creators** | Creator onboarding, profiles, and analytics |
| **Notifications** | Notification preferences |
| **Audit** | Admin-only audit log access |

---

> See [docs/swagger-auth.md](./swagger-auth.md) for a contributor guide on the auth flow.`,
    )
    .setVersion('1.0')
    .setContact('MyFans Team', 'https://github.com/MyFanss/MyFanss_Backend', '')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description:
          'Paste the accessToken returned by POST /auth/login (without the "Bearer " prefix)',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/v1/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'MyFans API Docs',
  });

  await app.listen(process.env.PORT ?? 3000);
  console.log(
    `Application is running on: http://localhost:${process.env.PORT ?? 3000}/api/v1`,
  );
  console.log(
    `Swagger documentation: http://localhost:${process.env.PORT ?? 3000}/api/v1/docs`,
  );
}

bootstrap();
