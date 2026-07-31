# 2 — Current Work

**The live folder.** Everything else in `_bmad-output/` is either a definition, an input, or
history. This is the only folder that changes as work happens.

| File | What it is |
|---|---|
| `sprint-status.yaml` | Status of all 57 stories. What the BMad skills read. ⚠ **fixed name** |
| `open-items.md` | The one list of open bugs and todos. Start here. |
| `deferred-work.md` | Written by `bmad-code-review` on every run. ⚠ **fixed name, don't merge it** |
| `api-endpoint-registry.md` | Every backend endpoint, one table. |
| `1-4-update-employee-record.md` | A story file — tasks/subtasks for one story. |

**Story files live directly in this folder**, never in a subfolder — BMad's `story_location`
points here. Create them one at a time with `bmad-create-story`, as each story is picked up.
