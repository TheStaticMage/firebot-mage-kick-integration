# Implementation Plan: Platform-Aware Architecture

## Overview

This plan details the refactoring of platform-aware features into a centralized `firebot-mage-platform-lib` library that supports Twitch, Kick, and YouTube integrations through IPC-based communication.

## Project 1: firebot-mage-platform-lib (New Project)

### Phase 1: Project Foundation

**Task 1.1: Repository Setup**
- [ ] Create GitHub repository `firebot-mage-platform-lib`
- [ ] Initialize with Node.js/TypeScript project structure
- [ ] Set up Git ignore patterns (node_modules, dist, etc.)
- [ ] Create initial README.md with project overview
- [ ] Add LICENSE file

**Task 1.2: Build Configuration**
- [ ] Create `package.json` with dependencies:
  - `@crowbartools/firebot-custom-scripts-types`
  - `typescript`
  - `webpack`, `webpack-cli`
  - `ts-loader`
  - `jest`, `@types/jest`, `ts-jest` (testing)
  - `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`
- [ ] Create `tsconfig.json` with appropriate compiler options
- [ ] Create `webpack.config.js` for bundling to single output file
- [ ] Add npm scripts: `build`, `build:dev`, `test`, `lint`
- [ ] Configure ESLint with rules matching Kick integration conventions

**Task 1.3: Directory Structure**
```
firebot-mage-platform-lib/
├── packages/
│   └── types/              # Shared types package (Task 2.x)
├── src/
│   ├── main.ts            # Entry point
│   ├── platform-library.ts
│   ├── version-manager.ts
│   ├── integration-detector.ts
│   ├── platform-dispatcher.ts
│   ├── platform-detector.ts
│   ├── reflector.ts
│   ├── effects/
│   ├── variables/
│   ├── filters/
│   ├── conditions/
│   ├── restrictions/
│   └── __tests__/
├── package.json
├── tsconfig.json
├── webpack.config.js
└── README.md
```

---

### Phase 2: Shared Types Package

**Task 2.1: Types Package Structure**
- [ ] Create `packages/types/` directory
- [ ] Create `packages/types/package.json`:
  - Name: `@mage-platform-lib/types`
  - Version: `1.0.0`
  - Main: `dist/index.js`
  - Types: `dist/index.d.ts`
- [ ] Create `packages/types/tsconfig.json`
- [ ] Create `packages/types/src/` directory

**Task 2.2: Type Definitions**
- [ ] Create `packages/types/src/version.ts`:
  - Export `PLATFORM_LIB_VERSION = "1.0.0"`
  - Define `PlatformLibVersionInfo` interface
  - Define `IntegrationVersionInfo` interface
- [ ] Create `packages/types/src/operations.ts`:
  - Define `PlatformOperation<TRequest, TResponse>` interface
  - Define `SendChatMessageRequest` interface
  - Define `SendChatMessageResponse` interface
  - Define `GetUserDisplayNameRequest` interface
  - Define `GetUserDisplayNameResponse` interface
  - Define `BanUserRequest` interface
  - Define `TimeoutUserRequest` interface
  - Define `SetStreamTitleRequest` interface
  - Define `SetStreamCategoryRequest` interface
  - Define operation response interfaces
- [ ] Create `packages/types/src/registry.ts`:
  - Define `DetectedIntegration` interface
  - Define registry-related types
- [ ] Create `packages/types/src/index.ts`:
  - Export all types from version, operations, registry

**Task 2.3: Types Package Build & Publish**
- [ ] Add build script to `packages/types/package.json`
- [ ] Test local build with `npm run build`
- [ ] Publish to npm as `@mage-platform-lib/types@1.0.0`
- [ ] Verify package can be installed

---

### Phase 3: Core Infrastructure

