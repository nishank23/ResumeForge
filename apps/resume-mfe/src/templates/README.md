# Resume formatting templates

This feature belongs to the existing resume MFE. `registry.ts` holds versioned metadata and exact default appearance; `TemplateGallery.tsx` owns browsing/selection and `templates.css` owns gallery chrome. The paper and server PDF renderer already consume the same bounded appearance fields, so a separate remote would add deployment/runtime complexity without a distinct responsibility.

To add another style, add a unique ID/version/name/category/description and an `EditorAppearance` definition to `RESUME_TEMPLATES`. Use only allowlisted Georgia/Times/Arial fonts and colors, readable typography and validated margin/spacing bounds from `editor-appearance.ts`. The gallery count and cards update automatically. Extend the template test expectation and check long synthetic content, both themes, phone width, selection/history, saved reload and PDF output. Keep sample content synthetic and app decoration out of document rendering.

`templateAppearance` returns an isolated clone; `matchingTemplate` labels exact known appearances, otherwise the inspector says Custom formatting. Save persists the complete appearance snapshot in the existing document/version envelope. Registry ID/version are definition metadata, not new persisted document fields; modifying a preset cannot change historical saved documents. Selection does not change facts or save automatically.

These three templates share the existing single-column layout. Alternate columns/header layouts require a separately approved, versioned shared render contract with browser/server implementations and tests. Workspace/personal reusable presets and executable template uploads are not introduced here.
