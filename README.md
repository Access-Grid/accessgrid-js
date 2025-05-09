# AccessGrid SDK

A JavaScript SDK for interacting with the [AccessGrid.com](https://www.accessgrid.com) API. This SDK provides a simple interface for managing NFC key cards and enterprise templates. Full docs at https://www.accessgrid.com/docs

## Installation

```bash
npm install accessgrid
```

## Quick Start

```javascript
import AccessGrid from 'accessgrid';

const accountId = process.env.ACCOUNT_ID;
const secretKey = process.env.SECRET_KEY;

const client = new AccessGrid(accountId, secretKey);
```

## API Reference

### Access Cards

#### Provision a new card

```javascript
// employee badge
const card = await client.accessCards.provision({
  cardTemplateId: "0xd3adb00b5",
  employeeId: "123456789",
  cardNumber: "42069",
  siteCode: "55",
  fullName: "Employee name",
  email: "employee@yourwebsite.com",
  phoneNumber: "+19547212241",
  classification: "full_time",
  startDate: "2025-01-31T22:46:25.601Z",
  expirationDate: "2025-04-30T22:46:25.601Z",
  employeePhoto: "[image_in_base64_encoded_format]"
});

// Card object contains details like:
console.log(card.id);        // The card's unique ID
console.log(card.url);       // Installation URL for the card
console.log(card.state);     // Current state (active, suspended, etc.)
console.log(card.fullName);  // Employee name

// hotel
const card = await client.accessCards.provision({
  cardTemplateId: "0xd3adb00b5",
  cardNumber: "1",
  fileData: "0000000000000000000000000000000000000000000000000000000000000420",
  fullName: "Employee name",
  email: "employee@yourwebsite.com",
  phoneNumber: "+19547212241",
  memberId: "MEM123",
  membershipStatus: "Guest",
  isPassReadyToTransact: true,
  tileData: {
    checkInAvailableWindowStartDateTime: "2025-05-05T23:46:25.601Z",
    checkInAvailableWindowEndDateTime: "2025-05-10T23:46:25.601Z",
    checkInURL: "https://checkin.com",
    isCheckedIn: false,
    numberOfRoomsReserved: 1,
    roomNumbers: ["101"]
  },
  reservations: [{
    isCheckedIn: false,
    numberOfRoomsReserved: 1,
    roomNumbers: ["101"],
    propertyLocation: "Calle Retama 22, Zaragoza, 50720, Spain",
    propertyName: "Omnitec Hotel",
    reservationStartDateTime: "2025-05-10T12:00:00.000Z",
    reservationEndDateTime: "2025-05-12T12:00:00.000Z",
    reservationNumber: "123"
  }],
  expirationDate: "2025-05-12T14:00:00.000Z"
});

// Card object contains details like:
console.log(card.id);        // The card's unique ID
console.log(card.url);       // Installation URL for the card
console.log(card.state);     // Current state (active, suspended, etc.)
console.log(card.fullName);  // Employee name
```

You can also use the `issue()` method as an alias for `provision()`.

#### List cards for a template

```javascript
// Get all cards for a template
const cards = await client.accessCards.list("template-id");

// Filter by state
const activeCards = await client.accessCards.list("template-id", "active");
// Possible states: "active", "suspended", "unlink", "deleted"

// Access card properties
cards.forEach(card => {
  console.log(`${card.fullName} (${card.id}): ${card.state}`);
});
```

#### Update a card

```javascript
const card = await client.accessCards.update({
  cardId: "0xc4rd1d",
  employeeId: "987654321",
  fullName: "Updated Employee Name",
  classification: "contractor",
  expirationDate: "2025-02-22T21:04:03.664Z",
  employeePhoto: "[image_in_base64_encoded_format]"
});
```

#### Manage card states

```javascript
// Suspend a card
await client.accessCards.suspend({
  cardId: "0xc4rd1d"
});

// Resume a card
await client.accessCards.resume({
  cardId: "0xc4rd1d"
});

// Unlink a card
await client.accessCards.unlink({
  cardId: "0xc4rd1d"
});

// Delete a card
await client.accessCards.delete({
  cardId: "0xc4rd1d"
});
```

### Enterprise Console

#### Create a template

```javascript
const template = await client.console.createTemplate({
  name: "Employee NFC key",
  platform: "apple",
  useCase: "employee_badge",
  protocol: "desfire",
  allowOnMultipleDevices: true,
  watchCount: 2,
  iphoneCount: 3,
  design: {
    backgroundColor: "#FFFFFF",
    labelColor: "#000000",
    labelSecondaryColor: "#333333",
    backgroundImage: "[image_in_base64_encoded_format]",
    logoImage: "[image_in_base64_encoded_format]",
    iconImage: "[image_in_base64_encoded_format]"
  },
  supportInfo: {
    supportUrl: "https://help.yourcompany.com",
    supportPhoneNumber: "+1-555-123-4567",
    supportEmail: "support@yourcompany.com",
    privacyPolicyUrl: "https://yourcompany.com/privacy",
    termsAndConditionsUrl: "https://yourcompany.com/terms"
  }
});

// Template object contains details like:
console.log(template.id);             // Template ID
console.log(template.name);           // Template name
console.log(template.platform);       // Platform (apple, etc.)
console.log(template.issuedKeysCount); // Number of keys issued
console.log(template.activeKeysCount); // Number of active keys
```

#### Update a template

```javascript
const template = await client.console.updateTemplate({
  cardTemplateId: "0xd3adb00b5",
  name: "Updated Employee NFC key",
  allowOnMultipleDevices: true,
  watchCount: 2,
  iphoneCount: 3,
  supportInfo: {
    supportUrl: "https://help.yourcompany.com",
    supportPhoneNumber: "+1-555-123-4567",
    supportEmail: "support@yourcompany.com",
    privacyPolicyUrl: "https://yourcompany.com/privacy",
    termsAndConditionsUrl: "https://yourcompany.com/terms"
  }
});
```

#### Read a template

```javascript
const template = await client.console.readTemplate({
  cardTemplateId: "0xd3adb00b5"
});
```

#### Get event logs

```javascript
const events = await client.console.getEventLogs({
  cardTemplateId: "0xd3adb00b5",
  filters: {
    device: "mobile", // "mobile" or "watch"
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date().toISOString(),
    eventType: "install" // "install", "activate", etc.
  }
});

// You can also use the eventLog() method as an alias
const events = await client.console.eventLog({
  // Same parameters as above
});
```

## Configuration

The SDK can be configured with custom options:

```javascript
const client = new AccessGrid(accountId, secretKey, {
  baseUrl: 'https://api.staging.accessgrid.com' // Use a different API endpoint
});
```

## Error Handling

The SDK provides specific error classes:

```javascript
import { AccessGridError, AuthenticationError } from 'accessgrid';

try {
  const card = await client.accessCards.provision({
    // ... parameters
  });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Authentication failed. Check your credentials.');
  } else if (error instanceof AccessGridError) {
    console.error('API error:', error.message);
  } else {
    console.error('Unexpected error:', error.message);
  }
}
```

Error types:
- `AccessGridError`: Base error class for all API errors
- `AuthenticationError`: Thrown when authentication fails (e.g., invalid credentials)

## Requirements

- Node.js 12 or higher
- Modern browser environment with support for:
  - Fetch API
  - Web Crypto API
  - Promises
  - async/await

## Security

The SDK automatically handles:
- Request signing using HMAC-SHA256
- Secure payload encoding
- Authentication headers
- HTTPS communication

Never expose your `secretKey` in client-side code. Always use environment variables or a secure configuration management system.

## License

MIT License - See LICENSE file for details.