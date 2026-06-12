export default () => ({
    port: parseInt(process.env.PORT ?? '3002', 10) ?? 3002,
    corsEnabledOrigins: process.env.CORS_ENABLED_ORIGINS,
    internalServiceToServiceToken:
        process.env.INTERNAL_SERVICE_TO_SERVICE_TOKEN,
    database: {
        url: process.env.DATABASE_URL,
    },
    redis: {
        url: process.env.REDIS_URL,
    },
    kafka: {
        brokers: process.env.KAFKA_BROKERS,
        ca: process.env.KAFKA_CA,
        cert: process.env.KAFKA_CERT,
        key: process.env.KAFKA_KEY,
    },
});
