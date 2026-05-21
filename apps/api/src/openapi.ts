/**
 * OpenAPI 3.1 spec for REST v1. Served at /api/v1/openapi.json.
 *
 * Manually maintained — keep in sync with apps/api/src/rest.ts.
 */
export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Sitelog API',
    version: '1.0.0',
    description: 'Construction estimating + tracking REST API. Auth via API keys generated at /app/settings/api-keys.',
    contact: { name: 'Sitelog', email: 'support@sitelog.app' },
  },
  servers: [
    { url: 'https://api.sitelog.app/api/v1', description: 'Production' },
    { url: 'http://localhost:4000/api/v1', description: 'Local dev' },
  ],
  components: {
    securitySchemes: {
      ApiKey: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'sk_live_*',
        description: 'API key generated at /app/settings/api-keys. Scopes: read | write | admin.',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'NOT_FOUND' },
              message: { type: 'string', example: 'Project not found' },
            },
            required: ['code', 'message'],
          },
        },
      },
      Project: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          code: { type: 'string', example: 'LS 45' },
          name: { type: 'string' },
          status: { type: 'string', enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'] },
          client: { type: 'string', nullable: true },
          location: { type: 'string', nullable: true },
          startDate: { type: 'string', format: 'date', nullable: true },
          finishDate: { type: 'string', format: 'date', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      ProjectDetail: {
        allOf: [
          { $ref: '#/components/schemas/Project' },
          {
            type: 'object',
            properties: {
              boqItemCount: { type: 'integer' },
              totals: {
                type: 'object',
                properties: {
                  subtotal: { type: 'integer', description: 'Sum of BOQ items in IDR' },
                  markup: { type: 'integer' },
                  contingency: { type: 'integer' },
                  prePpn: { type: 'integer' },
                  ppn: { type: 'integer' },
                  grandTotal: { type: 'integer' },
                },
              },
            },
          },
        ],
      },
      DailyEntry: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          projectId: { type: 'string', format: 'uuid' },
          entryDate: { type: 'string', format: 'date' },
          shift: { type: 'string', enum: ['day', 'night', 'all'] },
          weather: { type: 'string', nullable: true },
          effectiveHours: { type: 'number', nullable: true },
          workforce: { type: 'integer', nullable: true },
          notes: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      AhspItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          kode: { type: 'string', example: 'AHSP-1' },
          section: { type: 'string' },
          jenis: { type: 'string', example: 'Item: 3.1 (1)' },
          satuan: { type: 'string', example: 'M3' },
          ohpPct: { type: 'number' },
        },
      },
    },
  },
  security: [{ ApiKey: [] }],
  paths: {
    '/me': {
      get: {
        summary: 'Verify API key',
        responses: {
          '200': {
            description: 'Auth context',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        orgId: { type: 'string', format: 'uuid' },
                        scope: { type: 'string', enum: ['read', 'write', 'admin'] },
                        apiVersion: { type: 'string', example: 'v1' },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': { description: 'Missing or invalid key', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/projects': {
      get: {
        summary: 'List projects in org',
        responses: {
          '200': {
            description: 'Project list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/Project' } },
                    count: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/projects/{id}': {
      get: {
        summary: 'Project detail with computed BOQ totals',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': {
            description: 'Project with totals',
            content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/ProjectDetail' } } } } },
          },
          '404': { description: 'Project not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/projects/{id}/entries': {
      get: {
        summary: 'Daily entries for project (most recent 100)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': {
            description: 'Entries list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/DailyEntry' } },
                    count: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/entries': {
      post: {
        summary: 'Submit a daily entry (idempotent via Idempotency-Key header)',
        parameters: [
          { name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' },
            description: 'Optional opaque key. Same key + same body within 24h returns cached response.' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['projectId', 'entryDate'],
                properties: {
                  projectId: { type: 'string', format: 'uuid' },
                  entryDate: { type: 'string', format: 'date' },
                  shift: { type: 'string', enum: ['day', 'night', 'all'], default: 'day' },
                  weather: { type: 'string' },
                  effectiveHours: { type: 'number' },
                  workforce: { type: 'integer' },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Entry created', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/DailyEntry' } } } } } },
          '404': { description: 'Project not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '409': { description: 'Idempotency-Key reused with different body', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/entries/{id}': {
      get: {
        summary: 'Entry detail with activities',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Entry with activities array' },
          '404': { description: 'Entry not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/ahsp': {
      get: {
        summary: 'AHSP catalog (up to 500 items)',
        responses: {
          '200': {
            description: 'Catalog list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/AhspItem' } },
                    count: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;
