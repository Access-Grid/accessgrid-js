// AccessGrid Error classes
class AccessGridError extends Error {
  constructor(message) {
    super(message);
    this.name = "AccessGridError";
  }
}

class AuthenticationError extends AccessGridError {
  constructor(message = "Invalid credentials") {
    super(message);
    this.name = "AuthenticationError";
  }
}

// AccessCard model class
class AccessCard {
  constructor(data = {}) {
    this.id = data.id;
    this.url = data.install_url;
    this.installUrl = data.install_url;
    this.details = data.details;
    this.state = data.state;
    this.fullName = data.full_name;
    this.expirationDate = data.expiration_date;
    this.cardTemplateId = data.card_template_id;
    this.cardNumber = data.card_number;
    this.siteCode = data.site_code;
    this.fileData = data.file_data;
    this.directInstallUrl = data.direct_install_url;
    this.title = data.title;
    this.temporary = data.temporary;
    this.employeeId = data.employee_id;
    this.organizationName = data.organization_name;
    this.createdAt = data.created_at;
    this.devices = data.devices || [];
    this.metadata = data.metadata || {};
  }

  toString() {
    return `AccessCard(name='${this.fullName}', id='${this.id}', state='${this.state}')`;
  }
}

// Template model class
class Template {
  constructor(data = {}) {
    this.id = data.id;
    this.name = data.name;
    this.platform = data.platform;
    this.useCase = data.use_case;
    this.protocol = data.protocol;
    this.createdAt = data.created_at;
    this.lastPublishedAt = data.last_published_at;
    this.issuedKeysCount = data.issued_keys_count;
    this.activeKeysCount = data.active_keys_count;
    this.allowedDeviceCounts = data.allowed_device_counts;
    this.supportSettings = data.support_settings;
    this.termsSettings = data.terms_settings;
    this.styleSettings = data.style_settings;
    this.metadata = data.metadata;

    // Convenience: derive allowOnMultipleDevices from allowed_device_counts
    if (this.allowedDeviceCounts) {
      const total = Object.values(this.allowedDeviceCounts).reduce(
        (sum, v) => sum + (v || 0),
        0,
      );
      this.allowOnMultipleDevices = total > 1;
    } else {
      this.allowOnMultipleDevices = undefined;
    }
  }
}

// HIDOrg model class
class HIDOrg {
  constructor(data = {}) {
    this.id = data.id;
    this.name = data.name;
    this.slug = data.slug;
    this.firstName = data.first_name;
    this.lastName = data.last_name;
    this.phone = data.phone;
    this.fullAddress = data.full_address;
    this.status = data.status;
    this.createdAt = data.created_at;
  }
}

// PassTemplatePair model class
class PassTemplatePair {
  constructor(data = {}) {
    this.id = data.id;
    this.exId = data.ex_id;
    this.name = data.name;
    this.createdAt = data.created_at;
    this.androidTemplate = data.android_template
      ? new TemplateInfo(data.android_template)
      : null;
    this.iosTemplate = data.ios_template
      ? new TemplateInfo(data.ios_template)
      : null;
  }
}

// TemplateInfo model class
class TemplateInfo {
  constructor(data = {}) {
    this.id = data.id;
    this.exId = data.ex_id;
    this.name = data.name;
    this.platform = data.platform;
  }
}

// LedgerItemPassTemplate model class
class LedgerItemPassTemplate {
  constructor(data = {}) {
    this.id = data.id;
    this.name = data.name;
    this.protocol = data.protocol;
    this.platform = data.platform;
    this.useCase = data.use_case;
  }
}

// LedgerItemAccessPass model class
class LedgerItemAccessPass {
  constructor(data = {}) {
    this.id = data.id;
    this.fullName = data.full_name;
    this.state = data.state;
    this.metadata = data.metadata || {};
    this.unifiedAccessPassExId = data.unified_access_pass_ex_id;
    this.passTemplate = data.pass_template
      ? new LedgerItemPassTemplate(data.pass_template)
      : null;
  }
}