**Task 3.1: Version Manager**
- [ ] Create `src/version-manager.ts`
- [ ] Implement `VersionManager` class:
  - `registerIntegration(info: IntegrationVersionInfo): Promise<boolean>`
  - `deregisterIntegration(platformId: string): void`
  - `isIntegrationRegistered(platformId: string): boolean`
  - `getIntegrationInfo(platformId: string): IntegrationVersionInfo | null`
  - `isVersionCompatible(required: string, current: string): boolean` (semver)
  - `getMissingRequiredOperations(info: IntegrationVersionInfo): string[]`
  - `clear(): void`
- [ ] Add logging for registration events
- [ ] Create `src/__tests__/version-manager.test.ts`

**Task 3.2: Integration Detector**
- [ ] Create `src/integration-detector.ts`
- [ ] Implement `IntegrationDetector` class:
  - `detectInstalledIntegrations(): Promise<void>` (calls getStartupScripts)
  - `identifyIntegration(scriptData): { platform: string } | null` (pattern matching)
  - `isIntegrationDetected(platform: string): boolean`
  - `isIntegrationRegistered(platform: string): boolean`
  - `registerIntegration(info: IntegrationVersionInfo): Promise<boolean>`
  - `getAvailablePlatforms(): string[]` (includes "twitch" always)
- [ ] Implement script name pattern matching:
  - Platform-lib: `/platform.?lib/i`
  - Kick: `/kick/i`
  - YouTube: `/youtube/i`
- [ ] Add logging for detection results
- [ ] Create `src/__tests__/integration-detector.test.ts`

**Task 3.3: Platform Detector**
- [ ] Create `src/platform-detector.ts`
- [ ] Move `platformVariable` logic from Kick integration
- [ ] Implement `PlatformDetector` class:
  - `detectPlatform(trigger: Trigger): string`
  - Use hierarchical detection strategy:
    1. Explicit `metadata.eventData.platform` or `metadata.platform`
    2. Event source ID (`eventSource.id`)
    3. Chat message user ID/username patterns
    4. Event data user ID/username patterns
    5. Top-level metadata username patterns
    6. Fallback to "unknown"
- [ ] Add debug logging (skip in test environment)
- [ ] Create `src/__tests__/platform-detector.test.ts`

---

### Phase 4: Platform Dispatcher

**Task 4.1: Platform Dispatcher Core**
- [ ] Create `src/platform-dispatcher.ts`
- [ ] Implement `PlatformDispatcher` class:
  - Constructor: `(versionManager, frontendCommunicator, modules, logger)`
  - `dispatch<TRequest, TResponse>(platform, operation, request): Promise<TResponse>`
  - `dispatchToTwitch<TRequest, TResponse>(operation, request): Promise<TResponse>`
  - `dispatchToIntegration<TRequest, TResponse>(platform, operation, request): Promise<TResponse>`
  - `getIntegrationName(platform: string): string`

**Task 4.2: Twitch Direct Calls**
- [ ] Implement Twitch operation handlers:
  - `sendTwitchChatMessage(request: SendChatMessageRequest): Promise<SendChatMessageResponse>`
  - `getTwitchUserDisplayName(request: GetUserDisplayNameRequest): Promise<GetUserDisplayNameResponse>`
  - `banTwitchUser(request: BanUserRequest): Promise<{success: boolean; error?: string}>`
  - `timeoutTwitchUser(request: TimeoutUserRequest): Promise<{success: boolean; error?: string}>`
  - `setTwitchStreamTitle(request: SetStreamTitleRequest): Promise<{success: boolean; error?: string}>`
  - `setTwitchStreamCategory(request: SetStreamCategoryRequest): Promise<{success: boolean; error?: string}>`
- [ ] Access Firebot modules directly (twitchChat, twitchApi, viewerDatabase)
- [ ] Add error handling and logging

**Task 4.3: Integration IPC Dispatch**
- [ ] Implement integration event name builder: `${integrationName}:${operation}`
- [ ] Add validation for registered integrations before dispatch
- [ ] Add error handling for missing handlers
- [ ] Add timeout handling for IPC calls
- [ ] Create `src/__tests__/platform-dispatcher.test.ts`

