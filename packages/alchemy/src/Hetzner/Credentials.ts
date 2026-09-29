import { ConfigError } from "@distilled.cloud/core/errors";
import { Credentials } from "@distilled.cloud/hetzner";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { resolveProviderConfig } from "../Auth/Resolve.ts";
import {
  HETZNER_AUTH_PROVIDER_NAME,
  type HetznerAuthConfig,
  type HetznerResolvedCredentials,
} from "./AuthProvider.ts";

export {
  Credentials,
  CredentialsFromEnv,
  credentials,
  DEFAULT_API_BASE_URL,
  type Config as CredentialsConfig,
} from "@distilled.cloud/hetzner";

/**
 * Build a `Credentials` layer that resolves Hetzner credentials via the
 * Alchemy AuthProvider using the configured profile (defaults to "default",
 * overridable with the `ALCHEMY_PROFILE` env/config value).
 *
 * Maps onto `@distilled.cloud/hetzner`'s `{ token, apiBaseUrl }` shape.
 */
export const fromAuthProvider = () =>
  Layer.effect(
    Credentials,
    Effect.gen(function* () {
      // Defer profile lookup and credential resolution until first use, so
      // building the provider layers never requires a configured profile.
      const resolve = resolveProviderConfig<
        HetznerAuthConfig,
        HetznerResolvedCredentials
      >(HETZNER_AUTH_PROVIDER_NAME).pipe(
        Effect.flatMap(({ profileName, resolve }) =>
          resolve.pipe(
            Effect.map((creds) => ({
              token: creds.token,
              apiBaseUrl: creds.apiBaseUrl,
            })),
            Effect.mapError(
              (e) =>
                new ConfigError({
                  message: `Failed to resolve Hetzner credentials from ${profileName === undefined ? "the CI environment" : `profile '${profileName}'`}: ${(e as { message?: string }).message ?? String(e)}`,
                }),
            ),
          ),
        ),
      );
      const context = yield* Effect.context<Effect.Services<typeof resolve>>();
      return yield* resolve.pipe(
        Effect.provideContext(context),
        Effect.orDie,
        Effect.cached,
      );
    }),
  );
