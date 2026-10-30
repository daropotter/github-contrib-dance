import { defineConfig } from 'wxt';

export default defineConfig({
  // WXT defaults Firefox to MV2; both browsers ship the same MV3 extension.
  manifestVersion: 3,
  zip: {
    // Keep local recordings and store artwork out of the AMO source archive.
    includeSources: [
      'entrypoints/**',
      'src/**',
      'public/**',
      'package.json',
      'package-lock.json',
      'tsconfig.json',
      'wxt.config.ts',
      'README.md',
      'LICENSE*',
      'PRIVACY.md',
    ],
  },
  hooks: {
    'build:publicAssets'(wxt, files) {
      for (const name of ['LICENSE', 'PRIVACY.md']) {
        files.push({ absoluteSrc: `${wxt.config.root}/${name}`, relativeDest: name });
      }
    },
  },
  manifest: ({ browser }) => ({
    name: 'Contrib Dance for GitHub',
    description: 'Highlight, dance and disco lights for the GitHub contribution calendar.',
    permissions: ['storage'],
    action: { default_title: 'Contrib Dance for GitHub' },
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          // Keep this ID stable for all future AMO updates.
          id: 'contrib-dance@daropotter.github.io',
          // @property (used for the dance fades) ships in Firefox 128.
          strict_min_version: '128.0',
          data_collection_permissions: { required: ['none'] },
        },
      },
    }),
  }),
});
