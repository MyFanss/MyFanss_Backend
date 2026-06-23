# My Fans Backend

A NestJS-based RESTful API , using TypeORM with PostgreSQL. This README provides instructions for contributors to set up the project and details the available API endpoints.

## API Documentation

| Method | Endpoint             | Description                     | Request Body                     | Response                          |
|--------|----------------------|---------------------------------|----------------------------------|-----------------------------------|
| POST   | `/api/v1/users`      | Create a new user              | `CreateUserDto` (name, email, password) | `UserResponseDto` (name, email, message) |
| GET    | `/api/v1/users/:id`  | Get a user by ID               | None                             | `UserResponseDto` (name, email, message) |
| GET    | `/api/v1/users`      | Get all users                  | None                             | `UserResponseDto[]`               |
| PUT    | `/api/v1/users/:id`  | Update a user by ID            | `UpdateUserDto` (name?, email?, password?) | `UserResponseDto` (name, email, message) |
| DELETE | `/api/v1/users/:id`  | Delete a user by ID            | None                             | `string` (success message)        |

### Example Requests

#### Create User
```bash
curl -X POST http://localhost:3000/api/v1/users -H "Content-Type: application/json" -d '{ "name": "Oladele20", "email": "samuel@mailto.com","password": "password3" }'
```

**Response**:
```json
{
	"name": "Oladele20",
	"email": "samuel@mailto.com",
	"message": "user created successfully..."
}
```

#### Get User by ID
```bash
curl http://localhost:3000/api/v1/users/1
```
**Response**:
```json
{
  "name": "Oladele20",
	"email": "samuel@mailto.com",
}
```

#### Get All Users
```bash
curl http://localhost:3000/api/v1/users
```
**Response**:
```json
[
	{
		"name": "Oladele1",
		"email": "stringing20@mail.com"
	},
	{
		"name": "Oladele20",
		"email": "samuel@mailto.com"
	}
]
```

#### Update User
```bash
curl -X PUT http://localhost:3000/api/v1/users/1 -H "Content-Type: application/json" -d '{"name":"blurbeast"}'
```
**Response**:
```json
{
	"name": "blurbeast",
	"email": "samuel@mailto.com",
	"message": "user updated successfully"
}
```

#### Delete User
```bash
curl -X DELETE http://localhost:3000/api/v1/users/1
```
**Response**:
```json
"User deleted successfully"
```

## Local Setup for Contributors

### Prerequisites

- **Node.js**: v20.x (install via `nvm`):
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
  nvm install 20
  nvm use 20
  ```
- **PostgreSQL**: Install and ensure it’s running:
  ```bash
  sudo apt update
  sudo apt install postgresql postgresql-contrib
  sudo service postgresql start
  ```
- **Git**: Installed for cloning the repository.

### Setup Steps

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-username/my-fans-backend.git
   cd my-fans-backend
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment**:
   Copy the example file and adjust values for your local PostgreSQL instance:
   ```bash
   cp .env.example .env
   ```

   Required variables (see `.env.example` for the full list):

   | Variable | Description |
   |----------|-------------|
   | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` | PostgreSQL connection |
   | `JWT_SECRET` (or `JWT_ACCESS_SECRET`) | Access-token signing secret |
   | `JWT_EXPIRES_IN` (or `JWT_ACCESS_EXPIRATION`) | Access-token lifetime |
   | `PORT` | HTTP server port (default `3000`) |
   | `NODE_ENV` | `development`, `test`, or `production` |

   The app validates environment variables at startup and exits with a readable error if required values are missing or invalid.

4. **Start the Application**:
   ```bash
   npm run start:dev
   ```

5. **Test APIs**:
   Use the `curl` commands in the API Documentation section to verify endpoints.

### Running Tests

Run the unit test suite:

```bash
npm test
```

Run the end-to-end suite:

```bash
npm run test:e2e
```

The e2e suite uses a dedicated PostgreSQL test database and does not read your normal `DB_*` variables.

### Running integration tests locally

