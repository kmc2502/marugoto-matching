create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  nickname text not null default '',
  photo_url text not null default '',
  grade text not null default 'その他',
  hometown text not null default '',
  hobbies text[] not null default '{}',
  interests text[] not null default '{}',
  strengths text[] not null default '{}',
  project text not null default '',
  sp text not null default 'その他',
  effort text not null default '',
  message text not null default '',
  mbti text not null default '',
  sns text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_kamiyama check (email ilike '%@kamiyama.ac.jp')
);

create table if not exists public.want_links (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint want_links_unique unique (from_user, to_user),
  constraint want_links_self check (from_user <> to_user)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  to_user uuid not null references public.profiles(id) on delete cascade,
  from_user uuid references public.profiles(id) on delete cascade,
  type text not null check (type in ('want', 'match')),
  text text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.profile_visits (
  id uuid primary key default gen_random_uuid(),
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint profile_visits_self check (viewer_id <> viewed_id)
);

create table if not exists public.tag_options (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('hobbies', 'interests', 'strengths')),
  label text not null,
  created_at timestamptz not null default now(),
  constraint tag_options_unique unique (category, label)
);

insert into public.tag_options (category, label)
values
  ('hobbies', '#料理'),
  ('hobbies', '#作曲'),
  ('hobbies', '#音楽'),
  ('hobbies', '#写真'),
  ('hobbies', '#映画'),
  ('hobbies', '#読書'),
  ('hobbies', '#イラスト'),
  ('hobbies', '#ゲーム'),
  ('hobbies', '#登山'),
  ('hobbies', '#散歩'),
  ('hobbies', '#ランニング'),
  ('hobbies', '#化学'),
  ('hobbies', '#プログラミング'),
  ('hobbies', '#AI開発'),
  ('hobbies', '#アプリ開発'),
  ('hobbies', '#スポーツ'),
  ('hobbies', '#スポーツ観戦'),
  ('hobbies', '#映像制作'),
  ('hobbies', '#お菓子作り'),
  ('hobbies', '#手芸'),
  ('hobbies', '#演奏'),
  ('hobbies', '#釣り'),
  ('hobbies', '#キャンプ'),
  ('hobbies', '#山登り'),
  ('hobbies', '#川遊び'),
  ('hobbies', '#カフェ'),
  ('hobbies', '#旅行'),
  ('hobbies', '#メイク'),
  ('hobbies', '#ネイル'),
  ('hobbies', '#ファッション'),
  ('interests', '#起業'),
  ('interests', '#IP産業'),
  ('interests', '#教育'),
  ('interests', '#デザイン'),
  ('interests', '#UI/UXデザイン'),
  ('interests', '#エディトリアルデザイン'),
  ('interests', '#Webデザイン'),
  ('interests', '#Webプログラミング'),
  ('interests', '#AI'),
  ('interests', '#UI'),
  ('interests', '#ゲーム'),
  ('interests', '#環境'),
  ('interests', '#有機化学'),
  ('interests', '#ものづくり'),
  ('interests', '#言語学'),
  ('interests', '#歴史'),
  ('interests', '#スタートアップ'),
  ('interests', '#株'),
  ('interests', '#投資'),
  ('interests', '#金融'),
  ('interests', '#航空宇宙産業'),
  ('interests', '#地域'),
  ('interests', '#心理学'),
  ('interests', '#映像'),
  ('interests', '#芸術'),
  ('interests', '#建築'),
  ('interests', '#ロボティクス'),
  ('strengths', '#プレゼン'),
  ('strengths', '#ファシリテーション'),
  ('strengths', '#文章作成'),
  ('strengths', '#データ分析'),
  ('strengths', '#リサーチ'),
  ('strengths', '#UI設計'),
  ('strengths', '#Web開発'),
  ('strengths', '#アプリ開発'),
  ('strengths', '#プロトタイピング'),
  ('strengths', '#動画編集'),
  ('strengths', '#撮影'),
  ('strengths', '#イラスト制作'),
  ('strengths', '#企画'),
  ('strengths', '#英語'),
  ('strengths', '#チーム運営')
on conflict (category, label) do nothing;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_profiles_updated_at on public.profiles;
create trigger touch_profiles_updated_at
before update on public.profiles
for each row
execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null or new.email not ilike '%@kamiyama.ac.jp' then
    raise exception 'Only @kamiyama.ac.jp email addresses are allowed';
  end if;

  insert into public.profiles (
    id,
    email,
    nickname,
    photo_url
  )
  values (
    new.id,
    new.email,
    split_part(new.email, '@', 1),
    'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=240&q=80'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.want_links enable row level security;
alter table public.notifications enable row level security;
alter table public.profile_visits enable row level security;
alter table public.tag_options enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id and email ilike '%@kamiyama.ac.jp');

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id and email ilike '%@kamiyama.ac.jp');

drop policy if exists "want_links_select_authenticated" on public.want_links;
create policy "want_links_select_authenticated"
on public.want_links
for select
to authenticated
using (true);

drop policy if exists "want_links_insert_self" on public.want_links;
create policy "want_links_insert_self"
on public.want_links
for insert
to authenticated
with check (auth.uid() = from_user);

drop policy if exists "want_links_delete_self" on public.want_links;
create policy "want_links_delete_self"
on public.want_links
for delete
to authenticated
using (auth.uid() = from_user);

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
on public.notifications
for select
to authenticated
using (auth.uid() = to_user);

drop policy if exists "notifications_insert_authenticated" on public.notifications;
create policy "notifications_insert_authenticated"
on public.notifications
for insert
to authenticated
with check (auth.uid() = from_user or auth.uid() = to_user);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
on public.notifications
for update
to authenticated
using (auth.uid() = to_user)
with check (auth.uid() = to_user);

drop policy if exists "profile_visits_select_related" on public.profile_visits;
create policy "profile_visits_select_related"
on public.profile_visits
for select
to authenticated
using (auth.uid() = viewer_id or auth.uid() = viewed_id);

drop policy if exists "profile_visits_insert_self" on public.profile_visits;
create policy "profile_visits_insert_self"
on public.profile_visits
for insert
to authenticated
with check (auth.uid() = viewer_id);

drop policy if exists "tag_options_select_authenticated" on public.tag_options;
create policy "tag_options_select_authenticated"
on public.tag_options
for select
to authenticated
using (true);

drop policy if exists "tag_options_insert_authenticated" on public.tag_options;
create policy "tag_options_insert_authenticated"
on public.tag_options
for insert
to authenticated
with check (true);
