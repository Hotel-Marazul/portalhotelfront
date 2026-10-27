-- Cadastro de referência fornecido pelo hotel em 2026-10-26.
-- Executar no PostgreSQL do PortalHotel com psql -X -v ON_ERROR_STOP=1 -f <arquivo>.
-- Não altera preços gerais, quartos, reservas, pagamentos nem regras legadas.
-- Não é consumido automaticamente pelo cálculo atual de reservas.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SELECT pg_advisory_xact_lock(hashtextextended('marazul-summer-tariffs-2026-10-26', 0));

CREATE TABLE IF NOT EXISTS hotel_seasonal_rate_catalogs (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (currency = 'BRL'),
  season_months SMALLINT[] NOT NULL
    CHECK (cardinality(season_months) > 0
      AND season_months <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[]),
  check_in_time TIME NOT NULL,
  check_out_time TIME NOT NULL,
  usage_status TEXT NOT NULL CHECK (usage_status = 'reference_only'),
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE hotel_seasonal_rate_catalogs IS
  'Tabelas comerciais informadas pelo hotel. Referência sem aplicação automática na precificação operacional.';

DO $import$
DECLARE
  catalog_code CONSTANT TEXT := 'marazul-summer-reported-2026-10-26';
  catalog_payload CONSTANT JSONB := $json$
  {
    "reportedOn": "2026-10-26",
    "season": "Verão — dezembro a fevereiro",
    "seasonYear": null,
    "yearNote": "Ano não especificado pelo hotel; não renovar valores automaticamente para temporadas futuras.",
    "rateBasis": "couple_per_daily",
    "coupleRates": [
      {"category": "Super Luxo", "advertisedName": "S. LUXO", "breakfast": 528.00, "halfBoard": 638.00},
      {"category": "Luxo", "advertisedName": "LUXO", "breakfast": 495.00, "halfBoard": 605.00},
      {"category": "Standard", "advertisedName": "STANDARD", "breakfast": 473.00, "halfBoard": 583.00},
      {"category": "Simples", "advertisedName": "SIMPLES", "breakfast": 440.00, "halfBoard": 550.00}
    ],
    "additionalGuestRates": [
      {"minAge": 0, "maxAge": 2, "amount": 0.00, "billingBasis": "free"},
      {"minAge": 3, "maxAge": 5, "amount": 100.00, "billingBasis": "per_stay"},
      {"minAge": 6, "maxAge": 11, "amount": 120.00, "billingBasis": "per_daily"},
      {"minAge": 12, "maxAge": null, "amount": 200.00, "billingBasis": "per_daily"}
    ],
    "additionalGuestMealPlans": ["breakfast", "half_board"],
    "minimumStayPolicy": "deferred_by_hotel",
    "dailyExample": {"checkIn": "20/12 14:00", "checkOut": "25/12 12:00", "dailyUnits": 5},
    "integrationStatus": "reference_only_not_used_by_reservation_pricing"
  }
  $json$::jsonb;
BEGIN
  IF current_database() <> 'portal_hotel' THEN
    RAISE EXCEPTION 'Importação restrita ao banco portal_hotel.';
  END IF;

  INSERT INTO hotel_seasonal_rate_catalogs (
    code, name, currency, season_months, check_in_time, check_out_time,
    usage_status, payload
  ) VALUES (
    catalog_code, 'Hotel Marazul — tarifas de verão', 'BRL', ARRAY[12,1,2]::smallint[],
    '14:00', '12:00', 'reference_only', catalog_payload
  ) ON CONFLICT (code) DO NOTHING;

  -- Reexecução é idempotente; divergências falham sem sobrescrever dados.
  IF NOT EXISTS (
    SELECT 1 FROM hotel_seasonal_rate_catalogs
    WHERE code = catalog_code AND payload = catalog_payload
      AND name = 'Hotel Marazul — tarifas de verão' AND currency = 'BRL'
      AND season_months = ARRAY[12,1,2]::smallint[]
      AND check_in_time = '14:00'::time AND check_out_time = '12:00'::time
      AND usage_status = 'reference_only'
  ) THEN
    RAISE EXCEPTION 'Catálogo existente diverge da tabela informada; nenhuma alteração aplicada.';
  END IF;
END;
$import$;

COMMIT;
