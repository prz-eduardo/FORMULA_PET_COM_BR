-- rebuild_compounding_schema.sql
-- Safe DROP of old product/taxonomy tables
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS product_tags, product_dosages, product_packaging, products, categorias, tags, dosages, embalagens;
SET FOREIGN_KEY_CHECKS = 1;

-- New catalog: units
CREATE TABLE IF NOT EXISTS units (
  code VARCHAR(16) PRIMARY KEY,         -- e.g., mg, g, kg, ml, l, un
  name VARCHAR(64) NOT NULL,
  kind ENUM('mass','volume','count','other') NOT NULL DEFAULT 'other',
  factor_to_base DECIMAL(24,12) NOT NULL -- factor to convert to base of its kind (mg->g=0.001, ml->l=0.001)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- New catalog: product forms
CREATE TABLE IF NOT EXISTS product_forms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  UNIQUE KEY uq_product_forms_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Formulas (manipulated products)
CREATE TABLE IF NOT EXISTS formulas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  form_id INT NOT NULL,
  dose_amount DECIMAL(18,6) NULL,
  dose_unit_code VARCHAR(16) NULL,
  output_unit_code VARCHAR(16) NOT NULL,
  output_quantity_per_batch DECIMAL(18,6) NULL,
  price DECIMAL(18,2) NULL,
  notes TEXT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_formulas_form FOREIGN KEY (form_id) REFERENCES product_forms(id),
  CONSTRAINT fk_formulas_dose_unit FOREIGN KEY (dose_unit_code) REFERENCES units(code),
  CONSTRAINT fk_formulas_output_unit FOREIGN KEY (output_unit_code) REFERENCES units(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Items per formula (per output unit)
CREATE TABLE IF NOT EXISTS formula_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  formula_id INT NOT NULL,
  tipo ENUM('ativo','insumo') NOT NULL,
  ativo_id INT NULL,             -- when tipo='ativo'
  insumo_nome VARCHAR(128) NULL, -- when tipo='insumo'
  quantity DECIMAL(18,6) NOT NULL,
  unit_code VARCHAR(16) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_formula_items_formula FOREIGN KEY (formula_id) REFERENCES formulas(id) ON DELETE CASCADE,
  CONSTRAINT fk_formula_items_unit FOREIGN KEY (unit_code) REFERENCES units(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Stock lots for ativos
CREATE TABLE IF NOT EXISTS estoque_ativos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ativo_id INT NOT NULL,
  quantity DECIMAL(18,6) NOT NULL,
  unit_code VARCHAR(16) NOT NULL,
  lote VARCHAR(64) NULL,
  validade DATE NULL,
  location VARCHAR(128) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_estoque_ativos_unit FOREIGN KEY (unit_code) REFERENCES units(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Stock movements audit
CREATE TABLE IF NOT EXISTS estoque_movimentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  estoque_id INT NOT NULL,
  tipo ENUM('entrada','saida','ajuste') NOT NULL,
  quantity DECIMAL(18,6) NOT NULL,
  unit_code VARCHAR(16) NOT NULL,
  reason VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mov_estoque FOREIGN KEY (estoque_id) REFERENCES estoque_ativos(id) ON DELETE CASCADE,
  CONSTRAINT fk_mov_unit FOREIGN KEY (unit_code) REFERENCES units(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seeds for units
INSERT IGNORE INTO units (code, name, kind, factor_to_base) VALUES
  ('mg','Miligrama','mass',0.001),
  ('g','Grama','mass',1.0),
  ('kg','Quilograma','mass',1000.0),
  ('ml','Mililitro','volume',0.001),
  ('l','Litro','volume',1.0),
  ('un','Unidade','count',1.0);

-- Seeds for product forms
INSERT IGNORE INTO product_forms (id, name) VALUES
  (1,'Cápsula'),
  (2,'Xarope'),
  (3,'Pomada'),
  (4,'Comprimido');
