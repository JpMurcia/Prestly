# Feature Specification: Gestión Operativa Integral — Pagos Parciales, Liquidación Anticipada y Tendencia de Cartera

**Feature Branch**: `003-operational-management`

**Created**: 2026-09-03

**Status**: Draft

**Input**: User description: "Gestión Operativa Integral (Fase 4 del roadmap de negocio en spec.md raíz, tabla \"Hoja de Ruta y Fases de Ejecución\" de Docs/Plan_Negocio_Microcreditos.docx): registro de pagos parciales y liquidación anticipada (total) de un préstamo, disponible tanto en apps/mobile como en apps/web reutilizando @repo/core y el mismo esquema Supabase que las fases anteriores (mockup 1b — Docs/Plataforma Mockus/Microcreditos - Mockups.dc.html — ya sugiere una pestaña \"Parcial\" en el modal de registrar cobro, junto a \"Efectivo\"/\"Transferencia\", que ninguna spec anterior implementó); un dashboard de ganancias/capital con tendencia a lo largo del tiempo (evolución de capital prestado vs. recuperado y de intereses ganados), extendiendo el dashboard numérico ya entregado en specs/002-admin-web/; y sincronización en tiempo real entre apps/web y apps/mobile (un cobro o pago registrado en una superficie se refleja de inmediato en la otra sin recargar), construida sobre el mismo guard de concurrencia de registrar_cobro ya existente. No incluye todavía la integración de WhatsApp (Fase 5, fuera de alcance de esta spec)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar un pago parcial de una cuota (Priority: P1)

Como prestamista, cuando un cliente me paga menos del monto completo de su cuota, quiero poder registrar exactamente lo que recibí sin que el sistema me obligue a marcarla como pagada por completo ni a rechazar el cobro, para que mi cartera refleje la realidad del dinero que de verdad tengo en mano y lo que el cliente todavía me debe.

**Why this priority**: Es la realidad más común de la operación diaria de un prestamista de microcréditos — un cliente que paga parcial no es una excepción, es el día a día. Sin esto, el prestamista sigue forzado a un registro binario (todo o nada) que no refleja la realidad, tal como hoy en `specs/001-mobile-field-app/` y `specs/002-admin-web/` (ambas excluyeron explícitamente los pagos parciales, remitiendo a esta fase).

**Independent Test**: Con una cuota pendiente de $47.92, registrar un cobro de $20.00 y verificar que la cuota queda con un saldo restante de $27.92 sin estar ni "pendiente" en su totalidad ni "pagada", y que el saldo del préstamo se reduce exactamente en $20.00 — se puede probar de punta a punta sin depender de las otras historias.

**Acceptance Scenarios**:

1. **Given** una cuota pendiente de $X, **When** registro un cobro por un monto menor a $X, **Then** la cuota pasa a un estado "parcial" (ni pendiente ni pagada), se registra el monto recibido, y el saldo restante de esa cuota se reduce exactamente en ese monto.
2. **Given** una cuota en estado "parcial" con un saldo restante de $Y, **When** registro otro cobro por el saldo restante o por una parte de él, **Then** el sistema aplica el nuevo monto contra lo que queda pendiente, y la cuota pasa a "pagada" en cuanto lo recibido acumulado alcanza el monto total original.
3. **Given** una cuota pendiente o parcial, **When** intento registrar un cobro por un monto mayor al que todavía falta por pagar en esa cuota, **Then** el sistema rechaza la operación con un aviso claro (no acepta sobrepagos silenciosos en una sola cuota).
4. **Given** un préstamo con una o más cuotas en estado "parcial", **When** reviso el dashboard o la tabla de amortización (móvil o web), **Then** veo claramente cuáles cuotas están parcialmente pagadas y cuánto falta en cada una, distinto visualmente de "pendiente" y de "pagado".

---

### User Story 2 - Liquidar anticipadamente un préstamo completo (Priority: P1)

Como prestamista, cuando un cliente quiere saldar todo lo que debe antes de terminar su plazo original, quiero poder registrarlo como una sola operación de liquidación anticipada en vez de marcar cuota por cuota, para cerrar el préstamo de inmediato.

**Why this priority**: Es la otra mitad de la realidad operativa diaria (junto con la Historia 1) — el `spec.md` raíz ya marcó esto como "fuera de alcance ahora" con la nota explícita de que el modelo de datos no debía bloquearlo (§Edge cases: "Préstamo liquidado antes de tiempo"). Sin esto, cerrar un préstamo anticipado sigue siendo un proceso manual, cuota por cuota, propenso a error.

**Independent Test**: Con un préstamo activo que tenga cuotas pendientes y/o parciales, liquidarlo anticipadamente y verificar que todas sus cuotas pasan a pagadas, el préstamo pasa a estado "liquidado", y el monto total cobrado en esa operación es exactamente la suma de lo que faltaba por cobrar — se puede probar de punta a punta sin depender de las otras historias.

**Acceptance Scenarios**:

1. **Given** un préstamo activo con cuotas pendientes y/o parciales, **When** elijo "Liquidar anticipadamente", **Then** veo primero el monto total exacto que el cliente debe pagar para saldar el préstamo por completo (la suma de lo que falta en cada cuota) antes de confirmar.
2. **Given** que confirmo la liquidación anticipada, **When** se registra la operación, **Then** todas las cuotas del préstamo pasan a "pagada", el préstamo pasa a estado "liquidado", y el préstamo desaparece de "Préstamos activos" (móvil y web) de inmediato.
3. **Given** un préstamo ya liquidado (por plazo normal o anticipadamente), **When** intento liquidarlo de nuevo o registrar un cobro sobre alguna de sus cuotas, **Then** el sistema lo rechaza con un aviso claro.

---

### User Story 3 - Ver la tendencia de ganancias y capital de la cartera (Priority: P2)

Como prestamista, quiero ver cómo ha evolucionado mi capital prestado, recuperado e intereses ganados a lo largo del tiempo (no solo el total de hoy), para entender si mi negocio está creciendo y tomar mejores decisiones sobre cuánto y a quién prestar.

**Why this priority**: Complementa el dashboard numérico ya entregado en la Fase 3 (`specs/002-admin-web/`) con una vista de tendencia — valiosa para decisiones de negocio, pero no bloquea la operación diaria de cobro/préstamo si el prestamista ya ve los totales actuales.

**Independent Test**: Con una cartera que tenga préstamos e intereses ganados repartidos en distintas fechas, abrir el nuevo panel de tendencia y verificar que la serie de capital prestado/recuperado/intereses coincide con la suma real agrupada por período — se puede probar de forma aislada, sin depender de las otras historias.

**Acceptance Scenarios**:

1. **Given** que tengo actividad de préstamos y cobros repartida en varios meses, **When** abro el panel de tendencia del dashboard, **Then** veo una gráfica con la evolución de capital prestado, total recuperado e intereses ganados a lo largo del tiempo.
2. **Given** que apenas tengo actividad de un solo período (ej. el mes actual), **When** abro el panel de tendencia, **Then** veo un estado claro de "historial limitado" en vez de una gráfica vacía o con errores.

---

### Edge Cases

- **Pago parcial que completa exactamente la cuota**: si el monto recibido en un pago parcial es exactamente igual a lo que falta, la cuota pasa a "pagada" normalmente, no se queda atascada en "parcial" ni genera un cobro adicional de $0.
- **Pago parcial o liquidación anticipada sobre una cuota que otra persona ya cobró (concurrencia)**: igual que en `specs/001-mobile-field-app/` y `specs/002-admin-web/` (FR-013/FR-012), si dos personas intentan cobrar (total o parcialmente) la misma cuota a la vez, o una liquida anticipadamente mientras la otra cobra una cuota individual del mismo préstamo, solo una operación debe completarse; la segunda debe fallar con un aviso claro, nunca duplicar ni sobrepasar lo debido.
- **Liquidación anticipada de un préstamo sin cuotas pendientes**: si todas las cuotas ya están pagadas, "Liquidar anticipadamente" no debe estar disponible o debe indicar claramente que no hay nada pendiente que liquidar.
- **Tendencia con cartera vacía o de un solo día**: la gráfica de tendencia debe mostrar un estado vacío o de "historial limitado" claro, nunca un error ni una gráfica ilegible con un solo punto.
- **Pérdida de conexión durante un pago parcial o una liquidación anticipada**: igual que en specs anteriores (FR-013 de spec 001), el sistema debe avisar y no marcar la operación como completada hasta confirmar que se guardó.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir registrar el cobro de una cuota pendiente o parcial por un monto MENOR a lo que falta por pagar en ella, dejando el resto pendiente.
- **FR-002**: El sistema DEBE marcar como "parcial" una cuota que recibió al menos un pago pero no el monto total, distinguible visualmente de "pendiente" y de "pagada" tanto en móvil como en web.
- **FR-003**: El sistema DEBE permitir varios pagos parciales sucesivos sobre la misma cuota (ej. $20 hoy, $20 mañana, resto después) — no se restringe a un único abono parcial por cuota; nada impide que el prestamista, si así lo decide caso por caso, liquide el resto en un solo abono posterior.
- **FR-004**: El sistema DEBE rechazar cualquier cobro (parcial o total) por un monto MAYOR a lo que falta por pagar en esa cuota específica, con un aviso claro.
- **FR-005**: El sistema DEBE permitir liquidar anticipadamente un préstamo activo en una sola operación, mostrando primero el monto total exacto a cobrar (la suma de lo que falta en todas sus cuotas pendientes/parciales) antes de confirmar.
- **FR-006**: Al confirmar una liquidación anticipada, el sistema DEBE marcar todas las cuotas del préstamo como pagadas y el préstamo como "liquidado" en una sola operación atómica.
- **FR-007**: El sistema DEBE reutilizar el mismo guard de concurrencia ya existente (`registrar_cobro`) para que un pago parcial o una liquidación anticipada nunca se dupliquen ni se crucen con otra operación simultánea sobre la misma cuota o el mismo préstamo.
- **FR-008**: La web DEBE mostrar un panel de tendencia con la evolución de capital prestado, total recuperado e intereses ganados a lo largo del tiempo, derivado de los mismos datos que el dashboard numérico de `specs/002-admin-web/`.
- **FR-009**: Un pago parcial DEBE aplicarse a capital e interés en la misma proporción que ya tiene fijada esa cuota (ej. si la cuota es 87% capital / 13% interés, el pago parcial se reparte igual) — determina cómo se reportan "intereses ganados" mientras una cuota está parcialmente pagada.
- **FR-010**: Todo cálculo de saldo restante, monto a liquidar anticipadamente, y agregados de tendencia DEBE derivarse de los mismos datos de `prestamos`/`cuotas` — ninguno se almacena como un valor independiente que deba mantenerse sincronizado a mano (Principio IV de la constitución).
- **FR-011**: El sistema NO DEBE reimplementar ninguna fórmula financiera fuera de `@repo/core` — la asignación de un pago parcial entre capital e interés, y el cálculo del monto de liquidación anticipada, se calculan en un solo lugar y ambas apps lo heredan igual (Principio II de la constitución).

