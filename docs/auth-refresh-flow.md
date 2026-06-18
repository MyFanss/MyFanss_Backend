# Auth Refresh Token Flow

This API issues short-lived access tokens and rotating refresh tokens.
Access tokens expire after 15 minutes. Refresh tokens expire after 7 days and
are stored only as bcrypt hashes.

## Token Claims

Both JWT types include:

- `sub`: user id
- `email`: user email
- `jti`: unique token id
- `type`: `access` or `refresh`
- `iat`: issued-at timestamp
- `exp`: expiration timestamp

Refresh tokens also include `familyId` and `tokenId` so the backend can rotate
and revoke a per-device token family.

## Sequence

```mermaid
sequenceDiagram
    participant Client
    participant AuthController
    participant TokenService
    participant Database

    Client->>AuthController: POST /auth/login
    AuthController->>TokenService: issueTokenPair(user, device)
    TokenService->>Database: save bcrypt(refreshToken), familyId, jti, device
    TokenService-->>AuthController: accessToken + refreshToken
    AuthController-->>Client: 200 token pair

    Client->>AuthController: POST /auth/refresh(refreshToken)
    AuthController->>TokenService: rotateRefreshToken(refreshToken)
    TokenService->>TokenService: verify JWT_REFRESH_SECRET and type=refresh
    TokenService->>Database: load token row by tokenId
    TokenService->>TokenService: bcrypt.compare(refreshToken, tokenHash)
    TokenService->>Database: save new refresh token in same family
    TokenService->>Database: revoke old token and set replacedByTokenId
    TokenService-->>AuthController: new accessToken + refreshToken
    AuthController-->>Client: 200 rotated token pair

    Client->>AuthController: POST /auth/refresh(old revoked token)
    AuthController->>TokenService: rotateRefreshToken(old token)
    TokenService->>Database: old row is already revoked
    TokenService->>Database: revoke all active tokens in family
    TokenService-->>AuthController: 401 REFRESH_TOKEN_REUSE_DETECTED
    AuthController-->>Client: 401 with machine-readable code
```

## Session Endpoints

- `POST /auth/logout` revokes the submitted refresh token only.
- `POST /auth/logout-all` revokes all active refresh tokens for the current user.
- `GET /auth/sessions` lists active device sessions without hashes or raw tokens.
- `DELETE /auth/sessions/:id` revokes one session belonging to the current user.

Password updates revoke all active refresh sessions for that user.
