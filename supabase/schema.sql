-- ============================================================================
-- KESEN LARUS スタッフカレンダー データベース定義
--
-- 使い方: Supabase の管理画面 → SQL Editor にこのファイルの中身を貼り付けて実行。
-- 何度実行しても同じ結果になるよう書いてあります。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- スタッフ
-- ---------------------------------------------------------------------------
create table if not exists public.staff (
  id          uuid primary key default gen_random_uuid(),
  name        text    not null,
  color       text    not null default 'slate',
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 分類（マスタ。管理画面から随時追加できる）
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text    not null,
  color       text    not null default 'slate',
  icon        text    not null default 'dot',
  sort_order  integer not null default 0,
  hidden      boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 予定
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id           uuid primary key default gen_random_uuid(),
  scope        text not null check (scope in ('staff', 'store')),
  staff_id     uuid references public.staff (id) on delete set null,
  title        text not null,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  all_day      boolean not null default false,
  category_id  uuid not null references public.categories (id),
  location     text not null default '',
  note         text not null default '',
  created_by   text not null default '',
  updated_by   text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- 論理削除。null 以外なら削除済み。誤操作からの復旧に使う。
  deleted_at   timestamptz,

  -- 繰り返し用。v1 では常に null だが、後から機能を足すときに
  -- テーブルを作り直さずに済むよう最初から用意しておく。
  recurrence_rule  text,
  recurrence_until timestamptz,
  parent_event_id  uuid references public.events (id) on delete cascade,

  constraint events_period_valid check (ends_at >= starts_at),
  -- スタッフ予定は担当者が必須
  constraint events_staff_required check (scope <> 'staff' or staff_id is not null)
);

-- 期間での絞り込みが主な検索になるため、開始日時に索引を張る
create index if not exists events_starts_at_idx on public.events (starts_at);
create index if not exists events_staff_idx     on public.events (staff_id);
-- 削除済みを除いた検索を速くする
create index if not exists events_live_idx      on public.events (starts_at) where deleted_at is null;

-- 更新日時の自動更新
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_touch_updated_at on public.events;
create trigger events_touch_updated_at
  before update on public.events
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 行レベルセキュリティ
--
-- このアプリはブラウザから直接 Supabase を呼ばず、必ず Next.js のサーバー経由で
-- アクセスする（サーバーはサービスロールキーを使うため RLS を迂回する）。
-- 万一 anon キーが漏れても読み書きできないよう、RLS を有効にしたうえで
-- ポリシーを一切作らない＝誰も通れない状態にしておく。
-- ---------------------------------------------------------------------------
alter table public.staff      enable row level security;
alter table public.categories enable row level security;
alter table public.events     enable row level security;

-- ---------------------------------------------------------------------------
-- 初期データ
-- ---------------------------------------------------------------------------
insert into public.staff (name, color, sort_order, active)
select v.name, v.color, v.sort_order, true
from (values
  ('脇坂健吾', 'indigo',  1),
  ('和田悠晟', 'cyan',    2),
  ('小山裕介', 'emerald', 3),
  ('熊谷大輔', 'amber',   4),
  ('今野和倫', 'rose',    5)
) as v(name, color, sort_order)
where not exists (select 1 from public.staff s where s.name = v.name);

insert into public.categories (name, color, icon, sort_order, hidden)
select v.name, v.color, v.icon, v.sort_order, false
from (values
  ('休み',        'slate',  'rest',     1),
  ('外出',        'blue',   'out',      2),
  ('来客・打合せ', 'violet', 'guest',    3),
  ('会議',        'teal',   'meeting',  4),
  ('イベント・催事', 'orange', 'event',  5),
  ('その他',      'pink',   'dot',      6)
) as v(name, color, icon, sort_order)
where not exists (select 1 from public.categories c where c.name = v.name);
