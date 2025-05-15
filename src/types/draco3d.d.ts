declare module 'draco3d' {
  interface DracoModule {
    createDecoderModule: () => Promise<any>;
    createEncoderModule: () => Promise<any>;
  }

  const draco3d: DracoModule;
  export default draco3d;
}
