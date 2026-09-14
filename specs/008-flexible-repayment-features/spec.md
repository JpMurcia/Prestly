# Feature Specification: Flexibilidad de Pago Avanzada — Meses de Gracia, Abonos a Capital y Paz y Salvo

**Feature Branch**: `008-flexible-repayment-features`

**Created**: 2026-09-14

**Status**: Draft

**Input**: User description: "Implementar tres funcionalidades financieras avanzadas: (1) Meses de Gracia — al estructurar un préstamo, permitir marcar cuotas específicas donde el cliente no paga cuota ni genera mora, pero el interés ordinario de ese período se sigue calculando y se acumula sobre la cuota siguiente; (2) Abonos a Capital — al registrar un cobro por un monto mayor al exigible, el excedente se aplica como abono a capital y el préstamo recalcula su tabla de amortización futura (por defecto reduciendo el plazo, de forma parametrizable); (3) Certificado de Paz y Salvo — cuando el saldo restante de un préstamo llega exactamente a $0.00, permitir generar y compartir un comprobante formal de cierre con cliente, préstamo y fecha de cierre, ocultando la acción de cobro en su lugar."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configurar meses de gracia al estructurar un préstamo (Priority: P1)

Como prestamista, cuando estructuro o cotizo un préstamo, quiero poder marcar cuotas específicas como "de gracia" (por ejemplo, la cuota 3 y la cuota 5 de un préstamo a 12 cuotas), para darle a un cliente confiable un respiro sin dejar de cobrarle el interés ordinario de esos meses ni penalizarlo con mora por no pagar en ellos.

**Why this priority**: Es una funcionalidad comercial diferenciadora que le permite al prestamista retener y fidelizar buenos clientes ofreciéndoles flexibilidad real, sin que el negocio deje de percibir el interés pactado. Actúa sobre la estructuración del préstamo (antes de emitirlo), por lo que debe existir antes de que las otras dos funcionalidades — que actúan sobre préstamos ya en curso — tengan sentido.

**Independent Test**: al cotizar un préstamo de 12 cuotas marcando las cuotas 3 y 5 como de gracia, verificar que la tabla de amortización resultante no exige pago en esas dos cuotas, no genera mora en ellas, y que el interés ordinario de cada mes de gracia se suma al monto de la cuota inmediatamente siguiente — se puede probar de forma aislada, sin registrar ningún cobro.

**Acceptance Scenarios**:

1. **Given** que estoy cotizando o estructurando un préstamo, **When** marco una o más cuotas específicas como "mes de gracia", **Then** la tabla de amortización resultante muestra esas cuotas sin exigir pago, mientras el resto del préstamo se calcula con normalidad.
2. **Given** un préstamo con una cuota marcada como mes de gracia, **When** llega su fecha de vencimiento sin registrar ningún cobro, **Then** el sistema NO marca esa cuota como en mora ni aplica ningún interés de mora sobre ella.
3. **Given** una cuota de gracia, **When** reviso su detalle, **Then** el interés ordinario de ese período sigue calculado y visible, pero acumulado al monto de la cuota siguiente en vez de exigido de inmediato.
4. **Given** un préstamo con la cuota 3 marcada como de gracia, **When** reviso la cuota 4 (la siguiente), **Then** su monto a cobrar refleja la cuota normal más el interés acumulado de la cuota 3.
5. **Given** dos meses de gracia no consecutivos (ej. cuota 3 y cuota 5), **When** reviso la tabla completa, **Then** cada uno se comporta de forma independiente (la cuota 4 absorbe lo acumulado de la cuota 3; la cuota 6 absorbe lo acumulado de la cuota 5).

---

### User Story 2 - Registrar un abono a capital al cobrar más de lo debido (Priority: P1)

Como prestamista, cuando un cliente me paga más del valor de su cuota exigible, quiero que el excedente se aplique automáticamente como abono a capital y que el resto del préstamo se recalcule en consecuencia, para que el cliente vea reflejado de inmediato el beneficio de pagar de más, sin que yo tenga que hacer el cálculo a mano.

**Why this priority**: Junto con la Historia 1, es la funcionalidad financiera central de esta spec. Sin ella, un cliente que quiere reducir su deuda más rápido no tiene otra vía que liquidar el préstamo por completo (ya cubierto por `specs/003-operational-management/`), lo cual no siempre es lo que el cliente puede o quiere hacer.

**Independent Test**: con una cuota exigible de $X, registrar un cobro de $X + $Y (Y > 0) y verificar que la cuota queda pagada, que $Y queda registrado como abono a capital, y que la tabla de amortización futura se recalcula — se puede probar de punta a punta sin depender de las otras historias.

**Acceptance Scenarios**:

