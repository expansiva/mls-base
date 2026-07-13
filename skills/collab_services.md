# Skill: collab-services (creating and configuring panel services)

How collab.codes **services** work — the widgets that live in the left/right panels of each level
(l0–l7), like servicePreview, serviceProject or serviceExploreProjects. This is a **reference
index**: it points to the real source instead of copying it. Read the referenced file when you need
detail.

## Projects involved

- **Shell (production)** — `mls-102041` (collabInitial): `collab-nav-1/2/3`, `collab-spliter`,
  `collab-page`. Nav-2 shows the service icons; nav-3 instantiates and lays out the service.
- **Bootstrapper** — `mls-100554/l2/collabInit.ts`: collects, prioritizes and dedupes services from
  every project. Loaded after login even in production (`mls-102041/l2/index.ts` injects
  `/_100554_/l2/collabInit.js`).
- **Base class** — `mls-102027/l2/serviceBase.ts` (`ServiceBase`, `IService`, `IServiceMenu`).

## Mental model (read this first)

A service is a Lit component extending `ServiceBase`, identified by a **widget string** and rendered
inside a `collab-nav-3-service` container. Three identifiers MUST agree or things break silently:

1. **Widget string** (registry + `details.widget`) — how the shell finds the file.
2. **Custom element tag** (`@customElement`) — derived from the file's folder + shortName.
3. **File location** (`fileReference` header) — where the file actually lives in the project.

### Widget string formats (both accepted by the platform's `setFullName`)

- Root service: `_<project>_<shortName>` → `_102020_servicePreview`
- Service inside a folder: `_<project>_/l2/<folder>/<shortName>` → `_102020_/l2/aura/services/serviceProject`
  (**with `/l2/`** — validated in the app; the folderless form `_102020_aura/services/x` is wrong).

### Tag derivation (enforced by the editor's validateTagName)

`<kebab-folder-with-'--'>--<kebab-shortName>-<project>`. Examples:
- `l2/servicePreview.ts` → `service-preview-102020`
- `l2/aura/services/serviceProject.ts` → `aura--services--service-project-102020`
Conversion helpers: `mls-102027/l2/utils.ts` (`getPath`, `convertFileNameToTag`,
`convertTagToFileName`) — the canonical, folder-aware implementations. Never hand-roll a
widget→tag regex (that bug lived in collab-nav-1/3 until 2026-07-13).

## Anatomy of a service (minimal)

See `mls-102020/l2/aura/services/serviceBehavior.ts` for a small real example.

```ts
/// <mls fileReference="_102020_/l2/aura/services/serviceExample.ts" enhancement="_102027_/l2/enhancementLit"/>
import { ServiceBase, IService, IToolbarContent, IServiceMenu } from '/_102027_/l2/serviceBase.js';

@customElement('aura--services--service-example-102020')   // must match folder+name
export class ServiceExample102020 extends ServiceBase {
    public details: IService = {
        icon: '&#xf0f6',          // FontAwesome entity shown in nav-2
        state: 'foreground',      // 'background' = pre-instantiated on level enter
        position: 'left',
        tooltip: 'Example',
        visible: true,
        widget: '_102020_/l2/aura/services/serviceExample',  // MUST equal the registry string
        level: [4],
    };
    public menu: IServiceMenu = { title: '', main: {}, tools: {}, tabs: undefined, onClickMain: ... };
    onServiceClick(visible: boolean, reinit: boolean, el: IToolbarContent | null) { /* on show */ }
    createRenderRoot() { return this; }   // light DOM (Tailwind classes work)
    render() { ... }
}
```

Companion files move/rename together: `.less` (top selector = the TAG), optional `.html`.
i18n uses the standard `/// **collab_i18n_start** ... end` block.

## Registration — pluginCollabCoreIndex

Each project exposes services via `getMenus()` returning `mls.plugin.MenuAction[]`
(see `mls-102020/l2/pluginCollabCoreIndex.ts`):

```ts
{ category: 'Services', scope: ['l4ServicesLeft'], priority: 1, auth: ['*'],
  widget: '_102020_/l2/aura/services/serviceExample' }
```

- `scope`: `l<level>Services<Left|Right>` (one entry may list several scopes).
- `priority`: sort order within the panel (lower first).

## Collection, priority and override — collabInit.getServices()

`mls-100554/l2/collabInit.ts` (`getServices`, ~:523):
1. Project list in priority order: **actual project > its dependencies > base project (100554)**.
2. `mls.plugin.loadAll(prj)` then `mls.plugin.getAllMenuActions(prj, { scope })` per level/position.
3. **Dedup by shortName** (`addedShortNames`, via `setFullName(widget).getStorFileBase().shortName`):
   the first project in priority order wins. This is the override contract — a project's
   `serviceExploreProjects` (any folder) replaces the Studio one with the same shortName. Two
   genuinely different services must NOT share a shortName.
4. Result is flattened into strings per level (`left;right`, comma-separated) and handed to
   `collab-nav-1.services`.

## Loading pipeline (what happens at runtime)

1. **nav-1** (`mls-102041/l2/collab-nav-1.ts`, `_mergeData`): for each widget, fetches the service
   JS (`/_<project>_<path>.js`) and extracts the `details = {...}` block statically
   (`_getDetailsService2`, eval — no execution of the component). The result feeds icon/tooltip.
   **Pitfall**: the details are indexed by `d.details.widget` (the string INSIDE the fetched file),
   and looked up by the registry string — if they differ, the icon/tooltip silently never show
   (see TASK-102041-5; the fix is to key by the request widget).
2. **nav-2** (`collab-nav-2.ts`): renders the icons (`_renderItem`); click sets `data-service` on nav-3.
3. **nav-3** (`collab-nav-3.ts`, `_instanceCollabService`): derives the tag via
   `getPath` + `convertFileNameToTag` (102027), `document.createElement(tag)`, and if the custom
   element isn't defined yet, injects `<script type="module" src="/_<project>_/l2/<path>.js">`.
4. **Layout**: nav-3 `_layout` computes the available size (minus the `collab-nav-3-menu` height)
   and sets the `msize` attribute (`width,height,top,left`) on the service child — found by the last
   `--` segment of the tagName starting with `SERVICE-`. `ServiceBase.attributeChangedCallback`
   applies `style.height` + `overflow:auto` when `msize` changes. `visible` toggles trigger
   `nav3.layout()` + `onServiceClick`.

## Checklist — creating a new service

1. Create `serviceX.ts` (+ `.less` with the tag as selector) extending ServiceBase; tag matches
   folder+name; `details.widget` matches what you will register.
2. Register it in the project's `pluginCollabCoreIndex.ts` with the same widget string.
3. If a same-shortName service exists in a lower-priority project (e.g. Studio), yours overrides it.
4. Republish the project + clear the mls.stor cache; check icon in nav-2 and open it.
