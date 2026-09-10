# Feature Specification: Autenticación del administrador (Supabase Auth)

**Feature Branch**: `007-admin-authentication`

**Created**: 2026-09-08

**Status**: Draft

**Input**: User description: "Implementar autenticación real con Supabase Auth para reemplazar el acceso abierto actual (anon key sin RLS, sin login) que el Security Advisor de Supabase marcó como error crítico en producción (RLS Disabled in Public en clientes/prestamos/cuotas/cobros/configuracion_app/notificaciones_whatsapp, y Security Definer View en cliente_score/cartera_resumen/cartera_tendencia_mensual). Contexto de negocio: Prestly es single-tenant, un único prestamista administrador (ver spec.md raíz §1) — hoy ni apps/web ni apps/mobile usan supabase.auth en absoluto. El alcance debe cubrir: login en apps/web (obligatorio para entrar al panel) y en apps/mobile (obligatorio para el cobrador de campo), persistencia de sesión en ambas plataformas, políticas RLS en las 6 tablas que exijan `authenticated`, recrear las 3 vistas con `security_invoker = true`, y decidir cómo se crean/gestionan las credenciales del único administrador (no hay flujo de registro público — es una herramienta interna). Fuera de alcance explícito: multi-tenencia y roles/permisos diferenciados (sigue siendo un solo usuario administrador)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Acceso protegido en la web (Priority: P1)

Como prestamista administrador, quiero que el panel web me pida iniciar sesión antes de mostrar cualquier dato, para que la información de mis clientes y préstamos no quede expuesta a cualquiera que conozca la URL del panel.

**Why this priority**: Es el hallazgo de mayor riesgo confirmado (Security Advisor de Supabase, producción): hoy cualquier persona con la URL pública puede ver y modificar toda la cartera sin ninguna barrera. Sin esto, nada más de esta spec importa.

**Independent Test**: Abrir el panel web sin haber iniciado sesión — ninguna pantalla debe mostrar datos de clientes, préstamos, cuotas ni configuración; solo la pantalla de inicio de sesión. Con credenciales válidas, el panel se comporta exactamente igual que hoy.

**Acceptance Scenarios**:

1. **Given** que no hay una sesión activa, **When** el administrador abre cualquier URL del panel web (incluyendo una ruta interna como `/clientes/:id`), **Then** ve la pantalla de inicio de sesión y no accede a ningún dato hasta autenticarse.
2. **Given** la pantalla de inicio de sesión, **When** el administrador ingresa sus credenciales correctas, **Then** entra al panel y ve la misma información y funcionalidad que existían antes de esta feature.
3. **Given** la pantalla de inicio de sesión, **When** el administrador ingresa credenciales incorrectas, **Then** ve un mensaje de error genérico (sin indicar si el problema fue el usuario o la contraseña) y permanece en la pantalla de inicio de sesión.

---

### User Story 2 - Acceso protegido en la app móvil (Priority: P1)

Como cobrador de campo, quiero que la app móvil me pida iniciar sesión antes de mostrar el directorio de clientes o la ruta de cobranza, para que la información de los clientes esté protegida si el teléfono se pierde, es robado, o queda en manos de alguien no autorizado.

**Why this priority**: Mismo riesgo crítico que la Historia 1, en la superficie que se usa cara a cara con los clientes en campo — un teléfono es más fácil de perder o robar que acceder a una URL web.

**Independent Test**: Abrir la app móvil sin sesión activa — ninguna pantalla (calculadora, directorio, perfil, ruta de cobranza) debe mostrar datos reales; solo la pantalla de inicio de sesión. Con credenciales válidas, la app se comporta igual que hoy.

**Acceptance Scenarios**:

1. **Given** que no hay una sesión activa, **When** el cobrador abre la app móvil, **Then** ve la pantalla de inicio de sesión antes que cualquier otra pantalla.
2. **Given** la pantalla de inicio de sesión en móvil, **When** el cobrador ingresa credenciales correctas, **Then** entra a la app y ve el mismo directorio, calculadora, perfiles y ruta de cobranza que existían antes de esta feature.
3. **Given** que el administrador cambió la moneda desde la web (specs/006-rebrand-currency-polish/), **When** el cobrador autenticado abre la app móvil, **Then** sigue viendo el cambio de moneda reflejado igual que antes de esta feature — la autenticación no interfiere con ese flujo existente.

---

### User Story 3 - Sesión persistente entre usos (Priority: P2)