1. **Given** una cuota exigible (pendiente o parcial) con un monto a cobrar de $X, **When** registro un cobro mayor a $X, **Then** el sistema cubre primero los $X exigibles de esa cuota y aplica el excedente como abono a capital.
2. **Given** que estoy registrando un cobro mayor al valor de la cuota, **When** ingreso el monto, **Then** el sistema me muestra con claridad cuánto de ese pago cubre la cuota y cuánto se aplicará como abono a capital, antes de confirmar.
3. **Given** que confirmo un cobro con abono a capital, **When** se registra la operación, **Then** la tabla de amortización de las cuotas futuras (aún pendientes) se recalcula para reflejar la reducción de deuda.
4. **Given** la configuración por defecto del sistema, **When** se aplica un abono a capital, **Then** el plazo del préstamo se reduce (menos cuotas restantes) por defecto, salvo que la instalación tenga configurada la alternativa de mantener el plazo y reducir el valor de las cuotas restantes.
5. **Given** un abono a capital que alcanza a cubrir toda la deuda restante, **When** se registra, **Then** el préstamo queda completamente pagado (mismo resultado final que una liquidación anticipada).

---

### User Story 3 - Emitir el Certificado de Paz y Salvo al saldar un préstamo (Priority: P2)

Como prestamista, cuando un préstamo llega a un saldo de $0.00 (por plazo normal, liquidación anticipada o abonos a capital), quiero poder generar y compartir un certificado que confirme que el cliente ya no debe nada, para entregarle una prueba formal de cierre sin tener que redactarla a mano cada vez.

**Why this priority**: Es el cierre natural de la relación de crédito y una funcionalidad de cara al cliente que refuerza la confianza en el negocio, pero depende de que un préstamo llegue a $0 — algo que ya puede ocurrir hoy sin esta spec, por lo que no bloquea la operación diaria si se entrega después de las Historias 1 y 2.

**Independent Test**: con un préstamo cuyo saldo restante es exactamente $0.00, abrir su detalle y generar el certificado, verificando que el botón de cobro ya no está disponible y que el documento generado muestra cliente, préstamo y fecha de cierre — se puede probar de forma aislada, con un préstamo ya liquidado por cualquier vía.

**Acceptance Scenarios**:

1. **Given** un préstamo cuyo saldo restante llega exactamente a $0.00, **When** abro su detalle, **Then** el botón de "Cobrar" ya no está disponible y en su lugar veo un botón prominente "Generar Paz y Salvo".
2. **Given** que presiono "Generar Paz y Salvo", **When** el documento se genera, **Then** muestra el nombre del cliente, los datos del préstamo, y la fecha en la que se saldó la deuda.
3. **Given** un certificado ya generado, **When** necesito compartirlo, **Then** puedo hacerlo desde una vista pensada para compartir o imprimir (mismo patrón que los comprobantes de `specs/004-whatsapp-automation/`).
4. **Given** un préstamo que todavía tiene saldo pendiente (aunque sea $0.01), **When** reviso su detalle, **Then** el botón "Generar Paz y Salvo" NO está disponible — solo aparece con saldo exactamente en cero.

---

### Edge Cases

