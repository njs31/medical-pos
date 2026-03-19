export default {
  appId: 'com.codex.pharmacypos',
  productName: 'Pharmacy POS',
  directories: {
    output: 'release',
  },
  files: ['dist/**/*', 'out/**/*', 'package.json'],
  extraMetadata: {
    main: 'out/main/main.js',
  },
  mac: {
    category: 'public.app-category.business',
    target: ['dmg'],
  },
  win: {
    target: ['nsis'],
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
  },
};
