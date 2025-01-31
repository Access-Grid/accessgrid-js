// Base API wrapper to handle common functionality
class BaseApi {
  constructor(accountId, secretKey, baseUrl = 'https://api.accessgrid.com') {
    this.accountId = accountId;
    this.secretKey = secretKey;
    this.baseUrl = baseUrl;
  }

  async request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const method = options.method || 'GET';
    
    try {
      // Prepare the request body and signature
      const body = options.body ? JSON.stringify(options.body) : '';
      const sigPayload = options.body ? body : options.sigPayload || '';
      const signature = await this._generateSignature(sigPayload);

      const headers = {
        'Content-Type': 'application/json',
        'X-ACCT-ID': this.accountId,
        'X-PAYLOAD-SIG': signature,
        ...(options.headers || {})
      };

      const response = await fetch(url, {
        method,
        headers,
        body: method !== 'GET' ? body : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Request failed');
      }

      return data;
    } catch (error) {
      throw new Error(`API request failed: ${error.message}`);
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
      throw new Error(`Failed to generate signature: ${error.message}`);
    }
  }
}

// Access Cards API handling
class AccessCardsApi extends BaseApi {
  constructor(accountId, secretKey, baseUrl) {
    super(accountId, secretKey, baseUrl);
  }

  async provision(params) {
    return this.request('/api/v1/nfc_keys/issue', {
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
  }

  async update(params) {
    return this.request(`/api/v1/nfc_keys/${params.cardId}`, {
      method: 'PUT',
      body: {
        employee_id: params.employeeId,
        full_name: params.fullName,
        classification: params.classification,
        expiration_date: params.expirationDate,
        employee_photo: params.employeePhoto
      }
    });
  }

  async manage(cardId, action) {
    return this.request(`/api/v1/nfc_keys/${cardId}/manage`, {
      method: 'POST',
      body: {
        manage_action: action
      }
    });
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
}

// Enterprise Console API handling
class ConsoleApi extends BaseApi {
  constructor(accountId, secretKey, baseUrl) {
    super(accountId, secretKey, baseUrl);
  }

  async createTemplate(params) {
    return this.request('/api/v1/enterprise/templates', {
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
  }

  async updateTemplate(params) {
    return this.request(`/api/v1/enterprise/templates/${params.cardTemplateId}`, {
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
  }

  async readTemplate(params) {
    return this.request(`/api/v1/enterprise/templates/${params.cardTemplateId}`);
  }

  async eventLog(params) {
    const queryParams = new URLSearchParams();
    if (params.filters) {
      if (params.filters.device) queryParams.append('filters[device]', params.filters.device);
      if (params.filters.startDate) queryParams.append('filters[start_date]', params.filters.startDate);
      if (params.filters.endDate) queryParams.append('filters[end_date]', params.filters.endDate);
      if (params.filters.eventType) queryParams.append('filters[event_type]', params.filters.eventType);
    }
    
    return this.request(`/api/v1/enterprise/templates/${params.cardTemplateId}/logs?${queryParams}`);
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

export default AccessGrid;