// LedgerItem model class
class LedgerItem {
  constructor(data = {}) {
    this.id = data.id;
    this.createdAt = data.created_at;
    this.amount = data.amount;
    this.kind = data.kind;
    this.metadata = data.metadata || {};
    this.accessPass = data.access_pass
      ? new LedgerItemAccessPass(data.access_pass)
      : null;
  }
}

// Base API wrapper to handle common functionality
class BaseApi {
  constructor(accountId, secretKey, baseUrl = "https://api.accessgrid.com") {
    this.accountId = accountId;
    this.secretKey = secretKey;
    this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash if present
    this.version = "1.4.0"; // Should come from package.json
  }

  async request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const method = options.method || "GET";

    try {
      // Extract resource ID from the endpoint if needed for signature
      let resourceId = null;
      if (
        method === "GET" ||
        (method === "POST" &&
          (!options.body || Object.keys(options.body).length === 0))
      ) {
        // Extract the ID from the endpoint - patterns like /resource/{id} or /resource/{id}/action
        const parts = path.split("/").filter((part) => part);
        if (parts.length >= 2) {
          // For actions like unlink/suspend/resume, get the card ID (second to last part)
          if (
            ["suspend", "resume", "unlink", "delete"].includes(
              parts[parts.length - 1],
            )
          ) {
            resourceId = parts[parts.length - 2];
          } else {
            // Otherwise, the ID is typically the last part of the path
            resourceId = parts[parts.length - 1];
          }
        }
      }

      // Determine payload for signature generation
      let payload;
      let sigPayload;

      if ((method === "POST" && !options.body) || method === "GET") {
        // For these requests, use {"id": "card_id"} as the payload for signature generation
        if (resourceId) {
          sigPayload = JSON.stringify({ id: resourceId });
        } else {
          payload = "{}";
          sigPayload = payload;
        }
      } else {
        // For normal POST/PUT/PATCH with body, use the actual payload
        payload = options.body ? JSON.stringify(options.body) : "";
        sigPayload = payload;
      }

      // Generate signature
      const signature = await this._generateSignature(sigPayload);

      // Prepare headers
      const headers = {
        "Content-Type": "application/json",
        "X-ACCT-ID": this.accountId,
        "X-PAYLOAD-SIG": signature,
        "User-Agent": `accessgrid.js @ v${this.version}`,
        ...(options.headers || {}),
      };

      // Handle query parameters for GET requests or POST with empty body
      let finalUrl = url;
      if (method === "GET" || (method === "POST" && !options.body)) {
        if (resourceId) {
          // Add sig_payload to query params
          const separator = finalUrl.includes("?") ? "&" : "?";
          finalUrl = `${finalUrl}${separator}sig_payload=${encodeURIComponent(JSON.stringify({ id: resourceId }))}`;
        }
      }

      // Make the request
      const response = await fetch(finalUrl, {
        method,
        headers,
        body: method !== "GET" ? payload : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          throw new AuthenticationError();
        } else if (response.status === 402) {
          throw new AccessGridError("Insufficient account balance");
        } else {
          throw new AccessGridError(data.message || "Request failed");
        }
      }

      return data;
    } catch (error) {
      if (error instanceof AccessGridError) {
        throw error;
      }
      throw new AccessGridError(`API request failed: ${error.message}`);
    }
  }

  async _generateSignature(payload) {
    try {
      // Base64 encode the payload
      const encodedPayload = btoa(payload);

      // Generate SHA256 HMAC
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(this.secretKey),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );

      const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(encodedPayload),
      );

      // Convert to hex string
      return Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch (error) {
      throw new AccessGridError(
        `Failed to generate signature: ${error.message}`,
      );
    }
  }
}

// Access Cards API handling
class AccessCardsApi extends BaseApi {
  constructor(accountId, secretKey, baseUrl) {
    super(accountId, secretKey, baseUrl);
  }

