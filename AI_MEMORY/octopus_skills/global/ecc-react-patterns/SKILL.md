---
name: ecc-react-patterns
description: React/Vite/Tailwind rules: pure render, hooks discipline, state placement, data fetching, forms, a11y.
---
# React patterns
- Render is pure: derive values while rendering, not in useEffect+state. Side effects only in handlers/effects, with cleanup.
- Hooks: top level only; functional updates when new state uses old; skip useMemo/useCallback/React.memo unless measured need; custom hook only when 2+ components share it.
- State placement: local first; lift only as needed; context for rarely changing shared values (split per concern); external store only when clearly needed.
- Data: use TanStack Query or SWR for server data; avoid raw useEffect+fetch (races, no cache).
- Suspense and error boundaries near the data; boundaries don't catch event-handler errors.
- Forms: controlled inputs for live validation; a form library for multi-step or complex forms.
- Lists: stable keys (ids, not index); virtualize past ~50 heavy rows.
- Accessibility: semantic HTML first, keyboard reachable, labels on inputs, manage focus on modals/routes.
- Tailwind: use design tokens/theme values; no magic numbers; check phone width.
