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
  department: "Engineering",
  location: "San Francisco",
  siteName: "HQ Building A",
  workstation: "4F-207",
  mailStop: "MS-401",
  companyAddress: "123 Main St, San Francisco, CA 94105",
  startDate: new Date().toISOString(),
  expirationDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  employeePhoto: "[image_in_base64_encoded_format]",
  title: "Engineering Manager",
  metadata: {
    department: "engineering",
    badgeType: "contractor"
  }
});

console.log(`Install URL: ${card.url}`);
```

You can also use the `issue()` method as an alias for `provision()`.

#### Get a card

```javascript
const card = await client.accessCards.get({
  cardId: "0xc4rd1d"
});

console.log('Card ID:', card.id);
console.log('State:', card.state);
console.log('Full Name:', card.fullName);
console.log('Install URL:', card.installUrl);
console.log('Expiration Date:', card.expirationDate);
console.log('Card Number:', card.cardNumber);
console.log('Site Code:', card.siteCode);
console.log('Devices:', card.devices);
console.log('Metadata:', card.metadata);
```

#### List cards

```javascript
// Get filtered keys by template
const templateKeys = await client.accessCards.list({ templateId: "0xd3adb00b5" });

// Get filtered keys by state
const activeKeys = await client.accessCards.list({ state: "active" });

// Print keys
templateKeys.forEach(key => {
  console.log(`Key ID: ${key.id}, Name: ${key.fullName}, State: ${key.state}`);
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
  employeePhoto: "[image_in_base64_encoded_format]",
  title: "Senior Developer"
});
```

#### Manage card states

```javascript
// Suspend a card
await client.accessCards.suspend({ cardId: "0xc4rd1d" });

// Resume a card
await client.accessCards.resume({ cardId: "0xc4rd1d" });

// Unlink a card
await client.accessCards.unlink({ cardId: "0xc4rd1d" });

// Delete a card
await client.accessCards.delete({ cardId: "0xc4rd1d" });
```

### Enterprise Console

#### Create a template

```javascript
const template = await client.console.createTemplate({
  name: "Employee Access Pass",
  platform: "apple",
  useCase: "employee_badge",
  protocol: "desfire",
  allowOnMultipleDevices: true,
  watchCount: 2,
  iphoneCount: 3,
  backgroundColor: "#FFFFFF",
  labelColor: "#000000",
  labelSecondaryColor: "#333333",
  supportUrl: "https://help.yourcompany.com",
  supportPhoneNumber: "+1-555-123-4567",
  supportEmail: "support@yourcompany.com",
  privacyPolicyUrl: "https://yourcompany.com/privacy",
  termsAndConditionsUrl: "https://yourcompany.com/terms",
  metadata: {
    version: "2.1",
    approvalStatus: "approved"
  }
});

console.log(`Template created successfully: ${template.id}`);
```

#### Update a template

```javascript
const template = await client.console.updateTemplate({
  cardTemplateId: "0xd3adb00b5",
  name: "Updated Employee Access Pass",
  allowOnMultipleDevices: true,
  watchCount: 2,
  iphoneCount: 3,
  backgroundColor: "#FFFFFF",
  labelColor: "#000000",
  labelSecondaryColor: "#333333",
  supportUrl: "https://help.yourcompany.com",
  supportPhoneNumber: "+1-555-123-4567",
  supportEmail: "support@yourcompany.com",
  privacyPolicyUrl: "https://yourcompany.com/privacy",
  termsAndConditionsUrl: "https://yourcompany.com/terms",
  metadata: {
    version: "2.2",
    lastUpdatedBy: "admin"
  }
});
```

#### Read a template

```javascript
const template = await client.console.readTemplate({
  cardTemplateId: "0xd3adb00b5"
});

console.log(`Template ID: ${template.id}`);
console.log(`Name: ${template.name}`);
console.log(`Platform: ${template.platform}`);
console.log(`Protocol: ${template.protocol}`);
console.log(`Multi-device: ${template.allowOnMultipleDevices}`);
```

#### Get event logs

```javascript
const events = await client.console.eventLog({
  cardTemplateId: "0xd3adb00b5",
  filters: {
    device: "mobile",
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date().toISOString(),
    eventType: "install"
  }
});