  async provision(params) {
    // Required parameters validation
    if (!params.cardTemplateId)
      throw new AccessGridError("card_template_id is required");
    if (!params.fullName) throw new AccessGridError("full_name is required");
    if (!params.startDate) throw new AccessGridError("start_date is required");
    if (!params.expirationDate)
      throw new AccessGridError("expiration_date is required");

    // Start with required parameters
    const requestBody = {
      card_template_id: params.cardTemplateId,
      full_name: params.fullName,
      start_date: params.startDate,
      expiration_date: params.expirationDate,
    };

    // Map camelCase JS params to snake_case API params
    const paramMapping = {
      employeeId: "employee_id",
      tagId: "tag_id",
      phoneNumber: "phone_number",
      employeePhoto: "employee_photo",
      allowOnMultipleDevices: "allow_on_multiple_devices",
      memberId: "member_id",
      membershipStatus: "membership_status",
      isPassReadyToTransact: "is_pass_ready_to_transact",
      tileData: "tile_data",
      reservations: "reservations",
      department: "department",
      location: "location",
      siteName: "site_name",
      workstation: "workstation",
      mailStop: "mail_stop",
      companyAddress: "company_address",
      siteCode: "site_code",
      cardNumber: "card_number",
      fileData: "file_data",
      email: "email",
      classification: "classification",
      title: "title",
      organizationName: "organization_name",
      metadata: "metadata",
    };

    // Add any params that exist to the request body
    Object.keys(params).forEach((key) => {
      if (
        key !== "cardTemplateId" &&
        key !== "fullName" &&
        key !== "startDate" &&
        key !== "expirationDate" &&
        params[key] !== undefined &&
        params[key] !== null
      ) {
        const apiKey = paramMapping[key] || key;
        requestBody[apiKey] = params[key];
      }
    });

    const response = await this.request("/v1/key-cards", {
      method: "POST",
      body: requestBody,
    });
    return new AccessCard(response);
  }

  // Alias for provision for backwards compatibility
  async issue(params) {
    return this.provision(params);
  }

  async get(params) {
    // Required parameter validation
    if (!params.cardId) throw new AccessGridError("card_id is required");

    const response = await this.request(`/v1/key-cards/${params.cardId}`);
    return new AccessCard(response);
  }

  async update(params) {
    // Required parameter validation
    if (!params.cardId) throw new AccessGridError("card_id is required");

    // Create empty request body
    const requestBody = {};

    // Map camelCase JS params to snake_case API params
    const paramMapping = {
      employeeId: "employee_id",
      fullName: "full_name",
      classification: "classification",
      expirationDate: "expiration_date",
      employeePhoto: "employee_photo",
      title: "title",
      organizationName: "organization_name",
      metadata: "metadata",
      // Hotel-specific parameters
      memberId: "member_id",
      membershipStatus: "membership_status",
      isPassReadyToTransact: "is_pass_ready_to_transact",
      tileData: "tile_data",
      reservations: "reservations",
    };

    // Add any params that exist to the request body
    Object.keys(params).forEach((key) => {
      if (
        key !== "cardId" &&
        params[key] !== undefined &&
        params[key] !== null
      ) {
        const apiKey = paramMapping[key] || key;
        requestBody[apiKey] = params[key];
      }
    });

    const response = await this.request(`/v1/key-cards/${params.cardId}`, {
      method: "PATCH",
      body: requestBody,
    });
    return new AccessCard(response);
  }

  async list(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.templateId) queryParams.append("template_id", params.templateId);
    if (params.state) queryParams.append("state", params.state);

    const response = await this.request(
      `/v1/key-cards?${queryParams.toString()}`,
    );
    return (response.keys || []).map((item) => new AccessCard(item));
  }

  async manage(cardId, action) {
    const response = await this.request(`/v1/key-cards/${cardId}/${action}`, {
      method: "POST",
    });
    return new AccessCard(response);
  }

  async suspend(params) {
    return this.manage(params.cardId, "suspend");
  }

  async resume(params) {
    return this.manage(params.cardId, "resume");
  }

  async unlink(params) {
    return this.manage(params.cardId, "unlink");
  }

  async delete(params) {
    return this.manage(params.cardId, "delete");
  }
}

