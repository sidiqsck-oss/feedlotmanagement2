-- ============================================================
-- FEEDLOT MANAGEMENT — Supabase SQL Schema
-- Paste this into Supabase SQL Editor and click RUN
-- ============================================================

-- 1. INDUKSI (primary: rfid)
CREATE TABLE IF NOT EXISTS induksi (
    rfid            TEXT PRIMARY KEY,
    shipment        TEXT,
    tanggal         DATE,
    eartag          TEXT,
    berat           NUMERIC(10,2) DEFAULT 0,
    pen             TEXT,
    gigi            TEXT DEFAULT '0',
    frame           TEXT,
    "kodeProperty"  TEXT,
    vitamin         INTEGER DEFAULT 1,
    "jenisSapi"     TEXT
);

CREATE INDEX IF NOT EXISTS idx_induksi_shipment ON induksi(shipment);
CREATE INDEX IF NOT EXISTS idx_induksi_pen      ON induksi(pen);
CREATE INDEX IF NOT EXISTS idx_induksi_eartag   ON induksi(eartag);
CREATE INDEX IF NOT EXISTS idx_induksi_tanggal  ON induksi(tanggal);

-- 2. REWEIGHT (primary: auto id)
CREATE TABLE IF NOT EXISTS reweight (
    id              SERIAL PRIMARY KEY,
    rfid            TEXT,
    "tglInduksi"    DATE,
    tanggal         DATE,
    eartag          TEXT,
    shipment        TEXT,
    berat           NUMERIC(10,2) DEFAULT 0,
    "beratInduksi"  NUMERIC(10,2) DEFAULT 0,
    "penInduksi"    TEXT,
    "penAwal"       TEXT,
    "penAkhir"      TEXT,
    dof             INTEGER DEFAULT 0,
    adg             NUMERIC(6,2) DEFAULT 0,
    frame           TEXT,
    vitamin         INTEGER DEFAULT 1,
    "jenisSapi"     TEXT
);

CREATE INDEX IF NOT EXISTS idx_reweight_rfid     ON reweight(rfid);
CREATE INDEX IF NOT EXISTS idx_reweight_shipment ON reweight(shipment);
CREATE INDEX IF NOT EXISTS idx_reweight_penAwal  ON reweight("penAwal");
CREATE INDEX IF NOT EXISTS idx_reweight_penAkhir ON reweight("penAkhir");
CREATE INDEX IF NOT EXISTS idx_reweight_tanggal  ON reweight(tanggal);

-- 3. PENJUALAN (primary: auto id)
CREATE TABLE IF NOT EXISTS penjualan (
    id              SERIAL PRIMARY KEY,
    rfid            TEXT,
    pembeli         TEXT,
    "tanggalJual"   DATE,
    eartag          TEXT,
    shipment        TEXT,
    berat           NUMERIC(10,2) DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_penjualan_rfid       ON penjualan(rfid);
CREATE INDEX IF NOT EXISTS idx_penjualan_pembeli     ON penjualan(pembeli);
CREATE INDEX IF NOT EXISTS idx_penjualan_tanggalJual ON penjualan("tanggalJual");

-- 4. MASTER_DATA (composite key: type + value)
CREATE TABLE IF NOT EXISTS master_data (
    type    TEXT NOT NULL,
    value   TEXT NOT NULL,
    PRIMARY KEY (type, value)
);

CREATE INDEX IF NOT EXISTS idx_master_data_type ON master_data(type);

-- 5. USERS
CREATE TABLE IF NOT EXISTS users (
    username    TEXT PRIMARY KEY,
    password    TEXT NOT NULL,
    role        TEXT DEFAULT 'user',
    permissions JSONB DEFAULT '{}'::jsonb
);

-- 6. SETTINGS (key-value store)
CREATE TABLE IF NOT EXISTS settings (
    key     TEXT PRIMARY KEY,
    value   JSONB
);

-- 7. LOGS
CREATE TABLE IF NOT EXISTS logs (
    id          SERIAL PRIMARY KEY,
    "timestamp" TIMESTAMPTZ DEFAULT NOW(),
    action      TEXT,
    detail      TEXT
);

CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs("timestamp");

-- ============================================================
-- ROW LEVEL SECURITY
-- Permissive policies (client uses anon key from authenticated PWA)
-- ============================================================
ALTER TABLE induksi     ENABLE ROW LEVEL SECURITY;
ALTER TABLE reweight    ENABLE ROW LEVEL SECURITY;
ALTER TABLE penjualan   ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for induksi"     ON induksi     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for reweight"    ON reweight    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for penjualan"   ON penjualan   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for master_data" ON master_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for users"       ON users       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for settings"    ON settings    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for logs"        ON logs        FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- DONE! Schema ready for Feedlot Management PWA sync.
-- ============================================================
