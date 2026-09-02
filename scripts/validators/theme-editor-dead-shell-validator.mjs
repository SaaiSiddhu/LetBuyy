import {
  createReporter,
  exists,
  getTrackedFiles,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Theme editor dead shell validator");
const trackedFiles = getTrackedFiles();

const archivedComponents = [
  "EditorHeader",
  "ThemeSettingsPanel",
  "RightSidebar",
  "LeftSidebar",
  "SectionItem",
  "AddSectionModal",
  "IconRail",
];

const archivedHooks = [
  "useEditorUrl",
  "useEditorHistory",
];

for (const component of archivedComponents) {
  reporter.assert(
    !exists(`apps/merchant_web/src/components/theme-editor/${component}.tsx`),
    `theme editor dead shell component ${component}.tsx must stay out of active source`,
  );
  reporter.assert(
    exists(`docs/archive/dead-code/merchant-control-plane/theme-editor/components/${component}.tsx`),
    `theme editor dead shell component ${component}.tsx must be preserved in the archive`,
  );
}

for (const hook of archivedHooks) {
  reporter.assert(
    !exists(`apps/merchant_web/src/hooks/${hook}.ts`),
    `theme editor dead shell hook ${hook}.ts must stay out of active source`,
  );
  reporter.assert(
    exists(`docs/archive/dead-code/merchant-control-plane/theme-editor/hooks/${hook}.ts`),
    `theme editor dead shell hook ${hook}.ts must be preserved in the archive`,
  );
}

reporter.assert(
  exists("apps/merchant_web/src/components/theme-editor/CenterPanel.tsx"),
  "live theme editor CenterPanel must remain active because the editor page imports it",
);
reporter.assert(
  exists("apps/merchant_web/src/components/theme-editor/SchemaFormRenderer.tsx"),
  "live theme editor SchemaFormRenderer must remain active because the editor page imports it",
);

const editorPage = readFile("apps/merchant_web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx");
reporter.assert(
  editorPage.includes("import CenterPanel from '@/components/theme-editor/CenterPanel'"),
  "theme editor page must keep using the live CenterPanel implementation",
);
reporter.assert(
  editorPage.includes("import SchemaFormRenderer from '@/components/theme-editor/SchemaFormRenderer'"),
  "theme editor page must keep using the live SchemaFormRenderer implementation",
);

const forbiddenSpecifiers = [
  ...archivedComponents.flatMap((component) => [
    `@/components/theme-editor/${component}`,
    `./${component}`,
  ]),
  ...archivedHooks.map((hook) => `@/hooks/${hook}`),
];

const activeRefs = trackedFiles.filter((file) => {
  if (!file.startsWith("apps/merchant_web/src/")) return false;
  if (!/\.(?:ts|tsx)$/.test(file)) return false;
  const source = readFile(file);
  return forbiddenSpecifiers.some((specifier) => source.includes(specifier));
});

reporter.assert(
  activeRefs.length === 0,
  `active merchant source must not import archived theme editor shell modules: ${activeRefs.join(", ")}`,
);

reporter.finish("theme-editor dead shell modules are archived outside active source");