// Enterprise Console API handling
class ConsoleApi extends BaseApi {
  constructor(accountId, secretKey, baseUrl) {
    super(accountId, secretKey, baseUrl);
    this.hid = {
      orgs: new HIDOrgsApi(accountId, secretKey, baseUrl),
    };
    this.webhooks = new WebhooksApi(accountId, secretKey, baseUrl);
    this.credentialProfiles = new CredentialProfilesApi(
      accountId,
      secretKey,
      baseUrl,
    );
  }

  _buildTemplateBody(params) {
    const paramMapping = {
      name: "name",
      platform: "platform",
      useCase: "use_case",
      protocol: "protocol",
      allowOnMultipleDevices: "allow_on_multiple_devices",
      watchCount: "watch_count",
      iphoneCount: "iphone_count",
      backgroundColor: "background_color",
      labelColor: "label_color",
      labelSecondaryColor: "label_secondary_color",
      supportUrl: "support_url",
      supportPhoneNumber: "support_phone_number",
      supportEmail: "support_email",
      privacyPolicyUrl: "privacy_policy_url",
      termsAndConditionsUrl: "terms_and_conditions_url",
      metadata: "metadata",
    };

    const body = {};
    for (const [jsKey, apiKey] of Object.entries(paramMapping)) {
      if (params[jsKey] !== undefined) {
        body[apiKey] = params[jsKey];
      }
    }
    return body;
  }

  async createTemplate(params) {
    const response = await this.request("/v1/console/card-templates", {
      method: "POST",
      body: this._buildTemplateBody(params),
    });
    return new Template(response);
  }

  async updateTemplate(params) {
    const body = this._buildTemplateBody(params);
    const response = await this.request(
      `/v1/console/card-templates/${params.cardTemplateId}`,
      {
        method: "PUT",
        body,
      },
    );
    return new Template(response);
  }

  async readTemplate(params) {
    const response = await this.request(
      `/v1/console/card-templates/${params.cardTemplateId}`,
    );
    return new Template(response);
  }

  async getEventLogs(params) {
    const queryParams = new URLSearchParams();
    if (params.filters) {
      if (params.filters.device)
        queryParams.append("filters[device]", params.filters.device);
      if (params.filters.startDate)
        queryParams.append("filters[start_date]", params.filters.startDate);
      if (params.filters.endDate)
        queryParams.append("filters[end_date]", params.filters.endDate);
      if (params.filters.eventType)
        queryParams.append("filters[event_type]", params.filters.eventType);
    }

    return this.request(
      `/v1/console/card-templates/${params.cardTemplateId}/logs?${queryParams}`,
    );
  }

  // Alias for getEventLogs for backwards compatibility
  async eventLog(params) {
    return this.getEventLogs(params);
  }

  async iosPreflight(params) {
    const body = {};
    if (params.accessPassExId) body.access_pass_ex_id = params.accessPassExId;

    const response = await this.request(
      `/v1/console/card-templates/${params.cardTemplateId}/ios_preflight`,
      { method: "POST", body },
    );

    return {
      provisioningCredentialIdentifier:
        response.provisioning_credential_identifier,
      sharingInstanceIdentifier: response.sharing_instance_identifier,
      cardTemplateIdentifier: response.card_template_identifier,
      environmentIdentifier: response.environment_identifier,
    };
  }

