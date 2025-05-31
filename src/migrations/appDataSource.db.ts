

import { ConfigService } from "@nestjs/config";
import { User } from "src/users/user.entity";
import { DataSource, DataSourceOptions } from "typeorm";

 
// import { config } from "dotenv";
// config({ path: '.env' })

// const configService = new ConfigService();

export function dataOption(configService: ConfigService): DataSourceOptions {
        return {type: 'postgres' as const,
        host: configService.get<string>('DB_HOST') ,
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME') ,
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [User],
        synchronize: true,
        // migrations: ['dis/migrations/*.ts'],
        // migrationsRun: true, 
        }
}


// export const appDataSource = new DataSource(dataOption);