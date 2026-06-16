# Advanced Pagination, Filtering & Search API Guide

## Overview

The `/users` endpoint now supports advanced pagination, multi-field filtering, full-text search, and role-based access control. This guide explains how to use these features effectively.

## Quick Start

### Basic Pagination (Cursor-Based)
```bash
GET /users?limit=20
```

Response:
```json
{
  "data": [...],
  "pagination": {
    "cursor": "base64_encoded_cursor",
    "hasMore": true,
    "totalCount": 150,
    "limit": 20
  }
}
```

### Next Page
```bash
GET /users?cursor=base64_encoded_cursor&limit=20
```

## Pagination Methods

### 1. Cursor-Based Pagination (Recommended)
Keyset pagination using `id` and `created_at` for stable pagination with concurrent data changes.

**Pros:**
- Handles concurrent inserts/deletes gracefully (no duplicate records)
- O(1) query performance regardless of page number
- No OFFSET overhead

**Example:**
```bash
GET /users?limit=20&sort_by=created_at&sort_order=DESC
```

### 2. Offset-Based Pagination (Deprecated, will be sunset 2026-12-31)
Legacy support using `page` and `page_size`.

**Example:**
```bash
GET /users?page=2&page_size=20
```

**Warning:** This is slower with large datasets and will be removed. Migrate to cursor-based pagination.

## Filtering

### Filter Syntax
```
GET /users?filter[field]=value&filter[field][operator]=value
```

### Filterable Fields

#### By Role Access:
- **Admin**: `role`, `status`, `org_id`, `created_at`
- **Manager**: `status`, `created_at`
- **User**: None (see only self)

### Examples

#### Filter by Role
```bash
GET /users?role=admin,manager
GET /users?role=admin&role=manager
```

#### Filter by Status
```bash
GET /users?status=active,inactive
```

#### Filter by Organization
```bash
GET /users?org_id=1,2,3
```

#### Filter by Date Range
```bash
GET /users?created_from=2024-01-01&created_to=2024-12-31
```

#### Combine Filters
```bash
GET /users?role=admin&status=active&org_id=1&created_from=2024-01-01
```

### Valid Filter Values

| Field | Valid Values | Default |
|-------|------|---------|
| `role` | `admin`, `manager`, `user` | - |
| `status` | `active`, `inactive`, `suspended` | - |
| `org_id` | Integer IDs | - |
| `created_at` | ISO 8601 dates | - |

## Full-Text Search

### Search Syntax
```bash
GET /users?search=john
```

### Search Scope
- **Name**: Higher relevance (weighted 100)
- **Email**: Lower relevance (weighted 30)

### Examples
```bash
# Search for a name
GET /users?search=john

# Search with filters
GET /users?search=admin&role=admin&status=active

# Search with pagination
GET /users?search=john&limit=20&cursor=base64_encoded
```

### Relevance Scoring
Results are ordered by relevance score (highest first):
- Exact match on name: `100`
- Name starts with term: `80`
- Name contains term: `60`
- Email starts with term: `50`
- Email contains term: `30`

## Sorting

### Sort Parameters
```bash
GET /users?sort_by=created_at&sort_order=DESC
```

### Sortable Fields

| Field | Admin | Manager | User |
|-------|-------|---------|------|
| `name` | ✓ | ✓ | ✓ |
| `email` | ✓ | ✓ | ✓ |
| `created_at` | ✓ | ✓ | ✓ |
| `role` | ✓ | ✗ | ✗ |
| `status` | ✓ | ✓ | ✗ |

### Examples
```bash
# Sort by name (ascending)
GET /users?sort_by=name&sort_order=ASC

# Sort by creation date (descending)
GET /users?sort_by=created_at&sort_order=DESC

# Default sort is created_at DESC
GET /users
```

## Role-Based Access Control

### Permission Rules

#### Admin
- See all users
- Access all filter and sort fields
- No org_id filtering applied

#### Manager
- See users in their organization only
- Can filter by `status` and `created_at`
- Can sort by `name`, `email`, `created_at`, `status`

#### User
- See only their own user record
- Cannot filter results
- Can sort by `name`, `email`, `created_at`

### Example Flows

**Admin listing all active users:**
```bash
GET /users?status=active&limit=50
```

**Manager listing their org's users:**
```bash
GET /users?status=active
# Implicitly filtered to their org_id
```

