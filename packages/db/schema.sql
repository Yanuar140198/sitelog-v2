--
-- PostgreSQL database dump
--

\restrict d61qgpjfSXpbHDbL2uofDMRxnGyqpAbLTNei0hiUs5mG4sfv7lmm0b6tIut6RrT

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: crew_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.crew_role AS ENUM (
    'mandor',
    'tukang',
    'pekerja',
    'operator',
    'helper',
    'driver',
    'surveyor',
    'security',
    'admin',
    'other'
);


--
-- Name: crew_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.crew_status AS ENUM (
    'active',
    'on_leave',
    'terminated'
);


--
-- Name: fleet_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.fleet_role AS ENUM (
    'primary',
    'backup',
    'standby',
    'spare'
);


--
-- Name: hse_severity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.hse_severity AS ENUM (
    'near_miss',
    'first_aid',
    'medical',
    'lost_time',
    'fatality',
    'property_damage',
    'environmental'
);


--
-- Name: hse_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.hse_status AS ENUM (
    'open',
    'investigating',
    'corrective_action',
    'closed'
);


--
-- Name: invoice_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invoice_status AS ENUM (
    'draft',
    'submitted',
    'verified',
    'approved',
    'paid',
    'rejected'
);


--
-- Name: maintenance_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.maintenance_kind AS ENUM (
    'scheduled',
    'breakdown',
    'inspection',
    'oil_change',
    'tire',
    'overhaul'
);


--
-- Name: maintenance_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.maintenance_status AS ENUM (
    'planned',
    'in_progress',
    'completed',
    'overdue',
    'cancelled'
);


--
-- Name: notification_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_kind AS ENUM (
    'invite',
    'invite_accepted',
    'project_created',
    'boq_changed',
    'entry_submitted',
    'fleet_assigned',
    'billing',
    'mention',
    'system'
);


--
-- Name: project_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.project_status AS ENUM (
    'planning',
    'active',
    'on_hold',
    'completed',
    'archived'
);


--
-- Name: qc_result; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.qc_result AS ENUM (
    'pass',
    'fail',
    'pending',
    'retest_required'
);


--
-- Name: resource_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.resource_category AS ENUM (
    'tenaga',
    'bahan',
    'peralatan'
);


--
-- Name: resource_master_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.resource_master_category AS ENUM (
    'tenaga',
    'bahan',
    'peralatan'
);


--
-- Name: shift; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.shift AS ENUM (
    'day',
    'night',
    'all'
);


--
-- Name: subscription_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_status AS ENUM (
    'trialing',
    'active',
    'past_due',
    'canceled',
    'incomplete',
    'paused'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'owner',
    'admin',
    'estimator',
    'scheduler',
    'supervisor',
    'viewer'
);


--
-- Name: vo_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.vo_status AS ENUM (
    'draft',
    'submitted',
    'under_review',
    'approved',
    'rejected',
    'implemented',
    'invoiced'
);


--
-- Name: vo_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.vo_type AS ENUM (
    'addition',
    'deletion',
    'substitution',
    'time_extension',
    'design_change'
);


--
-- Name: weather; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.weather AS ENUM (
    'clear',
    'cloudy',
    'rain_light',
    'rain_heavy',
    'storm'
);


--
-- Name: weather_condition; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.weather_condition AS ENUM (
    'cerah',
    'berawan',
    'gerimis',
    'hujan_ringan',
    'hujan_sedang',
    'hujan_lebat',
    'badai',
    'kabut'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account (
    id text NOT NULL,
    account_id text NOT NULL,
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    access_token text,
    refresh_token text,
    id_token text,
    access_token_expires_at timestamp without time zone,
    refresh_token_expires_at timestamp without time zone,
    scope text,
    password text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: ahsp_input; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ahsp_input (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ahsp_item_id uuid NOT NULL,
    ordinal integer NOT NULL,
    kode character varying(64) NOT NULL,
    variable character varying(64),
    uraian text NOT NULL,
    nilai numeric(18,6),
    satuan character varying(32),
    sumber text
);


--
-- Name: ahsp_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ahsp_item (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    kode character varying(32) NOT NULL,
    label character varying(64),
    source_kode character varying(64),
    item_no character varying(32),
    section character varying(128),
    jenis character varying(255) NOT NULL,
    deskripsi text,
    satuan character varying(16) NOT NULL,
    ohp_pct numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    metadata text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    archived_at timestamp without time zone,
    category character varying(64)
);


--
-- Name: ahsp_koefisien; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ahsp_koefisien (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ahsp_item_id uuid NOT NULL,
    ordinal integer NOT NULL,
    kode character varying(64) NOT NULL,
    variable character varying(64),
    uraian text,
    nilai numeric(18,8),
    satuan character varying(32),
    formula text
);


--
-- Name: ahsp_pin; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ahsp_pin (
    user_id uuid NOT NULL,
    ahsp_item_id uuid NOT NULL,
    pinned_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: ahsp_resource; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ahsp_resource (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ahsp_item_id uuid NOT NULL,
    category public.resource_category NOT NULL,
    ordinal integer NOT NULL,
    resource_code character varying(32) NOT NULL,
    uraian text NOT NULL,
    koefisien numeric(18,8) NOT NULL,
    satuan character varying(32),
    hsd numeric(18,2) NOT NULL,
    resource_master_id uuid
);


--
-- Name: ahsp_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ahsp_version (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ahsp_item_id uuid NOT NULL,
    version_number integer NOT NULL,
    snapshot jsonb NOT NULL,
    changed_by_id uuid,
    change_summary character varying(200),
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: announcement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcement (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    severity text DEFAULT 'info'::text NOT NULL,
    starts_at timestamp without time zone DEFAULT now() NOT NULL,
    ends_at timestamp without time zone,
    dismissible boolean DEFAULT true NOT NULL,
    created_by_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT announcement_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text])))
);


