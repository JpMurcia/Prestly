# Especificación: Prestly — Plataforma de Gestión de Microcréditos

**Estado**: Borrador para revisión
**Creado**: 2026-09-02
**Fuente**: `Docs/Plan_Negocio_Microcreditos.docx` + `Docs/Plataforma  Mockus/Microcreditos - Mockups.dc.html`
**Rol de este documento**: Fuente Única de Verdad (SSOT) del producto. Redactado siguiendo la metodología de [SpecKit](https://github.com/github/spec-kit) (instalado en este repo — ver `.specify/`). Toda decisión de arquitectura, base de datos o cálculo financiero en las fases 2–4 debe remitirse a este documento; si algo cambia aquí, se actualiza primero y luego el código.

---

## 1. Resumen del producto

Prestly es una herramienta **single-tenant** (un único prestamista administrador, sin multi-tenencia por ahora) para gestionar una cartera pequeña y manejable de microcréditos. Dos superficies comparten el mismo motor financiero:

- **Móvil (React Native / Expo)** — uso en campo: calculadora rápida frente al cliente, emisión de préstamos, registro de cobros, directorio de clientes con score de confianza.
- **Web (React / Vite)** — centro de control: tablas de amortización extendidas, dashboard de cartera (ingresos, capital prestado vs. recuperado, mora), exportación de reportes.

Ambas se apoyan en `@repo/core` (TypeScript puro, sin dependencias de UI ni de base de datos) para que la lógica de cálculo de intereses sea idéntica en ambas plataformas — nunca se reimplementa por separado.

**Fuera de alcance en este documento** (roadmap del negocio, fases futuras): integración real con Supabase Auth/Storage, notificaciones WhatsApp vía Twilio/Meta API (Fase 5 del plan de negocio), pagos parciales por cuota, vista de mapa para rutas de cobranza, estado vacío del directorio, flujo completo de alta de cliente. Se dejan interfaces abiertas para no bloquear su incorporación futura (ver §7 SOLID).

---

## 2. Flujos de usuario principales

Los mockups y el documento de negocio coinciden en tres acciones núcleo. Se listan como historias de usuario priorizadas (P1 = imprescindible para un MVP funcional).

### Historia 1 — Cotizar un préstamo (P1)

Como prestamista, quiero simular un préstamo ajustando monto, tasa, plazo y frecuencia, para decidir si lo ofrezco antes de comprometerme a nada.

**Prueba independiente**: dado un monto/tasa/plazo, el sistema devuelve cuota, interés total y tabla completa sin persistir nada — se puede probar con `@repo/core` aislado, sin base de datos.

**Escenarios de aceptación**:
1. **Dado** que ingreso capital=$500, tasa=15%, 12 cuotas, frecuencia semanal, **cuando** solicito la cotización, **entonces** el sistema muestra cuota=$47.92, interés total=$75.00, total a pagar=$575.00 y una tabla de 12 filas con capital=$41.67 e interés=$6.25 por fila (última fila ajustada por redondeo, ver §6.3).
2. **Dado** cualquier combinación válida de capital/tasa/plazo, **cuando** cambio un parámetro, **entonces** la cotización se recalcula al instante (sin llamada a red — cálculo local en `@repo/core`).

### Historia 2 — Emitir un préstamo (P2)

Como prestamista, quiero convertir una cotización aprobada en un préstamo real, para que se generen sus cuotas y quede registrado contra un cliente.

**Prueba independiente**: se puede probar guardando una cotización ya calculada — genera un cliente (si es nuevo) + un préstamo + N cuotas en la base de datos.

**Escenarios de aceptación**:
1. **Dado** una cotización calculada y un cliente (nuevo o existente), **cuando** confirmo "Emitir este préstamo", **entonces** se crea el préstamo con `estado=activo`, se generan sus N cuotas con `fecha_vencimiento` calculada desde `fecha_emision` según la frecuencia, y ninguna cuota puede editarse manualmente después (solo se derivan de la estrategia de interés).
2. **Dado** un préstamo recién emitido, **cuando** lo consulto, **entonces** capital y monto total de sus cuotas coinciden exactamente con lo cotizado (ninguna diferencia de redondeo se pierde).

### Historia 3 — Cobrar una cuota (P1)

Como prestamista, quiero registrar el cobro de una cuota con un toque, para mantener al día el estado de cada cliente sin cálculos manuales.

**Prueba independiente**: se puede probar tomando un préstamo con cuotas pendientes y registrando un cobro sobre la próxima — el saldo y el score del cliente se recalculan solos (son derivados, no se tocan a mano).

**Escenarios de aceptación**:
1. **Dado** una cuota en estado `pendiente`, **cuando** registro su cobro, **entonces** pasa a `pagado` con `fecha_pago=ahora` y `monto_pagado=monto_cuota`; el saldo del préstamo (derivado) disminuye y el score de puntualidad del cliente (derivado) se recalcula.
2. **Dado** un cliente con una cuota vencida sin pagar, **cuando** abro su perfil, **entonces** el sistema muestra "Mora N días" (derivado de `fecha_vencimiento` vs. hoy — nunca un valor almacenado que pueda desactualizarse).

### Edge cases

- **Préstamo liquidado antes de tiempo**: fuera de alcance ahora (el negocio lo prevé como pago parcial/total anticipado — Fase 4 del roadmap del negocio); el modelo de datos no debe bloquearlo pero tampoco se implementa aún.
- **Redondeo**: capital/interés por cuota puede no ser exacto (500/12 = 41.6666…); ver regla de conciliación en §6.3 — la suma de cuotas SIEMPRE debe igualar el total cotizado, nunca quedar unos centavos de más o de menos.
- **Cliente sin historial** (0 cuotas históricas): el score de confianza no debe mostrar división por cero; se define como "sin historial" hasta la primera cuota vencida.
- **Cambio de tasa/plazo después de emitido**: no permitido — un préstamo emitido es inmutable en sus términos; solo cambia el estado de sus cuotas.

---

## 3. Arquitectura del monorepo

Turborepo + **npm workspaces** (confirmado). Estructura:

```
Prestly/
├── apps/
│   ├── web/              # React + Vite + TailwindCSS · puerto 5300
│   └── mobile/            # React Native (Expo) + NativeWind
├── packages/
│   ├── core/               # TypeScript puro — motor financiero (SOLID). Sin UI, sin DB.
│   └── ui/                 # Componentes compartidos (web + mobile vía primitivas compatibles)
├── docker-compose.yml
├── .env.example
├── spec.md                 # este documento
└── .specify/                # SpecKit (constitution, templates, scripts)
```

**Regla de dependencia** (Dependency Inversion, a nivel de monorepo): `apps/*` dependen de `packages/core` y `packages/ui`; `packages/core` no depende de nada de `apps/*` ni de Supabase directamente — solo expone interfaces (`ILoanRepository`, etc.) que `apps/*` implementan contra Supabase. Esto es lo que permite compartir el 100% del cálculo financiero entre web y móvil sin duplicar lógica.

**Puertos** (fijados para todo el proyecto, usados también en Docker — Fase 3):
- `apps/web` → **5300**
- PostgreSQL local (simula Supabase) → **5432**

---

## 4. Diseño de base de datos relacional (Supabase / PostgreSQL)

Cadena relacional confirmada por el negocio: **Clientes → Préstamos → Cuotas**. Nombres de tabla/columna en español (así los nombra el propio documento de negocio); las interfaces TypeScript de `@repo/core` usan inglés (ver §7) — la capa de infraestructura que implemente `ILoanRepository` es responsable de traducir entre ambos.

**Decisión de diseño**: los estados "vencido/mora" de una cuota y el "score de confianza" de un cliente son **derivados**, no columnas almacenadas. Guardarlos como columna obligaría a un job periódico que los mantenga sincronizados y puede desactualizarse; calcularlos en cada lectura (vía `VIEW` o en la capa de aplicación) los mantiene siempre correctos por construcción.

```sql
-- ── Clientes ────────────────────────────────────────────────────────────
CREATE TABLE clientes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT NOT NULL,
  telefono        TEXT NOT NULL,
  direccion       TEXT,
  notas_privadas  TEXT,
  notas_actualizadas_en TIMESTAMPTZ,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Préstamos ───────────────────────────────────────────────────────────
CREATE TYPE frecuencia_pago    AS ENUM ('semanal', 'quincenal', 'mensual');
CREATE TYPE estado_prestamo    AS ENUM ('activo', 'liquidado', 'cancelado');
CREATE TYPE estrategia_interes AS ENUM ('simple_cuota_fija', 'frances'); -- abierto a más (OCP, ver §7)

CREATE TABLE prestamos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id     UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  capital        NUMERIC(12,2) NOT NULL CHECK (capital > 0),
  tasa_interes   NUMERIC(6,4)  NOT NULL CHECK (tasa_interes >= 0),   -- 0.1500 = 15%
  estrategia     estrategia_interes NOT NULL DEFAULT 'simple_cuota_fija',
  num_cuotas     INTEGER NOT NULL CHECK (num_cuotas > 0),
  frecuencia     frecuencia_pago NOT NULL,
  fecha_emision  DATE NOT NULL,
  estado         estado_prestamo NOT NULL DEFAULT 'activo',
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Cuotas ──────────────────────────────────────────────────────────────
CREATE TYPE estado_cuota AS ENUM ('pendiente', 'pagado'); -- 'vencido' es derivado, no se almacena

CREATE TABLE cuotas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prestamo_id       UUID NOT NULL REFERENCES prestamos(id) ON DELETE CASCADE,
  numero            INTEGER NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  monto_capital     NUMERIC(12,2) NOT NULL,
  monto_interes     NUMERIC(12,2) NOT NULL,
  monto_cuota       NUMERIC(12,2) NOT NULL,
  estado            estado_cuota NOT NULL DEFAULT 'pendiente',
  fecha_pago        TIMESTAMPTZ,
  monto_pagado      NUMERIC(12,2),
  UNIQUE (prestamo_id, numero)
);

CREATE INDEX idx_prestamos_cliente     ON prestamos(cliente_id);
CREATE INDEX idx_cuotas_prestamo       ON cuotas(prestamo_id);
CREATE INDEX idx_cuotas_pendientes     ON cuotas(fecha_vencimiento) WHERE estado = 'pendiente';

-- ── Vista derivada: score de confianza (ver mockup §2c) ───────────────────
CREATE VIEW cliente_score AS
SELECT
  c.id AS cliente_id,
  COUNT(cu.*) FILTER (WHERE cu.estado = 'pagado') AS cuotas_pagadas,
  COUNT(cu.*) FILTER (WHERE cu.fecha_vencimiento <= CURRENT_DATE) AS cuotas_historicas,
  ROUND(
    COUNT(cu.*) FILTER (WHERE cu.estado = 'pagado' AND cu.fecha_pago::date <= cu.fecha_vencimiento)::numeric
    / NULLIF(COUNT(cu.*) FILTER (WHERE cu.fecha_vencimiento <= CURRENT_DATE), 0),
    4
  ) AS puntualidad,
  CASE
    WHEN COUNT(cu.*) FILTER (WHERE cu.fecha_vencimiento <= CURRENT_DATE) = 0 THEN NULL -- sin historial
    WHEN ROUND(COUNT(cu.*) FILTER (WHERE cu.estado='pagado' AND cu.fecha_pago::date <= cu.fecha_vencimiento)::numeric
      / NULLIF(COUNT(cu.*) FILTER (WHERE cu.fecha_vencimiento <= CURRENT_DATE), 0), 4) >= 0.95 THEN 'A+'
    WHEN ROUND(COUNT(cu.*) FILTER (WHERE cu.estado='pagado' AND cu.fecha_pago::date <= cu.fecha_vencimiento)::numeric
      / NULLIF(COUNT(cu.*) FILTER (WHERE cu.fecha_vencimiento <= CURRENT_DATE), 0), 4) >= 0.85 THEN 'A'
    WHEN ROUND(COUNT(cu.*) FILTER (WHERE cu.estado='pagado' AND cu.fecha_pago::date <= cu.fecha_vencimiento)::numeric
      / NULLIF(COUNT(cu.*) FILTER (WHERE cu.fecha_vencimiento <= CURRENT_DATE), 0), 4) >= 0.70 THEN 'B'
    ELSE 'C'
  END AS grado
FROM clientes c
LEFT JOIN prestamos p ON p.cliente_id = c.id
LEFT JOIN cuotas cu ON cu.prestamo_id = p.id
GROUP BY c.id;
```

Bandas de score confirmadas en el mockup (§2c/2e): **A+ ≥95% · A 85–94% · B 70–84% · C <70%**, siempre mostradas con el denominador visible ("19 de 20 cuotas"), nunca solo la letra.

---

## 5. Fórmulas de amortización

### 5.1 Modelo elegido: cuota fija con interés simple (flat rate)

Confirmado contra el mockup y el caso de prueba del negocio: **interés total = capital × tasa** (una sola vez sobre el capital inicial, **no** compuesto ni recalculado sobre saldo pendiente), repartido en partes iguales entre todas las cuotas. Esto es distinto del "Sistema Francés" propiamente dicho (ver §5.2) — el documento de negocio los menciona como si fueran equivalentes; no lo son, y este documento fija cuál se implementa primero.

```
interesTotal   = capital × tasaInteres
totalAPagar    = capital + interesTotal
cuotaCapital   = capital / numCuotas
cuotaInteres   = interesTotal / numCuotas
cuota          = cuotaCapital + cuotaInteres   (constante en todas las cuotas, salvo ajuste de redondeo)
```

**Caso de prueba** (mockup + negocio, verificado a mano — este es el test que se escribe en Jest en la Fase 4):

| Entrada | Valor |
|---|---|
| Capital | $500.00 |
| Tasa | 15% |
| Cuotas | 12 (semanal) |

| Salida | Valor |
|---|---|
| Interés total | $75.00 |
| Total a pagar | $575.00 |
| Cuota (por semana) | **$47.92** |
| Capital por cuota | $41.67 (41.6666… redondeado) |
| Interés por cuota | $6.25 (exacto) |

### 5.2 Extensibilidad (OCP) — Sistema Francés real, a futuro

Si más adelante se necesita saldo decreciente real (interés que baja y capital que sube cada período, `cuota = P×[i(1+i)^n]/[(1+i)^n-1]`) o un "interés de mora", se añade una nueva clase que implemente `IInterestStrategy` — **no se modifica** `AmortizationCalculator` ni la estrategia existente. El campo `prestamos.estrategia` ya está preparado como enum extensible para esto.

### 5.3 Regla de redondeo y conciliación (importante)

Redondear cada cuota de forma independiente puede acumular error: `41.67 × 12 = 500.04` (4 centavos de más sobre un capital de $500.00 exacto). Regla: las primeras N-1 cuotas se redondean normalmente (mitad hacia arriba, 2 decimales); la **última cuota absorbe el residuo** para que la suma de `monto_capital` (y de `monto_cuota`) coincida exactamente con `capital` (y con `totalAPagar`). Ninguna vista debe sumar filas redondeadas para mostrar un total — el total se calcula desde los valores exactos.

---

## 6. Principios SOLID en `@repo/core`

Mapeo directo de la §4 del documento de negocio a interfaces concretas. `@repo/core` no importa nada de `apps/*`, Supabase, ni React — es TypeScript puro, testeado con Jest (Fase 4).

```typescript
// ── SRP ── AmortizationCalculator solo calcula números; no persiste ni renderiza.
class AmortizationCalculator {
  constructor(private readonly strategy: IInterestStrategy) {}
  calculate(input: LoanInput): InstallmentSchedule { /* Fase 4 */ }
}

// ── OCP ── nuevas estrategias de interés se añaden sin tocar código existente.
interface IInterestStrategy {
  computeInstallments(input: LoanInput): Installment[];
}
class FlatRateFixedInstallmentStrategy implements IInterestStrategy { /* §5.1 — Fase 4 */ }
// class FrenchAmortizationStrategy implements IInterestStrategy { /* futuro, §5.2 */ }

// ── LSP ── cualquier frecuencia es intercambiable sin romper el cálculo.
type PaymentFrequency = 'weekly' | 'biweekly' | 'monthly';

interface LoanInput {
  principal: number;
  interestRate: number;       // 0.15 = 15%
  installmentCount: number;
  frequency: PaymentFrequency;
  issueDate: Date;
}
interface Installment {
  number: number;
  dueDate: Date;
  principalPortion: number;
  interestPortion: number;
  totalAmount: number;
}
interface InstallmentSchedule {
  installments: Installment[];
  totalPrincipal: number;
  totalInterest: number;
  totalToPay: number;
}

// ── ISP ── lectura y escritura de clientes son interfaces separadas;
//           la calculadora solo depende de lo que necesita (nada, en este caso).
interface IClientReader {
  findById(id: string): Promise<Client | null>;
  list(filter?: ClientFilter): Promise<Client[]>;
}
interface IClientWriter {
  create(data: NewClient): Promise<Client>;
  update(id: string, data: Partial<Client>): Promise<Client>;
}

// ── DIP ── las apps no hablan con Supabase directamente, hablan con esta interfaz.
//           Cambiar Supabase por Firebase no toca apps/web ni apps/mobile.
interface ILoanRepository {
  findById(id: string): Promise<Loan | null>;
  save(loan: Loan): Promise<void>;
  listByClient(clientId: string): Promise<Loan[]>;
}
```

`packages/core` estructura de carpetas (Fase 4): `src/domain` (entidades + `AmortizationCalculator`), `src/use-cases` (cotizar/emitir/cobrar), `src/interfaces` (los contratos de arriba).

---

## 7. Requisitos funcionales

- **FR-001**: El sistema DEBE calcular cuota, interés total y total a pagar de forma síncrona y local (sin red) dado capital, tasa, número de cuotas y frecuencia.
- **FR-002**: El sistema DEBE generar una tabla de amortización completa (N filas) cuya suma de capital e interés coincida exactamente con el capital y el interés total cotizados (regla de conciliación, §5.3).
- **FR-003**: El sistema DEBE permitir emitir un préstamo solo a partir de una cotización ya calculada — no se editan cuotas manualmente tras la emisión.
- **FR-004**: El sistema DEBE registrar el cobro de una cuota individual, marcándola `pagado` con fecha y monto.
- **FR-005**: El sistema DEBE derivar (no almacenar) el estado de mora de una cuota y el score de confianza de un cliente.
- **FR-006**: `@repo/core` NO DEBE importar código de `apps/web`, `apps/mobile`, ni clientes de Supabase — solo expone interfaces.
- **FR-007**: El sistema DEBE soportar frecuencias semanal, quincenal y mensual de forma intercambiable (LSP) sin lanzar errores matemáticos.
- **FR-008**: El sistema DEBE permitir añadir nuevas estrategias de interés (`IInterestStrategy`) sin modificar `AmortizationCalculator` ni las estrategias existentes (OCP).
- **FR-009**: `apps/web` DEBE exponerse en el puerto 5300; el contenedor de PostgreSQL local DEBE exponerse en el puerto 5432 (Fase 3).

### Entidades clave

- **Cliente**: persona a quien se le prestan microcréditos. Tiene 0..N préstamos.
- **Préstamo**: un crédito emitido a un cliente, con capital, tasa, plazo y frecuencia fijos desde su emisión. Tiene exactamente N cuotas, generadas al emitirse.
- **Cuota**: una fila de la tabla de amortización de un préstamo — capital, interés y fecha de vencimiento fijos; estado (`pendiente`/`pagado`) es lo único que cambia con el tiempo.

## 8. Criterios de éxito

- **SC-001**: El caso de prueba $500 / 15% / 12 semanas produce cuota=$47.92 e interés total=$75.00 — verificado por un test automatizado (Fase 4).
- **SC-002**: La suma de `monto_capital` de todas las cuotas de un préstamo es exactamente igual a `prestamos.capital`, sin excepción, para cualquier combinación de capital/plazo.
- **SC-003**: Ningún componente de `apps/web` o `apps/mobile` importa un cliente de Supabase directamente — todo pasa por `ILoanRepository`/`IClientReader`/`IClientWriter`.
- **SC-004**: `apps/web` sirve correctamente en `http://localhost:5300` tanto en desarrollo (Vite) como en el contenedor Docker (Fase 3).

## 9. Supuestos

- Gestor de paquetes: **npm** (confirmado por el usuario, con workspaces nativos de npm).
- Moneda: montos en `NUMERIC(12,2)`, símbolo `$` sin código de moneda explícito por ahora (el negocio no especificó multi-moneda; se asume mercado único).
- Autenticación: fuera de alcance de este documento — la app es single-tenant; Supabase Auth se integrará cuando el negocio lo requiera (no bloquea Fases 1–4).
- `packages/ui` en esta fase es solo el esqueleto del paquete (§Fase 2 de este chat) — el sistema de diseño (paleta #10B981/#1E3A8A/#0F172A, tipografías Plus Jakarta Sans + Inter, vistas del mockup) se implementa en fases posteriores del roadmap del negocio, no en las 4 fases de esta sesión.
- No existía repositorio git al iniciar — se inicializa como parte de la Fase 2 (Turborepo) si aún no existe.

---

## Anexo — Relación con el roadmap del documento de negocio

El documento de negocio define 5 fases de producto (Core+DB, App Móvil, Admin Web, Gestión Operativa, Automatización WhatsApp). Las **4 fases técnicas de esta sesión** (spec → monorepo → Docker → `@repo/core`) son el desglose de ejecución de su **Fase 1 (Lógica Core y Base de Datos)**. Las Fases 2–5 del negocio (UI completa de móvil/web, dashboard, WhatsApp) quedan fuera de esta spec y se abordarán en specs posteriores — opcionalmente generadas con `/speckit-specify` ahora que SpecKit está instalado en `.specify/`.

**Fase 2 del negocio (App Móvil) — entregada.** Especificada, planificada e implementada con SpecKit en [`specs/001-mobile-field-app/`](specs/001-mobile-field-app/spec.md): calculadora de cotización, emisión de préstamos, ruta de cobranza diaria, directorio de clientes y perfil 360° con score de confianza, todo sobre `@repo/core` (motor financiero implementado como parte de esta fase, cerrando también la Fase 1 técnica) y Supabase (esquema y procedimientos en `supabase/migrations/`). Verificado de punta a punta contra una base local recién reseteada — ver `specs/001-mobile-field-app/quickstart.md`.

**Fase 3 del negocio (Admin Web) — entregada.** Especificada, planificada e implementada con SpecKit en [`specs/002-admin-web/`](specs/002-admin-web/spec.md): dashboard con panorama de cartera, gestión de préstamos activos con tabla de amortización y registro de cobros, directorio de clientes con panel de detalle, y calculadora de cotización/emisión con paridad exacta respecto a la app móvil — las 4 historias de usuario, todas sobre `@repo/core` y el mismo esquema Supabase que `apps/mobile` (compartido vía el nuevo paquete `packages/data-supabase`, extraído sin duplicar de la Fase 2). Verificado de punta a punta contra una base local recién reseteada (`0003_cartera_resumen.sql` incluida) — ver `specs/002-admin-web/quickstart.md` y `specs/002-admin-web/tasks.md` T048, incluida la validación de la guarda de concurrencia (FR-012/SC-006) disparando dos cobros simultáneos a la misma cuota desde dos clientes independientes.

**Fase 4 del negocio (Gestión Operativa Integral) — entregada.** Especificada, planificada e implementada con SpecKit en [`specs/003-operational-management/`](specs/003-operational-management/spec.md): pagos parciales sobre una cuota (varios abonos sucesivos, reparto proporcional capital/interés), liquidación anticipada de un préstamo completo en una sola operación atómica, y un panel de tendencia mensual (capital prestado/recuperado/intereses) en el dashboard — las 3 historias de usuario, disponibles tanto en `apps/mobile` como en `apps/web` sobre el mismo `registrar_cobro` extendido (nunca dos guardas de concurrencia distintas). Verificado de punta a punta contra una base local recién reseteada (`0004_pagos_parciales.sql` incluida) — ver `specs/003-operational-management/quickstart.md` y `specs/003-operational-management/tasks.md` T026, incluida la validación de SC-004 (liquidación anticipada corriendo a la vez que un cobro individual sobre una cuota del mismo préstamo, sin duplicar ni perder ningún cobro). Corrigió, como parte necesaria de introducir el estado "parcial", dos lugares de `specs/002-admin-web/` que asumían un estado binario pendiente/pagado (`cartera_resumen` y el saldo del directorio de clientes) — sin cambiar su comportamiento para carteras sin pagos parciales.

**Fase 5 del negocio (Automatización WhatsApp) — entregada, verificación real con Twilio pendiente.** Especificada, planificada e implementada con SpecKit en [`specs/004-whatsapp-automation/`](specs/004-whatsapp-automation/spec.md): recordatorios y alertas de mora automáticos (disparados por `pg_cron`, sin intervención manual, `0005_whatsapp_automation.sql`), configuración de la conexión con Twilio desde `apps/web` con credenciales en Supabase Vault (nunca expuestas al cliente), y acciones manuales de un toque para compartir la tabla de un préstamo o el comprobante de un cobro por `wa.me` — las 3 historias de usuario. El envío automático queda detrás de una implementación intercambiable (simulada por defecto, real contra Twilio WhatsApp Sandbox) para poder verificar el flujo completo sin depender de una cuenta real; la revisión automática, la configuración y las acciones manuales de compartir ya se verificaron de punta a punta contra una base local recién reseteada y en un navegador real — ver `specs/004-whatsapp-automation/quickstart.md` y `tasks.md` T009/T013/T018. Falta únicamente T019: la prueba de un envío real contra Twilio WhatsApp Sandbox, pendiente de que el negocio comparta sus credenciales de esa cuenta de prueba gratuita.

**Marca Prestly, moneda configurable y cierre de brechas de mockup — entregada.** Especificada, planificada e implementada con SpecKit en [`specs/006-rebrand-currency-polish/`](specs/006-rebrand-currency-polish/spec.md): identidad de marca "Prestly" consistente en `apps/web` y `apps/mobile` (antes decía "Microcréditos" en el sidebar); moneda configurable (Peso colombiano por defecto, o Dólar estadounidense/Peso mexicano) desde una nueva página "Configuración" en `apps/web` que fusiona la antigua configuración de WhatsApp, respaldada por una tabla singleton (`0006_configuracion_app.sql`, sin Vault — no es un secreto) y consumida en modo solo-lectura por `apps/mobile`; alta de cliente sin préstamo (`createStandaloneClient` en `@repo/core`, reutilizando la guarda anti-duplicado de teléfono de `issueLoan` pero rechazando el duplicado en vez de reutilizarlo en silencio); cierre de los hallazgos de categoría "botón" pendientes de `specs/005-mockup-consistency-audit/REPORT.md` más el contenido faltante identificado como alcance completo (KPIs y columnas extra en el directorio web, tarjeta "Cobrado" + progreso en el drawer, página nueva "Perfil completo" sin artboard propio, barra de acciones inferior en el perfil móvil); y `supabase/seed.sql` (referenciado en `config.toml` desde el inicio del proyecto pero nunca creado) con una cartera de ejemplo de 9 clientes en pesos colombianos cubriendo los 6 estados de cartera y las 3 frecuencias de pago. Verificado de punta a punta contra una base local recién reseteada y contra el proyecto de Supabase hosteado en un navegador real (moneda cambiada efectivamente entre las 3 opciones, alta y rechazo de duplicado en ambas plataformas, flujo completo "Nuevo préstamo" desde el perfil móvil) — ver `specs/006-rebrand-currency-polish/quickstart.md` y `tasks.md`.
