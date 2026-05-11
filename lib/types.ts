export type Role = 'admin' | 'editor' | 'field' | 'viewer'
export type LayerPermLevel = 'none' | 'view' | 'edit'
export type GeomType = 'Point' | 'LineString' | 'Polygon'
export type FieldType =
  | 'text' | 'number' | 'boolean' | 'textarea'
  | 'date' | 'time' | 'datetime'
  | 'select' | 'radio' | 'multiselect'
  | 'photo' | 'video' | 'audio' | 'signature'
  | 'gps_lat' | 'gps_lng' | 'gps_alt' | 'gps_speed'
  | 'device_id' | 'device_model' | 'username'
  | 'qrcode'
  | 'formula' | 'counter' | 'color' | 'hidden'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: Role
  created_at: string
  updated_at: string
}

export type PointStyle = 'circle' | 'square' | 'diamond' | 'triangle' | 'star' | 'cross'

export interface Layer {
  id: string
  name: string
  description: string | null
  geom_type: GeomType
  color: string
  fill_color: string
  opacity: number
  visible: boolean
  sort_order: number
  point_style?: PointStyle | null
  point_size?: number | null
  created_by: string | null
  created_at: string
  updated_at: string
  fields?: LayerField[]
}

export interface LayerField {
  id: string
  layer_id: string
  field_name: string
  field_label: string
  field_type: FieldType
  field_options: string[] | null
  required: boolean
  sort_order: number
}

export interface Feature {
  id: string
  layer_id: string
  geometry: GeoJSONGeometry
  properties: Record<string, unknown>
  created_by: string | null
  created_at: string
  updated_at: string
  profile?: { full_name: string | null; email: string }
}

export interface GeoJSONGeometry {
  type: GeomType
  coordinates: unknown
}