---

### Phase 5: Frontend Reflector

**Task 5.1: Reflector Implementation**
- [ ] Create `src/reflector.ts`
- [ ] Implement `FrontendReflector` class:
  - `initialize(): void`
  - `setupReflectorExtension(): void`
  - `shutdown(): void`
- [ ] Create UI extension definition:
  - ID: `"platform-lib-reflector"`
  - No visible template (hidden div)
  - Controller with IPC handlers

**Task 5.2: IPC Handlers**
- [ ] Register handler: `platform-lib:reflect` → forwards to `platform-lib:dispatch`
- [ ] Register handler: `platform-lib:get-available-platforms` → forwards to `platform-lib:query-platforms`
- [ ] Add error handling for reflection failures
- [ ] Add logging for reflector initialization

---

### Phase 6: Platform-Aware Features

**Task 6.1: Platform Variable**
- [ ] Create `src/variables/platform.ts`
- [ ] Move implementation from Kick integration
- [ ] Export `platformVariable: ReplaceVariable`
- [ ] Use `PlatformDetector` internally
- [ ] Create `src/variables/__tests__/platform.test.ts`

**Task 6.2: Platform-Aware User Display Name Variable**
- [ ] Create `src/variables/platform-aware-user-display-name.ts`
- [ ] Implement variable using `PlatformDispatcher`
- [ ] Call `get-user-display-name` operation for detected platform
- [ ] Handle fallbacks (event data, chat message metadata)
- [ ] Create `src/variables/__tests__/platform-aware-user-display-name.test.ts`

**Task 6.3: Platform Filter**
- [ ] Create `src/filters/platform.ts`
- [ ] Move implementation from Kick integration
- [ ] Use `PlatformDetector` in predicate
- [ ] Support values: "kick", "twitch", "youtube", "unknown"
- [ ] Create `src/filters/__tests__/platform.test.ts`

**Task 6.4: Platform Condition**
- [ ] Create `src/conditions/platform.ts`
- [ ] Move implementation from Kick integration
- [ ] Use `PlatformDetector` in predicate
- [ ] Support comparisons: "is", "isNot"
- [ ] Support values: "kick", "twitch", "youtube", "any"
- [ ] Create `src/conditions/__tests__/platform.test.ts`

**Task 6.5: Platform Restriction**
- [ ] Create `src/restrictions/platform.ts`
- [ ] Move implementation from Kick integration
- [ ] Use `PlatformDetector` in predicate
- [ ] Support comparisons: "is", "isNot"
- [ ] Support values: "any", "kick", "twitch", "youtube", "unknown"
- [ ] Create `src/restrictions/__tests__/platform.test.ts`

**Task 6.6: Platform-Aware Chat Effect**
- [ ] Create `src/effects/chat-platform.ts`
- [ ] Implement effect factory function: `create(integrationDetector, platformDispatcher, logger)`
- [ ] Implement dynamic template generation: `generateDynamicTemplate(integrationDetector)`
  - Always include Twitch section
  - Conditionally include Kick section if detected
  - Conditionally include YouTube section if detected
  - Include platform-specific settings for each
  - Include unknown trigger handling
- [ ] Implement `optionsController`:
  - Query available platforms via `platform-lib:get-available-platforms`
  - Initialize defaults with `createDefaultEffect(platforms)`
- [ ] Implement `optionsValidator`:
  - Validate required messages per platform
- [ ] Implement `onTriggerEvent`:
  - Detect platform from trigger
  - Determine target platforms based on send settings
  - Dispatch to each target platform
  - Handle errors gracefully (log and continue)
- [ ] Helper functions:
  - `determinePlatformTargets(platform, effect, integrationDetector): string[]`
  - `getMessageForPlatform(platform, effect): string`
  - `getReplyIdForPlatform(platform, trigger, effect): string | undefined`
  - `capitalize(str): string`