--
-- Name: api_key; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_key (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(128) NOT NULL,
    prefix character varying(16) NOT NULL,
    hashed_key text NOT NULL,
    scope character varying(32) DEFAULT 'read'::character varying NOT NULL,
    created_by_id uuid,
    last_used_at timestamp without time zone,
    expires_at timestamp without time zone,
    revoked_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    actor_id uuid,
    action character varying(64) NOT NULL,
    resource character varying(64) NOT NULL,
    resource_id character varying(64),
    diff text,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: boq_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.boq_item (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    ahsp_item_id uuid NOT NULL,
    ordinal integer DEFAULT 0 NOT NULL,
    quantity numeric(18,4) DEFAULT '0'::numeric NOT NULL,
    unit_rate_override numeric(18,2),
    note text,
    created_by_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    planned_start date,
    planned_finish date,
    actual_start date,
    actual_finish date,
    baseline_start date,
    baseline_finish date,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: boq_resource_override; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.boq_resource_override (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    ahsp_item_id uuid NOT NULL,
    resource_code character varying(32) NOT NULL,
    koefisien numeric(18,8),
    hsd numeric(18,2),
    note text,
    updated_by_id uuid,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: boq_template; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.boq_template (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name character varying(128) NOT NULL,
    description text,
    category character varying(64),
    items text NOT NULL,
    published_at timestamp without time zone,
    created_by_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: boq_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.boq_version (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    version_number integer NOT NULL,
    label character varying(128),
    snapshot text NOT NULL,
    notes text,
    created_by_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: crew_assignment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crew_assignment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    crew_member_id uuid NOT NULL,
    project_id uuid NOT NULL,
    from_date date NOT NULL,
    to_date date,
    role_override public.crew_role,
    daily_rate_override numeric(14,2),
    notes text,
    assigned_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: crew_member; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crew_member (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    full_name character varying(160) NOT NULL,
    nickname character varying(60),
    phone character varying(32),
    national_id character varying(32),
    role public.crew_role DEFAULT 'pekerja'::public.crew_role NOT NULL,
    daily_rate numeric(14,2) DEFAULT 0 NOT NULL,
    hourly_rate numeric(14,2) DEFAULT 0 NOT NULL,
    status public.crew_status DEFAULT 'active'::public.crew_status NOT NULL,
    hire_date date,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: daily_entry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_entry (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    entry_date date NOT NULL,
    shift public.shift DEFAULT 'day'::public.shift NOT NULL,
    weather public.weather,
    effective_hours numeric(5,2),
    workforce integer,
    notes text,
    submitted_at_lat numeric(10,7),
    submitted_at_lng numeric(10,7),
    app_version character varying(32),
    submitted_by_id uuid,
    submitted_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);


--
-- Name: entry_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entry_activity (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    daily_entry_id uuid NOT NULL,
    ahsp_item_id uuid,
    description text NOT NULL,
    quantity numeric(14,4) NOT NULL,
    satuan character varying(16),
    station character varying(64)
);


--
-- Name: entry_equipment_util; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entry_equipment_util (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    daily_entry_id uuid NOT NULL,
    unit_id uuid,
    hm_start numeric(10,1),
    hm_end numeric(10,1),
    hm_work numeric(6,1),
    hm_idle numeric(6,1),
    hm_breakdown numeric(6,1),
    fuel_liters numeric(8,2),
    odometer_km numeric(10,1),
    trips integer,
    status character varying(32),
    note text
);


--
-- Name: entry_photo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entry_photo (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    daily_entry_id uuid NOT NULL,
    storage_key text NOT NULL,
    url text,
    caption text,
    taken_at timestamp without time zone,
    lat numeric(10,7),
    lng numeric(10,7),
    width integer,
    height integer,
    size_bytes integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    ai_caption text,
    ai_tags text,
    ai_progress_pct numeric(5,1),
    ai_analyzed_at timestamp without time zone
);


--
-- Name: feature_flag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feature_flag (
    key text NOT NULL,
    description text,
    enabled_globally boolean DEFAULT false NOT NULL,
    rollout_pct integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT feature_flag_rollout_pct_check CHECK (((rollout_pct >= 0) AND (rollout_pct <= 100)))
);


--
-- Name: feature_flag_override; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feature_flag_override (
    organization_id uuid NOT NULL,
    flag_key text NOT NULL,
    enabled boolean NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: hse_incident; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hse_incident (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    incident_date date NOT NULL,
    incident_time time without time zone,
    severity public.hse_severity NOT NULL,
    incident_type character varying(80) NOT NULL,
    location text NOT NULL,
    description text NOT NULL,
    involved_persons text,
    immediate_action text,
    root_cause text,
    corrective_action text,
    status public.hse_status DEFAULT 'open'::public.hse_status NOT NULL,
    reported_by_id uuid,
    closed_at timestamp without time zone,
    closed_by_id uuid,
    photo_keys jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: idempotency_key; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.idempotency_key (
    organization_id uuid NOT NULL,
    key text NOT NULL,
    method text NOT NULL,
    path text NOT NULL,
    request_hash text NOT NULL,
    response_status integer NOT NULL,
    response_body text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: invitation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invitation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    email character varying(255) NOT NULL,
    role public.user_role DEFAULT 'viewer'::public.user_role NOT NULL,
    token text NOT NULL,
    invited_by_id uuid,
    expires_at timestamp without time zone NOT NULL,
    accepted_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: login_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.login_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    user_id uuid,
    success text DEFAULT 'false'::text NOT NULL,
    reason character varying(128),
    ip_address character varying(45),
    user_agent text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: material_delivery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_delivery (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    stock_id uuid,
    delivery_date date NOT NULL,
    do_number character varying(64),
    material_code character varying(64) NOT NULL,
    qty numeric(18,4) NOT NULL,
    unit_price numeric(18,2),
    supplier character varying(160),
    vehicle_plate character varying(32),
    driver_name character varying(120),
    signed_by character varying(120),
    notes text,
    recorded_by_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: material_stock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_stock (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    resource_master_id uuid,
    material_code character varying(64) NOT NULL,
    material_name text NOT NULL,
    satuan character varying(16) NOT NULL,
    qty_ordered numeric(18,4) DEFAULT 0 NOT NULL,
    qty_received numeric(18,4) DEFAULT 0 NOT NULL,
    qty_used numeric(18,4) DEFAULT 0 NOT NULL,
    supplier character varying(160),
    unit_price numeric(18,2) DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: membership; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.membership (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    role public.user_role DEFAULT 'viewer'::public.user_role NOT NULL,
    invited_at timestamp without time zone DEFAULT now() NOT NULL,
    accepted_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid,
    kind public.notification_kind NOT NULL,
    title character varying(255) NOT NULL,
    body text,
    href text,
    read_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: notification_channel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_channel (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    channel_type character varying(32) NOT NULL,
    name character varying(120) NOT NULL,
    webhook_url text,
    email_address character varying(255),
    events jsonb DEFAULT '[]'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: org_secret; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_secret (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    provider character varying(32) NOT NULL,
    ciphertext text NOT NULL,
    iv character varying(32) NOT NULL,
    auth_tag character varying(32) NOT NULL,
    hint character varying(12),
    created_by_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: organization; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug character varying(64) NOT NULL,
    name character varying(255) NOT NULL,
    logo text,
    currency character varying(3) DEFAULT 'IDR'::character varying NOT NULL,
    locale character varying(8) DEFAULT 'id-ID'::character varying NOT NULL,
    timezone character varying(64) DEFAULT 'Asia/Jakarta'::character varying NOT NULL,
    plan character varying(32) DEFAULT 'trial'::character varying NOT NULL,
    trial_ends_at timestamp without time zone,
    deleted_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    brand_color character varying(16) DEFAULT '#FF5500'::character varying NOT NULL,
    brand_secondary character varying(16) DEFAULT '#0A0A0A'::character varying NOT NULL,
    custom_domain character varying(128),
    custom_domain_verify_token character varying(64),
    custom_domain_verified_at timestamp without time zone
);


--
-- Name: project; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    code character varying(64) NOT NULL,
    name character varying(255) NOT NULL,
    client character varying(255),
    location text,
    status public.project_status DEFAULT 'planning'::public.project_status NOT NULL,
    start_date date,
    finish_date date,
    duration_days numeric(8,1),
    fleet_design text,
    plan_land_clearing numeric(14,2) DEFAULT '0'::numeric NOT NULL,
    plan_cut_soil numeric(14,2) DEFAULT '0'::numeric NOT NULL,
    plan_cut_rock numeric(14,2) DEFAULT '0'::numeric NOT NULL,
    plan_fill numeric(14,2) DEFAULT '0'::numeric NOT NULL,
    target_cut_daily numeric(14,2) DEFAULT '0'::numeric NOT NULL,
    target_fill_daily numeric(14,2) DEFAULT '0'::numeric NOT NULL,
    cached_boq_subtotal numeric(18,2) DEFAULT '0'::numeric NOT NULL,
    cached_grand_total numeric(18,2) DEFAULT '0'::numeric NOT NULL,
    cached_spi numeric(6,4),
    cached_cpi numeric(6,4),
    cached_earned_value numeric(18,2) DEFAULT '0'::numeric NOT NULL,
    cached_progress_pct numeric(6,2) DEFAULT '0'::numeric NOT NULL,
    markup_pct numeric(6,2) DEFAULT '0'::numeric NOT NULL,
    contingency_pct numeric(6,2) DEFAULT '0'::numeric NOT NULL,
    ppn_pct numeric(6,2) DEFAULT '11'::numeric NOT NULL,
    deleted_at timestamp without time zone,
    created_by_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    site_lat numeric(10,7),
    site_lng numeric(10,7),
    geofence_radius_m numeric(8,0),
    currency character varying(3),
    fx_rate_to_org numeric(14,6),
    data_date date,
    baseline_set_at timestamp without time zone
);


--
-- Name: project_assignment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_assignment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role_on_project character varying(64),
    assigned_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: project_fleet_assignment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_fleet_assignment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    role public.fleet_role DEFAULT 'primary'::public.fleet_role NOT NULL,
    note text,
    assigned_by_id uuid,
    assigned_at timestamp without time zone DEFAULT now() NOT NULL,
    unassigned_at timestamp without time zone
);


--
-- Name: public_share; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.public_share (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    token text NOT NULL,
    label character varying(128),
    include_kpi text DEFAULT 'true'::text NOT NULL,
    include_entries text DEFAULT 'false'::text NOT NULL,
    expires_at timestamp without time zone,
    created_by_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    revoked_at timestamp without time zone
);


--
-- Name: push_subscription; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscription (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    kind character varying(16) NOT NULL,
    token text NOT NULL,
    p256dh text,
    auth_key text,
    device_label character varying(128),
    last_seen_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: qc_test; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qc_test (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    test_date date NOT NULL,
    test_type character varying(80) NOT NULL,
    station character varying(64),
    location_description text,
    sample_code character varying(80),
    spec_target text,
    spec_min numeric(14,4),
    spec_max numeric(14,4),
    actual_value numeric(14,4),
    actual_text text,
    unit character varying(16),
    result public.qc_result DEFAULT 'pending'::public.qc_result NOT NULL,
    notes text,
    tested_by character varying(120),
    inspector_id uuid,
    retest_of_id uuid,
    photo_keys jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: resource_master; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resource_master (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    kode character varying(32) NOT NULL,
    nama text NOT NULL,
    category public.resource_master_category NOT NULL,
    satuan character varying(16) NOT NULL,
    default_hsd numeric(18,2) DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: resource_master_price; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resource_master_price (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resource_id uuid NOT NULL,
    region character varying(64) NOT NULL,
    hsd numeric(18,2) NOT NULL,
    effective_from date DEFAULT CURRENT_DATE NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: schedule_baseline; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule_baseline (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    name character varying(120) NOT NULL,
    set_by uuid,
    set_at timestamp without time zone DEFAULT now() NOT NULL,
    notes text,
    snapshot jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: subcontract; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subcontract (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    subcontractor_id uuid NOT NULL,
    contract_number character varying(80),
    scope_description text NOT NULL,
    contract_value numeric(18,2) DEFAULT 0 NOT NULL,
    start_date date,
    end_date date,
    retention_pct numeric(5,2) DEFAULT 5 NOT NULL,
    notes text,
    signed_at date,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: subcontractor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subcontractor (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(200) NOT NULL,
    npwp character varying(32),
    contact_person character varying(120),
    phone character varying(32),
    email character varying(160),
    address text,
    bank_name character varying(80),
    bank_account character varying(40),
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: subcontractor_invoice; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subcontractor_invoice (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subcontract_id uuid NOT NULL,
    invoice_number character varying(80) NOT NULL,
    invoice_date date NOT NULL,
    progress_pct numeric(5,2) DEFAULT 0 NOT NULL,
    gross_amount numeric(18,2) NOT NULL,
    retention_amount numeric(18,2) DEFAULT 0 NOT NULL,
    ppn_amount numeric(18,2) DEFAULT 0 NOT NULL,
    net_amount numeric(18,2) NOT NULL,
    status public.invoice_status DEFAULT 'draft'::public.invoice_status NOT NULL,
    paid_date date,
    paid_amount numeric(18,2),
    notes text,
    submitted_by_id uuid,
    approved_by_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: subscription; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    stripe_customer_id character varying(128),
    stripe_subscription_id character varying(128),
    stripe_price_id character varying(128),
    plan character varying(32) DEFAULT 'trial'::character varying NOT NULL,
    status public.subscription_status DEFAULT 'trialing'::public.subscription_status NOT NULL,
    seats integer DEFAULT 5 NOT NULL,
    current_period_start timestamp without time zone,
    current_period_end timestamp without time zone,
    cancel_at_period_end text DEFAULT 'false'::text NOT NULL,
    trial_end timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: unit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    nomor character varying(64) NOT NULL,
    fleet character varying(64),
    jenis_alat character varying(64),
    brand character varying(64),
    model character varying(64),
    capacity character varying(64),
    vendor character varying(128),
    rate_per_hour numeric(14,2),
    external_tracking_id character varying(128),
    tracking_provider character varying(32),
    active text DEFAULT 'true'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: unit_maintenance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_maintenance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    unit_id uuid NOT NULL,
    kind public.maintenance_kind NOT NULL,
    status public.maintenance_status DEFAULT 'planned'::public.maintenance_status NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    due_at_hm numeric(10,1),
    due_at_date timestamp without time zone,
    interval_hm numeric(10,1),
    interval_days integer,
    performed_at timestamp without time zone,
    performed_at_hm numeric(10,1),
    cost numeric(14,2),
    vendor character varying(128),
    note text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: usage_record; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usage_record (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    metric character varying(64) NOT NULL,
    value numeric(18,2) NOT NULL,
    period_start timestamp without time zone NOT NULL,
    period_end timestamp without time zone NOT NULL,
    reported_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."user" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    email_verified boolean DEFAULT false NOT NULL,
    name character varying(255),
    image text,
    password_hash text,
    totp_secret text,
    two_factor_enabled boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    last_login_at timestamp without time zone
);


--
-- Name: user_preference; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_preference (
    user_id uuid NOT NULL,
    email_digest_weekly boolean DEFAULT true NOT NULL,
    email_mentions boolean DEFAULT true NOT NULL,
    email_billing boolean DEFAULT true NOT NULL,
    onboarding_completed_at timestamp without time zone,
    onboarding_steps text,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    event_opt_out text
);


--
-- Name: variation_order; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.variation_order (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    vo_number character varying(40) NOT NULL,
    title character varying(200) NOT NULL,
    vo_type public.vo_type NOT NULL,
    description text NOT NULL,
    justification text,
    cost_impact numeric(18,2) DEFAULT 0 NOT NULL,
    time_impact_days integer DEFAULT 0 NOT NULL,
    status public.vo_status DEFAULT 'draft'::public.vo_status NOT NULL,
    requested_by character varying(160),
    requested_date date,
    submitted_at timestamp without time zone,
    reviewed_at timestamp without time zone,
    approved_at timestamp without time zone,
    approved_by_id uuid,
    implemented_at date,
    rejection_reason text,
    reference_documents jsonb DEFAULT '[]'::jsonb,
    notes text,
    created_by_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: verification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification (
    id text NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: weather_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weather_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    log_date date NOT NULL,
    morning public.weather_condition,
    afternoon public.weather_condition,
    evening public.weather_condition,
    rainfall_mm numeric(6,1),
    temp_min_c numeric(4,1),
    temp_max_c numeric(4,1),
    wind_kmh numeric(5,1),
    work_disrupted_hours numeric(4,1) DEFAULT 0 NOT NULL,
    rain_delay_claimed boolean DEFAULT false NOT NULL,
    rain_delay_approved boolean DEFAULT false NOT NULL,
    notes text,
    recorded_by_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: webhook_delivery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_delivery (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    endpoint_id uuid NOT NULL,
    event character varying(64) NOT NULL,
    payload text NOT NULL,
    response_status integer,
    response_body text,
    attempts integer DEFAULT 0 NOT NULL,
    delivered_at timestamp without time zone,
    failed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: webhook_endpoint; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_endpoint (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    url text NOT NULL,
    events text NOT NULL,
    secret text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    description character varying(255),
    created_by_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    last_fired_at timestamp without time zone,
    last_status integer,
    last_error text
);


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
-- Name: ahsp_input ahsp_input_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ahsp_input
    ADD CONSTRAINT ahsp_input_pkey PRIMARY KEY (id);


--
-- Name: ahsp_item ahsp_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ahsp_item
    ADD CONSTRAINT ahsp_item_pkey PRIMARY KEY (id);


--
-- Name: ahsp_koefisien ahsp_koefisien_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ahsp_koefisien
    ADD CONSTRAINT ahsp_koefisien_pkey PRIMARY KEY (id);


--
-- Name: ahsp_pin ahsp_pin_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ahsp_pin
    ADD CONSTRAINT ahsp_pin_pkey PRIMARY KEY (user_id, ahsp_item_id);


--
-- Name: ahsp_resource ahsp_resource_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ahsp_resource
    ADD CONSTRAINT ahsp_resource_pkey PRIMARY KEY (id);


--
-- Name: ahsp_version ahsp_version_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ahsp_version
    ADD CONSTRAINT ahsp_version_pkey PRIMARY KEY (id);


--
-- Name: announcement announcement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement
    ADD CONSTRAINT announcement_pkey PRIMARY KEY (id);


--
-- Name: api_key api_key_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_key
    ADD CONSTRAINT api_key_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: boq_item boq_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boq_item
    ADD CONSTRAINT boq_item_pkey PRIMARY KEY (id);


--
-- Name: boq_resource_override boq_resource_override_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boq_resource_override
    ADD CONSTRAINT boq_resource_override_pkey PRIMARY KEY (id);


--
-- Name: boq_template boq_template_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boq_template
    ADD CONSTRAINT boq_template_pkey PRIMARY KEY (id);


--
-- Name: boq_version boq_version_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boq_version
    ADD CONSTRAINT boq_version_pkey PRIMARY KEY (id);


--
-- Name: crew_assignment crew_assignment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crew_assignment
    ADD CONSTRAINT crew_assignment_pkey PRIMARY KEY (id);


--
-- Name: crew_member crew_member_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crew_member
    ADD CONSTRAINT crew_member_pkey PRIMARY KEY (id);


--
-- Name: daily_entry daily_entry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_entry
    ADD CONSTRAINT daily_entry_pkey PRIMARY KEY (id);


--
-- Name: entry_activity entry_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entry_activity
    ADD CONSTRAINT entry_activity_pkey PRIMARY KEY (id);


--
-- Name: entry_equipment_util entry_equipment_util_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entry_equipment_util
    ADD CONSTRAINT entry_equipment_util_pkey PRIMARY KEY (id);


--
-- Name: entry_photo entry_photo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entry_photo
    ADD CONSTRAINT entry_photo_pkey PRIMARY KEY (id);


--
-- Name: feature_flag_override feature_flag_override_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flag_override
    ADD CONSTRAINT feature_flag_override_pkey PRIMARY KEY (organization_id, flag_key);


--
-- Name: feature_flag feature_flag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flag
    ADD CONSTRAINT feature_flag_pkey PRIMARY KEY (key);


--
-- Name: hse_incident hse_incident_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hse_incident
    ADD CONSTRAINT hse_incident_pkey PRIMARY KEY (id);


--
-- Name: idempotency_key idempotency_key_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idempotency_key
    ADD CONSTRAINT idempotency_key_pkey PRIMARY KEY (organization_id, key);


--
-- Name: invitation invitation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitation
    ADD CONSTRAINT invitation_pkey PRIMARY KEY (id);


--
-- Name: invitation invitation_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitation
    ADD CONSTRAINT invitation_token_unique UNIQUE (token);


--
-- Name: login_log login_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_log
    ADD CONSTRAINT login_log_pkey PRIMARY KEY (id);


--
-- Name: material_delivery material_delivery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_delivery
    ADD CONSTRAINT material_delivery_pkey PRIMARY KEY (id);


--
-- Name: material_stock material_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_stock
    ADD CONSTRAINT material_stock_pkey PRIMARY KEY (id);


--
-- Name: membership membership_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membership
    ADD CONSTRAINT membership_pkey PRIMARY KEY (id);


--
-- Name: notification_channel notification_channel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_channel
    ADD CONSTRAINT notification_channel_pkey PRIMARY KEY (id);


--
-- Name: notification notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_pkey PRIMARY KEY (id);


--
-- Name: org_secret org_secret_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_secret
    ADD CONSTRAINT org_secret_pkey PRIMARY KEY (id);


--
-- Name: organization organization_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization
    ADD CONSTRAINT organization_pkey PRIMARY KEY (id);


--
-- Name: organization organization_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization
    ADD CONSTRAINT organization_slug_unique UNIQUE (slug);


--
-- Name: project_assignment project_assignment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assignment
    ADD CONSTRAINT project_assignment_pkey PRIMARY KEY (id);


--
-- Name: project_fleet_assignment project_fleet_assignment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_fleet_assignment
    ADD CONSTRAINT project_fleet_assignment_pkey PRIMARY KEY (id);


--
-- Name: project project_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_pkey PRIMARY KEY (id);


--
-- Name: public_share public_share_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_share
    ADD CONSTRAINT public_share_pkey PRIMARY KEY (id);


--
-- Name: public_share public_share_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_share
    ADD CONSTRAINT public_share_token_unique UNIQUE (token);


--
-- Name: push_subscription push_subscription_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscription
    ADD CONSTRAINT push_subscription_pkey PRIMARY KEY (id);


--
-- Name: push_subscription push_subscription_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscription
    ADD CONSTRAINT push_subscription_token_unique UNIQUE (token);


--
-- Name: qc_test qc_test_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qc_test
    ADD CONSTRAINT qc_test_pkey PRIMARY KEY (id);


--
-- Name: resource_master resource_master_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resource_master
    ADD CONSTRAINT resource_master_pkey PRIMARY KEY (id);


--
-- Name: resource_master_price resource_master_price_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resource_master_price
    ADD CONSTRAINT resource_master_price_pkey PRIMARY KEY (id);


--
-- Name: schedule_baseline schedule_baseline_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_baseline
    ADD CONSTRAINT schedule_baseline_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (id);


--
-- Name: session session_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_token_unique UNIQUE (token);


--
-- Name: subcontract subcontract_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontract
    ADD CONSTRAINT subcontract_pkey PRIMARY KEY (id);


--
-- Name: subcontractor_invoice subcontractor_invoice_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontractor_invoice
    ADD CONSTRAINT subcontractor_invoice_pkey PRIMARY KEY (id);


--
-- Name: subcontractor subcontractor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontractor
    ADD CONSTRAINT subcontractor_pkey PRIMARY KEY (id);


--
-- Name: subscription subscription_organization_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription
    ADD CONSTRAINT subscription_organization_id_unique UNIQUE (organization_id);


--
-- Name: subscription subscription_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription
    ADD CONSTRAINT subscription_pkey PRIMARY KEY (id);


--
-- Name: unit_maintenance unit_maintenance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_maintenance
    ADD CONSTRAINT unit_maintenance_pkey PRIMARY KEY (id);


--
-- Name: unit unit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit
    ADD CONSTRAINT unit_pkey PRIMARY KEY (id);


--
-- Name: usage_record usage_record_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_record
    ADD CONSTRAINT usage_record_pkey PRIMARY KEY (id);


--
-- Name: user user_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_email_unique UNIQUE (email);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: user_preference user_preference_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preference
    ADD CONSTRAINT user_preference_pkey PRIMARY KEY (user_id);


--
-- Name: variation_order variation_order_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variation_order
    ADD CONSTRAINT variation_order_pkey PRIMARY KEY (id);


--
-- Name: verification verification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification
    ADD CONSTRAINT verification_pkey PRIMARY KEY (id);


--
-- Name: weather_log weather_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weather_log
    ADD CONSTRAINT weather_log_pkey PRIMARY KEY (id);


--
-- Name: webhook_delivery webhook_delivery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_delivery
    ADD CONSTRAINT webhook_delivery_pkey PRIMARY KEY (id);


--
-- Name: webhook_endpoint webhook_endpoint_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_endpoint
    ADD CONSTRAINT webhook_endpoint_pkey PRIMARY KEY (id);


--
-- Name: ahsp_input_item_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ahsp_input_item_idx ON public.ahsp_input USING btree (ahsp_item_id, ordinal);


--
-- Name: ahsp_item_archived_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ahsp_item_archived_idx ON public.ahsp_item USING btree (archived_at) WHERE (archived_at IS NOT NULL);


--
-- Name: ahsp_item_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ahsp_item_category_idx ON public.ahsp_item USING btree (category);


--
-- Name: ahsp_item_org_kode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ahsp_item_org_kode_idx ON public.ahsp_item USING btree (organization_id, kode);


--
-- Name: ahsp_item_section_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ahsp_item_section_idx ON public.ahsp_item USING btree (section);


--
-- Name: ahsp_koef_item_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ahsp_koef_item_idx ON public.ahsp_koefisien USING btree (ahsp_item_id, ordinal);


--
-- Name: ahsp_pin_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ahsp_pin_user_idx ON public.ahsp_pin USING btree (user_id);


--
-- Name: ahsp_resource_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ahsp_resource_code_idx ON public.ahsp_resource USING btree (resource_code);


--
-- Name: ahsp_resource_item_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ahsp_resource_item_idx ON public.ahsp_resource USING btree (ahsp_item_id, category, ordinal);


--
-- Name: ahsp_version_item_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ahsp_version_item_idx ON public.ahsp_version USING btree (ahsp_item_id, version_number DESC);


--
-- Name: announcement_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX announcement_active_idx ON public.announcement USING btree (starts_at, ends_at);


--
-- Name: api_key_hashed_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX api_key_hashed_idx ON public.api_key USING btree (hashed_key);


--
-- Name: api_key_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_key_org_idx ON public.api_key USING btree (organization_id);


--
-- Name: audit_org_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_org_created_idx ON public.audit_log USING btree (organization_id, created_at);


--
-- Name: audit_resource_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_resource_idx ON public.audit_log USING btree (resource, resource_id);


--
-- Name: boq_item_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX boq_item_project_idx ON public.boq_item USING btree (project_id);


--
-- Name: boq_item_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX boq_item_unique ON public.boq_item USING btree (project_id, ahsp_item_id);


--
-- Name: boq_resource_override_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX boq_resource_override_project_idx ON public.boq_resource_override USING btree (project_id);


--
-- Name: boq_resource_override_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX boq_resource_override_unique ON public.boq_resource_override USING btree (project_id, ahsp_item_id, resource_code);


--
-- Name: boq_template_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX boq_template_category_idx ON public.boq_template USING btree (category);


--
-- Name: boq_template_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX boq_template_org_idx ON public.boq_template USING btree (organization_id);


--
-- Name: boq_version_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX boq_version_unique ON public.boq_version USING btree (project_id, version_number);


--
-- Name: crew_assign_crew_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX crew_assign_crew_idx ON public.crew_assignment USING btree (crew_member_id);


--
-- Name: crew_assign_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX crew_assign_project_idx ON public.crew_assignment USING btree (project_id, from_date);


--
-- Name: crew_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX crew_org_idx ON public.crew_member USING btree (organization_id, status);


--
-- Name: daily_entry_project_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX daily_entry_project_date_idx ON public.daily_entry USING btree (project_id, entry_date);


--
-- Name: daily_entry_submitter_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX daily_entry_submitter_idx ON public.daily_entry USING btree (submitted_by_id, submitted_at);


--
-- Name: entry_activity_ahsp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX entry_activity_ahsp_idx ON public.entry_activity USING btree (ahsp_item_id);


--
-- Name: entry_activity_entry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX entry_activity_entry_idx ON public.entry_activity USING btree (daily_entry_id);


--
-- Name: entry_eq_util_entry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX entry_eq_util_entry_idx ON public.entry_equipment_util USING btree (daily_entry_id);


--
-- Name: entry_eq_util_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX entry_eq_util_unit_idx ON public.entry_equipment_util USING btree (unit_id);


--
-- Name: entry_photo_entry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX entry_photo_entry_idx ON public.entry_photo USING btree (daily_entry_id);


--
-- Name: feature_flag_override_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feature_flag_override_org_idx ON public.feature_flag_override USING btree (organization_id);


--
-- Name: hse_project_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hse_project_date_idx ON public.hse_incident USING btree (project_id, incident_date DESC);


--
-- Name: hse_severity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hse_severity_idx ON public.hse_incident USING btree (severity, status);


--
-- Name: idempotency_key_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idempotency_key_created_idx ON public.idempotency_key USING btree (created_at);


--
-- Name: invitation_org_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invitation_org_email_idx ON public.invitation USING btree (organization_id, email);


--
-- Name: login_log_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX login_log_email_idx ON public.login_log USING btree (email, created_at);


--
-- Name: login_log_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX login_log_user_idx ON public.login_log USING btree (user_id, created_at);


--
-- Name: maint_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX maint_due_idx ON public.unit_maintenance USING btree (due_at_date);


--
-- Name: maint_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX maint_unit_idx ON public.unit_maintenance USING btree (unit_id, status);


--
-- Name: material_delivery_project_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX material_delivery_project_date ON public.material_delivery USING btree (project_id, delivery_date DESC);


--
-- Name: material_stock_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX material_stock_project ON public.material_stock USING btree (project_id);


--
-- Name: material_stock_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX material_stock_unique ON public.material_stock USING btree (project_id, material_code);


--
-- Name: membership_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX membership_org_idx ON public.membership USING btree (organization_id);


--
-- Name: membership_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX membership_unique ON public.membership USING btree (user_id, organization_id);


--
-- Name: notif_channel_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notif_channel_org_idx ON public.notification_channel USING btree (organization_id);


--
-- Name: notification_user_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notification_user_created_idx ON public.notification USING btree (user_id, created_at);


--
-- Name: notification_user_read_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notification_user_read_idx ON public.notification USING btree (user_id, read_at);


--
-- Name: org_secret_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX org_secret_provider_idx ON public.org_secret USING btree (organization_id, provider);


--
-- Name: organization_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX organization_slug_idx ON public.organization USING btree (slug);


--
-- Name: proj_assign_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX proj_assign_idx ON public.project_assignment USING btree (project_id, user_id);


--
-- Name: proj_fleet_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX proj_fleet_project_idx ON public.project_fleet_assignment USING btree (project_id);


--
-- Name: proj_fleet_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX proj_fleet_unique ON public.project_fleet_assignment USING btree (project_id, unit_id);


--
-- Name: project_org_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_org_code_idx ON public.project USING btree (organization_id, code);


--
-- Name: project_org_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_org_status_idx ON public.project USING btree (organization_id, status);


--
-- Name: public_share_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX public_share_project_idx ON public.public_share USING btree (project_id);


--
-- Name: push_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_user_idx ON public.push_subscription USING btree (user_id);


--
-- Name: qc_project_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX qc_project_date_idx ON public.qc_test USING btree (project_id, test_date DESC);


--
-- Name: qc_result_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX qc_result_idx ON public.qc_test USING btree (project_id, result);


--
-- Name: qc_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX qc_type_idx ON public.qc_test USING btree (test_type);


--
-- Name: resource_master_org_kode; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX resource_master_org_kode ON public.resource_master USING btree (COALESCE((organization_id)::text, ''::text), kode);


--
-- Name: resource_master_price_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX resource_master_price_resource ON public.resource_master_price USING btree (resource_id, region, effective_from DESC);


--
-- Name: schedule_baseline_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedule_baseline_project_idx ON public.schedule_baseline USING btree (project_id, set_at DESC);


--
-- Name: session_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX session_user_idx ON public.session USING btree (user_id);


--
-- Name: subcon_inv_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subcon_inv_status ON public.subcontractor_invoice USING btree (status);


--
-- Name: subcon_inv_subcontract; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subcon_inv_subcontract ON public.subcontractor_invoice USING btree (subcontract_id, invoice_date DESC);


--
-- Name: subcon_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subcon_org_idx ON public.subcontractor USING btree (organization_id);


--
-- Name: subcontract_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subcontract_project_idx ON public.subcontract USING btree (project_id);


--
-- Name: subscription_stripe_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subscription_stripe_idx ON public.subscription USING btree (stripe_subscription_id);


--
-- Name: unit_org_jenis_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX unit_org_jenis_idx ON public.unit USING btree (organization_id, jenis_alat);


--
-- Name: unit_org_nomor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unit_org_nomor_idx ON public.unit USING btree (organization_id, nomor);


--
-- Name: usage_org_metric_period_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX usage_org_metric_period_idx ON public.usage_record USING btree (organization_id, metric, period_start);


--
-- Name: vo_project_number_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX vo_project_number_idx ON public.variation_order USING btree (project_id, vo_number);


--
-- Name: vo_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vo_status_idx ON public.variation_order USING btree (status);


--
-- Name: weather_project_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX weather_project_date_idx ON public.weather_log USING btree (project_id, log_date DESC);


--
-- Name: weather_project_date_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX weather_project_date_unique ON public.weather_log USING btree (project_id, log_date);


--
-- Name: webhook_delivery_endpoint_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX webhook_delivery_endpoint_idx ON public.webhook_delivery USING btree (endpoint_id, created_at);


--
-- Name: webhook_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX webhook_org_idx ON public.webhook_endpoint USING btree (organization_id);


--
-- Name: account account_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: ahsp_input ahsp_input_ahsp_item_id_ahsp_item_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ahsp_input
    ADD CONSTRAINT ahsp_input_ahsp_item_id_ahsp_item_id_fk FOREIGN KEY (ahsp_item_id) REFERENCES public.ahsp_item(id) ON DELETE CASCADE;


--
-- Name: ahsp_item ahsp_item_organization_id_organization_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ahsp_item
    ADD CONSTRAINT ahsp_item_organization_id_organization_id_fk FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: ahsp_koefisien ahsp_koefisien_ahsp_item_id_ahsp_item_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ahsp_koefisien
    ADD CONSTRAINT ahsp_koefisien_ahsp_item_id_ahsp_item_id_fk FOREIGN KEY (ahsp_item_id) REFERENCES public.ahsp_item(id) ON DELETE CASCADE;


--
-- Name: ahsp_pin ahsp_pin_ahsp_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ahsp_pin
    ADD CONSTRAINT ahsp_pin_ahsp_item_id_fkey FOREIGN KEY (ahsp_item_id) REFERENCES public.ahsp_item(id) ON DELETE CASCADE;


--
-- Name: ahsp_pin ahsp_pin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ahsp_pin
    ADD CONSTRAINT ahsp_pin_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: ahsp_resource ahsp_resource_ahsp_item_id_ahsp_item_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ahsp_resource
    ADD CONSTRAINT ahsp_resource_ahsp_item_id_ahsp_item_id_fk FOREIGN KEY (ahsp_item_id) REFERENCES public.ahsp_item(id) ON DELETE CASCADE;


--
-- Name: ahsp_resource ahsp_resource_resource_master_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ahsp_resource
    ADD CONSTRAINT ahsp_resource_resource_master_id_fkey FOREIGN KEY (resource_master_id) REFERENCES public.resource_master(id) ON DELETE SET NULL;


--
-- Name: ahsp_version ahsp_version_ahsp_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ahsp_version
    ADD CONSTRAINT ahsp_version_ahsp_item_id_fkey FOREIGN KEY (ahsp_item_id) REFERENCES public.ahsp_item(id) ON DELETE CASCADE;


--
-- Name: ahsp_version ahsp_version_changed_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ahsp_version
    ADD CONSTRAINT ahsp_version_changed_by_id_fkey FOREIGN KEY (changed_by_id) REFERENCES public."user"(id);


--
-- Name: announcement announcement_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement
    ADD CONSTRAINT announcement_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public."user"(id) ON DELETE SET NULL;


--
-- Name: api_key api_key_created_by_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_key
    ADD CONSTRAINT api_key_created_by_id_user_id_fk FOREIGN KEY (created_by_id) REFERENCES public."user"(id);


--
-- Name: api_key api_key_organization_id_organization_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_key
    ADD CONSTRAINT api_key_organization_id_organization_id_fk FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: audit_log audit_log_actor_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_actor_id_user_id_fk FOREIGN KEY (actor_id) REFERENCES public."user"(id);


--
-- Name: audit_log audit_log_organization_id_organization_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_organization_id_organization_id_fk FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: boq_item boq_item_ahsp_item_id_ahsp_item_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boq_item
    ADD CONSTRAINT boq_item_ahsp_item_id_ahsp_item_id_fk FOREIGN KEY (ahsp_item_id) REFERENCES public.ahsp_item(id) ON DELETE RESTRICT;


--
-- Name: boq_item boq_item_created_by_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boq_item
    ADD CONSTRAINT boq_item_created_by_id_user_id_fk FOREIGN KEY (created_by_id) REFERENCES public."user"(id);


--
-- Name: boq_item boq_item_project_id_project_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boq_item
    ADD CONSTRAINT boq_item_project_id_project_id_fk FOREIGN KEY (project_id) REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: boq_resource_override boq_resource_override_ahsp_item_id_ahsp_item_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boq_resource_override
    ADD CONSTRAINT boq_resource_override_ahsp_item_id_ahsp_item_id_fk FOREIGN KEY (ahsp_item_id) REFERENCES public.ahsp_item(id) ON DELETE CASCADE;


--
-- Name: boq_resource_override boq_resource_override_project_id_project_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boq_resource_override
    ADD CONSTRAINT boq_resource_override_project_id_project_id_fk FOREIGN KEY (project_id) REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: boq_resource_override boq_resource_override_updated_by_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boq_resource_override
    ADD CONSTRAINT boq_resource_override_updated_by_id_user_id_fk FOREIGN KEY (updated_by_id) REFERENCES public."user"(id);


--
-- Name: boq_template boq_template_created_by_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boq_template
    ADD CONSTRAINT boq_template_created_by_id_user_id_fk FOREIGN KEY (created_by_id) REFERENCES public."user"(id);


--
-- Name: boq_version boq_version_created_by_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boq_version
    ADD CONSTRAINT boq_version_created_by_id_user_id_fk FOREIGN KEY (created_by_id) REFERENCES public."user"(id);


--
-- Name: boq_version boq_version_project_id_project_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boq_version
    ADD CONSTRAINT boq_version_project_id_project_id_fk FOREIGN KEY (project_id) REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: crew_assignment crew_assignment_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crew_assignment
    ADD CONSTRAINT crew_assignment_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public."user"(id);


--
-- Name: crew_assignment crew_assignment_crew_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crew_assignment
    ADD CONSTRAINT crew_assignment_crew_member_id_fkey FOREIGN KEY (crew_member_id) REFERENCES public.crew_member(id) ON DELETE CASCADE;


--
-- Name: crew_assignment crew_assignment_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crew_assignment
    ADD CONSTRAINT crew_assignment_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: crew_member crew_member_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crew_member
    ADD CONSTRAINT crew_member_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: daily_entry daily_entry_project_id_project_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_entry
    ADD CONSTRAINT daily_entry_project_id_project_id_fk FOREIGN KEY (project_id) REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: daily_entry daily_entry_submitted_by_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_entry
    ADD CONSTRAINT daily_entry_submitted_by_id_user_id_fk FOREIGN KEY (submitted_by_id) REFERENCES public."user"(id);


--
-- Name: entry_activity entry_activity_ahsp_item_id_ahsp_item_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entry_activity
    ADD CONSTRAINT entry_activity_ahsp_item_id_ahsp_item_id_fk FOREIGN KEY (ahsp_item_id) REFERENCES public.ahsp_item(id);


--
-- Name: entry_activity entry_activity_daily_entry_id_daily_entry_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entry_activity
    ADD CONSTRAINT entry_activity_daily_entry_id_daily_entry_id_fk FOREIGN KEY (daily_entry_id) REFERENCES public.daily_entry(id) ON DELETE CASCADE;


--
-- Name: entry_equipment_util entry_equipment_util_daily_entry_id_daily_entry_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entry_equipment_util
    ADD CONSTRAINT entry_equipment_util_daily_entry_id_daily_entry_id_fk FOREIGN KEY (daily_entry_id) REFERENCES public.daily_entry(id) ON DELETE CASCADE;


--
-- Name: entry_equipment_util entry_equipment_util_unit_id_unit_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entry_equipment_util
    ADD CONSTRAINT entry_equipment_util_unit_id_unit_id_fk FOREIGN KEY (unit_id) REFERENCES public.unit(id);


--
-- Name: entry_photo entry_photo_daily_entry_id_daily_entry_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entry_photo
    ADD CONSTRAINT entry_photo_daily_entry_id_daily_entry_id_fk FOREIGN KEY (daily_entry_id) REFERENCES public.daily_entry(id) ON DELETE CASCADE;


--
-- Name: feature_flag_override feature_flag_override_flag_key_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flag_override
    ADD CONSTRAINT feature_flag_override_flag_key_fkey FOREIGN KEY (flag_key) REFERENCES public.feature_flag(key) ON DELETE CASCADE;


--
-- Name: feature_flag_override feature_flag_override_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flag_override
    ADD CONSTRAINT feature_flag_override_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: hse_incident hse_incident_closed_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hse_incident
    ADD CONSTRAINT hse_incident_closed_by_id_fkey FOREIGN KEY (closed_by_id) REFERENCES public."user"(id);


--
-- Name: hse_incident hse_incident_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hse_incident
    ADD CONSTRAINT hse_incident_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: hse_incident hse_incident_reported_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hse_incident
    ADD CONSTRAINT hse_incident_reported_by_id_fkey FOREIGN KEY (reported_by_id) REFERENCES public."user"(id);


--
-- Name: idempotency_key idempotency_key_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idempotency_key
    ADD CONSTRAINT idempotency_key_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: invitation invitation_invited_by_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitation
    ADD CONSTRAINT invitation_invited_by_id_user_id_fk FOREIGN KEY (invited_by_id) REFERENCES public."user"(id);


--
-- Name: invitation invitation_organization_id_organization_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitation
    ADD CONSTRAINT invitation_organization_id_organization_id_fk FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: login_log login_log_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_log
    ADD CONSTRAINT login_log_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id);


--
-- Name: material_delivery material_delivery_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_delivery
    ADD CONSTRAINT material_delivery_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: material_delivery material_delivery_recorded_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_delivery
    ADD CONSTRAINT material_delivery_recorded_by_id_fkey FOREIGN KEY (recorded_by_id) REFERENCES public."user"(id);


--
-- Name: material_delivery material_delivery_stock_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_delivery
    ADD CONSTRAINT material_delivery_stock_id_fkey FOREIGN KEY (stock_id) REFERENCES public.material_stock(id) ON DELETE SET NULL;


--
-- Name: material_stock material_stock_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_stock
    ADD CONSTRAINT material_stock_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: material_stock material_stock_resource_master_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_stock
    ADD CONSTRAINT material_stock_resource_master_id_fkey FOREIGN KEY (resource_master_id) REFERENCES public.resource_master(id) ON DELETE SET NULL;


--
-- Name: membership membership_organization_id_organization_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membership
    ADD CONSTRAINT membership_organization_id_organization_id_fk FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: membership membership_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membership
    ADD CONSTRAINT membership_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: notification_channel notification_channel_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_channel
    ADD CONSTRAINT notification_channel_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: notification notification_organization_id_organization_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_organization_id_organization_id_fk FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: notification notification_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: org_secret org_secret_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_secret
    ADD CONSTRAINT org_secret_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public."user"(id);


--
-- Name: org_secret org_secret_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_secret
    ADD CONSTRAINT org_secret_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: project_assignment project_assignment_project_id_project_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assignment
    ADD CONSTRAINT project_assignment_project_id_project_id_fk FOREIGN KEY (project_id) REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: project_assignment project_assignment_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assignment
    ADD CONSTRAINT project_assignment_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: project project_created_by_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_created_by_id_user_id_fk FOREIGN KEY (created_by_id) REFERENCES public."user"(id);


--
-- Name: project_fleet_assignment project_fleet_assignment_assigned_by_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_fleet_assignment
    ADD CONSTRAINT project_fleet_assignment_assigned_by_id_user_id_fk FOREIGN KEY (assigned_by_id) REFERENCES public."user"(id);


--
-- Name: project_fleet_assignment project_fleet_assignment_project_id_project_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_fleet_assignment
    ADD CONSTRAINT project_fleet_assignment_project_id_project_id_fk FOREIGN KEY (project_id) REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: project_fleet_assignment project_fleet_assignment_unit_id_unit_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_fleet_assignment
    ADD CONSTRAINT project_fleet_assignment_unit_id_unit_id_fk FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: project project_organization_id_organization_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_organization_id_organization_id_fk FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: public_share public_share_created_by_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_share
    ADD CONSTRAINT public_share_created_by_id_user_id_fk FOREIGN KEY (created_by_id) REFERENCES public."user"(id);


--
-- Name: public_share public_share_project_id_project_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_share
    ADD CONSTRAINT public_share_project_id_project_id_fk FOREIGN KEY (project_id) REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: push_subscription push_subscription_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscription
    ADD CONSTRAINT push_subscription_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: qc_test qc_test_inspector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qc_test
    ADD CONSTRAINT qc_test_inspector_id_fkey FOREIGN KEY (inspector_id) REFERENCES public."user"(id);


--
-- Name: qc_test qc_test_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qc_test
    ADD CONSTRAINT qc_test_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: qc_test qc_test_retest_of_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qc_test
    ADD CONSTRAINT qc_test_retest_of_id_fkey FOREIGN KEY (retest_of_id) REFERENCES public.qc_test(id) ON DELETE SET NULL;


--
-- Name: resource_master resource_master_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resource_master
    ADD CONSTRAINT resource_master_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: resource_master_price resource_master_price_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resource_master_price
    ADD CONSTRAINT resource_master_price_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resource_master(id) ON DELETE CASCADE;


--
-- Name: schedule_baseline schedule_baseline_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_baseline
    ADD CONSTRAINT schedule_baseline_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: schedule_baseline schedule_baseline_set_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_baseline
    ADD CONSTRAINT schedule_baseline_set_by_fkey FOREIGN KEY (set_by) REFERENCES public."user"(id);


--
-- Name: session session_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: subcontract subcontract_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontract
    ADD CONSTRAINT subcontract_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: subcontract subcontract_subcontractor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontract
    ADD CONSTRAINT subcontract_subcontractor_id_fkey FOREIGN KEY (subcontractor_id) REFERENCES public.subcontractor(id) ON DELETE RESTRICT;


--
-- Name: subcontractor_invoice subcontractor_invoice_approved_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontractor_invoice
    ADD CONSTRAINT subcontractor_invoice_approved_by_id_fkey FOREIGN KEY (approved_by_id) REFERENCES public."user"(id);


--
-- Name: subcontractor_invoice subcontractor_invoice_subcontract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontractor_invoice
    ADD CONSTRAINT subcontractor_invoice_subcontract_id_fkey FOREIGN KEY (subcontract_id) REFERENCES public.subcontract(id) ON DELETE CASCADE;


--
-- Name: subcontractor_invoice subcontractor_invoice_submitted_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontractor_invoice
    ADD CONSTRAINT subcontractor_invoice_submitted_by_id_fkey FOREIGN KEY (submitted_by_id) REFERENCES public."user"(id);


--
-- Name: subcontractor subcontractor_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontractor
    ADD CONSTRAINT subcontractor_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: subscription subscription_organization_id_organization_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription
    ADD CONSTRAINT subscription_organization_id_organization_id_fk FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: unit_maintenance unit_maintenance_unit_id_unit_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_maintenance
    ADD CONSTRAINT unit_maintenance_unit_id_unit_id_fk FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE;


--
-- Name: unit unit_organization_id_organization_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit
    ADD CONSTRAINT unit_organization_id_organization_id_fk FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: usage_record usage_record_organization_id_organization_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_record
    ADD CONSTRAINT usage_record_organization_id_organization_id_fk FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: user_preference user_preference_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preference
    ADD CONSTRAINT user_preference_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: variation_order variation_order_approved_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variation_order
    ADD CONSTRAINT variation_order_approved_by_id_fkey FOREIGN KEY (approved_by_id) REFERENCES public."user"(id);


--
-- Name: variation_order variation_order_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variation_order
    ADD CONSTRAINT variation_order_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public."user"(id);


--
-- Name: variation_order variation_order_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variation_order
    ADD CONSTRAINT variation_order_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: weather_log weather_log_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weather_log
    ADD CONSTRAINT weather_log_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: weather_log weather_log_recorded_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weather_log
    ADD CONSTRAINT weather_log_recorded_by_id_fkey FOREIGN KEY (recorded_by_id) REFERENCES public."user"(id);


--
-- Name: webhook_delivery webhook_delivery_endpoint_id_webhook_endpoint_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_delivery
    ADD CONSTRAINT webhook_delivery_endpoint_id_webhook_endpoint_id_fk FOREIGN KEY (endpoint_id) REFERENCES public.webhook_endpoint(id) ON DELETE CASCADE;


--
-- Name: webhook_endpoint webhook_endpoint_created_by_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_endpoint
    ADD CONSTRAINT webhook_endpoint_created_by_id_user_id_fk FOREIGN KEY (created_by_id) REFERENCES public."user"(id);


--
-- Name: webhook_endpoint webhook_endpoint_organization_id_organization_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_endpoint
    ADD CONSTRAINT webhook_endpoint_organization_id_organization_id_fk FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict d61qgpjfSXpbHDbL2uofDMRxnGyqpAbLTNei0hiUs5mG4sfv7lmm0b6tIut6RrT

