 module.exports = ({ env }) => ({
          upload: {
            config: {
              provider: 'aws-s3',
              providerOptions: {
                baseUrl: env('AWS_BASE_URL'),
                rootPath: env('AWS_BASE_URL'),
                accessKeyId: env('AWS_ACCESS_KEY_ID'),
                secretAccessKey: env('AWS_ACCESS_SECRET'),
                region: env('AWS_REGION'),
                cloudfrontURL: env('AWS_BASE_URL'),
                params: {
                  ACL: env('AWS_ACL', 'public-read'),
                  Bucket: env('AWS_BUCKET'),
                },
              },
              actionOptions: {
                upload: {},
                uploadStream: {},
                delete: {},
              },
            },
          },
    });
