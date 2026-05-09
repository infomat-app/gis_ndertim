export type Role = 'admin' | 'editor' | 'field' | 'viewer'
export type GeomType = 'Point' | 'LineString' | 'Polygon'
export type FieldType = 'text' | 'number' | 'date' | 'select' | 'textarea' | 'boolean'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: Role
  created_at: string
  updated_at: string
}

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
