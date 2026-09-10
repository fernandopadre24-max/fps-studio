-- FPS Studio - Schema Supabase
-- Execute este SQL no Supabase SQL Editor
-- https://supabase.com → Seu projeto → SQL Editor

-- ============================================
-- TABELA: servicos
-- ============================================
CREATE TABLE IF NOT EXISTS servicos (
    doc_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    id INTEGER UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    descricao TEXT DEFAULT '',
    preco NUMERIC(10,2) DEFAULT 0,
    duracao TEXT DEFAULT '',
    icone TEXT DEFAULT 'fa-cog',
    imagem TEXT DEFAULT '',
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABELA: materiais
-- ============================================
CREATE TABLE IF NOT EXISTS materiais (
    doc_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    id INTEGER UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    descricao TEXT DEFAULT '',
    preco NUMERIC(10,2) DEFAULT 0,
    estoque INTEGER DEFAULT 0,
    categoria TEXT DEFAULT 'outro',
    imagem TEXT DEFAULT '',
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABELA: clientes
-- ============================================
CREATE TABLE IF NOT EXISTS clientes (
    doc_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    id INTEGER UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    telefone TEXT DEFAULT '',
    senha TEXT NOT NULL,
    pin TEXT DEFAULT '',
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABELA: pedidos
-- ============================================
CREATE TABLE IF NOT EXISTS pedidos (
    doc_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    id INTEGER UNIQUE NOT NULL,
    cliente_id INTEGER REFERENCES clientes(id),
    servicos INTEGER[] DEFAULT '{}',
    materiais INTEGER[] DEFAULT '{}',
    desconto NUMERIC(10,2) DEFAULT 0,
    status TEXT DEFAULT 'pendente',
    data DATE DEFAULT CURRENT_DATE,
    total NUMERIC(10,2) DEFAULT 0,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABELA: movimentacoes
-- ============================================
CREATE TABLE IF NOT EXISTS movimentacoes (
    doc_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    id INTEGER UNIQUE NOT NULL,
    tipo TEXT NOT NULL,
    descricao TEXT DEFAULT '',
    valor NUMERIC(10,2) DEFAULT 0,
    categoria TEXT DEFAULT 'outro',
    pagamento TEXT DEFAULT 'pix',
    data DATE DEFAULT CURRENT_DATE,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABELA: chats
-- ============================================
CREATE TABLE IF NOT EXISTS chats (
    doc_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tipo TEXT DEFAULT 'mensagem',
    remetente TEXT DEFAULT 'client',
    cliente_id INTEGER,
    mensagem TEXT DEFAULT '',
    descricao TEXT DEFAULT '',
    valor NUMERIC(10,2) DEFAULT 0,
    validade TEXT DEFAULT '',
    data TIMESTAMPTZ DEFAULT NOW(),
    lida BOOLEAN DEFAULT FALSE
);

-- ============================================
-- TABELA: config (controle de seed)
-- ============================================
CREATE TABLE IF NOT EXISTS config (
    chave TEXT PRIMARY KEY,
    valor TEXT DEFAULT '',
    criado TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- HABILITAR RLS (Row Level Security)
-- ============================================
ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLICIES - Acesso total (para uso interno)
-- ============================================
CREATE POLICY "Acesso total servicos" ON servicos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total materiais" ON materiais FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total clientes" ON clientes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total pedidos" ON pedidos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total movimentacoes" ON movimentacoes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total chats" ON chats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total config" ON config FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- ÍNDICES para performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_chats_cliente ON chats(cliente_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_data ON movimentacoes(data);
CREATE INDEX IF NOT EXISTS idx_clientes_email ON clientes(email);
