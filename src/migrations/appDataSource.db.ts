import { ConfigService } from '@nestjs/config';
import { User } from 'src/users/user.entity';
import { RefreshToken } from 'src/auth/entities/refresh-token.entity';
import { Subscription } from 'src/subscriptions/subscription.entity';
import { CreatorProfile } from 'src/creators/creator-profile.entity';
import { DataSourceOptions } from 'typeorm';

export function dataOption(configService: ConfigService): DataSourceOptions {
  return {
    type: 'postgres' as const,
    host: configService.get<string>('DB_HOST'),
    port: configService.get<number>('DB_PORT'),
    username: configService.get<string>('DB_USERNAME'),
    password: configService.get<string>('DB_PASSWORD'),
    database: configService.get<string>('DB_NAME'),
    entities: [User, RefreshToken, Subscription, CreatorProfile],
    synchronize: true,
  };
}
