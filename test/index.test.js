import AccessGrid from '../src/index';

// Mock fetch globally
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

describe('AccessGrid SDK', () => {
  let client;
  const mockAccountId = 'test-account-id';
  const mockSecretKey = 'test-secret-key';
  
  beforeEach(() => {
    client = new AccessGrid(mockAccountId, mockSecretKey);
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Setup default crypto mocks
    global.crypto.subtle.importKey.mockResolvedValue('mockKey');
    global.crypto.subtle.sign.mockResolvedValue(new Uint8Array([1, 2, 3]));
    
    // Setup default successful response
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'success' })
    });
  });

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

  describe('AccessCards API', () => {
    describe('provision', () => {
      const mockProvisionParams = {
        cardTemplateId: '0xd3adb00b5',
        employeeId: '123456789',
        tagId: 'DDEADB33FB00B5',
        allowOnMultipleDevices: true,
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
          expect.stringContaining('/api/v1/nfc_keys/issue'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              'X-ACCT-ID': mockAccountId,
              'X-PAYLOAD-SIG': expect.any(String)
            })
          })
        );
      });

      test('should handle API errors gracefully', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ 
            message: 'Invalid template ID' 
          })
        });

        await expect(client.accessCards.provision(mockProvisionParams))
          .rejects
          .toThrow('API request failed: Invalid template ID');
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
          expect.stringContaining(`/api/v1/nfc_keys/${mockUpdateParams.cardId}`),
          expect.objectContaining({
            method: 'PUT',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              'X-ACCT-ID': mockAccountId
            })
          })
        );
      });
    });

    describe('manage operations', () => {
      const mockCardId = '0xc4rd1d';

      test('should make correct API call for suspend', async () => {
        await client.accessCards.suspend({ cardId: mockCardId });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/api/v1/nfc_keys/${mockCardId}/manage`),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('suspend')
          })
        );
      });

      test('should make correct API call for resume', async () => {
        await client.accessCards.resume({ cardId: mockCardId });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/api/v1/nfc_keys/${mockCardId}/manage`),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('resume')
          })
        );
      });

      test('should make correct API call for unlink', async () => {
        await client.accessCards.unlink({ cardId: mockCardId });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/api/v1/nfc_keys/${mockCardId}/manage`),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('unlink')
          })
        );
      });
    });
  });

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
        await client.console.createTemplate(mockTemplateParams);

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/enterprise/templates'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              'X-ACCT-ID': mockAccountId
            })
          })
        );
      });
    });

    describe('readTemplate', () => {
      const mockTemplateId = '0xd3adb00b5';

      test('should make correct API call for reading template', async () => {
        await client.console.readTemplate({ cardTemplateId: mockTemplateId });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/api/v1/enterprise/templates/${mockTemplateId}`),
          expect.objectContaining({
            method: 'GET',
            headers: expect.objectContaining({
              'X-ACCT-ID': mockAccountId
            })
          })
        );
      });
    });

    describe('eventLog', () => {
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
        await client.console.eventLog(mockEventParams);

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/api/v1/enterprise/templates/${mockEventParams.cardTemplateId}/logs`),
          expect.objectContaining({
            method: 'GET',
            headers: expect.objectContaining({
              'X-ACCT-ID': mockAccountId
            })
          })
        );
      });

      test('should properly encode query parameters', async () => {
        await client.console.eventLog(mockEventParams);

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('filters%5Bdevice%5D=mobile'),
          expect.any(Object)
        );
      });
    });
  });
});