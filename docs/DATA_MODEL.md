# DATA_MODEL.md — Logical Schema v1

**Not executable migrations.** Naming/planned indices; refine in ERD before implementation.

## Core entities
| Table | Core fields | Important constraints |
|---|---|---|
| users | id, email, locale, default_timezone, created_at | unique(email), future owner_id on tenant data |
| authenticators | id, user_id, type, credential_ref, verified_at | secrets encrypted/hashed depending type |
| sessions | id, user_id, device_id, revoked_at, expires_at | refresh token hashes only |
| devices | id, owner_id, platform, install_id, last_seen_at | unique(owner_id, install_id) |
| push_tokens | id, device_id, provider, token_ciphertext, revoked_at | private; rotate |
| projects | id, owner_id, title, color_token, archived_at | owner index |
| tasks | id, owner_id, project_id, parent_task_id, title, description, priority, status, due_at, timezone, version | FK parent; optimistic version |
| tags | id, owner_id, name | unique(owner_id, name) |
| task_tags | task_id, tag_id | unique composite |
| recurrence_rules | id, owner_id, rrule, timezone, starts_local, ends_at | valid IANA + RRULE |
| calendars | id, owner_id, provider, external_calendar_id, sync_status | unique(owner,provider,external_id) |
| calendar_events | id, owner_id, calendar_id, source, external_event_id, etag, starts_at, ends_at, timezone, status, version | unique(calendar, external_event_id) when non-null |
| meetings | id, owner_id, calendar_event_id, provider, external_meeting_id, join_url, provisioning_status | unique(provider,external_meeting_id) |
| connected_accounts | id, owner_id, provider, external_subject, refresh_token_ciphertext, scopes, expires_at | unique(owner,provider,subject) |
| sync_cursors | id, account_id, resource_id, token_ciphertext, status, last_success_at | recover invalid token |
| reminder_rules | id, owner_id, source_type, source_id, offset_minutes, channel_policy, enabled | source validation |
| reminder_occurrences | id, rule_id, occurrence_key, scheduled_for, status, attempt_version | unique(rule_id,occurrence_key) |
| device_alarms | id, device_id, occurrence_id, platform_alarm_id, request_version, status | unique(device_id,occurrence_id) |
| alarm_acknowledgments | id, occurrence_id, actor_device_id, action, acted_at, client_request_id | unique(client_request_id) |
| notification_deliveries | id, occurrence_id, channel, recipient_ref, status, provider_message_id, attempt_count, last_error | dedupe key |
| webhook_inbox | id, provider, external_event_key, received_at, handled_at | unique(provider,event key) |
| outbox_events | id, aggregate_type, aggregate_id, event_type, payload, created_at, delivered_at | polling index pending |
| idempotency_keys | id, owner_id, method, key_hash, request_hash, response_ref, expires_at | unique(owner,method,key_hash) |
| approval_requests | id, owner_id, action, payload_hash, status, expires_at, actor_id | immutable payload / replay-protected |
| approval_decisions | id, request_id, decider_id, decision, decided_at | one terminal decision |
| audit_logs | id, actor_type, actor_id, action, target, trace_id, redacted_metadata, created_at | append-only retention policy |
| workflow_definitions | id, owner_id, revision, graph_json, status | P1, typed graph version |
| workflow_runs | id, definition_id, revision, status, trace_id | P1 |
| agent_runs | id, owner_id, kind, status, model, cost_estimate | P1 |
| tool_invocations | id, run_id, tool_name, proposal_id, status, output_digest | P1 |

## Design notes
- Model event instance vs recurring series. `occurrence_key` deterministic from rule id + original wall-time date/time + timezone.
- Deletion: soft-delete business data where needed; external deletions mirrored via tombstone, retention policy.
- Async create meeting must carry `provisioning_status`; never fabricate join link.
- Optimistic concurrency via `version` or ETag/If-Match to stop lost updates.
- Encrypt provider tokens at rest; backup key management separate.
- Design exact cascade policy in an ADR before migrations: do not delete audit data accidentally.
- Support search indexing later; don't use RAG store as canonical DB.

## Migration rules
Forward-only reviewed migrations, backup before destructive changes, staging rehearsal, no AI-authorized destructive migration, repeatable seeds only with fake data.
