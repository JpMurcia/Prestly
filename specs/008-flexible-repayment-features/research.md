# Research: Flexibilidad de Pago Avanzada

La spec no dejó `[NEEDS CLARIFICATION]` sin resolver (ver checklist), pero el diseño técnico requería cerrar 9 decisiones no triviales antes de poder escribir `data-model.md`/`contracts/`. Todas se resuelven aquí, con su razonamiento — ninguna vuelve a `spec.md`, son decisiones de "cómo", no de "qué" (constitución, Governance).

## D1 — Qué se traslada de una cuota de gracia a la siguiente: capital **y** interés, no solo interés

**Decisión**: el monto COMPLETO de la cuota de gracia (`principalPortion` + `interestPortion`, ambos ya fijados por `quoteLoan`) se traslada íntegro a la cuota inmediatamente siguiente.

**Rationale**: `spec.md` (FR-003) dice literalmente "el interés ordinario... se acumula", pero la regla de conciliación de `spec.md` raíz §5.3 (reforzada por FR-002/SC-002 raíz: la suma de `monto_capital` de todas las cuotas debe ser exactamente `prestamos.capital`) obliga a que el capital de la cuota de gracia también se traslade — si se perdiera, el préstamo nunca terminaría de amortizar su capital original. No es una decisión de producto nueva, es una propiedad estructural ya garantizada por el sistema; la spec no necesitaba decirlo explícitamente porque no había otra opción compatible con la reconciliación ya vigente.

**Alternativas consideradas**: (a) trasladar solo el interés y dejar el capital de la cuota de gracia diluido entre las demás cuotas — rechazada, requeriría recalcular TODAS las cuotas restantes (no solo la siguiente) y contradice el pedido explícito de "acumular sobre la cuota siguiente"; (b) añadir una cuota extra al final del préstamo por cada mes de gracia — rechazada, la spec pide acumular sobre la cuota siguiente, no extender el plazo total.

## D2 — Dónde vive la validación "la última cuota no puede ser de gracia"

**Decisión**: validación en `@repo/core` (`applyGracePeriods`, lanza `LastInstallmentCannotBeGraceError`), no un `CHECK` de Postgres.

**Rationale**: mismo patrón ya establecido para reglas de negocio con contexto (`DuplicatePhoneError` en `issueLoan`, `InvalidCredentialsError` en el login) — un `CHECK` de tabla no puede comparar "el número de esta cuota" contra "el total de cuotas de OTRA fila" sin un trigger, complejidad que la constitución (Principio V, YAGNI) no justifica cuando la validación ya vive naturalmente en el único punto de entrada (`applyGracePeriods`, llamado antes de `issueLoan`).

## D3 — Cómo se extiende el cobro con excedente: mismo `registrar_cobro`, no un RPC nuevo

**Decisión**: `registrar_cobro(p_cuota_id, p_monto)` deja de rechazar `p_monto > saldo_restante` (`MONTO_INVALIDO`); en su lugar, cubre la cuota actual y aplica el excedente como abono a capital dentro de la misma transacción atómica.

**Rationale**: es la tercera vez que este procedimiento se extiende (0002 → cobro simple; 0004 → pago parcial; ahora → excedente/abono a capital), mismo criterio que ya usó `specs/003-operational-management/` FR-007 ("reutilizar el mismo guard de concurrencia"). Un RPC nuevo (`registrar_abono_capital`) duplicaría el `FOR UPDATE`/guarda de concurrencia y obligaría a decidir un orden de llamadas desde el cliente (dos round-trips en vez de uno) — contradice Principio V. Además, al no crear una función nueva, la firma (`registrar_cobro(UUID, NUMERIC)`) no cambia, así que el `REVOKE EXECUTE ... FROM PUBLIC, anon` que `0007_auth_rls.sql` ya aplicó sobre esa firma exacta sigue vigente sin ningún `GRANT`/`REVOKE` nuevo — evita repetir el hallazgo de seguridad de spec 007 T028 (Postgres otorga `EXECUTE` a `PUBLIC` por defecto en funciones NUEVAS; esto no es una función nueva).

## D4 — Algoritmo del modo `reducir_plazo` (default): prepagar cuotas futuras completas, no eliminar filas

**Decisión**: el excedente se aplica, en orden de `numero` ascendente, pagando cuotas futuras (`pendiente`/`parcial`) POR COMPLETO a su monto ya fijado (capital+interés, sin recalcular nada) — cada una genera su propia fila en `cobros` (igual que un cobro manual normal, `abono_capital = 0` en esas filas) — hasta agotar el excedente o hasta que no queden cuotas pendientes (en cuyo caso el préstamo queda liquidado, mismo criterio que `liquidar_prestamo`). Si el excedente no alcanza para una cuota completa adicional, el remanente se aplica como pago parcial sobre la siguiente cuota aún no saldada (reutiliza el reparto proporcional capital/interés de `specs/003-operational-management/` FR-009).