- [ ] Create `src/effects/__tests__/chat-platform.test.ts`

---

### Phase 7: Main Script & Registration

**Task 7.1: Platform Library Class**
- [ ] Create `src/platform-library.ts`
- [ ] Implement `PlatformLibrary` class:
  - Constructor: `(logger, modules, debug)`
  - `initialize(): Promise<void>`
  - `setupVerificationHandlers(): void`
  - `setupRegistrationHandlers(): void`
  - `setupDispatchHandlers(): void`
  - `registerFeatures(): void`
  - `shutdown(): void`

**Task 7.2: IPC Handler Setup**
- [ ] Register handler: `platform-lib:ping` → returns `{loaded: true, version}`
- [ ] Register handler: `platform-lib:get-version` → returns `PLATFORM_LIB_VERSION`
- [ ] Register handler: `platform-lib:register-integration` → calls `integrationDetector.registerIntegration()`
- [ ] Register handler: `platform-lib:deregister-integration` → calls `integrationDetector.deregisterIntegration()`
- [ ] Register handler: `platform-lib:dispatch` → calls `platformDispatcher.dispatch()`
- [ ] Register handler: `platform-lib:query-platforms` → calls `integrationDetector.getAvailablePlatforms()`

**Task 7.3: Feature Registration**
- [ ] Register `platformVariable` with `replaceVariableManager`
- [ ] Register `platformAwareUserDisplayNameVariable` with `replaceVariableManager`
- [ ] Register `platformFilter` with `eventFilterManager`
- [ ] Register `chatPlatformEffect` with `effectManager`
- [ ] Add logging for successful registration

**Task 7.4: Main Entry Point**
- [ ] Create `src/main.ts`
- [ ] Implement `getScriptManifest()`:
  - Name: "Platform Library"
  - Description: "Shared platform-aware logic for multi-platform streaming"
  - Author: "TheMagicMan"
  - Version: from `PLATFORM_LIB_VERSION`
  - firebotVersion: "5"
  - startupOnly: true
- [ ] Implement `getDefaultParameters()`:
  - debug: boolean (default: false)
- [ ] Implement `run(runRequest)`:
  - Extract logger, modules, parameters
  - Create `PlatformLibrary` instance
  - Call `initialize()`
  - Return stop function that calls `shutdown()`
- [ ] Add top-level error handling

---

### Phase 8: Testing

**Task 8.1: Unit Tests**
- [ ] Test `VersionManager`: registration, version compatibility, deregistration
- [ ] Test `IntegrationDetector`: script pattern matching, platform detection
- [ ] Test `PlatformDetector`: all detection scenarios from trigger metadata
- [ ] Test `PlatformDispatcher`: routing to Twitch vs integrations
- [ ] Test platform variable: various trigger types
- [ ] Test platform filter: filtering logic
- [ ] Test platform condition: conditional logic
- [ ] Test platform restriction: restriction logic

**Task 8.2: Integration Tests**
- [ ] Test full initialization flow with mock Firebot modules
- [ ] Test IPC handler registration and responses
- [ ] Test integration registration flow
- [ ] Test platform-aware chat effect execution with mocked dispatch

**Task 8.3: Test Coverage**
- [ ] Run `npm test` with coverage report
- [ ] Ensure >80% code coverage
- [ ] Document untested edge cases

---

### Phase 9: Documentation

**Task 9.1: README**
- [ ] Project overview and purpose
- [ ] Installation instructions
- [ ] Dependencies (requires Firebot 5)
- [ ] Configuration (startup script parameters)
- [ ] Supported platforms (Twitch, Kick, YouTube)
- [ ] Version compatibility information

**Task 9.2: Integration Developer Guide**
- [ ] Create `doc/integration-guide.md`
- [ ] Document IPC operation contracts
- [ ] Document registration protocol
- [ ] Provide code examples for implementing handlers
- [ ] List all supported operations with request/response types
- [ ] Version compatibility requirements