  async ledgerItems(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", params.page);
    if (params.perPage) queryParams.append("per_page", params.perPage);
    if (params.startDate) queryParams.append("start_date", params.startDate);
    if (params.endDate) queryParams.append("end_date", params.endDate);

    const queryString = queryParams.toString();
    const path = queryString
      ? `/v1/console/ledger-items?${queryString}`
      : "/v1/console/ledger-items";

    const response = await this.request(path);

    const result = {};
    if (response.ledger_items) {
      result.ledgerItems = response.ledger_items.map(
        (item) => new LedgerItem(item),
      );
    }
    if (response.pagination) {
      result.pagination = response.pagination;
    }
    return result;
  }

  async listPassTemplatePairs(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", params.page);
    if (params.perPage) queryParams.append("per_page", params.perPage);

    const queryString = queryParams.toString();
    const path = queryString
      ? `/v1/console/card-template-pairs?${queryString}`
      : "/v1/console/card-template-pairs";

    const response = await this.request(path);

    if (response.card_template_pairs) {
      response.passTemplatePairs = response.card_template_pairs.map(
        (pair) => new PassTemplatePair(pair),
      );
      delete response.card_template_pairs;
    }

    return response;
  }

  async createPassTemplatePair(params) {
    const body = {
      name: params.name,
      apple_card_template_id: params.appleCardTemplateId,
      google_card_template_id: params.googleCardTemplateId,
    };
    const response = await this.request("/v1/console/card-template-pairs", {
      method: "POST",
      body,
    });
    return new PassTemplatePair(response);
  }

  async listLandingPages() {
    const response = await this.request("/v1/console/landing-pages");
    const pages = Array.isArray(response) ? response : [];
    return pages.map((p) => new LandingPage(p));
  }

  async createLandingPage(params) {
    const paramMapping = {
      name: "name",
      kind: "kind",
      additionalText: "additional_text",
      bgColor: "bg_color",
      allowImmediateDownload: "allow_immediate_download",
      password: "password",
      is2faEnabled: "is_2fa_enabled",
      logo: "logo",
    };

    const body = {};
    for (const [jsKey, apiKey] of Object.entries(paramMapping)) {
      if (params[jsKey] !== undefined) {
        body[apiKey] = params[jsKey];
      }
    }

    const response = await this.request("/v1/console/landing-pages", {
      method: "POST",
      body,
    });
    return new LandingPage(response);
  }

  async updateLandingPage(params) {
    const paramMapping = {
      name: "name",
      additionalText: "additional_text",
      bgColor: "bg_color",
      allowImmediateDownload: "allow_immediate_download",
      password: "password",
      is2faEnabled: "is_2fa_enabled",
      logo: "logo",
    };

    const body = {};
    for (const [jsKey, apiKey] of Object.entries(paramMapping)) {
      if (params[jsKey] !== undefined) {
        body[apiKey] = params[jsKey];
      }
    }

    const response = await this.request(
      `/v1/console/landing-pages/${params.landingPageId}`,
      { method: "PUT", body },
    );
    return new LandingPage(response);
  }

  async listLedgerItems(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", params.page);
    if (params.perPage) queryParams.append("per_page", params.perPage);
    if (params.startDate) queryParams.append("start_date", params.startDate);
    if (params.endDate) queryParams.append("end_date", params.endDate);

    const queryString = queryParams.toString();
    const path = queryString
      ? `/v1/console/ledger-items?${queryString}`
      : "/v1/console/ledger-items";

    const response = await this.request(path);

    if (response.ledger_items) {
      response.ledgerItems = response.ledger_items.map(
        (item) => new LedgerItem(item),
      );
      delete response.ledger_items;
    }

    return response;
  }
}

// HID Orgs API handling
class HIDOrgsApi extends BaseApi {
  constructor(accountId, secretKey, baseUrl) {
    super(accountId, secretKey, baseUrl);
  }

  async create(params) {
    const body = {
      name: params.name,
      full_address: params.fullAddress,
      phone: params.phone,
      first_name: params.firstName,
      last_name: params.lastName,
    };

    const response = await this.request("/v1/console/hid/orgs", {
      method: "POST",
      body,
    });
    return new HIDOrg(response);
  }

