# Quickstart: Marca Prestly, selector de moneda y cierre de brechas de mockup

## Prerrequisitos

- Supabase local corriendo con la migración `0006_configuracion_app.sql` y `supabase/seed.sql` aplicados: `npx supabase db reset` (dentro de `supabase/`).
- `npm install && npm run build --workspace=@repo/core --workspace=@repo/data-supabase --workspace=@repo/ui`.
- `apps/web` en `http://localhost:5300` (`npm run dev -w apps/web`) y `apps/mobile` vía `npm run web -w mobile` (`http://localhost:8081`).

## Historia 1 — Selector de moneda

1. Base recién reseteada → abrir Dashboard (web) → los montos aparecen en formato `$X.XXX.XXX` sin decimales (COP por defecto), sin haber tocado ninguna configuración.
2. Ir a "Configuración" (antes "WhatsApp") → tarjeta "Moneda" → seleccionar "Dólar estadounidense" → guardar.
3. Sin recargar la página, navegar a Clientes, Préstamos activos y Calculadora → todos los montos ahora muestran `$X,XXX.XX` (formato USD, 2 decimales).
4. Abrir `apps/mobile` (o refrescar si ya estaba abierta) → Ruta de hoy / Directorio muestran los montos también en USD — sin ningún control para cambiarla ahí.
5. Volver a la web y regresar la moneda a COP → confirmar que ambas apps vuelven a mostrar pesos colombianos sin decimales.

## Historia 2 — Identidad "Prestly"

1. Abrir la web → el panel lateral muestra "Prestly" junto al logo (no "Microcréditos").
2. Revisar `apps/mobile/app.json` → `expo.name` es `"Prestly"`; al compilar/abrir con Expo Go, el nombre bajo el ícono es "Prestly".

## Historia 3 — Alta de cliente sin préstamo

1. Directorio de clientes (web) → botón "Nuevo cliente" → completar nombre + teléfono (sin préstamo) → guardar → el cliente aparece en la tabla con estado "Sin préstamo activo" y saldo $0.
2. Repetir en `apps/mobile` con el botón "+ Nuevo" del Directorio.
3. Intentar crear un cliente con un teléfono ya usado por el cliente del paso 1 → el sistema rechaza la creación con un mensaje de duplicado, en ambas plataformas.

## Historia 4 — Fidelidad del flujo móvil

1. Calculadora → cotizar cualquier préstamo → confirmar botón "Compartir tabla por WhatsApp" con ícono, que abre WhatsApp directo (no el selector nativo de compartir del SO).
2. En la misma pantalla, alternar "Ver resumen"/"Ver tabla completa" → confirmar que se ve como dos pestañas (control segmentado), no un texto que cambia.
3. Abrir el perfil 360° de un cliente sembrado → "Notas privadas" se ve de solo lectura con un enlace "Editar"; al tocarlo, se habilita la edición.
4. En el mismo perfil, confirmar la barra de acciones inferior fija con "Llamar", "WhatsApp" y "Nuevo préstamo" — este último abre la calculadora con el cliente ya preseleccionado.
5. Ruta de cobranza → el botón de acción de cada fila es un cuadrado redondeado, no un círculo.

## Historia 5 — Fidelidad y contenido del panel web

1. Préstamos activos/Amortización → las pestañas de filtro muestran su conteo ("Todas · N"); la tabla de un préstamo incluye la columna "Saldo restante" y sus valores cuadran con `monto_cuota - monto_pagado` de cada fila.
2. Directorio de clientes → aparecen las 3 tarjetas KPI sobre la tabla; la tabla incluye préstamos/comportamiento/próximo pago/acciones; al pie, una barra con saldo agregado y score medio de los clientes listados.
3. Abrir el drawer de un cliente con préstamo activo y algún cobro ya registrado (usar un cliente sembrado con pago parcial) → aparece la tarjeta "Cobrado" (además de "Prestado"/"Saldo") y la barra de progreso con "X de Y · Z%".
4. En el mismo drawer, pulsar "Perfil completo" → navega a `/clientes/:id` con historial de préstamos, notas y score de ese cliente, sin errores incluso para un cliente sembrado "sin préstamo activo" (debe mostrar su estado vacío, no un error).

## Historia 6 — Datos semilla

1. `npx supabase db reset` → abrir el directorio de clientes (web o mobile) sin ninguna acción manual adicional.
2. Confirmar que existen clientes cubriendo: al día, en mora reciente, en mora antigua, cobro hoy, con un pago parcial ya registrado, con un préstamo liquidado, y sin ningún préstamo activo.
3. Confirmar que entre los préstamos sembrados están representadas las 3 frecuencias (semanal, quincenal, mensual) y que los montos son de la magnitud esperada para pesos colombianos (cientos de miles), no cifras pensadas para dólares.

## Verificación de punta a punta esperada

Todas las historias verificadas contra la base local recién reseteada (`npx supabase db reset`), mismo estándar que fases 1-5. La Historia 1 (moneda) debe verificarse cambiando efectivamente entre las 3 opciones al menos una vez cada una, no solo confirmando el valor por defecto.
