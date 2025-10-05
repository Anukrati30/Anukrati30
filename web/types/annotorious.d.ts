declare module '@recogito/annotorious-openseadragon' {
  export type AnnotationJson = { id?: string } & Record<string, unknown>;
  export type AnnotoriousInstance = {
    on: (
      event: 'createAnnotation' | 'updateAnnotation' | 'deleteAnnotation',
      handler: (a: AnnotationJson) => void
    ) => void;
    addAnnotation?: (a: AnnotationJson) => void;
    getAnnotations?: () => AnnotationJson[];
    setAnnotations?: (a: AnnotationJson[]) => void;
    removeAnnotation?: (a: AnnotationJson | string) => void;
    setDrawingEnabled?: (enable: boolean) => void;
    setDrawingTool?: (shape: 'rect' | 'polygon' | string) => void;
    cancelSelected?: () => void;
    widgets?: Array<unknown>;
    disableEditor?: boolean;
    destroy?: () => void;
  };

  // Default export is a function (viewer, config) => instance
  export default function AnnotoriousOSD(
    viewer: any,
    config?: { locale?: string; messages?: Record<string, string> }
  ): AnnotoriousInstance;
}