events.forEach(event => {
  console.log(`Event: ${event.type} at ${event.timestamp} by ${event.userId}`);
});
```

#### List pass template pairs

```javascript
const result = await client.console.listPassTemplatePairs({
  page: 1,
  perPage: 50
});

result.passTemplatePairs.forEach(pair => {
  console.log(`Pair: ${pair.name} (ID: ${pair.id})`);
  console.log(`  Android: ${pair.androidTemplate?.name}`);
  console.log(`  iOS: ${pair.iosTemplate?.name}`);
});
```

#### List ledger items

```javascript
const result = await client.console.ledgerItems({
  page: 1,
  perPage: 50,
  startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  endDate: new Date().toISOString()
});

result.ledgerItems.forEach(item => {
  console.log(`Amount: ${item.amount}, Kind: ${item.kind}, Date: ${item.createdAt}`);
  if (item.accessPass) {
    console.log(`  Access Pass: ${item.accessPass.exId}`);
    if (item.accessPass.passTemplate) console.log(`  Card Template: ${item.accessPass.passTemplate.exId}`);
  }
});

console.log(`Page ${result.pagination.currentPage} of ${result.pagination.totalPages}`);
```

#### iOS preflight

```javascript
const response = await client.console.iosPreflight({
  cardTemplateId: "0xt3mp14t3-3x1d",
  accessPassExId: "0xp455-3x1d"
});

console.log(`Provisioning Credential ID: ${response.provisioningCredentialIdentifier}`);
console.log(`Sharing Instance ID: ${response.sharingInstanceIdentifier}`);
console.log(`Card Template ID: ${response.cardTemplateIdentifier}`);
console.log(`Environment ID: ${response.environmentIdentifier}`);
```

### HID Orgs

#### Create a HID org

```javascript
const org = await client.console.hid.orgs.create({
  name: 'My Org',
  fullAddress: '1 Main St, NY NY',
  phone: '+1-555-0000',
  firstName: 'Ada',
  lastName: 'Lovelace'
});

console.log(`Created org: ${org.name} (ID: ${org.id})`);
console.log(`Slug: ${org.slug}`);
```

#### List HID orgs

```javascript
const orgs = await client.console.hid.orgs.list();

orgs.forEach(org => {
  console.log(`Org ID: ${org.id}, Name: ${org.name}, Slug: ${org.slug}`);
});
```

#### Activate a HID org

```javascript
const result = await client.console.hid.orgs.activate({
  email: 'admin@example.com',
  password: 'hid-password-123'
});

console.log(`Completed registration for org: ${result.name}`);
console.log(`Status: ${result.status}`);
```

### Webhooks

#### Create a webhook

```javascript
const webhook = await client.console.webhooks.create({
  name: 'Production',
  url: 'https://example.com/webhooks',
  subscribedEvents: ['ag.access_pass.issued']
});

console.log(`Webhook created: ${webhook.id}`);
console.log(`Private key: ${webhook.privateKey}`);
```

#### List webhooks

```javascript
const webhooks = await client.console.webhooks.list();

webhooks.forEach(webhook => {
  console.log(`ID: ${webhook.id}, Name: ${webhook.name}`);
});
```

#### Delete a webhook

```javascript
await client.console.webhooks.delete('abc123');
```

#### Receiving webhook payloads

```javascript
const express = require('express');
const app = express();

app.use(express.json({
  type: ['application/json', 'application/cloudevents+json']
}));

app.post('/webhooks', (req, res) => {
  const payload = req.body;

  if (payload.specversion !== '1.0') {
    return res.status(400).json({ error: 'Invalid CloudEvents format' });
  }

  switch (payload.type) {
    case 'ag.access_pass.issued':
      console.log(`Access pass issued: ${payload.data.access_pass_id}`);
      break;
    case 'ag.access_pass.activated':
      console.log(`Access pass activated: ${payload.data.access_pass_id}`);
      break;
    case 'ag.card_template.published':
      console.log(`Template published: ${payload.data.card_template_id}`);
      break;
  }

  res.status(200).json({ received: true });
});
```

### Landing Pages

#### List landing pages

```javascript
const landingPages = await client.console.listLandingPages();