**Rationale**: preserva "sin condonar interés" (spec FR-008) de forma trivial — cada cuota prepagada se cobra por su monto YA fijado (capital+interés íntegros), nunca se descuenta nada; el préstamo simplemente llega antes a $0.00 porque se adelantaron cobros que iban a ocurrir de todas formas. Es, en esencia, una liquidación anticipada PARCIAL (capada por el monto del excedente) — reutiliza exactamente la misma lógica que `liquidar_prestamo` ya usa en bucle, solo que se detiene cuando el excedente se agota en vez de cuando ya no quedan cuotas. Ninguna fila de `cuotas` se borra ni se re-numera — "menos cuotas restantes" (spec, Historia 2) se cumple porque el CONTEO de cuotas `pendiente`/`parcial` baja de inmediato, que es la definición visible para el usuario.

**Alternativas consideradas**: eliminar/cancelar las últimas cuotas del calendario en vez de prepagar las próximas — rechazada, cancelar cuotas del final significa perdonarles su interés ya fijado (viola la decisión confirmada "no condonar interés").

## D5 — Algoritmo del modo `reducir_cuota`: se reduce el capital restante, nunca el interés por cuota

**Decisión**: el excedente reduce el CAPITAL pendiente total (suma de `monto_capital` de cuotas `pendiente`/`parcial`, excluyendo la recién pagada) y ese nuevo total (`capital_restante - excedente`) se reparte entre las MISMAS cuotas futuras que ya existían (mismo conteo, mismo `numero`), con la última absorbiendo el residuo de redondeo (mismo criterio que §5.3 raíz). El `monto_interes` de cada cuota futura **no se toca** — ya estaba fijado, y no se condona.

**Rationale**: es la única redistribución matemáticamente consistente con dos reglas ya vigentes simultáneamente — interés simple fijado una sola vez en la cotización (`spec.md` raíz §5.1) y "los abonos a capital nunca condonan interés" (esta spec, FR-008 confirmado). Si se intentara reducir capital e interés proporcionalmente (como si fuera saldo decreciente real), se estaría perdonando interés — exactamente lo que el negocio decidió NO hacer.

**Consecuencia no obvia, documentada explícitamente**: si el excedente cubre TODO el capital restante, `monto_capital` de las cuotas futuras llega a $0 pero su `monto_interes` sigue debiéndose — esas cuotas se vuelven "solo interés" hasta agotarse, y el préstamo NO se liquida solo por eso (sigue habiendo saldo > $0 mientras quede interés pendiente). Es el comportamiento correcto y esperado dada la decisión de negocio, no un caso a prevenir; se documenta en `quickstart.md` para que quien verifique la feature no lo confunda con un bug.

## D6 — Dónde se configura el modo de recálculo

**Decisión**: columna nueva `configuracion_app.modo_abono_capital` (`'reducir_plazo' | 'reducir_cuota'`, default `'reducir_plazo'`) — ya resuelto en `spec.md` FR-007 (confirmado por el usuario). Mismo patrón exacto que `configuracion_app.moneda` (`specs/006-rebrand-currency-polish/`): tabla singleton, sin Vault (no es un secreto), lectura/escritura directa por `supabase-js` sin RPC, editable solo desde `apps/web` (Configuración), `apps/mobile` solo lee.

## D7 — `cliente_score` debe excluir las cuotas de gracia de su denominador

**Decisión**: la `VIEW cliente_score` (puntualidad = cuotas pagadas a tiempo / cuotas históricas) se recrea (`CREATE OR REPLACE`, mismas columnas de salida) agregando `AND NOT cu.es_gracia` a los dos `COUNT(...) FILTER` que hoy cuentan `cuotas_pagadas`/`cuotas_historicas`.

**Rationale**: una cuota de gracia se inserta directamente `pagado`/`$0` (D8) — sin este ajuste, cada mes de gracia INFLARÍA artificialmente el score de puntualidad del cliente (parecería que pagó a tiempo algo que en realidad el prestamista le eximió). Es un ajuste real de comportamiento, mismo tipo de corrección que `specs/003-operational-management/` ya le hizo a `cartera_resumen` al introducir el estado `'parcial'` (no es un cambio de alcance, es una consecuencia necesaria de la nueva columna).

## D8 — Cómo se persiste una cuota de gracia: `pagado`/$0 desde su inserción, no un estado nuevo

