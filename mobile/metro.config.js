// Metro config — adds 3D model extensions so `require('./assets/pip.glb')` bundles the binary.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('glb', 'gltf', 'bin');

module.exports = config;