**Regular user accessing endpoint:**
```bash
GET /users?limit=1
# Returns only their own record
```

## Rate Limiting

### Limits
- **Per-user**: 120 requests/minute per endpoint
- **Global**: 10,000 requests/minute total

### Response Headers
```
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1640000000
Retry-After: 60
```

### HTTP 429 Response
```json
{
  "statusCode": 429,
  "message": "Too many requests, please try again later",
  "retryAfter": 60
}
```

## Caching Strategy

### Cached Data
- `users:totalCount` (30 min TTL)
- `users:filterMetadata` (15 min TTL)
- `users:permissions` (1 hour TTL)
- `users:search:*` (10 min TTL)

### Cache Invalidation
Caches are automatically invalidated when:
- New user is created
- User is updated
- User is deleted (soft delete)

## Response Format

### Success Response (200)
```json
{
  "data": [
    {
      "id": 1,
      "name": "John Admin",
      "email": "john@example.com",
      "role": "admin",
      "status": "active",
      "org_id": 1,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "cursor": "eyJpZCI6MSwgImNyZWF0ZWRBdCI6IjIwMjQtMDEtMTUifQ==",
    "hasMore": true,
    "totalCount": 150,
    "limit": 20,
    "appliedFilters": {
      "role": ["admin"],
      "status": ["active"]
    }
  }
}
```

### Error Response (400)
```json
{
  "statusCode": 400,
  "message": "Invalid query parameters",
  "errors": [
    "limit must be between 1 and 100",
    "Invalid roles: invalid_role"
  ]
}
```

## Examples

### Example 1: Find Active Admins
```bash
GET /users?role=admin&status=active&sort_by=name&sort_order=ASC
```

### Example 2: Search with Pagination
```bash
GET /users?search=john&limit=10&sort_by=relevance
# Returns matching users in relevance order
```

### Example 3: Org Manager's View
```bash
GET /users?status=active&created_from=2024-01-01&limit=50
# Automatically scoped to manager's org_id
```

### Example 4: Pagination Flow
```bash
# First page
GET /users?limit=20

# Response includes cursor
# Use cursor for next page
GET /users?cursor=base64_encoded&limit=20

# Continue until hasMore is false
```

## Migration from Old API

### Old API (Deprecated)
```bash
GET /users?page=1&limit=20
```

### New API
```bash
GET /users?limit=20
# For next page, use the cursor from response
GET /users?cursor=<cursor_from_previous>&limit=20
```

### Timeline
- Current: Both methods supported
- 2026-12-31: Sunset date for page-based pagination
- Migration: Please update clients before sunset date

## Performance Tips

1. **Use Cursor Pagination**: Faster than offset pagination, especially for large datasets
2. **Filter Before Search**: Reduce search scope with filters first
3. **Limit Results**: Use `limit=20` instead of fetching all users
4. **Leverage Caching**: Repeated searches within 10 minutes use cache
5. **Index Usage**: Composite indexes optimize common filter+sort combinations

## Troubleshooting

### Invalid Cursor Error
**Error**: `Invalid cursor provided`
**Cause**: Cursor is malformed or expired
**Solution**: Request a fresh page without cursor

### Too Many Requests (429)
**Error**: `Too many requests, please try again later`
**Cause**: Rate limit exceeded
**Solution**: Check `Retry-After` header, wait before retrying

### No Results Returned
**Cause**: Permission filtering removed all results
**Solution**: Verify user role and org_id; try with fewer filters

### Slow Query Performance
**Cause**: Missing indexes or inefficient filters
**Solution**: Use cursor pagination; ensure filters are specific

## Database Optimization

### Indexes Created
1. `(status, created_at DESC, id)` - Common filter + sort
2. `(org_id, created_at DESC, id)` - Org-scoped queries
3. `(role, status, created_at DESC, id)` - Multi-field filters
4. GIN index on `search_text` - Full-text search

### Query Plans
Run query analysis:
```sql
EXPLAIN ANALYZE
SELECT * FROM users
WHERE status = 'active'
  AND created_at > '2024-01-01'
ORDER BY created_at DESC
LIMIT 20;
```

## Monitoring

### Metrics to Track
- p50/p95 pagination latency
- Cache hit rate for totalCount
- Rate limit violation frequency
- Cursor decoding failures (> 1% indicates bugs/abuse)

### Alert Thresholds
- Pagination latency > 200ms
- Cache hit rate < 70%
- Cursor decode failures > 1%
