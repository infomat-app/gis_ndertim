declare module 'shapefile' {
  interface Source {
    read(): Promise<{ done: boolean; value: object | null }>
  }
  export function open(shp: ArrayBuffer, dbf?: ArrayBuffer): Promise<Source>
}
