---
title: "Flutter --dart-define: Separate Release Builds from Server Environments"
pubDate: "2026-09-19T17:31:51+09:00"
description: "Learn how to separate Flutter build modes from development and production API environments using --dart-define and String.fromEnvironment."
category: "Flutter"
tags: ["Flutter", "dart-define", "Release", "Environment", "API"]
lang: "en"
---

When developing a Flutter app, it is easy to treat `debug`, `profile`, and `release` build modes as if they were the same thing as development and production server environments.

They are not.

For example, this is a perfectly valid command:

```bash
flutter run --release -d <device-id> --dart-define=ENV=dev
```

It can run an optimized **Release build while connecting to a development server**.

This article explains how to separate Flutter build modes from API environments using `--dart-define`.

## Release mode does not mean production server

Flutter build modes determine how the application itself is compiled and executed.

The main modes are:

- `debug`: intended for development and debugging
- `profile`: intended for performance analysis
- `release`: optimized for distribution with debugging features removed

Values such as `dev` and `prod`, however, are application-defined **server environments**.

This means all of these combinations are possible:

```text
Debug build   + development server
Release build + development server
Release build + production server
```

The second combination is especially useful when testing real Release behavior on a physical device while still using a development API.

## Passing an environment with --dart-define

Flutter can receive compile-time values through `--dart-define`.

```bash
flutter run --release     -d <device-id>     --dart-define=ENV=dev
```

For production:

```bash
flutter run --release     -d <device-id>     --dart-define=ENV=prod
```

Read the value in Dart with `String.fromEnvironment()`.

```dart
class AppConfig {
    AppConfig._();

    static const String env = String.fromEnvironment(
        'ENV',
        defaultValue: 'dev',
    );

    static bool get isProd => env == 'prod';
}
```

The server environment is now controlled independently of whether the app is running in Debug or Release mode.

## Separate base URLs from API paths

Hard-coding a complete URL for every endpoint makes environment changes unnecessarily difficult.

Instead, separate the server address from endpoint paths.

```dart
class ApiConfig {
    ApiConfig._();

    static const String env = String.fromEnvironment(
        'ENV',
        defaultValue: 'dev',
    );

    static const String _devWebBaseUrl = 'https://dev.example.com';
    static const String _prodWebBaseUrl = 'https://www.example.com';

    static const String _devApiBaseUrl = 'https://dev-api.example.com/api';
    static const String _prodApiBaseUrl = 'https://api.example.com/api';

    static String get webBaseUrl =>
        env == 'prod' ? _prodWebBaseUrl : _devWebBaseUrl;

    static String get apiBaseUrl =>
        env == 'prod' ? _prodApiBaseUrl : _devApiBaseUrl;

    static String get productDetailUrl => '$webBaseUrl/product';
    static String get sequenceUrl => '$apiBaseUrl/init/sequence';
}
```

With this structure, adding endpoints does not require repeating development and production hosts throughout the codebase.

## Testing Release mode on a physical iOS device

First, list available devices:

```bash
flutter devices
```

Then run the app using the device ID:

```bash
flutter run --release     -d <device-id>     --dart-define=ENV=dev
```

There is no conflict between `--release` and `ENV=dev`.

`--release` controls Flutter's build mode, while `ENV=dev` is an application configuration value that you defined.

## Production builds

For an iOS Release build that connects to production:

```bash
flutter build ios --release     --dart-define=ENV=prod
```

The same approach works for Android:

```bash
flutter build appbundle --release     --dart-define=ENV=prod
```

And for macOS:

```bash
flutter build macos --release     --dart-define=ENV=prod
```

The platform changes, but the Dart-side environment configuration remains the same.

## Be careful with a dev default

Using `dev` as the default environment is convenient during development.

```dart
static const String env = String.fromEnvironment(
    'ENV',
    defaultValue: 'dev',
);
```

However, forgetting `--dart-define=ENV=prod` during a production build could produce a Release app that still connects to the development server.

A practical solution is to make the environment explicit in deployment scripts:

```bash
flutter build ios --release --dart-define=ENV=prod
```

For larger projects, you can also validate allowed environment values.

```dart
static bool get isValidEnv => env == 'dev' || env == 'prod';
```

## Is --dart-define safe for API secrets?

`--dart-define` is useful for environment-specific URLs and feature flags, but it is **not a secure secret-storage mechanism**.

Do not rely on it to protect values such as:

- server passwords
- private API secrets
- private keys
- sensitive authentication tokens

Values shipped inside a client application should generally be considered extractable.

Use `--dart-define` for build-time configuration, not as a secret vault.

## Summary

Flutter build mode and server environment should be treated as separate concerns.

```text
--release
    → controls build and optimization behavior

--dart-define=ENV=dev
    → controls the server environment selected by the app
```

Therefore, this command is completely valid:

```bash
flutter run --release     -d <device-id>     --dart-define=ENV=dev
```

It allows you to test actual Release behavior against a development API. For production, switch the environment to `ENV=prod` without changing the application code.

Separating base URLs from endpoint paths further reduces the number of changes required when moving between development and production environments.
