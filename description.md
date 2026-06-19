# Notification Preferences API

This pull request implements the Notification Preferences API.

## Changes
- Created `NotificationPreference` database entity and schema.
- Added database migration with default preferences.
- Created `GET /users/me/notification-preferences` endpoint.
- Created `PATCH /users/me/notification-preferences` endpoint for partial updates.
- Added `NotificationsService.shouldNotify` utility helper.
- Added hook to create default preferences during user signup/creation.
- Added comprehensive unit tests and Swagger documentation.

closes #29
