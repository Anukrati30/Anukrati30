declare module '@recogito/annotorious-openseadragon' {
  export default class AnnotoriousOSD {
    constructor(opts: { viewer: any });
    on(
      event: 'createAnnotation' | 'updateAnnotation' | 'deleteAnnotation',
      handler: (a: { id?: string } & Record<string, unknown>) => void
    ): void;
    addAnnotation?(a: { id?: string } & Record<string, unknown>): void;
    destroy?(): void;
  }
}
