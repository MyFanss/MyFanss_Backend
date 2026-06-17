import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/user.entity';

config();

if (process.env.NODE_ENV === 'production') {
  console.error('Seed script must not run in production.');
  process.exit(1);
}

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [User],
  synchronize: false,
});

const SEED_USERS = [
  { name: 'Fan One', email: 'fan1@dev.local', password: 'Fan1Pass!' },
  { name: 'Fan Two', email: 'fan2@dev.local', password: 'Fan2Pass!' },
  {
    name: 'Creator One',
    email: 'creator1@dev.local',
    password: 'Creator1Pass!',
  },
  {
    name: 'Creator Two',
    email: 'creator2@dev.local',
    password: 'Creator2Pass!',
  },
  { name: 'Admin', email: 'admin@dev.local', password: 'AdminPass!' },
];

async function seed() {
  await dataSource.initialize();
  const repo = dataSource.getRepository(User);

  if (process.argv.includes('--fresh')) {
    await repo.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    console.log('Users table truncated.');
  }

  for (const u of SEED_USERS) {
    const exists = await repo.findOneBy({ email: u.email });
    if (exists) {
      console.log(`Skipped (already exists): ${u.email}`);
      continue;
    }
    const hashed = await bcrypt.hash(u.password, 10);
    await repo.save(
      repo.create({ name: u.name, email: u.email, password: hashed }),
    );
    console.log(`Seeded: ${u.email}`);
  }

  await dataSource.destroy();
  console.log('Done.');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
