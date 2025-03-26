// AccessGrid Error classes
class AccessGridError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AccessGridError';
  }
}

class AuthenticationError extends AccessGridError {
  constructor(message = 'Invalid credentials') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

// AccessCard model class
class AccessCard {
  constructor(data = {}) {
    this.id = data.id;
    this.url = data.install_url;
    this.state = data.state;
    this.fullName = data.full_name;
    this.expirationDate = data.expiration_date;
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
  }
}

// Base API wrapper to handle common functionality
class BaseApi {
  constructor(accountId, secretKey, baseUrl = 'https://api.accessgrid.com') {
    this.accountId = accountId;
    this.secretKey = secretKey;
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash if present
    this.version = '1.1.0'; // Should come from package.json
  }

  async request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const method = options.method || 'GET';
    
    try {
      // Extract resource ID from the endpoint if needed for signature
      let resourceId = null;
      if (method === 'GET' || (method === 'POST' && (!options.body || Object.keys(options.body).length === 0))) {
        // Extract the ID from the endpoint - patterns like /resource/{id} or /resource/{id}/action
        const parts = path.split('/').filter(part => part);
        if (parts.length >= 2) {
          // For actions like unlink/suspend/resume, get the card ID (second to last part)
          if (['suspend', 'resume', 'unlink', 'delete'].includes(parts[parts.length - 1])) {
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

      if ((method === 'POST' && !options.body) || method === 'GET') {
        // For these requests, use {"id": "card_id"} as the payload for signature generation
        if (resourceId) {
          payload = JSON.stringify({ id: resourceId });
          sigPayload = payload;
        } else {
          payload = '{}';
          sigPayload = payload;
        }
      } else {
        // For normal POST/PUT/PATCH with body, use the actual payload
        payload = options.body ? JSON.stringify(options.body) : '';
        sigPayload = payload;
      }

      // Generate signature
      const signature = await this._generateSignature(sigPayload);

      // Prepare headers
      const headers = {
        'Content-Type': 'application/json',
        'X-ACCT-ID': this.accountId,
        'X-PAYLOAD-SIG': signature,
        'User-Agent': `accessgrid.js @ v${this.version}`,
        ...(options.headers || {})
      };

      // Handle query parameters for GET requests or POST with empty body
      let finalUrl = url;
      if (method === 'GET' || (method === 'POST' && !options.body)) {
        if (resourceId) {
          // Add sig_payload to query params
          const separator = finalUrl.includes('?') ? '&' : '?';
          finalUrl = `${finalUrl}${separator}sig_payload=${encodeURIComponent(JSON.stringify({ id: resourceId }))}`;
        }
      }

      // Make the request
      const response = await fetch(finalUrl, {
        method,
        headers,
        body: method !== 'GET' ? payload : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          throw new AuthenticationError();
        } else if (response.status === 402) {
          throw new AccessGridError('Insufficient account balance');
        } else {
          throw new AccessGridError(data.message || 'Request failed');
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
        'raw',
        encoder.encode(this.secretKey),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(encodedPayload)
      );

      // Convert to hex string
      return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    } catch (error) {
      throw new AccessGridError(`Failed to generate signature: ${error.message}`);
    }
  }
}

// Access Cards API handling
class AccessCardsApi extends BaseApi {
  constructor(accountId, secretKey, baseUrl) {
    super(accountId, secretKey, baseUrl);
  }

  async provision(params) {
    const response = await this.request('/v1/key-cards', {
      method: 'POST',
      body: {
        card_template_id: params.cardTemplateId,
        employee_id: params.employeeId,
        tag_id: params.tagId,
        allow_on_multiple_devices: params.allowOnMultipleDevices,
        full_name: params.fullName,
        email: params.email,
        phone_number: params.phoneNumber,
        classification: params.classification,
        start_date: params.startDate,
        expiration_date: params.expirationDate,
        employee_photo: params.employeePhoto
      }
    });
    return new AccessCard(response);
  }

  // Alias for provision for backwards compatibility
  async issue(params) {
    return this.provision(params);
  }

  async update(params) {
    const response = await this.request(`/v1/key-cards/${params.cardId}`, {
      method: 'PATCH',
      body: {
        employee_id: params.employeeId,
        full_name: params.fullName,
        classification: params.classification,
        expiration_date: params.expirationDate,
        employee_photo: params.employeePhoto
      }
    });
    return new AccessCard(response);
  }

  async list(templateId, state = null) {
    const params = new URLSearchParams({ template_id: templateId });
    if (state) {
      params.append('state', state);
    }
    
    const response = await this.request(`/v1/key-cards?${params.toString()}`);
    return (response.keys || []).map(item => new AccessCard(item));
  }

  async manage(cardId, action) {
    const response = await this.request(`/v1/key-cards/${cardId}/${action}`, {
      method: 'POST'
    });
    return new AccessCard(response);
  }

  async suspend(params) {
    return this.manage(params.cardId, 'suspend');
  }

  async resume(params) {
    return this.manage(params.cardId, 'resume');
  }

  async unlink(params) {
    return this.manage(params.cardId, 'unlink');
  }

  async delete(params) {
    return this.manage(params.cardId, 'delete');
  }
}

// Enterprise Console API handling
class ConsoleApi extends BaseApi {
  constructor(accountId, secretKey, baseUrl) {
    super(accountId, secretKey, baseUrl);
  }

  async createTemplate(params) {
    const response = await this.request('/v1/console/card-templates', {
      method: 'POST',
      body: {
        name: params.name,
        platform: params.platform,
        use_case: params.useCase,
        protocol: params.protocol,
        allow_on_multiple_devices: params.allowOnMultipleDevices,
        watch_count: params.watchCount,
        iphone_count: params.iphoneCount,
        background_color: params.design?.backgroundColor,
        label_color: params.design?.labelColor,
        label_secondary_color: params.design?.labelSecondaryColor,
        support_url: params.supportInfo?.supportUrl,
        support_phone_number: params.supportInfo?.supportPhoneNumber,
        support_email: params.supportInfo?.supportEmail,
        privacy_policy_url: params.supportInfo?.privacyPolicyUrl,
        terms_and_conditions_url: params.supportInfo?.termsAndConditionsUrl
      }
    });
    return new Template(response);
  }

  async updateTemplate(params) {
    const response = await this.request(`/v1/console/card-templates/${params.cardTemplateId}`, {
      method: 'PUT',
      body: {
        name: params.name,
        allow_on_multiple_devices: params.allowOnMultipleDevices,
        watch_count: params.watchCount,
        iphone_count: params.iphoneCount,
        support_url: params.supportInfo?.supportUrl,
        support_phone_number: params.supportInfo?.supportPhoneNumber,
        support_email: params.supportInfo?.supportEmail,
        privacy_policy_url: params.supportInfo?.privacyPolicyUrl,
        terms_and_conditions_url: params.supportInfo?.termsAndConditionsUrl
      }
    });
    return new Template(response);
  }

  async readTemplate(params) {
    const response = await this.request(`/v1/console/card-templates/${params.cardTemplateId}`);
    return new Template(response);
  }

  async getEventLogs(params) {
    const queryParams = new URLSearchParams();
    if (params.filters) {
      if (params.filters.device) queryParams.append('filters[device]', params.filters.device);
      if (params.filters.startDate) queryParams.append('filters[start_date]', params.filters.startDate);
      if (params.filters.endDate) queryParams.append('filters[end_date]', params.filters.endDate);
      if (params.filters.eventType) queryParams.append('filters[event_type]', params.filters.eventType);
    }
    
    return this.request(`/v1/console/card-templates/${params.cardTemplateId}/logs?${queryParams}`);
  }

  // Alias for getEventLogs for backwards compatibility
  async eventLog(params) {
    return this.getEventLogs(params);
  }
}

// Main AccessGrid class
class AccessGrid {
  constructor(accountId, secretKey, options = {}) {
    if (!accountId) throw new Error('Account ID is required');
    if (!secretKey) throw new Error('Secret Key is required');
    
    const baseUrl = options.baseUrl || 'https://api.accessgrid.com';
    
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
  Template
};

// Default export
export default AccessGrid;