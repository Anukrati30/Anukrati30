declare module '@recogito/annotorious-openseadragon' {
  type AnnotationJson = { id?: string } & Record<string, unknown>;

  export default class AnnotoriousOSD {
    constructor(opts: { viewer: any });

    on(
      event: 'createAnnotation' | 'updateAnnotation' | 'deleteAnnotation',
      handler: (a: AnnotationJson) => void
    ): void;

    addAnnotation?(a: AnnotationJson): void;
    getAnnotations?(): AnnotationJson[];
    setAnnotations?(a: AnnotationJson[]): void;
    removeAnnotation?(a: AnnotationJson | string): void;

    // Editor and drawing controls
    setDrawingEnabled?(enable: boolean): void;
    setDrawingTool?(shape: 'rect' | 'polygon' | string): void;
    cancelSelected?(): void;

    // Widgets config for built-in editor
    widgets?: Array<any>;
    disableEditor?: boolean;

    destroy?(): void;
  }
}
