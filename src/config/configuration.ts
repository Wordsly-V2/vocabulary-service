export default () => ({
    port: parseInt(process.env.PORT ?? '3002', 10) ?? 3002,
    corsEnabledOrigins: process.env.CORS_ENABLED_ORIGINS,
    // Identity verification. `issuer` is the PUBLIC address tokens claim (the
    // gateway), while `jwksUri` is the INTERNAL address this service fetches
    // keys from -- they are deliberately different, see auth/jwt/jwks.provider.ts.
    auth: {
        jwksUri: process.env.AUTH_JWKS_URI,
        issuer: process.env.JWT_ISSUER,
        audience: process.env.JWT_AUDIENCE ?? 'wordsly-api',
    },
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