### Key Entities *(include if feature involves data)*

- **Cuota**: gana un tercer estado observable ("parcial"), además de "pendiente"/"pagado" ya existentes. El monto efectivamente recibido puede provenir de más de un cobro a lo largo del tiempo (FR-003) — implica un historial de pagos por cuota, no un único valor final como hoy.
- **Préstamo**: su estado "liquidado" ahora puede alcanzarse por dos caminos — plazo normal completado (ya existente) o liquidación anticipada (nueva).
- **Tendencia de cartera (agregado)**: no es una entidad almacenada — es una vista derivada que agrupa préstamos y cuotas por período de tiempo para las tres series de la Historia 3, mismo criterio que `cartera_resumen` (`specs/002-admin-web/`, Principio IV de la constitución).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un prestamista puede registrar un pago parcial de una cuota en menos de 30 segundos, igual que un cobro completo (`specs/002-admin-web/` SC-003).
- **SC-002**: Un prestamista puede liquidar anticipadamente un préstamo completo en una sola operación de menos de 1 minuto, sin tener que marcar cuota por cuota.
- **SC-003**: El 100% de los pagos parciales sobre una misma cuota suman exactamente el monto total de esa cuota cuando se completa — nunca queda una fracción de centavo de más o de menos.
- **SC-004**: Dos intentos simultáneos de cobrar (total o parcialmente) la misma cuota, o de liquidar anticipadamente un préstamo mientras se cobra una de sus cuotas, producen exactamente una operación completada, nunca dos ni ninguna.
- **SC-005**: Un prestamista puede ver la tendencia de su cartera (capital, recuperado, intereses) de los últimos períodos en menos de 5 segundos desde que abre el panel.

## Assumptions

- **La liquidación anticipada cobra exactamente la suma de lo que falta por pagar en las cuotas pendientes/parciales, sin descuento ni recálculo de interés** — consistente con que el interés de esta fase es simple/fijo, calculado una sola vez sobre el capital inicial y nunca recompuesto sobre saldo pendiente (`spec.md` raíz §5.1). Un descuento por pronto pago, si el negocio lo decide más adelante, es una decisión de producto separada fuera de esta spec.
- **El monto mínimo de un pago parcial no tiene un piso definido por esta spec** (ej. no se exige un mínimo de $1 o de X% de la cuota) — cualquier monto mayor a $0 y menor al saldo restante de la cuota es válido; el negocio puede ajustar esto más adelante sin cambiar el modelo de datos.
- **Un solo prestamista administrador, sin autenticación** (consistente con `spec.md` raíz y las specs anteriores) — esta fase no incluye login, roles ni permisos.
- **La integración de WhatsApp (envío de comprobantes, recordatorios) sigue fuera de alcance** — es la Fase 5 del roadmap de negocio; el checkbox visto en el mockup 1b ("Enviar comprobante por WhatsApp") no se implementa en esta spec.
- **El panel de tendencia (Historia 3) agrupa por mes**, salvo que la cartera tenga menos de un mes de historial, en cuyo caso se agrupa por semana o se muestra el estado de "historial limitado" (edge case correspondiente) — el período exacto de agrupación es una decisión de implementación para `/speckit-plan`, no de esta especificación.
- **La búsqueda/filtro/exportación ya entregadas en `specs/002-admin-web/` no cambian** — esta fase solo extiende el registro de cobro y el dashboard, no reestructura lo ya construido.
- **"Sincronización perfecta Web/Móvil" (roadmap de negocio) se da por satisfecha con las garantías ya existentes**: el guard de concurrencia (`registrar_cobro`) asegura que los datos son siempre correctos, y cada superficie ya invalida su caché tras sus propias operaciones (`specs/001-mobile-field-app/`, `specs/002-admin-web/`). Esta spec NO añade infraestructura de tiempo real (ej. suscripciones push) para reflejar automáticamente, sin acción del usuario, un cambio hecho en la otra superficie — decisión explícita del usuario al resolver esta ambigüedad. Si el negocio decide más adelante que sí hace falta una actualización en vivo sin recargar, es una spec futura aparte.
