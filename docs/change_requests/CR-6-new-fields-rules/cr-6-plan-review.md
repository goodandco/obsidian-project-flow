# Plan Review — CR-6: Unified fields Schema
Overall the plan is solid and well-structured. I found several issues and gaps that need adjustments before implementation.

## Issues to Fix
1. Lesson targetFolder change is risky — needs a transition strategy

The plan changes lesson's targetFolder from ${parentFolder}/Lessons/${title} to ${module}/Lessons/${title}. This changes the meaning of the field: parentFolder was a full relative path (e.g. Modules/Module 1 - Intro), but module in the plan's fields spec says it's also a full path ("The full module folder path"). This is fine semantically, but:

The backward pass derives requiredFields from fields. The lesson will get requiredFields: ["title", "module"] — dropping parentFolder. Any user who has not overridden lesson and relies on parentFolder in their workflows or templates will break.
The FIELD_DESCRIPTIONS.module in registry.ts:231 currently says "last segment of parentFolder" — this conflicts with the new definition where module is the full path. The plan's Step 5 code uses schema.description ?? schema.resolveHint ?? FIELD_DESCRIPTIONS[key] as fallback, but doesn't mention updating or removing the stale FIELD_DESCRIPTIONS.module entry.
Fix: Add to Step 5 — update FIELD_DESCRIPTIONS.module to match the new semantics, or remove it entirely (the field-level description in fields takes precedence).

2. getEntityRequirementsSummaryForProject() doesn't filter AGENT_RESOLVED_FIELDS

prompts.ts:154-167 — The plan's Step 6 replaces both summary functions with fields-based logic, but doesn't address the existing inconsistency: getEntityRequirementsSummary() (line 83) filters out AGENT_RESOLVED_FIELDS, while getEntityRequirementsSummaryForProject() (line 158) does not. After migration, with parentFolder having role: "parentFolder", this inconsistency is partially mitigated (it'll show as "parentFolder": "required" vs being filtered). The plan should explicitly state how AGENT_RESOLVED_FIELDS interacts with the new fields-based logic — likely role: "parentFolder" fields should be excluded from user-facing summaries, similar to how role: "index" fields are skipped.

Fix: In Step 6's proposed code, add: skip fields with role === "parentFolder" from user-facing requirement summaries (same treatment as role === "index" — agent-resolved, not user-supplied).

3. Backward pass doesn't derive fieldDescriptions

The backward pass in Step 3 derives requiredFields, indexField, and fieldDefaults — but not fieldDescriptions. The entity-create-modal reads et.fieldDescriptions at entity-create-modal.ts:123 to show hints in the form. Without backward-deriving fieldDescriptions, migrated entities will lose their description hints in the modal UI.

Fix: Add to the backward pass: collect { [key]: schema.description } for fields that have a description → set fieldDescriptions.

4. Sprint fieldDefaults backward derivation needs "today" / "today+Nd" format preservation

The sprint entity has fieldDefaults: { startedAt: "today", finishedAt: "today+14d" }. In the new fields spec, these become default: "today" and default: "today+14d". The backward pass converts with String(schema.default), which works. However, the resolveFieldDefaults() function in entity-service.ts parses these expressions. This is fine as-is, just confirming no issue.

5. Missing: name field on migrated entity types

Current defaults include name on every entity (e.g. name: "Task", name: "Sprint"). The plan's Step 2 code snippets for task and lesson don't include name. Ensure name is preserved in all migrated definitions — it's used in the tool description at registry.ts:276 and in the UI.

Fix: The plan's code snippets are partial (showing only the fields block). Make it explicit that name and other existing properties are preserved, only requiredFields/indexField/fieldDescriptions/fieldDefaults are removed.

6. entity-create-modal.ts is not in the affected files list

The modal reads requiredFields, fieldDescriptions, and fieldDefaults directly. The backward pass handles this, but only if normalizeEntityType runs before the modal reads the entity type. The modal gets its entity type via mergeEntityTypes() in registry-merge.ts. The plan places normalizeEntityType inside mergeEntityTypes(), so this should work — but this dependency should be called out explicitly in the plan as a verification item.

7. Step 5 fallback chain: description ?? resolveHint is wrong for tool schemas

The proposed code: schema.description ?? schema.resolveHint ?? FIELD_DESCRIPTIONS[key]. The resolveHint is an instruction to the AI agent ("Call listProjectFiles with..."), not a schema description. Using it as the JSON schema description conflates two different purposes. In the current code, fieldDescriptions.sprint contains the resolveHint-style text, so this is actually consistent with current behavior — but the plan should note this is intentional, not accidental.

## Minor Suggestions
Step 3 forward pass: the code synthesizes type: "string" for all legacy fields. This is fine as a default, but indexField should get type: "number" — the plan already does this correctly.
Step 4: the plan says "no data migration needed." This is correct — just bump the version. But add a comment in the migration noting that normalization happens at merge time, not migration time.

## Summary of Required Plan Adjustments

1	Step 5	Update/remove stale FIELD_DESCRIPTIONS.module entry
2	Step 6	Skip role: "parentFolder" from user-facing requirement summaries
3	Step 3	Add fieldDescriptions to backward pass derivation
4	Step 2	Clarify that name and other existing properties are preserved
5	Step 5	Note that resolveHint as schema description is intentional
6	Verification	Add check that entity-create-modal works via backward-compat path
