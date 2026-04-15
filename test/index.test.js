import AccessGrid, { AccessGridError, AuthenticationError, AccessCard, Template, PassTemplatePair, TemplateInfo, HIDOrg, LedgerItem, LedgerItemAccessPass, LedgerItemPassTemplate, LandingPage, CredentialProfile, Webhook } from '../src/index';

// ══════════════════════════════════════════════════════════════════════════════
// Global mocks
// ══════════════════════════════════════════════════════════════════════════════

global.fetch = jest.fn();
global.crypto = {
  subtle: {
    importKey: jest.fn(),
    sign: jest.fn()
  }
};
global.TextEncoder = jest.fn(() => ({
  encode: jest.fn()
}));
global.btoa = jest.fn(str => Buffer.from(str).toString('base64'));

describe('AccessGrid SDK', () => {
  let client;
  const mockAccountId = 'test-account-id';
  const mockSecretKey = 'test-secret-key';

  beforeEach(() => {
    client = new AccessGrid(mockAccountId, mockSecretKey);
    jest.clearAllMocks();

    global.crypto.subtle.importKey.mockResolvedValue('mockKey');
    global.crypto.subtle.sign.mockResolvedValue(new Uint8Array([1, 2, 3]));

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'mock-id',
        install_url: 'https://example.com/install',
        state: 'active',
        full_name: 'Test User'
      })
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Constructor
  // ════════════════════════════════════════════════════════════════════════════

  describe('Constructor', () => {
    test('should throw error if accountId is missing', () => {
      expect(() => new AccessGrid()).toThrow('Account ID is required');
    });

    test('should throw error if secretKey is missing', () => {
      expect(() => new AccessGrid(mockAccountId)).toThrow('Secret Key is required');
    });

    test('should create instance with custom baseUrl', () => {
      const customClient = new AccessGrid(mockAccountId, mockSecretKey, {
        baseUrl: 'https://custom.api.com'
      });
      expect(customClient).toBeInstanceOf(AccessGrid);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Error handling
  // ════════════════════════════════════════════════════════════════════════════

  describe('Error Handling', () => {
    test('should throw AuthenticationError on 401', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Invalid credentials' })
      });

      await expect(client.accessCards.provision({
        cardTemplateId: '123',
        fullName: 'Test User',
        startDate: '2025-01-01T00:00:00Z',
        expirationDate: '2025-12-31T00:00:00Z'
      }))
        .rejects
        .toThrow(AuthenticationError);
    });

    test('should throw AccessGridError with message on 402', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 402,
        json: () => Promise.resolve({ message: 'Insufficient account balance' })
      });

      await expect(client.accessCards.provision({
        cardTemplateId: '123',
        fullName: 'Test User',
        startDate: '2025-01-01T00:00:00Z',
        expirationDate: '2025-12-31T00:00:00Z'
      }))
        .rejects
        .toThrow('Insufficient account balance');
    });

    test('should throw AccessGridError on other errors', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'Invalid input' })
      });

      await expect(client.accessCards.provision({
        cardTemplateId: '123',
        fullName: 'Test User',
        startDate: '2025-01-01T00:00:00Z',
        expirationDate: '2025-12-31T00:00:00Z'
      }))
        .rejects
        .toThrow(AccessGridError);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // AccessCards API
  // ════════════════════════════════════════════════════════════════════════════

  describe('AccessCards API', () => {
    describe('provision', () => {
      const mockProvisionParams = {
        cardTemplateId: '0xd3adb00b5',
        employeeId: '123456789',
        tagId: 'DDEADB33FB00B5',
        fullName: 'Employee name',
        email: 'employee@yourwebsite.com',
        phoneNumber: '+19547212241',
        classification: 'full_time',
        startDate: '2025-01-31T22:46:25.601Z',
        expirationDate: '2025-04-30T22:46:25.601Z',
        employeePhoto: 'base64photo'
      };

      test('should make correct API call for provisioning', async () => {
        await client.accessCards.provision(mockProvisionParams);

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/v1/key-cards'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              'X-ACCT-ID': mockAccountId,
              'X-PAYLOAD-SIG': expect.any(String),
              'User-Agent': expect.stringMatching(/accessgrid\.js/)
            })
          })
        );
      });

      test('should return an AccessCard instance', async () => {
        const result = await client.accessCards.provision(mockProvisionParams);
        expect(result).toBeInstanceOf(AccessCard);
        expect(result.id).toBe('mock-id');
      });
    });

    describe('issue', () => {
      test('issue is an alias for provision', async () => {
        const spy = jest.spyOn(client.accessCards, 'provision');
        const params = {
          cardTemplateId: '123',
          fullName: 'Test User',
          startDate: '2025-01-01T00:00:00Z',
          expirationDate: '2025-12-31T00:00:00Z'
        };
        await client.accessCards.issue(params);
        expect(spy).toHaveBeenCalledWith(params);
      });
    });

    describe('get', () => {
      const mockCardId = '0xc4rd1d';

      test('should make correct API call', async () => {
        await client.accessCards.get({ cardId: mockCardId });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/v1/key-cards/${mockCardId}`),
          expect.objectContaining({
            method: 'GET'
          })
        );
      });

      test('should return an AccessCard instance', async () => {
        const result = await client.accessCards.get({ cardId: mockCardId });
        expect(result).toBeInstanceOf(AccessCard);
        expect(result.id).toBe('mock-id');
      });

      test('should throw when cardId is missing', async () => {
        await expect(client.accessCards.get({}))
          .rejects
          .toThrow('card_id is required');
      });
    });

    describe('update', () => {
      const mockUpdateParams = {
        cardId: '0xc4rd1d',
        employeeId: '987654321',
        fullName: 'Updated Employee Name',
        classification: 'contractor',
        expirationDate: '2025-02-22T21:04:03.664Z'
      };

      test('should make correct API call for updating', async () => {
        await client.accessCards.update(mockUpdateParams);

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/v1/key-cards/${mockUpdateParams.cardId}`),
          expect.objectContaining({
            method: 'PATCH',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              'X-ACCT-ID': mockAccountId
            })
          })
        );
      });
    });

    describe('list', () => {
      test('should accept object params with templateId', async () => {
        const templateId = '0xtemplate';
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ keys: [{ id: '1' }, { id: '2' }] })
        });

        const result = await client.accessCards.list({ templateId });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/v1/key-cards?template_id=${templateId}`),
          expect.anything()
        );
        expect(result).toHaveLength(2);
        expect(result[0]).toBeInstanceOf(AccessCard);
      });

      test('should filter by state with object params', async () => {
        const templateId = '0xtemplate';
        const state = 'active';
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ keys: [{ id: '1' }] })
        });

        await client.accessCards.list({ templateId, state });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(`template_id=${templateId}`),
          expect.anything()
        );
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(`state=${state}`),
          expect.anything()
        );
      });

      test('should filter by state only', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ keys: [{ id: '1' }] })
        });

        await client.accessCards.list({ state: 'active' });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('state=active'),
          expect.anything()
        );
      });
    });

    describe('manage operations', () => {
      const mockCardId = '0xc4rd1d';

      test('should make correct API call for suspend', async () => {
        await client.accessCards.suspend({ cardId: mockCardId });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/v1/key-cards/${mockCardId}/suspend`),
          expect.objectContaining({
            method: 'POST'
          })
        );
      });

      test('should make correct API call for resume', async () => {
        await client.accessCards.resume({ cardId: mockCardId });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/v1/key-cards/${mockCardId}/resume`),
          expect.objectContaining({
            method: 'POST'
          })
        );
      });

      test('should make correct API call for unlink', async () => {
        await client.accessCards.unlink({ cardId: mockCardId });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/v1/key-cards/${mockCardId}/unlink`),
          expect.objectContaining({
            method: 'POST'
          })
        );
      });

      test('should make correct API call for delete', async () => {
        await client.accessCards.delete({ cardId: mockCardId });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/v1/key-cards/${mockCardId}/delete`),
          expect.objectContaining({
            method: 'POST'
          })
        );
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Console API
  // ════════════════════════════════════════════════════════════════════════════

  describe('Console API', () => {
    describe('createTemplate', () => {
      const mockTemplateParams = {
        name: 'Employee Access Pass',
        platform: 'apple',
        useCase: 'employee_badge',
        protocol: 'desfire',
        allowOnMultipleDevices: true,
        watchCount: 2,
        iphoneCount: 3,
        backgroundColor: '#FFFFFF',
        labelColor: '#000000',
        labelSecondaryColor: '#333333',
        supportUrl: 'https://help.yourcompany.com',
        supportPhoneNumber: '+1-555-123-4567',
        supportEmail: 'support@yourcompany.com',
        privacyPolicyUrl: 'https://yourcompany.com/privacy',
        termsAndConditionsUrl: 'https://yourcompany.com/terms',
        metadata: { version: '2.1', approvalStatus: 'approved' }
      };

      test('should make correct API call for creating template', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'template-123',
            name: 'Employee Access Pass'
          })
        });

        const result = await client.console.createTemplate(mockTemplateParams);

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/v1/console/card-templates'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              'X-ACCT-ID': mockAccountId
            })
          })
        );
        expect(result).toBeInstanceOf(Template);
      });

      test('should send flat params as snake_case in body', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'template-123' })
        });

        await client.console.createTemplate(mockTemplateParams);

        const callBody = JSON.parse(fetch.mock.calls[0][1].body);
        expect(callBody.name).toBe('Employee Access Pass');
        expect(callBody.platform).toBe('apple');
        expect(callBody.use_case).toBe('employee_badge');
        expect(callBody.protocol).toBe('desfire');
        expect(callBody.allow_on_multiple_devices).toBe(true);
        expect(callBody.watch_count).toBe(2);
        expect(callBody.iphone_count).toBe(3);
        expect(callBody.background_color).toBe('#FFFFFF');
        expect(callBody.label_color).toBe('#000000');
        expect(callBody.label_secondary_color).toBe('#333333');
        expect(callBody.support_url).toBe('https://help.yourcompany.com');
        expect(callBody.support_phone_number).toBe('+1-555-123-4567');
        expect(callBody.support_email).toBe('support@yourcompany.com');
        expect(callBody.privacy_policy_url).toBe('https://yourcompany.com/privacy');
        expect(callBody.terms_and_conditions_url).toBe('https://yourcompany.com/terms');
        expect(callBody.metadata).toEqual({ version: '2.1', approvalStatus: 'approved' });
      });
    });

    describe('updateTemplate', () => {
      const mockTemplateId = '0xt3mpl4t3';
      const mockUpdateParams = {
        cardTemplateId: mockTemplateId,
        name: 'Updated Badge',
        allowOnMultipleDevices: false,
        watchCount: 1,
        iphoneCount: 2,
        backgroundColor: '#FFFFFF',
        labelColor: '#000000',
        labelSecondaryColor: '#333333',
        supportUrl: 'https://help.example.com',
        supportPhoneNumber: '+1-555-999-0000',
        supportEmail: 'help@example.com',
        privacyPolicyUrl: 'https://example.com/privacy',
        termsAndConditionsUrl: 'https://example.com/terms',
        metadata: { version: '2.2', lastUpdatedBy: 'admin' }
      };

      test('should make correct API call with PUT', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: mockTemplateId, name: 'Updated Badge' })
        });

        await client.console.updateTemplate(mockUpdateParams);

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/v1/console/card-templates/${mockTemplateId}`),
          expect.objectContaining({
            method: 'PUT',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              'X-ACCT-ID': mockAccountId
            })
          })
        );
      });

      test('should map camelCase params to snake_case body', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: mockTemplateId })
        });

        await client.console.updateTemplate(mockUpdateParams);

        const callBody = JSON.parse(fetch.mock.calls[0][1].body);
        expect(callBody.name).toBe('Updated Badge');
        expect(callBody.allow_on_multiple_devices).toBe(false);
        expect(callBody.watch_count).toBe(1);
        expect(callBody.iphone_count).toBe(2);
        expect(callBody.background_color).toBe('#FFFFFF');
        expect(callBody.label_color).toBe('#000000');
        expect(callBody.label_secondary_color).toBe('#333333');
        expect(callBody.support_url).toBe('https://help.example.com');
        expect(callBody.support_phone_number).toBe('+1-555-999-0000');
        expect(callBody.support_email).toBe('help@example.com');
        expect(callBody.privacy_policy_url).toBe('https://example.com/privacy');
        expect(callBody.terms_and_conditions_url).toBe('https://example.com/terms');
        expect(callBody.metadata).toEqual({ version: '2.2', lastUpdatedBy: 'admin' });
      });

      test('should return a Template instance', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: mockTemplateId, name: 'Updated Badge' })
        });

        const result = await client.console.updateTemplate(mockUpdateParams);
        expect(result).toBeInstanceOf(Template);
        expect(result.id).toBe(mockTemplateId);
      });
    });

    describe('readTemplate', () => {
      const mockTemplateId = '0xd3adb00b5';

      test('should make correct API call for reading template', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: mockTemplateId,
            name: 'Test Template'
          })
        });

        const result = await client.console.readTemplate({ cardTemplateId: mockTemplateId });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/v1/console/card-templates/${mockTemplateId}`),
          expect.objectContaining({
            method: 'GET',
            headers: expect.objectContaining({
              'X-ACCT-ID': mockAccountId
            })
          })
        );
        expect(result).toBeInstanceOf(Template);
      });
    });

    describe('getEventLogs', () => {
      const mockEventParams = {
        cardTemplateId: '0xd3adb00b5',
        filters: {
          device: 'mobile',
          startDate: '2025-01-01T00:00:00Z',
          endDate: '2025-02-01T00:00:00Z',
          eventType: 'install'
        }
      };

      test('should make correct API call for event logs', async () => {
        await client.console.getEventLogs(mockEventParams);

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/v1/console/card-templates/${mockEventParams.cardTemplateId}/logs`),
          expect.objectContaining({
            method: 'GET',
            headers: expect.objectContaining({
              'X-ACCT-ID': mockAccountId
            })
          })
        );
      });

      test('should properly encode query parameters', async () => {
        await client.console.getEventLogs(mockEventParams);

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('filters%5Bdevice%5D=mobile'),
          expect.any(Object)
        );
      });

      test('eventLog is an alias for getEventLogs', async () => {
        const spy = jest.spyOn(client.console, 'getEventLogs');
        await client.console.eventLog(mockEventParams);
        expect(spy).toHaveBeenCalledWith(mockEventParams);
      });
    });

    describe('listPassTemplatePairs', () => {
      const mockPairsResponse = {
        card_template_pairs: [
          {
            id: 'pair-1',
            ex_id: 'pair-1',
            name: 'Employee Badge Pair',
            created_at: '2025-01-15T00:00:00Z',
            ios_template: { id: 'ios-1', ex_id: 'ios-1', name: 'iOS Badge', platform: 'apple' },
            android_template: { id: 'android-1', ex_id: 'android-1', name: 'Android Badge', platform: 'google' }
          },
          {
            id: 'pair-2',
            ex_id: 'pair-2',
            name: 'Visitor Pass Pair',
            created_at: '2025-02-01T00:00:00Z',
            ios_template: { id: 'ios-2', ex_id: 'ios-2', name: 'iOS Visitor', platform: 'apple' },
            android_template: null
          }
        ]
      };

      test('should make correct API call', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockPairsResponse)
        });

        await client.console.listPassTemplatePairs();

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/v1/console/card-template-pairs'),
          expect.objectContaining({
            method: 'GET'
          })
        );
      });

      test('should pass pagination params', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockPairsResponse)
        });

        await client.console.listPassTemplatePairs({ page: 2, perPage: 10 });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('page=2'),
          expect.anything()
        );
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('per_page=10'),
          expect.anything()
        );
      });

      test('should not include query string when no params given', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockPairsResponse)
        });

        await client.console.listPassTemplatePairs();

        const calledUrl = fetch.mock.calls[0][0];
        expect(calledUrl).toMatch(/\/card-template-pairs(\?sig_payload=|$)/);
      });

      test('should return PassTemplatePair instances', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockPairsResponse)
        });

        const result = await client.console.listPassTemplatePairs();

        expect(result.passTemplatePairs).toHaveLength(2);
        expect(result.passTemplatePairs[0]).toBeInstanceOf(PassTemplatePair);
        expect(result.passTemplatePairs[1]).toBeInstanceOf(PassTemplatePair);
      });

      test('should remove snake_case key from response', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockPairsResponse)
        });

        const result = await client.console.listPassTemplatePairs();

        expect(result.card_template_pairs).toBeUndefined();
      });

      test('should deserialize nested TemplateInfo models with ex_id', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockPairsResponse)
        });

        const result = await client.console.listPassTemplatePairs();
        const pair = result.passTemplatePairs[0];

        expect(pair.id).toBe('pair-1');
        expect(pair.exId).toBe('pair-1');
        expect(pair.name).toBe('Employee Badge Pair');
        expect(pair.createdAt).toBe('2025-01-15T00:00:00Z');
        expect(pair.iosTemplate).toBeInstanceOf(TemplateInfo);
        expect(pair.iosTemplate.id).toBe('ios-1');
        expect(pair.iosTemplate.exId).toBe('ios-1');
        expect(pair.iosTemplate.platform).toBe('apple');
        expect(pair.androidTemplate).toBeInstanceOf(TemplateInfo);
        expect(pair.androidTemplate.id).toBe('android-1');
        expect(pair.androidTemplate.platform).toBe('google');
      });

      test('should handle null template in a pair', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockPairsResponse)
        });

        const result = await client.console.listPassTemplatePairs();
        const pair = result.passTemplatePairs[1];

        expect(pair.iosTemplate).toBeInstanceOf(TemplateInfo);
        expect(pair.androidTemplate).toBeNull();
      });
    });

    describe('createPassTemplatePair', () => {
      const mockPairResponse = {
        id: 'pair_new',
        ex_id: 'pair_new',
        name: 'New Badge Pair',
        created_at: '2026-04-15T12:00:00Z',
        ios_template: { id: 'tmpl_ios', ex_id: 'tmpl_ios', name: 'iOS Badge', platform: 'apple' },
        android_template: { id: 'tmpl_android', ex_id: 'tmpl_android', name: 'Android Badge', platform: 'android' }
      };

      test('should POST to /v1/console/card-template-pairs with snake_case body', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockPairResponse)
        });

        const pair = await client.console.createPassTemplatePair({
          name: 'New Badge Pair',
          appleCardTemplateId: 'tmpl_ios',
          googleCardTemplateId: 'tmpl_android'
        });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/v1/console/card-template-pairs'),
          expect.objectContaining({ method: 'POST' })
        );

        const call = fetch.mock.calls[0][1];
        const body = JSON.parse(call.body);
        expect(body.name).toBe('New Badge Pair');
        expect(body.apple_card_template_id).toBe('tmpl_ios');
        expect(body.google_card_template_id).toBe('tmpl_android');

        expect(pair).toBeInstanceOf(PassTemplatePair);
        expect(pair.id).toBe('pair_new');
        expect(pair.exId).toBe('pair_new');
        expect(pair.iosTemplate.platform).toBe('apple');
        expect(pair.androidTemplate.platform).toBe('android');
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Models
  // ════════════════════════════════════════════════════════════════════════════

  describe('Model classes', () => {
    test('AccessCard should have correct properties', () => {
      const card = new AccessCard({
        id: 'card-123',
        install_url: 'https://example.com/install',
        state: 'active',
        full_name: 'Test User',
        expiration_date: '2025-01-01'
      });

      expect(card.id).toBe('card-123');
      expect(card.url).toBe('https://example.com/install');
      expect(card.state).toBe('active');
      expect(card.fullName).toBe('Test User');
      expect(card.expirationDate).toBe('2025-01-01');
      expect(card.toString()).toMatch(/Test User/);
    });

    test('Template should have correct properties', () => {
      const template = new Template({
        id: 'template-123',
        name: 'Test Template',
        platform: 'apple',
        use_case: 'employee_badge',
        protocol: 'desfire',
        created_at: '2025-01-01',
        last_published_at: '2025-01-02',
        issued_keys_count: 10,
        active_keys_count: 8
      });

      expect(template.id).toBe('template-123');
      expect(template.name).toBe('Test Template');
      expect(template.platform).toBe('apple');
      expect(template.useCase).toBe('employee_badge');
      expect(template.createdAt).toBe('2025-01-01');
      expect(template.issuedKeysCount).toBe(10);
      expect(template.activeKeysCount).toBe(8);
    });

    test('PassTemplatePair should have correct properties', () => {
      const pair = new PassTemplatePair({
        id: 'pair-1',
        name: 'Badge Pair',
        created_at: '2025-03-01T00:00:00Z',
        ios_template: { id: 'ios-1', name: 'iOS Badge', platform: 'apple' },
        android_template: { id: 'android-1', name: 'Android Badge', platform: 'google' }
      });

      expect(pair.id).toBe('pair-1');
      expect(pair.name).toBe('Badge Pair');
      expect(pair.createdAt).toBe('2025-03-01T00:00:00Z');
      expect(pair.iosTemplate).toBeInstanceOf(TemplateInfo);
      expect(pair.androidTemplate).toBeInstanceOf(TemplateInfo);
    });

    test('PassTemplatePair handles missing templates', () => {
      const pair = new PassTemplatePair({
        id: 'pair-2',
        name: 'iOS Only',
        created_at: '2025-03-01T00:00:00Z'
      });

      expect(pair.iosTemplate).toBeNull();
      expect(pair.androidTemplate).toBeNull();
    });

    test('TemplateInfo should have correct properties', () => {
      const info = new TemplateInfo({
        id: 'tmpl-1',
        name: 'Employee Badge',
        platform: 'apple'
      });

      expect(info.id).toBe('tmpl-1');
      expect(info.name).toBe('Employee Badge');
      expect(info.platform).toBe('apple');
    });

    test('HIDOrg should have correct properties', () => {
      const org = new HIDOrg({
        id: 'org-1',
        name: 'My Org',
        slug: 'my-org',
        first_name: 'Ada',
        last_name: 'Lovelace',
        phone: '+1-555-0000',
        full_address: '1 Main St, NY NY',
        status: 'active',
        created_at: '2025-01-01T00:00:00Z'
      });

      expect(org.id).toBe('org-1');
      expect(org.name).toBe('My Org');
      expect(org.slug).toBe('my-org');
      expect(org.firstName).toBe('Ada');
      expect(org.lastName).toBe('Lovelace');
      expect(org.phone).toBe('+1-555-0000');
      expect(org.fullAddress).toBe('1 Main St, NY NY');
      expect(org.status).toBe('active');
      expect(org.createdAt).toBe('2025-01-01T00:00:00Z');
    });

    test('LedgerItem should deserialize with nested access pass and template', () => {
      const item = new LedgerItem({
        id: 'li-1',
        created_at: '2025-03-01T00:00:00Z',
        amount: 150,
        kind: 'provision',
        metadata: { note: 'test' },
        access_pass: {
          id: 'ap-1',
          full_name: 'Jane Doe',
          state: 'active',
          metadata: { dept: 'eng' },
          unified_access_pass_ex_id: 'uap-1',
          pass_template: {
            id: 'pt-1',
            name: 'Employee Badge',
            protocol: 'desfire',
            platform: 'apple',
            use_case: 'employee_badge'
          }
        }
      });

      expect(item.id).toBe('li-1');
      expect(item.createdAt).toBe('2025-03-01T00:00:00Z');
      expect(item.amount).toBe(150);
      expect(item.kind).toBe('provision');
      expect(item.metadata).toEqual({ note: 'test' });
      expect(item.accessPass).toBeInstanceOf(LedgerItemAccessPass);
      expect(item.accessPass.id).toBe('ap-1');
      expect(item.accessPass.fullName).toBe('Jane Doe');
      expect(item.accessPass.state).toBe('active');
      expect(item.accessPass.metadata).toEqual({ dept: 'eng' });
      expect(item.accessPass.unifiedAccessPassExId).toBe('uap-1');
      expect(item.accessPass.passTemplate).toBeInstanceOf(LedgerItemPassTemplate);
      expect(item.accessPass.passTemplate.id).toBe('pt-1');
      expect(item.accessPass.passTemplate.name).toBe('Employee Badge');
      expect(item.accessPass.passTemplate.protocol).toBe('desfire');
      expect(item.accessPass.passTemplate.platform).toBe('apple');
      expect(item.accessPass.passTemplate.useCase).toBe('employee_badge');
    });

    test('LedgerItem handles null access_pass', () => {
      const item = new LedgerItem({
        id: 'li-2',
        created_at: '2025-03-01T00:00:00Z',
        amount: 50,
        kind: 'renewal',
        metadata: {},
        access_pass: null
      });

      expect(item.id).toBe('li-2');
      expect(item.accessPass).toBeNull();
    });

    test('LedgerItem handles null pass_template on access pass', () => {
      const item = new LedgerItem({
        id: 'li-3',
        created_at: '2025-03-01T00:00:00Z',
        amount: 75,
        kind: 'provision',
        metadata: {},
        access_pass: {
          id: 'ap-2',
          full_name: 'John Smith',
          state: 'suspended',
          metadata: {},
          unified_access_pass_ex_id: null,
          pass_template: null
        }
      });

      expect(item.accessPass).toBeInstanceOf(LedgerItemAccessPass);
      expect(item.accessPass.passTemplate).toBeNull();
    });

    test('LedgerItem handles missing access_pass key', () => {
      const item = new LedgerItem({
        id: 'li-4',
        created_at: '2025-03-01T00:00:00Z',
        amount: 25,
        kind: 'other'
      });

      expect(item.accessPass).toBeNull();
    });

    test('Template should have metadata property', () => {
      const template = new Template({
        id: 'template-123',
        name: 'Test Template',
        metadata: { department: 'engineering' }
      });

      expect(template.metadata).toEqual({ department: 'engineering' });
    });

    test('Template should have allowOnMultipleDevices property', () => {
      const template = new Template({
        id: 'template-123',
        allowed_device_counts: { iphone: 3, watch: 1 }
      });

      expect(template.allowOnMultipleDevices).toBe(true);
    });

    test('Template should have allowOnMultipleDevices false when counts are 1', () => {
      const template = new Template({
        id: 'template-123',
        allowed_device_counts: { iphone: 1, watch: 0 }
      });

      expect(template.allowOnMultipleDevices).toBe(false);
    });

    test('AccessCard should have title property', () => {
      const card = new AccessCard({
        id: 'card-123',
        title: 'Engineering Manager'
      });

      expect(card.title).toBe('Engineering Manager');
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Console API — Ledger Items
  // ════════════════════════════════════════════════════════════════════════════

  describe('Console API — listLedgerItems', () => {
    const mockLedgerResponse = {
      ledger_items: [
        {
          id: 'li-1',
          created_at: '2025-03-01T12:00:00Z',
          amount: 150,
          kind: 'provision',
          metadata: {},
          access_pass: {
            id: 'ap-1',
            full_name: 'Jane Doe',
            state: 'active',
            metadata: {},
            unified_access_pass_ex_id: 'uap-1',
            pass_template: {
              id: 'pt-1',
              name: 'Employee Badge',
              protocol: 'desfire',
              platform: 'apple',
              use_case: 'employee_badge'
            }
          }
        },
        {
          id: 'li-2',
          created_at: '2025-03-02T12:00:00Z',
          amount: 50,
          kind: 'renewal',
          metadata: {},
          access_pass: null
        }
      ],
      pagination: {
        current_page: 1,
        per_page: 50,
        total_pages: 3,
        total_count: 125
      }
    };

    test('should make correct API call', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLedgerResponse)
      });

      await client.console.listLedgerItems();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/console/ledger-items'),
        expect.objectContaining({
          method: 'GET'
        })
      );
    });

    test('should pass pagination params', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLedgerResponse)
      });

      await client.console.listLedgerItems({ page: 2, perPage: 10 });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('page=2'),
        expect.anything()
      );
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('per_page=10'),
        expect.anything()
      );
    });

    test('should pass date filter params', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLedgerResponse)
      });

      await client.console.listLedgerItems({
        startDate: '2025-03-01T00:00:00Z',
        endDate: '2025-03-31T23:59:59Z'
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('start_date=2025-03-01T00%3A00%3A00Z'),
        expect.anything()
      );
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('end_date=2025-03-31T23%3A59%3A59Z'),
        expect.anything()
      );
    });

    test('should not include query string when no params given', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLedgerResponse)
      });

      await client.console.listLedgerItems();

      const calledUrl = fetch.mock.calls[0][0];
      expect(calledUrl).toMatch(/\/ledger-items(\?sig_payload=|$)/);
    });

    test('should return LedgerItem instances', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLedgerResponse)
      });

      const result = await client.console.listLedgerItems();

      expect(result.ledgerItems).toHaveLength(2);
      expect(result.ledgerItems[0]).toBeInstanceOf(LedgerItem);
      expect(result.ledgerItems[1]).toBeInstanceOf(LedgerItem);
    });

    test('should remove snake_case key from response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLedgerResponse)
      });

      const result = await client.console.listLedgerItems();

      expect(result.ledger_items).toBeUndefined();
    });

    test('should deserialize nested models', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLedgerResponse)
      });

      const result = await client.console.listLedgerItems();
      const item = result.ledgerItems[0];

      expect(item.id).toBe('li-1');
      expect(item.amount).toBe(150);
      expect(item.kind).toBe('provision');
      expect(item.accessPass).toBeInstanceOf(LedgerItemAccessPass);
      expect(item.accessPass.id).toBe('ap-1');
      expect(item.accessPass.fullName).toBe('Jane Doe');
      expect(item.accessPass.passTemplate).toBeInstanceOf(LedgerItemPassTemplate);
      expect(item.accessPass.passTemplate.id).toBe('pt-1');
      expect(item.accessPass.passTemplate.name).toBe('Employee Badge');
    });

    test('should handle null access_pass in response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLedgerResponse)
      });

      const result = await client.console.listLedgerItems();
      const item = result.ledgerItems[1];

      expect(item.id).toBe('li-2');
      expect(item.accessPass).toBeNull();
    });

    test('should preserve pagination metadata', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLedgerResponse)
      });

      const result = await client.console.listLedgerItems();

      expect(result.pagination).toEqual({
        current_page: 1,
        per_page: 50,
        total_pages: 3,
        total_count: 125
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // HID Orgs API
  // ════════════════════════════════════════════════════════════════════════════

  describe('HID Orgs API', () => {
    describe('create', () => {
      test('should make correct API call', async () => {
        const mockResponse = {
          id: 'org-1', name: 'My Org', slug: 'my-org',
          first_name: 'Ada', last_name: 'Lovelace',
          phone: '+1-555-0000', full_address: '1 Main St, NY NY',
          status: 'pending', created_at: '2025-01-01T00:00:00Z'
        };
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        });

        const org = await client.console.hid.orgs.create({
          name: 'My Org',
          fullAddress: '1 Main St, NY NY',
          phone: '+1-555-0000',
          firstName: 'Ada',
          lastName: 'Lovelace'
        });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/v1/console/hid/orgs'),
          expect.objectContaining({ method: 'POST' })
        );
        expect(org).toBeInstanceOf(HIDOrg);
        expect(org.name).toBe('My Org');
        expect(org.slug).toBe('my-org');
      });

      test('should send snake_case params', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'org-1' })
        });

        await client.console.hid.orgs.create({
          name: 'My Org',
          fullAddress: '1 Main St',
          phone: '+1-555-0000',
          firstName: 'Ada',
          lastName: 'Lovelace'
        });

        const callBody = JSON.parse(fetch.mock.calls[0][1].body);
        expect(callBody.name).toBe('My Org');
        expect(callBody.full_address).toBe('1 Main St');
        expect(callBody.first_name).toBe('Ada');
        expect(callBody.last_name).toBe('Lovelace');
      });
    });

    describe('list', () => {
      test('should return array of HIDOrg instances', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            hid_orgs: [
              { id: 'org-1', name: 'Org 1', slug: 'org-1' },
              { id: 'org-2', name: 'Org 2', slug: 'org-2' }
            ]
          })
        });

        const orgs = await client.console.hid.orgs.list();

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/v1/console/hid/orgs'),
          expect.objectContaining({ method: 'GET' })
        );
        expect(orgs).toHaveLength(2);
        expect(orgs[0]).toBeInstanceOf(HIDOrg);
      });
    });

    describe('activate', () => {
      test('should make correct API call', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'org-1', name: 'My Org', status: 'active' })
        });

        const result = await client.console.hid.orgs.activate({
          email: 'admin@example.com',
          password: 'hid-password-123'
        });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/v1/console/hid/orgs/activate'),
          expect.objectContaining({ method: 'POST' })
        );
        expect(result).toBeInstanceOf(HIDOrg);
        expect(result.status).toBe('active');
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // iOS Preflight
  // ════════════════════════════════════════════════════════════════════════════

  describe('iOS Preflight', () => {
    test('should make correct API call', async () => {
      const mockResponse = {
        provisioning_credential_identifier: 'pci-123',
        sharing_instance_identifier: 'sii-456',
        card_template_identifier: 'cti-789',
        environment_identifier: 'env-abc'
      };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await client.console.iosPreflight({
        cardTemplateId: '0xt3mp14t3',
        accessPassExId: '0xp455'
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/console/card-templates/0xt3mp14t3/ios_preflight'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.provisioningCredentialIdentifier).toBe('pci-123');
      expect(result.sharingInstanceIdentifier).toBe('sii-456');
      expect(result.cardTemplateIdentifier).toBe('cti-789');
      expect(result.environmentIdentifier).toBe('env-abc');
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Ledger Items (legacy)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Ledger Items', () => {
    test('should make correct API call with pagination', async () => {
      const mockResponse = {
        ledger_items: [
          { id: 'li-1', amount: '1.50', kind: 'issuance', created_at: '2025-01-01T00:00:00Z' },
          { id: 'li-2', amount: '0.50', kind: 'activation', created_at: '2025-01-02T00:00:00Z' }
        ],
        pagination: { current_page: 1, total_pages: 3, total_count: 50 }
      };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await client.console.ledgerItems({
        page: 1,
        perPage: 50,
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-02-01T00:00:00Z'
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/console/ledger-items'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('page=1'),
        expect.anything()
      );
      expect(result.ledgerItems).toHaveLength(2);
      expect(result.ledgerItems[0]).toBeInstanceOf(LedgerItem);
      expect(result.pagination).toBeDefined();
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Provision with new fields
  // ════════════════════════════════════════════════════════════════════════════

  describe('Provision with title and metadata', () => {
    test('should include title and metadata in request body', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'card-123', title: 'Engineering Manager' })
      });

      await client.accessCards.provision({
        cardTemplateId: '0xd3adb00b5',
        fullName: 'Test User',
        startDate: '2025-01-01T00:00:00Z',
        expirationDate: '2025-12-31T00:00:00Z',
        title: 'Engineering Manager',
        metadata: { department: 'engineering', badgeType: 'contractor' }
      });

      const callBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(callBody.title).toBe('Engineering Manager');
      expect(callBody.metadata).toEqual({ department: 'engineering', badgeType: 'contractor' });
    });

    test('should include title in update request body', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'card-123' })
      });

      await client.accessCards.update({
        cardId: '0xc4rd1d',
        title: 'Senior Developer'
      });

      const callBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(callBody.title).toBe('Senior Developer');
    });

    test('should include department, location, siteName, workstation, mailStop, companyAddress in provision body', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'card-123' })
      });

      await client.accessCards.provision({
        cardTemplateId: '0xd3adb00b5',
        fullName: 'Test User',
        startDate: '2025-01-01T00:00:00Z',
        expirationDate: '2025-12-31T00:00:00Z',
        department: 'Engineering',
        location: 'San Francisco',
        siteName: 'HQ Building A',
        workstation: '4F-207',
        mailStop: 'MS-401',
        companyAddress: '123 Main St, San Francisco, CA 94105'
      });

      const callBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(callBody.department).toBe('Engineering');
      expect(callBody.location).toBe('San Francisco');
      expect(callBody.site_name).toBe('HQ Building A');
      expect(callBody.workstation).toBe('4F-207');
      expect(callBody.mail_stop).toBe('MS-401');
      expect(callBody.company_address).toBe('123 Main St, San Francisco, CA 94105');
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // AccessCard model — new fields
  // ════════════════════════════════════════════════════════════════════════════

  describe('AccessCard new fields', () => {
    test('should have employeeId, organizationName, temporary, createdAt', () => {
      const card = new AccessCard({
        id: 'card-123',
        employee_id: 'emp_789',
        organization_name: 'Acme Corp',
        temporary: true,
        created_at: '2025-06-01T00:00:00Z'
      });

      expect(card.employeeId).toBe('emp_789');
      expect(card.organizationName).toBe('Acme Corp');
      expect(card.temporary).toBe(true);
      expect(card.createdAt).toBe('2025-06-01T00:00:00Z');
    });

    test('should default new fields to undefined when missing', () => {
      const card = new AccessCard({ id: 'card-minimal' });

      expect(card.employeeId).toBeUndefined();
      expect(card.organizationName).toBeUndefined();
      expect(card.temporary).toBeUndefined();
      expect(card.createdAt).toBeUndefined();
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Landing Pages
  // ════════════════════════════════════════════════════════════════════════════

  describe('Landing Pages', () => {
    test('LandingPage model should have correct properties', () => {
      const page = new LandingPage({
        id: 'lp-1',
        name: 'Miami Office',
        created_at: '2025-01-01T00:00:00Z',
        kind: 'universal',
        password_protected: false,
        logo_url: 'https://example.com/logo.png'
      });

      expect(page.id).toBe('lp-1');
      expect(page.name).toBe('Miami Office');
      expect(page.createdAt).toBe('2025-01-01T00:00:00Z');
      expect(page.kind).toBe('universal');
      expect(page.passwordProtected).toBe(false);
      expect(page.logoUrl).toBe('https://example.com/logo.png');
    });

    test('listLandingPages should return LandingPage instances', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { id: 'lp-1', name: 'Page 1', kind: 'universal', password_protected: false },
          { id: 'lp-2', name: 'Page 2', kind: 'specific', password_protected: true }
        ])
      });

      const pages = await client.console.listLandingPages();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/console/landing-pages'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(pages).toHaveLength(2);
      expect(pages[0]).toBeInstanceOf(LandingPage);
      expect(pages[0].name).toBe('Page 1');
    });

    test('listLandingPages should handle empty array', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
      });

      const pages = await client.console.listLandingPages();
      expect(pages).toHaveLength(0);
    });

    test('createLandingPage should send correct params', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'lp-new', name: 'Miami Office', kind: 'universal'
        })
      });

      const page = await client.console.createLandingPage({
        name: 'Miami Office Access Pass',
        kind: 'universal',
        additionalText: 'Welcome to the Miami Office',
        bgColor: '#f1f5f9',
        allowImmediateDownload: true
      });

      const callBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(callBody.name).toBe('Miami Office Access Pass');
      expect(callBody.kind).toBe('universal');
      expect(callBody.additional_text).toBe('Welcome to the Miami Office');
      expect(callBody.bg_color).toBe('#f1f5f9');
      expect(callBody.allow_immediate_download).toBe(true);
      expect(page).toBeInstanceOf(LandingPage);
    });

    test('updateLandingPage should send correct params', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'lp-1', name: 'Updated Page'
        })
      });

      const page = await client.console.updateLandingPage({
        landingPageId: 'lp-1',
        name: 'Updated Miami Office Access Pass',
        additionalText: 'Welcome! Tap below to get your access pass.',
        bgColor: '#e2e8f0'
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/console/landing-pages/lp-1'),
        expect.objectContaining({ method: 'PUT' })
      );
      const callBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(callBody.name).toBe('Updated Miami Office Access Pass');
      expect(callBody.additional_text).toBe('Welcome! Tap below to get your access pass.');
      expect(callBody.bg_color).toBe('#e2e8f0');
      expect(page).toBeInstanceOf(LandingPage);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Credential Profiles
  // ════════════════════════════════════════════════════════════════════════════

  describe('Credential Profiles', () => {
    test('CredentialProfile model should have correct properties', () => {
      const profile = new CredentialProfile({
        id: 'cp-1',
        aid: 'F00001',
        name: 'Main Office Profile',
        apple_id: 'apple-123',
        created_at: '2025-01-01T00:00:00Z',
        card_storage: '8K',
        keys: [{ ex_id: 'key-1', label: 'Master Key' }],
        files: [{ ex_id: 'file-1', file_type: 'standard' }]
      });

      expect(profile.id).toBe('cp-1');
      expect(profile.aid).toBe('F00001');
      expect(profile.name).toBe('Main Office Profile');
      expect(profile.appleId).toBe('apple-123');
      expect(profile.createdAt).toBe('2025-01-01T00:00:00Z');
      expect(profile.cardStorage).toBe('8K');
      expect(profile.keys).toHaveLength(1);
      expect(profile.files).toHaveLength(1);
    });

    test('CredentialProfile defaults keys and files to empty arrays', () => {
      const profile = new CredentialProfile({ id: 'cp-1' });
      expect(profile.keys).toEqual([]);
      expect(profile.files).toEqual([]);
    });

    test('credentialProfiles.list should return CredentialProfile instances', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { id: 'cp-1', aid: 'F00001', name: 'Profile 1' },
          { id: 'cp-2', aid: 'F00002', name: 'Profile 2' }
        ])
      });

      const profiles = await client.console.credentialProfiles.list();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/console/credential-profiles'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(profiles).toHaveLength(2);
      expect(profiles[0]).toBeInstanceOf(CredentialProfile);
      expect(profiles[0].aid).toBe('F00001');
    });

    test('credentialProfiles.list should handle empty array', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
      });

      const profiles = await client.console.credentialProfiles.list();
      expect(profiles).toHaveLength(0);
    });

    test('credentialProfiles.create should send correct params', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'cp-new', aid: 'F00003', name: 'Main Office Profile'
        })
      });

      const profile = await client.console.credentialProfiles.create({
        name: 'Main Office Profile',
        appName: 'KEY-ID-main',
        keys: [
          { value: 'your_32_char_hex_master_key_here' },
          { value: 'your_32_char_hex__read_key__here' }
        ]
      });

      const callBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(callBody.name).toBe('Main Office Profile');
      expect(callBody.app_name).toBe('KEY-ID-main');
      expect(callBody.keys).toHaveLength(2);
      expect(profile).toBeInstanceOf(CredentialProfile);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Webhooks
  // ════════════════════════════════════════════════════════════════════════════

  describe('Webhooks', () => {
    test('Webhook model should have correct properties', () => {
      const webhook = new Webhook({
        id: 'wh-1',
        name: 'Production',
        url: 'https://example.com/webhooks',
        auth_method: 'bearer_token',
        subscribed_events: ['ag.access_pass.issued'],
        created_at: '2025-01-01T00:00:00Z',
        private_key: 'pk_123'
      });

      expect(webhook.id).toBe('wh-1');
      expect(webhook.name).toBe('Production');
      expect(webhook.url).toBe('https://example.com/webhooks');
      expect(webhook.authMethod).toBe('bearer_token');
      expect(webhook.subscribedEvents).toEqual(['ag.access_pass.issued']);
      expect(webhook.createdAt).toBe('2025-01-01T00:00:00Z');
      expect(webhook.privateKey).toBe('pk_123');
    });

    test('webhooks.create should send correct params', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'wh-new',
          name: 'Production',
          url: 'https://example.com/webhooks',
          subscribed_events: ['ag.access_pass.issued'],
          private_key: 'pk_secret'
        })
      });

      const webhook = await client.console.webhooks.create({
        name: 'Production',
        url: 'https://example.com/webhooks',
        subscribedEvents: ['ag.access_pass.issued']
      });

      const callBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(callBody.name).toBe('Production');
      expect(callBody.url).toBe('https://example.com/webhooks');
      expect(callBody.subscribed_events).toEqual(['ag.access_pass.issued']);
      expect(webhook).toBeInstanceOf(Webhook);
      expect(webhook.privateKey).toBe('pk_secret');
    });

    test('webhooks.list should return Webhook instances', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          webhooks: [
            { id: 'wh-1', name: 'Prod', url: 'https://example.com/wh1' },
            { id: 'wh-2', name: 'Staging', url: 'https://example.com/wh2' }
          ]
        })
      });

      const webhooks = await client.console.webhooks.list();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/console/webhooks'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(webhooks).toHaveLength(2);
      expect(webhooks[0]).toBeInstanceOf(Webhook);
      expect(webhooks[0].name).toBe('Prod');
    });

    test('webhooks.delete should make correct API call', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      });

      await client.console.webhooks.delete('wh-1');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/console/webhooks/wh-1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // HID Orgs — flat array fix
  // ════════════════════════════════════════════════════════════════════════════

  describe('HID Orgs flat array response', () => {
    test('should handle flat array response from API', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { id: 'org-1', name: 'Org 1', slug: 'org-1' },
          { id: 'org-2', name: 'Org 2', slug: 'org-2' }
        ])
      });

      const orgs = await client.console.hid.orgs.list();

      expect(orgs).toHaveLength(2);
      expect(orgs[0]).toBeInstanceOf(HIDOrg);
      expect(orgs[0].name).toBe('Org 1');
    });
  });
});
