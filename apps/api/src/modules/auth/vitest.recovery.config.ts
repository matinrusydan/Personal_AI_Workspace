// Isolated mock-only suite. Deliberately excludes historical DB-backed suites.
// Resolve the already-installed checkout dependencies without installing packages.
import { resolve } from 'node:path';
const root = resolve(__dirname, '../../../../..');
const dependencies = process.env.PAW_DEPENDENCY_ROOT || root;
export default {
  resolve: { alias: {
    '@paw/database': resolve(root, 'packages/database/src/index.ts'),
    '@nestjs/common': resolve(dependencies, 'apps/api/node_modules/@nestjs/common/index.js'),
    vitest: resolve(dependencies, 'apps/api/node_modules/vitest/dist/index.js'),
    'next/server': resolve(dependencies, 'apps/web/node_modules/next/server.js'),
  } },
  test: {
    include: [
      'apps/api/src/modules/auth/auth.recovery.spec.ts',
      'apps/web/src/app/api/bff.recovery.spec.ts',
      'apps/api/test/integrations.service.spec.ts',
    ],
    environment: 'node',
    env: { DATABASE_URL: 'postgresql://invalid:invalid@127.0.0.1:1/never_connect' },
  },
};
