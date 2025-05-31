# My Fans Backend

A NestJS-based RESTful API , using TypeORM with PostgreSQL. This README provides instructions for contributors to set up the project and details the available API endpoints.

## API Documentation

| Method | Endpoint         | Description                     | Request Body                     | Response                          |
|--------|------------------|---------------------------------|----------------------------------|-----------------------------------|
| POST   | `/users`         | Create a new user              | `CreateUserDto` (name, email, password) | `UserResponseDto` (name, email, message) |
| GET    | `/users/:id`     | Get a user by ID               | None                             | `UserResponseDto` (name, email, message) |
| GET    | `/users`         | Get all users                  | None                             | `UserResponseDto[]`               |
| PUT    | `/users/:id`     | Update a user by ID            | `UpdateUserDto` (name?, email?, password?) | `UserResponseDto` (name, email, message) |
| DELETE | `/users/:id`     | Delete a user by ID            | None                             | `string` (success message)        |

### Example Requests

#### Create User
```bash
curl -X POST http://localhost:3000/users -H "Content-Type: application/json" -d '{ "name": "Oladele20", "email": "samuel@mailto.com","password": "password3" }'
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
curl http://localhost:3000/users/1
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
curl http://localhost:3000/users
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
curl -X PUT http://localhost:3000/users/1 -H "Content-Type: application/json" -d '{"name":"blurbeast"}'
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
curl -X DELETE http://localhost:3000/users/1
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
   Create a `.env` file in the root directory with the following:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=my_fans_db
   DB_USERNAME=postgres
   DB_PASSWORD=password
   ```

4. **Set Up PostgreSQL**:
   Create the database:
   ```bash
   psql -U postgres -c "CREATE DATABASE my_fans_db;"
   ```

5. **Run Migrations**:
   Apply database migrations to set up the `User` table:
   ```bash
   npm run migration:run
   ```

6. **Start the Application**:
   ```bash
   npm run start:dev
   ```

7. **Test APIs**:
   Use the `curl` commands in the API Documentation section to verify endpoints.

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
- **Migration Failures**:
  - Generate missing migrations:
    ```bash
    npm run migration:generate -- migrations/UserMigration
    npm run migration:run
    ```

## License

MIT License# MyFanss_Backend