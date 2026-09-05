// bundleManifest.mjs — que módulos o esbuild ENGOLIU para dentro dos chunks.
//
// O runtime serve `/_<id>_/l2/**.js` por duas fontes: o `dist/web` (empacotado)
// e, quando o arquivo não existe lá, o `obj/compiled.zip` do projeto (saída crua
// do tsc). Se o mesmo módulo aparece nas duas formas no MESMO documento, são
// duas cópias — identidade de módulo é identidade de URL. Para um módulo comum
// isso duplica estado em silêncio; para um custom element compartilhado,
// `customElements.define` lança e a rota fica morta até o reload.
//
// Este manifesto é o que deixa o fallback do zip recusar o gêmeo (404 alto) sem
// tocar no que nunca foi inlinado num chunk (designSystem.js sai como
// entrypoint próprio; componentes do studio ainda caem no zip).

export const BUNDLED_MODULES_MANIFEST = '_bundled-modules.json';

const INPUT_RE = /^mls-(\d+)\/(l2\/.+)\.(?:ts|tsx|js)$/u;

/**
 * Do metafile do esbuild para as URLs virtuais que o runtime serve.
 * `mls-102020/l2/molecules/ml-scenary.ts` -> `_102020_/l2/molecules/ml-scenary.js`
 */
export function bundledModuleUrls(metafile) {
  const urls = new Set();
  for (const output of Object.values(metafile?.outputs ?? {})) {
    for (const input of Object.keys(output.inputs ?? {})) {
      const match = INPUT_RE.exec(String(input).replaceAll('\\', '/'));
      if (!match) continue;
      urls.add(`_${match[1]}_/${match[2]}.js`);
    }
  }
  return [...urls].sort();
}
