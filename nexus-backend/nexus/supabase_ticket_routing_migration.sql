-- AI Direct Support Routing migration
-- Paste this file directly into the Supabase SQL editor.
-- Preserves existing projects, emails, documents, brds, project_metadata,
-- and unresolved_inputs tables.

create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'specialist'
    check (role in ('specialist', 'lead', 'manager', 'admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.specialist_queues (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ticket_domains (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  specialist_queue_id uuid references public.specialist_queues(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.queue_members (
  queue_id uuid not null references public.specialist_queues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  membership_role text not null default 'specialist'
    check (membership_role in ('specialist', 'lead', 'manager')),
  created_at timestamptz not null default now(),
  primary key (queue_id, user_id)
);

create table if not exists public.intent_routes (
  intent text primary key,
  queue_id uuid not null references public.specialist_queues(id) on delete restrict,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.intent_domain_routes (
  intent text primary key,
  domain_id uuid not null references public.ticket_domains(id) on delete restrict,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  source_channel text not null
    check (source_channel in ('email', 'chat', 'webhook')),
  source_id text,
  thread_id text,
  subject_scrubbed text not null default '',
  content_scrubbed text not null,
  pii_scrubbed boolean not null default true,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'escalated')),
  queue_id uuid references public.specialist_queues(id) on delete set null,
  domain_id uuid references public.ticket_domains(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tickets_scrubbed_content_check check (pii_scrubbed = true)
);

-- The tickets table already exists in the current Supabase schema.
-- Add the domain link separately so this migration works on that schema.
alter table public.tickets
  add column if not exists domain_id uuid references public.ticket_domains(id) on delete set null;

create unique index if not exists tickets_source_id_unique
  on public.tickets(source_channel, source_id)
  where source_id is not null;

create table if not exists public.ticket_predictions (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  intent text not null,
  sentiment text not null,
  confidence numeric(5,4) not null check (confidence >= 0 and confidence <= 1),
  explanation jsonb not null default '[]'::jsonb,
  provider text not null default 'local',
  model_version text,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.ticket_embeddings (
  ticket_id uuid primary key references public.tickets(id) on delete cascade,
  embedding vector(384) not null,
  text_hash text not null,
  outage_key text,
  created_at timestamptz not null default now()
);

create index if not exists ticket_embeddings_outage_key_idx
  on public.ticket_embeddings(outage_key)
  where outage_key is not null;

create or replace function public.match_ticket_embeddings(
  query_embedding vector(384),
  match_threshold float default 0.65,
  match_count int default 3,
  only_resolved boolean default false
)
returns table (
  ticket_id uuid,
  similarity float,
  subject_scrubbed text,
  content_scrubbed text,
  status text,
  queue_id uuid,
  domain_id uuid,
  created_at timestamptz
)
language sql
stable
security invoker
as $$
  select
    embeddings.ticket_id,
    1 - (embeddings.embedding <=> query_embedding) as similarity,
    tickets.subject_scrubbed,
    tickets.content_scrubbed,
    tickets.status,
    tickets.queue_id,
    tickets.domain_id,
    tickets.created_at
  from public.ticket_embeddings embeddings
  join public.tickets tickets on tickets.id = embeddings.ticket_id
  where (not only_resolved or tickets.status = 'resolved')
    and 1 - (embeddings.embedding <=> query_embedding) >= match_threshold
  order by embeddings.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

create unique index if not exists one_current_prediction_per_ticket
  on public.ticket_predictions(ticket_id)
  where is_current = true;

create table if not exists public.ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  actor_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Keep retained email ingestion linkable to the new ticket model.
alter table public.emails
  add column if not exists ticket_id uuid references public.tickets(id) on delete set null;

create index if not exists tickets_queue_status_idx
  on public.tickets(queue_id, status, received_at desc);
create index if not exists tickets_domain_status_idx
  on public.tickets(domain_id, status, received_at desc);
create index if not exists tickets_assigned_to_idx
  on public.tickets(assigned_to, status, received_at desc);
create index if not exists ticket_predictions_ticket_created_idx
  on public.ticket_predictions(ticket_id, created_at desc);
create index if not exists ticket_events_ticket_created_idx
  on public.ticket_events(ticket_id, created_at desc);
create index if not exists emails_ticket_id_idx
  on public.emails(ticket_id);

create index if not exists ticket_predictions_intent_idx
  on public.ticket_predictions(intent, sentiment, created_at desc);
create index if not exists ticket_embeddings_vector_idx
  on public.ticket_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists queues_set_updated_at on public.specialist_queues;
create trigger queues_set_updated_at
before update on public.specialist_queues
for each row execute function public.set_updated_at();

drop trigger if exists domains_set_updated_at on public.ticket_domains;
create trigger domains_set_updated_at
before update on public.ticket_domains
for each row execute function public.set_updated_at();

drop trigger if exists intent_domain_routes_set_updated_at on public.intent_domain_routes;
create trigger intent_domain_routes_set_updated_at
before update on public.intent_domain_routes
for each row execute function public.set_updated_at();

drop trigger if exists tickets_set_updated_at on public.tickets;
create trigger tickets_set_updated_at
before update on public.tickets
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id, display_name)
select id, coalesce(raw_user_meta_data ->> 'full_name', email)
from auth.users
on conflict (id) do nothing;

-- Authenticated users may inspect their own queue scope. Admins and managers
-- can inspect all active queues and memberships through the policies below.
insert into public.specialist_queues (slug, name, description)
values
  ('fraud-specialists', 'Fraud specialists', 'Unauthorized transactions and account abuse'),
  ('billing-specialists', 'Billing specialists', 'Payments, invoices, refunds, and charges'),
  ('account-specialists', 'Account specialists', 'Login, access, verification, and account recovery'),
  ('technical-specialists', 'Technical specialists', 'Product defects and technical failures'),
  ('general-specialists', 'General specialists', 'Fallback support queue')
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    updated_at = now();

insert into public.intent_routes (intent, queue_id)
select routes.intent, queues.id
from (values
  ('fraud', 'fraud-specialists'),
  ('billing', 'billing-specialists'),
  ('account', 'account-specialists'),
  ('technical', 'technical-specialists'),
  ('general', 'general-specialists')
) as routes(intent, slug)
join public.specialist_queues queues on queues.slug = routes.slug
on conflict (intent) do update
set queue_id = excluded.queue_id,
    is_active = true,
    updated_at = now();

insert into public.ticket_domains (slug, name, description, specialist_queue_id)
select replace(queues.slug, '-specialists', ''),
       initcap(replace(queues.slug, '-specialists', '')),
       queues.description,
       queues.id
from public.specialist_queues queues
where queues.slug in ('fraud-specialists', 'billing-specialists', 'account-specialists', 'technical-specialists', 'general-specialists')
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    specialist_queue_id = excluded.specialist_queue_id,
    updated_at = now();

insert into public.intent_domain_routes (intent, domain_id)
select routes.intent, domains.id
from (values
  ('fraud', 'fraud-specialists'),
  ('billing', 'billing-specialists'),
  ('account', 'account-specialists'),
  ('technical', 'technical-specialists'),
  ('general', 'general-specialists')
) as routes(intent, queue_slug)
join public.ticket_domains domains on domains.slug = replace(routes.queue_slug, '-specialists', '')
on conflict (intent) do update
set domain_id = excluded.domain_id,
    is_active = true,
    updated_at = now();

update public.tickets tickets
set domain_id = domains.id
from public.ticket_domains domains
where tickets.domain_id is null
  and domains.specialist_queue_id = tickets.queue_id;

comment on table public.tickets is
  'Sanitized support tickets. Raw PII and scrubber token maps must never be stored.';
comment on column public.tickets.content_scrubbed is
  'PII-scrubbed customer message used by models and specialist UI.';
comment on column public.ticket_predictions.explanation is
  'Bounded JSON array of SHAP-compatible trigger tokens and weights.';
