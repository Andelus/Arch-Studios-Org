declare module 'draco3dgltf' {
  import type { Extension } from '@gltf-transform/core';

  interface DracoExtension extends Extension {
    EXTENSION_NAME: 'KHR_draco_mesh_compression';
  }

  const draco: DracoExtension;
  export default draco;
}
