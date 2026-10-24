// Blackspire: what the 3D renderer uses from three.js, bundled by `npm run vendor` into js/vendor/three.js as one
// classic script that defines the global THREE (the game loads plain scripts, with no bundler or modules).
export * from 'three';
export {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
export * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
export {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
export {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
export {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
export {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
export {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
export {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
export {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