**Task 9.3: User Guide**
- [ ] Create `doc/user-guide.md`
- [ ] Installation steps
- [ ] How to verify it's working
- [ ] Platform-aware effects usage
- [ ] Platform-aware variables usage
- [ ] Troubleshooting common issues

**Task 9.4: API Documentation**
- [ ] Create `doc/api.md`
- [ ] Document all IPC events
- [ ] Document operation interfaces
- [ ] Document version negotiation
- [ ] Document error codes and handling

---

## Project 2: firebot-mage-kick-integration (Refactoring)

### Phase 1: Dependencies Update

**Task 1.1: Package Updates**
- [ ] Add `@mage-platform-lib/types` to dependencies in `package.json`
- [ ] Run `npm install` to install new dependency
- [ ] Update any conflicting TypeScript types

**Task 1.2: Import Updates**
- [ ] Update imports to use `@mage-platform-lib/types`:
  - `IntegrationVersionInfo`
  - `SendChatMessageRequest`
  - `SendChatMessageResponse`
  - `GetUserDisplayNameRequest`
  - `GetUserDisplayNameResponse`
  - Other operation types as needed

---

### Phase 2: Platform-Lib Checker

**Task 2.1: Platform-Lib Checker Implementation**
- [ ] Create `src/platform-lib-checker.ts`
- [ ] Implement `PlatformLibChecker` class:
  - `static checkPlatformLibInstalled(frontendCommunicator, logger): Promise<{installed: boolean; version?: string}>`
  - `static findPlatformLib(startupScripts): any | null` (pattern matching)
  - `static verifyVersionCompatible(frontendCommunicator, logger, requiredVersion): Promise<boolean>`
- [ ] Use `getStartupScripts` IPC call
- [ ] Use `platform-lib:ping` IPC call
- [ ] Add logging for detection and verification
- [ ] Create `src/__tests__/platform-lib-checker.test.ts`

---

### Phase 3: Platform Operation Handlers

**Task 3.1: Platform Handlers Module**
- [ ] Create `src/platform-handlers.ts`
- [ ] Implement `registerPlatformHandlers(frontendCommunicator, logger)` function
- [ ] Move handler registration code to init phase (no dependencies on integration singleton)

**Task 3.2: Chat Operation Handler**
- [ ] Register handler: `mage-kick-integration:send-chat-message`
- [ ] Accept `SendChatMessageRequest`
- [ ] Call `integration.kick.chatManager.sendKickChatMessage()`
- [ ] Return `SendChatMessageResponse` with success/error
- [ ] Add error handling and logging

**Task 3.3: User Display Name Handler**
- [ ] Register handler: `mage-kick-integration:get-user-display-name`
- [ ] Accept `GetUserDisplayNameRequest`
- [ ] Call `integration.kick.userManager.getViewerByUsername()`
- [ ] Return `GetUserDisplayNameResponse` with displayName or null
- [ ] Handle unkickified usernames

**Task 3.4: Moderation Handlers**
- [ ] Register handler: `mage-kick-integration:ban-user`
- [ ] Accept `BanUserRequest`
- [ ] Call `integration.kick.userApi.banUserByUsername()` with duration=0
- [ ] Return success/error response
- [ ] Register handler: `mage-kick-integration:timeout-user`
- [ ] Accept `TimeoutUserRequest`
- [ ] Call `integration.kick.userApi.banUserByUsername()` with specified duration
- [ ] Return success/error response

**Task 3.5: Stream Management Handlers**
- [ ] Register handler: `mage-kick-integration:set-stream-title`
- [ ] Accept `SetStreamTitleRequest`
- [ ] Call `integration.kick.streamApi.setStreamTitle()`
- [ ] Return success/error response
- [ ] Register handler: `mage-kick-integration:set-stream-category`
- [ ] Accept `SetStreamCategoryRequest`
- [ ] Call `integration.kick.streamApi.setStreamCategory()`
- [ ] Return success/error response

