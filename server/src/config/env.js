import dotenv from 'dotenv';

dotenv.config();

const configuredClientUrls = (process.env.CLIENT_URL || 'http://localhost:5174')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const env = {
  port: Number(process.env.PORT || 5002),
  clientUrls: configuredClientUrls.length ? configuredClientUrls : ['http://localhost:5174'],
  jwtSecret: process.env.JWT_SECRET || 'project-board-secret',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/project_board',
  useMemoryDb: process.env.USE_MEMORY_DB === 'true'
};

const placeholderJwtSecrets = new Set([
  'project-board-secret',
  'replace_with_a_strong_secret',
  'your-secret',
  'your-secret-key',
  'your_jwt_secret',
  'change-me',
  'changeme',
  'placeholder',
  'secret'
]);

export function validateProductionConfig() {
  const jwtSecret = process.env.JWT_SECRET?.trim().toLowerCase();
  if (process.env.NODE_ENV === 'production' && (!jwtSecret || placeholderJwtSecrets.has(jwtSecret))) {
    throw new Error('JWT_SECRET must be set to a non-placeholder value in production');
  }
}
