
-- ==========================================================
-- UNITED BAYLOR ACADEMY: UNIFIED DATA HUB v10.0.2 (MASTER)
-- ==========================================================

-- 1. IDENTITY HUB: Primary Authentication Registry
CREATE TABLE IF NOT EXISTS public.uba_identities (
    email TEXT PRIMARY KEY,        -- Unique Identity Anchor
    full_name TEXT NOT NULL,
    node_id TEXT NOT NULL,         -- Official Index Number or Staff ID
    hub_id TEXT NOT NULL,          -- Institutional Node ID
    role TEXT NOT NULL,            -- super_admin, school_admin, facilitator, pupil
    unique_code TEXT,              -- 6-Digit PIN or Master Key
    merit_balance DOUBLE PRECISION DEFAULT 0 NOT NULL,
    monetary_balance DOUBLE PRECISION DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CRITICAL: node_id must be unique across the network for routing logic
CREATE UNIQUE INDEX IF NOT EXISTS idx_uba_identities_node_id ON public.uba_identities(node_id);

-- 2. FACILITATOR REGISTRY: Detailed Staff Records
CREATE TABLE IF NOT EXISTS public.uba_facilitators (
    email TEXT PRIMARY KEY REFERENCES public.uba_identities(email) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    hub_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    taught_subject TEXT,
    teaching_category TEXT DEFAULT 'BASIC_SUBJECT_LEVEL',
    unique_code TEXT,
    invigilation_data JSONB DEFAULT '[]'::jsonb,
    last_active TIMESTAMPTZ DEFAULT NOW()
);

-- 3. QUESTIONS REGISTRY: Relational Shards for Exam Items
CREATE TABLE IF NOT EXISTS public.uba_questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    external_id TEXT UNIQUE,
    hub_id TEXT NOT NULL,
    facilitator_email TEXT,
    subject TEXT NOT NULL,
    type TEXT CHECK (type IN ('OBJECTIVE', 'THEORY')),
    blooms_level TEXT,
    strand TEXT,
    strand_code TEXT,
    sub_strand TEXT,
    sub_strand_code TEXT,
    indicator_code TEXT,
    indicator_text TEXT,
    question_text TEXT NOT NULL,
    instruction TEXT,
    correct_key TEXT,               
    answer_scheme TEXT,             
    weight INTEGER DEFAULT 1,
    diagram_url TEXT,
    answer_diagram_url TEXT,
    ghanaian_language_tag TEXT,
    is_structured BOOLEAN DEFAULT TRUE,
    section TEXT CHECK (section IN ('A', 'B')),
    status TEXT DEFAULT 'PENDING',  
    usage_count INTEGER DEFAULT 0,
    wrong_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SCORE REGISTRY: Granular Performance Shards
CREATE TABLE IF NOT EXISTS public.uba_mock_scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    hub_id TEXT NOT NULL,
    student_id TEXT NOT NULL,       
    mock_series TEXT NOT NULL,      
    subject TEXT NOT NULL,
    total_score DOUBLE PRECISION DEFAULT 0,
    sba_score DOUBLE PRECISION DEFAULT 0,
    section_a DOUBLE PRECISION DEFAULT 0, 
    section_b DOUBLE PRECISION DEFAULT 0, 
    grade TEXT,
    remark TEXT,
    academic_year TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(hub_id, student_id, mock_series, subject)
);