  async list() {
    const response = await this.request("/v1/console/hid/orgs");
    const orgs = Array.isArray(response) ? response : response.hid_orgs || [];
    return orgs.map((org) => new HIDOrg(org));
  }

  async activate(params) {
    const response = await this.request("/v1/console/hid/orgs/activate", {
      method: "POST",
      body: {
        email: params.email,
        password: params.password,
      },
    });
    return new HIDOrg(response);
  }
}

// LandingPage model class
class LandingPage {
  constructor(data = {}) {
    this.id = data.id;
    this.name = data.name;
    this.createdAt = data.created_at;
    this.kind = data.kind;
    this.passwordProtected = data.password_protected;
    this.logoUrl = data.logo_url;
  }
}

// CredentialProfile model class
class CredentialProfile {
  constructor(data = {}) {
    this.id = data.id;
    this.aid = data.aid;
    this.name = data.name;
    this.appleId = data.apple_id;
    this.createdAt = data.created_at;
    this.cardStorage = data.card_storage;
    this.keys = data.keys || [];
    this.files = data.files || [];
  }
}

// Webhook model class
class Webhook {
  constructor(data = {}) {
    this.id = data.id;
    this.name = data.name;
    this.url = data.url;
    this.authMethod = data.auth_method;
    this.subscribedEvents = data.subscribed_events || [];
    this.createdAt = data.created_at;
    this.privateKey = data.private_key;
    this.clientCert = data.client_cert;
    this.certExpiresAt = data.cert_expires_at;
  }
}

// Webhooks API handling
class WebhooksApi extends BaseApi {
  constructor(accountId, secretKey, baseUrl) {
    super(accountId, secretKey, baseUrl);
  }

  async create(params) {
    const body = {
      name: params.name,
      url: params.url,
      subscribed_events: params.subscribedEvents,
    };
    if (params.authMethod) body.auth_method = params.authMethod;

    const response = await this.request("/v1/console/webhooks", {
      method: "POST",
      body,
    });
    return new Webhook(response);
  }

  async list() {
    const response = await this.request("/v1/console/webhooks");
    const webhooks = response.webhooks || [];
    return webhooks.map((w) => new Webhook(w));
  }

  async delete(webhookId) {
    await this.request(`/v1/console/webhooks/${webhookId}`, {
      method: "DELETE",
    });
  }
}

// Credential Profiles API handling
class CredentialProfilesApi extends BaseApi {
  constructor(accountId, secretKey, baseUrl) {
    super(accountId, secretKey, baseUrl);
  }

  async create(params) {
    const body = {
      name: params.name,
      app_name: params.appName,
      keys: params.keys,
    };
    if (params.fileId) body.file_id = params.fileId;

    const response = await this.request("/v1/console/credential-profiles", {
      method: "POST",
      body,
    });
    return new CredentialProfile(response);
  }

  async list() {
    const response = await this.request("/v1/console/credential-profiles");
    const profiles = Array.isArray(response) ? response : [];
    return profiles.map((p) => new CredentialProfile(p));
  }
}

// Main AccessGrid class
class AccessGrid {
  constructor(accountId, secretKey, options = {}) {
    if (!accountId) throw new Error("Account ID is required");
    if (!secretKey) throw new Error("Secret Key is required");

    const baseUrl = options.baseUrl || "https://api.accessgrid.com";

    this.accessCards = new AccessCardsApi(accountId, secretKey, baseUrl);
    this.console = new ConsoleApi(accountId, secretKey, baseUrl);
  }
}

// Export all the public classes
export {
  AccessGrid,
  AccessGridError,
  AuthenticationError,
  AccessCard,
  Template,
  PassTemplatePair,
  TemplateInfo,
  HIDOrg,
  LedgerItem,
  LedgerItemAccessPass,
  LedgerItemPassTemplate,
  LandingPage,
  CredentialProfile,
  Webhook,
};

// Default export
export default AccessGrid;