- **Mes de gracia en la primera cuota**: si la cuota 1 se marca como de gracia, no existe una cuota previa — el interés ordinario de ese primer período se acumula igual sobre la cuota 2, sin excepción por ser la primera.
- **Mes de gracia en la última cuota**: el sistema no debe permitir que la última cuota del préstamo sea de gracia, porque no existiría una cuota siguiente donde acumular el interés pendiente y el préstamo nunca cerraría en $0.
- **Todas o casi todas las cuotas marcadas como gracia**: es una combinación válida siempre que la última cuota no sea de gracia (FR-004) — esta spec no impone un tope adicional por cantidad o porcentaje; queda a criterio del prestamista.
- **Abono a capital sobre una cuota que ya tiene mora**: el excedente se aplica igual como abono a capital una vez cubierto lo exigible de esa cuota (incluyendo cualquier mora ya generada); no se reordena el excedente hacia cuotas futuras vencidas.
- **Abono a capital que cae exactamente sobre una cuota de gracia futura**: al recalcular el plazo, una cuota que iba a ser "de gracia" puede quedar absorbida o eliminada del calendario si el abono cubre ese período por completo; el sistema debe recalcular sin dejar un mes de gracia "huérfano" sobre una cuota que ya no existe.
- **Dos abonos a capital sucesivos sobre el mismo préstamo**: cada abono recalcula la tabla futura sobre el saldo ya reducido por el abono anterior, nunca sobre el saldo original.
- **Saldo que no llega a $0.00 exacto por redondeo**: el sistema debe usar la misma regla de conciliación de centavos ya definida en `spec.md` raíz (§5.3/§6.3) para que un préstamo que ya pagó todo lo que le correspondía siempre cierre en exactamente $0.00, nunca en una fracción de centavo de más o de menos.
- **Intento de generar el certificado antes de tiempo**: si se solicita con saldo distinto de $0.00, el sistema lo rechaza con un aviso claro en vez de generar un documento incorrecto.
- **Pérdida de conexión al registrar un cobro con abono a capital**: igual que en specs anteriores, el sistema debe avisar y no aplicar el abono ni recalcular nada hasta confirmar que la operación se guardó.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir, al estructurar o cotizar un préstamo, marcar una o más cuotas específicas (por su número) como "mes de gracia", antes de emitir el préstamo.
- **FR-002**: En una cuota marcada como mes de gracia, el sistema NO DEBE exigir su pago ni generar mora por no pagarla en su fecha de vencimiento.
- **FR-003**: En una cuota marcada como mes de gracia, el sistema DEBE seguir calculando el interés ordinario de ese período y acumularlo sobre el monto de la cuota inmediatamente siguiente (nunca condonado ni perdido).
- **FR-004**: El sistema DEBE impedir marcar como mes de gracia la última cuota del préstamo — es la única restricción de cantidad/posición exigida por esta spec; cualquier otra combinación de cuotas (incluida la mayoría del plazo) puede marcarse como gracia, quedando a criterio del prestamista.
- **FR-005**: El sistema DEBE permitir registrar un cobro por un monto mayor al exigible de la cuota actual (cuota + mora si aplica), cubriendo primero ese monto exigible y aplicando cualquier excedente como abono a capital.
- **FR-006**: Antes de confirmar un cobro con excedente, el sistema DEBE mostrar por separado cuánto cubre la cuota exigible y cuánto se aplicará como abono a capital.
- **FR-007**: Al confirmarse un abono a capital, el sistema DEBE recalcular la tabla de amortización de las cuotas aún pendientes, reduciendo el plazo (menos cuotas restantes, mismo valor de cuota) por defecto. El modo alternativo — mantener el plazo original y reducir el valor de las cuotas restantes — DEBE ser una configuración única a nivel de instalación (mismo patrón que moneda en `specs/006-rebrand-currency-polish/` y credenciales de WhatsApp en `specs/004-whatsapp-automation/`), aplicada por igual a todos los abonos a capital del negocio — no una elección puntual por transacción.
- **FR-008**: El recálculo tras un abono a capital DEBE reducir la deuda restante (capital) exactamente por el monto del excedente, sin condonar ni recalcular el interés total ya cotizado del préstamo — el cliente sigue debiendo el mismo interés total pactado al emitirse el préstamo; el abono únicamente acelera el cierre (o reduce el valor de las cuotas restantes, según FR-007), nunca reduce cuánto interés total recibe el negocio. Es el mismo criterio ya vigente para la liquidación anticipada (`specs/003-operational-management/`, Assumptions: "sin descuento ni recálculo de interés") y consistente con que el interés es fijo, calculado una sola vez sobre el capital inicial y no se recompone sobre saldo pendiente (`spec.md` raíz §5.1).
- **FR-009**: El sistema DEBE permitir generar un Certificado de Paz y Salvo únicamente cuando el saldo restante de un préstamo es exactamente $0.00, sin importar si se llegó a ese saldo por plazo normal, liquidación anticipada (`specs/003-operational-management/`) o abonos a capital.
- **FR-010**: Cuando el saldo de un préstamo llega a $0.00, el sistema DEBE ocultar la acción de "Cobrar" sobre ese préstamo y mostrar en su lugar la acción de generar el Certificado de Paz y Salvo.
- **FR-011**: El Certificado de Paz y Salvo generado DEBE mostrar como mínimo: el nombre del cliente, los datos identificativos del préstamo, y la fecha de cierre (fecha en la que el saldo llegó a $0.00).
- **FR-012**: El sistema DEBE permitir compartir o imprimir el Certificado de Paz y Salvo generado, siguiendo el mismo patrón de vista compartible ya usado para los comprobantes de `specs/004-whatsapp-automation/`.
- **FR-013**: El sistema NO DEBE reimplementar ninguna fórmula financiera (cálculo de interés, amortización, mora, redondeo) fuera del motor financiero ya existente — Meses de Gracia y Abonos a Capital extienden ese mismo motor, y ambas apps (móvil y web) heredan el cálculo por igual (Principio II de la constitución, mismo criterio que `specs/003-operational-management/` FR-011).
- **FR-014**: Todo estado derivado de estas funcionalidades (si una cuota es de gracia, si un préstamo ya tiene abonos a capital, si ya alcanzó saldo $0.00) DEBE calcularse a partir de los mismos datos de `prestamos`/`cuotas`/cobros, nunca almacenado como un valor independiente que deba mantenerse sincronizado a mano (Principio IV de la constitución, mismo criterio que `specs/003-operational-management/` FR-010).

