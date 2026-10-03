import assert from 'node:assert/strict';
import test from 'node:test';

import { validateProductionConfig } from '../src/config/env.js';

test('production configuration rejects missing and placeholder JWT secrets', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousJwtSecret = process.env.JWT_SECRET;

  try {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    assert.throws(validateProductionConfig, /JWT_SECRET must be set/);

    process.env.JWT_SECRET = 'replace_with_a_strong_secret';
    assert.throws(validateProductionConfig, /JWT_SECRET must be set/);

    process.env.JWT_SECRET = 'a-generated-production-secret-with-sufficient-entropy';
    assert.doesNotThrow(validateProductionConfig);
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }

    if (previousJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousJwtSecret;
    }
  }
});