landingPages.forEach(page => {
  console.log(`ID: ${page.id}, Name: ${page.name}, Kind: ${page.kind}`);
  console.log(`  Password Protected: ${page.passwordProtected}`);
  if (page.logoUrl) console.log(`  Logo URL: ${page.logoUrl}`);
});
```

#### Create a landing page

```javascript
const landingPage = await client.console.createLandingPage({
  name: "Miami Office Access Pass",
  kind: "universal",
  additionalText: "Welcome to the Miami Office",
  bgColor: "#f1f5f9",
  allowImmediateDownload: true
});

console.log(`Landing page created: ${landingPage.id}`);
console.log(`Name: ${landingPage.name}, Kind: ${landingPage.kind}`);
```

#### Update a landing page

```javascript
const landingPage = await client.console.updateLandingPage({
  landingPageId: "0xlandingpage1d",
  name: "Updated Miami Office Access Pass",
  additionalText: "Welcome! Tap below to get your access pass.",
  bgColor: "#e2e8f0"
});

console.log(`Landing page updated: ${landingPage.id}`);
console.log(`Name: ${landingPage.name}`);
```

### Credential Profiles

#### List credential profiles

```javascript
const profiles = await client.console.credentialProfiles.list();

profiles.forEach(profile => {
  console.log(`ID: ${profile.id}, Name: ${profile.name}, AID: ${profile.aid}`);
});
```

#### Create a credential profile

```javascript
const profile = await client.console.credentialProfiles.create({
  name: 'Main Office Profile',
  appName: 'KEY-ID-main',
  keys: [
    { value: 'your_32_char_hex_master_key_here' },
    { value: 'your_32_char_hex__read_key__here' }
  ]
});

console.log(`Profile created: ${profile.id}`);
console.log(`AID: ${profile.aid}`);
```

## Configuration

```javascript
const client = new AccessGrid(accountId, secretKey, {
  baseUrl: 'https://api.staging.accessgrid.com'
});
```

## Error Handling

```javascript
import { AccessGridError, AuthenticationError } from 'accessgrid';

try {
  const card = await client.accessCards.provision({ /* ... */ });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Authentication failed. Check your credentials.');
  } else if (error instanceof AccessGridError) {
    console.error('API error:', error.message);
  }
}
```

## Requirements

- Node.js 12 or higher
- Modern browser environment with support for Fetch API, Web Crypto API, async/await

## License

MIT License - See LICENSE file for details.

## Feature Matrix

| Endpoint | Method | Status |
|---|---|:---:|
| POST /v1/key-cards (issue) | `accessCards.provision()` | Y |
| GET /v1/key-cards/{id} | `accessCards.get()` | Y |
| PATCH /v1/key-cards/{id} | `accessCards.update()` | Y |
| GET /v1/key-cards (list) | `accessCards.list()` | Y |
| POST .../suspend | `accessCards.suspend()` | Y |
| POST .../resume | `accessCards.resume()` | Y |
| POST .../unlink | `accessCards.unlink()` | Y |
| POST .../delete | `accessCards.delete()` | Y |
| POST /v1/console/card-templates | `console.createTemplate()` | Y |
| PUT /v1/console/card-templates/{id} | `console.updateTemplate()` | Y |
| GET /v1/console/card-templates/{id} | `console.readTemplate()` | Y |
| GET .../logs | `console.eventLog()` | Y |
| GET /v1/console/pass-template-pairs | `console.listPassTemplatePairs()` | Y |
| GET /v1/console/ledger-items | `console.ledgerItems()` | Y |
| POST .../ios_preflight | `console.iosPreflight()` | Y |
| GET /v1/console/webhooks | `console.webhooks.list()` | Y |
| POST /v1/console/webhooks | `console.webhooks.create()` | Y |
| DELETE /v1/console/webhooks/{id} | `console.webhooks.delete()` | Y |
| GET /v1/console/landing-pages | `console.listLandingPages()` | Y |
| POST /v1/console/landing-pages | `console.createLandingPage()` | Y |
| PUT /v1/console/landing-pages/{id} | `console.updateLandingPage()` | Y |
| GET /v1/console/credential-profiles | `console.credentialProfiles.list()` | Y |
| POST /v1/console/credential-profiles | `console.credentialProfiles.create()` | Y |
| POST /v1/console/hid/orgs | `console.hid.orgs.create()` | Y |
| GET /v1/console/hid/orgs | `console.hid.orgs.list()` | Y |
| POST /v1/console/hid/orgs/activate | `console.hid.orgs.activate()` | Y |