**Task 3.6: Handler Tests**
- [ ] Create `src/__tests__/platform-handlers.test.ts`
- [ ] Test each handler with mock requests
- [ ] Test error handling scenarios

---

### Phase 4: Integration Init/Connect Update

**Task 4.1: Update initDependencies**
- [ ] Open `src/integration.ts`
- [ ] In `initDependencies` function:
  - [ ] Import `PlatformLibChecker`
  - [ ] Call `PlatformLibChecker.checkPlatformLibInstalled()`
  - [ ] If not installed, throw error with user-friendly message
  - [ ] Call `PlatformLibChecker.verifyVersionCompatible()` with "^1.0.0"
  - [ ] If incompatible, throw error with version mismatch message
  - [ ] Call `registerPlatformHandlers()` to set up IPC handlers
  - [ ] Call `frontendCommunicator.fireEventAsync("platform-lib:register-integration", registrationInfo)`
  - [ ] If registration fails, throw error
  - [ ] Add logging for each step

**Task 4.2: Update connectDependencies**
- [ ] Simplify `connectDependencies` (platform-lib already verified)
- [ ] Just call `integration.connect()` as before
- [ ] Remove any platform-lib verification (now in init)

**Task 4.3: Update disconnectDependencies**
- [ ] Add call to `frontendCommunicator.fireEventAsync("platform-lib:deregister-integration", {integrationId: "kick"})`
- [ ] Continue with existing disconnect logic

**Task 4.4: Integration Registration Info**
- [ ] Define `IntegrationVersionInfo` object:
  ```typescript
  {
    integrationId: "kick",
    integrationName: "mage-kick-integration",
    platformLibVersion: "^1.0.0",
    supportedOperations: [
      "send-chat-message",
      "get-user-display-name",
      "ban-user",
      "timeout-user",
      "set-stream-title",
      "set-stream-category"
    ]
  }
  ```

---

### Phase 5: Remove Platform-Aware Features

**Task 5.1: Remove Platform Variable**
- [ ] Delete `src/variables/platform.ts` (moved to platform-lib)
- [ ] Remove from `IntegrationDefinition` in `src/integration-singleton.ts`
- [ ] Update any internal usages to call platform-lib instead

**Task 5.2: Remove Platform-Aware User Display Name**
- [ ] Delete `src/variables/platform-aware-user-display-name.ts` (moved to platform-lib)
- [ ] Remove from `IntegrationDefinition` in `src/integration-singleton.ts`

**Task 5.3: Remove Platform Filter**
- [ ] Delete `src/filters/platform.ts` (moved to platform-lib)
- [ ] Remove from `IntegrationDefinition` in `src/integration-singleton.ts`

**Task 5.4: Remove Platform Condition**
- [ ] Delete `src/conditions/platform.ts` (moved to platform-lib)
- [ ] Remove from `IntegrationDefinition` in `src/integration-singleton.ts`

**Task 5.5: Remove Platform Restriction**
- [ ] Delete `src/restrictions/platform.ts` (moved to platform-lib)
- [ ] Remove from `IntegrationDefinition` in `src/integration-singleton.ts`

**Task 5.6: Remove Platform-Aware Chat Effect**
- [ ] Delete `src/effects/chat-platform.ts` (moved to platform-lib)
- [ ] Remove from `IntegrationDefinition` in `src/integration-singleton.ts`

**Task 5.7: Clean Up Tests**
- [ ] Delete test files for removed features:
  - `src/variables/__tests__/platform.test.ts`
  - `src/variables/__tests__/platform-aware-user-display-name.test.ts`
  - `src/filters/__tests__/platform.test.ts`
  - `src/conditions/__tests__/platform.test.ts`
  - `src/restrictions/__tests__/platform.test.ts`
  - `src/effects/__tests__/chat-platform.test.ts`

---

