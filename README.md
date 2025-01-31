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
const card = await client.accessCards.provision({
  cardTemplateId: "0xd3adb00b5",
  employeeId: "123456789",
  tagId: "DDEADB33FB00B5",
  allowOnMultipleDevices: true,
  fullName: "Employee name",
  email: "employee@yourwebsite.com",
  phoneNumber: "+19547212241",
  classification: "full_time",
  startDate: "2025-01-31T22:46:25.601Z",
  expirationDate: "2025-04-30T22:46:25.601Z",
  employeePhoto: "[image_in_base64_encoded_format]"
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
const events = await client.console.eventLog({
  cardTemplateId: "0xd3adb00b5",
  filters: {
    device: "mobile", // "mobile" or "watch"
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date().toISOString(),
    eventType: "install"
  }
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

The SDK throws errors for various scenarios including:
- Missing required credentials
- API request failures
- Invalid parameters
- Server errors

Example error handling:

```javascript
try {
  const card = await client.accessCards.provision({
    // ... parameters
  });
} catch (error) {
  console.error('Failed to provision card:', error.message);
}
```

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
