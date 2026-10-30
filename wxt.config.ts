import { defineConfig } from 'wxt';

export default defineConfig({
  // WXT defaults Firefox to MV2; both browsers ship the same MV3 extension.
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: 'Contrib Dance',
    description: 'Highlight, dance and disco lights for the GitHub contribution calendar.',
    permissions: ['storage'],
    action: { default_title: 'Contrib Dance' },
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          // Placeholder id: replace with the final one before the first AMO upload.
          id: 'contrib-dance@contrib-dance',
          // @property (used for the dance fades) ships in Firefox 128.
          strict_min_version: '128.0',
          data_collection_permissions: { required: ['none'] },
        },
      },
    }),
  }),
});