Como usuario de cualquiera de las dos plataformas, quiero seguir con la sesión iniciada al volver a abrir la app (sin loguearme cada vez), para no perder tiempo operativo en el uso diario frente al cliente.

**Why this priority**: Sin esto, las Historias 1 y 2 técnicamente cumplen pero generan fricción diaria que puede llevar a buscar atajos inseguros (por ejemplo, dejar la sesión de otra persona abierta). Es P2 porque el bloqueo de acceso (P1) es lo que resuelve el hallazgo de seguridad; la persistencia es sobre usabilidad.

**Independent Test**: Iniciar sesión, cerrar completamente la app (o la pestaña del navegador) y volver a abrirla — se debe ver el panel/la app directamente, sin pasar de nuevo por el login.

**Acceptance Scenarios**:

1. **Given** una sesión iniciada en la web, **When** el administrador cierra y vuelve a abrir el navegador (sin haber cerrado sesión explícitamente), **Then** el panel se abre directamente, sin pedir credenciales de nuevo.
2. **Given** una sesión iniciada en la app móvil, **When** el cobrador cierra completamente la app y la vuelve a abrir más tarde (sin haber cerrado sesión explícitamente), **Then** la app se abre directamente en el directorio/última pantalla, sin pedir credenciales de nuevo.

---

### User Story 4 - Cerrar sesión manualmente (Priority: P3)

Como usuario de cualquiera de las dos plataformas, quiero poder cerrar sesión cuando lo decida, para proteger el acceso si presto o comparto el dispositivo.

**Why this priority**: Complementa la persistencia de la Historia 3 — sin un cierre de sesión explícito, la comodidad de "quedar logueado" se vuelve un riesgo. Es P3 porque no bloquea el arreglo de seguridad principal (RLS + login), es un control adicional.

**Independent Test**: Con sesión activa, usar la opción de cerrar sesión — la siguiente pantalla debe ser el login, y ningún dato de cliente/préstamo debe seguir visible ni accesible en la app tras cerrar sesión.

**Acceptance Scenarios**:

1. **Given** una sesión activa en la web, **When** el administrador cierra sesión, **Then** vuelve a la pantalla de login y ninguna pantalla protegida es accesible navegando manualmente hacia atrás.
2. **Given** una sesión activa en móvil, **When** el cobrador cierra sesión, **Then** la app vuelve a la pantalla de login y no queda ningún dato de cliente/préstamo previamente cargado visible en pantalla.

---

### Edge Cases

- ¿Qué pasa si el administrador intenta acceder a una URL interna del panel (por ejemplo `/clientes/abc123`) sin sesión activa? Debe redirigir al login y, tras autenticarse, puede volver a esa misma pantalla o al inicio (no debe filtrar datos antes de completar el login).
- ¿Qué pasa si la sesión expira mientras el usuario está usando la app (a mitad de una acción, por ejemplo cobrando una cuota)? El sistema debe rechazar la operación de forma segura y llevar al usuario al login, sin dejar la operación a medias ni mostrar datos de otra sesión.
- ¿Qué pasa si se pierde la conexión a internet justo al intentar iniciar sesión? El sistema debe mostrar un error de conectividad claro, distinto del error de credenciales inválidas.
- ¿Qué pasa con los datos de clientes/préstamos ya cargados en memoria/caché (por ejemplo, resultados de consultas recientes) cuando el usuario cierra sesión? Deben limpiarse para que no queden visibles a quien use el dispositivo después.
- ¿Qué pasa si alguien intenta leer o modificar datos directamente contra la base (sin pasar por la interfaz de las apps) sin estar autenticado? Debe ser rechazado por la base de datos misma, no solo por la interfaz — este es el requisito que cierra el hallazgo original del Security Advisor.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE exigir una sesión autenticada válida para ver o modificar datos de clientes, préstamos, cuotas, cobros, configuración de la instalación o notificaciones de WhatsApp desde `apps/web`.
- **FR-002**: El sistema DEBE exigir una sesión autenticada válida para ver o modificar esos mismos datos desde `apps/mobile`.
- **FR-003**: El sistema DEBE rechazar, a nivel de base de datos, cualquier lectura o escritura sobre `clientes`, `prestamos`, `cuotas`, `cobros`, `configuracion_app` o `notificaciones_whatsapp` que no provenga de una sesión autenticada — incluso si se intenta directo contra la API, sin pasar por ninguna de las dos apps.
- **FR-004**: El sistema DEBE mantener la sesión iniciada entre reinicios de la app (web y mobile) sin pedir credenciales de nuevo, hasta que la sesión expire de forma natural o el usuario cierre sesión explícitamente.
- **FR-005**: El sistema DEBE permitir cerrar sesión manualmente desde ambas plataformas, y al hacerlo DEBE limpiar cualquier dato de clientes/préstamos que hubiera quedado cacheado en memoria.
- **FR-006**: El sistema NO DEBE ofrecer ningún flujo de auto-registro público — la única cuenta administradora existe de antemano y se crea fuera de la interfaz de usuario de las apps.
- **FR-007**: El sistema DEBE mostrar un mensaje de error genérico ante credenciales inválidas, sin revelar si el usuario ingresado existe o no.
- **FR-008**: El sistema DEBE distinguir, en la pantalla de login, un error de credenciales inválidas de un error de conectividad (por ejemplo, sin internet).
- **FR-009**: Ninguna de las tres vistas derivadas (`cliente_score`, `cartera_resumen`, `cartera_tendencia_mensual`) DEBE devolver datos a una sesión no autenticada, incluso después de que las tablas base tengan sus políticas de acceso activas.
- **FR-010**: El sistema DEBE seguir soportando exactamente los mismos flujos de negocio ya existentes (cotizar, emitir préstamo, cobrar cuota, pago parcial, liquidación anticipada, alta de cliente sin préstamo, configuración de moneda, configuración y automatización de WhatsApp) sin cambios de comportamiento una vez el usuario está autenticado — esta feature solo agrega la barrera de acceso, no modifica ninguna regla de negocio existente.

