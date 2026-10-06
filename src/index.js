import {
  AccessGridError,
  AuthenticationError,
  DecryptError,
  InvalidEnvelopeError,
} from "./errors.js";
import {
  generateKeypair as generateRevealKeypair,
  decryptEnvelope as decryptRevealEnvelope,
} from "./smart_tap_reveal_crypto.js";

// Aliro Access Data Elements are CSA Aliro 1.0 §7.3 structures: the keys inside
// accessData are the spec's integer labels ("0" is Version, "3" is Schedules),
// not SDK vocabulary. So only the element wrapper is translated between
// accessData and access_data; everything below it passes through untouched.
//
// A non-array is left alone so the server's own validation message reaches the
// caller rather than a TypeError from here.
const mapAliroElements = (elements, accessDataKey) => {
  if (!Array.isArray(elements)) return elements;

  return elements.map(({ identifier, accessData, access_data }) => ({
    identifier,
    [accessDataKey]: accessData ?? access_data,
  }));
};

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
    this.aliroAccessDataElements = data.aliro_access_data_elements
      ? mapAliroElements(data.aliro_access_data_elements, "accessData")
      : undefined;
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
    // Returned only on Aliro templates, as the ids of the attached records.
    this.aliroIssuerKey = data.aliro_issuer_key;
    this.aliroReaderGroup = data.aliro_reader_group;

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

// Result of publishing a card template.
class PublishTemplateResponse {
  constructor(data = {}) {
    this.id = data.id;
    this.status = data.status;
  }
}

// Result of a SmartTap private key reveal. privateKey is the plaintext PEM,
// decrypted client-side by the SDK. The encrypted envelope is consumed
// internally and not exposed.
class RevealTemplatePrivateKey {
  constructor(data = {}) {
    this.keyVersion = data.key_version;
    this.collectorId = data.collector_id;
    this.fingerprint = data.fingerprint;
    this.privateKey = data.private_key;
  }
}

// Base API wrapper to handle common functionality
class BaseApi {
  constructor(accountId, secretKey, baseUrl = "https://api.accessgrid.com") {
    this.accountId = accountId;
    this.secretKey = secretKey;
    this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash if present
    this.version = "1.6.0-preview.3"; // Should come from package.json
  }

  async request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const method = options.method || "GET";

