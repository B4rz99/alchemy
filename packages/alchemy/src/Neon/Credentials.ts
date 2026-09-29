import { ConfigError } from "@distilled.cloud/core/errors";
import { Credentials } from "@distilled.cloud/neon";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { resolveProviderConfig } from "../Auth/Resolve.ts";
import {
  NEON_AUTH_PROVIDER_NAME,
  type NeonAuthConfig,
  type NeonResolvedCredentials,
} from "./AuthProvider.ts";

export { Credentials } from "@distilled.cloud/neon";

const DEFAULT_BASE_URL = "https://console.neon.tech/api/v2";

export const fromAuthProvider = () =>
  Layer.effect(
    Credentials,
    Effect.gen(function* () {
      // Defer profile lookup and credential resolution until first use, so
      // building the provider layers never requires a configured profile.
      const resolve = resolveProviderConfig<
        NeonAuthConfig,
        NeonResolvedCredentials
      >(NEON_AUTH_PROVIDER_NAME).pipe(
        Effect.flatMap(({ profileName, resolve }) =>
          resolve.pipe(
            Effect.map((creds) => ({
              apiKey: creds.apiKey,
              apiBaseUrl: DEFAULT_BASE_URL,
            })),
            Effect.mapError(
              (e) =>
                new ConfigError({
                  message: `Failed to resolve Neon credentials from ${profileName === undefined ? "the CI environment" : `profile '${profileName}'`}: ${(e as { message?: string }).message ?? String(e)}`,
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
