# Prestly

Plataforma de gestión de microcréditos para un prestamista individual (single-tenant). Dos superficies —app móvil de campo y panel de control web— comparten el mismo motor financiero para cotizar préstamos, emitirlos y registrar cobros.

- **Móvil** (`apps/mobile`): calculadora rápida frente al cliente, emisión de préstamos, registro de cobros, directorio de clientes y ruta de cobranza del día.
- **Web** (`apps/web`): centro de control con dashboard de cartera, tablas de amortización, directorio de clientes extendido y configuración de la instalación (moneda, WhatsApp).

La especificación completa del producto (historias de usuario, modelo de datos, fórmulas de amortización) vive en [`spec.md`](spec.md). Cada incremento posterior al MVP tiene su propia spec en [`specs/`](specs), siguiendo la metodología [SpecKit](https://github.com/github/spec-kit) (configuración en [`.specify/`](.specify)).

## Arquitectura

Monorepo con **Turborepo + npm workspaces**:

```
Prestly/
├── apps/
│   ├── web/       # React 19 + Vite + TailwindCSS 4 + TanStack Query + React Router · puerto 5300
│   └── mobile/    # React Native (Expo) + NativeWind + React Navigation
├── packages/
│   ├── core/           # TypeScript puro: motor financiero (cálculo de cuotas, casos de uso). Sin UI, sin DB.
│   ├── ui/              # Componentes compartidos, con entradas separadas para web (./web) y mobile (./native)
│   └── data-supabase/   # Implementaciones concretas de los repositorios de @repo/core contra Supabase
├── supabase/      # Migraciones SQL, seed de datos y configuración del stack local (Supabase CLI)
├── spec.md        # Fuente única de verdad del producto
└── specs/         # Specs incrementales (SpecKit), una carpeta por feature
```

**Regla de dependencia (Inversión de Dependencias):** `apps/*` dependen de `packages/core`, `packages/ui` y `packages/data-supabase`. `packages/core` no importa nada de `apps/*` ni de Supabase — solo define interfaces (`ILoanRepository`, `IClientReader`, `IAppSettingsRepository`, etc.) que `packages/data-supabase` implementa. Esto permite compartir el 100% del cálculo financiero entre web y móvil sin duplicar lógica, y cambiar de proveedor de datos sin tocar las apps.

Base de datos: PostgreSQL vía Supabase, con la cadena relacional **Clientes → Préstamos → Cuotas**. Estados derivados (mora de una cuota, score de confianza de un cliente) se calculan en cada lectura, nunca se guardan como columna. Ver el modelo completo en [`spec.md` §4](spec.md) y las migraciones en [`supabase/migrations/`](supabase/migrations).

## Requisitos previos

- [Node.js](https://nodejs.org/) 20 o superior
- npm (viene con Node; el repo fija `npm@11.6.1` como gestor de paquetes)
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) para levantar la base de datos local (se puede usar sin instalación global vía `npx supabase`)
- Docker Desktop (o equivalente), requerido por Supabase CLI para correr Postgres localmente
- Para probar la app móvil: [Expo Go](https://expo.dev/go) en un dispositivo, un emulador Android/iOS, o simplemente el modo web de Expo

## Instalación

1. **Clonar e instalar dependencias** (instala todos los workspaces de una vez):

   ```bash
   npm install
   ```

2. **Levantar Supabase local** desde `supabase/` (aplica migraciones y el seed de datos de prueba):

   ```bash
   cd supabase
   npx supabase start
   npx supabase db reset
   ```

   `supabase start` imprime la `API URL` y el `anon key` locales — se usan en el paso siguiente. La API queda expuesta en `http://localhost:54321` y la base de datos en el puerto `54322` (ver [`supabase/config.toml`](supabase/config.toml)).

3. **Configurar variables de entorno** en cada app, usando los `.env.example` como plantilla:

   - `apps/web/.env` (Vite las expone con prefijo `VITE_`):
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
   - `apps/mobile/.env.local` (Expo las expone con prefijo `EXPO_PUBLIC_`):
     - `EXPO_PUBLIC_SUPABASE_URL`
     - `EXPO_PUBLIC_SUPABASE_ANON_KEY`

   Para desarrollo local, usá la `API URL` y el `anon key` que imprimió `supabase start`.

4. **Ejecutar la app web** (http://localhost:5300):

   ```bash
   npm run dev -w apps/web
   ```

5. **Ejecutar la app móvil** — modo web de Expo (http://localhost:8081):

   ```bash
   npm run web -w mobile
   ```

   O `npm run start -w mobile` para abrir el bundler de Expo y elegir dispositivo/emulador/Expo Go.

## Scripts disponibles

Desde la raíz, `turbo` orquesta el mismo script en todos los workspaces que lo definan:

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Levanta `apps/web` en modo desarrollo (Vite). `apps/mobile` no define script `dev`: usá `start`/`web`/`android`/`ios` desde su propio workspace |
| `npm run build` | Compila los workspaces que definen script `build` (hoy, solo `apps/web`; `packages/*` se consumen directo desde `src/`, sin paso de build) |
| `npm run test` | Corre los tests de cada workspace (Vitest en web, Jest en mobile/core/data-supabase) |
| `npm run lint` | Corre `oxlint` en cada workspace |
| `npm run type-check` | Corre `tsc` en cada workspace |

Para apuntar a un solo workspace, agregá `-w <nombre>` (por ejemplo `npm run test -w apps/web` o `npm run test -w @repo/core`).

## Estructura de specs

Este proyecto sigue [SpecKit](https://github.com/github/spec-kit): cada incremento de producto tiene su carpeta en `specs/NNN-nombre/` con `spec.md`, `plan.md`, `data-model.md`, `tasks.md`, etc. `spec.md` en la raíz es la especificación fundacional (MVP); las carpetas en `specs/` documentan todo lo agregado después. Antes de cambiar una regla de negocio, de base de datos o de cálculo financiero, esa spec correspondiente debe reflejar el cambio primero.
