# 05. Data Architecture, Scene Graph & Storage Schemas

**Product:** EchoForge 3D  
**Storage Layers:** Zustand In-Memory Scene Graph, Client IndexedDB Binary Cache, Supabase PostgreSQL

---

## 1. Zustand 3D Scene Graph State Tree (In-Memory)

The in-memory scene state is managed via Zustand. High-frequency 60 FPS physics and camera matrices are stored as flat dictionary maps to avoid triggering React component re-renders:

```typescript
// src/types/scene-graph.ts
export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface AudioEmitterConfig {
  audioId: string;
  audioUrl: string;
  volume: number;
  refDistance: number;
  maxDistance: number;
  loop: boolean;
}

export interface PhysicsColliderConfig {
  type: 'convex_hull' | 'cuboid' | 'heightfield' | 'none';
  mass: number;
  isStatic: boolean;
}

export interface SceneEntity {
  id: string; // UUID v4
  name: string;
  category: 'terrain' | 'prop' | 'foliage' | 'structure' | 'npc';
  glbUrl?: string;
  position: Vector3D;
  rotation: Vector3D;
  scale: Vector3D;
  physics: PhysicsColliderConfig;
  audioEmitter?: AudioEmitterConfig;
  npcData?: {
    systemPrompt: string;
    voiceName: string;
    dialogueHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  };
  visible: boolean;
  selected: boolean;
}

export interface SceneGraphState {
  sceneId: string;
  projectName: string;
  terrainHeightmapData: Float32Array | null;
  entities: Record<string, SceneEntity>; // Flat key-value map by ID
  selectedEntityId: string | null;
  activeTool: 'select' | 'terrain_brush' | 'spawn_prop' | 'first_person';
  historyPast: Array<Record<string, SceneEntity>>;
  historyFuture: Array<Record<string, SceneEntity>>;
  
  // Actions
  setTerrainHeightmap: (data: Float32Array) => void;
  addEntity: (entity: SceneEntity) => void;
  updateEntityTransform: (id: string, position?: Vector3D, rotation?: Vector3D, scale?: Vector3D) => void;
  removeEntity: (id: string) => void;
  selectEntity: (id: string | null) => void;
  undo: () => void;
  redo: () => void;
}
```

---

## 2. Client-Side IndexedDB Storage Schema (`idb-keyval`)

Large binary files (`.glb` 3D meshes, `.wav` audio buffers, and heightmap tensors) are stored locally in the browser's IndexedDB with an automated Least-Recently-Used (LRU) eviction limit of 500 MB to prevent browser quota rejections:

```
Database Name: EchoForgeLocalStore (Version 1)

Object Stores:
├── Store 1: "scene_meta"
│    └── Key: `project:${projectId}` ──► Value: JSON metadata & scene graph state tree
├── Store 2: "mesh_blobs"
│    └── Key: `glb:${assetHash}`     ──► Value: Blob (application/octet-stream .glb binary)
├── Store 3: "audio_blobs"
│    └── Key: `audio:${audioHash}`   ──► Value: Blob (audio/wav binary buffer)
└── Store 4: "heightmaps"
     └── Key: `terrain:${sceneId}`   ──► Value: ArrayBuffer (Float32Array depth matrix)
```

---

## 3. Remote Relational Database Schema (Supabase / PostgreSQL)

```sql
-- Schema version: 1.0.0

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.scenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    scene_graph_json JSONB NOT NULL,
    heightmap_storage_path TEXT,
    vertex_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    prompt TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('prop', 'foliage', 'structure', 'audio', 'npc')),
    glb_storage_path TEXT,
    audio_storage_path TEXT,
    polygon_count INT,
    bounding_box JSONB,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indices for rapid spatial and project lookup
CREATE INDEX idx_projects_user ON public.projects(user_id);
CREATE INDEX idx_scenes_project ON public.scenes(project_id);
CREATE INDEX idx_assets_project ON public.assets(project_id);
```