### Key Entities *(include if feature involves data)*

- **Préstamo**: ahora puede tener una o más de sus cuotas marcadas como "de gracia" desde su estructuración, y puede recibir abonos a capital a lo largo de su vida — ambos afectan cómo se calcula su tabla de amortización y cuándo llega a saldo $0.00.
- **Cuota**: gana un indicador de si es "mes de gracia" (fijo desde la estructuración del préstamo, igual que capital/interés/fecha de vencimiento) y puede ver su monto recalculado si un abono a capital reduce el plazo o el valor de las cuotas restantes.
- **Cobro**: cuando su monto supera lo exigible de la cuota, queda dividido conceptualmente en dos partes — lo que cubre la cuota y lo que se aplica como abono a capital.
- **Certificado de Paz y Salvo**: documento generado a partir de un préstamo con saldo $0.00 — cliente, préstamo y fecha de cierre; es un comprobante formal del mismo estado ya derivado, no un dato calculado de forma distinta cada vez.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un prestamista puede estructurar un préstamo marcando cuotas específicas como mes de gracia en menos de 1 minuto adicional sobre el flujo de cotización ya existente.
- **SC-002**: El 100% de las cuotas marcadas como mes de gracia nunca generan mora ni bloquean el préstamo, y su interés ordinario siempre aparece reflejado en la cuota siguiente, sin excepción.
- **SC-003**: Un prestamista puede registrar un cobro con excedente y ver de inmediato (en la misma pantalla, antes de confirmar) cuánto de ese pago se aplica como abono a capital.
- **SC-004**: El 100% de los abonos a capital registrados reducen la deuda restante del préstamo exactamente por el monto del excedente, sin fracciones de centavo perdidas o de más.
- **SC-005**: Un prestamista puede generar y compartir un Certificado de Paz y Salvo en menos de 30 segundos desde que un préstamo llega a saldo $0.00.
- **SC-006**: El 100% de los préstamos con saldo distinto de $0.00 nunca muestran la opción de generar el Certificado de Paz y Salvo.

## Assumptions

- **Un solo prestamista administrador**, consistente con `spec.md` raíz y todas las specs anteriores — esta spec no introduce roles, permisos ni un segundo tipo de usuario.
- **Los meses de gracia se definen únicamente al estructurar/cotizar un préstamo, antes de su emisión** — consistente con la regla ya vigente de que un préstamo emitido es inmutable en sus términos (`spec.md` raíz, Edge Cases); esta spec no cubre marcar una cuota como de gracia sobre un préstamo ya activo.
- **El Certificado de Paz y Salvo se genera bajo demanda cada vez que se solicita**, a partir del mismo estado derivado (saldo $0.00) — no se define en esta spec como un registro permanente separado que deba almacenarse o versionarse; puede volver a generarse tantas veces como se necesite mientras el préstamo siga en $0.00.
- **El modelo de interés simple/fijo ya definido (`spec.md` raíz §5.1) se mantiene como base de cálculo** — esta spec añade dos mecanismos que modifican CUÁNDO se exige el pago (gracia) y CUÁNTO capital queda pendiente (abono a capital); no reemplaza el modelo de interés simple por uno de saldo decreciente.
- **Los abonos a capital están disponibles para cualquier préstamo activo**, tenga o no meses de gracia configurados — ambas funcionalidades son independientes entre sí, aunque pueden coexistir en un mismo préstamo (ver Edge Cases).
- **La generación del certificado no depende de integración con WhatsApp** — compartirlo reutiliza el mismo patrón de vista compartible de `specs/004-whatsapp-automation/`, pero el envío automático por WhatsApp queda fuera de alcance de esta spec.
- **El modo de recálculo tras un abono a capital (reducir plazo vs. reducir cuota) es una única configuración a nivel de instalación**, no una elección por transacción — decisión confirmada con el negocio al validar esta spec.
- **Un abono a capital nunca condona interés** — el interés total que el negocio recibe por un préstamo es el mismo con o sin abonos a capital; estos solo cambian cuándo y en qué tamaño de cuotas se termina de cobrar ese total — decisión confirmada con el negocio, consistente con el comportamiento ya vigente de la liquidación anticipada.
- **No hay tope de cantidad o porcentaje de cuotas marcadas como gracia**, más allá de no poder ser la última cuota del préstamo — decisión confirmada con el negocio; se delega el buen criterio comercial al prestamista.
