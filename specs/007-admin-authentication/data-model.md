# Data Model: Autenticación del administrador

Esta fase no agrega ninguna entidad de negocio nueva (Cliente/Préstamo/Cuota siguen intactas, spec.md raíz §4). El único "dato" nuevo es la cuenta administradora, que vive enteramente en el esquema `auth` administrado por Supabase — la app nunca crea ni modifica esa tabla directamente (research.md §7).

## Cuenta de administrador (`auth.users`, gestionada por Supabase — sin migración de esquema propia)

| Campo (relevante) | Origen |
|---|---|
| `email` | ingresado al aprovisionar la cuenta (dashboard en producción, seed en local) |
| `encrypted_password` | generado por GoTrue (producción) o por `crypt()`/`pgcrypto` (seed local) — nunca calculado ni visto por el código de la app |
| `id` (UUID) | lo asigna `auth.users`; no se referencia desde `clientes`/`prestamos`/`cuotas` (sin aislamiento por usuario, research.md §4) |

No se crea una tabla `usuarios`/`administradores` propia — sería duplicar lo que `auth.users` ya resuelve, para una sola cuenta (Principio V, YAGNI).

## Cambios de seguridad sobre el esquema existente

Ninguna tabla de negocio cambia de columnas. Lo que cambia es quién puede leerlas/escribirlas:

| Objeto | Tipo | Cambio |
|---|---|---|
| `clientes` | tabla | `ENABLE ROW LEVEL SECURITY` + policy `FOR ALL TO authenticated USING (true) WITH CHECK (true)` |
| `prestamos` | tabla | ídem |
| `cuotas` | tabla | ídem |
| `cobros` | tabla | ídem |
| `configuracion_app` | tabla | ídem |
| `notificaciones_whatsapp` | tabla | ídem |
| `cliente_score` | vista | `SET (security_invoker = true)` |
| `cartera_resumen` | vista | `SET (security_invoker = true)` |
| `cartera_tendencia_mensual` | vista | `SET (security_invoker = true)` |
| `emitir_prestamo(...)` | función | `REVOKE EXECUTE ... FROM PUBLIC, anon` (queda solo `authenticated`, único `GRANT` directo restante — research.md §6) |
| `registrar_cobro(UUID, NUMERIC)` | función | ídem |
| `liquidar_prestamo(UUID)` | función | ídem |
| `estado_configuracion_whatsapp()` | función `SECURITY DEFINER` | ídem |
| `guardar_configuracion_whatsapp(TEXT, TEXT, TEXT)` | función `SECURITY DEFINER` | ídem |
| `borrar_configuracion_whatsapp()` | función `SECURITY DEFINER` | ídem |

Ver research.md §4-§6 para el porqué de cada fila, especialmente las 3 funciones `SECURITY DEFINER` de WhatsApp (hoy alcanzables sin sesión, aunque las tablas tengan RLS).

## Sesión (en memoria de cada app, no persistida por la app misma)

No es una tabla — es el estado que expone `supabase-js` (`Session`: `access_token`, `refresh_token`, `user`, `expires_at`), persistido por la propia librería en `localStorage` (web) o `AsyncStorage` (mobile) vía el adaptador de `createSupabaseClient` (research.md §3). `AuthSession` en `@repo/core` es una proyección mínima de esto (`userId`, `email`) — no expone tokens a la capa de UI, que nunca los necesita directamente.

## Diagrama de relaciones (elemento nuevo resaltado)

```
auth.users (Supabase, 1 fila) ── sesión válida → habilita las policies "..._authenticated_all"
                                                   de clientes/prestamos/cuotas/cobros/
                                                   configuracion_app/notificaciones_whatsapp

clientes 1──* prestamos 1──* cuotas   (sin cambios — spec.md raíz §4)
```

## Entidades de UI (sin persistencia propia)

- **Formulario de login** (email + contraseña): estado local del componente, nunca persistido — solo produce una llamada a `IAuthRepository.signInWithPassword`.
- **Indicador de sesión cargando**: estado derivado de `AuthProvider` mientras se resuelve `getSession()` inicial, para no parpadear a `/login` antes de confirmar que ya hay sesión (research.md §8).