### Key Entities

- **Cuenta de administrador**: identidad única con la que el prestamista (o el cobrador que use la app en su nombre) inicia sesión. No es una entidad de negocio (no tiene relación con Cliente/Préstamo/Cuota) — es el único actor autorizado a operar el sistema. Existe una sola cuenta, consistente con el carácter single-tenant del producto (ver `spec.md` raíz §1).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Ningún dato de cliente, préstamo, cuota, cobro o configuración es visible ni modificable — desde ninguna de las dos apps ni contactando la base de datos directamente — sin haber completado antes un inicio de sesión válido.
- **SC-002**: Un usuario que ya inició sesión puede cerrar y reabrir la web o la app móvil y seguir viendo sus datos sin volver a loguearse, siempre que no haya cerrado sesión explícitamente.
- **SC-003**: Cerrar sesión deja el dispositivo en un estado donde ningún dato de cliente o préstamo visto previamente queda accesible en pantalla ni recuperable sin volver a autenticarse.
- **SC-004**: Los flujos de negocio existentes (cotizar, emitir, cobrar, pago parcial, liquidar, alta de cliente, configurar moneda, configurar WhatsApp) siguen funcionando exactamente igual que antes de esta feature para un usuario autenticado — cero regresiones de comportamiento.

## Assumptions

- **Una sola cuenta administradora**: consistente con el alcance single-tenant del producto (`spec.md` raíz §1) y con la exclusión explícita del pedido ("fuera de alcance: multi-tenencia y roles/permisos diferenciados"). No hay una pantalla de "crear cuenta" — la cuenta se aprovisiona de antemano (por ejemplo, desde el dashboard de administración de la base de datos), fuera de las apps.
- **Método de inicio de sesión**: usuario/correo + contraseña. Es el método más simple de operar sin depender de conectividad de email en el momento de loguearse (relevante para el cobrador en campo, que puede tener conectividad intermitente) y no requiere infraestructura de correo transaccional que hoy el proyecto no tiene (el único canal de mensajería integrado es WhatsApp vía Twilio, orientado a los clientes, no al administrador).
- **Recuperación de contraseña no está en el alcance de esta primera versión**: al haber una única cuenta, un olvido de contraseña se resuelve reasignándola manualmente (fuera de la interfaz de las apps) en lugar de construir un flujo de recuperación por correo. Puede agregarse en una spec futura si se vuelve necesario.
- **Duración de la sesión**: se mantiene activa indefinidamente hasta un cierre de sesión explícito (no hay un tiempo máximo de inactividad en esta primera versión) — prioriza la fricción operativa mínima para un dispositivo de uso personal/de confianza (Historia 3), no un dispositivo compartido por múltiples personas.
- **Alcance de las políticas de acceso a datos**: dado que sigue existiendo un único administrador (no hay datos "de otro usuario" de los que aislarse), las políticas a nivel de base de datos solo necesitan distinguir "sesión autenticada" de "sin sesión" — no necesitan filtrar filas por identidad del usuario.
