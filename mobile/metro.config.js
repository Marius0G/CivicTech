// Metro config — adds 3D model extensions so `require('./assets/pip.glb')` bundles the binary.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('glb', 'gltf', 'bin');
// Bundle the cached eligibility form so the autopilot still works if youth.europa.eu is
// slow/down on conference Wi-Fi (require('../assets/eligibility.html') in the WebView source).
config.resolver.assetExts.push('html');

module.exports = config;
