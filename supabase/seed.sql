-- Datos semilla (specs/006-rebrand-currency-polish/, US6) — cartera de ejemplo en pesos
-- colombianos, cargada automáticamente en cada `supabase db reset` (config.toml, [db.seed]).
--
-- Todas las fechas se calculan relativas a CURRENT_DATE (no hay fechas absolutas) para que la
-- cartera de ejemplo siga siendo realista sin importar cuándo se ejecute el reseteo.
--
-- `pg_temp.seed_prestamo(...)` reproduce la misma fórmula de interés simple de spec.md raíz
-- §5.1 (interesTotal = capital × tasa, última cuota absorbe el residuo de redondeo, §5.3) — no
-- es un generador aleatorio, solo evita repetir esa aritmética a mano 9 veces. Vive en el
-- esquema temporal de la sesión (pg_temp), así que no queda como función permanente del
-- proyecto una vez que termina de correr este script.

CREATE FUNCTION pg_temp.seed_prestamo(
  p_nombre TEXT,
  p_telefono TEXT,
  p_direccion TEXT,
  p_capital NUMERIC,
  p_tasa NUMERIC,
  p_num_cuotas INTEGER,
  p_frecuencia frecuencia_pago,
  p_fecha_emision DATE
) RETURNS UUID AS $$
DECLARE
  v_cliente_id UUID;
  v_prestamo_id UUID;
  v_interes_total NUMERIC;
  v_capital_cuota NUMERIC;
  v_interes_cuota NUMERIC;
  v_intervalo INTERVAL;
  v_cap_i NUMERIC;
  v_int_i NUMERIC;
  i INTEGER;
BEGIN
  INSERT INTO clientes (nombre, telefono, direccion) VALUES (p_nombre, p_telefono, p_direccion) RETURNING id INTO v_cliente_id;

  INSERT INTO prestamos (cliente_id, capital, tasa_interes, num_cuotas, frecuencia, fecha_emision)
  VALUES (v_cliente_id, p_capital, p_tasa, p_num_cuotas, p_frecuencia, p_fecha_emision)
  RETURNING id INTO v_prestamo_id;

  v_interes_total := p_capital * p_tasa;
  v_capital_cuota := ROUND(p_capital / p_num_cuotas, 2);
  v_interes_cuota := ROUND(v_interes_total / p_num_cuotas, 2);
  v_intervalo := CASE p_frecuencia
    WHEN 'semanal' THEN INTERVAL '7 days'
    WHEN 'quincenal' THEN INTERVAL '14 days'
    ELSE INTERVAL '1 month'
  END;

  FOR i IN 1..p_num_cuotas LOOP
    IF i < p_num_cuotas THEN
      v_cap_i := v_capital_cuota;
      v_int_i := v_interes_cuota;
    ELSE
      -- Última cuota absorbe el residuo de redondeo (spec.md raíz §5.3) — la suma de
      -- monto_capital de todas las cuotas siempre coincide exactamente con el capital.
      v_cap_i := p_capital - v_capital_cuota * (p_num_cuotas - 1);
      v_int_i := v_interes_total - v_interes_cuota * (p_num_cuotas - 1);
    END IF;

    INSERT INTO cuotas (prestamo_id, numero, fecha_vencimiento, monto_capital, monto_interes, monto_cuota)
    VALUES (v_prestamo_id, i, p_fecha_emision + (v_intervalo * i), v_cap_i, v_int_i, v_cap_i + v_int_i);
  END LOOP;

  RETURN v_prestamo_id;
END;
$$ LANGUAGE plpgsql;

