# ANAGU API Reference

## Base URL

- Development: `http://localhost:3001`
- Via Nginx: `http://localhost/api`

## Authentication

All protected endpoints require a Bearer JWT in the `Authorization` header:
```
Authorization: Bearer <access_token>
```

### Auth Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Register a new citizen account |
| POST | `/auth/login` | Login, returns `{ access_token, refresh_token }` |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Invalidate refresh token |

## Applications

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/applications` | CITIZEN | Submit a new application |
| GET | `/applications` | REGISTRAR+ | List all applications |
| GET | `/applications/:id` | Any | Get application details |
| PATCH | `/applications/:id/status` | REGISTRAR+ | Update status |
| POST | `/applications/:id/documents` | CITIZEN | Upload documents |

## Verifications

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/applications/:id/spatial-verification` | SURVEYOR | Submit spatial verification |
| POST | `/applications/:id/ownership-verification` | REGISTRAR | Submit ownership verification |

## Land Titles

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/titles/issue/:applicationId` | GOVERNOR | Issue title (mint NFT) |
| GET | `/titles/:id` | Any | Get title details |
| POST | `/titles/:id/revoke` | GOVERNOR | Revoke a title |

## Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service health check |
