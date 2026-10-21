import { describe, expect, it } from 'vitest';
import { readConfig } from '../src/config.js';

describe('readConfig', () => {
  it("utilise les valeurs par défaut quand aucune variable n'est définie", () => {
    expect(readConfig({})).toEqual({
      port: 3000,
      databaseUrl: 'postgres://taskflow:taskflow@localhost:5432/taskflow',
      appEnv: 'local',
      appVersion: 'dev',
    });
  });

  it("lit les variables d'environnement fournies", () => {
    const config = readConfig({
      PORT: '4000',
      DATABASE_URL: 'postgres://u:p@db:5432/x',
      APP_ENV: 'production',
      APP_VERSION: 'abc1234',
    });

    expect(config).toEqual({
      port: 4000,
      databaseUrl: 'postgres://u:p@db:5432/x',
      appEnv: 'production',
      appVersion: 'abc1234',
    });
  });
});
