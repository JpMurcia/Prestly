# Quickstart: Autenticación del administrador

## Prerrequisitos

- `[auth] enabled = true` y `enable_signup = false` en `supabase/config.toml` (ver `contracts/data-contract.md`), aplicados con `npx supabase db reset` (dentro de `supabase/`) — esto también corre `supabase/seed.sql`, que crea la cuenta `admin@prestly.local` / `Prestly-Dev-007!` (solo desarrollo local — nunca corre contra producción).
- `npm install` (agrega `@react-native-async-storage/async-storage` a `apps/mobile`, vía `npx expo install` — ver research.md §3).
- `apps/web` en `http://localhost:5300` (`npm run dev -w apps/web`) y `apps/mobile` vía `npm run web -w mobile` (`http://localhost:8081`).

## Historia 1 — Acceso protegido en la web

1. Sin haber iniciado sesión, abrir `http://localhost:5300/clientes/algun-id` directo (una ruta interna, no la raíz) → debe mostrar la pantalla de login, no datos de ningún cliente.
2. Ingresar `admin@prestly.local` / `Prestly-Dev-007!` → entra al panel, y `/clientes/algun-id` (u otra pantalla equivalente) se ve exactamente igual que antes de esta feature.
3. Ingresar una contraseña incorrecta → mensaje de error genérico, sin decir si el email existe; permanece en el login.

## Historia 2 — Acceso protegido en móvil

1. Sin sesión activa, abrir la app móvil → pantalla de login antes que cualquier tab (Ruta de hoy / Directorio / Calculadora).
2. Loguearse con las mismas credenciales → directorio, calculadora, perfiles y ruta de cobranza se comportan igual que antes de esta feature.
3. Confirmar que un cambio de moneda hecho desde la web (specs/006-rebrand-currency-polish/) se sigue reflejando al abrir la app móvil autenticada — la autenticación no interfiere con ese flujo.

## Historia 3 — Sesión persistente

1. Logueado en la web, cerrar la pestaña/navegador y volver a abrir `http://localhost:5300` → entra directo al panel, sin pedir credenciales de nuevo.
2. Logueado en móvil, cerrar completamente la app (no solo minimizar) y volver a abrirla → entra directo, sin login de nuevo.

## Historia 4 — Cerrar sesión

1. En la web, usar "Cerrar sesión" (pie de la barra lateral) → vuelve al login; navegar hacia atrás con el botón del navegador no debe mostrar ninguna pantalla protegida.
2. En móvil, usar el botón de cerrar sesión (header de Directorio) → vuelve al login; el directorio/calculadora ya no muestran ningún dato previamente cargado.

## Verificación de que la base de datos rechaza sin sesión (FR-003, el hallazgo original)

Con la base recién reseteada, sin loguearse en ninguna app, probar contra la API REST directo (reemplazar `<anon-key>` por el valor local que imprime `supabase start`):

```bash
curl "http://localhost:54321/rest/v1/clientes?select=*" \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <anon-key>"
```

Antes de esta feature devolvía todas las filas; después debe devolver una lista vacía o un error de permisos (RLS bloqueando `anon`) — **no** datos de clientes. Repetir para `prestamos`, `cuotas`, `cobros`, `configuracion_app`, `notificaciones_whatsapp`, y para el RPC `guardar_configuracion_whatsapp` (debe rechazar sin `Authorization` de una sesión autenticada — antes de esta feature, cualquiera podía sobrescribir la conexión de WhatsApp así).

## Verificación de punta a punta esperada

Todas las historias verificadas contra la base local recién reseteada (`npx supabase db reset`), mismo estándar que fases 1-6. La verificación de rechazo sin sesión (arriba) es la prueba directa de que se cerró el hallazgo del Security Advisor de Supabase que originó esta spec — sin ella, el resto de las historias podría "pasar" en la UI sin que la base de datos esté realmente protegida.