### Phase 6: Update Existing Effects (Optional)

**Task 6.1: Review Kick-Specific Effects**
- [ ] Review `src/effects/chat.ts` (Kick-only chat effect)
- [ ] Determine if it should remain Kick-specific or be removed (replaced by platform-aware version)
- [ ] Document decision in CLAUDE.md

**Task 6.2: Update Effect Documentation**
- [ ] Update effect descriptions to clarify Kick-specific vs platform-aware
- [ ] Add tooltips/help text pointing to platform-aware alternatives

---

### Phase 7: Testing

**Task 7.1: Update Existing Tests**
- [ ] Update integration tests to mock platform-lib presence
- [ ] Mock `getStartupScripts` response to include platform-lib
- [ ] Mock `platform-lib:ping` response
- [ ] Mock `platform-lib:register-integration` response

**Task 7.2: Test Platform Handlers**
- [ ] Test each platform handler with real integration code (not just mocks)
- [ ] Test error scenarios (missing integration, failed operations)
- [ ] Test handler responses match expected types

**Task 7.3: Test Init/Connect Flow**
- [ ] Test successful init with platform-lib present
- [ ] Test failed init when platform-lib missing
- [ ] Test failed init with incompatible platform-lib version
- [ ] Test successful registration
- [ ] Test failed registration

**Task 7.4: Integration Tests**
- [ ] Test full initialization → connection → operation flow
- [ ] Test deregistration on disconnect
- [ ] Test IPC communication with mocked platform-lib

**Task 7.5: E2E Tests**
- [ ] Test with actual platform-lib loaded (manual testing)
- [ ] Verify chat messages send through platform-aware effect
- [ ] Verify platform detection works correctly
- [ ] Verify multi-platform scenarios (if YouTube available)

---

### Phase 8: Documentation Updates

**Task 8.1: Update CLAUDE.md**
- [ ] Document platform-lib dependency requirement
- [ ] Document platform handler implementation pattern
- [ ] Update learnings about IPC communication
- [ ] Document version compatibility strategy
- [ ] Remove documentation about removed platform-aware features