Integration tests use [Testcontainers](https://testcontainers.com/) to spin up a real PostgreSQL container automatically — no manual database setup or credentials required. The only prerequisite is a running Docker daemon.

```bash
# Make sure Docker is running first
docker info

# Run the full integration suite
npm run test:integration
```

What happens under the hood:

1. Testcontainers pulls `postgres:16` (cached after the first run) and starts a container on a random free port.
2. All TypeORM migrations run against the fresh database. If any migration fails, the suite exits immediately with a clear error.
3. Each test file clears all tables in `beforeEach` so tests are fully isolated and order-independent.
4. After the suite finishes the container is stopped and removed automatically.

The integration tests cover:

| Spec file | Scenarios |
|-----------|-----------|
| `users-pagination.integration.spec.ts` | Default limit, custom limit, cursor-based next page, role filter, status filter, search |
| `user-sessions.integration.spec.ts` | Session creation, multi-session login, token rotation, logout, logout-all, revoked-token rejection |
| `user-profile-constraints.integration.spec.ts` | Duplicate email rejection, non-unique display name, profile field persistence, bio length limit |

If you want to keep the container running between runs for faster iteration, set `TESTCONTAINERS_RYUK_DISABLED=true` in your shell. The next `npm run test:integration` will start a fresh container as usual once RYUK is re-enabled. By default it connects to:

```env
TEST_DB_HOST=127.0.0.1
TEST_DB_PORT=5432
TEST_DB_NAME=my_fans_test
TEST_DB_USERNAME=postgres
TEST_DB_PASSWORD=postgres
TEST_JWT_SECRET=test-jwt-secret
TEST_JWT_EXPIRES_IN=1h
```

Create the database once before running locally:

```bash
createdb -h 127.0.0.1 -U postgres my_fans_test
```

Override the `TEST_DB_*` variables if your local PostgreSQL user, password, host, or port differs. Test data is truncated between specs.

## Seeded Users

Populate the local database with test users by running:

```bash
npm run seed:dev
```

The script is idempotent — re-running it skips users that already exist.  
To wipe the users table first and start fresh:

```bash
npm run seed:dev -- --fresh
```

> ⚠️ The script refuses to run when `NODE_ENV=production`.

### Test credentials

| Name        | Email                  | Password        | Role (future) |
|-------------|------------------------|-----------------|---------------|
| Fan One     | fan1@dev.local         | Fan1Pass!       | fan           |
| Fan Two     | fan2@dev.local         | Fan2Pass!       | fan           |
| Creator One | creator1@dev.local     | Creator1Pass!   | creator       |
| Creator Two | creator2@dev.local     | Creator2Pass!   | creator       |
| Admin       | admin@dev.local        | AdminPass!      | admin         |

These credentials are **development-only** and must never be used in production.

## Creator Analytics Snapshot

#### Get creator analytics for the current authenticated creator

```bash
curl -H "Authorization: Bearer <ACCESS_TOKEN>" "http://localhost:3000/creators/me/analytics?days=30"
```

**Response**:

```json
{
  "data": {
    "subscriberCount": 120,
    "newSubscribers": 15,
    "churnedSubscribers": 3,
    "periodDays": 30,
    "topReferrers": []
  }
}
```

## Contributing

1. Fork the repository.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/my-fans-backend.git
   ```
3. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature
   ```
4. Make changes and commit:
   ```bash
   git commit -m "Add your feature or fix"
   ```
   If Husky linting blocks the commit, bypass temporarily:
   ```bash
   git commit -m "Add your feature or fix" --no-verify
   ```
5. Push to your fork:
   ```bash
   git push origin feature/your-feature
   ```
6. Open a Pull Request on the main repository.

## Troubleshooting

- **Not-Null Constraint Errors**:
  - Ensure `CreateUserDto` has valid data for `name`, `email`, and `password`.
  - Check migrations for correct `User` table schema (`NOT NULL` constraints).
- **Database Connection Issues**:
  - Verify `.env` variables (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`).
  - Check PostgreSQL status:
    ```bash
    sudo service postgresql status
    ```

## Documentation

- [Pagination, filtering & search](docs/pagination-filtering.md)
- [Cursor pagination migration](docs/migration-pagination.md)
- [Logging & monitoring](docs/logging-monitoring.md)
- [API versioning and breaking change policy](docs/api-versioning.md)

## License

MIT License
