export default [
  'strapi::logger',
  'strapi::errors',
    {
        name: 'strapi::security',
        config: {
          contentSecurityPolicy: {
            useDefaults: true,
            directives: {
              'connect-src': ["'self'", 'https:'],
              'img-src': [
                "'self'",
                'data:',
                'blob:',
                'shelf-dev-production.s3.eu-central-1.amazonaws.com', "market-assets.strapi.io"],
              'media-src': [
                "'self'",
                'data:',
                'blob:',
                'shelf-dev-production.s3.eu-central-1.amazonaws.com', "market-assets.strapi.io"
              ],
              upgradeInsecureRequests: null,
            },
          },
        },
      },
      {
        name: 'strapi::cors',
        config: {
          origin: ['*'],
          methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
          headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
          keepHeaderOnError: true,
        },
      },
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
