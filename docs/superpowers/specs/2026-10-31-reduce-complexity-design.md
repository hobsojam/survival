# Reduce complexity without changing game behavior

The existing clearing, camp, and food modules form two circular imports. Save validation and build button presentation also combine several independent decisions in single functions. This change makes those relationships easier to follow while preserving gameplay, save version 19, and displayed copy.

## Approach

Keep the current module boundaries where they work. Move the state-level clearing location check into `clearing.ts`, let food use it directly, and put wood accounting in its own small module. Move the food store shape and initializer into a dependency-free module so `state.ts` no longer imports food behavior. Keep camp's exports as a compatibility surface. Split the save validators into checks named for their invariants and the build button view into helpers for cost and blocked descriptions.

Extracting a large geometry package or changing the save schema would add more migration and review risk than this refactor needs. The existing behavior tests remain the main verification, with a dependency-cycle check and a branch-count comparison for the affected functions.

## Constraints

- No gameplay, save format, or UI copy changes.
- No new dependencies.
- Keep public imports usable by existing callers.
- Preserve the existing tests, lint, and build checks.
