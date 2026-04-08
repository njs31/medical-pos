export default {
  appId: 'com.codex.pharmacypos',
  productName: 'Pharmacy POS',
  directories: {
    output: 'release',
  },
  files: ['dist/**/*', 'out/**/*', 'package.json'],
  extraResources: [
    {
      from: 'build/seed-data',
      to: 'seed-data',
      filter: ['**/*'],
    },
  ],
  extraMetadata: {
    main: 'out/main/main.js',
  },
  mac: {
    category: 'public.app-category.business',
    target: ['dmg'],
    icon: 'build/icon.png',
  },
  win: {
    target: ['nsis'],
    icon: 'build/icon.png',
  },
  nsis: {
    oneClick: true,
    perMachine: true,
    allowToChangeInstallationDirectory: false,
    deleteAppDataOnUninstall: false,
  },
  publish: {
    provider: 'github',
    owner: 'njs31',
    repo: 'medical-pos',
  },
};
