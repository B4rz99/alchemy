import { ConfigError } from "@distilled.cloud/core/errors";
import { Credentials, toConfig } from "@distilled.cloud/railway";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { resolveProviderConfig } from "../Auth/Resolve.ts";
import {
  RAILWAY_AUTH_PROVIDER_NAME,
  type RailwayAuthConfig,
  type RailwayResolvedCredentials,
} from "./AuthProvider.ts";

export {
  Credentials,
  CredentialsFromEnv,
  CredentialsFromToken,
  DEFAULT_API_BASE_URL,
  type Config as CredentialsConfig,
  type TokenKind,
} from "@distilled.cloud/railway";

/**
 * Build a `Credentials` layer that resolves Railway credentials via the
 * current Alchemy profile, or directly from environment variables in CI.
 *
 * Maps onto `@distilled.cloud/railway`'s
 * `{ token, tokenKind: "account", apiBaseUrl }` shape. Alchemy itself only
 * reads `RAILWAY_API_TOKEN` (account Bearer). Distilled's own
 * `CredentialsFromEnv` also accepts `RAILWAY_TOKEN` / `RAILWAY_PROJECT_TOKEN`
 * as fallbacks.
 */
export const fromAuthProvider = () =>
  Layer.effect(
    Credentials,
    Effect.gen(function* () {
      // Defer profile lookup and credential resolution until first use, so
      // building the provider layers never requires a configured profile.
      const resolve = resolveProviderConfig<
        RailwayAuthConfig,
        RailwayResolvedCredentials
      >(RAILWAY_AUTH_PROVIDER_NAME).pipe(
        Effect.flatMap(({ profileName, resolve }) =>
          resolve.pipe(
            Effect.map((creds) =>
              toConfig({
                token: Redacted.value(creds.token),
                tokenKind: creds.tokenKind,
                apiBaseUrl: creds.apiBaseUrl,
              }),
            ),
            Effect.mapError(
              (e) =>
                new ConfigError({
                  message: `Failed to resolve Railway credentials from ${profileName === undefined ? "the CI environment" : `profile '${profileName}'`}: ${(e as { message?: string }).message ?? String(e)}`,
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