    try {
      // Extract resource ID from the endpoint if needed for signature
      let resourceId = null;
      if (
        method === "GET" ||
        method === "DELETE" ||
        (method === "POST" &&
          (!options.body || Object.keys(options.body).length === 0))
      ) {
        // Extract the ID from the endpoint - patterns like /resource/{id} or /resource/{id}/action
        const parts = path.split("/").filter((part) => part);
        if (parts.length >= 2) {
          // For actions like unlink/suspend/resume, get the card ID (second to last part)
          if (
            [
              "suspend",
              "resume",
              "unlink",
              "delete",
              "publish",
              "verify",
            ].includes(parts[parts.length - 1])
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

      if (
        (method === "POST" && !options.body) ||
        method === "GET" ||
        method === "DELETE"
      ) {
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
      if (
        method === "GET" ||
        method === "DELETE" ||
        (method === "POST" && !options.body)
      ) {
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

      // Handle empty responses (204 No Content)
      let data = {};
      if (response.status !== 204) {
        data = await response.json();
      }

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
      // Multi-family / residential parameters
      propertyName: "property_name",
      propertyAddress: "property_address",
      buildingName: "building_name",
      storageUnit: "storage_unit",
      parkingAddress: "parking_address",
      barcodeData: "barcode_data",
      unitNumbers: "unit_numbers",
      parkingDetails: "parking_details",
      // Aliro
      aliroAccessDataElements: "aliro_access_data_elements",
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

    // Runs after the loop so it catches the elements whether they arrived as
    // aliroAccessDataElements or under the wire name.
    if (requestBody.aliro_access_data_elements) {
      requestBody.aliro_access_data_elements = mapAliroElements(
        requestBody.aliro_access_data_elements,
        "access_data",
      );
    }

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
      // Multi-family / residential parameters
      propertyName: "property_name",
      propertyAddress: "property_address",
      buildingName: "building_name",
      storageUnit: "storage_unit",
      parkingAddress: "parking_address",
      barcodeData: "barcode_data",
      unitNumbers: "unit_numbers",
      parkingDetails: "parking_details",
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

// Aliro signing configurations and their issuer keys.
class AliroConfigurationsApi extends BaseApi {
  constructor(accountId, secretKey, baseUrl) {
    super(accountId, secretKey, baseUrl);
  }

  async list() {
    const response = await this.request("/v1/console/aliro-configurations");
    const configurations = Array.isArray(response) ? response : [];
    return configurations.map((c) => new AliroConfiguration(c));
  }

  async create(params) {
    const response = await this.request("/v1/console/aliro-configurations", {
      method: "POST",
      body: {
        name: params.name,
        signing_url: params.signingUrl,
        bearer_token: params.bearerToken,
      },
    });
    return new AliroConfiguration(response);
  }

  // Register an issuer key against a configuration.
  async createKey(params) {
    const body = {
      name: params.name,
      public_key: params.publicKey,
    };
    if (params.certificate) body.certificate = params.certificate;

    const response = await this.request(
      `/v1/console/aliro-configurations/${params.configurationId}/keys`,
      { method: "POST", body },
    );
    return new AliroIssuerKey(response);
  }
}

// Aliro reader groups.
class AliroReaderGroupsApi extends BaseApi {
  constructor(accountId, secretKey, baseUrl) {
    super(accountId, secretKey, baseUrl);
  }

  async list() {
    const response = await this.request("/v1/console/aliro-reader-groups");
    const groups = Array.isArray(response) ? response : [];
    return groups.map((g) => new AliroReaderGroup(g));
  }

  async create(params) {
    const body = {
      name: params.name,
      reader_group_identifier: params.readerGroupIdentifier,
      reader_ca_public_key: params.readerCaPublicKey,
    };
    // The server defaults this to 1, so only send it when asked for.
    if (params.readerCaMaxDepth !== undefined) {
      body.reader_ca_max_depth = params.readerCaMaxDepth;
    }

    const response = await this.request("/v1/console/aliro-reader-groups", {
      method: "POST",
      body,
    });
    return new AliroReaderGroup(response);
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
    this.aliroConfigurations = new AliroConfigurationsApi(
      accountId,
      secretKey,
      baseUrl,
    );
    this.aliroReaderGroups = new AliroReaderGroupsApi(
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
      logo: "logo",
      metadata: "metadata",
      aliroIssuerKey: "aliro_issuer_key",
      aliroReaderGroup: "aliro_reader_group",
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

  async publishTemplate(params) {
    const response = await this.request(
      `/v1/console/card-templates/${params.cardTemplateId}/publish`,
      { method: "POST" },
    );
    return new PublishTemplateResponse(response);
  }

  // Delete a card template.
  async deleteTemplate(cardTemplateId) {
    await this.request(`/v1/console/card-templates/${cardTemplateId}`, {
      method: "DELETE",
    });
  }

  // Reveal the SmartTap private key for a card template, decrypted client-side.
  //
  // The SDK generates a fresh ephemeral P-256 keypair per call, submits the
  // public half, and decrypts the server's response. The returned
  // RevealTemplatePrivateKey carries the plaintext PEM in .privateKey;
  // the encrypted envelope is consumed internally and not exposed.
  async revealSmartTap(params) {
    const { publicKeyPem, privateKey } = await generateRevealKeypair();
    const response = await this.request(
      `/v1/console/card-templates/${params.cardTemplateId}/smart-tap/reveal`,
      { method: "POST", body: { client_public_key: publicKeyPem } },
    );
    const plaintext = await decryptRevealEnvelope(
      response.encrypted_private_key,
      privateKey,
    );
    return new RevealTemplatePrivateKey({
      ...response,
      private_key: plaintext,
    });
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
        response.provisioningCredentialIdentifier ||
        response.provisioning_credential_identifier,
      sharingInstanceIdentifier:
        response.sharingInstanceIdentifier ||
        response.sharing_instance_identifier,
      cardTemplateIdentifier:
        response.cardTemplateIdentifier || response.card_template_identifier,
      environmentIdentifier:
        response.environmentIdentifier || response.environment_identifier,
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

// An Aliro issuer key. Keys are append-only on the server: registered once
// and retired, never edited. The certificate is write-only and never returned.
class AliroIssuerKey {
  constructor(data = {}) {
    this.id = data.id;
    this.name = data.name;
    this.kid = data.kid;
    this.publicKey = data.public_key;
    this.createdAt = data.created_at;
  }
}

// A group of readers a credential is allowed to talk to. The CA public key is
// what the device verifies a reader's certificate against at the door.
class AliroReaderGroup {
  constructor(data = {}) {
    this.id = data.id;
    this.name = data.name;
    this.readerGroupIdentifier = data.reader_group_identifier;
    this.readerCaPublicKey = data.reader_ca_public_key;
    this.readerCaMaxDepth = data.reader_ca_max_depth;
    this.createdAt = data.created_at;
  }
}

// An Aliro signing configuration. bearerToken is write-only: the server never
// returns it, so there is no field for it here.
class AliroConfiguration {
  constructor(data = {}) {
    this.id = data.id;
    this.name = data.name;
    this.signingUrl = data.signing_url;
    this.issuerKeys = (data.issuer_keys || []).map(
      (k) => new AliroIssuerKey(k),
    );
    this.createdAt = data.created_at;
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

// Result of a webhook verification.
class WebhookVerification {
  constructor(data = {}) {
    this.id = data.id;
    this.verified = data.verified;
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

  // Verify a webhook.
  async verify(webhookId) {
    const response = await this.request(
      `/v1/console/webhooks/${webhookId}/verify`,
      { method: "POST" },
    );
    return new WebhookVerification(response);
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

  // Delete a credential profile.
  async delete(credentialProfileId) {
    await this.request(
      `/v1/console/credential-profiles/${credentialProfileId}`,
      { method: "DELETE" },
    );
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
  DecryptError,
  InvalidEnvelopeError,
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
  AliroConfiguration,
  AliroIssuerKey,
  AliroReaderGroup,
  Webhook,
  WebhookVerification,
  PublishTemplateResponse,
  RevealTemplatePrivateKey,
};

// Default export
export default AccessGrid;
