export default {
  appId: 'com.codex.pharmacypos',
  productName: 'Pharmacy POS',
  directories: {
    output: 'release',
  },
  files: ['dist/**/*', 'out/**/*', 'package.json'],
  asarUnpack: ['**/supplierFileWorker.mjs'],
  extraResources: [
    {
      from: 'build/seed-data',
      to: 'seed-data',
      filter: ['**/*'],
    },
    {
      from: 'electron/services/supplierFileWorker.mjs',
      to: 'supplierFileWorker.mjs',
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
    target: ['nsis', 'portable'],
    icon: 'build/icon.png',
  },
  portable: {
    artifactName: 'medicall.exe',
  },
  nsis: {
    oneClick: true,
    perMachine: true,
    allowToChangeInstallationDirectory: false,
    deleteAppDataOnUninstall: false,
    artifactName: 'Pharmacy-POS-Setup-${version}.exe',
  },
  publish: {
    provider: 'github',
    owner: 'njs31',
    repo: 'medical-pos',
  },
};
