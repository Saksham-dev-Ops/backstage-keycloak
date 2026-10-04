import { Config } from '@backstage/config';

export type TenantPluginConfig = {
  platformAdmins: string[];
  localAuth: {
    enabled: boolean;
    sessionSecret?: string;
    sessionDurationSeconds: number;
  };
};

export function readTenantPluginConfig(config: Config): TenantPluginConfig {
  const enabled = config.getOptionalBoolean('tenant.localAuth.enabled') ?? false;
  const sessionSecret = config.getOptionalString('tenant.localAuth.sessionSecret');
  if (enabled && !sessionSecret) {
    throw new Error(
      'tenant.localAuth.sessionSecret is required when tenant.localAuth.enabled is true',
    );
  }
  return {
    platformAdmins: (
      config.getOptionalStringArray('tenant.platformAdmins') ?? []
    ).map(email => email.toLowerCase()),
    localAuth: {
      enabled,
      sessionSecret,
      sessionDurationSeconds:
        (config.getOptionalNumber('tenant.localAuth.sessionDurationMinutes') ??
          480) * 60,
    },
  };
}
