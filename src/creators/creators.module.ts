import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreatorProfile } from './creator-profile.entity';
import { User } from '../users/user.entity';
import { CreatorsService } from './creators.service';
import { CreatorsController } from './creators.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CreatorProfile, User])],
  providers: [CreatorsService],
  controllers: [CreatorsController],
  exports: [CreatorsService],
})
export class CreatorsModule {}
