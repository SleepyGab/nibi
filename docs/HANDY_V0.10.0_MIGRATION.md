# Handy v0.10.0 migration

The migration branch `codex/rebase-handy-v0.10.0` rebases nibi's additions onto
the official [Handy v0.10.0 release](https://github.com/cjpais/Handy/releases/tag/v0.10.0).
It preserves merge topology within the fork's development history. The earlier
`nibi` branch is retained separately; this branch does not publish an app update.

## Resolution decisions

| Area                       | Resolution                                                                                                                                                                       | nibi behavior retained                                                                                                                                                                     |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Recognition vocabulary     | Use transcribe.cpp 0.4.0 `RunOptions.vocabulary` and the loaded model's `supports_vocabulary` capability. Remove both vendored 0.2.4 crates and the Qwen ABI patch.              | One Dictionary vocabulary list, validated persistent edits, bounded legacy lists, explicit spelling protection and conservative Mandarin/English fallback for models without native hints. |
| Long recordings            | Use upstream `LiveSession`, `ChunkedDecode`, `Chunker` and `EngineSupervisor`. Remove the old `long_form` implementation and its obsolete evaluation harness.                    | Progressive decoding, tail completion, sample coverage checks and cancellation through the upstream implementation.                                                                        |
| Correction memory          | Apply confirmed rules in the common output stage; capture the destination around the new background paste thread. Start observation only while that recording still owns the UI. | Confirmation before remembering, compact suggestions, manual correction, dictionary persistence and JSON transfer with conflict preview and backup.                                        |
| History and files          | Keep upstream background jobs, progress, cancellation, imported files and language metadata. Save the locally corrected original alongside polished text.                        | Viewing/copying either text version and restoring the original. File jobs do not start accessibility observation.                                                                          |
| Permissions and onboarding | Keep the new upstream screens and model migration. Adapt the existing bounded permission flow to their interface.                                                                | IPC timeouts, non-overlapping checks, focus rechecks, explicit recovery/restart controls and input initialization after Accessibility approval.                                            |
| Text polishing             | Retain the opt-in nibi wrapper in the common post-processing stage. Keep the upstream failure notices and generated IPC bindings.                                                | Separate provider keys, general/meeting/journal modes, configurable wait limits, fallback and original recovery.                                                                           |
| Branding and maintenance   | Keep nibi's application/data identity, artwork, build command, updater restrictions and active workflows. Archive upstream workflows and refresh the upstream README reference.  | Existing settings and dictionaries remain in the same application data location.                                                                                                           |

The upstream implementation decides streaming versus chunking from the loaded
model's capabilities. Its default pause-based chunks target 30 seconds with a
40-second maximum, replacing nibi's 20/25-second planner and three-second audio
overlap. This is a behavior change; the old thresholds and retry algorithm are
not carried over. ONNX models are retired by upstream and use its replacement
model flow. Re-downloads may be necessary; dictionaries are independent of models.

Qwen spelling protection still performs an unhinted pass before a hinted pass.
Both passes now go through the upstream supervised worker with the same
cancellation mark, including when decoding chunks. A spelling explanation keeps
the unhinted result; blank or failed hint results retain the complete original.
Other models use their native vocabulary interface without this extra pass.

## Conflicts and issues beyond conflict markers

A three-way comparison of the original nibi tip and the release found **46
conflicting paths**: 26 locale JSON files and 20 other files. Replaying individual
commits can encounter a path more than once, so this is a count of distinct final
paths, not rebase stops. Locale changes are merged by JSON key so the new upstream
screens and nibi-specific vocabulary/correction/polishing text coexist.

The other conflicting paths were:

```text
.gitattributes
README.md
package.json
src-tauri/Cargo.lock
src-tauri/Cargo.toml
src-tauri/src/actions.rs
src-tauri/src/audio_toolkit/chunking.rs
src-tauri/src/audio_toolkit/vad/earshot.rs
src-tauri/src/commands/history.rs
src-tauri/src/lib.rs
src-tauri/src/managers/transcription.rs
src-tauri/src/tray.rs
src-tauri/tauri.conf.json
src/bindings.ts
src/components/AccessibilityPermissions.tsx
src/components/Sidebar.tsx
src/components/onboarding/AccessibilityOnboarding.tsx
src/components/onboarding/Onboarding.tsx
src/components/settings/advanced/AdvancedSettings.tsx
src/components/settings/history/HistorySettings.tsx
```

Two automatically mergeable changes also required repairs:

- `App.tsx` retained error branches that selected the removed `accessibility`
  onboarding state. Both now select the new returning-permissions screen.
- The new Anthropic dispatch in `llm_client::send_chat_completion` bypassed the
  old guard in `send_chat_completion_with_schema`. The local-only check now runs
  before either API format is dispatched; tests cover both formats and direct
  structured requests.

The old structural checks required vendored Qwen code. They now check the
upstream vocabulary integration and every generic network entry point, alongside
the existing identity, consent, updater and correction protections. IPC bindings
are regenerated from Rust rather than resolved by selecting an older file.

## Remaining consolidation recommendation

The next useful reduction is to share the upstream LLM transport while keeping
nibi's opt-in wrapper and prompts. This migration retains the dedicated transport:
calling the generic upstream client directly would either be blocked by
`local-only` or require loosening its current restriction. A future refactor should
provide an explicit text-polishing entry point and preserve provider-specific
request formats, timeout budgets, redirect handling, truncation checks, separate
keys and failure fallback. The upstream transcription hook is an external-command
integration point; it does not replace Dictionary UI, confirmation memory or
provider settings.

## Validation scope

| Check                                                           | Result                                  |
| --------------------------------------------------------------- | --------------------------------------- |
| Frozen dependency install, frontend build and ESLint            | Passed                                  |
| Prettier and Rust formatting                                    | Passed                                  |
| Fork identity, integration and network guards                   | Passed                                  |
| Upstream synchronization tests / signing helper tests           | 13 / 4 passed                           |
| Rust library tests, `--features local-only`                     | 367 passed; 20 ignored                  |
| Rust library tests, default features                            | 370 passed; 20 ignored                  |
| Clippy, `--features local-only --all-targets`                   | Passed, with existing upstream warnings |
| Rust-generated IPC bindings                                     | Exported successfully                   |
| Browser suite                                                   | 43 passed                               |
| Additional English/Chinese permission layout tests at 720 × 600 | 2 passed                                |
| Archived upstream workflows                                     | All 9 match v0.10.0 exactly             |

The optional full translation consistency check still fails for 23 languages:
each lacks the same 165 nibi-specific keys as the original `4465c03b` tip. A
key-by-key comparison found no newly missing keys in any language. English,
Simplified Chinese and Traditional Chinese are complete; other languages retain
the existing English fallback for fork-specific features.

Browser feature tests use mocked IPC and native unit tests do not establish real microphone, Accessibility,
GPU or long-meeting accuracy. A native smoke test should exercise Fn recording,
paste and confirmed correction, permission recovery, model replacement, long
recording completion/cancellation and polishing/original restoration before a
new installer is released. Existing preview downloads remain unchanged.

## 中文摘要

- 以 Handy v0.10.0 为新基线；保留原 `nibi` 分支，迁移分支不自动发布安装包。
- 词汇提示和长录音采用上游接口，移除旧 Qwen 私有补丁与重复分段实现。
- 保留 nibi 的确认后记忆、词典迁移、中文术语回退、拼写保护、润色模式与原文恢复。
- 共识别到 46 个冲突路径，其中 26 个是翻译文件；另外修复自动合并后残留的旧权限状态和 Anthropic 调用保护缺口。
- 上游默认分段从原来的 20/25 秒调整为 30/40 秒，并提供 ONNX 模型迁移；实际长录音和原生权限仍需发布前手测。
- 润色网络请求实现暂时保留，后续可在保留显式启用与失败回退的前提下复用上游 LLM 传输层。
