declare module '@mapbox/shp-write' {
  interface Options {
    outputType?: 'arraybuffer' | 'base64'
    compression?: 'DEFLATE' | 'STORE'
    folder?: string
    types?: { point?: string; polygon?: string; line?: string }
  }
  function zip(geojson: object, options?: Options): Promise<ArrayBuffer>
  const _default: { zip: typeof zip }
  export default _default
}
