# Migration Guide: Cursor-Based Pagination

This guide helps you migrate from offset-based pagination to the new cursor-based pagination system.

## Timeline
- **Now**: Both pagination methods supported
- **2026-12-31**: Offset-based pagination will be sunset
- **Action Required**: Migrate your clients before December 31, 2026

## What Changed

### Old Offset-Based Pagination
```bash
GET /users?page=2&page_size=20
```

Response:
```json
{
  "data": [...],
  "page": 2,
  "pageSize": 20,
  "totalCount": 150
}
```

### New Cursor-Based Pagination
```bash
GET /users?limit=20&cursor=base64_encoded
```

Response:
```json
{
  "data": [...],
  "pagination": {
    "cursor": "base64_encoded_next_cursor",
    "hasMore": true,
    "totalCount": 150,
    "limit": 20
  }
}
```

## Why the Change?

1. **Stability**: Handles concurrent inserts/deletes without missing records
2. **Performance**: O(1) query time regardless of page number (no OFFSET overhead)
3. **Data Integrity**: No duplicate records when paginating through constantly updated data

## Migration Steps

### Step 1: Update Your Client

#### Before (Old)
```javascript
async function fetchUsers(page = 1, pageSize = 20) {
  const response = await fetch(
    `/api/users?page=${page}&page_size=${pageSize}`
  );
  const data = await response.json();
  return {
    users: data.data,
    currentPage: data.page,
    totalPages: Math.ceil(data.totalCount / pageSize),
    totalCount: data.totalCount
  };
}
```

#### After (New)
```javascript
async function fetchUsers(cursor = null, limit = 20) {
  const params = new URLSearchParams();
  params.append('limit', limit);
  if (cursor) {
    params.append('cursor', cursor);
  }
  
  const response = await fetch(`/api/users?${params}`);
  const data = await response.json();
  return {
    users: data.data,
    cursor: data.pagination.cursor,
    hasMore: data.pagination.hasMore,
    totalCount: data.pagination.totalCount
  };
}
```

### Step 2: Update Pagination UI

#### Before
```javascript
// Render page numbers: 1 2 3 4 5
async function goToPage(page) {
  const result = await fetchUsers(page, 20);
  renderUsers(result.users);
  renderPagination(result.currentPage, result.totalPages);
}
```

#### After
```javascript
// Render: Previous | Next (simpler UI)
let currentCursor = null;

async function loadMore() {
  const result = await fetchUsers(currentCursor, 20);
  renderUsers(result.users);
  currentCursor = result.cursor;
  
  if (!result.hasMore) {
    disableLoadMoreButton();
  }
}

async function loadPrevious() {
  // For previous, you need to maintain previous cursors
  // OR reload from the beginning
  currentCursor = null;
  await loadMore();
}
```

### Step 3: Handle Stale Cursors

Cursors may become invalid if data changes. Handle gracefully:

```javascript
async function fetchWithFallback(cursor, limit = 20) {
  try {
    return await fetchUsers(cursor, limit);
  } catch (error) {
    if (error.status === 410 || error.message.includes('Invalid cursor')) {
      console.warn('Cursor expired, reloading from start');
      return await fetchUsers(null, limit); // Start over
    }
    throw error;
  }
}
```

### Step 4: Testing

#### Test Cases
```javascript
describe('Cursor Pagination', () => {
  it('should fetch first page without cursor', async () => {
    const result = await fetchUsers(null, 20);
    expect(result.users).toHaveLength(20);
    expect(result.hasMore).toBe(true);
    expect(result.cursor).toBeDefined();
  });

  it('should fetch next page with cursor', async () => {
    const first = await fetchUsers(null, 20);
    const second = await fetchUsers(first.cursor, 20);
    
    expect(second.users).toHaveLength(20);
    expect(second.users[0].id).not.toBe(first.users[0].id);
  });

  it('should handle invalid cursor gracefully', async () => {
    try {
      await fetchUsers('invalid-cursor', 20);
      fail('Should throw error');
    } catch (error) {
      expect(error.status).toBe(400);
      expect(error.message).toContain('Invalid cursor');
    }
  });

  it('should work with concurrent data changes', async () => {
    const first = await fetchUsers(null, 50);
    
    // Simulate data insertion
    await insertNewUser();
    
    const second = await fetchUsers(first.cursor, 50);
    
    // Should not have duplicates
    const seenIds = new Set();
    [...first.users, ...second.users].forEach(user => {
      expect(seenIds.has(user.id)).toBe(false);
      seenIds.add(user.id);
    });
  });
});
```

### Step 5: Deprecation Headers

Monitor the deprecation header:

```javascript
async function fetchUsers(cursor = null, limit = 20) {
  const response = await fetch(`/api/users?limit=${limit}&cursor=${cursor}`);
  
  // Check for deprecation warning
  if (response.headers.get('Deprecation') === 'true') {
    const sunset = response.headers.get('Sunset');
    console.warn(`API endpoint deprecated. Sunset date: ${sunset}`);
  }
  
  return await response.json();
}
```

## Backward Compatibility

### During Migration Period
Both pagination methods work:

```bash
# Old method still works (will show deprecation warning)
GET /users?page=2&page_size=20

# New method
GET /users?limit=20&cursor=base64_encoded
```

### After Sunset (2026-12-31)
```bash
# Old method will return 410 Gone
GET /users?page=2&page_size=20
# Response: 410 Gone - Offset pagination sunset 2026-12-31

# New method continues to work
GET /users?limit=20&cursor=base64_encoded
```

## Combining with Filters and Search

Migration example with filters:

```javascript
// Old
GET /users?page=2&page_size=20&filter[status]=active&search=john

// New
GET /users?limit=20&cursor=base64&status=active&search=john
```

## FAQ

### Q: Can I still use page-based pagination?
**A:** Yes, until 2026-12-31. After that date, only cursor pagination is supported.

### Q: What if my cursor expires?
**A:** Start pagination from the beginning (without cursor). Cursor expiration is rare but can happen if data changes significantly.

### Q: How do I go back to previous pages?
**A:** Cursor pagination doesn't support going backward efficiently. Either:
1. Reload from the beginning
2. Maintain a stack of cursors (memory-intensive)
3. Use filters to narrow down and reload

### Q: Does cursor pagination support jumping to a specific page?
**A:** No. Cursor pagination requires sequential traversal. For random access, load from start or use filters to narrow scope.

### Q: How do I show the total count?
**A:** Use the `totalCount` in the pagination object:

```javascript
const result = await fetchUsers(cursor);
console.log(`Showing results of ${result.totalCount} total users`);
```

### Q: What about very large datasets?
**A:** Cursor pagination performs much better:
- Page 1 (offset 0): ~10ms
- Page 1000 (offset 20,000): ~100ms with offset, ~10ms with cursor

## Monitoring Migration

Track usage of old vs new API:

```bash
# Monitor logs for old API usage
grep 'page_size=' access.log | wc -l

# Set up alerts if old API usage > 10% after 2026-06-01
```

## Support

For issues during migration:
1. Check the [Pagination Guide](./PAGINATION_FILTERING_GUIDE.md)
2. Review test cases in `/tests/users.e2e.spec.ts`
3. Contact the backend team

## Timeline Checklist

- [ ] **Now**: Update client code to use cursor pagination
- [ ] **2026-06-01**: Remove old pagination code from client
- [ ] **2026-12-15**: Final warning - ensure all clients migrated
- [ ] **2026-12-31**: Old API returns 410 Gone
