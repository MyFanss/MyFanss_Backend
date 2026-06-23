# API Versioning and Breaking Change Policy

## API Versioning
All our APIs are mounted under a version prefix, currently `/api/v1`. 
The `v1` represents the major version of the API. 
Minor and patch updates to the API that are backwards compatible will be released under the same major version prefix.

## Standard Envelopes
All successful API responses are returned in a standard envelope:
```json
{
  "data": { ... },
  "meta": { ... } // Optional
}
```

All error responses are returned in a standard envelope:
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [{ "field": "email", "message": "must be an email" }] // Optional
}
```

## Breaking Change Policy
We consider an API change to be "breaking" if it requires clients to change their integration to avoid failures.
Breaking changes include, but are not limited to:
- Removing or renaming an endpoint.
- Removing or renaming a field in the response payload.
- Changing the data type of a response field.
- Adding a new required parameter or field to a request.
- Altering the expected format of an existing parameter.

### How We Handle Breaking Changes
1. **New Major Version**: Breaking changes will be introduced in a new major version of the API (e.g., `/api/v2`).
2. **Deprecation Period**: The older version of the API will continue to be supported for a deprecation period of at least 6 months.
3. **Communication**: We will notify developers of the upcoming deprecation via developer documentation, release notes, and API response headers (e.g., `Deprecation` and `Link` headers).
4. **Sunsetting**: After the deprecation period expires, the older API version will be sunset and start returning `410 Gone` before being completely removed.

Non-breaking changes, such as adding new endpoints, adding optional request parameters, or adding new fields to a response, will be deployed continuously to the current API version. Clients should be built to ignore unrecognized fields in response payloads.