**Decisión**: al emitir el préstamo, cada cuota marcada como gracia se inserta con `estado = 'pagado'`, `monto_cuota = monto_capital = monto_interes = 0`, `monto_pagado = 0`, `fecha_pago = fecha_vencimiento`, `es_gracia = true`. Su monto original (antes de trasladarse, D1) ya quedó sumado a la cuota siguiente por `applyGracePeriods` — la fila persistida de la cuota de gracia es puramente informativa (para mostrar el badge "Gracia" en vez de "Pagado").

**Rationale**: evita tocar CUALQUIER lógica de mora existente (`idx_cuotas_pendientes`, `cartera_resumen.cartera_en_mora`, `listCollectionRoute`) — todas ya filtran por `estado IN ('pendiente','parcial')`, así que una cuota de gracia con `estado='pagado'` desaparece de mora/cobranza sin ningún cambio adicional (Principio V, YAGNI: cero superficie nueva de bugs en código que ya funciona). La alternativa (un cuarto valor de `estado`, p. ej. `'gracia'`) obligaría a auditar y ajustar cada uno de esos lugares — exactamente el tipo de esfuerzo que `specs/003-operational-management/` ya documentó como necesario al añadir `'parcial'` (Edge Cases), pero aquí es evitable porque, a diferencia de un pago parcial, una cuota de gracia no tiene NADA pendiente que cobrar.

**Alternativas consideradas**: nuevo valor de `estado` (`'gracia'`) — rechazada por el costo de auditoría de arriba, sin beneficio real (el badge de UI puede distinguirse con la columna `es_gracia`, que hace falta de todos modos para D7).

## D9 — El bloque "cambio a entregar" del modal de cobro se REEMPLAZA, no coexiste

**Decisión**: el badge "Excedente de $X irá a Abono a Capital" (spec FR-006) sustituye al bloque "Cambio a entregar" que hoy calcula `registerPayment` (`packages/core/src/use-cases/registerPayment.ts`) en `RegisterPaymentModal` (mobile) y el flujo equivalente de `LoanAmortizationPage` (web). `registerPayment`/`RegisterPaymentResult` NO se borran de `@repo/core` (siguen siendo una función pura válida y ya testeada), pero dejan de ser lo que este flujo de UI invoca — se sustituyen ahí por `splitPaymentForInstallment` (contracts/core-interfaces.md).

**Rationale**: `spec.md` (FUNCIONALIDAD 2 original) es inequívoca — un monto mayor al de la cuota "debe" mostrar el aviso de abono a capital, no un cambio a entregar en efectivo. Hoy ningún flujo de UI permite siquiera ingresar un monto mayor (el `<input>` web tiene `max={remainingBalance}`, y `registrar_cobro` lo rechazaba server-side) — el bloque de "cambio" nunca se activaba en producción real; es código muerto en la práctica que esta feature reutiliza con el propósito correcto en vez de mantener dos caminos paralelos para el mismo monto excedente.

## Caso de prueba de referencia para Fase 0 (verificado a mano, confirma que D1-D5 reconcilian)

Préstamo $500 / 15% / 12 cuotas semanales (el mismo caso de la constitución) — cuota=$47.92 (capital $41.67 + interés $6.25, salvo la 12ª que absorbe el residuo).

- **Gracia en la cuota 3**: cuota 3 pasa a `pagado`/$0/`es_gracia=true`; cuota 4 pasa a exigir $47.92 (su propia cuota) + $47.92 (lo trasladado de la 3) = **$95.84**, capital $83.34 + interés $12.50. El resto del calendario (cuotas 1-2, 5-12) no cambia. Suma total de `monto_capital` de las 12 filas sigue siendo exactamente $500.00 (D1).
- **Abono a capital de $100 sobre la cuota 1** ($47.92 exigibles + $52.08 de excedente), modo `reducir_plazo`: la cuota 1 se paga completa; el excedente ($52.08) no alcanza para prepagar la cuota 2 completa ($47.92 sí, sobran $4.16) — la cuota 2 se prepaga completa (fila propia en `cobros`) y los $4.16 restantes quedan como pago parcial sobre la cuota 3. Cuotas pendientes bajan de 11 a 9 (más el parcial en la 3) en una sola operación.
- **Mismo abono, modo `reducir_cuota`**: capital restante antes del abono (cuotas 2-12) = $458.33; tras descontar el excedente ($52.08) → $406.25, repartido entre las 11 cuotas restantes ($36.93 c/u, la 12ª absorbe el residuo); el interés de cada una de esas 11 cuotas sigue siendo $6.25 (sin tocar). Nueva cuota 2 = $36.93 + $6.25 = $43.18.