**Task 8.2: Update README.md**
- [ ] Add "Dependencies" section listing platform-lib requirement
- [ ] Add installation instructions (install platform-lib first)
- [ ] Document version compatibility (e.g., "requires platform-lib ^1.0.0")
- [ ] Update feature list (remove platform-aware features, note they're in platform-lib)

**Task 8.3: Create Migration Guide**
- [ ] Create `doc/migration-to-platform-lib.md`
- [ ] Document breaking changes for existing users
- [ ] Provide step-by-step migration instructions:
  1. Install platform-lib as startup script
  2. Update Kick integration to new version
  3. Restart Firebot
  4. Verify both loaded successfully
- [ ] Troubleshooting section for common issues

**Task 8.4: Update Integration Definition**
- [ ] Update `IntegrationDefinition` description to mention platform-lib
- [ ] Update version number (breaking change - bump major version)

---

## Project 3: Cross-Project Integration Testing

### Phase 1: Manual Testing

**Task 1.1: Fresh Installation Test**
- [ ] Fresh Firebot installation
- [ ] Install platform-lib only → verify loads
- [ ] Install Kick integration → verify init fails with helpful error
- [ ] Install platform-lib → verify Kick init succeeds
- [ ] Test platform-aware chat effect with Kick
- [ ] Test platform detection from Kick events

**Task 1.2: Version Compatibility Test**
- [ ] Install platform-lib v1.0.0
- [ ] Install Kick integration requiring ^1.0.0 → verify success
- [ ] Update platform-lib to v1.1.0 → verify still works
- [ ] Update platform-lib to v2.0.0 → verify Kick fails with version error
- [ ] Downgrade to v1.x → verify works again

**Task 1.3: Multi-Platform Test (when YouTube ready)**
- [ ] Install platform-lib + Kick + YouTube
- [ ] Verify all three detected and registered
- [ ] Test platform-aware chat effect shows Twitch, Kick, YouTube options
- [ ] Send message from Kick → verify routes to Kick
- [ ] Send message from YouTube → verify routes to YouTube
- [ ] Test "always send to all platforms" mode

### Phase 2: Error Scenario Testing

**Task 2.1: Missing Platform-Lib**
- [ ] Install Kick without platform-lib
- [ ] Verify helpful error message on init
- [ ] Verify error points to installation instructions

**Task 2.2: Platform-Lib Fails to Initialize**
- [ ] Introduce error in platform-lib init
- [ ] Verify Kick integration detects failure (ping fails)
- [ ] Verify helpful error message

**Task 2.3: Handler Missing**
- [ ] Remove a handler from Kick integration
- [ ] Trigger operation that requires that handler
- [ ] Verify platform-lib logs error
- [ ] Verify graceful degradation (other operations still work)

**Task 2.4: Network/IPC Timeout**
- [ ] Simulate slow IPC response
- [ ] Verify timeout handling
- [ ] Verify error logging

---

## Implementation Order & Dependencies

### Recommended Implementation Sequence

**Week 1: Foundation**
1. Platform-lib: Phase 1 (Project setup)
2. Platform-lib: Phase 2 (Shared types package)
3. Platform-lib: Phase 3 (Core infrastructure)

**Week 2: Dispatching & Communication**
4. Platform-lib: Phase 4 (Platform dispatcher)
5. Platform-lib: Phase 5 (Frontend reflector)
6. Platform-lib: Phase 7 (Main script & registration)

**Week 3: Features**
7. Platform-lib: Phase 6 (Platform-aware features)
8. Platform-lib: Phase 8 (Testing)

**Week 4: Kick Integration Refactoring**
9. Kick: Phase 1 (Dependencies update)
10. Kick: Phase 2 (Platform-lib checker)
11. Kick: Phase 3 (Platform handlers)
12. Kick: Phase 4 (Init/connect update)

**Week 5: Cleanup & Testing**
13. Kick: Phase 5 (Remove platform-aware features)
14. Kick: Phase 6 (Update existing effects - optional)
15. Kick: Phase 7 (Testing)
16. Cross-project: Phase 2 (Error scenarios)

**Week 6: Documentation & Release**
17. Platform-lib: Phase 9 (Documentation)
18. Kick: Phase 8 (Documentation)
19. Cross-project: Phase 1 (Manual testing)
20. Final release preparation

---

## Critical Dependencies

### Platform-Lib Must Complete Before Kick Refactoring:
- Phase 2 (Shared types package published to npm)
- Phase 3.1 (Version manager)
- Phase 3.2 (Integration detector)
- Phase 7 (IPC handlers registered)

### Kick Can Start After:
- Types package published (`@mage-platform-lib/types@1.0.0`)
- Platform-lib IPC contract defined (doesn't need to be fully implemented)

### Parallel Work Possible:
- Platform-lib Phase 4-6 (features) can be developed while Kick Phase 1-3 (setup) happens
- Documentation can be written alongside implementation

---

## Success Criteria

### Platform-Lib
- Builds successfully with webpack
- All tests pass with >80% coverage
- Loads as Firebot startup script without errors
- Detects installed integrations via getStartupScripts
- Registers platform-aware effects with dynamic UI
- Dispatches operations to Twitch and integrations
- Types package published to npm

### Kick Integration
- Builds successfully with webpack
- All tests pass with >80% coverage
- Fails gracefully when platform-lib missing
- Registers successfully with platform-lib when present
- All platform handlers respond correctly
- Existing Kick-specific functionality still works
- Platform-aware features removed (delegated to platform-lib)

### Integration
- Platform-lib + Kick work together end-to-end
- Chat messages route correctly through platform-lib
- User display names resolve correctly
- Effect UI shows/hides platforms based on detection
- Version incompatibility detected and reported
- Error messages are user-friendly