-- ── 0. Cuenta administradora de desarrollo (specs/007-admin-authentication/) ───────────────
-- Nunca corre en producción — seed.sql no se aplica ahí (research.md §7). Password solo para
-- desarrollo local, documentada también en quickstart.md.
-- confirmation_token/recovery_token/email_change_token_new/email_change no tienen default en
-- este esquema de GoTrue (quedan NULL si se omiten) — su driver Go no tolera NULL ahí ("Scan
-- error ... converting NULL to string is unsupported"), a diferencia de phone_change_token/
-- reauthentication_token/etc., que sí traen default ''. Se fuerzan a '' explícitamente.
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES (
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  'admin@prestly.local', crypt('Prestly-Dev-007!', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}', false, false,
  '', '', '', ''
);

INSERT INTO auth.identities (
  id, provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at
)
SELECT
  gen_random_uuid(), id::text, id,
  jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
FROM auth.users WHERE email = 'admin@prestly.local';

-- ── 1. Camila Restrepo — al día (semanal) ───────────────────────────────────
-- Cuota 1 (vencida hace 3 días) ya pagada; la próxima cuota vence en el futuro.
DO $$
DECLARE v_prestamo_id UUID;
BEGIN
  v_prestamo_id := pg_temp.seed_prestamo('Camila Restrepo', '3001234501', 'Cra 45 #12-30, Medellín', 600000, 0.15, 6, 'semanal', CURRENT_DATE - 10);
  PERFORM registrar_cobro(id) FROM cuotas WHERE prestamo_id = v_prestamo_id AND numero = 1;
END $$;

-- ── 2. Julián Ospina — en mora reciente (4 días, semanal) ───────────────────
SELECT pg_temp.seed_prestamo('Julián Ospina', '3012345502', 'Calle 10 #5-20, Bogotá', 450000, 0.15, 6, 'semanal', CURRENT_DATE - 11);

-- ── 3. Marcela Gómez — en mora antigua (18 días, semanal) ───────────────────
SELECT pg_temp.seed_prestamo('Marcela Gómez', '3023456503', 'Av. Circunvalar #8-15, Cali', 800000, 0.18, 6, 'semanal', CURRENT_DATE - 25);

-- ── 4. Andrés Zuluaga — cobro esperado hoy (semanal) ────────────────────────
SELECT pg_temp.seed_prestamo('Andrés Zuluaga', '3034567504', 'Cra 7 #45-10, Bogotá', 500000, 0.15, 5, 'semanal', CURRENT_DATE - 7);

-- ── 5. Paula Cárdenas — pago parcial ya registrado sobre la cuota de hoy ────
DO $$
DECLARE
  v_prestamo_id UUID;
  v_cuota_id UUID;
  v_cuota_monto NUMERIC;
BEGIN
  v_prestamo_id := pg_temp.seed_prestamo('Paula Cárdenas', '3045678505', 'Cll 80 #20-40, Barranquilla', 700000, 0.15, 5, 'semanal', CURRENT_DATE - 7);
  SELECT id, monto_cuota INTO v_cuota_id, v_cuota_monto FROM cuotas WHERE prestamo_id = v_prestamo_id AND numero = 1;
  -- Abono de aproximadamente la mitad del monto de la cuota — queda 'parcial', no 'pagado'.
  PERFORM registrar_cobro(v_cuota_id, ROUND(v_cuota_monto / 2, 2));
END $$;

-- ── 6. Santiago Vélez — préstamo liquidado anticipadamente ──────────────────
DO $$
DECLARE v_prestamo_id UUID;
BEGIN
  v_prestamo_id := pg_temp.seed_prestamo('Santiago Vélez', '3056789506', 'Cra 15 #33-22, Pereira', 400000, 0.15, 4, 'semanal', CURRENT_DATE - 30);
  PERFORM liquidar_prestamo(v_prestamo_id);
END $$;

-- ── 7. Valentina Ríos — sin ningún préstamo activo ──────────────────────────
INSERT INTO clientes (nombre, telefono, direccion) VALUES ('Valentina Ríos', '3067890507', 'Cll 50 #14-08, Bucaramanga');

-- ── 8. Esteban Molina — al día (quincenal) ──────────────────────────────────
DO $$
DECLARE v_prestamo_id UUID;
BEGIN
  v_prestamo_id := pg_temp.seed_prestamo('Esteban Molina', '3078901508', 'Cra 20 #60-15, Manizales', 900000, 0.18, 6, 'quincenal', CURRENT_DATE - 20);
  PERFORM registrar_cobro(id) FROM cuotas WHERE prestamo_id = v_prestamo_id AND numero = 1;
END $$;

-- ── 9. Daniela Suárez — al día, con historial (mensual) ─────────────────────
DO $$
DECLARE v_prestamo_id UUID;
BEGIN
  v_prestamo_id := pg_temp.seed_prestamo('Daniela Suárez', '3089012509', 'Av. Santander #22-11, Bucaramanga', 1500000, 0.20, 6, 'mensual', CURRENT_DATE - 40);
  PERFORM registrar_cobro(id) FROM cuotas WHERE prestamo_id = v_prestamo_id AND numero = 1;
END $$;
