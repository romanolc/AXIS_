import 'dotenv/config';

const bool = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
};

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  databaseUrl: (process.env.DATABASE_URL || '').trim(),
  databaseSsl: bool(process.env.DATABASE_SSL),
  jwtSecret: process.env.JWT_SECRET || 'axis-development-secret-change-me',
  demoMode: bool(process.env.DEMO_MODE, true),
  sensorSimulatorEnabled: bool(process.env.SENSOR_SIMULATOR_ENABLED),
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || '',
  googleAllowedDomain: process.env.GOOGLE_ALLOWED_DOMAIN || '',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  emissionFactorValue: process.env.EMISSION_FACTOR_VALUE?.trim() ? Number(process.env.EMISSION_FACTOR_VALUE) : null,
  emissionFactorUnit: process.env.EMISSION_FACTOR_UNIT || 'tCO2e/MWh',
  emissionFactorPeriod: process.env.EMISSION_FACTOR_PERIOD || '',
  emissionFactorSource: process.env.EMISSION_FACTOR_SOURCE || '',
  emissionFactorMethodology: process.env.EMISSION_FACTOR_METHODOLOGY || '',
  emissionFactorReferenceDate: process.env.EMISSION_FACTOR_REFERENCE_DATE || ''
});

if (env.nodeEnv === 'production' && env.jwtSecret === 'axis-development-secret-change-me') {
  throw new Error('JWT_SECRET must be configured in production');
}

if (!env.demoMode && !env.databaseUrl) {
  throw new Error('DATABASE_URL is required when DEMO_MODE=false');
}