-- 5. PUPIL REGISTRY: Institutional Roster Matrix
CREATE TABLE IF NOT EXISTS public.uba_pupils (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id TEXT NOT NULL,        
    name TEXT NOT NULL,
    gender TEXT CHECK (gender IN ('M', 'F', 'Other')),
    class_name TEXT NOT NULL DEFAULT 'BASIC 9',
    hub_id TEXT NOT NULL,          
    is_jhs_level BOOLEAN DEFAULT TRUE, 
    enrollment_status TEXT DEFAULT 'ACTIVE',
    unique_code TEXT,
    bece_results JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CRITICAL: Ensure student_id is unique for login mapping
CREATE UNIQUE INDEX IF NOT EXISTS idx_uba_pupils_student_id ON public.uba_pupils(student_id);

-- 6. PERSISTENCE HUB: Global AppState Sharding
CREATE TABLE IF NOT EXISTS public.uba_persistence (
    id TEXT PRIMARY KEY,           
    hub_id TEXT NOT NULL,                
    payload JSONB NOT NULL,        
    version_tag TEXT DEFAULT 'v9.9.9',
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TRANSACTION LEDGER: Merit & Monetary Asset Tracking
CREATE TABLE IF NOT EXISTS public.uba_transaction_ledger (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    identity_email TEXT NOT NULL,
    hub_id TEXT NOT NULL,
    event_category TEXT NOT NULL, -- e.g., 'DATA_UPLOAD', 'PAYOUT_CLAIM'
    type TEXT NOT NULL,           -- 'CREDIT', 'DEBIT'
    asset_type TEXT NOT NULL,     -- 'MERIT_TOKEN', 'MONETARY_GHS'
    amount DOUBLE PRECISION NOT NULL,
    description TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- MIGRATION: Resolve 'event_category' constraint and 'status' column issues
DO $$
BEGIN
    -- Ensure 'status' column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='uba_transaction_ledger' AND column_name='status') THEN
        ALTER TABLE public.uba_transaction_ledger ADD COLUMN status TEXT DEFAULT 'COMPLETED';
    END IF;

    -- Drop existing category constraint to allow 'PAYOUT_CLAIM'
    ALTER TABLE public.uba_transaction_ledger DROP CONSTRAINT IF EXISTS uba_transaction_ledger_event_category_check;
    
    -- Re-apply expanded constraint
    ALTER TABLE public.uba_transaction_ledger 
    ADD CONSTRAINT uba_transaction_ledger_event_category_check 
    CHECK (event_category IN ('DATA_UPLOAD', 'PAYOUT_CLAIM', 'SYSTEM_CORRECTION', 'REWARD_CREDIT', 'FEE_PAYMENT'));
END $$;

-- 8. INSTRUCTIONAL SHARDS: Broadcast Practice & Curriculum Data
CREATE TABLE IF NOT EXISTS public.uba_instructional_shards (
    id TEXT PRIMARY KEY,           -- Deterministic ID (e.g., practice_shards_[hub]_[sub])
    hub_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. PRACTICE RESULTS: Outcome Registry for Hub Sessions
CREATE TABLE IF NOT EXISTS public.uba_practice_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    hub_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    student_name TEXT,
    subject TEXT NOT NULL,
    assignment_id TEXT NOT NULL, -- Shard ID
    score INTEGER DEFAULT 0,
    total_items INTEGER DEFAULT 0,
    answer_matrix JSONB DEFAULT '{}'::jsonb,
    time_taken INTEGER DEFAULT 0,
    completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. ACTIVITY LOGS: System Audit Trail
CREATE TABLE IF NOT EXISTS public.uba_activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    hub_id TEXT NOT NULL,
    actor_email TEXT,
    action TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. STAFF APPLICATIONS: Granular Recruitment Shards
CREATE TABLE IF NOT EXISTS public.uba_staff_applications (
    id TEXT PRIMARY KEY,           -- Deterministic ID (e.g., staff_app_[email]_[role])
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    hub_id TEXT NOT NULL,          -- Source Institutional Node
    role TEXT NOT NULL,            -- DEVELOPER, INVIGILATOR, EXAMINER
    status TEXT DEFAULT 'PENDING', -- PENDING, APPROVED, CONFIRMED, REJECTED, PAID
    expected_payment DOUBLE PRECISION DEFAULT 0,
    venue TEXT,
    auditor_token TEXT,
    auditor_feedback TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 12. CLAIMS REGISTRY: Itemized Withdrawal Shards
CREATE TABLE IF NOT EXISTS public.uba_claims (
    id TEXT PRIMARY KEY,           -- Deterministic ID (e.g., claim_withdrawal_[email])
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    hub_id TEXT NOT NULL,
    momo_number TEXT,
    momo_network TEXT,
    amount_questions DOUBLE PRECISION DEFAULT 0,
    amount_invigilation DOUBLE PRECISION DEFAULT 0,
    amount_marking DOUBLE PRECISION DEFAULT 0,
    total_amount DOUBLE PRECISION DEFAULT 0,
    status TEXT DEFAULT 'PENDING_CLAIM_AUDIT', -- PENDING_CLAIM_AUDIT, AUTHORIZED_FOR_SETTLEMENT, DISBURSED, REJECTED
    auditor_token TEXT,
    auditor_feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. SCHOOL FORWARDING: Institutional Handshake Registry
CREATE TABLE IF NOT EXISTS public.uba_school_forwarding (
    school_id TEXT PRIMARY KEY,    -- Institutional Node ID
    school_name TEXT NOT NULL,
    roster_census INTEGER DEFAULT 0,
    bulk_payment_amount DOUBLE PRECISION DEFAULT 0,
    transaction_id TEXT,
    approval_status TEXT DEFAULT 'PENDING', -- PENDING, APPROVED, SERIALIZED
    feedback TEXT,
    submission_timestamp TIMESTAMPTZ DEFAULT NOW(),
    payload JSONB                  -- Full metadata shard for recovery
);

-- 14. BOOTSTRAP: HQ Master Identity
INSERT INTO public.uba_identities (email, full_name, node_id, hub_id, role, unique_code)
VALUES ('hq@unitedbaylor.edu.gh', 'HQ CONTROLLER', 'HQ-MASTER-NODE', 'UBA-HQ-HUB', 'super_admin', 'UBA-HQ-MASTER-2025')
ON CONFLICT (node_id) DO UPDATE SET unique_code = 'UBA-HQ-MASTER-2025';

-- ==========================================================
-- SECURITY: Disable RLS for Global Hub Functionality
-- ==========================================================
ALTER TABLE public.uba_identities DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.uba_facilitators DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.uba_questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.uba_mock_scores DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.uba_pupils DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.uba_persistence DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.uba_activity_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.uba_transaction_ledger DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.uba_instructional_shards DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.uba_practice_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.uba_staff_applications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.uba_claims DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.uba_school_forwarding DISABLE ROW LEVEL SECURITY;
