import AccessGrid, { AccessGridError, AuthenticationError, AccessCard, Template, PassTemplatePair, TemplateInfo } from '../src/index';

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
      test('should make correct API call for listing cards', async () => {
        const templateId = '0xtemplate';
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ keys: [{ id: '1' }, { id: '2' }] })
        });

        const result = await client.accessCards.list(templateId);

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/v1/key-cards?template_id=${templateId}`),
          expect.anything()
        );
        expect(result).toHaveLength(2);
        expect(result[0]).toBeInstanceOf(AccessCard);
      });

      test('should filter by state', async () => {
        const templateId = '0xtemplate';
        const state = 'active';
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ keys: [{ id: '1' }] })
        });

        await client.accessCards.list(templateId, state);

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(`template_id=${templateId}&state=${state}`),
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
        name: 'Employee NFC key',
        platform: 'apple',
        useCase: 'employee_badge',
        protocol: 'desfire',
        allowOnMultipleDevices: true,
        watchCount: 2,
        iphoneCount: 3,
        design: {
          backgroundColor: '#FFFFFF',
          labelColor: '#000000',
          labelSecondaryColor: '#333333'
        },
        supportInfo: {
          supportUrl: 'https://help.yourcompany.com',
          supportPhoneNumber: '+1-555-123-4567',
          supportEmail: 'support@yourcompany.com',
          privacyPolicyUrl: 'https://yourcompany.com/privacy',
          termsAndConditionsUrl: 'https://yourcompany.com/terms'
        }
      };

      test('should make correct API call for creating template', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'template-123',
            name: 'Employee NFC key'
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
    });

    describe('updateTemplate', () => {
      const mockTemplateId = '0xt3mpl4t3';
      const mockUpdateParams = {
        cardTemplateId: mockTemplateId,
        name: 'Updated Badge',
        allowOnMultipleDevices: false,
        watchCount: 1,
        iphoneCount: 2,
        supportInfo: {
          supportUrl: 'https://help.example.com',
          supportPhoneNumber: '+1-555-999-0000',
          supportEmail: 'help@example.com',
          privacyPolicyUrl: 'https://example.com/privacy',
          termsAndConditionsUrl: 'https://example.com/terms'
        }
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
        expect(callBody.support_url).toBe('https://help.example.com');
        expect(callBody.support_phone_number).toBe('+1-555-999-0000');
        expect(callBody.support_email).toBe('help@example.com');
        expect(callBody.privacy_policy_url).toBe('https://example.com/privacy');
        expect(callBody.terms_and_conditions_url).toBe('https://example.com/terms');
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
        pass_template_pairs: [
          {
            id: 'pair-1',
            name: 'Employee Badge Pair',
            created_at: '2025-01-15T00:00:00Z',
            ios_template: { id: 'ios-1', name: 'iOS Badge', platform: 'apple' },
            android_template: { id: 'android-1', name: 'Android Badge', platform: 'google' }
          },
          {
            id: 'pair-2',
            name: 'Visitor Pass Pair',
            created_at: '2025-02-01T00:00:00Z',
            ios_template: { id: 'ios-2', name: 'iOS Visitor', platform: 'apple' },
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
          expect.stringContaining('/v1/console/pass-template-pairs'),
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
        expect(calledUrl).toMatch(/\/pass-template-pairs(\?sig_payload=|$)/);
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

        expect(result.pass_template_pairs).toBeUndefined();
      });

      test('should deserialize nested TemplateInfo models', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockPairsResponse)
        });

        const result = await client.console.listPassTemplatePairs();
        const pair = result.passTemplatePairs[0];

        expect(pair.id).toBe('pair-1');
        expect(pair.name).toBe('Employee Badge Pair');
        expect(pair.createdAt).toBe('2025-01-15T00:00:00Z');
        expect(pair.iosTemplate).toBeInstanceOf(TemplateInfo);
        expect(pair.iosTemplate.id).toBe('ios-1');
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
  });
});
