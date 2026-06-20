# Notification Preferences API

## Overview

The Notification Preferences API allows users to control which types of events they receive notifications for across various channels (e.g., email, in-app, push).

## Entity Structure

Each user has a 1:1 relation with the `NotificationPreference` entity. The following boolean preferences are available:

- `newSubscriber`: Alerts when a new user subscribes to the user. Default: `true`
- `postFromSubscribedCreator`: Alerts when a creator the user is subscribed to posts new content. Default: `true`
- `securityAlerts`: Critical security alerts (e.g., login from new device, password change). Default: `true`
- `marketing`: Promotional and marketing communications. Default: `false`

## Endpoints

### 1. Get Preferences

Retrieves the authenticated user's notification preferences. If the preferences do not exist yet, they are automatically created with default values.

**Request:**
`GET /users/me/notification-preferences`
Headers: `Authorization: Bearer <JWT>`

**Response:**
```json
{
  "newSubscriber": true,
  "postFromSubscribedCreator": true,
  "securityAlerts": true,
  "marketing": false
}
```

### 2. Update Preferences

Partially update the authenticated user's notification preferences. Invalid keys are rejected with a 400 Bad Request.

**Request:**
`PATCH /users/me/notification-preferences`
Headers: `Authorization: Bearer <JWT>`
Body:
```json
{
  "marketing": true,
  "newSubscriber": false
}
```

**Response:**
```json
{
  "newSubscriber": false,
  "postFromSubscribedCreator": true,
  "securityAlerts": true,
  "marketing": true
}
```

## Internal Usage (for other modules)

To check if a notification should be delivered to a user for a specific event, inject `NotificationsService` and use the `shouldNotify` method:

```typescript
import { NotificationsService, NotificationEventType } from '../notifications/notifications.service';

constructor(private notificationsService: NotificationsService) {}

async processEvent(userId: number, eventType: NotificationEventType) {
  const shouldNotify = await this.notificationsService.shouldNotify(userId, eventType);
  if (shouldNotify) {
    // Deliver the notification
  }
}
```
